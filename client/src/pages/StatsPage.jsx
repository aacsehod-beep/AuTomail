import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Mail,
  Percent,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
  XCircle,
} from 'lucide-react';
import { api } from '../api';

function fmtDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function compactNumber(value) {
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function pct(sent, total) {
  return total > 0 ? Math.round((sent / total) * 100) : 0;
}

function healthTone(rate) {
  if (rate >= 92) return { label: 'Stable', fg: '#166534', bg: '#dcfce7', border: '#86efac' };
  if (rate >= 75) return { label: 'Watch', fg: '#92400e', bg: '#fef3c7', border: '#fcd34d' };
  return { label: 'Critical', fg: '#991b1b', bg: '#fee2e2', border: '#fca5a5' };
}

function typeTone(type) {
  const map = {
    attendance: { bg: '#dbeafe', fg: '#1d4ed8' },
    circular: { bg: '#fef3c7', fg: '#a16207' },
    announcement: { bg: '#ede9fe', fg: '#6d28d9' },
    event: { bg: '#cffafe', fg: '#0f766e' },
    exam: { bg: '#fee2e2', fg: '#b91c1c' },
    fee: { bg: '#dcfce7', fg: '#15803d' },
    fee_reminder: { bg: '#fce7f3', fg: '#9d174d' },
    general: { bg: '#e2e8f0', fg: '#475569' },
    custom: { bg: '#dbeafe', fg: '#1e40af' },
  };
  return map[type] || { bg: '#e2e8f0', fg: '#475569' };
}

function StatChip({ icon: Icon, label, value, tone = '#2563eb' }) {
  return (
    <div style={{
      padding: '16px 18px',
      borderRadius: 18,
      background: '#f8fbff',
      border: '1px solid #dbeafe',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        background: 'rgba(37,99,235,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon size={18} color={tone} />
      </div>
      <div>
        <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ color: '#0f172a', fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}

function SectionMeter({ item }) {
  const total = item.sent + item.failed;
  const rate = pct(item.sent, total);
  const tone = healthTone(rate);
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{item.section}</div>
          <div style={{ color: '#64748b', fontSize: 11 }}>{item.sent} sent, {item.failed} failed</div>
        </div>
        <div style={{
          alignSelf: 'flex-start',
          fontSize: 11,
          fontWeight: 700,
          padding: '4px 8px',
          borderRadius: 999,
          color: tone.fg,
          background: tone.bg,
        }}>
          {rate}%
        </div>
      </div>
      <div style={{ height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${rate}%`, background: `linear-gradient(90deg, ${tone.border}, ${tone.fg})` }} />
      </div>
    </div>
  );
}

function TrendBars({ data }) {
  const points = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const row = data.find(entry => entry.day === key) || { day: key, sent: 0, failed: 0 };
    points.push(row);
  }
  const max = Math.max(...points.map(point => point.sent + point.failed), 1);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, minmax(0, 1fr))', gap: 10, alignItems: 'end', minHeight: 220 }}>
      {points.map(point => {
        const total = point.sent + point.failed;
        const sentHeight = Math.max(8, Math.round((point.sent / max) * 130));
        const failedHeight = point.failed > 0 ? Math.max(6, Math.round((point.failed / max) * 56)) : 0;
        return (
          <div key={point.day} title={`${point.day} | Sent ${point.sent} | Failed ${point.failed}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', minHeight: 14 }}>{total > 0 ? total : ''}</div>
            <div style={{ width: '100%', maxWidth: 36, height: 150, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 3 }}>
              {failedHeight > 0 && <div style={{ height: failedHeight, borderRadius: 10, background: 'linear-gradient(180deg, #fca5a5, #ef4444)' }} />}
              <div style={{ height: sentHeight, borderRadius: 12, background: 'linear-gradient(180deg, #60a5fa, #1d4ed8)' }} />
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{point.day.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

function SchoolCard({ item, onSelect }) {
  const tone = healthTone(item.successRate);
  return (
    <button
      type="button"
      onClick={() => onSelect?.(item.school)}
      style={{
        textAlign: 'left',
        width: '100%',
        padding: 18,
        borderRadius: 18,
        border: '1px solid #dbeafe',
        background: 'linear-gradient(180deg, #ffffff, #f8fbff)',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.school}</div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 999, background: tone.bg, color: tone.fg }}>{item.successRate}%</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
        <div><div style={schoolMiniLabel}>Total</div><div style={schoolMiniVal}>{item.total}</div></div>
        <div><div style={schoolMiniLabel}>Today</div><div style={schoolMiniVal}>{item.sentToday}</div></div>
        <div><div style={schoolMiniLabel}>Week</div><div style={schoolMiniVal}>{item.sentWeek}</div></div>
      </div>
      <div style={{ fontSize: 11, color: '#64748b' }}>Last activity: {fmtDate(item.lastActivityAt)}</div>
    </button>
  );
}

export default function StatsPage({ onNavigate, schoolView, onSchoolViewChange }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    api.getStats(schoolView)
      .then(setStats)
      .catch(e => setError(e.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [schoolView]);

  async function searchRecipientHistory() {
    const q = historyQuery.trim();
    if (q.length < 2) {
      setHistoryError('Type at least 2 characters.');
      setHistoryData(null);
      return;
    }
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const params = { q, limit: 200 };
      if (schoolView) params.schoolFilter = schoolView;
      const data = await api.getRecipientHistory(params);
      setHistoryData(data);
    } catch (e) {
      setHistoryError(e.message || 'Search failed');
      setHistoryData(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  const derived = useMemo(() => {
    if (!stats) return null;

    const sections = (stats.bySec || []).reduce((acc, row) => {
      const existing = acc[row.section] || { section: row.section, sent: 0, failed: 0 };
      if (row.status === 'SENT') existing.sent += row.cnt;
      if (row.status === 'FAILED') existing.failed += row.cnt;
      acc[row.section] = existing;
      return acc;
    }, {});

    const sectionRows = Object.values(sections)
      .filter(item => item.section)
      .sort((a, b) => (b.sent + b.failed) - (a.sent + a.failed));

    const types = (stats.byType || []).reduce((acc, row) => {
      const entry = acc[row.type] || { type: row.type, sent: 0, failed: 0 };
      if (row.status === 'SENT') entry.sent += row.cnt;
      if (row.status === 'FAILED') entry.failed += row.cnt;
      acc[row.type] = entry;
      return acc;
    }, {});

    const typeRows = Object.values(types)
      .sort((a, b) => (b.sent + b.failed) - (a.sent + a.failed));

    const failureRate = stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0;
    const health = healthTone(stats.successRate || 0);
    const headline = stats.failed > 0
      ? `${stats.failed} failed deliveries need attention.`
      : 'Delivery pipeline is clean right now.';

    const recommendation = stats.successRate < 75
      ? 'Investigate failed recipients and recent jobs before the next campaign.'
      : stats.sentToday > 0
        ? 'Today is active. Use recent jobs and recipient history to spot repeat failures.'
        : 'No campaign activity today. Use templates and scheduler to stage the next send.';

    return { sectionRows, typeRows, failureRate, health, headline, recommendation };
  }, [stats]);

  if (loading) return <div className="alert alert-info">Loading dashboard...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!stats || !derived) return null;

  return (
    <div style={{ maxWidth: 1280, paddingBottom: 24 }}>
      <section style={{
        borderRadius: 28,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #f8fbff 0%, #eef4ff 48%, #dbeafe 100%)',
        border: '1px solid #dbeafe',
        boxShadow: '0 20px 50px rgba(37,99,235,0.12)',
        marginBottom: 20,
      }}>
        <div style={{ padding: '28px 28px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                <Sparkles size={14} /> Operations cockpit
              </div>
              <h1 style={{ color: '#0f172a', fontSize: 'clamp(1.9rem, 4vw, 3rem)', lineHeight: 1, letterSpacing: '-0.05em', marginBottom: 10, fontWeight: 700 }}>
                {schoolView ? `${schoolView} dashboard` : 'Aurora delivery command center'}
              </h1>
              <p style={{ color: '#475569', maxWidth: 720, fontSize: 14 }}>
                A live view of sending health, campaign mix, delivery risk, and recipient intelligence.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {schoolView && (
                <button className="btn btn-ghost" onClick={() => onSchoolViewChange?.(null)} style={heroGhostBtn}>
                  Show all schools
                </button>
              )}
              <button className="btn btn-ghost" onClick={load} style={heroGhostBtn}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr', gap: 16, alignItems: 'stretch' }}>
            <div style={{
              padding: 22,
              borderRadius: 24,
              background: 'linear-gradient(180deg, #ffffff, #f8fbff)',
              border: '1px solid #dbeafe',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Delivery health</div>
                  <div style={{ color: '#0f172a', fontSize: 26, fontWeight: 700 }}>{derived.headline}</div>
                </div>
                <div style={{
                  alignSelf: 'flex-start',
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: derived.health.bg,
                  color: derived.health.fg,
                  fontWeight: 700,
                  fontSize: 12,
                }}>
                  {derived.health.label}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                <StatChip icon={Mail} label="Total volume" value={compactNumber(stats.total)} tone="#93c5fd" />
                <StatChip icon={CheckCircle2} label="Delivered" value={compactNumber(stats.sent)} tone="#4ade80" />
                <StatChip icon={XCircle} label="Failed" value={compactNumber(stats.failed)} tone="#fca5a5" />
                <StatChip icon={Clock3} label="Today" value={compactNumber(stats.sentToday)} tone="#c4b5fd" />
              </div>
            </div>

            <div style={{
              padding: 22,
              borderRadius: 24,
              background: 'linear-gradient(180deg, #eff6ff, #dbeafe)',
              border: '1px solid #bfdbfe',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', width: 94, height: 94, borderRadius: '50%', background: `conic-gradient(#2563eb 0 ${stats.successRate}%, rgba(37,99,235,0.14) ${stats.successRate}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', fontSize: 20, fontWeight: 700 }}>
                    {stats.successRate}%
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Success rate</div>
                  <div style={{ color: '#0f172a', fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>{stats.successRate}%</div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Failure rate: {derived.failureRate}%</div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <div style={signalRow}><Percent size={14} color="#93c5fd" /> Weekly throughput <strong>{compactNumber(stats.sentWeek)}</strong></div>
                <div style={signalRow}><Target size={14} color="#fcd34d" /> Recommendation: <span>{derived.recommendation}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!schoolView && (stats.schoolBreakdown || []).length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <div style={sectionHeader}>
            <div>
              <div style={sectionEyebrow}>School network</div>
              <h2 style={sectionTitle}><Building2 size={18} /> School activity</h2>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {stats.schoolBreakdown.map(item => (
              <SchoolCard key={item.school} item={item} onSelect={onSchoolViewChange} />
            ))}
          </div>
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.9fr', gap: 18, marginBottom: 20 }}>
        <section style={panelCard}>
          <div style={sectionHeader}>
            <div>
              <div style={sectionEyebrow}>Pattern scan</div>
              <h2 style={sectionTitle}><BarChart3 size={18} /> 14 day campaign rhythm</h2>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#64748b' }}>
              <span style={legendItem}><span style={{ ...legendDot, background: '#2563eb' }} />Sent</span>
              <span style={legendItem}><span style={{ ...legendDot, background: '#ef4444' }} />Failed</span>
            </div>
          </div>
          <TrendBars data={stats.trend || []} />
        </section>

        <section style={panelCard}>
          <div style={sectionHeader}>
            <div>
              <div style={sectionEyebrow}>Risk watch</div>
              <h2 style={sectionTitle}><ShieldAlert size={18} /> Failure hotspots</h2>
            </div>
          </div>
          {(stats.topFailed || []).length === 0 ? (
            <div style={emptyState}>No repeated failed recipients right now.</div>
          ) : (
            <div>
              {(stats.topFailed || []).map(item => (
                <div key={item.recipient} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{item.name || item.recipient}</div>
                    {item.name && <div style={{ color: '#64748b', fontSize: 11 }}>{item.recipient}</div>}
                  </div>
                  <span style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 999, padding: '5px 10px', fontSize: 11, fontWeight: 700 }}>
                    {item.cnt}x
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>
        <section style={panelCard}>
          <div style={sectionHeader}>
            <div>
              <div style={sectionEyebrow}>Composition</div>
              <h2 style={sectionTitle}><Mail size={18} /> Delivery mix by mail type</h2>
            </div>
          </div>
          {derived.typeRows.length === 0 ? (
            <div style={emptyState}>No mail type data available yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {derived.typeRows.map(item => {
                const total = item.sent + item.failed;
                const rate = pct(item.sent, total);
                const tone = typeTone(item.type);
                return (
                  <div key={item.type} style={{ padding: 14, borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ background: tone.bg, color: tone.fg, borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{item.type}</span>
                        <span style={{ fontSize: 11, color: '#64748b' }}>{total} emails</span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{rate}%</div>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                      <div style={{ width: `${rate}%`, height: '100%', background: `linear-gradient(90deg, ${tone.fg}, #0f172a)` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={panelCard}>
          <div style={sectionHeader}>
            <div>
              <div style={sectionEyebrow}>Reliability leaderboard</div>
              <h2 style={sectionTitle}><Users size={18} /> Section performance</h2>
            </div>
          </div>
          {derived.sectionRows.length === 0 ? (
            <div style={emptyState}>No section data available yet.</div>
          ) : (
            <div>
              {derived.sectionRows.slice(0, 8).map(item => <SectionMeter key={item.section} item={item} />)}
            </div>
          )}
        </section>
      </div>

      <section style={{ ...panelCard, marginBottom: 20 }}>
        <div style={sectionHeader}>
          <div>
            <div style={sectionEyebrow}>Execution flow</div>
            <h2 style={sectionTitle}><Clock3 size={18} /> Recent jobs</h2>
          </div>
          <button className="btn btn-ghost" onClick={() => onNavigate?.('logs')}>
            View all logs <ArrowRight size={14} />
          </button>
        </div>

        {(stats.recentJobs || []).length === 0 ? (
          <div style={emptyState}>No jobs have been recorded yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {(stats.recentJobs || []).map(item => {
              const total = item.total || 0;
              const rate = pct(item.sent, total);
              const tone = typeTone(item.type);
              return (
                <div key={item.job_id} style={{
                  padding: 16,
                  borderRadius: 18,
                  border: '1px solid #e2e8f0',
                  background: 'linear-gradient(180deg, #ffffff, #f8fafc)',
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr auto',
                  gap: 14,
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ background: tone.bg, color: tone.fg, borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{item.type}</span>
                      <span style={{ color: '#64748b', fontSize: 11 }}>{fmtDate(item.started_at)}</span>
                    </div>
                    <div style={{ color: '#64748b', fontSize: 11 }}>Job ID: {item.job_id}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div><div style={schoolMiniLabel}>Sent</div><div style={{ ...schoolMiniVal, color: '#16a34a' }}>{item.sent}</div></div>
                    <div><div style={schoolMiniLabel}>Failed</div><div style={{ ...schoolMiniVal, color: item.failed ? '#dc2626' : '#64748b' }}>{item.failed}</div></div>
                    <div><div style={schoolMiniLabel}>Total</div><div style={schoolMiniVal}>{total}</div></div>
                  </div>
                  <div>
                    <div style={schoolMiniLabel}>Success</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{rate}%</div>
                  </div>
                  <div style={{ width: 70, height: 70, borderRadius: '50%', background: `conic-gradient(#2563eb 0 ${rate}%, #e2e8f0 ${rate}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{rate}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={panelCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div style={sectionEyebrow}>Recipient intelligence</div>
            <h2 style={sectionTitle}><Search size={18} /> History explorer</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, width: 'min(620px, 100%)' }}>
            <input
              className="form-control"
              placeholder="Search by email, name, or reg no"
              value={historyQuery}
              onChange={e => setHistoryQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') searchRecipientHistory(); }}
            />
            <button className="btn btn-primary" onClick={searchRecipientHistory} disabled={historyLoading}>
              {historyLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {historyError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{historyError}</div>}

        {historyData?.summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div style={intelStat}><div style={schoolMiniLabel}>Total records</div><div style={intelVal}>{historyData.summary.total}</div></div>
            <div style={intelStat}><div style={schoolMiniLabel}>Delivered</div><div style={{ ...intelVal, color: '#15803d' }}>{historyData.summary.sent}</div></div>
            <div style={intelStat}><div style={schoolMiniLabel}>Failed</div><div style={{ ...intelVal, color: '#b91c1c' }}>{historyData.summary.failed}</div></div>
            <div style={intelStat}><div style={schoolMiniLabel}>Last sent</div><div style={{ ...intelVal, fontSize: 13 }}>{fmtDate(historyData.summary.lastSentAt)}</div></div>
          </div>
        )}

        {!historyLoading && historyData && (
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 18 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Sent At</th><th>Recipient</th><th>Name</th><th>Reg No</th><th>Type</th><th>Status</th><th>Section</th><th>School</th><th>Job ID</th>
                </tr>
              </thead>
              <tbody>
                {(historyData.rows || []).map(row => (
                  <tr key={`${row.school}-${row.id}`}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(row.sent_at)}</td>
                    <td style={{ fontSize: 12 }}>{row.recipient}</td>
                    <td style={{ fontSize: 12 }}>{row.name || '-'}</td>
                    <td style={{ fontSize: 12 }}>{row.reg_no || '-'}</td>
                    <td>
                      <span style={{ ...pillStyle, ...typeTone(row.type) }}>{row.type}</span>
                    </td>
                    <td>
                      <span className={row.status === 'SENT' ? 'badge badge-success' : 'badge badge-danger'}>{row.status}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{row.section || '-'}</td>
                    <td style={{ fontSize: 12 }}>{row.school || '-'}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{row.job_id}</td>
                  </tr>
                ))}
                {(!historyData.rows || historyData.rows.length === 0) && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8' }}>No history found for this recipient.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const heroGhostBtn = {
  background: '#ffffff',
  color: '#1d4ed8',
  border: '1px solid #bfdbfe',
};

const signalRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: '#334155',
  fontSize: 12,
};

const panelCard = {
  background: 'linear-gradient(180deg, #ffffff, #f8fafc)',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 20,
  boxShadow: '0 16px 40px rgba(15,23,42,0.06)',
};

const sectionHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  marginBottom: 16,
};

const sectionEyebrow = {
  fontSize: 11,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
};

const sectionTitle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: '#0f172a',
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '-0.03em',
};

const legendItem = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const legendDot = {
  width: 10,
  height: 10,
  borderRadius: 999,
  display: 'inline-block',
};

const emptyState = {
  padding: '18px 0',
  color: '#64748b',
  fontSize: 13,
};

const schoolMiniLabel = {
  color: '#64748b',
  fontSize: 11,
  marginBottom: 4,
};

const schoolMiniVal = {
  color: '#0f172a',
  fontSize: 18,
  fontWeight: 700,
};

const intelStat = {
  padding: 14,
  borderRadius: 16,
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
};

const intelVal = {
  color: '#0f172a',
  fontSize: 22,
  fontWeight: 700,
};

const pillStyle = {
  display: 'inline-flex',
  padding: '4px 9px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'capitalize',
};
