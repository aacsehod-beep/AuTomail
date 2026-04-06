import { useState } from 'react';
import Sidebar from './components/Sidebar';
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
  const [token, setToken] = useState(() => sessionStorage.getItem('au_token') || '');
  const [user,  setUser]  = useState(() => sessionStorage.getItem('au_user')  || '');
  const [page,  setPage]  = useState('attendance');
  const Page = PAGES[page] || AttendancePage;

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
      <Sidebar current={page} onNavigate={setPage} user={user} onLogout={handleLogout} />
      <main style={{ flex: 1, padding: '28px', overflowY: 'auto', maxWidth: '100%' }}>
        <Page />
      </main>
    </div>
  );
}
