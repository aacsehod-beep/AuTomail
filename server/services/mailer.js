const https = require('https');
const http  = require('http');

const FROM_NAME = process.env.SENDER_NAME || 'Aurora University';

/**
 * POST JSON to a URL, following up to `maxRedirects` 3xx redirects.
 * GAS web apps return a 302 on the first POST — the redirect target is the real endpoint.
 */
function postJson(urlStr, body, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body, 'utf8');

    function doRequest(target, redirectsLeft) {
      const url = new URL(target);
      const lib = url.protocol === 'https:' ? https : http;
      const opts = {
        hostname: url.hostname,
        path:     url.pathname + url.search,
        method:   'POST',
        headers:  {
          'Content-Type':   'application/json',
          'Content-Length': buf.length,
        },
      };

      const req = lib.request(opts, (res) => {
        // Follow redirects
        if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
          res.resume(); // discard body
          if (redirectsLeft <= 0) return reject(new Error('Too many redirects from GAS relay'));
          // Resolve relative redirect URLs
          const next = new URL(res.headers.location, target).toString();
          return doRequest(next, redirectsLeft - 1);
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.success) resolve({ success: true });
            else reject(new Error(json.error || 'GAS relay failed'));
          } catch {
            if (res.statusCode >= 200 && res.statusCode < 400) resolve({ success: true });
            else reject(new Error(`GAS relay HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(60000, () => { req.destroy(); reject(new Error('GAS relay timeout')); });
      req.write(buf);
      req.end();
    }

    doRequest(urlStr, maxRedirects);
  });
}

/**
 * Send a single email via Google Apps Script relay.
 * GAS runs on Google servers — no SMTP, no IPv6 issues.
 */
async function sendOne({ to, toName, subject, html, text, attachments = [] }) {
  const gasUrl = process.env.GAS_MAIL_URL;
  if (!gasUrl) {
    throw new Error('GAS_MAIL_URL is not set. Deploy the GAS web app and add its URL to Render environment variables.');
  }

  const body = JSON.stringify({ to, toName, subject, html, text: text || subject, attachments });
  return postJson(gasUrl, body);
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
