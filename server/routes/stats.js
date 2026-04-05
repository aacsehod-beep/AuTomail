const router = require('express').Router();
const { getStats } = require('../services/logger');
const db = require('../db');

// GET /api/stats
router.get('/', (req, res) => {
  try {
    const stats = getStats();

    // Section-wise breakdown
    const bySec = db.prepare(`
      SELECT section, status, COUNT(*) as cnt
      FROM email_logs WHERE section != ''
      GROUP BY section, status
      ORDER BY cnt DESC
      LIMIT 50
    `).all();

    // Daily send trend (last 14 days)
    const trend = db.prepare(`
      SELECT date(sent_at) as day,
             SUM(CASE WHEN status='SENT'   THEN 1 ELSE 0 END) as sent,
             SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) as failed
      FROM email_logs
      WHERE sent_at >= date('now','-14 days')
      GROUP BY day ORDER BY day ASC
    `).all();

    res.json({ ...stats, bySec, trend });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
