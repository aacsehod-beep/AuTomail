const https = require('https');

const FROM_NAME = process.env.SENDER_NAME || 'Aurora University';

/**
 * Send a single email via Google Apps Script relay.
 * GAS runs on Google servers — no SMTP, no IPv6 issues.
 */
async function sendOne({ to, toName, subject, html, text }) {
  const gasUrl = process.env.GAS_MAIL_URL;
  if (!gasUrl) {
    throw new Error('GAS_MAIL_URL is not set. Deploy the GAS web app and add its URL to Render environment variables.');
  }

  const body = JSON.stringify({ to, toName, subject, html, text: text || subject });

  return new Promise((resolve, reject) => {
    const url = new URL(gasUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.success) resolve({ success: true });
          else reject(new Error(json.error || 'GAS relay failed'));
        } catch {
          // GAS sometimes returns redirect HTML — treat 2xx as success
          if (res.statusCode >= 200 && res.statusCode < 400) resolve({ success: true });
          else reject(new Error(`GAS relay HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('GAS relay timeout')); });
    req.write(body);
    req.end();
  });
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
