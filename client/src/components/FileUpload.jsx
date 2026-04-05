import { useState, useRef } from 'react';
import { FolderOpen, CheckCircle2 } from 'lucide-react';

export default function FileUpload({ onFile, accept = '.xlsx,.xls,.csv', label = 'Upload Spreadsheet' }) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef();

  function handle(file) {
    if (!file) return;
    setFileName(file.name);
    onFile(file);
  }

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${dragging ? '#2563eb' : '#cbd5e1'}`,
        borderRadius: 10, padding: '28px 20px', textAlign: 'center',
        cursor: 'pointer', background: dragging ? '#eff6ff' : '#f8fafc',
        transition: 'all 0.15s',
      }}
    >
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }}
        onChange={e => handle(e.target.files[0])} />
      <div style={{ fontSize: 28, marginBottom: 8, display: 'flex', justifyContent: 'center' }}><FolderOpen size={32} color="#94a3b8" /></div>
      {fileName
        ? <div style={{ fontWeight: 600, color: '#1e3a8a', display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={16} color="#16a34a" /> {fileName}</div>
        : <>
            <div style={{ fontWeight: 600, color: '#374151' }}>{label}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              Click or drag & drop · .xlsx, .xls, .csv
            </div>
          </>
      }
    </div>
  );
}
