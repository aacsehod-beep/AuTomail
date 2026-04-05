import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Download } from 'lucide-react';
import { api } from '../api';

const STATUS_COLORS = { SENT: 'badge-success', FAILED: 'badge-danger' };

export default function LogsPage() {
  const [rows,    setRows]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [filters, setFilters] = useState({ type: '', status: '', section: '', jobId: '' });
  const [page,    setPage]    = useState(0);
  const LIMIT = 100;

  const load = useCallback(async (pg = 0) => {
    setLoading(true); setError('');
    try {
      const params = { ...filters, limit: LIMIT, offset: pg * LIMIT };
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
      const data = await api.getLogs(params);
      setRows(data.rows); setTotal(data.total); setPage(pg);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(0); }, [load]);

  function handleExport() {
    const params = new URLSearchParams();
    if (filters.type)   params.set('type',   filters.type);
    if (filters.status) params.set('status', filters.status);
    window.open('/api/logs/export?' + params.toString(), '_blank');
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardList size={20} /> Email Logs</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Full send history — {total} total records</p>
        </div>
        <button className="btn btn-outline" onClick={handleExport}><Download size={14} /> Export CSV</button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-control" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
              <option value="">All Types</option>
              {['attendance','circular','announcement','event','exam','holiday','fee','fee_reminder','general','custom'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Section</label>
            <input className="form-control" placeholder="e.g. CSE-A" value={filters.section}
              onChange={e => setFilters(f => ({ ...f, section: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Job ID</label>
            <input className="form-control" placeholder="uuid…" value={filters.jobId}
              onChange={e => setFilters(f => ({ ...f, jobId: e.target.value }))} />
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}
      {loading && <div className="alert alert-info" style={{ marginBottom: 14 }}>Loading…</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Time</th><th>Type</th><th>Recipient</th><th>Name</th>
                <th>Reg No</th><th>Section</th><th>Status</th><th>Message</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>No records found</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: 12 }}>
                    {new Date(r.sent_at).toLocaleString('en-IN')}
                  </td>
                  <td><span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{r.type}</span></td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.recipient}</td>
                  <td>{r.name}</td>
                  <td>{r.reg_no}</td>
                  <td>{r.section}</td>
                  <td><span className={`badge ${STATUS_COLORS[r.status] || 'badge-gray'}`}>{r.status}</span></td>
                  <td style={{ maxWidth: 240, color: '#64748b', fontSize: 12 }}>{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
          <button className="btn btn-ghost" disabled={page === 0} onClick={() => load(page - 1)}>← Prev</button>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            Page {page + 1} of {Math.ceil(total / LIMIT)} &nbsp;·&nbsp; {total} records
          </span>
          <button className="btn btn-ghost" disabled={(page + 1) * LIMIT >= total} onClick={() => load(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
