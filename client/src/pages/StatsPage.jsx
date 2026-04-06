import { useState, useEffect } from 'react';import { TrendingUp, Calendar, BarChart2, Building2, FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api';

const TYPE_PAGE_SIZE     = 5;
const SEC_PAGE_SIZE      = 8;
const CAMPAIGN_PAGE_SIZE = 5;

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
      <button onClick={() => onChange(page - 1)} disabled={page === 1}
        style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 8px', cursor: page === 1 ? 'default' : 'pointer', color: page === 1 ? '#cbd5e1' : '#1e3a8a', display: 'flex', alignItems: 'center' }}>
        <ChevronLeft size={14} />
      </button>
      <span style={{ fontSize: 12, color: '#64748b' }}>Page {page} of {totalPages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
        style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 8px', cursor: page === totalPages ? 'default' : 'pointer', color: page === totalPages ? '#cbd5e1' : '#1e3a8a', display: 'flex', alignItems: 'center' }}>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

export default function StatsPage() {
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [typePage,     setTypePage]     = useState(1);
  const [secPage,      setSecPage]      = useState(1);
  const [campaignPage, setCampaignPage] = useState(1);

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="alert alert-info">Loading dashboard…</div>;
  if (error)   return <div className="alert alert-error">{error}</div>;
  if (!stats)  return null;

  const successColor = stats.successRate >= 90 ? '#16a34a' : stats.successRate >= 70 ? '#d97706' : '#dc2626';

  // Build type breakdown map
  const typeMap = {};
  (stats.byType || []).forEach(r => {
    if (!typeMap[r.type]) typeMap[r.type] = { sent: 0, failed: 0 };
    if (r.status === 'SENT')   typeMap[r.type].sent   = r.cnt;
    if (r.status === 'FAILED') typeMap[r.type].failed = r.cnt;
  });
  const typeEntries = Object.entries(typeMap);
  const typeTotalPages = Math.max(1, Math.ceil(typeEntries.length / TYPE_PAGE_SIZE));
  const typeSlice = typeEntries.slice((typePage - 1) * TYPE_PAGE_SIZE, typePage * TYPE_PAGE_SIZE);

  // Build section rows
  const secRows = (stats.bySec || []).reduce((acc, row) => {
    const existing = acc.find(r => r.section === row.section);
    if (existing) {
      if (row.status === 'SENT')   existing.sent   += row.cnt;
      if (row.status === 'FAILED') existing.failed += row.cnt;
    } else {
      acc.push({ section: row.section, sent: row.status === 'SENT' ? row.cnt : 0, failed: row.status === 'FAILED' ? row.cnt : 0 });
    }
    return acc;
  }, []);
  const secTotalPages = Math.max(1, Math.ceil(secRows.length / SEC_PAGE_SIZE));
  const secSlice = secRows.slice((secPage - 1) * SEC_PAGE_SIZE, secPage * SEC_PAGE_SIZE);

  // Campaigns pagination
  const campaigns = stats.recentCampaigns || [];
  const campaignTotalPages = Math.max(1, Math.ceil(campaigns.length / CAMPAIGN_PAGE_SIZE));
  const campaignSlice = campaigns.slice((campaignPage - 1) * CAMPAIGN_PAGE_SIZE, campaignPage * CAMPAIGN_PAGE_SIZE);

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={20} /> Dashboard</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Overview of all email campaigns</p>
      </div>

      {/* Top Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard val={stats.total}       lbl="Total Sent"    color="#1e3a8a" />
        <StatCard val={stats.sent}        lbl="Delivered"     color="#16a34a" />
        <StatCard val={stats.failed}      lbl="Failed"        color="#dc2626" />
        <StatCard val={stats.successRate + '%'} lbl="Success Rate" color={successColor} />
      </div>

      {/* Trend */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ ...sh3, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} /> 14-Day Send Trend
          </h3>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#64748b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#2563eb', borderRadius: 2, display: 'inline-block' }} /> Sent</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#fca5a5', borderRadius: 2, display: 'inline-block' }} /> Failed</span>
          </div>
        </div>
        <TrendChart data={stats.trend || []} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Type Breakdown */}
        <div className="card">
          <h3 style={sh3}><BarChart2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />By Mail Type</h3>
          {typeEntries.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13 }}>No data yet</p>}
          {typeSlice.map(([type, v]) => {
            const total = v.sent + v.failed;
            const pct   = total > 0 ? Math.round((v.sent / total) * 100) : 0;
            return (
              <div key={type} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{type}</span>
                  <span style={{ color: '#64748b' }}>{v.sent} / {total} ({pct}%)</span>
                </div>
                <div className="progress-bar-wrap">
                  <div className="progress-bar-fill" style={{ width: pct + '%' }} />
                </div>
              </div>
            );
          })}
          <Pagination page={typePage} totalPages={typeTotalPages} onChange={setTypePage} />
        </div>

        {/* Section Breakdown */}
        <div className="card">
          <h3 style={sh3}><Building2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />By Section</h3>
          <table className="table" style={{ fontSize: 12 }}>
            <thead><tr><th>Section</th><th>Sent</th><th>Failed</th></tr></thead>
            <tbody>
              {secSlice.map(r => (
                <tr key={r.section}>
                  <td><span className="badge badge-info">{r.section}</span></td>
                  <td style={{ color: '#16a34a', fontWeight: 600 }}>{r.sent}</td>
                  <td style={{ color: r.failed > 0 ? '#dc2626' : '#94a3b8', fontWeight: r.failed > 0 ? 600 : 400 }}>{r.failed}</td>
                </tr>
              ))}
              {secRows.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>No section data</td></tr>
              )}
            </tbody>
          </table>
          <Pagination page={secPage} totalPages={secTotalPages} onChange={setSecPage} />
        </div>
      </div>

      {/* Recent Campaigns */}
      {campaigns.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...sh3, marginBottom: 0 }}><FolderOpen size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Recent Campaigns</h3>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{campaigns.length} total</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Job ID</th><th>Type</th><th>Started</th><th>Sent</th><th>Failed</th><th>Total</th><th>Rate</th></tr></thead>
              <tbody>
                {campaignSlice.map(c => {
                  const pct = c.total > 0 ? Math.round((c.sent / c.total) * 100) : 0;
                  return (
                    <tr key={c.job_id}>
                      <td style={{ fontSize: 11, color: '#94a3b8', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.job_id}</td>
                      <td><span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{c.type}</span></td>
                      <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(c.started_at).toLocaleString('en-IN')}</td>
                      <td style={{ color: '#16a34a', fontWeight: 600 }}>{c.sent}</td>
                      <td style={{ color: c.failed > 0 ? '#dc2626' : '#94a3b8' }}>{c.failed}</td>
                      <td>{c.total}</td>
                      <td>
                        <span className={`badge ${pct >= 90 ? 'badge-success' : pct >= 70 ? 'badge-warn' : 'badge-danger'}`}>
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={campaignPage} totalPages={campaignTotalPages} onChange={setCampaignPage} />
        </div>
      )}
    </div>
  );
}

