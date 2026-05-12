const https = require('https');
const http  = require('http');
const nodemailer = require('nodemailer');
const dnsPromises = require('dns').promises;

const FROM_NAME = process.env.SENDER_NAME || 'Aurora University';

// Cache the resolved IPv4 address so we only DNS-lookup once per process lifetime
let _gmailIPv4 = null;
async function getGmailIPv4() {
  if (_gmailIPv4) return _gmailIPv4;
  try {
    const addrs = await dnsPromises.resolve4('smtp.gmail.com');
    _gmailIPv4 = addrs[0];
    console.log('[mailer] Resolved smtp.gmail.com IPv4 =>', _gmailIPv4);
  } catch {
    _gmailIPv4 = 'smtp.gmail.com'; // fallback
  }
  return _gmailIPv4;
}

/**
 * POST JSON to a GAS /exec URL.
 * GAS pattern:
 *   1. POST body to /exec  → GAS runs doPost(e) → returns 302 to output URL
 *   2. GET the output URL  → returns the JSON response from doPost
 */
function postToGas(urlStr, body) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body, 'utf8');

    // Step 1: POST the body to /exec
    function doPost(target) {
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
        if ((res.statusCode >= 301 && res.statusCode <= 308) && res.headers.location) {
          res.resume(); // discard body
          const next = new URL(res.headers.location, target).toString();
          return doGet(next); // follow redirect with GET to collect response
        }
        // No redirect — read response directly
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => parseResponse(res.statusCode, data));
      });
      req.on('error', reject);
      req.setTimeout(60000, () => { req.destroy(); reject(new Error('GAS relay timeout')); });
      req.write(buf);
      req.end();
    }

    // Step 2: GET the redirect URL to retrieve the doPost() output
    function doGet(target) {
      const url = new URL(target);
      const lib = url.protocol === 'https:' ? https : http;
      const opts = { hostname: url.hostname, path: url.pathname + url.search, method: 'GET' };
      const req = lib.request(opts, (res) => {
        // Handle nested redirects (rare but possible)
        if ((res.statusCode >= 301 && res.statusCode <= 308) && res.headers.location) {
          res.resume();
          return doGet(new URL(res.headers.location, target).toString());
        }
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => parseResponse(res.statusCode, data));
      });
      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('GAS response timeout')); });
      req.end();
    }

    function parseResponse(status, data) {
      try {
        const json = JSON.parse(data);
        if (json.success) resolve({ success: true });
        else reject(new Error(json.error || 'GAS relay returned failure'));
      } catch {
        if (status >= 200 && status < 400) resolve({ success: true });
        else reject(new Error(`GAS relay HTTP ${status}: ${data.slice(0, 200)}`));
      }
    }

    doPost(urlStr);
  });
}

/**
 * Send via Gmail SMTP using per-user App Password credentials.
 */
async function sendViaSmtp({ to, toName, subject, html, text, attachments = [], senderEmail, smtpAppPass }) {
  // Explicitly resolve to IPv4 address — nodemailer's tls.connect() ignores family/setDefaultResultOrder
  const smtpHost = await getGmailIPv4();

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: 465,
    secure: true,
    tls: { servername: 'smtp.gmail.com' },   // keep TLS cert validation for smtp.gmail.com
    auth: { user: senderEmail, pass: smtpAppPass },
  });

  const mailOpts = {
    from: `"${FROM_NAME}" <${senderEmail}>`,
    to: toName ? `"${toName}" <${to}>` : to,
    subject,
    html: html || text || subject,
    text: text || subject,
  };

  if (attachments && attachments.length > 0) {
    mailOpts.attachments = attachments.map(att => ({
      filename: att.filename,
      content:  Buffer.from(att.content, 'base64'),
      contentType: att.type || 'application/pdf',
    }));
  }

  await transporter.sendMail(mailOpts);
  return { success: true };
}

/**
 * Send a single email.
 * If senderEmail + smtpAppPass are provided, use Gmail SMTP directly.
 * Otherwise fall back to GAS relay.
 */
async function sendOne({ to, toName, subject, html, text, attachments = [], senderEmail, smtpAppPass }) {
  if (senderEmail && smtpAppPass) {
    return sendViaSmtp({ to, toName, subject, html, text, attachments, senderEmail, smtpAppPass });
  }

  const gasUrl = process.env.GAS_MAIL_URL;
  if (!gasUrl) {
    throw new Error('GAS_MAIL_URL is not set. Deploy the GAS web app and add its URL to Render environment variables.');
  }
  const body = JSON.stringify({ to, toName, subject, html, text: text || subject, attachments });
  return postToGas(gasUrl, body);
}

/**
 * Send to multiple recipients individually (personalised).
 * Yields { email, success, error } for each.
 */
async function* sendBatch(recipients, buildMessage, { batchSize = 10, delayMs = 150 } = {}, senderEmail = '', smtpAppPass = '') {
  for (let i = 0; i < recipients.length; i++) {
    const rec = recipients[i];
    try {
      const msg = await buildMessage(rec);
      await sendOne({ ...msg, senderEmail, smtpAppPass });
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
