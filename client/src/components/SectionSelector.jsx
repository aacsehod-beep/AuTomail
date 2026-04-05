import { Check } from 'lucide-react';

export default function SectionSelector({ sections, selected, onChange }) {
  const all = selected.length === sections.length;

  function toggle(sec) {
    onChange(selected.includes(sec) ? selected.filter(s => s !== sec) : [...selected, sec]);
  }

  function toggleAll() {
    onChange(all ? [] : [...sections]);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span className="form-label">Sections ({selected.length} / {sections.length} selected)</span>
        <button className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }} onClick={toggleAll}>
          {all ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {sections.map(s => (
          <div key={s} className={`sec-tag ${selected.includes(s) ? 'selected' : ''}`} onClick={() => toggle(s)}>
            {selected.includes(s) && <Check size={11} />}{s}
          </div>
        ))}
        {sections.length === 0 && (
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Upload a file to see sections</span>
        )}
      </div>
    </div>
  );
}
