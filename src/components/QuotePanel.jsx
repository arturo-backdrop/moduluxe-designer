import React, { useState } from 'react';
import styles from './QuotePanel.module.css';

const WALL_TYPES = new Set(['wall','column','door']);

function buildLineItems(sceneItems, catalog) {
  // Filter out walls/doors/columns and array clones
  const items = sceneItems.filter(i => !WALL_TYPES.has(i.type) && !i.isArrayClone);

  // Group by modelId — count instances
  const modelGroups = {};
  items.forEach(item => {
    const groupSize = item.groupId
      ? sceneItems.filter(i => i.groupId === item.groupId).length
      : 1;
    if (!modelGroups[item.modelId]) {
      modelGroups[item.modelId] = { item, count: 0, groupSize };
    }
    modelGroups[item.modelId].count += groupSize;
  });

  // Build line items
  return Object.values(modelGroups).map(({ item, count }) => {
    const def = catalog?.[item.modelId];
    const unitPrice = def?.price || 0;
    const total = unitPrice * count;

    // Active accessories
    const accs = [];
    (def?.sockets || []).forEach(s => {
      const state = item.socketStates?.[s.name];
      if (!state) return;
      const accPrice = catalog?.__accessories?.[s.accessoryFile]?.price || 0;
      if (s.behavior === 'fixed' && state.on) {
        accs.push({ label: s.label || s.name, qty: count, unitPrice: accPrice, total: accPrice * count });
      } else if (s.behavior === 'distribute' && state.count > 0) {
        accs.push({ label: s.label || s.name, qty: state.count * count, unitPrice: accPrice, total: accPrice * state.count * count });
      } else if (s.behavior === 'positions' && state.positionIndex >= 0) {
        accs.push({ label: s.label || s.name, qty: count, unitPrice: accPrice, total: accPrice * count });
      }
    });

    return { name: def?.name || item.modelId, count, unitPrice, total, accs };
  });
}

function fmt(n) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function ListModal({ sceneItems, catalog, onClose }) {
  const lines = buildLineItems(sceneItems, catalog);
  const grandTotal = lines.reduce((s, l) => s + l.total + l.accs.reduce((a, acc) => a + acc.total, 0), 0);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Your List</div>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Column headers */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 48px 80px 80px', gap:'0 8px', padding:'0 4px 8px', borderBottom:'1px solid #f0f0f0', marginBottom:8 }}>
          <span style={{ fontSize:10, color:'#aaa', fontWeight:600, textTransform:'uppercase' }}>Item</span>
          <span style={{ fontSize:10, color:'#aaa', fontWeight:600, textTransform:'uppercase', textAlign:'center' }}>Qty</span>
          <span style={{ fontSize:10, color:'#aaa', fontWeight:600, textTransform:'uppercase', textAlign:'right' }}>Unit</span>
          <span style={{ fontSize:10, color:'#aaa', fontWeight:600, textTransform:'uppercase', textAlign:'right' }}>Total</span>
        </div>

        <div className={styles.itemsList}>
          {lines.length === 0 && (
            <div style={{ textAlign:'center', color:'#bbb', fontSize:13, padding:'24px 0' }}>No items in scene</div>
          )}
          {lines.map((line, i) => (
            <div key={i} className={styles.quoteItem}>
              {/* Model row */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 48px 80px 80px', gap:'0 8px', alignItems:'center' }}>
                <span className={styles.quoteItemName}>{line.name}</span>
                <span style={{ textAlign:'center', fontSize:13, color:'#666' }}>{line.count}</span>
                <span style={{ textAlign:'right', fontSize:13, color:'#666' }}>
                  {line.unitPrice > 0 ? fmt(line.unitPrice) : '—'}
                </span>
                <span style={{ textAlign:'right', fontSize:13, fontWeight:600, color: line.total > 0 ? '#1a1a1a' : '#bbb' }}>
                  {line.total > 0 ? fmt(line.total) : '—'}
                </span>
              </div>
              {/* Accessories */}
              {line.accs.map((acc, j) => (
                <div key={j} style={{ display:'grid', gridTemplateColumns:'1fr 48px 80px 80px', gap:'0 8px', alignItems:'center', marginTop:4, paddingLeft:12 }}>
                  <span style={{ fontSize:11, color:'#999' }}>↳ {acc.label}</span>
                  <span style={{ textAlign:'center', fontSize:11, color:'#999' }}>{acc.qty}</span>
                  <span style={{ textAlign:'right', fontSize:11, color:'#999' }}>
                    {acc.unitPrice > 0 ? fmt(acc.unitPrice) : '—'}
                  </span>
                  <span style={{ textAlign:'right', fontSize:11, color: acc.total > 0 ? '#b48b31' : '#bbb' }}>
                    {acc.total > 0 ? fmt(acc.total) : '—'}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Estimated total */}
        <div className={styles.totalRow}>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:'#1a1a1a' }}>Estimated Price</div>
            <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>Final price may vary based on customization</div>
          </div>
          <span className={styles.totalAmt}>{grandTotal > 0 ? fmt(grandTotal) : 'Contact for pricing'}</span>
        </div>

        {/* CTA */}
        <div style={{ marginTop:20, padding:'16px', background:'#fdf8ef', borderRadius:12, textAlign:'center' }}>
          <div style={{ fontSize:13, color:'#666', marginBottom:6 }}>Want to get a quote?</div>
          <a href="tel:8887652711" style={{
            fontSize:18, fontWeight:700, color:'#b48b31', textDecoration:'none',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            (888) 765-2711
          </a>
        </div>

      </div>
    </div>
  );
}

// ── QuotePanel pill ───────────────────────────────────────────
export default function QuotePanel({ config, sceneItems, catalog }) {
  const [open, setOpen] = useState(false);

  const items = sceneItems.filter(i => !WALL_TYPES.has(i.type) && !i.isArrayClone);
  const count = items.length;

  const total = buildLineItems(sceneItems, catalog).reduce(
    (s, l) => s + l.total + l.accs.reduce((a, acc) => a + acc.total, 0), 0
  );

  function formatPrice(n) {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  return (
    <>
      <div className={styles.quotePill} style={{ pointerEvents:'all' }}>
        <div className={styles.itemCount}>{count} item{count !== 1 ? 's' : ''}</div>
        <div className={styles.totalBlock}>
          <div className={styles.totalLabel}>Estimated Price</div>
          <div className={styles.totalValue}>{total > 0 ? formatPrice(total) : 'Contact for pricing'}</div>
        </div>
        <button className={styles.quoteBtn} onClick={() => setOpen(true)} disabled={count === 0}>
          Get List
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </div>

      {open && <ListModal sceneItems={sceneItems} catalog={catalog} onClose={() => setOpen(false)} />}
    </>
  );
}
