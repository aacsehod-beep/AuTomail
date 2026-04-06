const router = require('express').Router();
const { getLogs, getLogCount } = require('../services/logger');

// GET /api/logs?type=&status=&section=&jobId=&limit=&offset=
router.get('/', (req, res) => {
  try {
    const { type, status, section, jobId, search } = req.query;
    const limit  = Math.min(Number(req.query.limit  || 200), 1000);
    const offset = Number(req.query.offset || 0);

    const rows  = getLogs({ type, status, section, jobId, search, limit, offset });
    const total = getLogCount({ type, status, section, jobId, search });
    res.json({ rows, total, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/logs/export?type=&status=
router.get('/export', (req, res) => {
  try {
    const rows = getLogs({ type: req.query.type, status: req.query.status, limit: 100000 });
    const headers = ['id','job_id','sent_at','type','recipient','name','reg_no','section','status','message','sender'];
    const csv = [headers.join(','), ...rows.map(r =>
      headers.map(h => {
        const v = String(r[h] || '');
        return /[,"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',')
    )].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="aurora-logs-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
