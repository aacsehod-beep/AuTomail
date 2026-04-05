const db = require('../db');

// In-memory job registry: jobId → { cancelled: bool, sseClients: Set }
const jobRegistry = new Map();

function createJob({ id, type, title, total }) {
  db.prepare(`
    INSERT INTO jobs (id, type, title, total, sent, failed, done, status, finished, cancelled, created_at)
    VALUES (?, ?, ?, ?, 0, 0, 0, 'running', 0, 0, ?)
  `).run([id, type, title || type, total, new Date().toISOString()]);

  jobRegistry.set(id, { cancelled: false, sseClients: new Set() });
}

function updateJob(id, { sent, failed, done, status, finished }) {
  const fields = [];
  const vals   = [];
  if (sent      !== undefined) { fields.push('sent=?');    vals.push(sent);    }
  if (failed    !== undefined) { fields.push('failed=?');  vals.push(failed);  }
  if (done      !== undefined) { fields.push('done=?');    vals.push(done);    }
  if (status    !== undefined) { fields.push('status=?');  vals.push(status);  }
  if (finished) {
    fields.push('finished=1'); fields.push('finished_at=?'); vals.push(new Date().toISOString());
  }
  if (fields.length === 0) return;
  vals.push(id);
  db.prepare(`UPDATE jobs SET ${fields.join(',')} WHERE id=?`).run(vals);

  // Broadcast to SSE clients
  broadcastProgress(id);
}

function getJob(id) {
  return db.prepare('SELECT * FROM jobs WHERE id=?').get([id]);
}

function cancelJob(id) {
  const reg = jobRegistry.get(id);
  if (reg) reg.cancelled = true;
  db.prepare(`UPDATE jobs SET cancelled=1, status='Cancelled' WHERE id=?`).run([id]);
  broadcastProgress(id);
  return true;
}

function isCancelled(id) {
  const reg = jobRegistry.get(id);
  return reg ? reg.cancelled : false;
}

// ── SSE Progress ──────────────────────────────────────────────────────────────
function addSseClient(jobId, res) {
  const reg = jobRegistry.get(jobId);
  if (reg) reg.sseClients.add(res);
}

function removeSseClient(jobId, res) {
  const reg = jobRegistry.get(jobId);
  if (reg) reg.sseClients.delete(res);
}

function broadcastProgress(jobId) {
  const job = getJob(jobId);
  if (!job) return;
  const reg = jobRegistry.get(jobId);
  if (!reg || reg.sseClients.size === 0) return;

  const data = JSON.stringify(job);
  reg.sseClients.forEach(res => {
    try { res.write(`data: ${data}\n\n`); } catch (_) {}
  });
}

function cleanupJob(id) {
  jobRegistry.delete(id);
}

module.exports = {
  createJob, updateJob, getJob, cancelJob, isCancelled,
  addSseClient, removeSseClient, broadcastProgress, cleanupJob,
};
