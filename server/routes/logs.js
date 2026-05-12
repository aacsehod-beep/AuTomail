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

function resolveSchoolName(db, fallback = '') {
  try {
    const row = db.prepare(`SELECT value FROM school_meta WHERE key='school_name'`).get();
    return row?.value || fallback;
  } catch (_) {
    return fallback;
  }
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

// GET /api/logs/recipient-history?q=<email|name|regno>&limit=&schoolFilter=
router.get('/recipient-history', (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 2000);
    if (q.length < 2) {
      return res.status(400).json({ error: 'Please provide at least 2 characters to search.' });
    }

    const searchSql = `
      SELECT id, job_id, sent_at, type, recipient, name, reg_no, section, status, message, sender
      FROM email_logs
      WHERE lower(recipient) = lower(?)
         OR lower(name) LIKE lower(?)
         OR lower(reg_no) = lower(?)
      ORDER BY sent_at DESC
      LIMIT ?
    `;

    let rows = [];
    const exactEmail = q;
    const nameLike = `%${q}%`;
    const exactReg = q;

    if (req.role === 'superadmin' && !req.query.schoolFilter) {
      for (const { slug, db: sDb } of getAllSchoolDbs()) {
        const schoolName = resolveSchoolName(sDb, slug);
        const schoolRows = sDb.prepare(searchSql).all([exactEmail, nameLike, exactReg, limit]);
        rows.push(...schoolRows.map(r => ({ ...r, school: schoolName })));
      }
      rows.sort((a, b) => (b.sent_at || '').localeCompare(a.sent_at || ''));
      rows = rows.slice(0, limit);
    } else {
      const db = resolveDb(req);
      const schoolName = req.role === 'superadmin' ? (req.query.schoolFilter || '') : (req.school || '');
      rows = db.prepare(searchSql).all([exactEmail, nameLike, exactReg, limit]).map(r => ({ ...r, school: schoolName }));
    }

    const summary = {
      total: rows.length,
      sent: rows.filter(r => r.status === 'SENT').length,
      failed: rows.filter(r => r.status === 'FAILED').length,
      lastSentAt: rows[0]?.sent_at || null,
    };

    res.json({ query: q, summary, rows });
  } catch (err) {
    console.error('[GET /api/logs/recipient-history] error:', err);
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
