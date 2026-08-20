import React, { useState } from 'react';
import styles from './QuotePanel.module.css';

const WALL_TYPES = new Set(['wall','column','door']);

function buildLineItems(sceneItems, catalog) {
  const items = sceneItems.filter(i => {
    if (WALL_TYPES.has(i.type)) return false;
    if (i.isArrayClone) return false; // clones counted via arrayParent
    if (catalog?.[i.modelId]?.category === 'Props') return false;
    return true;
  });
  const modelGroups = {};
  items.forEach(item => {
    // Array group: count original + all its clones
    const arrayCount = item.groupId
      ? sceneItems.filter(i => i.groupId === item.groupId).length
      : 1;
    // isPresetGroup items are individual — don't multiply by group size
    const groupSize = item.isPresetGroup ? 1 : arrayCount;
    if (!modelGroups[item.modelId]) {
      modelGroups[item.modelId] = { item, count: 0 };
    }
    modelGroups[item.modelId].count += groupSize;
  });
  return Object.values(modelGroups).map(({ item, count }) => {
    const def = catalog?.[item.modelId];
    const unitPrice = def?.price || 0;
    const accs = [];
    (def?.sockets || []).forEach(s => {
      const state = item.socketStates?.[s.name];
      if (!state) return;
      const accPrice = catalog?.__accessories?.[s.accessoryFile]?.price || 0;
      if (s.behavior === 'fixed' && state.on)
        accs.push({ label: s.label || s.name, qty: count, unitPrice: accPrice, total: accPrice * count });
      else if (s.behavior === 'distribute' && state.count > 0)
        accs.push({ label: s.label || s.name, qty: state.count * count, unitPrice: accPrice, total: accPrice * state.count * count });
      else if (s.behavior === 'positions' && state.positionIndex >= 0)
        accs.push({ label: s.label || s.name, qty: count, unitPrice: accPrice, total: accPrice * count });
    });
    return { name: def?.name || item.modelId, count, unitPrice, total: unitPrice * count, accs };
  });
}

function fmt(n) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const COL = '1fr 40px 72px 80px';

function ListModal({ sceneItems, catalog, onClose }) {
  const lines = buildLineItems(sceneItems, catalog);
  const grandTotal = lines.reduce((s, l) => s + l.total + l.accs.reduce((a, acc) => a + acc.total, 0), 0);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Your List</div>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Column headers */}
        <div style={{ display:'grid', gridTemplateColumns:COL, gap:'0 8px', padding:'0 4px 8px 4px', marginBottom:4 }}>
          <span style={{ fontSize:10, color:'#bbb', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Item</span>
          <span style={{ fontSize:10, color:'#bbb', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'center' }}>Qty</span>
          <span style={{ fontSize:10, color:'#bbb', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'center' }}>Unit</span>
          <span style={{ fontSize:10, color:'#bbb', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'center' }}>Total</span>
        </div>

        {/* Items */}
        <div className={styles.itemsList} style={{ maxHeight:280 }}>
          {lines.length === 0 && (
            <div style={{ textAlign:'center', color:'#bbb', fontSize:13, padding:'24px 0' }}>No items in scene</div>
          )}
          {lines.map((line, i) => (
            <div key={i} style={{ padding:'10px 4px', borderBottom: i < lines.length-1 ? '1px solid #f5f5f5' : 'none' }}>
              {/* Model row */}
              <div style={{ display:'grid', gridTemplateColumns:COL, gap:'0 8px', alignItems:'center' }}>
                <span style={{ fontWeight:600, fontSize:13, color:'#1a1a1a' }}>{line.name}</span>
                <span style={{ textAlign:'center', fontSize:13, color:'#888', fontWeight:500 }}>{line.count}</span>
                <span style={{ textAlign:'center', fontSize:13, color:'#888' }}>
                  {line.unitPrice > 0 ? fmt(line.unitPrice) : <span style={{color:'#ddd'}}>—</span>}
                </span>
                <span style={{ textAlign:'right', fontSize:13, fontWeight:700, color: line.total > 0 ? '#1a1a1a' : '#ddd' }}>
                  {line.total > 0 ? fmt(line.total) : '—'}
                </span>
              </div>
              {/* Accessories */}
              {line.accs.map((acc, j) => (
                <div key={j} style={{ display:'grid', gridTemplateColumns:COL, gap:'0 8px', alignItems:'center', marginTop:5 }}>
                  <span style={{ fontSize:11, color:'#aaa', paddingLeft:14, display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ color:'#ddd' }}>↳</span> {acc.label}
                  </span>
                  <span style={{ textAlign:'center', fontSize:11, color:'#aaa' }}>{acc.qty}</span>
                  <span style={{ textAlign:'right', fontSize:11, color:'#aaa' }}>
                    {acc.unitPrice > 0 ? fmt(acc.unitPrice) : <span style={{color:'#ddd'}}>—</span>}
                  </span>
                  <span style={{ textAlign:'right', fontSize:11, fontWeight:600, color: acc.total > 0 ? '#b48b31' : '#ddd' }}>
                    {acc.total > 0 ? fmt(acc.total) : '—'}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Estimated total */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', padding:'14px 4px 0', borderTop:'2px solid #f0f0f0', marginTop:4 }}>
          <div>
            <div style={{ fontSize:11, color:'#1a1a1a', marginBottom:2, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Estimated Price</div>
            <div style={{ fontSize:22, fontWeight:900, color:'#1a1a1a', lineHeight:1 }}>
              {grandTotal > 0 ? fmt(grandTotal) : 'Contact for pricing'}
            </div>
            <div style={{ fontSize:10, color:'#ccc', marginTop:4 }}>Final price may vary</div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ marginTop:18, padding:'16px 20px', background:'#fdf8ef', borderRadius:14, textAlign:'center' }}>
          <div style={{ fontSize:12, color:'#aaa', marginBottom:8 }}>Want to get a quote?</div>
          <a href="tel:8887652711" style={{
            fontSize:20, fontWeight:900, color:'#b48b31', textDecoration:'none',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
const RENT_TEXT = 'Or rent for 1/3 of the price';

export default function QuotePanel({ config, sceneItems, catalog }) {
  const [open, setOpen] = useState(false);

  const items = sceneItems.filter(i => {
    if (WALL_TYPES.has(i.type) || i.isArrayClone) return false;
    if (catalog?.[i.modelId]?.category === 'Props') return false;
    return true;
  });
  const count = items.reduce((s, i) => s + (i.count || 1), 0);

  const total = buildLineItems(sceneItems, catalog).reduce(
    (s, l) => s + l.total + l.accs.reduce((a, acc) => a + acc.total, 0), 0
  );

  function formatPrice(n) {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <>
      <div className={styles.quotePill} style={{ pointerEvents:'all' }} data-tour="quote-panel">
        <div className={styles.itemCount}>{count} item{count !== 1 ? 's' : ''}</div>
        <div className={styles.totalBlock}>
          <div className={styles.totalLabel}>Estimated Total</div>
          <div className={styles.totalValue}>{total > 0 ? formatPrice(total) : 'Contact for pricing'}</div>
          <div className={styles.rentText}>{RENT_TEXT}</div>
        </div>
        <button className={styles.quoteBtn} onClick={() => setOpen(true)} disabled={count === 0}>
          Get List
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
        {config.phone && (
          <div className={styles.phoneRow}>
            or call us at<br />
            <a href={`tel:${config.phoneHref}`} className={styles.phoneLink}>{config.phone}</a>
          </div>
        )}
      </div>
      {open && <ListModal sceneItems={sceneItems} catalog={catalog} onClose={() => setOpen(false)} />}
    </>
  );
}
