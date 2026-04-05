import { useState, useEffect } from 'react';
import { FileText, Save, Trash2 } from 'lucide-react';
import { api } from '../api';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [editing,   setEditing]   = useState(null); // null | 'new' | template object
  const [form,      setForm]      = useState({ name: '', type: 'general', subject: '', body: '' });
  const [error,     setError]     = useState('');
  const [saved,     setSaved]     = useState(false);

  async function load() {
    try { setTemplates(await api.getTemplates()); } catch (e) { setError(e.message); }
  }

  useEffect(() => { load(); }, []);

  function startNew() {
    setForm({ name: '', type: 'general', subject: '', body: '' });
    setEditing('new'); setSaved(false); setError('');
  }

  function startEdit(t) {
    setForm({ name: t.name, type: t.type, subject: t.subject, body: t.body });
    setEditing(t); setSaved(false); setError('');
  }

  async function handleSave() {
    if (!form.name || !form.subject || !form.body) return setError('All fields are required.');
    try {
      await api.saveTemplate(form);
      await load(); setSaved(true); setEditing(null);
    } catch (e) { setError(e.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this template?')) return;
    try { await api.deleteTemplate(id); await load(); } catch (e) { setError(e.message); }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={20} /> Email Templates</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Save and reuse frequently sent email formats</p>
        </div>
        <button className="btn btn-primary" onClick={startNew}>+ New Template</button>
      </div>

      {error  && <div className="alert alert-error"   style={{ marginBottom: 14 }}>{error}</div>}
      {saved  && <div className="alert alert-success" style={{ marginBottom: 14 }}>Template saved!</div>}

      {/* Editor */}
      {editing && (
        <div className="card" style={{ marginBottom: 20, borderColor: '#2563eb' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a', marginBottom: 16 }}>
            {editing === 'new' ? 'New Template' : 'Edit: ' + form.name}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Template Name</label>
              <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Fee Reminder April" />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-control" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {['attendance','circular','announcement','event','exam','holiday','fee','general','custom'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Subject</label>
            <input className="form-control" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Subject line — supports {{Name}}, {{RegNo}}" />
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Body</label>
            <textarea className="form-control" style={{ minHeight: 160 }} value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Dear {{Name}},&#10;&#10;..." />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Save</button>
            <button className="btn btn-ghost"   onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Templates Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {templates.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#94a3b8', padding: 48, fontSize: 14 }}>
            No templates saved yet. Click "+ New Template" to create one.
          </div>
        )}
        {templates.map(t => (
          <div key={t.id} className="card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e3a8a' }}>{t.name}</div>
                <span className="badge badge-info" style={{ marginTop: 4, textTransform: 'capitalize' }}>{t.type}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => startEdit(t)}>Edit</button>
                <button className="btn btn-danger" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => handleDelete(t.id)}><Trash2 size={12} /></button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginBottom: 4 }}>{t.subject}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
              {t.body}
            </div>
            <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 12 }}>
              Updated: {new Date(t.updated_at).toLocaleDateString('en-IN')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