function StatCard({ val, lbl, color }) {
  // Count-up animation: works for plain numbers and strings ending with '%'
  const isPercent = typeof val === 'string' && val.endsWith('%');
  const target    = isPercent ? parseFloat(val) : (typeof val === 'number' ? val : null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (target === null) return;
    let startTime = null;
    const DURATION = 1100;
    function step(ts) {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setDisplay(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [target]);

  const shown = target !== null ? (isPercent ? display + '%' : display) : val;

  return (
    <div className="stat-card">
      <div className="stat-val" style={{ color }}>{shown}</div>
      <div className="stat-lbl">{lbl}</div>
    </div>
  );
}

function TrendChart({ data }) {
  // Always render exactly 14 days regardless of data
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = data.find(r => r.day === key) || { day: key, sent: 0, failed: 0 };
    days.push(row);
  }

  const CHART_H = 120;
  const maxVal  = Math.max(...days.map(d => d.sent + d.failed), 1);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, minWidth: 420, paddingBottom: 28 }}>
        {days.map(d => {
          const total = d.sent + d.failed;
          const sentH = Math.round((d.sent   / maxVal) * CHART_H);
          const failH = Math.round((d.failed / maxVal) * CHART_H);
          const label = d.day.slice(5); // MM-DD

          return (
            <div key={d.day} title={`${d.day}  Sent: ${d.sent}  Failed: ${d.failed}`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>

              {/* count label above bar */}
              <div style={{ fontSize: 9, color: '#94a3b8', height: 14, lineHeight: '14px' }}>
                {total > 0 ? total : ''}
              </div>

              {/* bar column — fixed height container so bars sit at the bottom */}
              <div style={{ height: CHART_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '80%', minWidth: 12 }}>
                {failH > 0 && (
                  <div style={{ background: '#fca5a5', height: failH, width: '100%',
                    borderRadius: sentH === 0 ? '3px 3px 0 0' : '3px 3px 0 0' }} />
                )}
                {sentH > 0 && (
                  <div style={{ background: '#2563eb', height: sentH, width: '100%',
                    borderRadius: failH === 0 ? '3px 3px 0 0' : '0' }} />
                )}
                {total === 0 && (
                  <div style={{ height: 2, background: '#e2e8f0', width: '100%', borderRadius: 1 }} />
                )}
              </div>

              {/* day label */}
              <div style={{
                position: 'absolute', bottom: -22, fontSize: 9, color: '#94a3b8',
                transform: 'rotate(-45deg)', transformOrigin: 'top center', whiteSpace: 'nowrap',
              }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const sh3 = { fontSize: 14, fontWeight: 700, color: '#1e3a8a', marginBottom: 16 };
