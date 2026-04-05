const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM = {
  email: process.env.SENDER_EMAIL || 'no-reply@aurora.edu',
  name:  process.env.SENDER_NAME  || 'Aurora University',
};

/**
 * Send a single email.
 * Returns { success: true } or throws.
 */
async function sendOne({ to, toName, subject, html, text, attachments = [], replyTo }) {
  const msg = {
    to:      { email: to, name: toName || to },
    from:    FROM,
    subject,
    html,
    text:    text || subject,
  };

  if (replyTo) msg.replyTo = replyTo;

  if (attachments.length) {
    msg.attachments = attachments.map(att => ({
      content:     att.content,   // base64 string
      filename:    att.filename,
      type:        att.type || 'application/octet-stream',
      disposition: 'attachment',
    }));
  }

  await sgMail.send(msg);
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
      const errMsg = err?.response?.body?.errors?.[0]?.message || err.message || 'Unknown error';
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
