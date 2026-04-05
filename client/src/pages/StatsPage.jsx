import { useState, useEffect } from 'react';
import { TrendingUp, Calendar, BarChart2, Building2, FolderOpen } from 'lucide-react';
import { api } from '../api';

export default function StatsPage() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

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
      {stats.trend?.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={sh3}><Calendar size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />14-Day Send Trend</h3>
          <TrendChart data={stats.trend} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Type Breakdown */}
        <div className="card">
          <h3 style={sh3}><BarChart2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />By Mail Type</h3>
          {Object.keys(typeMap).length === 0 && <p style={{ color: '#94a3b8', fontSize: 13 }}>No data yet</p>}
          {Object.entries(typeMap).map(([type, v]) => {
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
        </div>

        {/* Section Breakdown */}
        <div className="card">
          <h3 style={sh3}><Building2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />By Section</h3>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            <table className="table" style={{ fontSize: 12 }}>
              <thead><tr><th>Section</th><th>Sent</th><th>Failed</th></tr></thead>
              <tbody>
                {(stats.bySec || []).reduce((acc, row) => {
                  const existing = acc.find(r => r.section === row.section);
                  if (existing) {
                    if (row.status === 'SENT')   existing.sent   += row.cnt;
                    if (row.status === 'FAILED') existing.failed += row.cnt;
                  } else {
                    acc.push({ section: row.section, sent: row.status === 'SENT' ? row.cnt : 0, failed: row.status === 'FAILED' ? row.cnt : 0 });
                  }
                  return acc;
                }, []).map(r => (
                  <tr key={r.section}>
                    <td><span className="badge badge-info">{r.section}</span></td>
                    <td style={{ color: '#16a34a', fontWeight: 600 }}>{r.sent}</td>
                    <td style={{ color: r.failed > 0 ? '#dc2626' : '#94a3b8', fontWeight: r.failed > 0 ? 600 : 400 }}>{r.failed}</td>
                  </tr>
                ))}
                {(stats.bySec || []).length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>No section data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Campaigns */}
      {stats.recentCampaigns?.length > 0 && (
        <div className="card">
          <h3 style={sh3}><FolderOpen size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Recent Campaigns</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Job ID</th><th>Type</th><th>Started</th><th>Sent</th><th>Failed</th><th>Total</th><th>Rate</th></tr></thead>
              <tbody>
                {stats.recentCampaigns.map(c => {
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
        </div>
      )}
    </div>
  );
}

function StatCard({ val, lbl, color }) {
  return (
    <div className="stat-card">
      <div className="stat-val" style={{ color }}>{val}</div>
      <div className="stat-lbl">{lbl}</div>
    </div>
  );
}

function TrendChart({ data }) {
  const maxVal = Math.max(...data.map(d => d.sent + d.failed), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '0 4px' }}>
      {data.map(d => {
        const total  = d.sent + d.failed;
        const height = Math.round((total / maxVal) * 100);
        return (
          <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 9, color: '#94a3b8', whiteSpace: 'nowrap' }}>{total}</div>
            <div style={{ width: '100%', position: 'relative' }}>
              <div style={{ background: '#fee2e2', width: '100%', height: Math.round((d.failed / maxVal) * 100) + 'px', borderRadius: '3px 3px 0 0' }} />
              <div style={{ background: '#2563eb', width: '100%', height: Math.round((d.sent / maxVal) * 100) + 'px', borderRadius: '3px 3px 0 0' }} />
            </div>
            <div style={{ fontSize: 9, color: '#94a3b8', whiteSpace: 'nowrap', transform: 'rotate(-45deg)', transformOrigin: 'top center' }}>
              {d.day?.slice(5)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const sh3 = { fontSize: 14, fontWeight: 700, color: '#1e3a8a', marginBottom: 16 };
