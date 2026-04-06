const db = require('../db');

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

const insertOne  = db.prepare(INSERT_SQL);
const insertMany = db.transaction((rows) => {
  for (const row of rows) insertOne.run(rowToArray(row));
});

function logRow(jobId, type, recipient, status, message, opts = {}) {
  insertOne.run([
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
  insertMany(rows.map(r => ({
    jobId:     r.jobId,
    sent_at:   new Date().toISOString(),
    type:      r.type,
    recipient: r.recipient,
    name:      r.name    || '',
    regNo:     r.regNo   || '',
    section:   r.section || '',
    status:    r.status,
    message:   r.message || '',
    sender:    r.sender  || 'System',
  })));
}

function getLogs({ type, status, section, jobId, search, limit = 500, offset = 0 } = {}) {
  const conditions = [];
  const params     = [];

  if (type    && type    !== 'all') { conditions.push('type = ?');    params.push(type);    }
  if (status  && status  !== 'all') { conditions.push('status = ?');  params.push(status);  }
  if (section && section !== 'all') { conditions.push('section = ?'); params.push(section); }
  if (jobId)                        { conditions.push('job_id = ?');  params.push(jobId);   }
  if (search)                       { conditions.push('(name LIKE ? OR recipient LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const sql   = `SELECT * FROM email_logs ${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(sql).all(params);
}

function getLogCount({ type, status, section, jobId, search } = {}) {
  const conditions = [];
  const params     = [];
  if (type    && type    !== 'all') { conditions.push('type = ?');    params.push(type);    }
  if (status  && status  !== 'all') { conditions.push('status = ?');  params.push(status);  }
  if (section && section !== 'all') { conditions.push('section = ?'); params.push(section); }
  if (jobId)                        { conditions.push('job_id = ?');  params.push(jobId);   }
  if (search)                       { conditions.push('(name LIKE ? OR recipient LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  return db.prepare(`SELECT COUNT(*) as cnt FROM email_logs ${where}`).get(params)?.cnt || 0;
}

function getStats() {
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

module.exports = { logRow, logBatch, getLogs, getLogCount, getStats };
