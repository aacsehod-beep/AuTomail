import { Loader2, CheckCircle2, XCircle, Check, X } from 'lucide-react';

export default function ProgressPanel({ job, onCancel }) {
  if (!job) return null;
  const pct = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
  const isRunning = !job.finished;

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 6 }}>
          {isRunning
            ? <><Loader2 size={15} className="spin" /> Sending in progress…</>
            : job.status === 'Completed'
              ? <><CheckCircle2 size={15} color="#16a34a" /> Done!</>
              : <><XCircle size={15} color="#dc2626" /> {job.status}</>}
        </div>
        {isRunning && onCancel && (
          <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 12 }} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <div className="progress-bar-wrap" style={{ marginBottom: 10 }}>
        <div className="progress-bar-fill" style={{
          width: pct + '%',
          background: job.status === 'Cancelled' ? '#94a3b8'
                    : job.finished && job.failed === job.total ? '#dc2626'
                    : undefined,
        }} />
      </div>

      <div style={{ display: 'flex', gap: 24, fontSize: 13, flexWrap: 'wrap' }}>
        <span style={{ color: '#64748b' }}>Progress: <strong>{job.done} / {job.total}</strong> ({pct}%)</span>
        <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={13} /> Sent: <strong>{job.sent}</strong></span>
        <span style={{ color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 4 }}><X size={13} /> Failed: <strong>{job.failed}</strong></span>
      </div>

      {job.finished && (
        <div className={`alert ${job.failed === 0 ? 'alert-success' : job.sent === 0 ? 'alert-error' : 'alert-warn'}`}
          style={{ marginTop: 14 }}>
          {job.failed === 0
            ? `All ${job.sent} emails sent successfully!`
            : `Sent ${job.sent} / ${job.total}. ${job.failed} failed — check Logs for details.`}
        </div>
      )}
    </div>
  );
}
