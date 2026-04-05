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

    const recipients = (payload.recipients || []).filter(r => parser.isValidEmail(r.email));
    if (!recipients.length) return res.status(400).json({ error: 'No valid recipients' });

    const jobId = uuidv4();
    const originalFilename = req.files?.sheet?.name || '';
    jobManager.createJob({ id: jobId, type, title: payload.title || type, total: recipients.length });

    // Respond immediately with job ID — processing happens async
    res.json({ jobId });

    // Run send job in background (intentionally not awaited)
    runJob(jobId, type, payload, recipients, buffer, originalFilename, attachments).catch(err => {
      jobManager.updateJob(jobId, { status: 'Error: ' + err.message, finished: true });
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SSE progress stream  GET /api/send/progress/:jobId
router.get('/progress/:jobId', (req, res) => {
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
async function runJob(jobId, type, payload, recipients, buffer, originalFilename = '', attachments = []) {
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
        attendanceCache[sec] = parser.loadAttendanceData(buffer, sec, payload.mapping || {}, originalFilename);
      } catch (e) {
        attendanceCache[sec] = null;
      }
    });
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
        const { html, text } = templates.renderFeeReminderHtml({ ctx, feeDetails: payload.feeDetails || [] });
        return {
          to: rec.email, toName: rec.name,
          subject: `Fee Payment Reminder – ${rec.name}`,
          html, text, attachments,
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

module.exports = router;
