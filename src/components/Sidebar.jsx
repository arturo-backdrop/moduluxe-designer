import React, { useState, useEffect, useRef } from 'react';
import styles from './Sidebar.module.css';

// ── Tool definitions ──────────────────────────────────────────
const TOOLS = [
  {
    id: 'select', label: 'Select', dividerAfter: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 3l14 9-7 1-4 7z"/>
      </svg>
    ),
  },
  {
    id: 'wall', label: 'Wall',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20V7l7-4v17M11 7l9 4v9"/>
      </svg>
    ),
  },
  {
    id: 'column', label: 'Column',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="3" width="8" height="18" rx="2"/>
      </svg>
    ),
  },
  {
    id: 'door', label: 'Door',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2"/>
        <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: 'measure', label: 'Measure',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h16M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3"/>
      </svg>
    ),
  },
];

// ── Thumbnail placeholder ─────────────────────────────────────
function ThumbPlaceholder() {
  return (
    <div className={styles.thumbPlaceholder}>
      <svg width="18" height="26" viewBox="0 0 18 26" fill="none">
        <rect x="1" y="1" width="16" height="24" rx="3" stroke="#bbb" strokeWidth="1.2"/>
        <line x1="4" y1="8"  x2="14" y2="8"  stroke="#bbb" strokeWidth="1"/>
        <line x1="4" y1="13" x2="14" y2="13" stroke="#bbb" strokeWidth="1"/>
      </svg>
    </div>
  );
}

// ── Product item ──────────────────────────────────────────────
function ProductItem({ item, onDragStart }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`${styles.productItem} ${hovered ? styles.productItemHovered : ''}`}
      draggable
      onDragStart={() => onDragStart(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {item.thumbnail
        ? <img src={item.thumbnail} alt={item.name} className={styles.thumbImg} />
        : <ThumbPlaceholder />
      }
      <div className={styles.productInfo}>
        <div className={styles.productName}>{item.name}</div>
        <div className={styles.productDims}>{item.dims || item.category}</div>
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

// ── Sidebar main ──────────────────────────────────────────────
export default function Sidebar({ config, mode, activeTool, onToolChange, onAddProduct }) {
  const [catalog,   setCatalog]   = useState({});
  const [activeTab, setActiveTab] = useState(null);
  const [loading,   setLoading]   = useState(true);

  // Load manifest
  useEffect(() => {
    if (!config.manifestUrl) { setLoading(false); return; }
    fetch(config.manifestUrl)
      .then(r => r.json())
      .then(data => {
        // Group by category
        const items = Array.isArray(data) ? data : data.models || [];
        const grouped = {};
        items.forEach(item => {
          const cat = item.category || 'Other';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(item);
        });
        setCatalog(grouped);
        setActiveTab(Object.keys(grouped)[0] || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [config.manifestUrl]);

  const tabs = Object.keys(catalog);

  function handleDragStart(item) {
    // Will connect to Three.js drag in Viewport
    onAddProduct(item.id);
  }

  const showCatalog = mode === 'place';

  return (
    <div className={`${styles.sidebarWrap} ${showCatalog ? styles.visible : styles.hidden}`}
      style={{ pointerEvents: 'all' }}>

      {/* ── Panel ── */}
      <div className={styles.panel}>
        {/* Logo */}
        <div className={styles.logoHeader}>
          <img src="/moduluxe-designer/backdrop-logo-inverse.png" alt="backdrop.com" className={styles.logo} />
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <div className={styles.tabs}>
            {tabs.map(tab => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Product list */}
        <div className={styles.productList}>
          {loading && (
            <div className={styles.emptyState}>Loading catalog...</div>
          )}
          {!loading && tabs.length === 0 && (
            <div className={styles.emptyState}>No products available.</div>
          )}
          {!loading && activeTab && (catalog[activeTab] || []).map(item => (
            <ProductItem
              key={item.id}
              item={item}
              onDragStart={handleDragStart}
            />
          ))}
        </div>
      </div>

      {/* ── Right column: Zoom + Toolbar ── */}
      <div className={styles.rightCol}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          {TOOLS.map(tool => (
            <React.Fragment key={tool.id}>
              <button
                className={`${styles.toolBtn} ${activeTool === tool.id ? styles.toolBtnActive : ''}`}
                onClick={() => onToolChange(tool.id)}
                title={tool.label}
              >
                <div className={styles.toolIcon}>{tool.icon}</div>
                <span className={styles.toolLabel}>{tool.label}</span>
              </button>
              {tool.dividerAfter && <div className={styles.toolDivider} />}
            </React.Fragment>
          ))}
        </div>

        {/* Zoom */}
        <div className={styles.zoomWrap}>
          <button className={styles.zoomBtn} title="Zoom in"
            onClick={() => window.dispatchEvent(new CustomEvent('viewport:zoom', { detail: 1 }))}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <div className={styles.zoomDivider} />
          <button className={styles.zoomBtn} title="Zoom out"
            onClick={() => window.dispatchEvent(new CustomEvent('viewport:zoom', { detail: -1 }))}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
