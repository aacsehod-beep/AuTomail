import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Save, Languages } from 'lucide-react';
import { api } from '../api';

const PRESETS = [
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'kn', label: 'Kannada' },
  { code: 'mr', label: 'Marathi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ur', label: 'Urdu' },
];

export default function SettingsPage() {
  const [langs,    setLangs]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState('');
  const [error,    setError]    = useState('');
  const [newCode,  setNewCode]  = useState('');
  const [newLabel, setNewLabel] = useState('');

  async function loadSettings() {
    setLoading(true); setError('');
    try {
      const s = await api.getSettings();
      setLangs(Array.isArray(s.languages) ? s.languages : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSettings(); }, []);

  async function saveLangs(updated) {
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.updateSettings('languages', updated);
      setLangs(updated);
      setSuccess('Languages saved.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function addPreset(preset) {
    if (langs.find(l => l.code === preset.code)) return;
    saveLangs([...langs, preset]);
  }

  function addCustom() {
    const code = newCode.trim().toLowerCase();
    const label = newLabel.trim();
    if (!code || !label) return setError('Both code and label are required.');
    if (!/^[a-z]{2,5}$/.test(code)) return setError('Code must be 2-5 lowercase letters.');
    if (langs.find(l => l.code === code)) return setError(`Language "${code}" already added.`);
    setNewCode(''); setNewLabel(''); setError('');
    saveLangs([...langs, { code, label }]);
  }

  function removeLang(code) {
    saveLangs(langs.filter(l => l.code !== code));
  }

  function moveUp(i) {
    if (i === 0) return;
    const next = [...langs];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    saveLangs(next);
  }

  function moveDown(i) {
    if (i === langs.length - 1) return;
    const next = [...langs];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    saveLangs(next);
  }

  return (
    <div style={{ width: '100%', maxWidth: 1280 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={20} /> System Settings
        </h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          Configure system-wide options. Changes apply to all users immediately.
        </p>
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom: 14 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 14 }}>{success}</div>}

      {/* ── Language Management ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Languages size={16} /> Multilingual Email Languages
        </h3>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          These languages appear in the Bulk Mailer and Templates pages as variant fields.
          English (en) is always the default fallback and is not listed here.
        </p>

        {loading ? (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : (
          <>
            {/* Active languages list */}
            {langs.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
                No extra languages configured. Add one below.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {langs.map((l, i) => (
                  <div key={l.code} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '7px 12px' }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: '#0f766e', minWidth: 30 }}>{l.code}</span>
                    <span style={{ flex: 1, fontSize: 13, color: '#1e293b' }}>{l.label}</span>
                    <button onClick={() => moveUp(i)}   disabled={i === 0}                title="Move up"   style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#cbd5e1' : '#64748b', fontSize: 14, padding: '0 2px' }}>▲</button>
                    <button onClick={() => moveDown(i)} disabled={i === langs.length - 1} title="Move down" style={{ background: 'none', border: 'none', cursor: i === langs.length - 1 ? 'default' : 'pointer', color: i === langs.length - 1 ? '#cbd5e1' : '#64748b', fontSize: 14, padding: '0 2px' }}>▼</button>
                    <button onClick={() => removeLang(l.code)} title="Remove" style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Quick-add presets */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Quick-add preset language:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PRESETS.filter(p => !langs.find(l => l.code === p.code)).map(p => (
                  <button key={p.code} onClick={() => addPreset(p)} disabled={saving}
                    style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid #0891b2', background: '#ecfeff', color: '#0e7490', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    + {p.label} ({p.code})
                  </button>
                ))}
                {PRESETS.every(p => langs.find(l => l.code === p.code)) && (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>All presets added.</span>
                )}
              </div>
            </div>

            {/* Add custom */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Add custom language:</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0, flex: '0 0 80px' }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Code (e.g. fr)</label>
                  <input className="form-control" value={newCode} onChange={e => setNewCode(e.target.value)}
                    placeholder="fr" maxLength={5} style={{ textTransform: 'lowercase' }} />
                </div>
                <div className="form-group" style={{ margin: 0, flex: 1 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Label (e.g. French)</label>
                  <input className="form-control" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                    placeholder="French" onKeyDown={e => e.key === 'Enter' && addCustom()} />
                </div>
                <button className="btn btn-primary" style={{ fontSize: 12, padding: '7px 14px', whiteSpace: 'nowrap' }}
                  onClick={addCustom} disabled={saving}>
                  <Plus size={13} /> Add
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
