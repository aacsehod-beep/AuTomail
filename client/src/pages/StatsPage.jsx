import { useState, useEffect } from 'react';
import {
  TrendingUp, Mail, CheckCircle2, XCircle, Percent,
  CalendarDays, CalendarRange, Building2, AlertTriangle,
  BarChart2, Clock, RefreshCw, ArrowRight, Search,
} from 'lucide-react';
import { api } from '../api';

// --- Helpers ---
function fmtDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// --- KPI Card ---
function KpiCard({ icon: Icon, label, value, sub, color, accent }) {
  const [display, setDisplay] = useState(0);
  const isNum = typeof value === 'number';
  useEffect(() => {
    if (!isNum) return;
    let start = null;
    const DURATION = 900;
    function step(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / DURATION, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(e * value));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [value, isNum]);

  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '20px 22px',
      border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'flex-start', gap: 16,
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12, flexShrink: 0,
        background: accent || '#eff6ff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} color={color || '#2563eb'} />
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: color || '#0f172a', lineHeight: 1.1 }}>
          {isNum ? display : value}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginTop: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// --- Section Bar Row ---
function SectionRow({ section, sent, failed }) {
  const total = sent + failed;
  const pct   = total > 0 ? Math.round((sent / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ fontWeight: 600 }}>{section}</span>
        <span style={{ color: '#64748b' }}>{sent}/{total} &nbsp;
          <span style={{ fontWeight: 700, color: pct >= 90 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626' }}>{pct}%</span>
        </span>
      </div>
      <div style={{ height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4,
          width: pct + '%',
          background: pct >= 90 ? '#16a34a' : pct >= 70 ? '#f59e0b' : '#ef4444',
          transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  );
}

// --- Trend Chart ---
function TrendChart({ data }) {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = data.find(r => r.day === key) || { day: key, sent: 0, failed: 0 };
    days.push(row);
  }
  const CHART_H = 110;
  const maxVal  = Math.max(...days.map(d => d.sent + d.failed), 1);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, minWidth: 420, paddingBottom: 28 }}>
        {days.map(d => {
          const total = d.sent + d.failed;
          const sentH = Math.round((d.sent   / maxVal) * CHART_H);
          const failH = Math.round((d.failed / maxVal) * CHART_H);
          const label = d.day.slice(5);
          return (
            <div key={d.day} title={`${d.day}  Sent: ${d.sent}  Failed: ${d.failed}`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              <div style={{ fontSize: 9, color: '#94a3b8', height: 14, lineHeight: '14px' }}>
                {total > 0 ? total : ''}
              </div>
              <div style={{ height: CHART_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '80%', minWidth: 10 }}>
                {failH > 0 && <div style={{ background: '#fca5a5', height: failH, width: '100%', borderRadius: '3px 3px 0 0' }} />}
                {sentH > 0 && <div style={{ background: '#2563eb', height: sentH, width: '100%', borderRadius: failH === 0 ? '3px 3px 0 0' : 0 }} />}
                {total === 0 && <div style={{ height: 2, background: '#e2e8f0', width: '100%', borderRadius: 1 }} />}
              </div>
              <div style={{
                position: 'absolute', bottom: -22, fontSize: 9, color: '#94a3b8',
                transform: 'rotate(-45deg)', transformOrigin: 'top center', whiteSpace: 'nowrap',
              }}>{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Type Badge Colors ---
const TYPE_COLORS = {
  attendance:   { bg: '#dbeafe', color: '#1d4ed8' },
  circular:     { bg: '#fef9c3', color: '#a16207' },
  announcement: { bg: '#fef3c7', color: '#b45309' },
  event:        { bg: '#ede9fe', color: '#7c3aed' },
  exam:         { bg: '#fee2e2', color: '#b91c1c' },
  fee:          { bg: '#dcfce7', color: '#15803d' },
  fee_reminder: { bg: '#fce7f3', color: '#9d174d' },
  general:      { bg: '#f1f5f9', color: '#475569' },
  custom:       { bg: '#f0fdf4', color: '#166534' },
};

// --- Main Page ---
export default function StatsPage({ onNavigate, schoolView, onSchoolViewChange }) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  function load() {
    setLoading(true);
    api.getStats(schoolView)
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [schoolView]);

  async function searchRecipientHistory() {
    const q = historyQuery.trim();
    if (q.length < 2) {
      setHistoryError('Type at least 2 characters.');
      setHistoryData(null);
      return;
    }
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const params = { q, limit: 200 };
      if (schoolView) params.schoolFilter = schoolView;
      const data = await api.getRecipientHistory(params);
      setHistoryData(data);
    } catch (e) {
      setHistoryError(e.message || 'Search failed');
      setHistoryData(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  if (loading) return <div className="alert alert-info">Loading dashboard...</div>;
  if (error)   return <div className="alert alert-error">{error}</div>;
  if (!stats)  return null;

  const successColor = stats.successRate >= 90 ? '#16a34a' : stats.successRate >= 70 ? '#d97706' : '#dc2626';
  const successAccent = stats.successRate >= 90 ? '#dcfce7' : stats.successRate >= 70 ? '#fef9c3' : '#fee2e2';

  // Section rows
  const secRows = (stats.bySec || []).reduce((acc, row) => {
    const ex = acc.find(r => r.section === row.section);
    if (ex) {
      if (row.status === 'SENT')   ex.sent   += row.cnt;
      if (row.status === 'FAILED') ex.failed += row.cnt;
    } else {
      acc.push({ section: row.section, sent: row.status === 'SENT' ? row.cnt : 0, failed: row.status === 'FAILED' ? row.cnt : 0 });
    }
    return acc;
  }, []).sort((a, b) => (b.sent + b.failed) - (a.sent + a.failed));

  // Type breakdown
  const typeMap = {};
  (stats.byType || []).forEach(r => {
    if (!typeMap[r.type]) typeMap[r.type] = { sent: 0, failed: 0 };
    if (r.status === 'SENT')   typeMap[r.type].sent   = r.cnt;
    if (r.status === 'FAILED') typeMap[r.type].failed = r.cnt;
  });
  const typeEntries = Object.entries(typeMap).sort((a, b) => (b[1].sent + b[1].failed) - (a[1].sent + a[1].failed));
  const schoolBreakdown = (stats.schoolBreakdown || []);

  return (
    <div style={{ maxWidth: 1140 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={20} /> Dashboard
          </h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            {schoolView
              ? <><span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{schoolView}</span> &nbsp;- filtered view</>
              : 'Aurora University - Email Campaign Overview'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {schoolView && (
            <button className="btn btn-ghost" onClick={() => onSchoolViewChange?.(null)}
              style={{ fontSize: 12 }}>
              Show All Schools
            </button>
          )}
          <button className="btn btn-ghost" onClick={load}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KpiCard icon={Mail}         label="Total Emails"   value={stats.total}       color="#2563eb" accent="#eff6ff" />
        <KpiCard icon={CheckCircle2} label="Delivered"      value={stats.sent}        color="#16a34a" accent="#dcfce7" />
        <KpiCard icon={XCircle}      label="Failed"         value={stats.failed}      color="#dc2626" accent="#fee2e2" />
        <KpiCard icon={Percent}      label="Success Rate"   value={stats.successRate + '%'} color={successColor} accent={successAccent} />
        <KpiCard icon={CalendarDays} label="Sent Today"     value={stats.sentToday}   color="#7c3aed" accent="#ede9fe" />
        <KpiCard icon={CalendarRange}label="Sent This Week" value={stats.sentWeek}    color="#0891b2" accent="#e0f2fe" />
      </div>

      {/* Superadmin: school-level drill-down */}
      {schoolBreakdown.length > 0 && !schoolView && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ ...sh3, marginBottom: 0 }}><Building2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />School Overview (Drill-down)</h3>
            <div style={{ fontSize: 11, color: '#64748b' }}>Click a school to open its dashboard</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>School</th><th>Total</th><th>Sent</th><th>Failed</th><th>Success</th><th>Today</th><th>This Week</th><th>Last Activity</th><th></th>
                </tr>
              </thead>
              <tbody>
                {schoolBreakdown.map(s => (
                  <tr key={s.school}>
                    <td style={{ fontWeight: 700 }}>{s.school}</td>
                    <td>{s.total}</td>
                    <td style={{ color: '#16a34a', fontWeight: 700 }}>{s.sent}</td>
                    <td style={{ color: s.failed > 0 ? '#dc2626' : '#94a3b8', fontWeight: s.failed > 0 ? 700 : 400 }}>{s.failed}</td>
                    <td>
                      <span style={{
                        background: s.successRate >= 90 ? '#dcfce7' : s.successRate >= 70 ? '#fef9c3' : '#fee2e2',
                        color: s.successRate >= 90 ? '#15803d' : s.successRate >= 70 ? '#92400e' : '#b91c1c',
                        borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: 12,
                      }}>{s.successRate}%</span>
                    </td>
                    <td>{s.sentToday}</td>
                    <td>{s.sentWeek}</td>
                    <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(s.lastActivityAt)}</td>
                    <td>
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => onSchoolViewChange?.(s.school)}>
                        Drill Down
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Row 2: Trend + Top Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 14-Day Trend */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={sh3}><BarChart2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />14-Day Send Trend</h3>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#64748b' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, background: '#2563eb', borderRadius: 2, display: 'inline-block' }} /> Sent
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, background: '#fca5a5', borderRadius: 2, display: 'inline-block' }} /> Failed
              </span>
            </div>
          </div>
          <TrendChart data={stats.trend || []} />
        </div>

        {/* Quick Stats + Top Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Most Active Section */}
          <div className="card" style={{ flex: 1 }}>
            <h3 style={sh3}><Building2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Most Active Section</h3>
            {stats.topSection ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#1e3a8a' }}>{stats.topSection.section}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{stats.topSection.cnt} emails sent</div>
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: 13 }}>No data yet</p>
            )}
          </div>

          {/* Top Failed Recipients */}
          {(stats.topFailed || []).length > 0 && (
            <div className="card" style={{ flex: 2 }}>
              <h3 style={sh3}><AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: '#f59e0b' }} />Top Failed Recipients</h3>
              {(stats.topFailed || []).map(r => (
                <div key={r.recipient} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{r.name || r.recipient}</div>
                    {r.name && <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.recipient}</div>}
                  </div>
                  <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '2px 8px' }}>
                    {r.cnt}Ã—
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: By Type + By Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Mail Type Breakdown */}
        <div className="card">
          <h3 style={sh3}><Mail size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />By Mail Type</h3>
          {typeEntries.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13 }}>No data yet</p>}
          {typeEntries.map(([type, v]) => {
            const total = v.sent + v.failed;
            const pct   = total > 0 ? Math.round((v.sent / total) * 100) : 0;
            const c     = TYPE_COLORS[type] || { bg: '#f1f5f9', color: '#475569' };
            return (
              <div key={type} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: c.bg, color: c.color, borderRadius: 5, padding: '1px 7px', fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }}>{type}</span>
                    <span style={{ color: '#94a3b8' }}>{total} emails</span>
                  </span>
                  <span style={{ fontWeight: 700, color: pct >= 90 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626' }}>{pct}%</span>
                </div>
                <div style={{ height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, width: pct + '%', background: pct >= 90 ? '#16a34a' : pct >= 70 ? '#f59e0b' : '#ef4444', transition: 'width 0.8s ease' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Section Breakdown */}
        <div className="card">
          <h3 style={sh3}><Building2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />By Section</h3>
          {secRows.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13 }}>No section data yet</p>}
          {secRows.slice(0, 10).map(r => (
            <SectionRow key={r.section} {...r} />
          ))}
          {secRows.length > 10 && (
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>+{secRows.length - 10} more sections</p>
          )}
        </div>
      </div>

      {/* Row 4: Recent Jobs */}
      {(stats.recentJobs || []).length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ ...sh3, marginBottom: 0 }}><Clock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Recent Jobs</h3>
            <button className="btn btn-ghost" onClick={() => onNavigate && onNavigate('logs')}
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              View all logs <ArrowRight size={13} />
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr><th>Started</th><th>Type</th><th>Sent</th><th>Failed</th><th>Total</th><th>Rate</th><th>Job ID</th></tr>
              </thead>
              <tbody>
                {(stats.recentJobs || []).map(c => {
                  const pct = c.total > 0 ? Math.round((c.sent / c.total) * 100) : 0;
                  const tc  = TYPE_COLORS[c.type] || { bg: '#f1f5f9', color: '#475569' };
                  return (
                    <tr key={c.job_id}>
                      <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(c.started_at)}</td>
                      <td>
                        <span style={{ background: tc.bg, color: tc.color, borderRadius: 5, padding: '2px 8px', fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }}>
                          {c.type}
                        </span>
                      </td>
                      <td style={{ color: '#16a34a', fontWeight: 700 }}>{c.sent}</td>
                      <td style={{ color: c.failed > 0 ? '#dc2626' : '#94a3b8', fontWeight: c.failed > 0 ? 700 : 400 }}>{c.failed}</td>
                      <td>{c.total}</td>
                      <td>
                        <span style={{
                          background: pct >= 90 ? '#dcfce7' : pct >= 70 ? '#fef9c3' : '#fee2e2',
                          color:      pct >= 90 ? '#15803d' : pct >= 70 ? '#92400e' : '#b91c1c',
                          borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: 12,
                        }}>{pct}%</span>
                      </td>
                      <td style={{ fontSize: 10, color: '#94a3b8', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.job_id}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recipient History */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h3 style={{ ...sh3, marginBottom: 0 }}>
            <Search size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Recipient History View
          </h3>
          <div style={{ display: 'flex', gap: 8, width: 'min(560px, 100%)' }}>
            <input
              className="form-control"
              placeholder="Search by email, name, or reg no"
              value={historyQuery}
              onChange={e => setHistoryQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') searchRecipientHistory(); }}
            />
            <button className="btn btn-outline" onClick={searchRecipientHistory} disabled={historyLoading}>
              {historyLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {historyError && <div className="alert alert-error" style={{ marginBottom: 10 }}>{historyError}</div>}

        {historyData?.summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 12 }}>
            <div style={miniCard}><div style={miniLabel}>Total</div><div style={miniVal}>{historyData.summary.total}</div></div>
            <div style={miniCard}><div style={miniLabel}>Sent</div><div style={{ ...miniVal, color: '#16a34a' }}>{historyData.summary.sent}</div></div>
            <div style={miniCard}><div style={miniLabel}>Failed</div><div style={{ ...miniVal, color: '#dc2626' }}>{historyData.summary.failed}</div></div>
            <div style={miniCard}><div style={miniLabel}>Last Sent</div><div style={{ ...miniVal, fontSize: 12 }}>{fmtDate(historyData.summary.lastSentAt)}</div></div>
          </div>
        )}

        {!historyLoading && historyData && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Sent At</th><th>Recipient</th><th>Name</th><th>Reg No</th><th>Type</th><th>Status</th><th>Section</th><th>School</th><th>Job ID</th>
                </tr>
              </thead>
              <tbody>
                {(historyData.rows || []).map(r => (
                  <tr key={`${r.school}-${r.id}`}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(r.sent_at)}</td>
                    <td style={{ fontSize: 12 }}>{r.recipient}</td>
                    <td style={{ fontSize: 12 }}>{r.name || '-'}</td>
                    <td style={{ fontSize: 12 }}>{r.reg_no || '-'}</td>
                    <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{r.type}</td>
                    <td>
                      <span className={r.status === 'SENT' ? 'badge badge-success' : 'badge badge-danger'}>{r.status}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{r.section || '-'}</td>
                    <td style={{ fontSize: 12 }}>{r.school || '-'}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{r.job_id}</td>
                  </tr>
                ))}
                {(!historyData.rows || historyData.rows.length === 0) && (
                  <tr><td colSpan={9} style={{ color: '#94a3b8', textAlign: 'center' }}>No history found for this recipient.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const sh3 = {
  fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14,
  display: 'flex', alignItems: 'center',
};

const miniCard = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '8px 10px',
  background: '#f8fafc',
};

const miniLabel = {
  fontSize: 11,
  color: '#64748b',
  marginBottom: 4,
};

const miniVal = {
  fontSize: 16,
  fontWeight: 700,
  color: '#0f172a',
};
