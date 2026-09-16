import React, { useState, useEffect, useRef } from 'react';

const INDUSTRIES = [
  'Technology', 'Healthcare & Medical', 'Food & Beverage',
  'Manufacturing & Industrial', 'Construction', 'Retail & Fashion',
  'Automotive', 'Finance & Banking', 'Gaming', 'Education',
  'Government & Defense', 'Toy Industry',
];

const STORAGE_KEY = 'airender_form';

const btnBase = {
  fontFamily: "'Figtree', sans-serif", fontSize: '0.875rem',
  fontWeight: 500, border: 'none', borderRadius: '0.75rem',
  cursor: 'pointer', transition: 'background 0.15s',
};

function ColorSwatch({ label, value, onChange, optional }) {
  const inputRef = useRef(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
      <label style={{ fontSize: '0.6875rem', color: '#888', fontWeight: 500 }}>
        {label}{optional && <span style={{ color: '#ccc' }}> (optional)</span>}
      </label>
      <div onClick={() => inputRef.current?.click()} style={{
        width: '100%', height: '2.25rem', borderRadius: '0.625rem',
        background: value || '#eeeeee', border: '1.5px solid #f0f0f0',
        cursor: 'pointer', boxSizing: 'border-box',
      }} />
      <input ref={inputRef} type="color" value={value || '#ffffff'}
        onChange={e => onChange(e.target.value)} style={{ display: 'none' }} />
    </div>
  );
}

function UploadButton({ label, accept, file, onChange, optional }) {
  const inputRef = useRef(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <label style={{ fontSize: '0.6875rem', color: '#888', fontWeight: 500 }}>
        {label}{optional && <span style={{ color: '#ccc' }}> (optional)</span>}
      </label>
      <div onClick={() => inputRef.current?.click()} style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        background: '#fafafa', border: '1.5px dashed #e0e0e0',
        borderRadius: '0.625rem', padding: '0.5rem 0.75rem',
        cursor: 'pointer', fontSize: '0.8125rem',
        color: file ? '#1a1a1a' : '#bbb',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file ? file.name : 'Upload file'}
        </span>
      </div>
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }}
        onChange={e => onChange(e.target.files[0] || null)} />
    </div>
  );
}

export default function AIRenderModal({ captureDataUrl, onClose, onGenerate, onRecapture }) {
  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {
        company: '', industry: INDUSTRIES[0],
        primary: '#1a1a1a', secondary: '#b48b31', tertiary: '',
      };
    } catch {
      return { company: '', industry: INDUSTRIES[0], primary: '#1a1a1a', secondary: '#b48b31', tertiary: '' };
    }
  });
  const [logo, setLogo]           = useState(null);
  const [refImage, setRefImage]   = useState(null);
  const [brandMode, setBrandMode] = useState('colors'); // 'colors' | 'reference'

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(form)); } catch {}
  }, [form]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const canSubmit = form.company.trim() && form.industry;

  const inputStyle = {
    fontFamily: "'Figtree', sans-serif", fontSize: '0.875rem',
    color: '#1a1a1a', background: '#fafafa',
    border: '1.5px solid #f0f0f0', borderRadius: '0.625rem',
    padding: '0.575rem 0.75rem', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', pointerEvents: 'all',
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: '1.25rem',
        width: 'min(36rem, 95vw)',
        maxHeight: '92vh',
        boxShadow: '0 1.5rem 5rem rgba(0,0,0,0.2)',
        overflowY: 'auto',
        overflowX: 'hidden',
      }} onClick={e => e.stopPropagation()}>

        {/* Capture preview — 4:3 aspect ratio */}
        {captureDataUrl && (
          <div style={{ width: '100%', aspectRatio: '4/3', background: '#f0f0f0', position: 'relative', overflow: 'hidden' }}>
            {/* Re-capture button */}
            <button onClick={onRecapture} style={{
              position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 2,
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
              color: 'white', border: 'none', borderRadius: '0.625rem',
              padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 500,
              fontFamily: "'Figtree', sans-serif", cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.35rem',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.63"/>
              </svg>
              Re-capture
            </button>
            <img src={captureDataUrl} alt="Booth capture"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, transparent 75%, white 100%)',
              pointerEvents: 'none',
            }} />
          </div>
        )}

        {/* Form */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Title */}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.125rem', color: '#1a1a1a' }}>Get a branded AI render</div>
            <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.2rem' }}>
              Fill in your brand details to generate a photorealistic render
            </div>
          </div>

          {/* Company + Industry */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.6875rem', color: '#888', fontWeight: 500 }}>
                Company name <span style={{ color: '#b48b31' }}>*</span>
              </label>
              <input type="text" placeholder="Acme Corp" value={form.company}
                onChange={e => set('company', e.target.value)} style={inputStyle}
                onFocus={e => e.target.style.borderColor='#b48b31'}
                onBlur={e => e.target.style.borderColor='#f0f0f0'} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.6875rem', color: '#888', fontWeight: 500 }}>
                Industry <span style={{ color: '#b48b31' }}>*</span>
              </label>
              <select value={form.industry} onChange={e => set('industry', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>
          </div>

          {/* Brand identity toggle */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.6875rem', color: '#888', fontWeight: 500 }}>Brand identity</span>
              {/* Toggle pill */}
              <div style={{
                display: 'flex', background: '#f0f0f0', borderRadius: '0.5rem',
                padding: '0.2rem', gap: '0.2rem',
              }}>
                {[['colors','Brand colors'],['reference','Reference image']].map(([key, label]) => (
                  <button key={key} onClick={() => setBrandMode(key)} style={{
                    ...btnBase, fontSize: '0.75rem', padding: '0.25rem 0.625rem',
                    background: brandMode === key ? 'white' : 'transparent',
                    color: brandMode === key ? '#1a1a1a' : '#999',
                    boxShadow: brandMode === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    borderRadius: '0.35rem',
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {brandMode === 'colors' ? (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <ColorSwatch label="Primary" value={form.primary} onChange={v => set('primary', v)} />
                <ColorSwatch label="Secondary" value={form.secondary} onChange={v => set('secondary', v)} />
                <ColorSwatch label="Tertiary" value={form.tertiary} onChange={v => set('tertiary', v)} optional />
              </div>
            ) : (
              <UploadButton
                label="Reference image"
                accept="image/png,image/webp,image/jpeg"
                file={refImage}
                onChange={setRefImage}
              />
            )}
          </div>

          {/* Uploads */}
          <UploadButton label="Company logo" accept="image/png,image/webp,image/svg+xml"
            file={logo} onChange={setLogo} />

          {/* Footer */}
          <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.25rem' }}>
            <button onClick={onClose} style={{ ...btnBase, padding: '0.7rem 1.25rem', background: '#f5f5f5', color: '#666' }}>
              Cancel
            </button>
            <button
              onClick={() => canSubmit && onGenerate({ form, logo, refImage, brandMode, captureDataUrl })}
              disabled={!canSubmit}
              style={{ ...btnBase, flex: 1, padding: '0.7rem',
                background: canSubmit ? '#b48b31' : '#e0e0e0',
                color: canSubmit ? 'white' : '#aaa',
                cursor: canSubmit ? 'pointer' : 'default',
              }}>
              Generate AI render
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
