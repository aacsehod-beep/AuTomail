const express = require('express');
const router  = express.Router();
const { mainDb } = require('../db');

// GET /api/settings — all settings as key→value object (authenticated, any role)
router.get('/', (req, res) => {
  try {
    const rows = mainDb.prepare('SELECT key, value FROM settings').all([]);
    const out  = {};
    rows.forEach(r => {
      try { out[r.key] = JSON.parse(r.value); } catch (_) { out[r.key] = r.value; }
    });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/settings — upsert a single key (superadmin only)
router.put('/', (req, res) => {
  if (req.user?.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin only' });
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required' });
  try {
    mainDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run([key, JSON.stringify(value)]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
