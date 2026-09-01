import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './Sidebar.module.css';
import { toDisplay } from '../units.js';

const CATEGORY_ICONS = {
  'Panels':     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/></svg>,
  'Counters':   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="13" width="20" height="8" rx="2"/><path d="M6 13V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6"/></svg>,
  'Consoles':   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="15" width="20" height="6" rx="2"/><path d="M6 15v-3a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"/><line x1="12" y1="10" x2="12" y2="6"/><line x1="9" y1="6" x2="15" y2="6"/></svg>,
  'Headers':    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="7" rx="2"/><line x1="2" y1="15" x2="22" y2="15"/><line x1="6" y1="19" x2="18" y2="19"/></svg>,
  'Doors':      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/></svg>,
  'Storage':    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="5" rx="1"/><rect x="2" y="11" width="20" height="5" rx="1"/><rect x="2" y="18" width="20" height="4" rx="1"/></svg>,
  'Shelving':   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><line x1="5" y1="6" x2="5" y2="18"/><line x1="19" y1="6" x2="19" y2="18"/></svg>,
  'Multimedia': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  'Woodline':   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C7 2 3 6 3 11c0 3 1.5 5.5 4 7v2h10v-2c2.5-1.5 4-4 4-7 0-5-4-9-9-9z"/><line x1="9" y1="20" x2="15" y2="20"/></svg>,
  'Props':      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="4"/><path d="M12.5 5.5L19 3l-2.5 6.5"/><path d="M9 13v8"/><line x1="6" y1="21" x2="12" y2="21"/></svg>,
  'Presets':    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  'default':    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"><circle cx="12" cy="12" r="10"/></svg>,
};

