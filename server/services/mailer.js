const sgMail = require('@sendgrid/mail');

const FROM_EMAIL = process.env.SENDER_EMAIL || 'no-reply@aurora.edu';
const FROM_NAME  = process.env.SENDER_NAME  || 'Aurora University';

// Initialise SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Send a single email via SendGrid.
 * Returns { success: true } or throws.
 */
async function sendOne({ to, toName, subject, html, text, attachments = [], replyTo }) {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY is not set. Please add it in Render environment variables.');
  }

  const msg = {
    from:    { name: FROM_NAME, email: FROM_EMAIL },
    to:      toName ? { name: toName, email: to } : to,
    subject,
    html,
    text:    text || subject,
  };

  if (replyTo) msg.replyTo = replyTo;

  if (attachments.length) {
    msg.attachments = attachments.map(att => ({
      content:     att.content,           // already base64
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
async function* sendBatch(recipients, buildMessage, { batchSize = 10, delayMs = 150 } = {}) {
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

    // Batch pause (shorter since pool reuses connections)
    if ((i + 1) % batchSize === 0 && i + 1 < recipients.length) {
      await sleep(delayMs);
    }
  }
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

module.exports = { sendOne, sendBatch };
