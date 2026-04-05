/**
 * Aurora University – Attendance & Circular Mailer Backend
 * (Google Apps Script – Code.gs)
 *
 * Features:
 *  - Send Attendance or Circular emails
 *  - Dynamic recipient loading by section
 *  - Progress & cancel support with batch processing
 *  - Centralized Logs Sheet (shared)
 *  - Export Logs (CSV)
 *  - Attendance threshold filtering
 *  - Email statistics & analytics
 *  - View previous campaign emails
 *  - Batch completion notifications
 */

const CONFIG = {
  LOG_SHEET_NAME: 'Logs',
  THRESHOLD_PERCENT: 75,
  DEFAULT_SENDER_NAME: 'Aurora University',
  PROGRESS_TTL_SEC: 3600,
  CANCEL_TTL_SEC: 3600,
  BATCH_SIZE: 5,
  BATCH_DELAY_MS: 500,
};

// ✅ Central Logs Sheet ID (Aurora Mail Logs)
const LOG_DB_ID = '1bBbTTabAnPgBg_B-rahrctS71I5C0cJW-_RwGnnIiPQ';

// ---------- Serve UI ----------
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Aurora – Attendance & Circular Mailer')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function ping() { 
  return true; 
}

// ---------- Sections & Recipients ----------
function listSections(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    return ss.getSheets().map(s => s.getName());
  } catch (e) {
    throw new Error('Failed to access sheet: ' + e.message);
  }
}

function loadRecipients(sheetId, sections, mapping) {
  try {
    const res = [];
    const ss = SpreadsheetApp.openById(sheetId);
    const startRow = Number(mapping?.startRow || 2);
    const nameCol = Number(mapping?.nameCol || 2);
    const emailCol = Number(mapping?.emailCol || 4);
    const idxName = nameCol - 1;
    const idxEmail = emailCol - 1;

    (sections || []).forEach(sec => {
      const sh = ss.getSheetByName(sec);
      if (!sh) return;
      const lastCol = sh.getLastColumn();
      const lastRow = sh.getLastRow();
      const height = Math.max(0, lastRow - startRow + 1);
      if (height <= 0) return;
      
      const grid = sh.getRange(startRow, 1, height, lastCol).getValues();
      grid.forEach(row => {
        const email = String(row[idxEmail] || '').trim().toLowerCase();
        const name = String(row[idxName] || '').trim();
        const regNo = String(row[2] || '').trim();
        if (email && isValidEmail_(email)) {
          res.push({ name, email, regNo, section: sec });
        }
      });
    });
    
    return res;
  } catch (e) {
    throw new Error('Error loading recipients: ' + e.message);
  }
}

// ---------- Filter Recipients by Attendance Threshold ----------
function filterByAttendanceThreshold(sheetId, sections, recipients, threshold) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const filtered = [];
    const PERCENT_COLS = [7, 10, 13, 16, 19, 22];

    recipients.forEach(rec => {
      try {
        const sh = ss.getSheetByName(rec.section);
        if (!sh) return;

        const lastRow = sh.getLastRow();
        const grid = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
        
        let belowThreshold = false;
        grid.forEach(row => {
          const email = String(row[3] || '').trim().toLowerCase();
          if (email === rec.email) {
            PERCENT_COLS.forEach(col => {
              const percent = toNumber_(row[col - 1]);
              if (percent > 0 && percent < threshold) {
                belowThreshold = true;
              }
            });
          }
        });

        if (belowThreshold) {
          filtered.push(rec);
        }
      } catch (e) {
        Logger.log('Filter error for ' + rec.email + ': ' + e);
      }
    });

    return filtered;
  } catch (e) {
    throw new Error('Error filtering by threshold: ' + e.message);
  }
}

