const router = require('express').Router();
const db     = require('../db');

// GET /api/templates
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM templates ORDER BY updated_at DESC').all();
  res.json(rows);
});

// POST /api/templates
router.post('/', (req, res) => {
  try {
    const { name, type, subject, body } = req.body;
    if (!name || !type || !subject || !body) return res.status(400).json({ error: 'Missing fields' });
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO templates (name, type, subject, body, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET type=excluded.type, subject=excluded.subject,
        body=excluded.body, updated_at=excluded.updated_at
    `).run([name, type, subject, body, now, now]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM templates WHERE id=?').run([req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
