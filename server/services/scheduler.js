/**
 * Scheduler worker — checks every 60 seconds for pending jobs whose run_at has passed.
 * Dispatches them via the same send pipeline used by the /api/send route.
 */
const db         = require('../db');
const mailer     = require('./mailer');
const templates  = require('./templates');
const { logBatch } = require('./logger');
const { v4: uuidv4 } = require('uuid');

const CHECK_INTERVAL = 60_000; // 1 minute

function start() {
  console.log('[Scheduler] Worker started — checking every 60s');
  setInterval(checkDue, CHECK_INTERVAL);
  // Run once immediately on startup too
  setTimeout(checkDue, 3000);
}

async function checkDue() {
  let due;
  try {
    due = db.prepare(`
      SELECT * FROM scheduled_jobs
      WHERE status = 'pending' AND run_at <= datetime('now')
      LIMIT 10
    `).all();
  } catch (e) {
    return;
  }

  for (const job of due) {
    // Mark it as running so it doesn't get picked up twice
    db.prepare(`UPDATE scheduled_jobs SET status='running' WHERE id=?`).run([job.id]);

    try {
      const payload = JSON.parse(job.payload || '{}');
      const recipients = payload.recipients || [];

      if (!recipients.length) {
        db.prepare(`UPDATE scheduled_jobs SET status='failed' WHERE id=?`).run([job.id]);
        console.warn(`[Scheduler] Job #${job.id} skipped — no recipients stored in payload`);
        continue;
      }

      const sender = process.env.SENDER_EMAIL || 'no-reply@aurora.edu';
      const logRows = [];
      let sent = 0, failed = 0;

      for (const rec of recipients) {
        const ctx = { Name: rec.name || '', Email: rec.email, RegNo: rec.regNo || '', Section: rec.section || '' };
        const subjectFilled = templates.fillTemplate(payload.subject || job.title, ctx);
        const { html, text } = templates.renderCircularHtml({
          subject:  subjectFilled,
          body:     payload.body || '',
          ctx,
          category: job.type || 'general',
        });

        try {
          await mailer.sendOne({ to: rec.email, toName: rec.name, subject: subjectFilled, html, text });
          sent++;
          logRows.push({ jobId: `sched-${job.id}`, type: job.type, recipient: rec.email,
            name: rec.name, regNo: rec.regNo, section: rec.section,
            status: 'SENT', message: 'Scheduled send', sender });
        } catch (err) {
          failed++;
          logRows.push({ jobId: `sched-${job.id}`, type: job.type, recipient: rec.email,
            name: rec.name, regNo: rec.regNo, section: rec.section,
            status: 'FAILED', message: err.message, sender });
        }
      }

      if (logRows.length) logBatch(logRows);
      db.prepare(`UPDATE scheduled_jobs SET status=? WHERE id=?`).run(
        [failed === recipients.length ? 'failed' : 'sent', job.id]
      );
      console.log(`[Scheduler] Job #${job.id} done — sent:${sent} failed:${failed}`);

    } catch (err) {
      db.prepare(`UPDATE scheduled_jobs SET status='failed' WHERE id=?`).run([job.id]);
      console.error(`[Scheduler] Job #${job.id} error:`, err.message);
    }
  }
}

module.exports = { start };
