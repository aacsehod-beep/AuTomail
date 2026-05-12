import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Download, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { api } from '../api';
import { showToast } from '../components/Toast';

const STATUS_COLORS = { SENT: 'badge-success', FAILED: 'badge-danger' };

// Today's date as YYYY-MM-DD for the date input default max
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function LogsPage({ schoolView }) {
  const [rows,    setRows]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [clearing, setClearing] = useState(false);
  const [filters, setFilters] = useState({
    type: '', status: '', section: '', jobId: '', search: '',
    dateFrom: '', dateTo: '',
  });
  const [page, setPage] = useState(0);
  const LIMIT = 25;

  const load = useCallback(async (pg = 0) => {
    setLoading(true); setError('');
    try {
      const params = { ...filters, limit: LIMIT, offset: pg * LIMIT };
      if (schoolView) params.schoolFilter = schoolView;
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
      const data = await api.getLogs(params);
      setRows(data.rows); setTotal(data.total); setPage(pg);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [filters, schoolView]);

  useEffect(() => { load(0); }, [load]);

  async function handleExport() {
    try {
      const params = new URLSearchParams();
      if (filters.type)     params.set('type',     filters.type);
      if (filters.status)   params.set('status',   filters.status);
      if (filters.section)  params.set('section',  filters.section);
      if (filters.jobId)    params.set('jobId',    filters.jobId);
      if (filters.search)   params.set('search',   filters.search);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo)   params.set('dateTo',   filters.dateTo);
      if (schoolView)       params.set('schoolFilter', schoolView);
      const token = sessionStorage.getItem('au_token') || '';
      const res = await fetch('/api/logs/export?' + params.toString(), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) { showToast('Export failed: ' + res.status, 'error'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `aurora-logs-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { showToast('Export failed: ' + e.message, 'error'); }
  }

  async function handleResend() {
    try {
      const result = await api.resendJob(filters.jobId);
      showToast(`Resend started — Job ${result.jobId}`, 'success');
    } catch (e) {
      showToast('Resend failed: ' + e.message, 'error');
    }
  }

  function clearFilters() {
    setFilters({ type: '', status: '', section: '', jobId: '', search: '', dateFrom: '', dateTo: '' });
  }

  async function handleClearLogs() {
    if (!window.confirm('Delete ALL email logs? This cannot be undone.')) return;
    setClearing(true);
    try {
      await api.clearLogs();
      showToast('All email logs deleted.', 'success');
      load(0);
    } catch (e) {
      showToast('Failed to clear logs: ' + e.message, 'error');
    } finally {
      setClearing(false);
    }
  }

  const hasFilters = Object.values(filters).some(v => v !== '');
  const hasFailed  = rows.some(r => r.status === 'FAILED');

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardList size={20} /> Email Logs</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            {schoolView
              ? <><span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{schoolView}</span> &nbsp;— {total} records</>
              : `Full send history — ${total} total records`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasFailed && (
            <button className="btn btn-outline" onClick={handleResend}
              disabled={!filters.jobId}
              title={filters.jobId ? 'Resend all failed emails for this job' : 'Enter a Job ID above to enable resend'}
              style={{ color: '#f59e0b', borderColor: '#f59e0b', opacity: filters.jobId ? 1 : 0.45 }}>
              <RefreshCw size={14} /> Resend Failed
            </button>
          )}
          <button className="btn btn-outline" onClick={handleExport}><Download size={14} /> Export CSV</button>
          <button className="btn btn-outline" onClick={handleClearLogs} disabled={clearing || total === 0}
            style={{ color: '#ef4444', borderColor: '#ef4444', opacity: total === 0 ? 0.45 : 1 }}
            title="Delete all email logs">
            <Trash2 size={14} /> {clearing ? 'Clearing…' : 'Clear All Logs'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 18 }}>
        {/* Row 1 — Date range + Search */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 12, marginBottom: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">From Date</label>
            <input type="date" className="form-control" max={todayStr()} value={filters.dateFrom}
              onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">To Date</label>
            <input type="date" className="form-control" max={todayStr()} value={filters.dateTo}
              onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              <input className="form-control" placeholder="Name or email…" value={filters.search}
                style={{ paddingLeft: 32 }}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
            </div>
          </div>
          {hasFilters && (
            <button className="btn btn-ghost" onClick={clearFilters} title="Clear all filters"
              style={{ padding: '8px 12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={14} /> Clear
            </button>
          )}
        </div>
        {/* Row 2 — Type / Status / Section / Job ID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Type</label>
            <select className="form-control" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
              <option value="">All Types</option>
              {['attendance','circular','announcement','event','exam','holiday','fee','fee_reminder','general','custom'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Status</label>
            <select className="form-control" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Section</label>
            <input className="form-control" placeholder="e.g. CSE-A" value={filters.section}
              onChange={e => setFilters(f => ({ ...f, section: e.target.value }))} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
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
      {(() => {
        const totalPages = Math.max(1, Math.ceil(total / LIMIT));
        // Build page window: first, last, current±2, with ellipsis
        const pageNums = [];
        for (let i = 0; i < totalPages; i++) {
          if (i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 2) {
            pageNums.push(i);
          }
        }
        const items = [];
        pageNums.forEach((p, idx) => {
          if (idx > 0 && p - pageNums[idx - 1] > 1) items.push('...');
          items.push(p);
        });
        const start = total === 0 ? 0 : page * LIMIT + 1;
        const end   = Math.min((page + 1) * LIMIT, total);

        return (
          <div style={{ display: 'flex', gap: 6, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 13 }}
              disabled={page === 0} onClick={() => load(0)}>«</button>
            <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 13 }}
              disabled={page === 0} onClick={() => load(page - 1)}>‹ Prev</button>

            {items.map((item, idx) =>
              item === '...'
                ? <span key={`el-${idx}`} style={{ padding: '5px 4px', color: '#94a3b8', fontSize: 13 }}>…</span>
                : (
                  <button key={item} onClick={() => load(item)}
                    className={item === page ? 'btn btn-primary' : 'btn btn-ghost'}
                    style={{ padding: '5px 11px', fontSize: 13, minWidth: 36 }}>
                    {item + 1}
                  </button>
                )
            )}

            <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 13 }}
              disabled={(page + 1) * LIMIT >= total} onClick={() => load(page + 1)}>Next ›</button>
            <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 13 }}
              disabled={(page + 1) * LIMIT >= total} onClick={() => load(totalPages - 1)}>»</button>

            <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>
              {total === 0 ? 'No records' : `${start}–${end} of ${total} records`}
              &nbsp;·&nbsp; {LIMIT} per page
            </span>
          </div>
        );
      })()}
    </div>
  );
}
