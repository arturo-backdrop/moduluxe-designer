import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './BottomBar.module.css';

// ── Config ────────────────────────────────────────────────────
const BAR_TITLE = 'Your build'; // exposed here for easy change
const CARD_W    = 165;          // card width + gap in px

// ── Thumbnail placeholder ─────────────────────────────────────
function ThumbPlaceholder() {
  return (
    <div className={styles.cardThumb}>
      <svg width="18" height="26" viewBox="0 0 18 26" fill="none">
        <rect x="1" y="1" width="16" height="24" rx="3" stroke="#bbb" strokeWidth="1.2"/>
        <line x1="4" y1="8"  x2="14" y2="8"  stroke="#bbb" strokeWidth="1"/>
        <line x1="4" y1="13" x2="14" y2="13" stroke="#bbb" strokeWidth="1"/>
      </svg>
    </div>
  );
}

// ── Product card ──────────────────────────────────────────────
function ProductCard({ item, modelData, selected, onClick }) {
  return (
    <div
      className={`${styles.productCard} ${selected ? styles.productCardSelected : ''}`}
      onClick={onClick}
    >
      {modelData?.thumbnail
        ? <img src={modelData.thumbnail} alt={modelData.name} className={styles.cardThumbImg} />
        : <ThumbPlaceholder />
      }
      <div className={styles.cardInfo}>
        <div className={styles.cardName}>{modelData?.name || item.modelId}</div>
        <div className={styles.cardDims}>{modelData?.dims || modelData?.category || ''}</div>
      </div>
      <div className={styles.cardCount}>x{item.count}</div>
    </div>
  );
}

// ── BottomBar ─────────────────────────────────────────────────
export default function BottomBar({ config, sceneItems, catalog, onSelectModel, offsetLeft = 352 }) {
  const [selectedId,   setSelectedId]   = useState(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const viewportRef = useRef(null);
  const trackRef    = useRef(null);

  // One chip per model type — exclude array clones (source item count already = 1 per physical object)
  const WALL_TYPES = new Set(['wall','column','door']);
  const groupedItems = React.useMemo(() => {
    const map = new Map();
    sceneItems.forEach(item => {
      if (item.isArrayClone) return;
      if (WALL_TYPES.has(item.type)) return; // exclude layout items
      if (catalog?.[item.modelId]?.category === 'Props') return; // exclude props
      const c = item.count || 1;
      if (map.has(item.modelId)) {
        map.get(item.modelId).count += c;
      } else {
        map.set(item.modelId, { modelId: item.modelId, count: c });
      }
    });
    // Add clone counts
    sceneItems.forEach(item => {
      if (!item.isArrayClone) return;
      if (map.has(item.modelId)) {
        map.get(item.modelId).count += 1;
      }
    });
    return Array.from(map.values());
  }, [sceneItems]);

  // Aggregate active accessories across all scene items
  const accessoryPills = React.useMemo(() => {
    const accMap = new Map(); // label -> total count
    // Only iterate sources (non-clones) and multiply by group size
    sceneItems.forEach(item => {
      if (WALL_TYPES.has(item.type)) return;
      if (item.isArrayClone) return;
      if (!item.socketStates) return;
      const def = catalog?.[item.modelId];
      // How many physical units does this source represent (1 + its clones)
      const groupSize = item.groupId
        ? sceneItems.filter(i => i.groupId === item.groupId).length
        : 1;
      (def?.sockets || []).forEach(s => {
        const state = item.socketStates?.[s.name];
        if (!state) return;
        let qty = 0;
        if (s.behavior === 'fixed' && state.on) qty = 1;
        else if (s.behavior === 'distribute' && state.count > 0) qty = state.count;
        else if (s.behavior === 'positions' && state.positionIndex >= 0) qty = 1;
        if (qty > 0) {
          const label = s.label || s.name;
          accMap.set(label, (accMap.get(label) || 0) + qty * groupSize);
        }
      });
    });
    return Array.from(accMap.entries()).map(([label, count]) => ({ label, count }));
  }, [sceneItems, catalog]);

  // Reset selection when items change
  useEffect(() => {
    if (sceneItems.length === 0) setSelectedId(null);
  }, [sceneItems]);

  // ── Scroll helpers ───────────────────────────────────────────
  const viewportWidth = useCallback(() =>
    viewportRef.current?.offsetWidth || 0, []);

  const maxOffset = useCallback(() =>
    Math.max(0, groupedItems.length * CARD_W - viewportWidth()), [groupedItems.length, viewportWidth]);

  const shiftScroll = useCallback((dir) => {
    setScrollOffset(prev => {
      const next = prev + dir * CARD_W;
      return Math.max(0, Math.min(maxOffset(), next));
    });
  }, [maxOffset]);

  // Auto-scroll to newly added model type
  useEffect(() => {
    if (groupedItems.length === 0) return;
    const lastIdx    = groupedItems.length - 1;
    const cardOffset = lastIdx * CARD_W;
    const vw         = viewportWidth();
    if (cardOffset + CARD_W > scrollOffset + vw) {
      setScrollOffset(Math.max(0, cardOffset + CARD_W - vw));
    }
  }, [groupedItems.length]);

  // Apply scroll to track
  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(-${scrollOffset}px)`;
    }
  }, [scrollOffset]);

  const canScrollLeft  = scrollOffset > 0;
  const canScrollRight = scrollOffset < maxOffset();

  // ── Select ───────────────────────────────────────────────────
  function handleSelect(modelId) {
    const next = selectedId === modelId ? null : modelId;
    setSelectedId(next);
    onSelectModel?.(next);
  }

  return (
    <div className={styles.bottomBar} style={{ pointerEvents: 'all', left: offsetLeft }} data-tour="bottom-bar">
      <div className={styles.barTitle}>{BAR_TITLE}</div>

      <div className={styles.scrollRow}>
        <button
          className={`${styles.arrowBtn} ${!canScrollLeft ? styles.arrowDisabled : ''}`}
          onClick={() => shiftScroll(-1)}
          disabled={!canScrollLeft}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div className={styles.cardsViewport} ref={viewportRef}>
          {groupedItems.length === 0 ? (
            <div className={styles.emptyMsg}>
              Drag products from the catalog to start building your booth
            </div>
          ) : (
            <div className={styles.cardsTrack} ref={trackRef}>
              {groupedItems.map(item => (
                <ProductCard
                  key={item.modelId}
                  item={item}
                  modelData={catalog?.[item.modelId]}
                  selected={selectedId === item.modelId}
                  onClick={() => handleSelect(item.modelId)}
                />
              ))}
              {accessoryPills.map(({ label, count }) => (
                <div key={label} className={styles.productCard} style={{opacity:0.85}}>
                  <div className={styles.cardThumb}>
                    <svg width="18" height="26" viewBox="0 0 18 26" fill="none">
                      <rect x="1" y="1" width="16" height="24" rx="3" stroke="#b48b31" strokeWidth="1.2"/>
                      <line x1="4" y1="10" x2="14" y2="10" stroke="#b48b31" strokeWidth="1.5"/>
                      <line x1="4" y1="16" x2="14" y2="16" stroke="#b48b31" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <div className={styles.cardInfo}>
                    <div className={styles.cardName}>{label}</div>
                    <div className={styles.cardDims}>Accessory</div>
                  </div>
                  <div className={styles.cardCount}>x{count}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          className={`${styles.arrowBtn} ${!canScrollRight ? styles.arrowDisabled : ''}`}
          onClick={() => shiftScroll(1)}
          disabled={!canScrollRight}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}







