import { useState } from 'react';
import Sidebar from './components/Sidebar';
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
  const [page, setPage] = useState('attendance');
  const Page = PAGES[page] || AttendancePage;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar current={page} onNavigate={setPage} />
      <main style={{ flex: 1, padding: '28px', overflowY: 'auto', maxWidth: '100%' }}>
        <Page />
      </main>
    </div>
  );
}
