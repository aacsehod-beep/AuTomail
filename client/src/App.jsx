import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import { ToastContainer } from './components/Toast';
import LoginPage        from './pages/LoginPage';
import AttendancePage   from './pages/AttendancePage';
import BulkMailPage     from './pages/BulkMailPage';
import LogsPage         from './pages/LogsPage';
import StatsPage        from './pages/StatsPage';
import TemplatesPage    from './pages/TemplatesPage';
import SchedulerPage    from './pages/SchedulerPage';
import UsersPage        from './pages/UsersPage';
import SettingsPage     from './pages/SettingsPage';
import { api } from './api';

const PAGES = {
  attendance: AttendancePage,
  bulk:       BulkMailPage,
  logs:       LogsPage,
  stats:      StatsPage,
  templates:  TemplatesPage,
  scheduler:  SchedulerPage,
  users:      UsersPage,
  settings:   SettingsPage,
};

export default function App() {
  const [token,      setToken]      = useState(() => sessionStorage.getItem('au_token')  || '');
  const [user,       setUser]       = useState(() => sessionStorage.getItem('au_user')   || '');
  const [school,     setSchool]     = useState(() => sessionStorage.getItem('au_school') || '');
  const [role,       setRole]       = useState(() => sessionStorage.getItem('au_role')   || 'admin');
  const [page,       setPage]       = useState('attendance');
  const [collapsed,  setCollapsed]  = useState(false);
  const [darkMode,   setDarkMode]   = useState(() => localStorage.getItem('au_dark') === 'true');
  // School switcher for superadmin (null = all schools)
  const [schoolView, setSchoolView] = useState(null);
  const [schools,    setSchools]    = useState([]);
  const Page = PAGES[page] || AttendancePage;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Load school list for superadmin switcher
  useEffect(() => {
    if (role === 'superadmin' && token) {
      api.getSchools().then(d => setSchools(d.schools || [])).catch(() => {});
    }
  }, [role, token]);

  function toggleDark() {
    setDarkMode(v => {
      const next = !v;
      localStorage.setItem('au_dark', next);
      return next;
    });
  }

  function handleLogin(tok, usr, sch, rl) {
    setToken(tok);
    setUser(usr);
    setSchool(sch || '');
    setRole(rl || 'admin');
    setSchoolView(null); // reset view on login
  }

  function handleLogout() {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => {});
    sessionStorage.removeItem('au_token');
    sessionStorage.removeItem('au_user');
    sessionStorage.removeItem('au_school');
    sessionStorage.removeItem('au_role');
    setToken('');
    setUser('');
    setSchool('');
    setRole('admin');
  }

  if (!token) return <LoginPage onLogin={handleLogin} />;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        current={page} onNavigate={setPage}
        user={user} school={school} role={role}
        schoolView={schoolView} schools={schools} onSchoolViewChange={setSchoolView}
        onLogout={handleLogout}
        collapsed={collapsed} onToggleCollapse={() => setCollapsed(v => !v)}
        darkMode={darkMode} onToggleDark={toggleDark}
      />
      <main style={{ flex: 1, padding: '28px', overflowY: 'auto', maxWidth: '100%' }}>
        <div key={page} className="page-fade">
          <Page onNavigate={setPage} schoolView={schoolView} onSchoolViewChange={setSchoolView} />
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
