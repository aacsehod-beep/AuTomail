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

const PAGES = {
  attendance: AttendancePage,
  bulk:       BulkMailPage,
  logs:       LogsPage,
  stats:      StatsPage,
  templates:  TemplatesPage,
  scheduler:  SchedulerPage,
};

export default function App() {
  const [token,     setToken]     = useState(() => sessionStorage.getItem('au_token') || '');
  const [user,      setUser]      = useState(() => sessionStorage.getItem('au_user')  || '');
  const [page,      setPage]      = useState('attendance');
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode,  setDarkMode]  = useState(() => localStorage.getItem('au_dark') === 'true');
  const Page = PAGES[page] || AttendancePage;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  function toggleDark() {
    setDarkMode(v => {
      const next = !v;
      localStorage.setItem('au_dark', next);
      return next;
    });
  }

  function handleLogin(tok, usr) {
    setToken(tok);
    setUser(usr);
  }

  function handleLogout() {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => {});
    sessionStorage.removeItem('au_token');
    sessionStorage.removeItem('au_user');
    setToken('');
    setUser('');
  }

  if (!token) return <LoginPage onLogin={handleLogin} />;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        current={page} onNavigate={setPage}
        user={user} onLogout={handleLogout}
        collapsed={collapsed} onToggleCollapse={() => setCollapsed(v => !v)}
        darkMode={darkMode} onToggleDark={toggleDark}
      />
      <main style={{ flex: 1, padding: '28px', overflowY: 'auto', maxWidth: '100%' }}>
        <div key={page} className="page-fade">
          <Page />
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