const Icons = {
  select: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-7 1-4 7z"/></svg>,
  wall: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V7l7-4v17M11 7l9 4v9"/></svg>,
  column: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="3" width="8" height="18" rx="2"/></svg>,
  door: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/></svg>,
  zoomIn: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  zoomOut: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
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
      <svg width="28" height="36" viewBox="0 0 18 26" fill="none">
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
      <div className={styles.cardThumb}>
        {item.thumbnail
          ? <img src={item.thumbnail} alt={item.name} className={styles.cardThumbImg} />
          : <ThumbPlaceholder />}
        <div className={`${styles.dragOverlay} ${hovered ? styles.dragOverlayVisible : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" width="20" height="20">
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>
          </svg>
          <span>drag</span>
        </div>
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.productName}>{item.name}</div>
        <div className={styles.productDims}>
          {item.w && item.d && item.h
            ? `${toDisplay(item.w, units, true)} × ${toDisplay(item.h, units, true)}`
            : item.dims || item.category || ''}
        </div>
      </div>
    </div>
  );
}

function PresetItem({ preset, onLoad }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className={`${styles.productItem} ${hovered ? styles.productItemHovered : ''}`}
      data-tour="presets-tab"
      style={{ cursor:'pointer' }}
      onClick={() => onLoad?.(preset)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div className={styles.cardThumb}>
        {preset.thumbnail
          ? <img src={preset.thumbnail} alt={preset.name} className={styles.cardThumbImg} />
          : <ThumbPlaceholder />}
        <div className={`${styles.dragOverlay} ${hovered ? styles.dragOverlayVisible : ''}`}>
          <span>Load</span>
        </div>
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.productName}>{preset.name}</div>
        <div className={styles.productDims}>{preset.description || `${(preset.items||[]).length} items`}</div>
      </div>
    </div>
  );
}

export default function Sidebar({ config, mode, activeTool, onToolChange, onAddProduct, units='ft', presets=[], onLoadPreset }) {
  const [catalog,    setCatalog]    = useState({});
  const [activeCategory, setActiveCategory] = useState(presets.length > 0 ? '__presets__' : null);
  const [loading,    setLoading]    = useState(true);
  const [logoHeight, setLogoHeight] = useState(76);
  const logoRef  = useRef(null);
  const navColRef = useRef(null);
  const sliderRef = useRef(null);
  const btnRefs   = useRef({});
  const animRef   = useRef(null);
  const fromRef   = useRef({ y: null, h: null });
  const isPlace = mode === 'place';

  // Liquid slider animation
  const getMetrics = useCallback((id) => {
    const btn = btnRefs.current[id];
    const col = navColRef.current;
    if (!btn || !col) return null;
    const cTop = col.getBoundingClientRect().top;
    const r    = btn.getBoundingClientRect();
    return { y: r.top - cTop, h: r.height };
  }, []);

  useEffect(() => {
    if (!activeCategory || !sliderRef.current) return;
    const m = getMetrics(activeCategory);
    if (!m) return;
    if (fromRef.current.y === null) {
      sliderRef.current.style.transition = 'none';
      sliderRef.current.style.height     = m.h + 'px';
      sliderRef.current.style.transform  = `translateY(${m.y}px)`;
      fromRef.current = m;
      return;
    }
    const { y: fy, h: fh } = fromRef.current;
    const stretch  = fh + Math.abs(m.y - fy) * 0.6;
    const stretchY = Math.min(fy, m.y);
    sliderRef.current.style.transition = 'transform 0.2s cubic-bezier(0.4,0,0.6,1), height 0.2s cubic-bezier(0.4,0,0.6,1)';
    sliderRef.current.style.height     = stretch + 'px';
    sliderRef.current.style.transform  = `translateY(${stretchY}px)`;
    clearTimeout(animRef.current);
    animRef.current = setTimeout(() => {
      if (!sliderRef.current) return;
      sliderRef.current.style.transition = 'transform 0.28s cubic-bezier(0.34,1.15,0.64,1), height 0.28s cubic-bezier(0.34,1.15,0.64,1)';
      sliderRef.current.style.height     = m.h + 'px';
      sliderRef.current.style.transform  = `translateY(${m.y}px)`;
      fromRef.current = m;
    }, 180);
  }, [activeCategory, getMetrics]);

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

  // Build nav items: presets first, then categories
  const navItems = [
    ...(presets.length > 0 ? [{ id: '__presets__', label: 'Presets', icon: CATEGORY_ICONS['Presets'] }] : []),
    ...Object.keys(catalog).map(cat => ({ id: cat, label: cat, icon: CATEGORY_ICONS[cat] || CATEGORY_ICONS['default'] })),
  ];

  const activeItems = activeCategory === '__presets__'
    ? presets
    : (catalog[activeCategory] || []);

  return (
    <div className={styles.sidebarWrap} style={{ pointerEvents: 'all' }}>

      {/* ── Panel ── */}
      <div className={`${styles.panel} ${isPlace ? styles.panelVisible : styles.panelHidden}`}>
        {/* Logo */}
        <div className={styles.logoHeader} ref={logoRef}>
          <img src="/moduluxe-designer/backdrop-logo-inverse.png" alt="backdrop.com" className={styles.logo} />
        </div>

        {/* Two-column layout */}
        <div className={styles.twoCol}>
          {/* Left nav */}
          <div className={styles.navCol} ref={navColRef} style={{ position:'relative' }}>
            {/* Liquid slider */}
            {activeCategory && (
              <div ref={sliderRef} className={styles.navSlider} />
            )}
            {navItems.map(nav => (
              <button
                key={nav.id}
                ref={el => { btnRefs.current[nav.id] = el; }}
                data-tour={nav.id === '__presets__' ? 'presets-tab' : undefined}
                className={`${styles.navBtn} ${activeCategory === nav.id ? styles.navBtnActive : ''}`}
                onClick={() => {
                  if (activeCategory === nav.id) {
                    setActiveCategory(null);
                    fromRef.current = { y: null, h: null };
                  } else {
                    setActiveCategory(nav.id);
                  }
                }}
                title={nav.label}>
                <div className={styles.navIcon}>{nav.icon}</div>
                <span className={styles.navLabel}>{nav.label}</span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className={styles.navDivider} />

          {/* Right product list */}
          <div className={styles.productList}>
            {loading && <div className={styles.emptyState}>Loading...</div>}
            {!loading && !activeCategory && (
              <div className={styles.emptyState}>Select a category</div>
            )}
            {!loading && activeCategory === '__presets__' && presets.map(preset => (
              <PresetItem key={preset.id} preset={preset} onLoad={onLoadPreset} />
            ))}
            {!loading && activeCategory && activeCategory !== '__presets__' && (catalog[activeCategory] || []).map(item => (
              <ProductItem key={item.id} item={item} units={units} />
            ))}
          </div>
        </div>
      </div>

      

    </div>
  );
}