// ---------- Get Email Statistics ----------
function getEmailStats() {
  try {
    const logs = getLogs('all');
    
    const stats = {
      totalSent: 0,
      totalFailed: 0,
      totalEmails: 0,
      byType: {
        attendance: { sent: 0, failed: 0 },
        circular: { sent: 0, failed: 0 }
      },
      byStatus: {
        sent: 0,
        failed: 0
      },
      recentCampaigns: []
    };

    const campaignMap = {};

    logs.forEach(log => {
      if (log.status === 'SENT') {
        stats.totalSent++;
        stats.byStatus.sent++;
        if (log.type === 'attendance') stats.byType.attendance.sent++;
        else stats.byType.circular.sent++;
      } else if (log.status === 'FAILED') {
        stats.totalFailed++;
        stats.byStatus.failed++;
        if (log.type === 'attendance') stats.byType.attendance.failed++;
        else stats.byType.circular.failed++;
      }

      stats.totalEmails++;

      // Group by campaign (date + type)
      const timeKey = new Date(log.time).toLocaleDateString() + '_' + log.type;
      if (!campaignMap[timeKey]) {
        campaignMap[timeKey] = {
          date: new Date(log.time).toLocaleDateString(),
          type: log.type,
          sent: 0,
          failed: 0,
          total: 0
        };
      }
      if (log.status === 'SENT') campaignMap[timeKey].sent++;
      else campaignMap[timeKey].failed++;
      campaignMap[timeKey].total++;
    });

    stats.recentCampaigns = Object.values(campaignMap)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    const successRate = stats.totalEmails > 0 
      ? Math.round((stats.totalSent / stats.totalEmails) * 100) 
      : 0;
    stats.successRate = successRate;

    return stats;
  } catch (e) {
    throw new Error('Error getting stats: ' + e.message);
  }
}

// ---------- Get Campaign Emails (Previous Sends) ----------
function getCampaignEmails(campaignDate, campaignType) {
  try {
    const logs = getLogs(campaignType);
    const campaignLogs = logs.filter(log => {
      const logDate = new Date(log.time).toLocaleDateString();
      return logDate === campaignDate;
    });

    if (campaignLogs.length === 0) {
      return [];
    }

    return campaignLogs.map(log => ({
      recipient: log.recipient,
      status: log.status,
      message: log.message,
      section: log.section || 'N/A',
      time: new Date(log.time).toLocaleString(),
      sender: log.sender || 'System'
    }));
  } catch (e) {
    throw new Error('Error getting campaign emails: ' + e.message);
  }
}

// ---------- Progress Cache ----------
function putProgress_(id, obj) {
  CacheService.getScriptCache().put('PROG_' + id, JSON.stringify(obj), CONFIG.PROGRESS_TTL_SEC);
}

function getProgress_(id) {
  const raw = CacheService.getScriptCache().get('PROG_' + id);
  return raw ? JSON.parse(raw) : null;
}

function isCancelled_(id) {
  return CacheService.getScriptCache().get('CANCEL_' + id) === '1';
}

// ---------- Task Control ----------
function startTask(payload) {
  try {
    // Validate recipients upfront
    const validRecipients = (payload.recipients || []).filter(r => isValidEmail_(r.email));
    if (validRecipients.length === 0) {
      throw new Error('No valid email addresses found in recipients');
    }

    const id = Utilities.getUuid();
    const total = validRecipients.length;
    const prog = { 
      total, 
      done: 0, 
      sent: 0, 
      failed: 0, 
      status: 'Initializing', 
      finished: false 
    };
    putProgress_(id, prog);
    
    payload.recipients = validRecipients;
    
    if (payload.type === 'circular') {
      sendCircularWithProgress_(id, payload);
    } else {
      sendAttendanceWithProgress_(id, payload);
    }
    
    return { taskId: id };
  } catch (e) {
    throw new Error('Task error: ' + e.message);
  }
}

function getProgress(id) { 
  return getProgress_(id); 
}

function cancelTask(id) {
  CacheService.getScriptCache().put('CANCEL_' + id, '1', CONFIG.CANCEL_TTL_SEC);
  return true;
}

