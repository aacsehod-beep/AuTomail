import { useState, useRef, useEffect } from 'react';
import { api, sseProgress } from '../api';
import { BarChart2, Loader2, Send, Users, ChevronDown, ChevronUp } from 'lucide-react';
import FileUpload     from '../components/FileUpload';
import SectionSelector from '../components/SectionSelector';
import ProgressPanel  from '../components/ProgressPanel';
import { showToast }  from '../components/Toast';
import ConfirmSendModal from '../components/ConfirmSendModal';

const DEFAULT_MAPPING = { startRow: 9, nameCol: 2, emailCol: 4, weekInfoRow: 7, subjectHdrRow: 8 };
// Default subject layout: columns for name, classes-held, classes-attended, percentage
// Each entry: { nameCol, heldCol, attendedCol, pctCol }
const DEFAULT_SUBJ_LAYOUT = [
  { nameCol: 5,  heldCol: 6,  attendedCol: 7,  pctCol: 7  },
  { nameCol: 8,  heldCol: 9,  attendedCol: 10, pctCol: 10 },
  { nameCol: 11, heldCol: 12, attendedCol: 13, pctCol: 13 },
  { nameCol: 14, heldCol: 15, attendedCol: 16, pctCol: 16 },
  { nameCol: 17, heldCol: 18, attendedCol: 19, pctCol: 19 },
  { nameCol: 20, heldCol: 21, attendedCol: 22, pctCol: 22 },
];

