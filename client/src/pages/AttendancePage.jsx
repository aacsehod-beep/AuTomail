import { useState, useRef } from 'react';
import { api, sseProgress } from '../api';
import { BarChart2, Loader2, Send, Users } from 'lucide-react';
import FileUpload     from '../components/FileUpload';
import SectionSelector from '../components/SectionSelector';
import ProgressPanel  from '../components/ProgressPanel';

const DEFAULT_MAPPING = { startRow: 9, nameCol: 2, emailCol: 4 };

export default function AttendancePage() {
  const [file,       setFile]       = useState(null);
  const [sections,   setSections]   = useState([]);
  const [selected,   setSelected]   = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [mapping,    setMapping]    = useState(DEFAULT_MAPPING);
  const [threshold,  setThreshold]  = useState(75);
  const [filterLow,  setFilterLow]  = useState(false);
  const [job,        setJob]        = useState(null);
  const [loading,    setLoading]    = useState('');
  const [error,      setError]      = useState('');
  const cancelSse = useRef(null);

  async function handleFile(f) {
    setFile(f); setSections([]); setSelected([]); setRecipients([]); setError('');
    setLoading('Loading sections…');
    try {
      const form = new FormData();
      form.append('sheet', f);
      const { sections: secs } = await api.listSections(form);
      setSections(secs);
      setSelected(secs);
    } catch (e) { setError(e.message); }
    finally { setLoading(''); }
  }

  async function handleLoadRecipients() {
    if (!file || !selected.length) return;
    setError(''); setLoading('Loading recipients…');
    try {
      const form = new FormData();
      form.append('sheet', file);
      form.append('sections',  JSON.stringify(selected));
      form.append('mapping',   JSON.stringify(mapping));
      form.append('filterLow', String(filterLow));
      form.append('threshold', String(threshold));
      const { recipients: recs, total } = await api.loadRecipients(form);
      setRecipients(recs);
      if (total === 0) setError('No eligible recipients found with the current filters.');
    } catch (e) { setError(e.message); }
    finally { setLoading(''); }
  }

  async function handleSend() {
    if (!recipients.length) return;
    setError(''); setJob(null);
    try {
      const form = new FormData();
      form.append('sheet', file);
      form.append('payload', JSON.stringify({
        type: 'attendance',
        recipients,
        mapping,
        threshold,
      }));
      const { jobId } = await api.startSend(form);
      setJob({ id: jobId, total: recipients.length, done: 0, sent: 0, failed: 0, status: 'Starting…', finished: false });
      cancelSse.current = sseProgress(jobId, j => setJob({ ...j, id: jobId }), j => setJob({ ...j, id: jobId }));
    } catch (e) { setError(e.message); }
  }

  async function handleCancel() {
    if (job?.id) { api.cancelJob(job.id); cancelSse.current?.(); }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <PageHeader title={<><BarChart2 size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />Attendance Mailer</>} sub="Upload your attendance sheet and send personalized reports to students" />

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={sh3}>Step 1 — Upload Attendance Sheet</h3>
        <FileUpload onFile={handleFile} />
      </div>

      {sections.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={sh3}>Step 2 — Select Sections</h3>
          <SectionSelector sections={sections} selected={selected} onChange={setSelected} />

          <hr className="divider" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 14 }}>
            {[
              { label: 'Data Start Row', key: 'startRow' },
              { label: 'Name Column #',  key: 'nameCol'  },
              { label: 'Email Column #', key: 'emailCol' },
            ].map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}</label>
                <input className="form-control" type="number" min={1} value={mapping[f.key]}
                  onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="form-group">
              <label className="form-label">Threshold %</label>
              <input className="form-control" type="number" min={0} max={100} value={threshold}
                onChange={e => setThreshold(Number(e.target.value))} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={filterLow} onChange={e => setFilterLow(e.target.checked)} />
            Only include students with attendance below threshold
          </label>

          <button className="btn btn-outline" style={{ marginTop: 16 }} onClick={handleLoadRecipients} disabled={!!loading}>
            {loading === 'Loading recipients…' ? <><Loader2 size={14} className="spin" /> Loading…</> : <><Users size={14} /> Load Recipients</>}
          </button>
        </div>
      )}

      {recipients.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={sh3}>Step 3 — Review & Send</h3>
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            <strong>{recipients.length} recipients</strong> loaded across {[...new Set(recipients.map(r => r.section))].length} sections.
            {filterLow && ` (Filtered: attendance below ${threshold}%)`}
          </div>

          <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Reg No</th><th>Section</th></tr></thead>
              <tbody>
                {recipients.slice(0, 100).map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td><td>{r.email}</td><td>{r.regNo}</td>
                    <td><span className="badge badge-info">{r.section}</span></td>
                  </tr>
                ))}
                {recipients.length > 100 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: 10 }}>
                    …and {recipients.length - 100} more
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <button className="btn btn-primary"
            onClick={handleSend}
            disabled={!!loading || (job && !job.finished)}>
            {job && !job.finished ? <><Loader2 size={14} className="spin" /> Sending…</> : <><Send size={14} /> Send Attendance Mails ({recipients.length})</>}
          </button>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <div className="alert alert-info">{loading}</div>}
      <ProgressPanel job={job} onCancel={handleCancel} />
    </div>
  );
}

const sh3 = { fontSize: 14, fontWeight: 700, color: '#1e3a8a', marginBottom: 16 };

function PageHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>{title}</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{sub}</p>
    </div>
  );
}
