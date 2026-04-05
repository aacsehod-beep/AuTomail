/**
 * HTML email templates for all mail types.
 * All user-supplied values are HTML-escaped before insertion.
 */

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function stripHtml(h) {
  return h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function fillTemplate(tpl, ctx) {
  return String(tpl).replace(/{{\s*(\w+)\s*}}/g, (_, k) => escapeHtml(ctx[k] || ''));
}

// ─── Shared wrapper ────────────────────────────────────────────────────────────
function wrapEmail(innerHtml, footerText = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Aurora University</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',system-ui,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.09);max-width:640px;width:100%">
      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);padding:28px 32px">
          <table width="100%"><tr>
            <td>
              <div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px">Aurora University</div>
              <div style="color:#bfdbfe;font-size:12px;margin-top:4px">Official Student Communication System</div>
            </td>
            <td align="right">
              <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:6px 12px;color:#e0f2fe;font-size:11px">
                ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
              </div>
            </td>
          </tr></table>
        </td>
      </tr>
      <!-- Body -->
      <tr><td style="padding:32px">${innerHtml}</td></tr>
      <!-- Footer -->
      <tr>
        <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center">
          <p style="margin:0;font-size:11px;color:#9ca3af">${footerText || 'This is an automated message from Aurora University. Please do not reply.'}</p>
          <p style="margin:6px 0 0;font-size:10px;color:#d1d5db">© ${new Date().getFullYear()} Aurora University. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ─── Attendance Report ─────────────────────────────────────────────────────────
function renderAttendanceHtml({ ctx, subjects, threshold }) {
  const THRESHOLD = Number(threshold) || 75;

  const subjectRows = subjects
    .filter(s => s.name && s.name.trim())
    .map(s => {
      const pct    = Number(s.percent) || 0;
      const noData = pct === 0;
      const low    = !noData && pct < THRESHOLD;
      const bg     = noData ? '#f9fafb' : low ? '#fef2f2' : '#f0fdf4';
      const color  = noData ? '#6b7280' : low ? '#dc2626'  : '#16a34a';
      const badge  = noData ? `<span style="background:#e5e7eb;color:#6b7280;padding:2px 8px;border-radius:99px;font-size:11px">No Data</span>`
                   : low    ? `<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:99px;font-size:11px">⚠ Below ${THRESHOLD}%</span>`
                   :          `<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:99px;font-size:11px">✓ Good</span>`;
      return `<tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:12px 16px;background:${bg};font-size:13px;font-weight:500;color:#374151">${escapeHtml(s.name)}</td>
        <td style="padding:12px 16px;background:${bg};text-align:center"><span style="color:${color};font-size:18px;font-weight:700">${noData ? '—' : pct + '%'}</span></td>
        <td style="padding:12px 16px;background:${bg};text-align:right">${badge}</td>
      </tr>`;
    }).join('');

  const hasLow = subjects.some(s => s.percent > 0 && s.percent < THRESHOLD);

  const inner = `
    <h2 style="margin:0 0 6px;font-size:18px;color:#111827;font-weight:700">Attendance Report</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:13px">Week / Period: <strong style="color:#2563eb">${escapeHtml(ctx.WeekInfo || 'Current')}</strong></p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px">
      <table width="100%" style="font-size:13px;color:#374151">
        <tr>
          <td style="padding:4px 0"><strong>Student Name:</strong></td>
          <td style="padding:4px 0">${escapeHtml(ctx.Name)}</td>
          <td style="padding:4px 0"><strong>Reg No:</strong></td>
          <td style="padding:4px 0">${escapeHtml(ctx.RegNo)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0"><strong>Section:</strong></td>
          <td style="padding:4px 0">${escapeHtml(ctx.Section)}</td>
          <td style="padding:4px 0"><strong>Date:</strong></td>
          <td style="padding:4px 0">${new Date().toLocaleDateString('en-IN')}</td>
        </tr>
      </table>
    </div>

    <table width="100%" style="border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
      <thead>
        <tr style="background:#1e3a8a">
          <th style="padding:12px 16px;text-align:left;color:#fff;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Subject</th>
          <th style="padding:12px 16px;text-align:center;color:#fff;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Attendance %</th>
          <th style="padding:12px 16px;text-align:right;color:#fff;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Status</th>
        </tr>
      </thead>
      <tbody>${subjectRows}</tbody>
    </table>

    ${hasLow ? `
    <div style="margin-top:20px;background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:6px;padding:14px 16px">
      <p style="margin:0;font-size:13px;color:#92400e"><strong>⚠ Action Required:</strong> Your attendance in one or more subjects is below ${THRESHOLD}%. Please consult with your faculty or administration immediately to avoid academic consequences.</p>
    </div>` : `
    <div style="margin-top:20px;background:#f0fdf4;border:1px solid #86efac;border-left:4px solid #22c55e;border-radius:6px;padding:14px 16px">
      <p style="margin:0;font-size:13px;color:#166534"><strong>✓ Good Standing:</strong> Your attendance is satisfactory across all subjects. Keep it up!</p>
    </div>`}
  `;

  return { html: wrapEmail(inner, 'For attendance queries, contact your class coordinator.'), text: stripHtml(inner) };
}

// ─── Circular / Announcement ───────────────────────────────────────────────────
function renderCircularHtml({ subject, body, ctx, circularNo, category }) {
  const filledBody = fillTemplate(body, ctx);
  const categoryColors = {
    circular:     { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', label: 'Circular'      },
    announcement: { bg: '#fefce8', border: '#fcd34d', text: '#92400e', label: 'Announcement'  },
    event:        { bg: '#f0fdf4', border: '#86efac', text: '#166534', label: 'Event Notice'   },
    exam:         { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', label: 'Exam Notice'    },
    holiday:      { bg: '#faf5ff', border: '#c4b5fd', text: '#5b21b6', label: 'Holiday Notice' },
    fee:          { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', label: 'Fee Reminder'   },
    general:      { bg: '#f9fafb', border: '#d1d5db', text: '#374151', label: 'General'        },
  };
  const cat = categoryColors[category] || categoryColors.general;

  const inner = `
    <div style="background:${cat.bg};border:1px solid ${cat.border};border-radius:8px;padding:10px 14px;margin-bottom:20px;display:inline-block">
      <span style="color:${cat.text};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">${cat.label}</span>
      ${circularNo ? `<span style="color:${cat.text};font-size:12px;margin-left:12px;opacity:0.8">Ref: ${escapeHtml(circularNo)}</span>` : ''}
    </div>

    <h2 style="margin:0 0 20px;font-size:20px;color:#111827;font-weight:700;line-height:1.3">${escapeHtml(subject)}</h2>

    <div style="font-size:14px;line-height:1.8;color:#374151">${filledBody}</div>

    ${ctx && ctx.Name ? `
    <div style="margin-top:24px;background:#f8fafc;border-radius:8px;padding:12px 16px;font-size:12px;color:#6b7280">
      Addressed to: <strong>${escapeHtml(ctx.Name)}</strong>
      ${ctx.RegNo ? ` &nbsp;|&nbsp; Reg No: <strong>${escapeHtml(ctx.RegNo)}</strong>` : ''}
      ${ctx.Section ? ` &nbsp;|&nbsp; Section: <strong>${escapeHtml(ctx.Section)}</strong>` : ''}
    </div>` : ''}
  `;

  return { html: wrapEmail(inner), text: stripHtml(filledBody) };
}

// ─── Custom HTML passthrough ───────────────────────────────────────────────────
function renderCustomHtml({ subject, htmlBody, ctx }) {
  const filled = fillTemplate(htmlBody, ctx);
  return { html: wrapEmail(filled), text: stripHtml(filled) };
}

// ─── Fee Reminder ─────────────────────────────────────────────────────────────
function renderFeeReminderHtml({ ctx, feeDetails }) {
  const rows = (feeDetails || []).map(f => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:10px 14px;font-size:13px;color:#374151">${escapeHtml(f.label)}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:600;color:${f.overdue ? '#dc2626' : '#111827'};text-align:right">₹${escapeHtml(String(f.amount))}</td>
      <td style="padding:10px 14px;font-size:12px;color:${f.overdue ? '#dc2626' : '#6b7280'};text-align:right">${f.dueDate ? 'Due: ' + escapeHtml(f.dueDate) : ''}</td>
    </tr>`).join('');

  const inner = `
    <h2 style="margin:0 0 6px;font-size:18px;color:#111827;font-weight:700">Fee Payment Reminder</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:13px">Dear <strong>${escapeHtml(ctx.Name)}</strong>, the following fee dues are pending.</p>
    <table width="100%" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <thead><tr style="background:#1e3a8a">
        <th style="padding:12px 14px;color:#fff;font-size:12px;text-align:left">Description</th>
        <th style="padding:12px 14px;color:#fff;font-size:12px;text-align:right">Amount</th>
        <th style="padding:12px 14px;color:#fff;font-size:12px;text-align:right">Due Date</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:20px;background:#fff7ed;border-left:4px solid #f97316;border-radius:6px;padding:14px 16px">
      <p style="margin:0;font-size:13px;color:#9a3412">Please clear your dues before the deadline to avoid late fee penalties. Contact the accounts office for payment assistance.</p>
    </div>
  `;

  return { html: wrapEmail(inner, 'For fee queries, contact the accounts office.'), text: stripHtml(inner) };
}

module.exports = {
  renderAttendanceHtml,
  renderCircularHtml,
  renderCustomHtml,
  renderFeeReminderHtml,
  fillTemplate,
  escapeHtml,
  stripHtml,
};
