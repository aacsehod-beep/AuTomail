const router = require('express').Router();
const { getSchoolDb } = require('../db');
const { stripHtml } = require('../services/templates');

// GET /api/templates
router.get('/', (req, res) => {
  const db = getSchoolDb(req.school);
  const rows = db.prepare('SELECT * FROM templates ORDER BY updated_at DESC').all();
  res.json(rows);
});

// POST /api/templates
router.post('/', (req, res) => {
  try {
    const { name, type, subject, body, subjectI18n, bodyI18n } = req.body;
    if (!name || !type || !subject || !body) return res.status(400).json({ error: 'Missing fields' });
    const now = new Date().toISOString();
    const db = getSchoolDb(req.school);
    const safeSubjectI18n = JSON.stringify(subjectI18n && typeof subjectI18n === 'object' ? subjectI18n : {});
    const safeBodyI18n = JSON.stringify(bodyI18n && typeof bodyI18n === 'object' ? bodyI18n : {});
    db.prepare(`
      INSERT INTO templates (name, type, subject, body, subject_i18n, body_i18n, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET type=excluded.type, subject=excluded.subject,
        body=excluded.body, subject_i18n=excluded.subject_i18n, body_i18n=excluded.body_i18n, updated_at=excluded.updated_at
    `).run([name, type, subject, body, safeSubjectI18n, safeBodyI18n, now, now]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/templates] error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', (req, res) => {
  const db = getSchoolDb(req.school);
  db.prepare('DELETE FROM templates WHERE id=?').run([req.params.id]);
  res.json({ ok: true });
});

function localSuggestSubjects({ type, body, htmlBody, language = 'en' }) {
  const src = String(body || stripHtml(String(htmlBody || '')) || '').trim();
  const line = src.split(/\n+/).find(Boolean) || '';
  const base = line.slice(0, 60).replace(/["'`]/g, '').trim();
  const prefixMap = {
    circular: 'Official Circular',
    announcement: 'Important Announcement',
    event: 'Event Notice',
    exam: 'Exam Update',
    holiday: 'Holiday Notice',
    fee: 'Fee Reminder',
    fee_reminder: 'Fee Reminder',
    attendance: 'Attendance Alert',
    general: 'Notice',
    custom: 'Important Message',
    certificate: 'Certificate Update',
  };
  const p = prefixMap[type] || 'Notice';
  const humanDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  if (language === 'hi') {
    return [
      `${p}: ${base || 'महत्वपूर्ण सूचना'}`,
      `${p} | कार्रवाई आवश्यक (${humanDate})`,
      `${p} | कृपया पढ़ें`,
    ];
  }

  return [
    `${p}: ${base || 'Important update'}`,
    `${p} | Action Required (${humanDate})`,
    `${p} | Please Read`,
  ];
}

// Enhance/rephrase user's body with appropriate closing based on type
function localEnhanceBody({ type, body = '', language = 'en' }) {
  if (!body || !body.trim()) {
    // If user provided no body, return a template
    const templates = {
      circular: `Dear Students,\n\nPlease find the official circular attached.\n\nBest regards,\nAdministration`,
      announcement: `Dear All,\n\nWe are pleased to announce the following:\n\n[Add your announcement details]\n\nThank you,\nManagement`,
      event: `Dear Students,\n\nYou are cordially invited to attend our upcoming event.\n\nEvent Details:\n- Date: [Date]\n- Time: [Time]\n- Venue: [Location]\n\nPlease confirm your attendance.\n\nRegards,\nThe Organizing Committee`,
      exam: `Dear Students,\n\nThis is to inform you about the upcoming examination.\n\nExamination Details:\n- Subject: [Subject]\n- Date: [Date]\n- Time: [Time]\n- Duration: [Duration]\n\nPlease prepare accordingly.\n\nBest wishes,\nAcademic Affairs`,
      holiday: `Dear All,\n\nPlease note that the institution will remain closed on the dates mentioned below.\n\n[Holiday Dates]\n\nNormal operations will resume after the holiday period.\n\nRegards,\nAdministration`,
      fee: `Dear Parents/Guardians,\n\nThis is a reminder to pay the due fees for the current term.\n\nFee Details:\n- Amount: [Amount]\n- Due Date: [Date]\n- Late Fee: [Amount after due date]\n\nPlease make the payment at the earliest to avoid penalties.\n\nThank you,\nAccounts Department`,
      general: `Dear {{Name}},\n\nThis is to inform you that:\n\n[Details]\n\nFor more information, please contact the office.\n\nBest regards,\nManagement`,
      certificate: `Dear {{Name}},\n\nCongratulations! Please find your certificate attached.\n\nBest wishes,\nAurora University`,
      attendance: `Dear {{Name}},\n\nThis is to confirm your attendance record.\n\nRegards,\nAcademic Affairs`,
    };
    return templates[type] || templates['general'];
  }
  // User provided body — enhance it with appropriate closing
  const closings = {
    circular: `\n\nBest regards,\nAdministration`,
    announcement: `\n\nThank you,\nManagement`,
    event: `\n\nWe look forward to your attendance.\n\nRegards,\nThe Organizing Committee`,
    exam: `\n\nBest wishes for the examination.\n\nAcademic Affairs`,
    holiday: `\n\nRegards,\nAdministration`,
    fee: `\n\nPlease contact the Accounts Department for any queries.\n\nThank you,\nAccounts Department`,
    attendance: `\n\nRegards,\nAcademic Affairs`,
    certificate: `\n\nBest wishes,\nAurora University`,
    general: `\n\nBest regards,\nAdministration`,
  };
  const closing = closings[type] || closings['general'];
  const trimmedBody = body.trim();
  // If body already ends with a closing line, don't add another
  if (trimmedBody.toLowerCase().includes('regards') || trimmedBody.toLowerCase().includes('thank')) {
    return trimmedBody;
  }
  return trimmedBody + closing;
}

// POST /api/templates/suggest-content (suggests both subject and body)
router.post('/suggest-content', async (req, res) => {
  try {
    const { type = 'general', body = '', htmlBody = '', language = 'en' } = req.body || {};
    const promptSource = String(body || stripHtml(String(htmlBody || '')) || '').trim().slice(0, 1200);
    let provider = 'local';
    let subject = null;
    let suggestedBody = null;

    // Try AI provider if OPENAI_API_KEY is configured
    if (process.env.OPENAI_API_KEY && promptSource) {
      try {
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0.7,
            messages: [
              {
                role: 'system',
                content: 'You are a professional email writer for school communications. The user has drafted an email. IMPROVE and REPHRASE their text to be more professional and polished while keeping the core message. Return JSON object with keys "subject" (string, a concise professional subject line) and "body" (string, the IMPROVED version of their text with better formatting and phrasing). Keep placeholders like {{Name}} intact.',
              },
              {
                role: 'user',
                content: `Email Type: ${type}\nLanguage: ${language}\nUser's Draft:\n${promptSource}`,
              },
            ],
          }),
        });
        if (aiRes.ok) {
          const data = await aiRes.json();
          const raw = data?.choices?.[0]?.message?.content || '';
          try {
            const parsed = JSON.parse(raw);
            if (parsed.subject) subject = parsed.subject;
            if (parsed.body) suggestedBody = parsed.body;
            if (subject && suggestedBody) provider = 'ai';
          } catch (_) {}
        }
      } catch (_) {
        // Fall back to local
      }
    }

    // Fall back to local suggestions if AI didn't work
    if (!subject) {
      const suggestions = localSuggestSubjects({ type, body: promptSource, htmlBody, language });
      subject = suggestions[0] || 'Important Notice';
    }
    if (!suggestedBody) {
      suggestedBody = localEnhanceBody({ type, body: promptSource, language });
    }

    res.json({ subject, body: suggestedBody, provider });
  } catch (err) {
    console.error('[POST /api/templates/suggest-content] error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

// POST /api/templates/suggest-subject (legacy, kept for backward compat)
router.post('/suggest-subject', async (req, res) => {
  try {
    const { type = 'general', body = '', htmlBody = '', language = 'en' } = req.body || {};
    const promptSource = String(body || stripHtml(String(htmlBody || '')) || '').trim().slice(0, 1200);
    const suggestions = localSuggestSubjects({ type, body: promptSource, htmlBody, language });
    res.json({ suggestions, provider: 'local' });
  } catch (err) {
    console.error('[POST /api/templates/suggest-subject] error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

// GET /api/templates/attendance-sample (download sample attendance sheet)
router.get('/attendance-sample', (req, res) => {
  const sampleCSV = `Name,Email,RegNo,Section,Status,Date,Remarks
Raj Kumar,raj@example.com,REG001,A,Present,2026-05-12,On time
Priya Singh,priya@example.com,REG002,A,Absent,2026-05-12,Medical leave
Akhil Sharma,akhil@example.com,REG003,B,Present,2026-05-12,On time
Neha Gupta,neha@example.com,REG004,B,Late,2026-05-12,Delayed entry
`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="AttendanceSample.csv"');
  res.send(sampleCSV);
});

module.exports = router;