export default function AttendancePage() {
  const [file,         setFile]         = useState(null);
  const [sections,     setSections]     = useState([]);
  const [selected,     setSelected]     = useState([]);
  const [recipients,   setRecipients]   = useState([]);
  const [checkedEmails,setCheckedEmails]= useState(new Set()); // selected for sending
  const [mapping,      setMapping]      = useState(DEFAULT_MAPPING);
  const [subjLayout,   setSubjLayout]   = useState(DEFAULT_SUBJ_LAYOUT);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [threshold,    setThreshold]    = useState(75);
  const [filterLow,    setFilterLow]    = useState(false);
  const [job,          setJob]          = useState(null);
  const [loading,      setLoading]      = useState('');
  const [error,        setError]        = useState('');
  const [showConfirm,  setShowConfirm]  = useState(false);
  const cancelSse = useRef(null);

  async function handleFile(f) {
    setFile(f); setSections([]); setSelected([]); setRecipients([]); setCheckedEmails(new Set()); setError('');
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
      // Select all by default
      setCheckedEmails(new Set(recs.map(r => r.email)));
      if (total === 0) setError('No eligible recipients found with the current filters.');
    } catch (e) { setError(e.message); }
    finally { setLoading(''); }
  }

  function toggleRecipient(email) {
    setCheckedEmails(prev => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  }

  function toggleAll() {
    if (checkedEmails.size === recipients.length) {
      setCheckedEmails(new Set());
    } else {
      setCheckedEmails(new Set(recipients.map(r => r.email)));
    }
  }

  async function handleSend() {
    const toSend = recipients.filter(r => checkedEmails.has(r.email));
    if (!toSend.length) return setError('No recipients selected.');
    setError('');
    setShowConfirm(true);
  }

  async function doSend() {
    const toSend = recipients.filter(r => checkedEmails.has(r.email));
    setJob(null);
    try {
      const form = new FormData();
      form.append('sheet', file);
      form.append('payload', JSON.stringify({
        type: 'attendance',
        recipients: toSend,
        mapping,
        subjLayout,
        threshold,
      }));
      const { jobId } = await api.startSend(form);
      setJob({ id: jobId, total: toSend.length, done: 0, sent: 0, failed: 0, status: 'Starting…', finished: false });
      cancelSse.current = sseProgress(jobId, j => setJob({ ...j, id: jobId }), j => setJob({ ...j, id: jobId }));
    } catch (e) { setError(e.message); }
  }
  // Toast on job completion
  useEffect(() => {
    if (!job?.finished) return;
    if (job.sent > 0)   showToast(`✓ ${job.sent} report${job.sent !== 1 ? 's' : ''} sent successfully`, 'success');
    if (job.failed > 0) showToast(`⚠ ${job.failed} failed`, 'warn');
  }, [job?.finished]);
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
          <h3 style={sh3}>Step 2 — Configure & Load</h3>
          <SectionSelector sections={sections} selected={selected} onChange={setSelected} />

          <hr className="divider" />
          {/* Basic mapping */}
          {/* Row 1 — student location columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            {[
              { label: 'Data Start Row',   key: 'startRow',     hint: 'Row where student data begins' },
              { label: 'Name Column #',    key: 'nameCol',      hint: 'Column containing student name' },
              { label: 'Email Column #',   key: 'emailCol',     hint: 'Column containing email address' },
            ].map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}</label>
                <input className="form-control" type="number" min={1} value={mapping[f.key]}
                  onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))} />
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{f.hint}</span>
              </div>
            ))}
          </div>

          {/* Row 2 — layout / threshold */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 14 }}>
            {[
              { label: 'Week / Period Info Row #', key: 'weekInfoRow',   hint: 'Row with date range / period text' },
              { label: 'Subject Header Row #',     key: 'subjectHdrRow', hint: 'Row where subject names are listed' },
            ].map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}</label>
                <input className="form-control" type="number" min={1} value={mapping[f.key]}
                  onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))} />
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{f.hint}</span>
              </div>
            ))}
            <div className="form-group">
              <label className="form-label">Threshold %</label>
              <input className="form-control" type="number" min={0} max={100} value={threshold}
                onChange={e => setThreshold(Number(e.target.value))} />
              <span style={{ fontSize: 10, color: '#94a3b8' }}>Below this = highlighted red</span>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 12 }}>
            <input type="checkbox" checked={filterLow} onChange={e => setFilterLow(e.target.checked)} />
            Only include students with attendance below threshold
          </label>

          {/* Advanced: subject-column layout */}
          <button type="button" onClick={() => setShowAdvanced(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4, padding: 0, marginBottom: 8 }}>
            {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showAdvanced ? 'Hide' : 'Show'} Subject Column Mapping (for custom sheet layouts)
          </button>

          {showAdvanced && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10, marginTop: 0 }}>
                Map where each subject's data lives in your sheet. Column numbers are 1-based (A=1, B=2 …).
                Add or remove subjects as needed.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#1e3a8a', color: '#fff' }}>
                      <th style={th}>#</th>
                      <th style={th}>Subject Name Col</th>
                      <th style={th}>Classes Held Col</th>
                      <th style={th}>Classes Attended Col</th>
                      <th style={th}>Percentage Col</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjLayout.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ ...td, color: '#94a3b8', fontWeight: 600 }}>S{i + 1}</td>
                        {['nameCol', 'heldCol', 'attendedCol', 'pctCol'].map(k => (
                          <td key={k} style={td}>
                            <input type="number" min={1} value={row[k]}
                              onChange={e => setSubjLayout(prev => prev.map((r, idx) => idx === i ? { ...r, [k]: Number(e.target.value) } : r))}
                              style={{ width: 56, padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, textAlign: 'center' }} />
                          </td>
                        ))}
                        <td style={td}>
                          <button type="button" onClick={() => setSubjLayout(prev => prev.filter((_, idx) => idx !== i))}
                            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => setSubjLayout(prev => [...prev, { nameCol: 1, heldCol: 2, attendedCol: 3, pctCol: 4 }])}
                style={{ marginTop: 8, fontSize: 12, padding: '4px 12px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer' }}>
                + Add Subject
              </button>
              <button type="button" onClick={() => setSubjLayout(DEFAULT_SUBJ_LAYOUT)}
                style={{ marginTop: 8, marginLeft: 8, fontSize: 12, padding: '4px 12px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }}>
                Reset to Default
              </button>
            </div>
          )}

          <button className="btn btn-outline" onClick={handleLoadRecipients} disabled={!!loading}>
            {loading === 'Loading recipients…' ? <><Loader2 size={14} className="spin" /> Loading…</> : <><Users size={14} /> Load Recipients</>}
          </button>
        </div>
      )}

      {recipients.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={sh3}>Step 3 — Select Recipients & Send</h3>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div className="alert alert-info" style={{ margin: 0, padding: '6px 12px', flex: 1 }}>
              <strong>{checkedEmails.size} of {recipients.length}</strong> selected
              {filterLow && ` · Filtered below ${threshold}%`}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ padding: '5px 12px', fontSize: 12 }} onClick={toggleAll}>
                {checkedEmails.size === recipients.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox"
                      checked={checkedEmails.size === recipients.length && recipients.length > 0}
                      onChange={toggleAll} />
                  </th>
                  <th>Name</th><th>Email</th><th>Reg No</th><th>Section</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r, i) => {
                  const checked = checkedEmails.has(r.email);
                  return (
                    <tr key={i} onClick={() => toggleRecipient(r.email)}
                      style={{ cursor: 'pointer', background: checked ? '' : '#fef2f2', opacity: checked ? 1 : 0.6 }}>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={checked} onChange={() => toggleRecipient(r.email)} />
                      </td>
                      <td>{r.name}</td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>{r.email}</td>
                      <td>{r.regNo}</td>
                      <td><span className="badge badge-info">{r.section}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button className={`btn btn-primary${job && !job.finished ? ' btn-sending' : ''}`}
            onClick={handleSend}
            disabled={!checkedEmails.size || !!loading || (job && !job.finished)}>
            {job && !job.finished
              ? <><Loader2 size={14} className="spin" /> Sending…</>
              : <><Send size={14} /> Send to {checkedEmails.size} Student{checkedEmails.size !== 1 ? 's' : ''}</>}
          </button>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <div className="alert alert-info">{loading}</div>}
      <ProgressPanel job={job} onCancel={handleCancel} />
      <ConfirmSendModal
        open={showConfirm}
        onConfirm={() => { setShowConfirm(false); doSend(); }}
        onCancel={() => setShowConfirm(false)}
        summary={{ count: recipients.filter(r => checkedEmails.has(r.email)).length, type: 'attendance', warnings: [] }}
      />
    </div>
  );
}

const sh3 = { fontSize: 14, fontWeight: 700, color: '#1e3a8a', marginBottom: 16 };
const th  = { padding: '6px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' };
const td  = { padding: '5px 10px' };

function PageHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>{title}</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{sub}</p>
    </div>
  );
}
