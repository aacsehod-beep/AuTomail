const { getSchoolDb, getAllSchoolDbs } = require('../db');

const INSERT_SQL = `
  INSERT INTO email_logs (job_id, sent_at, type, recipient, name, reg_no, section, status, message, sender)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function rowToArray(r) {
  return [
    r.jobId || r.job_id || '',
    r.sent_at || new Date().toISOString(),
    r.type        || '',
    r.recipient   || '',
    r.name        || '',
    r.regNo       || r.reg_no || '',
    r.section     || '',
    r.status      || '',
    r.message     || '',
    r.sender      || 'System',
  ];
}

function logRow(jobId, type, recipient, status, message, opts = {}) {
  const db = getSchoolDb(opts.school);
  db.prepare(INSERT_SQL).run([
    jobId,
    new Date().toISOString(),
    type,
    recipient,
    opts.name    || '',
    opts.regNo   || '',
    opts.section || '',
    status,
    message      || '',
    opts.sender  || 'System',
  ]);
}

function logBatch(rows) {
  // Group rows by school so we open each school DB only once per batch
  const bySchool = new Map();
  for (const row of rows) {
    const school = row.school || '';
    if (!bySchool.has(school)) bySchool.set(school, []);
    bySchool.get(school).push(row);
  }

  for (const [school, schoolRows] of bySchool) {
    const db = getSchoolDb(school);
    const insertOne  = db.prepare(INSERT_SQL);
    const insertMany = db.transaction((batch) => {
      for (const row of batch) insertOne.run(rowToArray(row));
    });
    insertMany(schoolRows);
  }
}

// ── Query helpers — callers pass the school's db instance ────────────────────

function getLogs(db, { type, status, section, jobId, search, dateFrom, dateTo, limit = 500, offset = 0 } = {}) {
  const conditions = [];
  const params     = [];

  if (type    && type    !== 'all') { conditions.push('type = ?');    params.push(type);    }
  if (status  && status  !== 'all') { conditions.push('status = ?');  params.push(status);  }
  if (section && section !== 'all') { conditions.push('section = ?'); params.push(section); }
  if (jobId)                        { conditions.push('job_id = ?');  params.push(jobId);   }
  if (search)                       { conditions.push('(name LIKE ? OR recipient LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (dateFrom)                     { conditions.push("date(sent_at) >= ?"); params.push(dateFrom); }
  if (dateTo)                       { conditions.push("date(sent_at) <= ?"); params.push(dateTo);   }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const sql   = `SELECT * FROM email_logs ${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(sql).all(params);
}

function getLogCount(db, { type, status, section, jobId, search, dateFrom, dateTo } = {}) {
  const conditions = [];
  const params     = [];
  if (type    && type    !== 'all') { conditions.push('type = ?');    params.push(type);    }
  if (status  && status  !== 'all') { conditions.push('status = ?');  params.push(status);  }
  if (section && section !== 'all') { conditions.push('section = ?'); params.push(section); }
  if (jobId)                        { conditions.push('job_id = ?');  params.push(jobId);   }
  if (search)                       { conditions.push('(name LIKE ? OR recipient LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (dateFrom)                     { conditions.push("date(sent_at) >= ?"); params.push(dateFrom); }
  if (dateTo)                       { conditions.push("date(sent_at) <= ?"); params.push(dateTo);   }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  return db.prepare(`SELECT COUNT(*) as cnt FROM email_logs ${where}`).get(params)?.cnt || 0;
}

function getStats(db) {
  const total  = db.prepare(`SELECT COUNT(*) as c FROM email_logs`).get()?.c || 0;
  const sent   = db.prepare(`SELECT COUNT(*) as c FROM email_logs WHERE status='SENT'`).get()?.c || 0;
  const failed = db.prepare(`SELECT COUNT(*) as c FROM email_logs WHERE status='FAILED'`).get()?.c || 0;

  const byType = db.prepare(`
    SELECT type, status, COUNT(*) as cnt FROM email_logs GROUP BY type, status
  `).all();

  const campaigns = db.prepare(`
    SELECT job_id, type, MIN(sent_at) as started_at,
           SUM(CASE WHEN status='SENT' THEN 1 ELSE 0 END) as sent,
           SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) as failed,
           COUNT(*) as total
    FROM email_logs
    GROUP BY job_id
    ORDER BY started_at DESC
    LIMIT 20
  `).all();

  return {
    total, sent, failed,
    successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
    byType,
    recentCampaigns: campaigns,
  };
}

/**
 * Aggregate stats across all school DBs (for superadmin global view).
 */
function getAggregatedStats() {
  const allDbs = getAllSchoolDbs();
  let total = 0, sent = 0, failed = 0;
  const byTypeMap = {};
  const allCampaigns = [];

  for (const { slug, db } of allDbs) {
    const s = getStats(db);
    total  += s.total;
    sent   += s.sent;
    failed += s.failed;
    for (const row of s.byType) {
      const key = `${row.type}|${row.status}`;
      byTypeMap[key] = byTypeMap[key] || { type: row.type, status: row.status, cnt: 0 };
      byTypeMap[key].cnt += row.cnt;
    }
    allCampaigns.push(...s.recentCampaigns.map(c => ({ ...c, school: slug })));
  }

  const byType = Object.values(byTypeMap);
  const recentCampaigns = allCampaigns
    .sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''))
    .slice(0, 20);

  return {
    total, sent, failed,
    successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
    byType,
    recentCampaigns,
  };
}

module.exports = { logRow, logBatch, getLogs, getLogCount, getStats, getAggregatedStats };
