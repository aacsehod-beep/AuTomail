import { useState, useRef, useEffect } from 'react';
import { api, sseProgress } from '../api';
import { Mail, Loader2, Send, Users, Save, Paperclip, X, FileText, Award, ChevronDown, ChevronUp, IndianRupee } from 'lucide-react';
import FileUpload      from '../components/FileUpload';
import SectionSelector from '../components/SectionSelector';
import ProgressPanel   from '../components/ProgressPanel';
import { showToast }   from '../components/Toast';
import ConfirmSendModal from '../components/ConfirmSendModal';

const MAIL_TYPES = [
  { id: 'circular',     label: 'Circular',           color: '#1e40af' },
  { id: 'announcement', label: 'Announcement',       color: '#92400e' },
  { id: 'event',        label: 'Event Notice',       color: '#166534' },
  { id: 'exam',         label: 'Exam Notice',        color: '#991b1b' },
  { id: 'holiday',      label: 'Holiday Notice',     color: '#5b21b6' },
  { id: 'fee',          label: 'Fee Reminder',       color: '#9a3412' },
  { id: 'fee_reminder', label: 'Fee Due Alert',      color: '#7c3aed' },
  { id: 'general',      label: 'General',            color: '#374151' },
  { id: 'custom',       label: 'Custom HTML',        color: '#0e7490' },
  { id: 'certificate',  label: '🎓 Certificate Mail', color: '#0f766e' },
];

const DEFAULT_MAPPING = { startRow: 9, nameCol: 2, emailCol: 4 };

// Default fee sheet column mapping
const DEFAULT_FEE_MAPPING = {
  startRow: 2, nameCol: 1, emailCol: 2, regNoCol: 3,
  feeItems: [
    { label: 'Tuition Fee',   amountCol: 4, dueDateCol: 5 },
    { label: 'Hostel Fee',    amountCol: 6, dueDateCol: 7 },
    { label: 'Exam Fee',      amountCol: 8, dueDateCol: 9 },
  ],
};