// ---------- Circular Sending ----------
function sendCircularWithProgress_(id, payload) {
  const prog = getProgress_(id) || { total: 0, done: 0, sent: 0, failed: 0, finished: false };
  
  try {
    // Process attachments with error handling
    const atts = (payload.attachments || [])
      .map(a => {
        try {
          return dataUrlToBlob_(a);
        } catch (e) {
          Logger.log('Attachment error: ' + e);
          return null;
        }
      })
      .filter(Boolean);

    if (payload.attachments.length > 0 && atts.length !== payload.attachments.length) {
      logRow_(new Date(), 'circular', 'batch', 'WARNING', 'Some attachments failed to process', 'System');
    }

    (payload.recipients || []).forEach((rec, idx) => {
      if (isCancelled_(id)) {
        prog.status = 'Cancelled';
        putProgress_(id, prog);
        return;
      }

      try {
        const ctx = { 
          Name: rec.name, 
          Email: rec.email, 
          RegNo: rec.regNo, 
          Section: rec.section 
        };
        const subject = fillTemplate_(payload.subject || 'Message from Aurora', ctx);
        const bodyHtml = fillTemplate_(payload.body || '', ctx);
        const html = renderCircularHtml_(bodyHtml);
        
        GmailApp.sendEmail(rec.email, subject, stripHtml_(html), {
          name: CONFIG.DEFAULT_SENDER_NAME,
          htmlBody: html,
          attachments: atts,
        });
        
        logRow_(new Date(), 'circular', rec.email, 'SENT', 'Email delivered', rec.section);
        prog.sent++;
      } catch (e) {
        logRow_(new Date(), 'circular', rec.email, 'FAILED', e.message || 'Unknown error', rec.section);
        prog.failed++;
      }
      
      prog.done = idx + 1;
      prog.status = 'Sending (' + prog.done + '/' + prog.total + ')';
      putProgress_(id, prog);

      // Batch delay to prevent rate limiting
      if ((idx + 1) % CONFIG.BATCH_SIZE === 0) {
        Utilities.sleep(CONFIG.BATCH_DELAY_MS);
      }
    });
  } catch (e) {
    logRow_(new Date(), 'circular', 'batch', 'FAILED', e.message, 'System');
  }

  prog.finished = true;
  prog.status = 'Completed';
  putProgress_(id, prog);
}

// ---------- Attendance Sending ----------
function sendAttendanceWithProgress_(id, payload) {
  const m = payload.mapping || {};
  const startRow = Number(m.startRow || 2);
  const nameCol = Number(m.nameCol || 2);
  const emailCol = Number(m.emailCol || 4);
  const SUBJECT_COLS = [5, 8, 11, 14, 17, 20];
  const PERCENT_COLS = [7, 10, 13, 16, 19, 22];

  const prog = getProgress_(id) || { total: 0, done: 0, sent: 0, failed: 0 };
  
  try {
    const ss = SpreadsheetApp.openById(payload.sheetId);
    const bySec = {};
    
    payload.recipients.forEach(r => {
      (bySec[r.section] = bySec[r.section] || []).push(r);
    });

    let processedCount = 0;

    Object.keys(bySec).forEach(section => {
      if (isCancelled_(id)) {
        prog.status = 'Cancelled';
        putProgress_(id, prog);
        return;
      }

      try {
        const sh = ss.getSheetByName(section);
        if (!sh) throw new Error('Sheet not found: ' + section);
        
        const weekInfo = readWeekInfo_(sh, 7);
        const subjNames = SUBJECT_COLS.map(c => String(sh.getRange(8, c).getValue() || '').trim());
        const lastRow = sh.getLastRow();
        
        if (lastRow < startRow) {
          logRow_(new Date(), 'attendance', 'batch', 'FAILED', 'No data rows in ' + section, section);
          return;
        }

        const grid = sh.getRange(startRow, 1, lastRow - startRow + 1, sh.getLastColumn()).getValues();
        const idxName = nameCol - 1;
        const idxEmail = emailCol - 1;

        const students = {};
        grid.forEach(r => {
          const email = String(r[idxEmail] || '').trim().toLowerCase();
          if (!email || !isValidEmail_(email)) return;
          
          const name = r[idxName];
          const reg = r[2];
          const subjects = subjNames.map((s, i) => ({
            name: s,
            percent: toNumber_(r[PERCENT_COLS[i] - 1])
          }));
          students[email] = { name, reg, subjects };
        });

        bySec[section].forEach((rec, idx) => {
          if (isCancelled_(id)) {
            prog.status = 'Cancelled';
            putProgress_(id, prog);
            return;
          }

          try {
            const st = students[String(rec.email).toLowerCase()];
            if (!st) throw new Error('No attendance record found');
            
            const ctx = { 
              Name: st.name, 
              RegNo: st.reg, 
              Email: rec.email, 
              Section: section, 
              WeekInfo: weekInfo 
            };
            const html = renderAttendanceHtml_({ 
              ctx, 
              subjects: st.subjects, 
              threshold: CONFIG.THRESHOLD_PERCENT 
            });
            const subject = `ATTENDANCE REPORT – ${weekInfo} – ${st.name}`;
            
            GmailApp.sendEmail(rec.email, subject, stripHtml_(html), { htmlBody: html });
            logRow_(new Date(), 'attendance', rec.email, 'SENT', 'Attendance report sent', section);
            prog.sent++;
          } catch (e) {
            logRow_(new Date(), 'attendance', rec.email, 'FAILED', e.message, section);
            prog.failed++;
          }
          
          processedCount++;
          prog.done = processedCount;
          prog.status = 'Sending (' + prog.done + '/' + prog.total + ')';
          putProgress_(id, prog);

          // Batch delay to prevent rate limiting
          if (processedCount % CONFIG.BATCH_SIZE === 0) {
            Utilities.sleep(CONFIG.BATCH_DELAY_MS);
          }
        });
      } catch (e) {
        bySec[section].forEach(r => {
          logRow_(new Date(), 'attendance', r.email, 'FAILED', e.message, section);
          prog.failed++;
        });
      }
    });
  } catch (e) {
    logRow_(new Date(), 'attendance', 'batch', 'FAILED', e.message, 'System');
  }

  prog.finished = true;
  prog.status = 'Completed';
  putProgress_(id, prog);
}

