import { useState, useRef, useEffect } from 'react';
import { api, sseProgress } from '../api';
import { Mail, Loader2, Send, Users, Save, Paperclip, X, FileText } from 'lucide-react';
import FileUpload      from '../components/FileUpload';
import SectionSelector from '../components/SectionSelector';
import ProgressPanel   from '../components/ProgressPanel';

const MAIL_TYPES = [
  { id: 'circular',     label: 'Circular',       color: '#1e40af' },
  { id: 'announcement', label: 'Announcement',   color: '#92400e' },
  { id: 'event',        label: 'Event Notice',   color: '#166534' },
  { id: 'exam',         label: 'Exam Notice',    color: '#991b1b' },
  { id: 'holiday',      label: 'Holiday Notice', color: '#5b21b6' },
  { id: 'fee',          label: 'Fee Reminder',   color: '#9a3412' },
  { id: 'fee_reminder', label: 'Fee Due Alert',  color: '#7c3aed' },
  { id: 'general',      label: 'General',        color: '#374151' },
  { id: 'custom',       label: 'Custom HTML',    color: '#0e7490' },
];

const DEFAULT_MAPPING = { startRow: 9, nameCol: 2, emailCol: 4 };

export default function BulkMailPage() {
  const [file,       setFile]       = useState(null);
  const [sections,   setSections]   = useState([]);
  const [selected,   setSelected]   = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [mailType,   setMailType]   = useState('circular');
  const [subject,    setSubject]    = useState('');
  const [body,       setBody]       = useState('');
  const [htmlBody,   setHtmlBody]   = useState('');
  const [circularNo, setCircularNo] = useState('');
  const [feeDetails, setFeeDetails] = useState([{ label: '', amount: '', dueDate: '', overdue: false }]);
  const [mapping,    setMapping]    = useState(DEFAULT_MAPPING);
  const [templates,  setTemplates]  = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [job,        setJob]        = useState(null);
  const [loading,    setLoading]    = useState('');
  const [error,      setError]      = useState('');
  const cancelSse   = useRef(null);
  const attachRef   = useRef(null);

  useEffect(() => {
    api.getTemplates().then(setTemplates).catch(() => {});
  }, []);

  async function handleFile(f) {
    setFile(f); setSections([]); setSelected([]); setRecipients([]); setError('');
    setLoading('Loading sections…');
    try {
      const form = new FormData();
      form.append('sheet', f);
      const { sections: secs } = await api.listSections(form);
      setSections(secs); setSelected(secs);
    } catch (e) { setError(e.message); }
    finally { setLoading(''); }
  }

  async function handleLoadRecipients() {
    if (!file || !selected.length) return;
    setError(''); setLoading('Loading recipients…');
    try {
      const form = new FormData();
      form.append('sheet', file);
      form.append('sections', JSON.stringify(selected));
      form.append('mapping',  JSON.stringify(mapping));
      const { recipients: recs } = await api.loadRecipients(form);
      setRecipients(recs);
      if (!recs.length) setError('No valid recipients found.');
    } catch (e) { setError(e.message); }
    finally { setLoading(''); }
  }

  function handleAttachFiles(e) {
    const newFiles = Array.from(e.target.files || []);
    setAttachments(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...newFiles.filter(f => !names.has(f.name))];
    });
    e.target.value = '';
  }

  function removeAttachment(name) {
    setAttachments(prev => prev.filter(f => f.name !== name));
  }

  async function handleSend() {
    if (!recipients.length || !subject) return setError('Subject and recipients are required.');
    setError(''); setJob(null);
    try {
      const payload = {
        type: mailType, subject, body, htmlBody,
        circularNo, feeDetails,
        recipients, mapping,
      };
      const form = new FormData();
      if (file) form.append('sheet', file);
      attachments.forEach(f => form.append('attachments', f));
      form.append('payload', JSON.stringify(payload));
      const { jobId } = await api.startSend(form);
      setJob({ id: jobId, total: recipients.length, done: 0, sent: 0, failed: 0, status: 'Starting…', finished: false });
      cancelSse.current = sseProgress(jobId, j => setJob({ ...j, id: jobId }), j => setJob({ ...j, id: jobId }));
    } catch (e) { setError(e.message); }
  }

  function handleCancel() {
    if (job?.id) { api.cancelJob(job.id); cancelSse.current?.(); }
  }

  function loadTemplate(t) {
    setMailType(t.type); setSubject(t.subject); setBody(t.body);
  }

  async function saveTemplate() {
    const name = prompt('Template name:');
    if (!name) return;
    try {
      await api.saveTemplate({ name, type: mailType, subject, body });
      const ts = await api.getTemplates(); setTemplates(ts);
    } catch (e) { setError(e.message); }
  }

  function updateFeeRow(i, key, val) {
    setFeeDetails(f => f.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Mail size={20} /> Bulk Mailer</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          Send circulars, announcements, event notices, fee reminders, exam alerts and more to any group of students.
        </p>
      </div>

      {/* Mail Type Selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={sh3}>Step 1 — Choose Mail Type</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {MAIL_TYPES.map(t => (
            <button key={t.id} onClick={() => setMailType(t.id)} style={{
              padding: '7px 14px', borderRadius: 8, border: `2px solid ${mailType === t.id ? t.color : '#e2e8f0'}`,
              background: mailType === t.id ? t.color : '#f8fafc',
              color: mailType === t.id ? '#fff' : t.color,
              fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Compose */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ ...sh3, margin: 0 }}>Step 2 — Compose</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {templates.length > 0 && (
              <select className="form-control" style={{ fontSize: 12, padding: '5px 10px' }}
                onChange={e => { const t = templates.find(x => x.id === Number(e.target.value)); if (t) loadTemplate(t); }}>
                <option value="">Load template…</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 12px' }} onClick={saveTemplate}>
              <Save size={13} /> Save as Template
            </button>
          </div>
        </div>

        {mailType !== 'fee_reminder' && (
          <div style={{ display: 'grid', gridTemplateColumns: circularNo !== undefined ? '1fr auto' : '1fr', gap: 14, marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Subject <span style={{ color: '#dc2626' }}>*</span></label>
              <input className="form-control" value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="e.g., Important Notice – {{Name}}" />
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                Use &#123;&#123;Name&#125;&#125;, &#123;&#123;RegNo&#125;&#125;, &#123;&#123;Section&#125;&#125; for personalisation
              </span>
            </div>
            <div className="form-group" style={{ minWidth: 160 }}>
              <label className="form-label">Circular / Ref No (optional)</label>
              <input className="form-control" value={circularNo} onChange={e => setCircularNo(e.target.value)}
                placeholder="AU/2026/001" />
            </div>
          </div>
        )}

        {mailType === 'custom' ? (
          <div className="form-group">
            <label className="form-label">Custom HTML Body</label>
            <textarea className="form-control" style={{ minHeight: 200, fontFamily: 'monospace', fontSize: 12 }}
              value={htmlBody} onChange={e => setHtmlBody(e.target.value)}
              placeholder="<p>Dear {{Name}},</p><p>Your custom HTML…</p>" />
          </div>
        ) : mailType === 'fee_reminder' ? (
          <FeeEditor rows={feeDetails} onChange={setFeeDetails} onRowChange={updateFeeRow}
            subject={subject} onSubject={setSubject} />
        ) : (
          <div className="form-group">
            <label className="form-label">Body</label>
            <textarea className="form-control" style={{ minHeight: 160 }}
              value={body} onChange={e => setBody(e.target.value)}
              placeholder={`Dear {{Name}},\n\nThis is to inform you that…\n\nRegards,\nAurora University`} />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Plain text or basic HTML supported</span>
          </div>
        )}

        {/* ── Attachments ── */}
        <div style={{ marginTop: 18, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Paperclip size={14} /> Attachments <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 11 }}>(PDF, optional — sent to every recipient)</span>
            </label>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 12px' }}
              onClick={() => attachRef.current?.click()}>
              <Paperclip size={13} /> Attach PDF
            </button>
            <input ref={attachRef} type="file" accept=".pdf,application/pdf" multiple
              style={{ display: 'none' }} onChange={handleAttachFiles} />
          </div>
          {attachments.length === 0 ? (
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>No attachments added.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {attachments.map(f => (
                <div key={f.name} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: 8, padding: '7px 12px',
                }}>
                  <FileText size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{(f.size / 1024).toFixed(0)} KB</span>
                  <button type="button" onClick={() => removeAttachment(f.name)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex',
                  }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recipients */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={sh3}>Step 3 — Select Recipients</h3>
        <FileUpload onFile={handleFile} label="Upload Student Sheet (.xlsx)" />

        {sections.length > 0 && (
          <>
            <hr className="divider" />
            <SectionSelector sections={sections} selected={selected} onChange={setSelected} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, margin: '14px 0' }}>
              {[['Start Row', 'startRow'], ['Name Col #', 'nameCol'], ['Email Col #', 'emailCol']].map(([lbl, key]) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{lbl}</label>
                  <input className="form-control" type="number" min={1} value={mapping[key]}
                    onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <button className="btn btn-outline" onClick={handleLoadRecipients} disabled={!!loading}>
            {loading ? <><Loader2 size={14} className="spin" /> Loading…</> : <><Users size={14} /> Load Recipients</>}
            </button>
          </>
        )}

        {recipients.length > 0 && (
          <div className="alert alert-success" style={{ marginTop: 14 }}>
            ✓ <strong>{recipients.length}</strong> recipients loaded
          </div>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}

      {recipients.length > 0 && (
        <button className="btn btn-primary" style={{ padding: '11px 28px', fontSize: 14 }}
          onClick={handleSend} disabled={!!loading || (job && !job.finished)}>
          {job && !job.finished ? <><Loader2 size={14} className="spin" /> Sending…</> : <><Send size={14} /> Send to {recipients.length} Students</>}
        </button>
      )}

      <ProgressPanel job={job} onCancel={handleCancel} />
    </div>
  );
}

function FeeEditor({ rows, onRowChange, subject, onSubject }) {
  return (
    <div>
      <div className="form-group" style={{ marginBottom: 14 }}>
        <label className="form-label">Subject</label>
        <input className="form-control" value={subject} onChange={e => onSubject(e.target.value)}
          placeholder="Fee Payment Reminder – {{Name}}" />
      </div>
      <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Fee Items</label>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input className="form-control" placeholder="Description" value={r.label}
            onChange={e => onRowChange(i, 'label', e.target.value)} />
          <input className="form-control" placeholder="Amount ₹" type="number" value={r.amount}
            onChange={e => onRowChange(i, 'amount', e.target.value)} />
          <input className="form-control" placeholder="Due Date" value={r.dueDate}
            onChange={e => onRowChange(i, 'dueDate', e.target.value)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={r.overdue} onChange={e => onRowChange(i, 'overdue', e.target.checked)} />
            Overdue
          </label>
        </div>
      ))}
    </div>
  );
}

const sh3 = { fontSize: 14, fontWeight: 700, color: '#1e3a8a', marginBottom: 16 };
