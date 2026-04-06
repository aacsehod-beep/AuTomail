const router      = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const parser      = require('../services/parser');
const mailer      = require('../services/mailer');
const templates   = require('../services/templates');
const { logBatch } = require('../services/logger');
const jobManager  = require('../services/jobManager');

const THRESHOLD   = Number(process.env.THRESHOLD_PERCENT || 75);
const BATCH_SIZE  = 5;
const DELAY_MS    = 300;

// POST /api/send
// multipart: sheet (file), payload (JSON string)
router.post('/', async (req, res) => {
  try {
    const payload    = JSON.parse(req.body.payload || '{}');
    const buffer     = req.files?.sheet?.data || null;
    const { type }   = payload;

    if (!type) return res.status(400).json({ error: 'Missing mail type' });

    // Collect uploaded PDF attachments → base64 array
    const rawAtts = req.files?.attachments
      ? (Array.isArray(req.files.attachments) ? req.files.attachments : [req.files.attachments])
      : [];
    const attachments = rawAtts.map(f => ({
      content:  f.data.toString('base64'),
      filename: f.name,
      type:     f.mimetype || 'application/pdf',
    }));

    // Collect individual certificate PDFs → map { key → {content, filename} }
    const rawCerts = req.files?.certFiles
      ? (Array.isArray(req.files.certFiles) ? req.files.certFiles : [req.files.certFiles])
      : [];
    const certMatchKey = payload.certMatchKey || 'regNo';
    const certMap = {};
    rawCerts.forEach(f => {
      const key = f.name.replace(/\.pdf$/i, '').trim().toLowerCase();
      certMap[key] = { content: f.data.toString('base64'), filename: f.name, type: 'application/pdf' };
    });

    // Per-student manual attachment mode: certFile_0, certFile_1, … keyed by email
    if (payload.certPerStudent && payload.certIndexMap) {
      const indexMap = payload.certIndexMap;
      Object.entries(indexMap).forEach(([email, idx]) => {
        const f = req.files?.[`certFile_${idx}`];
        if (f) certMap[email.toLowerCase()] = { content: f.data.toString('base64'), filename: f.name, type: 'application/pdf' };
      });
    }

    const recipients = (payload.recipients || []).filter(r => parser.isValidEmail(r.email));
    if (!recipients.length) return res.status(400).json({ error: 'No valid recipients' });

    const jobId = uuidv4();
    const originalFilename = req.files?.sheet?.name || '';
    jobManager.createJob({ id: jobId, type, title: payload.title || type, total: recipients.length, payload });

    // Respond immediately with job ID — processing happens async
    res.json({ jobId });

    // Run send job in background (intentionally not awaited)
    runJob(jobId, type, payload, recipients, buffer, originalFilename, attachments, certMap, certMatchKey).catch(err => {
      jobManager.updateJob(jobId, { status: 'Error: ' + err.message, finished: true });
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SSE progress stream  GET /api/send/progress/:jobId
// Auth: accepts Bearer header OR ?token= query param (EventSource doesn't support headers)
router.get('/progress/:jobId', (req, res) => {
  const { isValidToken } = require('../routes/auth');
  const token = req.query.token || (req.headers['authorization'] || '').replace('Bearer ', '');
  if (!isValidToken(token)) return res.status(401).json({ error: 'Unauthorised' });

  const { jobId } = req.params;
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  // Send current state immediately
  const job = jobManager.getJob(jobId);
  if (job) res.write(`data: ${JSON.stringify(job)}\n\n`);

  jobManager.addSseClient(jobId, res);
  req.on('close', () => jobManager.removeSseClient(jobId, res));
});

// GET /api/send/job/:jobId — poll fallback
router.get('/job/:jobId', (req, res) => {
  const job = jobManager.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// POST /api/send/cancel/:jobId
router.post('/cancel/:jobId', (req, res) => {
  jobManager.cancelJob(req.params.jobId);
  res.json({ ok: true });
});

// ─── Job Runner ───────────────────────────────────────────────────────────────
async function runJob(jobId, type, payload, recipients, buffer, originalFilename = '', attachments = [], certMap = {}, certMatchKey = 'regNo') {
  const sender  = process.env.SENDER_EMAIL || 'no-reply@aurora.edu';
  const logRows = [];
  let sent = 0, failed = 0, done = 0;

  // Group by section for attendance (to load sheet data once per section)
  const bySec = {};
  recipients.forEach(r => {
    (bySec[r.section] = bySec[r.section] || []).push(r);
  });

  // Pre-load attendance data per section if needed
  const attendanceCache = {};
  if (type === 'attendance' && buffer) {
    Object.keys(bySec).forEach(sec => {
      try {
        attendanceCache[sec] = parser.loadAttendanceData(buffer, sec, payload.mapping || {}, originalFilename, payload.subjLayout);
      } catch (e) {
        attendanceCache[sec] = null;
      }
    });
  }

  // Pre-load fee data from Excel if fee_reminder + sheet uploaded
  let feeDataMap = null; // email → { feeDetails }
  if (type === 'fee_reminder' && payload.feeFromExcel && buffer) {
    try {
      feeDataMap = parser.loadFeeData(buffer, originalFilename, payload.feeMapping || {});
    } catch (e) {
      console.error('[runJob] loadFeeData error:', e.message);
    }
  }

  const buildMessage = async (rec) => {
    const ctx = { Name: rec.name, Email: rec.email, RegNo: rec.regNo, Section: rec.section };

    switch (type) {
      case 'attendance': {
        const data = attendanceCache[rec.section];
        if (!data) throw new Error(`No sheet data for section ${rec.section}`);
        const student = data.students[rec.email.toLowerCase()];
        if (!student) throw new Error('No attendance record found for this student');
        ctx.WeekInfo = data.weekInfo;
        const { html, text } = templates.renderAttendanceHtml({
          ctx, subjects: student.subjects, threshold: payload.threshold || THRESHOLD,
        });
        return {
          to: rec.email, toName: rec.name,
          subject: `Attendance Report – ${data.weekInfo} – ${rec.name}`,
          html, text, attachments,
        };
      }

      case 'circular':
      case 'announcement':
      case 'event':
      case 'exam':
      case 'holiday':
      case 'fee':
      case 'general': {
        const subjectFilled = templates.fillTemplate(payload.subject || 'Notice from Aurora University', ctx);
        const { html, text } = templates.renderCircularHtml({
          subject:    subjectFilled,
          body:       payload.body || '',
          ctx,
          circularNo: payload.circularNo,
          category:   type,
        });
        return { to: rec.email, toName: rec.name, subject: subjectFilled, html, text, attachments };
      }

      case 'custom': {
        const subjectFilled = templates.fillTemplate(payload.subject || 'Message from Aurora University', ctx);
        const { html, text } = templates.renderCustomHtml({
          subject: subjectFilled, htmlBody: payload.htmlBody || '', ctx,
        });
        return { to: rec.email, toName: rec.name, subject: subjectFilled, html, text, attachments };
      }

      case 'fee_reminder': {
        // Use per-student fee data from Excel if available, else fall back to payload.feeDetails
        let studentFeeDetails = payload.feeDetails || [];
        if (feeDataMap) {
          const entry = feeDataMap.get(rec.email.toLowerCase());
          if (!entry) throw new Error(`No fee data found in sheet for ${rec.email}`);
          studentFeeDetails = entry.feeDetails;
          if (entry.name && !rec.name) rec = { ...rec, name: entry.name };
        }
        const subjectFilled = templates.fillTemplate(payload.subject || 'Fee Payment Reminder – {{Name}}', { ...ctx, Name: rec.name });
        const { html, text } = templates.renderFeeReminderHtml({ ctx: { ...ctx, Name: rec.name }, feeDetails: studentFeeDetails });
        return {
          to: rec.email, toName: rec.name,
          subject: subjectFilled,
          html, text, attachments,
        };
      }

      case 'certificate': {
        // Match this recipient's certificate from certMap
        const lookupKey = payload.certPerStudent
          ? rec.email.toLowerCase()
          : (certMatchKey === 'regNo' ? (rec.regNo || '') : (rec.name || '')).trim().toLowerCase();
        const certAtt = certMap[lookupKey];
        if (!certAtt) {
          if (payload.certPerStudent) throw new Error(`No certificate PDF attached for: ${rec.email}`);
          throw new Error(`No certificate PDF found for ${certMatchKey === 'regNo' ? 'Roll No' : 'Name'}: "${lookupKey || '(empty)'}"`);
        }
        const subjectFilled = templates.fillTemplate(payload.subject || `Your Certificate – ${rec.name}`, ctx);
        const { html, text } = templates.renderCertificateHtml({ ctx, body: payload.body || '' });
        return {
          to: rec.email, toName: rec.name, subject: subjectFilled, html, text,
          attachments: [certAtt],
        };
      }

      default:
        throw new Error('Unknown mail type: ' + type);
    }
  };

  for await (const result of mailer.sendBatch(recipients, buildMessage, { batchSize: BATCH_SIZE, delayMs: DELAY_MS })) {
    if (jobManager.isCancelled(jobId)) break;

    const rec = recipients[done];
    done++;

    if (result.success) {
      sent++;
      logRows.push({ jobId, type, recipient: result.email, name: rec?.name, regNo: rec?.regNo,
                     section: rec?.section, status: 'SENT', message: 'Delivered', sender });
    } else {
      failed++;
      console.error(`[runJob FAIL] email=${result.email} error=${result.error}`);
      logRows.push({ jobId, type, recipient: result.email, name: rec?.name, regNo: rec?.regNo,
                     section: rec?.section, status: 'FAILED', message: result.error, sender });
    }

    // Batch-write logs every 20 rows
    if (logRows.length >= 20) {
      logBatch(logRows.splice(0, logRows.length));
    }

    jobManager.updateJob(jobId, { sent, failed, done, status: `Sending (${done}/${recipients.length})` });
  }

  // Flush remaining logs
  if (logRows.length) logBatch(logRows);

  const finalStatus = jobManager.isCancelled(jobId) ? 'Cancelled' : 'Completed';
  jobManager.updateJob(jobId, { sent, failed, done, status: finalStatus, finished: true });
  jobManager.cleanupJob(jobId);

  // Admin notification on completion
  if (process.env.ADMIN_EMAIL && finalStatus === 'Completed') {
    const { html } = templates.renderCircularHtml({
      subject: `Bulk Mail Job Completed – ${type}`,
      body: `Job <strong>${jobId}</strong> completed.<br>Total: ${recipients.length} | Sent: ${sent} | Failed: ${failed}`,
      ctx: {}, category: 'general',
    });
    mailer.sendOne({ to: process.env.ADMIN_EMAIL, subject: `[Aurora] Bulk Job Done – ${type}`, html }).catch(() => {});
  }
}

// POST /api/send/resend/:jobId — re-send to all FAILED recipients of a previous job
router.post('/resend/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const db = require('../db');
    const job = db.prepare('SELECT * FROM jobs WHERE id=?').get([jobId]);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const payload = job.payload_json ? JSON.parse(job.payload_json) : null;
    if (!payload) return res.status(400).json({ error: 'This job has no saved payload (it may predate this feature). Cannot resend.' });

    const { getLogs } = require('../services/logger');
    const failedRows = getLogs({ jobId, status: 'FAILED', limit: 10000 });
    if (!failedRows.length) return res.status(400).json({ error: 'No failed recipients found for this job.' });

    // Rebuild recipients from the failed log rows
    const failedRecipients = failedRows.map(r => ({
      email: r.recipient, name: r.name, regNo: r.reg_no, section: r.section,
    })).filter(r => parser.isValidEmail(r.email));

    if (!failedRecipients.length) return res.status(400).json({ error: 'No valid email addresses in failed list.' });

    const newPayload = { ...payload, recipients: failedRecipients };
    const type       = newPayload.type || job.type;
    const newJobId   = uuidv4();
    jobManager.createJob({ id: newJobId, type, title: `Resend: ${job.title || type}`, total: failedRecipients.length, payload: newPayload });

    res.json({ jobId: newJobId });

    // Note: attachments/cert files are not re-uploaded so cert mode will fail gracefully
    runJob(newJobId, type, newPayload, failedRecipients, null, '', [], {}, newPayload.certMatchKey || 'regNo').catch(err => {
      jobManager.updateJob(newJobId, { status: 'Error: ' + err.message, finished: true });
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
