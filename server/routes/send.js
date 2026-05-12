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

// Allowed MIME types for uploaded files
const ALLOWED_SHEET_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
]);
const ALLOWED_SHEET_EXTS = /\.(xlsx|xls|csv)$/i;
const ALLOWED_PDF_MIMES  = new Set(['application/pdf']);
const ALLOWED_PDF_EXT    = /\.pdf$/i;

function isAllowedSheet(f) {
  return ALLOWED_SHEET_MIMES.has(f.mimetype) || ALLOWED_SHEET_EXTS.test(f.name);
}
function isAllowedPdf(f) {
  return ALLOWED_PDF_MIMES.has(f.mimetype) || ALLOWED_PDF_EXT.test(f.name);
}

const MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KB for JSON payload string

// POST /api/send
// multipart: sheet (file), payload (JSON string)
router.post('/', async (req, res) => {
  try {
    const rawPayload = req.body.payload || '{}';
    if (rawPayload.length > MAX_PAYLOAD_BYTES) {
      return res.status(400).json({ error: 'Request payload too large.' });
    }
    const payload    = JSON.parse(rawPayload);
    const sheetFile  = req.files?.sheet || null;
    const buffer     = sheetFile?.data || null;
    const { type }   = payload;

    // H-4: validate uploaded sheet file type
    if (sheetFile && !isAllowedSheet(sheetFile)) {
      return res.status(400).json({ error: 'Invalid sheet file type. Only .xlsx, .xls, .csv allowed.' });
    }

    if (!type) return res.status(400).json({ error: 'Missing mail type' });

    // Collect uploaded PDF attachments → base64 array
    const rawAtts = req.files?.attachments
      ? (Array.isArray(req.files.attachments) ? req.files.attachments : [req.files.attachments])
      : [];
    // H-4: validate attachment types
    const invalidAtt = rawAtts.find(f => !isAllowedPdf(f));
    if (invalidAtt) return res.status(400).json({ error: `Invalid attachment type: ${invalidAtt.name}. Only PDF files are allowed.` });
    const attachments = rawAtts.map(f => ({
      content:  f.data.toString('base64'),
      filename: f.name,
      type:     'application/pdf',
    }));

    // Collect individual certificate PDFs → map { key → {content, filename} }
    const rawCerts = req.files?.certFiles
      ? (Array.isArray(req.files.certFiles) ? req.files.certFiles : [req.files.certFiles])
      : [];
    // H-4: validate certificate file types
    const invalidCert = rawCerts.find(f => !isAllowedPdf(f));
    if (invalidCert) return res.status(400).json({ error: `Invalid certificate file type: ${invalidCert.name}. Only PDF files are allowed.` });
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
        if (f && isAllowedPdf(f)) certMap[email.toLowerCase()] = { content: f.data.toString('base64'), filename: f.name, type: 'application/pdf' };
      });
    }

    // Optional per-student mapped PDF attachments (non-certificate mails)
    const rawDynAtts = req.files?.dynamicAttachFiles
      ? (Array.isArray(req.files.dynamicAttachFiles) ? req.files.dynamicAttachFiles : [req.files.dynamicAttachFiles])
      : [];
    const invalidDynAtt = rawDynAtts.find(f => !isAllowedPdf(f));
    if (invalidDynAtt) return res.status(400).json({ error: `Invalid dynamic attachment type: ${invalidDynAtt.name}. Only PDF files are allowed.` });
    const mappedAttachmentsMap = {};
    rawDynAtts.forEach(f => {
      const key = f.name.replace(/\.pdf$/i, '').trim().toLowerCase();
      mappedAttachmentsMap[key] = { content: f.data.toString('base64'), filename: f.name, type: 'application/pdf' };
    });

    const recipients = (payload.recipients || []).filter(r => parser.isValidEmail(r.email));
    if (!recipients.length) return res.status(400).json({ error: 'No valid recipients' });

    const jobId = uuidv4();
    const originalFilename = req.files?.sheet?.name || '';
    const payloadWithMeta = { ...payload, school: req.school || '' };
    jobManager.createJob({ id: jobId, type, title: payload.title || type, total: recipients.length, payload: payloadWithMeta });

    // Respond immediately with job ID — processing happens async
    res.json({ jobId });

    // Run send job in background (intentionally not awaited)
    runJob(jobId, type, payloadWithMeta, recipients, buffer, originalFilename, attachments, certMap, certMatchKey, req.school || '', null, mappedAttachmentsMap).catch(err => {
      jobManager.updateJob(jobId, { status: 'Error: ' + err.message, finished: true });
    });

  } catch (err) {
    console.error('[POST /api/send] error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
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

// POST /api/send/columns — detect column headers from an uploaded sheet
// Returns { headers: string[] } so the frontend can show available {{placeholders}}
router.post('/columns', (req, res) => {
  try {
    const sheetFile = req.files?.sheet || null;
    if (!sheetFile) return res.status(400).json({ error: 'No sheet uploaded' });
    if (!isAllowedSheet(sheetFile)) return res.status(400).json({ error: 'Invalid sheet type' });
    const rawPayload = req.body.mapping || '{}';
    let mapping = {};
    try { mapping = JSON.parse(rawPayload); } catch (_) {}
    const { headers } = parser.loadDynamicData(
      sheetFile.data,
      null,
      mapping,
      sheetFile.name,
    );
    res.json({ headers });
  } catch (err) {
    console.error('[POST /api/send/columns] error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

// ─── Job Runner ───────────────────────────────────────────────────────────────
async function runJob(jobId, type, payload, recipients, buffer, originalFilename = '', attachments = [], certMap = {}, certMatchKey = 'regNo', school = '', resumeState = null, mappedAttachmentsMap = {}) {
  const sender  = process.env.SENDER_EMAIL || 'no-reply@aurora.edu';
  const logRows = [];
  let sent = resumeState?.sent || 0;
  let failed = resumeState?.failed || 0;
  let done = resumeState?.done || 0;

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

  // Pre-load dynamic column data for template placeholders (all bulk types)
  let dynamicDataMap = null; // Map<email, { colHeader: value }>
  const BULK_TYPES = new Set(['circular','announcement','event','exam','holiday','fee','general','custom','certificate','fee_reminder']);
  if (payload.useSheetData && buffer && BULK_TYPES.has(type)) {
    try {
      const sections = [...new Set(recipients.map(r => r.section))];
      const result = parser.loadDynamicData(buffer, sections, payload.dynamicMapping || payload.mapping || {}, originalFilename);
      dynamicDataMap = result.dataMap;
    } catch (e) {
      console.error('[runJob] loadDynamicData error:', e.message);
    }
  }

  function pickLocalized(fieldDefault, i18nMap, lang) {
    if (!lang) return fieldDefault;
    const key = String(lang).toLowerCase();
    if (i18nMap && typeof i18nMap === 'object' && i18nMap[key]) return i18nMap[key];
    return fieldDefault;
  }

  function inferLanguage(rec, dynEntry) {
    return (
      rec?.language || rec?.lang || rec?.preferredLanguage || rec?.preferred_language ||
      dynEntry?.Language || dynEntry?.language || dynEntry?.Lang || dynEntry?.lang || dynEntry?.preferred_language ||
      'en'
    );
  }

  function buildDynamicAttachments(rec, ctx, dynEntry) {
    if (!payload.dynamicAttachmentEnabled) return [];

    if (payload.dynamicAttachmentMode === 'mapped') {
      const keyField = payload.dynamicAttachmentField || 'RegNo';
      const key = String(dynEntry?.[keyField] || rec?.[keyField] || rec?.regNo || rec?.email || '').trim().toLowerCase();
      const att = mappedAttachmentsMap[key];
      return att ? [att] : [];
    }

    if (payload.dynamicAttachmentMode === 'generated_txt') {
      const fileTpl = payload.dynamicAttachmentFileName || '{{RegNo}}-notice.txt';
      const bodyTpl = payload.dynamicAttachmentTemplate || 'Student: {{Name}}\nRegNo: {{RegNo}}\nSection: {{Section}}';
      const filename = templates.fillTemplate(fileTpl, ctx).replace(/[\\/:*?"<>|]+/g, '_');
      const content = templates.fillTemplate(bodyTpl, ctx);
      return [{
        content: Buffer.from(content, 'utf8').toString('base64'),
        filename,
        type: 'text/plain',
      }];
    }

    return [];
  }

  const buildMessage = async (rec) => {
    let ctx = { Name: rec.name, Email: rec.email, RegNo: rec.regNo, Section: rec.section };
    let dynEntry = null;

    // Merge per-student dynamic columns from sheet into ctx
    if (dynamicDataMap) {
      dynEntry = dynamicDataMap.get(rec.email.toLowerCase());
      if (!dynEntry) throw new Error(`Row not found in sheet for: ${rec.email} — check the header row and email column`);
      ctx = { ...dynEntry, ...ctx }; // built-ins (Name/Email/RegNo) override sheet columns of same name
    }
    const lang = inferLanguage(rec, dynEntry);
    const perRecipientAttachments = [...attachments, ...buildDynamicAttachments(rec, ctx, dynEntry)];

    switch (type) {
      case 'attendance': {
        const data = attendanceCache[rec.section];
        if (!data) throw new Error(`No sheet data for section ${rec.section}`);
        const student = data.students[rec.email.toLowerCase()];
        if (!student) throw new Error('Student not found in the uploaded sheet — check email column mapping');
        if (student.parseError) throw new Error(student.parseError);
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
        const localizedSubject = pickLocalized(payload.subject || 'Notice from Aurora University', payload.subjectI18n, lang);
        const localizedBody = pickLocalized(payload.body || '', payload.bodyI18n, lang);
        const subjectFilled = templates.fillTemplate(localizedSubject, ctx);
        const { html, text } = templates.renderCircularHtml({
          subject:    subjectFilled,
          body:       localizedBody,
          ctx,
          circularNo: payload.circularNo,
          category:   type,
        });
        return { to: rec.email, toName: rec.name, subject: subjectFilled, html, text, attachments: perRecipientAttachments };
      }

      case 'custom': {
        const localizedSubject = pickLocalized(payload.subject || 'Message from Aurora University', payload.subjectI18n, lang);
        const subjectFilled = templates.fillTemplate(localizedSubject, ctx);
        const { html, text } = templates.renderCustomHtml({
          subject: subjectFilled, htmlBody: payload.htmlBody || '', ctx,
        });
        return { to: rec.email, toName: rec.name, subject: subjectFilled, html, text, attachments: perRecipientAttachments };
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
        const localizedSubject = pickLocalized(payload.subject || 'Fee Payment Reminder – {{Name}}', payload.subjectI18n, lang);
        const subjectFilled = templates.fillTemplate(localizedSubject, { ...ctx, Name: rec.name });
        const { html, text } = templates.renderFeeReminderHtml({ ctx: { ...ctx, Name: rec.name }, feeDetails: studentFeeDetails });
        return {
          to: rec.email, toName: rec.name,
          subject: subjectFilled,
          html, text, attachments: perRecipientAttachments,
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
        const localizedSubject = pickLocalized(payload.subject || `Your Certificate – ${rec.name}`, payload.subjectI18n, lang);
        const localizedBody = pickLocalized(payload.body || '', payload.bodyI18n, lang);
        const subjectFilled = templates.fillTemplate(localizedSubject, ctx);
        const { html, text } = templates.renderCertificateHtml({ ctx, body: localizedBody });
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
                     section: rec?.section, status: 'SENT', message: 'Delivered', sender, school });
    } else {
      failed++;
      console.error(`[runJob FAIL] email=${result.email} error=${result.error}`);
      logRows.push({ jobId, type, recipient: result.email, name: rec?.name, regNo: rec?.regNo,
                     section: rec?.section, status: 'FAILED', message: result.error, sender, school });
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

async function resumeInterruptedJobs() {
  const interrupted = jobManager.listInterruptedJobs();
  if (!interrupted.length) return;

  for (const job of interrupted) {
    try {
      const payload = job.payload_json ? JSON.parse(job.payload_json) : null;
      const recipients = payload?.recipients || [];
      if (!payload || !recipients.length) {
        jobManager.updateJob(job.id, { status: 'Failed to resume: missing payload/recipients', finished: true });
        continue;
      }

      const done = Number(job.done || 0);
      if (done >= recipients.length) {
        jobManager.updateJob(job.id, {
          sent: Number(job.sent || 0),
          failed: Number(job.failed || 0),
          done,
          status: 'Completed',
          finished: true,
        });
        continue;
      }

      const remainingRecipients = recipients.slice(done);
      const school = payload.school || '';
      jobManager.markResuming(job.id);

      runJob(
        job.id,
        payload.type || job.type,
        payload,
        remainingRecipients,
        null,
        '',
        [],
        {},
        payload.certMatchKey || 'regNo',
        school,
        { sent: Number(job.sent || 0), failed: Number(job.failed || 0), done }
      ).catch(err => {
        jobManager.updateJob(job.id, { status: 'Error: ' + err.message, finished: true });
      });
    } catch (err) {
      jobManager.updateJob(job.id, { status: 'Error: ' + err.message, finished: true });
    }
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
    const { getSchoolDb } = require('../db');
    const logDb = getSchoolDb(payload.school || req.school || '');
    const failedRows = getLogs(logDb, { jobId, status: 'FAILED', limit: 10000 });
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
    console.error('[POST /api/send/resend] error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

module.exports = router;

setTimeout(() => {
  resumeInterruptedJobs().catch(err => {
    console.error('[ResumeJobs] startup resume error:', err.message);
  });
}, 1200);
