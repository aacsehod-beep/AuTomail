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
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:600px;width:100%;border:1px solid #e0e0e0">
      <!-- Header -->
      <tr>
        <td style="background:#1a237e;padding:16px 24px">
          <span style="color:#ffffff;font-size:16px;font-weight:600">Aurora University</span>
        </td>
      </tr>
      <!-- Body -->
      <tr><td style="padding:28px 24px;font-size:14px;color:#333333;line-height:1.7">${innerHtml}</td></tr>
      <!-- Footer -->
      <tr>
        <td style="background:#f9f9f9;border-top:1px solid #e0e0e0;padding:14px 24px;text-align:center">
          <p style="margin:0;font-size:11px;color:#999999">${footerText || 'This is an automated message from Aurora University. Please do not reply.'}</p>
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

  const inner = `
    <p style="margin:0 0 20px 0;font-size:15px;font-weight:600;color:#1a237e">${escapeHtml(subject)}</p>
    <div style="font-size:14px;line-height:1.8;color:#333333">${filledBody}</div>
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

// ─── Certificate Mail ──────────────────────────────────────────────────────────
function renderCertificateHtml({ ctx, body }) {
  const bodyHtml = body
    ? fillTemplate(body, ctx).replace(/\n/g, '<br>')
    : `Dear <strong>${escapeHtml(ctx.Name)}</strong>,<br><br>
       Congratulations! Please find your certificate attached to this email.<br><br>
       We wish you continued success.`;

  const inner = `
    <div style="text-align:center;margin-bottom:28px">
      <div style="display:inline-block;background:linear-gradient(135deg,#0f766e,#0d9488);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;margin-bottom:12px">🎓</div>
      <h2 style="margin:0;font-size:20px;color:#0f766e;font-weight:700">Certificate of Achievement</h2>
    </div>
    <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:20px 24px;margin-bottom:20px;font-size:14px;color:#334155;line-height:1.8">
      ${bodyHtml}
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 20px;font-size:12px;color:#64748b">
      <strong>Student:</strong> ${escapeHtml(ctx.Name)} &nbsp;|&nbsp;
      <strong>Roll No:</strong> ${escapeHtml(ctx.RegNo || '—')} &nbsp;|&nbsp;
      <strong>Section:</strong> ${escapeHtml(ctx.Section || '—')}
    </div>`;

  return { html: wrapEmail(inner, 'This certificate was issued by Aurora University.'), text: stripHtml(inner) };
}

module.exports = {
  renderAttendanceHtml,
  renderCircularHtml,
  renderCustomHtml,
  renderFeeReminderHtml,
  renderCertificateHtml,
  fillTemplate,
  escapeHtml,
  stripHtml,
};
