import React, { useState, useEffect } from 'react';
import styles from './BottomBar.module.css';

const BAR_TITLE = 'Your products';
const WALL_TYPES = new Set(['wall','column','door']);

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

function ProductCard({ item, modelData, selected, onClick }) {
  return (
    <div
      className={`${styles.productCard} ${selected ? styles.productCardSelected : ''}`}
      onClick={onClick}
    >
      {modelData?.thumbnail
        ? <img src={modelData.thumbnail} alt={modelData.name} className={styles.cardThumbImg} />
        : <ThumbPlaceholder />}
      <div className={styles.cardInfo}>
        <div className={styles.cardName}>{modelData?.name || item.modelId}</div>
        <div className={styles.cardDims}>{modelData?.dims || modelData?.category || ''}</div>
      </div>
      <div className={styles.cardCount}>x{item.count}</div>
    </div>
  );
}

export default function BottomBar({ config, sceneItems, catalog, onSelectModel }) {
  const [selectedId, setSelectedId] = useState(null);

  const groupedItems = React.useMemo(() => {
    const map = new Map();
    sceneItems.forEach(item => {
      if (item.isArrayClone) return;
      if (WALL_TYPES.has(item.type)) return;
      if (catalog?.[item.modelId]?.category === 'Props') return;
      const c = item.count || 1;
      if (map.has(item.modelId)) {
        map.get(item.modelId).count += c;
      } else {
        map.set(item.modelId, { modelId: item.modelId, count: c });
      }
    });
    sceneItems.forEach(item => {
      if (!item.isArrayClone) return;
      if (map.has(item.modelId)) map.get(item.modelId).count += 1;
    });
    return Array.from(map.values());
  }, [sceneItems]);

  const accessoryPills = React.useMemo(() => {
    const accMap = new Map();
    sceneItems.forEach(item => {
      if (WALL_TYPES.has(item.type) || item.isArrayClone || !item.socketStates) return;
      const def = catalog?.[item.modelId];
      const groupSize = (item.groupId && !item.isPresetGroup)
        ? sceneItems.filter(i => i.groupId === item.groupId).length : 1;
      const seenSocketNames = new Set();
      (def?.sockets || []).forEach(s => {
        if (seenSocketNames.has(s.name)) return;
        seenSocketNames.add(s.name);
        let qty = 0;
        if (s.behavior === 'fixed') {
          // Count all indexed states: socket_lamp, socket_lamp_0, socket_lamp_1, etc.
          const indexedStates = Object.entries(item.socketStates || {})
            .filter(([k]) => k === s.name || k.startsWith(s.name + '_'))
            .map(([, v]) => v);
          qty = indexedStates.filter(v => v?.on).length;
        } else if (s.behavior === 'distribute') {
          const state = item.socketStates?.[s.name];
          if (state?.count > 0) qty = state.count;
        } else if (s.behavior === 'positions') {
          const state = item.socketStates?.[s.name];
          if (state?.positionIndex >= 0) qty = 1;
        }
        if (qty > 0) {
          const label = s.label || s.name;
          accMap.set(label, (accMap.get(label) || 0) + qty * groupSize);
        }
      });
    });
    return Array.from(accMap.entries()).map(([label, count]) => ({ label, count }));
  }, [sceneItems, catalog]);

  useEffect(() => {
    if (sceneItems.length === 0) setSelectedId(null);
  }, [sceneItems]);

  function handleSelect(modelId) {
    const next = selectedId === modelId ? null : modelId;
    setSelectedId(next);
    onSelectModel?.(next);
  }

  return (
    <div className={styles.bottomBar} data-tour="bottom-bar">
      <div className={styles.barTitle}>{BAR_TITLE}</div>
      <div className={styles.list}>
        {groupedItems.length === 0 ? (
          <div className={styles.emptyMsg}>
            Drag products from the catalog to start building
          </div>
        ) : (
          <>
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
              <div key={label} className={styles.productCard} style={{ opacity: 0.85 }}>
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
          </>
        )}
      </div>
    </div>
  );
}
