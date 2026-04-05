const router = require('express').Router();
const db     = require('../db');

// GET /api/scheduler
router.get('/', (req, res) => {
  const jobs = db.prepare('SELECT * FROM scheduled_jobs ORDER BY run_at DESC').all();
  res.json(jobs);
});

// POST /api/scheduler
router.post('/', (req, res) => {
  try {
    const { title, type, payload, run_at } = req.body;
    if (!title || !type || !payload || !run_at) return res.status(400).json({ error: 'Missing fields' });
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO scheduled_jobs (title, type, payload, run_at, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run([title, type, JSON.stringify(payload), run_at, now]);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/scheduler/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM scheduled_jobs WHERE id=?').run([req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
