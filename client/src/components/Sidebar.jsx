import { BarChart2, Send, TrendingUp, ClipboardList, FileText, Clock, GraduationCap, LogOut, User, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';

export default function Sidebar({ current, onNavigate, user, onLogout, collapsed, onToggleCollapse, darkMode, onToggleDark }) {
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
      width: collapsed ? 60 : 240, height: '100vh', background: '#0f172a',
      display: 'flex', flexDirection: 'column',
      flexShrink: 0, overflowY: 'auto', overflowX: 'hidden',
      transition: 'width 0.22s ease',
    }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? '20px 0' : '24px 20px 20px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
        {collapsed ? (
          <GraduationCap size={20} color="#93c5fd" />
        ) : (
          <>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <GraduationCap size={18} /> Aurora University
            </div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 3, display: 'none' }}>Bulk Mail System</div>
          </>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: collapsed ? '12px 6px' : '12px 10px' }}>
        {NAV.map(n => {
          const isActive = current === n.id;
          return (
            <button key={n.id} onClick={() => onNavigate(n.id)} title={collapsed ? n.label : undefined} style={{
              display: 'flex', alignItems: collapsed ? 'center' : 'flex-start',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 10, width: '100%',
              padding: collapsed ? '10px 0' : '10px 12px',
              borderRadius: 8, border: 'none', cursor: 'pointer',
              marginBottom: 2, textAlign: 'left',
              background: isActive ? '#1e3a8a' : 'transparent',
              borderLeft: isActive && !collapsed ? '3px solid #3b82f6' : collapsed ? 'none' : '3px solid transparent',
              transition: 'background 0.15s, border-color 0.15s',
              paddingLeft: isActive && !collapsed ? '9px' : collapsed ? 0 : '12px',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#1e293b'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ lineHeight: 1, color: isActive ? '#fff' : '#94a3b8', marginTop: collapsed ? 0 : 2, flexShrink: 0 }}><n.Icon size={16} /></span>
              {!collapsed && (
                <div>
                  <div style={{ color: isActive ? '#fff' : '#cbd5e1', fontSize: 13, fontWeight: 600 }}>{n.label}</div>
                  <div style={{ color: '#475569', fontSize: 11 }}>{n.desc}</div>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Dark mode toggle */}
      <div style={{ borderTop: '1px solid #1e293b', padding: '8px', display: 'flex', justifyContent: 'center' }}>
        <button onClick={onToggleDark} title={darkMode ? 'Light mode' : 'Dark mode'} style={{
          background: 'none', border: '1px solid #1e293b', borderRadius: 6,
          padding: '5px 8px', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: 5,
          transition: 'background 0.15s, color 0.15s', fontSize: 11,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#94a3b8'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#475569'; }}>
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          {!collapsed && <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <div style={{ borderTop: '1px solid #1e293b', padding: '8px', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
        <button onClick={onToggleCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} style={{
          background: 'none', border: '1px solid #1e293b', borderRadius: 6,
          padding: '5px 8px', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#94a3b8'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#475569'; }}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* User + Logout */}
      {!collapsed ? (
        <div style={{ borderTop: '1px solid #1e293b', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <User size={14} color="#93c5fd" />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user || 'admin'}</div>
              <div style={{ color: '#475569', fontSize: 10 }}>Staff</div>
            </div>
          </div>
          <button onClick={onLogout} style={{
            display: 'flex', alignItems: 'center', gap: 7, width: '100%',
            padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'transparent', color: '#64748b', fontSize: 12, fontWeight: 500,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#f87171'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}>
            <LogOut size={14} /> Sign Out
          </button>
          <div style={{ marginTop: 8, fontSize: 10, color: '#334155' }}>v1.0.0 · Aurora Mailer</div>
        </div>
      ) : (
        <div style={{ borderTop: '1px solid #1e293b', padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={14} color="#93c5fd" />
          </div>
          <button onClick={onLogout} title="Sign Out" style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', padding: 4, borderRadius: 6,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}>
            <LogOut size={15} />
          </button>
        </div>
      )}
    </aside>
  );
}
