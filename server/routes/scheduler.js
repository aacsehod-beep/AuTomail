const router = require('express').Router();
const { getSchoolDb } = require('../db');

// GET /api/scheduler
router.get('/', (req, res) => {
  const db = getSchoolDb(req.school);
  const jobs = db.prepare('SELECT * FROM scheduled_jobs ORDER BY run_at DESC').all();
  res.json(jobs);
});

// POST /api/scheduler
router.post('/', (req, res) => {
  try {
    const { title, type, payload, run_at } = req.body;
    if (!title || !type || !payload || !run_at) return res.status(400).json({ error: 'Missing fields' });
    const now = new Date().toISOString();
    const db = getSchoolDb(req.school);
    const result = db.prepare(`
      INSERT INTO scheduled_jobs (title, type, payload, run_at, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run([title, type, JSON.stringify(payload), run_at, now]);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    console.error('[POST /api/scheduler] error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

// DELETE /api/scheduler/:id
router.delete('/:id', (req, res) => {
  const db = getSchoolDb(req.school);
  db.prepare('DELETE FROM scheduled_jobs WHERE id=?').run([req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
