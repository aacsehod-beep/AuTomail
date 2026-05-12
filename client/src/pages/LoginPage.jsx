import { useState } from 'react';
import { GraduationCap, Eye, EyeOff, LogIn, Loader2, Mail, ShieldCheck, Sparkles, Clock3 } from 'lucide-react';

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
      sessionStorage.setItem('au_token',  data.token);
      sessionStorage.setItem('au_user',   data.user);
      sessionStorage.setItem('au_school', data.school || '');
      sessionStorage.setItem('au_role',   data.role   || 'admin');
      onLogin(data.token, data.user, data.school || '', data.role || 'admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page-shell">
      <div className="login-page-card page-fade">
        <aside className="login-hero-panel">
          <div className="login-brand-lockup">
            <div className="login-brand-mark">
              <GraduationCap size={28} />
            </div>
            <div>
              <div className="login-brand-title">Aurora University</div>
              <div className="login-brand-subtitle">Mail Operations Console</div>
            </div>
          </div>

          <div className="login-hero-copy">
            <span className="login-pill">Staff portal</span>
            <h1>Staff Mail Console</h1>
            <p>Send attendance and circular emails for Aurora University.</p>
          </div>

          <div className="login-feature-list">
            <div className="login-feature-item">
              <Mail size={16} />
              <span>Bulk and attendance email delivery</span>
            </div>
            <div className="login-feature-item">
              <ShieldCheck size={16} />
              <span>Protected staff access and audit logs</span>
            </div>
            <div className="login-feature-item">
              <Sparkles size={16} />
              <span>AI-assisted subject and body drafting</span>
            </div>
            <div className="login-feature-item">
              <Clock3 size={16} />
              <span>Scheduled sends and live progress tracking</span>
            </div>
          </div>

          <div className="login-hero-footer">© {new Date().getFullYear()} Aurora University</div>
        </aside>

        <section className="login-form-panel">
            <div className="login-form-card">
              <span className="login-form-kicker">Aurora University</span>
            <div className="login-form-header">
              <div className="login-form-icon">
                <LogIn size={22} />
              </div>
              <div>
                <h2>Sign In</h2>
                <p>Use your staff credentials to access the mail system.</p>
              </div>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: 18 }}>{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Username</label>
                <input
                  className="form-control"
                  type="text"
                  autoComplete="username"
                  placeholder="Enter username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-control"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="login-password-toggle"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary login-submit-btn"
                disabled={loading}
              >
                {loading ? <><Loader2 size={15} className="spin" /> Signing in...</> : <><LogIn size={15} /> Sign In</>}
              </button>
            </form>

            <div className="login-form-note">Authorised use only. All activity is logged.</div>
          </div>
        </section>
      </div>
    </div>
  );
}
