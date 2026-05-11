const nodemailer = require('nodemailer');

// Lazy-initialise transport so missing env vars don't crash on startup
let _transport = null;
function getTransport() {
  if (!_transport) {
    _transport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASS,
      },
    });
  }
  return _transport;
}

const FROM_EMAIL = process.env.SENDER_EMAIL || process.env.GMAIL_USER || 'no-reply@aurora.edu';
const FROM_NAME  = process.env.SENDER_NAME  || 'Aurora University';
const FROM       = `"${FROM_NAME}" <${FROM_EMAIL}>`;

/**
 * Send a single email.
 * Returns { success: true } or throws.
 */
async function sendOne({ to, toName, subject, html, text, attachments = [], replyTo }) {
  const msg = {
    from:    FROM,
    to:      toName ? `"${toName}" <${to}>` : to,
    subject,
    html,
    text:    text || subject,
  };

  if (replyTo) msg.replyTo = replyTo;

  if (attachments.length) {
    msg.attachments = attachments.map(att => ({
      content:     Buffer.from(att.content, 'base64'),
      filename:    att.filename,
      contentType: att.type || 'application/octet-stream',
    }));
  }

  await getTransport().sendMail(msg);
  return { success: true };
}

/**
 * Send to multiple recipients individually (personalised).
 * Yields { email, success, error } for each.
 */
async function* sendBatch(recipients, buildMessage, { batchSize = 5, delayMs = 300 } = {}) {
  for (let i = 0; i < recipients.length; i++) {
    const rec = recipients[i];
    try {
      const msg = await buildMessage(rec);
      await sendOne(msg);
      yield { email: rec.email, success: true };
    } catch (err) {
      const errMsg = err.message || 'Unknown error';
      yield { email: rec.email, success: false, error: errMsg };
    }

    // Batch pause
    if ((i + 1) % batchSize === 0 && i + 1 < recipients.length) {
      await sleep(delayMs);
    }
  }
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

module.exports = { sendOne, sendBatch };
