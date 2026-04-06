import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ICONS = {
  success: <CheckCircle2 size={16} style={{ flexShrink: 0 }} />,
  error:   <XCircle      size={16} style={{ flexShrink: 0 }} />,
  warn:    <AlertTriangle size={16} style={{ flexShrink: 0 }} />,
  info:    <Info          size={16} style={{ flexShrink: 0 }} />,
};

export function showToast(msg, type = 'success') {
  window.dispatchEvent(new CustomEvent('au-toast', { detail: { msg, type, id: Date.now() + Math.random() } }));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    function handler(e) {
      const t = { ...e.detail, hiding: false };
      setToasts(prev => [...prev, t]);
      // Start hide animation after 3.5s, remove at 3.8s
      setTimeout(() => {
        setToasts(prev => prev.map(x => x.id === t.id ? { ...x, hiding: true } : x));
        setTimeout(() => {
          setToasts(prev => prev.filter(x => x.id !== t.id));
        }, 320);
      }, 3500);
    }
    window.addEventListener('au-toast', handler);
    return () => window.removeEventListener('au-toast', handler);
  }, []);

  function dismiss(id) {
    setToasts(prev => prev.map(x => x.id === id ? { ...x, hiding: true } : x));
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 320);
  }

  if (!toasts.length) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}${t.hiding ? ' hiding' : ''}`}
          style={{ pointerEvents: 'auto' }}
          onClick={() => dismiss(t.id)}>
          {ICONS[t.type] || ICONS.info}
          <span style={{ flex: 1 }}>{t.msg}</span>
          <X size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
        </div>
      ))}
    </div>
  );
}
