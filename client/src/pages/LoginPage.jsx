import { useState } from 'react';
import { GraduationCap, Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) return setError('Please enter username and password.');
    setError(''); setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');
      sessionStorage.setItem('au_token', data.token);
      sessionStorage.setItem('au_user',  data.user);
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%)',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: '#fff', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%)',
          padding: '32px 36px 28px', textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 60, height: 60, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', marginBottom: 14,
          }}>
            <GraduationCap size={30} color="#fff" />
          </div>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px' }}>Aurora University</div>
          <div style={{ color: '#bfdbfe', fontSize: 12, marginTop: 4 }}>Bulk Mail System — Staff Portal</div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '32px 36px' }}>
          <h2 style={{ margin: '0 0 24px', fontSize: 17, fontWeight: 700, color: '#0f172a', textAlign: 'center' }}>
            Sign In
          </h2>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#dc2626',
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Username
            </label>
            <input
              className="form-control"
              type="text"
              autoComplete="username"
              placeholder="Enter username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{ fontSize: 14 }}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Password
            </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              className="form-control"
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ fontSize: 14, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPass(s => !s)}
              style={{
                position: 'absolute', right: 12,
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#94a3b8', display: 'flex', padding: 0, flexShrink: 0,
              }}
              tabIndex={-1}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '11px', fontSize: 14, justifyContent: 'center' }}
          >
            {loading ? <><Loader2 size={15} className="spin" /> Signing in…</> : <><LogIn size={15} /> Sign In</>}
          </button>
        </form>

        <div style={{
          borderTop: '1px solid #f1f5f9', padding: '14px 36px',
          textAlign: 'center', fontSize: 11, color: '#94a3b8',
        }}>
          © {new Date().getFullYear()} Aurora University. Authorised use only.
        </div>
      </div>
    </div>
  );
}
