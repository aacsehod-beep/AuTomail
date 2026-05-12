const router = require('express').Router();
const { getLogs, getLogCount } = require('../services/logger');
const { getSchoolDb, getAllSchoolDbs } = require('../db');

// Resolve the school DB for the current request.
// Superadmin can pass ?schoolFilter=name; non-superadmin is locked to their school.
function resolveDb(req) {
  if (req.role === 'superadmin') {
    const filter = req.query.schoolFilter || req.body?.schoolFilter;
    if (filter) return getSchoolDb(filter);
    return null; // null = aggregate all schools
  }
  return getSchoolDb(req.school);
}

// GET /api/logs?type=&status=&section=&jobId=&dateFrom=&dateTo=&limit=&offset=
router.get('/', (req, res) => {
  try {
    const { type, status, section, jobId, search, dateFrom, dateTo } = req.query;
    const limit  = Math.min(Number(req.query.limit  || 200), 1000);
    const offset = Number(req.query.offset || 0);
    const db = resolveDb(req);

    if (!db) {
      // Superadmin, no school filter — aggregate across all school DBs
      const filters = { type, status, section, jobId, search, dateFrom, dateTo, limit: 100000 };
      let allRows = [];
      for (const { db: sDb } of getAllSchoolDbs()) {
        allRows.push(...getLogs(sDb, filters));
      }
      allRows.sort((a, b) => (b.sent_at || '').localeCompare(a.sent_at || ''));
      const total = allRows.length;
      const rows  = allRows.slice(offset, offset + limit);
      return res.json({ rows, total, limit, offset });
    }

    const rows  = getLogs(db, { type, status, section, jobId, search, dateFrom, dateTo, limit, offset });
    const total = getLogCount(db, { type, status, section, jobId, search, dateFrom, dateTo });
    res.json({ rows, total, limit, offset });
  } catch (err) {
    console.error('[GET /api/logs] error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

// GET /api/logs/export  (all active filters supported)
router.get('/export', (req, res) => {
  try {
    const { type, status, section, jobId, search, dateFrom, dateTo } = req.query;
    const db = resolveDb(req);
    const filters = { type, status, section, jobId, search, dateFrom, dateTo, limit: 100000 };

    let rows;
    if (!db) {
      rows = [];
      for (const { db: sDb } of getAllSchoolDbs()) rows.push(...getLogs(sDb, filters));
      rows.sort((a, b) => (b.sent_at || '').localeCompare(a.sent_at || ''));
    } else {
      rows = getLogs(db, filters);
    }

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
    console.error('[GET /api/logs/export] error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

// DELETE /api/logs — clear email logs for a school (admin/superadmin only)
router.delete('/', (req, res) => {
  try {
    if (req.role !== 'admin' && req.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const schoolFilter = req.query.schoolFilter || req.body?.schoolFilter;
    if (req.role === 'superadmin' && !schoolFilter) {
      // Clear ALL school DBs
      for (const { db: sDb } of getAllSchoolDbs()) sDb.run('DELETE FROM email_logs');
    } else {
      const targetSchool = req.role === 'superadmin' ? schoolFilter : req.school;
      getSchoolDb(targetSchool).run('DELETE FROM email_logs');
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/logs] error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

module.exports = router;
