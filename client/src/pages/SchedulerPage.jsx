import { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { api } from '../api';

export default function SchedulerPage() {
  const [jobs,    setJobs]    = useState([]);
  const [form,    setForm]    = useState({ title: '', type: 'circular', subject: '', body: '', run_at: '' });
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    try { setJobs(await api.getScheduled()); } catch (e) { setError(e.message); }
  }

  useEffect(() => { load(); }, []);

  async function handleSchedule() {
    if (!form.title || !form.run_at || !form.subject) return setError('Title, subject and run time are required.');
    setError(''); setSuccess('');
    try {
      await api.createSchedule({
        title:   form.title,
        type:    form.type,
        run_at:  form.run_at,
        payload: { subject: form.subject, body: form.body, type: form.type },
      });
      setSuccess('Scheduled successfully!');
      setForm(f => ({ ...f, title: '', subject: '', body: '', run_at: '' }));
      await load();
    } catch (e) { setError(e.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this scheduled job?')) return;
    try { await api.deleteSchedule(id); await load(); } catch (e) { setError(e.message); }
  }

  const STATUS_COLOR = { pending: 'badge-warn', sent: 'badge-success', cancelled: 'badge-gray', failed: 'badge-danger' };

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Clock size={20} /> Scheduler</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          Schedule bulk mail campaigns to go out at a specific date & time.
        </p>
      </div>

      {/* New Schedule Form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={sh3}>Create Scheduled Campaign</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div className="form-group">
            <label className="form-label">Campaign Title</label>
            <input className="form-control" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Month-End Fee Reminder" />
          </div>
          <div className="form-group">
            <label className="form-label">Mail Type</label>
            <select className="form-control" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {['circular','announcement','event','exam','holiday','fee','general'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Subject</label>
          <input className="form-control" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            placeholder="Subject line with {{Name}} placeholder support" />
        </div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Body</label>
          <textarea className="form-control" style={{ minHeight: 100 }} value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            placeholder="Dear {{Name}},&#10;&#10;Your message here…" />
        </div>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Schedule Date & Time</label>
          <input className="form-control" type="datetime-local" value={form.run_at}
            onChange={e => setForm(f => ({ ...f, run_at: e.target.value }))} />
        </div>

        {error   && <div className="alert alert-error"   style={{ marginBottom: 12 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success}</div>}

        <button className="btn btn-primary" onClick={handleSchedule}><Clock size={14} /> Schedule</button>
      </div>

      {/* Scheduled List */}
      <div className="card">
        <h3 style={sh3}>Scheduled Campaigns ({jobs.length})</h3>
        {jobs.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 13 }}>
            No scheduled campaigns yet.
          </div>
        )}
        {jobs.map(j => (
          <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1e3a8a' }}>{j.title}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                <span className="badge badge-info" style={{ textTransform: 'capitalize', marginRight: 8 }}>{j.type}</span>
                <Calendar size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{new Date(j.run_at).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className={`badge ${STATUS_COLOR[j.status] || 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>
                {j.status}
              </span>
              {j.status === 'pending' && (
                <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => handleDelete(j.id)}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="alert alert-info" style={{ marginTop: 20 }}>
        <strong>Note:</strong> Scheduled campaigns are stored and will be dispatched automatically when the server checks pending jobs. Make sure the server is running at the scheduled time.
      </div>
    </div>
  );
}

const sh3 = { fontSize: 14, fontWeight: 700, color: '#1e3a8a', marginBottom: 16 };
