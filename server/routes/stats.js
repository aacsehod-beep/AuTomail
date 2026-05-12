const router = require('express').Router();
const { getStats } = require('../services/logger');
const { getSchoolDb, getAllSchoolDbs } = require('../db');

function resolveSchoolName(db, fallback = '') {
  try {
    const row = db.prepare(`SELECT value FROM school_meta WHERE key='school_name'`).get();
    return row?.value || fallback;
  } catch (_) {
    return fallback;
  }
}

// GET /api/stats
router.get('/', (req, res) => {
  try {
    const schoolFilter = req.role === 'superadmin' ? (req.query.schoolFilter || null) : req.school;

    // Helper: query a single school DB
    function querySchoolStats(db) {
      const stats = getStats(db);
      const bySec = db.prepare(`
        SELECT section, status, COUNT(*) as cnt
        FROM email_logs WHERE section != ''
        GROUP BY section, status ORDER BY cnt DESC LIMIT 50
      `).all();
      const trend = db.prepare(`
        SELECT date(sent_at) as day,
               SUM(CASE WHEN status='SENT'   THEN 1 ELSE 0 END) as sent,
               SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) as failed
        FROM email_logs WHERE sent_at >= date('now','-14 days')
        GROUP BY day ORDER BY day ASC
      `).all();
      const sentToday = db.prepare(`SELECT COUNT(*) as c FROM email_logs WHERE status='SENT' AND date(sent_at) = date('now')`).get()?.c || 0;
      const sentWeek  = db.prepare(`SELECT COUNT(*) as c FROM email_logs WHERE status='SENT' AND sent_at >= date('now','-6 days')`).get()?.c || 0;
      const topSection = db.prepare(`SELECT section, COUNT(*) as cnt FROM email_logs WHERE status='SENT' AND section != '' GROUP BY section ORDER BY cnt DESC LIMIT 1`).get();
      const topFailed  = db.prepare(`SELECT recipient, name, COUNT(*) as cnt FROM email_logs WHERE status='FAILED' GROUP BY recipient ORDER BY cnt DESC LIMIT 5`).all();
      const recentJobs = db.prepare(`
        SELECT job_id, type, MIN(sent_at) as started_at,
               SUM(CASE WHEN status='SENT'   THEN 1 ELSE 0 END) as sent,
               SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) as failed,
               COUNT(*) as total
        FROM email_logs GROUP BY job_id ORDER BY started_at DESC LIMIT 5
      `).all();
      return { ...stats, bySec, trend, sentToday, sentWeek, topSection, topFailed, recentJobs };
    }

    if (schoolFilter) {
      // Single school view
      const db = getSchoolDb(schoolFilter);
      return res.json(querySchoolStats(db));
    }

    // Superadmin global view — aggregate across all school DBs
    const allDbs = getAllSchoolDbs();
    if (allDbs.length === 0) {
      return res.json({ total: 0, sent: 0, failed: 0, successRate: 0, byType: [], recentCampaigns: [], bySec: [], trend: [], sentToday: 0, sentWeek: 0, topSection: null, topFailed: [], recentJobs: [] });
    }
    const results = allDbs.map(({ slug, db }) => ({
      school: resolveSchoolName(db, slug),
      ...querySchoolStats(db),
    }));
    const merged = results.reduce((acc, r) => {
      acc.total      += r.total;
      acc.sent       += r.sent;
      acc.failed     += r.failed;
      acc.sentToday  += r.sentToday;
      acc.sentWeek   += r.sentWeek;
      acc.bySec.push(...r.bySec);
      acc.topFailed.push(...r.topFailed);
      acc.recentJobs.push(...r.recentJobs);
      acc.schoolBreakdown.push({
        school: r.school,
        total: r.total,
        sent: r.sent,
        failed: r.failed,
        successRate: r.successRate,
        sentToday: r.sentToday,
        sentWeek: r.sentWeek,
        lastActivityAt: r.recentJobs?.[0]?.started_at || null,
      });
      for (const row of r.byType) {
        const key = `${row.type}|${row.status}`;
        acc._byTypeMap[key] = acc._byTypeMap[key] || { type: row.type, status: row.status, cnt: 0 };
        acc._byTypeMap[key].cnt += row.cnt;
      }
      for (const row of r.trend) {
        acc._trendMap[row.day] = acc._trendMap[row.day] || { day: row.day, sent: 0, failed: 0 };
        acc._trendMap[row.day].sent   += row.sent;
        acc._trendMap[row.day].failed += row.failed;
      }
      return acc;
    }, { total: 0, sent: 0, failed: 0, sentToday: 0, sentWeek: 0, bySec: [], topFailed: [], recentJobs: [], schoolBreakdown: [], _byTypeMap: {}, _trendMap: {} });

    merged.successRate    = merged.total > 0 ? Math.round((merged.sent / merged.total) * 100) : 0;
    merged.byType         = Object.values(merged._byTypeMap);
    merged.trend          = Object.values(merged._trendMap).sort((a, b) => a.day.localeCompare(b.day));
    merged.recentJobs     = merged.recentJobs.sort((a, b) => (b.started_at || '').localeCompare(a.started_at || '')).slice(0, 5);
    merged.topFailed      = merged.topFailed.sort((a, b) => b.cnt - a.cnt).slice(0, 5);
    merged.schoolBreakdown = merged.schoolBreakdown
      .sort((a, b) => b.total - a.total);
    merged.recentCampaigns = [];
    merged.topSection     = null;
    delete merged._byTypeMap;
    delete merged._trendMap;

    res.json(merged);
  } catch (err) {
    console.error('[GET /api/stats] error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

module.exports = router;
