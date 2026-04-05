import { BarChart2, Send, TrendingUp, ClipboardList, FileText, Clock, GraduationCap } from 'lucide-react';

export default function Sidebar({ current, onNavigate }) {
  const NAV = [
    { id: 'attendance', Icon: BarChart2,     label: 'Attendance Mail',  desc: 'Send per-student reports'   },
    { id: 'bulk',       Icon: Send,          label: 'Bulk Mailer',      desc: 'Circulars, notices & more'  },
    { id: 'stats',      Icon: TrendingUp,    label: 'Dashboard',        desc: 'Analytics & overview'       },
    { id: 'logs',       Icon: ClipboardList, label: 'Email Logs',       desc: 'Full send history'          },
    { id: 'templates',  Icon: FileText,      label: 'Templates',        desc: 'Save reusable templates'    },
    { id: 'scheduler',  Icon: Clock,         label: 'Scheduler',        desc: 'Schedule future sends'      },
  ];

  return (
    <aside style={{
      width: 240, height: '100vh', background: '#0f172a',
      display: 'flex', flexDirection: 'column', padding: '0 0 24px',
      flexShrink: 0, overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <GraduationCap size={18} /> Aurora University
        </div>
        <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>Bulk Mail System</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => onNavigate(n.id)} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
            padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            marginBottom: 2, textAlign: 'left',
            background: current === n.id ? '#1e3a8a' : 'transparent',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (current !== n.id) e.currentTarget.style.background = '#1e293b'; }}
          onMouseLeave={e => { if (current !== n.id) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ lineHeight: 1, color: current === n.id ? '#fff' : '#94a3b8', marginTop: 2 }}><n.Icon size={16} /></span>
            <div>
              <div style={{ color: current === n.id ? '#fff' : '#cbd5e1', fontSize: 13, fontWeight: 600 }}>{n.label}</div>
              <div style={{ color: '#475569', fontSize: 11 }}>{n.desc}</div>
            </div>
          </button>
        ))}
      </nav>

      <div style={{ padding: '0 20px', fontSize: 10, color: '#334155' }}>
        v1.0.0 · Aurora Mailer
      </div>
    </aside>
  );
}
