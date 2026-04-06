import { Send, X, AlertTriangle } from 'lucide-react';

/**
 * ConfirmSendModal — shows a summary before sending.
 * Props:
 *   open       boolean
 *   onConfirm  () => void
 *   onCancel   () => void
 *   summary    { count, type, warnings: string[] }
 */
export default function ConfirmSendModal({ open, onConfirm, onCancel, summary }) {
  if (!open) return null;
  const { count = 0, type = '', warnings = [] } = summary || {};

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Send size={17} style={{ color: 'var(--primary-lt)' }} /> Confirm Send
          </h2>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Summary */}
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '16px 20px', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Recipients</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary-lt)' }}>{count}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Mail type</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{type}</span>
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 18 }}>
            {warnings.map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#92400e', marginBottom: i < warnings.length - 1 ? 6 : 0 }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>
            <Send size={14} /> Send Now
          </button>
        </div>
      </div>
    </div>
  );
}
