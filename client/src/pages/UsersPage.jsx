import { useState, useEffect } from 'react';
import { api } from '../api';
import { Users, Plus, Trash2, Key, Shield, ShieldCheck, Loader2, Link } from 'lucide-react';

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 7,
  border: '1px solid #e2e8f0', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};

const btnStyle = (color = '#2563eb') => ({
  padding: '8px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
  background: color, color: '#fff', fontSize: 13, fontWeight: 600,
  display: 'flex', alignItems: 'center', gap: 6,
});

export default function UsersPage() {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  // Add user form
  const [form,     setForm]     = useState({ username: '', password: '', school_name: '', role: 'admin' });
  const [adding,   setAdding]   = useState(false);
  const [addErr,   setAddErr]   = useState('');
  const [addOk,    setAddOk]    = useState('');

  // Reset password
  const [resetId,  setResetId]  = useState(null);
  const [newPass,  setNewPass]  = useState('');
  const [resetting,setResetting]= useState(false);
  const [resetErr, setResetErr] = useState('');

  // Update GAS relay URL
  const [gasId,    setGasId]    = useState(null);
  const [gasUrl,   setGasUrl]   = useState('');
  const [gasSaving,setGasSaving]= useState(false);
  const [gasErr,   setGasErr]   = useState('');
  const [gasOk,    setGasOk]    = useState('');

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true); setError('');
    try {
      const data = await api.getUsers();
      setUsers(data.users || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setAddErr(''); setAddOk('');
    if (!form.username || !form.password || !form.school_name) {
      return setAddErr('All fields are required.');
    }
    setAdding(true);
    try {
      await api.createUser(form);
      setAddOk(`User "${form.username}" created.`);
      setForm({ username: '', password: '', school_name: '', role: 'admin' });
      loadUsers();
    } catch (e) {
      setAddErr(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id, username) {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await api.deleteUser(id);
      setUsers(u => u.filter(x => x.id !== id));
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleUpdateGas(e) {
    e.preventDefault();
    setGasErr(''); setGasOk('');
    if (!gasUrl || !gasUrl.startsWith('https://script.google.com/')) {
      return setGasErr('Must be a valid Google Apps Script URL (starts with https://script.google.com/)');
    }
    setGasSaving(true);
    try {
      await api.updateGasUrl(gasId, gasUrl);
      setGasOk('GAS URL saved.');
      loadUsers();
      setTimeout(() => setGasId(null), 1200);
    } catch (err) {
      setGasErr(err.message);
    } finally {
      setGasSaving(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setResetErr('');
    setResetting(true);
    try {
      await api.resetPassword(resetId, newPass);
      setResetId(null);
      setNewPass('');
    } catch (e) {
      setResetErr(e.message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 1280 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Users size={22} color="#2563eb" />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Manage Users</h1>
      </div>

      {/* Add User Form */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 28, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Add New User</h2>
        <form onSubmit={handleAdd}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Username</label>
              <input
                style={inputStyle}
                placeholder="e.g. eng_admin"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value.trim() }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Password (min 8 chars)</label>
              <input
                style={inputStyle}
                type="password"
                placeholder="Secure password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>School / Department Name</label>
              <input
                style={inputStyle}
                placeholder="e.g. School of Engineering"
                value={form.school_name}
                onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Role</label>
              <select
                style={inputStyle}
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              >
                <option value="admin">Admin (sees own school only)</option>
                <option value="superadmin">Super Admin (sees all schools)</option>
              </select>
            </div>
          </div>

          {addErr && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{addErr}</div>}
          {addOk  && <div style={{ color: '#16a34a', fontSize: 12, marginBottom: 8 }}>{addOk}</div>}

          <button type="submit" style={btnStyle()} disabled={adding}>
            {adding ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
            {adding ? 'Creating…' : 'Create User'}
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
          All Users ({users.length})
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
          </div>
        ) : error ? (
          <div style={{ padding: 24, color: '#dc2626', fontSize: 13 }}>{error}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Username', 'School / Department', 'GAS Relay URL', 'Role', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {u.role === 'superadmin' ? <ShieldCheck size={14} color="#f59e0b" /> : <Shield size={14} color="#94a3b8" />}
                      {u.username}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{u.school_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, maxWidth: 240 }}>
                    {u.gas_url ? (
                      <span style={{ color: '#16a34a', wordBreak: 'break-all' }} title={u.gas_url}>✓ Configured</span>
                    ) : (
                      <span style={{ color: '#f59e0b', fontStyle: 'italic' }}>Not set — uses global GAS URL</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: u.role === 'superadmin' ? '#fef3c7' : '#eff6ff',
                      color:      u.role === 'superadmin' ? '#d97706'  : '#2563eb',
                    }}>
                      {u.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { setGasId(u.id); setGasUrl(u.gas_url || ''); setGasErr(''); setGasOk(''); }}
                        title="Set GAS relay URL"
                        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                      >
                        <Link size={12} /> GAS URL
                      </button>
                      <button
                        onClick={() => { setResetId(u.id); setNewPass(''); setResetErr(''); }}
                        title="Reset password"
                        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                      >
                        <Key size={12} /> Password
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.username)}
                        title="Delete user"
                        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* GAS URL Modal */}
      {gasId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Set GAS Relay URL</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
              Each user can have their own Google Apps Script deployment so mail is sent from their own Gmail account.
              Paste the <strong>/exec</strong> URL from the GAS deployment here.
            </p>
            <form onSubmit={handleUpdateGas}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>GAS Web App URL</label>
              <input
                style={{ ...inputStyle, marginBottom: 12 }}
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={gasUrl}
                onChange={e => setGasUrl(e.target.value.trim())}
                autoFocus
              />
              {gasErr && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{gasErr}</div>}
              {gasOk  && <div style={{ color: '#16a34a', fontSize: 12, marginBottom: 8 }}>{gasOk}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setGasId(null)} style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button type="submit" style={btnStyle()} disabled={gasSaving}>
                  {gasSaving ? <Loader2 size={14} /> : <Link size={14} />}
                  {gasSaving ? 'Saving…' : 'Save URL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Reset Password</h3>
            <form onSubmit={handleResetPassword}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>New Password (min 8 chars)</label>
              <input
                style={{ ...inputStyle, marginBottom: 12 }}
                type="password"
                placeholder="New secure password"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                autoFocus
              />
              {resetErr && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{resetErr}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setResetId(null)} style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button type="submit" style={btnStyle()} disabled={resetting}>
                  {resetting ? <Loader2 size={14} /> : <Key size={14} />}
                  {resetting ? 'Saving…' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