// ---------- Logs (Centralized) ----------
function getLogs(type) {
  try {
    const ss = SpreadsheetApp.openById(LOG_DB_ID);
    const sh = ss.getSheetByName(CONFIG.LOG_SHEET_NAME);
    if (!sh) throw new Error('Logs sheet not found');
    
    const vals = sh.getDataRange().getValues();
    if (vals.length <= 1) return [];
    
    vals.shift(); // Remove header

    const rows = vals
      .map(r => ({
        time: r[0],
        type: String(r[1] || '').toLowerCase(),
        recipient: r[2],
        status: r[3],
        message: r[4],
        section: r[5],
        sender: r[6] || ''
      }))
      .filter(r => r.time && r.recipient);

    rows.sort((a, b) => new Date(b.time) - new Date(a.time));
    
    if (!type || type === 'all') return rows;
    return rows.filter(r => r.type === String(type).toLowerCase());
  } catch (e) {
    Logger.log('getLogs error: ' + e);
    throw new Error('Unable to load logs: ' + e.message);
  }
}

function exportLogs(type) {
  try {
    const rows = getLogs(type);
    const headers = ['Timestamp', 'Type', 'Recipient', 'Status', 'Message', 'Section', 'Sender'];
    const lines = [headers.join(',')];
    
    rows.forEach(r => {
      lines.push([
        formatDate_(r.time),
        r.type,
        r.recipient,
        r.status,
        toCsv_(r.message),
        r.section,
        r.sender
      ].join(','));
    });
    
    return lines.join('\n');
  } catch (e) {
    throw new Error('Export error: ' + e.message);
  }
}

function logRow_(time, type, recipient, status, message, section) {
  try {
    const sh = getOrCreateCentralLogSheet_();
    const sender = Session.getEffectiveUser().getEmail() || 'System';
    sh.appendRow([time, type, recipient, status, message, section, sender]);
  } catch (e) {
    Logger.log('logRow error: ' + e);
  }
}

function getOrCreateCentralLogSheet_() {
  const ss = SpreadsheetApp.openById(LOG_DB_ID);
  let sh = ss.getSheetByName(CONFIG.LOG_SHEET_NAME);
  
  if (!sh) {
    sh = ss.insertSheet(CONFIG.LOG_SHEET_NAME);
    sh.appendRow(['Timestamp', 'Type', 'Recipient', 'Status', 'Message', 'Section', 'Sender']);
  }
  
  return sh;
}

// ---------- Email Templates ----------
function renderCircularHtml_(bodyHtml) {
  return `<div style="font-family:'Segoe UI', system-ui;max-width:700px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;box-shadow:0 4px 12px rgba(0,0,0,0.08)">
    <div style="margin-bottom:16px">
      <h2 style="margin:0;color:#2c3e50;font-size:22px;font-weight:700">Aurora University</h2>
      <p style="margin:6px 0 0;color:#6b7280;font-size:12px">Official Communication</p>
    </div>
    <div style="height:2px;background:#3498db;margin:16px 0"></div>
    <div style="font-size:14px;line-height:1.8;color:#374151;margin:16px 0">${bodyHtml || 'No content provided'}</div>
    <div style="height:1px;background:#e5e7eb;margin:16px 0"></div>
    <div style="font-size:11px;color:#9ca3af;text-align:center">© Aurora University | Automated System</div>
  </div>`;
}

