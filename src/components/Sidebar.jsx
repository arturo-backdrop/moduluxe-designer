import React, { useState, useEffect, useRef } from 'react';
import styles from './Sidebar.module.css';
import { toDisplay } from '../units.js';

const Icons = {
  select: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-7 1-4 7z"/></svg>,
  wall: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V7l7-4v17M11 7l9 4v9"/></svg>,
  column: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="3" width="8" height="18" rx="2"/></svg>,
  door: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/></svg>,
  zoomIn: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  zoomOut: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  chevDown: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
};

function ToolBtn({ id, label, icon, active, onClick }) {
  return (
    <button className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`}
      onClick={() => onClick(id)} title={label}>
      <div className={styles.toolIcon}>{icon}</div>
      <span className={styles.toolLabel}>{label}</span>
    </button>
  );
}

function ThumbPlaceholder() {
  return (
    <div className={styles.thumbPlaceholder}>
      <svg width="18" height="26" viewBox="0 0 18 26" fill="none">
        <rect x="1" y="1" width="16" height="24" rx="3" stroke="#bbb" strokeWidth="1.2"/>
        <line x1="4" y1="8" x2="14" y2="8" stroke="#bbb" strokeWidth="1"/>
        <line x1="4" y1="13" x2="14" y2="13" stroke="#bbb" strokeWidth="1"/>
      </svg>
    </div>
  );
}

function ProductItem({ item, units='ft' }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className={`${styles.productItem} ${hovered ? styles.productItemHovered : ''}`}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('modelId', item.id);
        window.__dragModelId = item.id;
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);
      }}
      onDragEnd={() => { window.__dragModelId = null; }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      {item.thumbnail
        ? <img src={item.thumbnail} alt={item.name} className={styles.thumbImg} />
        : <ThumbPlaceholder />}
      <div className={styles.productInfo}>
        <div className={styles.productName}>{item.name}</div>
        <div className={styles.productDims}>
          {item.w && item.d && item.h
            ? `${toDisplay(item.w, units, true)} × ${toDisplay(item.d, units, true)} × ${toDisplay(item.h, units, true)}`
            : item.dims || item.category || ''}
        </div>
      </div>
      <div className={`${styles.dragLabel} ${hovered ? styles.dragLabelVisible : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>
        </svg>
        drag
      </div>
    </div>
  );
}

function Section({ title, badge, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.section}>
      <button className={styles.sectionHeader} onClick={() => setOpen(v => !v)}>
        <div className={styles.sectionLeft}>
          <span className={styles.sectionTitle}>{title}</span>
          {badge != null && <span className={styles.sectionBadge}>{badge}</span>}
        </div>
        <div className={styles.sectionChevron} style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          {Icons.chevDown}
        </div>
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

export default function Sidebar({ config, mode, activeTool, onToolChange, onAddProduct, units='ft', presets=[], onLoadPreset }) {
  const [catalog,    setCatalog]    = useState({});
  const [loading,    setLoading]    = useState(true);
  const [logoHeight, setLogoHeight] = useState(76);
  const logoRef = useRef(null);
  const isPlace = mode === 'place';

  useEffect(() => {
    if (!logoRef.current) return;
    const ro = new ResizeObserver(entries => setLogoHeight(entries[0].contentRect.height));
    ro.observe(logoRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!config.manifestUrl) { setLoading(false); return; }
    fetch(config.manifestUrl)
      .then(r => r.json())
      .then(data => {
        const items = Array.isArray(data) ? data : (data.models || []);
        const grouped = {};
        items.forEach(item => {
          if (item.type === 'preset') return;
          if (item.category === 'Accessory' || item.category === 'accessory') return;
          const cat = item.category || 'Other';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(item);
        });
        setCatalog(grouped);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [config.manifestUrl]);

  const tabs = Object.keys(catalog);

  return (
    <div className={styles.sidebarWrap} style={{ pointerEvents: 'all' }}>

      {/* ── Panel ── */}
      <div className={`${styles.panel} ${isPlace ? styles.panelVisible : styles.panelHidden}`}>
        <div className={styles.logoHeader} ref={logoRef}>
          <img src="/moduluxe-designer/backdrop-logo-inverse.png" alt="backdrop.com" className={styles.logo} />
        </div>

        <div className={styles.productList}>
          {loading && <div className={styles.emptyState}>Loading catalog...</div>}

          {!loading && presets.length > 0 && (
            <Section title="Presets" defaultOpen={true}>
              {presets.map(preset => (
                <div key={preset.id} className={styles.productItem} style={{ cursor:'pointer' }}
                  data-tour="presets-tab"
                  onClick={() => onLoadPreset?.(preset)}>
                  {preset.thumbnail
                    ? <img src={preset.thumbnail} alt={preset.name} className={styles.thumbImg} />
                    : <ThumbPlaceholder />}
                  <div className={styles.productInfo}>
                    <div className={styles.productName}>{preset.name}</div>
                    <div className={styles.productDims}>{preset.description || `${(preset.items||[]).length} items`}</div>
                  </div>
                  <div className={styles.dragLabel} style={{ opacity:1, fontSize:10, padding:'4px 8px' }}>Load</div>
                </div>
              ))}
            </Section>
          )}

          {!loading && tabs.map((cat, idx) => (
            <Section key={cat} title={cat} defaultOpen={idx === 0}>
              {(catalog[cat] || []).map(item => (
                <ProductItem key={item.id} item={item} units={units} />
              ))}
            </Section>
          ))}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className={styles.rightCol} style={{ paddingTop: logoHeight + 38 }}>
        <div className={styles.zoomWrap}>
          <button className={styles.zoomBtn} title="Zoom in"
            onClick={() => window.dispatchEvent(new CustomEvent('viewport:zoom', { detail: 1 }))}>
            {Icons.zoomIn}
          </button>
          <div className={styles.zoomDivider} />
          <button className={styles.zoomBtn} title="Zoom out"
            onClick={() => window.dispatchEvent(new CustomEvent('viewport:zoom', { detail: -1 }))}>
            {Icons.zoomOut}
          </button>
        </div>

        <div className={styles.toolsContainer}>
          <ToolBtn id="select" label="Select" icon={Icons.select} active={activeTool==='select'} onClick={onToolChange} />
          <div className={`${styles.drawTools} ${!isPlace ? styles.drawToolsVisible : styles.drawToolsHidden}`}>
            <div className={styles.toolDivider} />
            <ToolBtn id="wall"   label="Wall"   icon={Icons.wall}   active={activeTool==='wall'}   onClick={onToolChange} data-tour="tool-wall" />
            <ToolBtn id="column" label="Column" icon={Icons.column} active={activeTool==='column'} onClick={onToolChange} data-tour="tool-column" />
            <ToolBtn id="door"   label="Door"   icon={Icons.door}   active={activeTool==='door'}   onClick={onToolChange} data-tour="tool-door" />
          </div>
        </div>
      </div>

    </div>
  );
}