export default function BulkMailPage() {
  const [file,         setFile]         = useState(null);
  const [sections,     setSections]     = useState([]);
  const [selected,     setSelected]     = useState([]);
  const [recipients,   setRecipients]   = useState([]);
  const [checkedEmails,setCheckedEmails]= useState(new Set());
  const [showRecipients, setShowRecipients] = useState(false);
  const [mailType,     setMailType]     = useState('circular');
  const [subject,      setSubject]      = useState('');
  const [body,         setBody]         = useState('');
  const [htmlBody,     setHtmlBody]     = useState('');
  const [circularNo,   setCircularNo]   = useState('');
  const [feeDetails,   setFeeDetails]   = useState([{ label: '', amount: '', dueDate: '', overdue: false }]);
  const [feeMapping,   setFeeMapping]   = useState(DEFAULT_FEE_MAPPING);
  const [showFeeAdvanced, setShowFeeAdvanced] = useState(false);
  const [mapping,      setMapping]      = useState(DEFAULT_MAPPING);
  const [templates,    setTemplates]    = useState([]);
  const [attachments,  setAttachments]  = useState([]);
  const [certFiles,      setCertFiles]      = useState([]);
  const [certMatchKey,   setCertMatchKey]   = useState('regNo');
  const [certAttachMode, setCertAttachMode] = useState('auto');   // 'auto' | 'manual'
  const [perCertMap,     setPerCertMap]     = useState({});       // email → File
  const [job,          setJob]          = useState(null);
  const [loading,      setLoading]      = useState('');
  const [error,        setError]        = useState('');
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [confirmSummary, setConfirmSummary] = useState({ count: 0, type: '', warnings: [] });
  const cancelSse          = useRef(null);
  const attachRef          = useRef(null);
  const certRef            = useRef(null);
  const perCertRef         = useRef(null);
  const currentPerCertEmail = useRef('');

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
      setCheckedEmails(new Set(recs.map(r => r.email)));
      if (!recs.length) setError('No valid recipients found.');
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

  function toggleAllRecipients() {
    if (checkedEmails.size === recipients.length) setCheckedEmails(new Set());
    else setCheckedEmails(new Set(recipients.map(r => r.email)));
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

  function handleCertFiles(e) {
    const incoming = Array.from(e.target.files || []).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    setCertFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...incoming.filter(f => !names.has(f.name))];
    });
    e.target.value = '';
  }

  function removeCertFile(name) {
    setCertFiles(prev => prev.filter(f => f.name !== name));
  }

  // Per-student manual attachment handlers
  function openPerCertPicker(email) {
    currentPerCertEmail.current = email;
    perCertRef.current?.click();
  }
  function handlePerCertPick(e) {
    const f = e.target.files?.[0];
    if (f && currentPerCertEmail.current) {
      setPerCertMap(prev => ({ ...prev, [currentPerCertEmail.current]: f }));
    }
    e.target.value = '';
  }
  function removePerCert(email) {
    setPerCertMap(prev => { const n = { ...prev }; delete n[email]; return n; });
  }

  // How many cert files match loaded recipients
  function certMatchCount() {
    if (!certFiles.length || !recipients.length) return { matched: 0, total: recipients.length };
    const certKeys = new Set(certFiles.map(f => f.name.replace(/\.pdf$/i, '').trim().toLowerCase()));
    const matched = recipients.filter(r => {
      const key = certMatchKey === 'regNo' ? (r.regNo || '').toLowerCase() : (r.name || '').toLowerCase();
      return certKeys.has(key);
    }).length;
    return { matched, total: recipients.length };
  }

  async function handleSend() {
    const toSend = recipients.filter(r => checkedEmails.has(r.email));
    if (mailType === 'certificate') {
      if (!toSend.length) return setError('Load recipients first.');
      if (certAttachMode === 'manual') {
        const attached = toSend.filter(r => perCertMap[r.email]);
        if (!attached.length) return setError('Attach at least one certificate PDF to a recipient.');
      } else {
        if (!certFiles.length) return setError('Upload at least one certificate PDF.');
        const { matched } = certMatchCount();
        if (matched === 0) return setError(`No certificates matched any recipient by ${certMatchKey === 'regNo' ? 'Roll Number' : 'Name'}. Check filenames.`);
      }
      if (!subject) return setError('Subject is required.');
    } else {
      if (!toSend.length || !subject) return setError('Subject and recipients are required.');
    }
    setError('');
    // Build warnings
    const warnings = [];
    if (mailType === 'certificate' && certAttachMode === 'auto') {
      const { matched, total } = certMatchCount();
      if (matched < total) warnings.push(`${total - matched} student(s) without matching certificate will be skipped.`);
    }
    if (mailType === 'certificate' && certAttachMode === 'manual') {
      const missing = toSend.filter(r => !perCertMap[r.email]).length;
      if (missing > 0) warnings.push(`${missing} student(s) have no certificate attached and will be skipped.`);
    }
    setConfirmSummary({ count: toSend.length, type: mailType, warnings });
    setShowConfirm(true);
  }

  async function doSend() {
    const toSend = recipients.filter(r => checkedEmails.has(r.email));
    setJob(null);
    try {
      const payload = {
        type: mailType, subject, body, htmlBody,
        circularNo, feeDetails,
        recipients: toSend, mapping,
        certMatchKey,
        certPerStudent: mailType === 'certificate' && certAttachMode === 'manual',
        certIndexMap: mailType === 'certificate' && certAttachMode === 'manual'
          ? Object.fromEntries(toSend.map((r, i) => [r.email, i]))
          : undefined,
        // fee_reminder from Excel — pass the mapping so server can parse per-student fees
        feeMapping: mailType === 'fee_reminder' ? feeMapping : undefined,
        feeFromExcel: mailType === 'fee_reminder' && file ? true : false,
      };
      const form = new FormData();
      if (file) form.append('sheet', file);
      attachments.forEach(f => form.append('attachments', f));
      certFiles.forEach(f => form.append('certFiles', f));
      // Per-student cert files: append as certFile_${index}
      if (mailType === 'certificate' && certAttachMode === 'manual') {
        toSend.forEach((r, i) => {
          const f = perCertMap[r.email];
          if (f) form.append(`certFile_${i}`, f);
        });
      }
      form.append('payload', JSON.stringify(payload));
      const { jobId } = await api.startSend(form);
      setJob({ id: jobId, total: toSend.length, done: 0, sent: 0, failed: 0, status: 'Starting…', finished: false });
      cancelSse.current = sseProgress(jobId, j => setJob({ ...j, id: jobId }), j => setJob({ ...j, id: jobId }));
    } catch (e) { setError(e.message); }
  }

  // Toast on job completion
  useEffect(() => {
    if (!job?.finished) return;
    if (job.sent > 0)    showToast(`✓ ${job.sent} email${job.sent !== 1 ? 's' : ''} sent successfully`, 'success');
    if (job.failed > 0)  showToast(`⚠ ${job.failed} email${job.failed !== 1 ? 's' : ''} failed`, 'warn');
  }, [job?.finished]);

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

        {mailType !== 'fee_reminder' && mailType !== 'certificate' && (
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

        {mailType === 'certificate' ? (
          <CertificateCompose
            subject={subject} onSubject={setSubject}
            body={body} onBody={setBody}
            certFiles={certFiles} certMatchKey={certMatchKey}
            onMatchKey={setCertMatchKey}
            onPickFiles={() => certRef.current?.click()}
            onRemove={removeCertFile}
            matchInfo={certMatchCount()}
            recipients={recipients}            certAttachMode={certAttachMode}
            onAttachModeChange={setCertAttachMode}
            perCertMap={perCertMap}
            onPerCertAttach={openPerCertPicker}
            onPerCertRemove={removePerCert}          />
        ) : mailType === 'custom' ? (
          <div className="form-group">
            <label className="form-label">Custom HTML Body</label>
            <textarea className="form-control" style={{ minHeight: 200, fontFamily: 'monospace', fontSize: 12 }}
              value={htmlBody} onChange={e => setHtmlBody(e.target.value)}
              placeholder="<p>Dear {{Name}},</p><p>Your custom HTML…</p>" />
          </div>
        ) : mailType === 'fee_reminder' ? (
          <FeeEditor rows={feeDetails} onChange={setFeeDetails} onRowChange={updateFeeRow}
            subject={subject} onSubject={setSubject}
            feeMapping={feeMapping} onFeeMapping={setFeeMapping}
            showAdvanced={showFeeAdvanced} onToggleAdvanced={() => setShowFeeAdvanced(v => !v)}
            hasFile={!!file} />
        ) : (
          <div className="form-group">
            <label className="form-label">Body</label>
            <textarea className="form-control" style={{ minHeight: 160 }}
              value={body} onChange={e => setBody(e.target.value)}
              placeholder={`Dear {{Name}},\n\nThis is to inform you that…\n\nRegards,\nAurora University`} />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Plain text or basic HTML supported</span>
          </div>
        )}
        {/* hidden cert file inputs */}
        <input ref={certRef} type="file" accept=".pdf,application/pdf" multiple
          style={{ display: 'none' }} onChange={handleCertFiles} />
        <input ref={perCertRef} type="file" accept=".pdf,application/pdf"
          style={{ display: 'none' }} onChange={handlePerCertPick} />

        {/* ── Common Attachments (not shown in certificate mode) ── */}
        {mailType !== 'certificate' && (
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
        )}
      </div>
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
          <div style={{ marginTop: 14 }}>
            {/* Summary bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <div className="alert alert-success" style={{ margin: 0, padding: '6px 14px', flex: 1 }}>
                ✓ <strong>{checkedEmails.size}</strong> of <strong>{recipients.length}</strong> recipients selected
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }}
                  onClick={toggleAllRecipients}>
                  {checkedEmails.size === recipients.length ? 'Deselect All' : 'Select All'}
                </button>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }}
                  onClick={() => setShowRecipients(v => !v)}>
                  {showRecipients ? <><ChevronUp size={13} /> Hide</> : <><ChevronDown size={13} /> Show All</>}
                </button>
              </div>
            </div>

            {/* Collapsible recipient table */}
            {showRecipients && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
                <table className="table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input type="checkbox"
                          checked={checkedEmails.size === recipients.length && recipients.length > 0}
                          onChange={toggleAllRecipients} />
                      </th>
                      <th>Name</th><th>Email</th><th>Reg No</th><th>Section</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((r, i) => {
                      const checked = checkedEmails.has(r.email);
                      return (
                        <tr key={i} onClick={() => toggleRecipient(r.email)}
                          style={{ cursor: 'pointer', background: checked ? '' : '#fef2f2', opacity: checked ? 1 : 0.55 }}>
                          <td onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={checked} onChange={() => toggleRecipient(r.email)} />
                          </td>
                          <td style={{ fontWeight: 500 }}>{r.name}</td>
                          <td style={{ color: '#64748b' }}>{r.email}</td>
                          <td>{r.regNo}</td>
                          <td><span className="badge badge-info">{r.section}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}

      {recipients.length > 0 && (
        <button className={`btn btn-primary${job && !job.finished ? ' btn-sending' : ''}`} style={{ padding: '11px 28px', fontSize: 14 }}
          onClick={handleSend} disabled={!checkedEmails.size || !!loading || (job && !job.finished)}>
          {job && !job.finished
            ? <><Loader2 size={14} className="spin" /> Sending…</>
            : <><Send size={14} /> Send to {checkedEmails.size} Student{checkedEmails.size !== 1 ? 's' : ''}</>}
        </button>
      )}

      <ProgressPanel job={job} onCancel={handleCancel} />
      <ConfirmSendModal
        open={showConfirm}
        onConfirm={() => { setShowConfirm(false); doSend(); }}
        onCancel={() => setShowConfirm(false)}
        summary={confirmSummary}
      />
    </div>
  );
}

function FeeEditor({ rows, onRowChange, onChange, subject, onSubject, feeMapping, onFeeMapping, showAdvanced, onToggleAdvanced, hasFile }) {
  const fm = feeMapping;

  function updateFeeItem(i, key, val) {
    const items = fm.feeItems.map((it, idx) => idx === i ? { ...it, [key]: val } : it);
    onFeeMapping({ ...fm, feeItems: items });
  }

  return (
    <div>
      <div className="form-group" style={{ marginBottom: 14 }}>
        <label className="form-label">Subject</label>
        <input className="form-control" value={subject} onChange={e => onSubject(e.target.value)}
          placeholder="Fee Payment Reminder – {{Name}}" />
      </div>

      {/* Mode toggle */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <IndianRupee size={15} style={{ color: '#7c3aed' }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#1e3a8a' }}>Fee Data Source</span>
        </div>

        {/* Option A — Excel file (preferred when file is already uploaded in Step 3) */}
        {hasFile ? (
          <>
            <div style={{ background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: '#5b21b6' }}>
              <strong>📊 Excel mode active</strong> — a student sheet is uploaded. Map the columns below and the system will read each student's fee details directly from the sheet and send personalised amounts.
            </div>

            {/* Core columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 10 }}>
              {[['Data Start Row', 'startRow'], ['Name Col #', 'nameCol'], ['Email Col #', 'emailCol'], ['Reg No Col #', 'regNoCol']].map(([lbl, key]) => (
                <div className="form-group" key={key}>
                  <label className="form-label" style={{ fontSize: 11 }}>{lbl}</label>
                  <input className="form-control" type="number" min={1} value={fm[key]}
                    onChange={e => onFeeMapping({ ...fm, [key]: Number(e.target.value) })} />
                </div>
              ))}
            </div>

            {/* Fee item columns */}
            <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 12, color: '#374151' }}>Fee Items — Column Mapping</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#1e3a8a', color: '#fff' }}>
                    <th style={thS}>Label (shown in email)</th>
                    <th style={thS}>Amount Col #</th>
                    <th style={thS}>Due Date Col #</th>
                    <th style={thS}>Mark Overdue if &gt; 0</th>
                    <th style={thS}></th>
                  </tr>
                </thead>
                <tbody>
                  {fm.feeItems.map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={tdS}>
                        <input value={it.label} onChange={e => updateFeeItem(i, 'label', e.target.value)}
                          style={{ width: '100%', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12 }} />
                      </td>
                      <td style={tdS}>
                        <input type="number" min={0} value={it.amountCol} onChange={e => updateFeeItem(i, 'amountCol', Number(e.target.value))}
                          style={{ width: 52, padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, textAlign: 'center' }} />
                      </td>
                      <td style={tdS}>
                        <input type="number" min={0} value={it.dueDateCol} onChange={e => updateFeeItem(i, 'dueDateCol', Number(e.target.value))}
                          style={{ width: 52, padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, textAlign: 'center' }} />
                        <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>0 = none</span>
                      </td>
                      <td style={{ ...tdS, textAlign: 'center' }}>
                        <input type="checkbox" checked={!!it.markOverdue} onChange={e => updateFeeItem(i, 'markOverdue', e.target.checked)} />
                      </td>
                      <td style={tdS}>
                        <button type="button" onClick={() => onFeeMapping({ ...fm, feeItems: fm.feeItems.filter((_, idx) => idx !== i) })}
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button"
              onClick={() => onFeeMapping({ ...fm, feeItems: [...fm.feeItems, { label: 'Fee Item', amountCol: 0, dueDateCol: 0, markOverdue: false }] })}
              style={{ marginTop: 8, fontSize: 12, padding: '4px 12px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer' }}>
              + Add Fee Item
            </button>
          </>
        ) : (
          /* Option B — manual fee rows when no Excel uploaded */
          <>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#92400e' }}>
              ℹ No sheet uploaded — same fee items will be sent to all recipients. Or upload a sheet in Step 3 to send personalized amounts.
            </div>
            <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Fee Items (same for all students)</label>
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px auto auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input className="form-control" placeholder="Description" value={r.label}
                  onChange={e => onRowChange(i, 'label', e.target.value)} />
                <input className="form-control" placeholder="₹ Amount" type="number" value={r.amount}
                  onChange={e => onRowChange(i, 'amount', e.target.value)} />
                <input className="form-control" placeholder="Due Date" value={r.dueDate}
                  onChange={e => onRowChange(i, 'dueDate', e.target.value)} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={r.overdue} onChange={e => onRowChange(i, 'overdue', e.target.checked)} />
                  Overdue
                </label>
                <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12, marginTop: 4 }}
              onClick={() => onChange([...rows, { label: '', amount: '', dueDate: '', overdue: false }])}>
              + Add Row
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const sh3  = { fontSize: 14, fontWeight: 700, color: '#1e3a8a', marginBottom: 16 };
const thS  = { padding: '6px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' };
const tdS  = { padding: '5px 8px' };

// ─── Certificate Compose Panel ────────────────────────────────────────────────
function CertificateCompose({
  subject, onSubject, body, onBody,
  certFiles, certMatchKey, onMatchKey, onPickFiles, onRemove,
  matchInfo, recipients,
  certAttachMode, onAttachModeChange,
  perCertMap, onPerCertAttach, onPerCertRemove,
}) {
  const attachedCount = recipients.filter(r => perCertMap[r.email]).length;

  return (
    <div>
      {/* Subject */}
      <div className="form-group" style={{ marginBottom: 14 }}>
        <label className="form-label">Subject <span style={{ color: '#dc2626' }}>*</span></label>
        <input className="form-control" value={subject} onChange={e => onSubject(e.target.value)}
          placeholder="Your Certificate – {{Name}}" />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>Use {`{{Name}}`}, {`{{RegNo}}`} for personalisation</span>
      </div>

      {/* Body */}
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label className="form-label">Email Message (optional)</label>
        <textarea className="form-control" style={{ minHeight: 100 }} value={body} onChange={e => onBody(e.target.value)}
          placeholder={`Dear {{Name}},\n\nPlease find attached your certificate. Congratulations!\n\nRegards,\nAurora University`} />
      </div>

      {/* Attachment mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['auto', '📁 Auto-match by filename'], ['manual', '📎 Attach per student']].map(([mode, label]) => (
          <button key={mode} type="button" onClick={() => onAttachModeChange(mode)} style={{
            padding: '7px 16px', borderRadius: 8,
            border: `2px solid ${certAttachMode === mode ? '#0f766e' : '#e2e8f0'}`,
            background: certAttachMode === mode ? '#f0fdf4' : '#f8fafc',
            color: certAttachMode === mode ? '#0f766e' : '#64748b',
            fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {label}
          </button>
        ))}
      </div>

      {certAttachMode === 'auto' ? (
        /* ── Auto-match mode (original) ── */
        <div>
          {/* Info banner */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#15803d' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><Award size={14} /> How Auto-match Works</strong>
            Upload one PDF per student. Name each file exactly as the student's <strong>Roll Number</strong> (e.g., <code>21AU001.pdf</code>) or <strong>Name</strong> (e.g., <code>Sai Teja.pdf</code>).
            The system automatically attaches each student's certificate to their email.
          </div>

          {/* Match key */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Match PDF filename by:</label>
            {['regNo', 'name'].map(k => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="radio" name="certMatchKey" value={k} checked={certMatchKey === k} onChange={() => onMatchKey(k)} />
                {k === 'regNo' ? 'Roll Number  (e.g. 21AU001.pdf)' : 'Student Name  (e.g. Sai Teja.pdf)'}
              </label>
            ))}
          </div>

          {/* Upload zone */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f766e', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Award size={14} /> Certificate PDFs
                {certFiles.length > 0 && <span style={{ fontWeight: 400, color: '#64748b', fontSize: 11 }}>({certFiles.length} uploaded)</span>}
              </span>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 12px' }} onClick={onPickFiles}>
                <Paperclip size={13} /> Add PDFs
              </button>
            </div>

            {/* Match summary badge */}
            {certFiles.length > 0 && recipients.length > 0 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 99, marginBottom: 10, fontSize: 12, fontWeight: 600,
                background: matchInfo.matched === 0 ? '#fef2f2' : matchInfo.matched < matchInfo.total ? '#fffbeb' : '#f0fdf4',
                color:      matchInfo.matched === 0 ? '#dc2626' : matchInfo.matched < matchInfo.total ? '#b45309' : '#16a34a',
                border: `1px solid ${matchInfo.matched === 0 ? '#fecaca' : matchInfo.matched < matchInfo.total ? '#fde68a' : '#bbf7d0'}`,
              }}>
                {matchInfo.matched === matchInfo.total ? '✓' : '⚠'}
                {matchInfo.matched} / {matchInfo.total} recipients matched
                {matchInfo.matched < matchInfo.total && matchInfo.matched > 0 && ` — ${matchInfo.total - matchInfo.matched} will be skipped`}
              </div>
            )}

            {certFiles.length === 0 ? (
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>No certificate PDFs uploaded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
                {certFiles.map(f => (
                  <div key={f.name} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px',
                  }}>
                    <FileText size={14} style={{ color: '#0f766e', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{(f.size / 1024).toFixed(0)} KB</span>
                    <button type="button" onClick={() => onRemove(f.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex' }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Manual mode — per-student attachment ── */
        <div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#1e40af' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}><Paperclip size={13} /> Attach per student</strong>
            Load recipients in Step 3, then click <strong>Attach PDF</strong> on each row to select that student's certificate. Files can have any name.
          </div>

          {recipients.length === 0 ? (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
              ⚠ No recipients loaded yet. Upload a student sheet in Step 3 and click <strong>Load Recipients</strong> first.
            </div>
          ) : (
            <>
              {/* Summary badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 99, marginBottom: 10, fontSize: 12, fontWeight: 600,
                background: attachedCount === 0 ? '#fef2f2' : attachedCount < recipients.length ? '#fffbeb' : '#f0fdf4',
                color:      attachedCount === 0 ? '#dc2626' : attachedCount < recipients.length ? '#b45309' : '#16a34a',
                border: `1px solid ${attachedCount === 0 ? '#fecaca' : attachedCount < recipients.length ? '#fde68a' : '#bbf7d0'}`,
              }}>
                {attachedCount === recipients.length && attachedCount > 0 ? '✓' : '📎'}
                {attachedCount} / {recipients.length} certificates attached
                {attachedCount < recipients.length && attachedCount > 0 && ` — ${recipients.length - attachedCount} without attachment will be skipped`}
              </div>

              {/* Recipient table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
                <table className="table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Roll No</th>
                      <th>Email</th>
                      <th>Certificate PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((r, i) => {
                      const attached = perCertMap[r.email];
                      return (
                        <tr key={i} style={{ background: attached ? '' : '#fffbeb' }}>
                          <td style={{ fontWeight: 500 }}>{r.name}</td>
                          <td>{r.regNo}</td>
                          <td style={{ color: '#64748b' }}>{r.email}</td>
                          <td>
                            {attached ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <FileText size={12} style={{ color: '#0f766e', flexShrink: 0 }} />
                                <span style={{ fontSize: 11, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0f766e', fontWeight: 500 }}>
                                  {attached.name}
                                </span>
                                <button type="button" onClick={() => onPerCertAttach(r.email)} title="Replace"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: '0 2px', fontSize: 10, flexShrink: 0 }}>
                                  ↺
                                </button>
                                <button type="button" onClick={() => onPerCertRemove(r.email)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex', flexShrink: 0 }}>
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => onPerCertAttach(r.email)} style={{
                                fontSize: 11, padding: '3px 10px',
                                background: '#eff6ff', color: '#2563eb',
                                border: '1px solid #bfdbfe', borderRadius: 6,
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                              }}>
                                <Paperclip size={11} /> Attach PDF
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