function renderAttendanceHtml_({ ctx, subjects, threshold }) {
  const rows = subjects.map(s => {
    const low = s.percent < threshold;
    const bgColor = low ? '#fef2f2' : '#f9fafb';
    const textColor = low ? '#dc2626' : '#059669';
    const icon = low ? '⚠️' : '✓';
    return `<tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:12px;background:${bgColor};font-weight:500">${escapeHtml__(s.name)}</td>
      <td style="padding:12px;text-align:right;background:${bgColor}"><span style="color:${textColor};font-weight:700;font-size:16px">${s.percent}%</span> ${icon}</td>
    </tr>`;
  }).join('');
  
  return `<div style="font-family:'Segoe UI', system-ui;max-width:720px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;box-shadow:0 4px 12px rgba(0,0,0,0.08)">
    <h2 style="margin:0 0 12px;color:#111827;font-size:20px;font-weight:700">Attendance Report</h2>
    <div style="color:#6b7280;font-size:13px;margin-bottom:20px;background:#f9fafb;padding:12px;border-radius:8px">
      <p style="margin:4px 0"><strong>Name:</strong> ${escapeHtml__(ctx.Name)}</p>
      <p style="margin:4px 0"><strong>Reg No:</strong> ${escapeHtml__(ctx.RegNo)}</p>
      <p style="margin:4px 0"><strong>Section:</strong> ${escapeHtml__(ctx.Section)}</p>
      <p style="margin:4px 0;color:#3498db;font-weight:600"><strong>Period:</strong> ${escapeHtml__(ctx.WeekInfo || 'Current')}</p>
    </div>
    <div style="background:#f9fafb;border-radius:8px;overflow:hidden;margin:16px 0">
      <table width="100%" style="border-collapse:collapse">${rows}</table>
    </div>
    <div style="background:#eff6ff;border-left:4px solid #3498db;padding:12px;border-radius:4px;font-size:10px;color:#1e3a8a">
      <strong>Note:</strong> Attendance below ${threshold}% requires immediate attention.
    </div>
    <div style="margin-top:16px;font-size:11px;color:#999;text-align:center">For queries, contact administration</div>
  </div>`;
}

// ---------- Helpers ----------
function dataUrlToBlob_(a) {
  try {
    if (!a?.dataUrl) return null;
    const parts = a.dataUrl.split(',');
    const base64 = parts[1];
    const mime = /data:([^;]+);/.exec(a.dataUrl)?.[1] || a.type || 'application/octet-stream';
    return Utilities.newBlob(Utilities.base64Decode(base64), mime, a.name || 'file');
  } catch (e) {
    Logger.log('dataUrlToBlob error: ' + e);
    return null;
  }
}

function readWeekInfo_(sh, row) {
  try {
    const arr = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
    return arr.find(v => String(v).trim()) || 'Current Week';
  } catch (e) {
    return 'Current Week';
  }
}

function fillTemplate_(tpl, ctx) {
  return String(tpl).replace(/{{\s*(\w+)\s*}}/g, (_, k) => ctx[k] || '');
}

function stripHtml_(h) { 
  return h.replace(/<[^>]+>/g, ''); 
}

function escapeHtml__(s) { 
  return String(s || '')
    .replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); 
}

function toNumber_(v) { 
  return parseFloat(String(v).replace(/[^0-9.\-]/g, '')) || 0; 
}

function toCsv_(v) { 
  const s = String(v || ''); 
  return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; 
}

function formatDate_(date) {
  try {
    return new Date(date).toLocaleString();
  } catch (e) {
    return String(date);
  }
}

function isValidEmail_(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// ---------- Test Functions ----------
function testCentralLogAccess() {
  try {
    const ss = SpreadsheetApp.openById(LOG_DB_ID);
    const sh = ss.getSheetByName(CONFIG.LOG_SHEET_NAME);
    Logger.log('✓ File: ' + ss.getName());
    Logger.log('✓ Sheet found: ' + !!sh);
    if (sh) Logger.log('✓ Rows: ' + sh.getLastRow());
    return true;
  } catch (e) {
    Logger.log('❌ ERROR: ' + e);
    return false;
  }
}
