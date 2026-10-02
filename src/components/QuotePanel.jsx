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
    const arrayCount = item.groupId
      ? sceneItems.filter(i => i.groupId === item.groupId).length
      : 1;
    const groupSize = item.isPresetGroup ? 1 : arrayCount;
    if (!modelGroups[item.modelId]) {
      modelGroups[item.modelId] = { item, count: 0, allItems: [] };
    }
    modelGroups[item.modelId].count += groupSize;
    // Collect all individual items for accurate socket counting
    for (let n = 0; n < groupSize; n++) {
      modelGroups[item.modelId].allItems.push(item);
    }
  });
  return Object.values(modelGroups).map(({ item, count, allItems }) => {
    const def = catalog?.[item.modelId];
    const unitPrice = def?.price || 0;
    const accs = [];
    const seenSocketNames = new Set();
    (def?.sockets || []).forEach(s => {
      if (seenSocketNames.has(s.name)) return;
      seenSocketNames.add(s.name);
      const accPrice = catalog?.__accessories?.[s.accessoryFile]?.price || 0;
      if (s.behavior === 'fixed') {
        // Sum onCount across ALL individual items (fixes preset groups)
        let totalOn = 0;
        allItems.forEach(it => {
          const directState = it.socketStates?.[s.name];
          const indexedStates = Object.entries(it.socketStates || {})
            .filter(([k]) => k === s.name || k.startsWith(s.name + '_'))
            .map(([, v]) => v);
          totalOn += indexedStates.filter(v => v?.on).length || (directState?.on ? 1 : 0);
        });
        if (totalOn > 0)
          accs.push({ label: s.label || s.name, qty: totalOn, unitPrice: accPrice, total: accPrice * totalOn });
      } else if (s.behavior === 'distribute') {
        // Sum shelf counts across all items
        let totalCount = 0;
        allItems.forEach(it => {
          const state = it.socketStates?.[s.name];
          if (state?.count > 0) totalCount += state.count;
        });
        if (totalCount > 0)
          accs.push({ label: s.label || s.name, qty: totalCount, unitPrice: accPrice, total: accPrice * totalCount });
      } else if (s.behavior === 'positions') {
        // Count items that have a position set
        let totalPos = 0;
        allItems.forEach(it => {
          const state = it.socketStates?.[s.name];
          if (state?.positionIndex >= 0) totalPos++;
        });
        if (totalPos > 0)
          accs.push({ label: s.label || s.name, qty: totalPos, unitPrice: accPrice, total: accPrice * totalPos });
      }
    });
    return { name: def?.name || item.modelId, count, unitPrice, total: unitPrice * count, accs };
  });
}

function fmt(n) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const COL = '1fr 40px 72px 80px';

// ── PDF export ────────────────────────────────────────────────
// jsPDF is loaded on demand so it doesn't weigh down the initial bundle.
async function buildQuotePdf({ projectName, shot, lines, grandTotal, config }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'in', format: 'letter' });
  const PW = 8.5, PH = 11, M = 0.6, CW = PW - M * 2;
  const R_TOTAL = M + CW, R_UNIT = M + CW - 1.2, R_QTY = M + CW - 2.4, ITEM_W = CW - 2.8;
  const title = projectName || 'My Booth Design';
  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const money = n => (n > 0 ? fmt(n) : '-');
  let y = M;

  // Header: project name + date top-left, small booth image top-right
  const IMG_W = 2.6, GAP = 0.3;
  let headerH = 0;
  let textX = M, textW = CW;
  if (shot?.dataUrl) {
    const imgH = (IMG_W * shot.height) / shot.width;
    doc.addImage(shot.dataUrl, 'JPEG', M + CW - IMG_W, y, IMG_W, imgH);
    textW = CW - IMG_W - GAP;
    headerH = imgH;
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(26, 26, 26);
  const titleLines = doc.splitTextToSize(title, textW);
  doc.text(titleLines, textX, y + 0.28);
  const titleBottom = y + 0.28 + (titleLines.length - 1) * 0.3;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(180, 139, 49);
  doc.text(dateLabel, textX, titleBottom + 0.28);
  y += Math.max(headerH, titleBottom + 0.28 - y) + 0.4;
  // Table
  const drawHeader = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text('ITEM', M, y);
    doc.text('QTY', R_QTY, y, { align: 'right' });
    doc.text('UNIT PRICE', R_UNIT, y, { align: 'right' });
    doc.text('SUBTOTAL', R_TOTAL, y, { align: 'right' });
    y += 0.08;
    doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.01);
    doc.line(M, y, M + CW, y);
    y += 0.22;
  };
  const ensureSpace = h => {
    if (y + h > PH - M - 0.4) { doc.addPage(); y = M; drawHeader(); }
  };
  drawHeader();
  lines.forEach(line => {
    const nameLines = doc.splitTextToSize(line.name, ITEM_W);
    ensureSpace(nameLines.length * 0.17 + 0.1);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(26, 26, 26);
    doc.text(nameLines, M, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(line.count), R_QTY, y, { align: 'right' });
    doc.text(money(line.unitPrice), R_UNIT, y, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(money(line.total), R_TOTAL, y, { align: 'right' });
    y += nameLines.length * 0.17 + 0.05;
    line.accs.forEach(acc => {
      ensureSpace(0.2);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 120, 120);
      doc.text(`- ${acc.label}`, M + 0.2, y);
      doc.text(String(acc.qty), R_QTY, y, { align: 'right' });
      doc.text(money(acc.unitPrice), R_UNIT, y, { align: 'right' });
      doc.text(money(acc.total), R_TOTAL, y, { align: 'right' });
      y += 0.19;
    });
    y += 0.08;
    doc.setDrawColor(240, 240, 240); doc.line(M, y - 0.04, M + CW, y - 0.04);
    y += 0.1;
  });

  // Totals
  ensureSpace(1.6);
  y += 0.1;
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.02);
  doc.line(M, y, M + CW, y);
  y += 0.3;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(26, 26, 26);
  doc.text('ESTIMATED PRICE', M, y);
  if (grandTotal > 0) doc.text('OR RENT FOR', R_TOTAL, y, { align: 'right' });
  y += 0.3;
  doc.setFontSize(18);
  doc.text(grandTotal > 0 ? fmt(grandTotal) : 'Contact for pricing', M, y);
  if (grandTotal > 0) doc.text(fmt(Math.round(grandTotal / 3)), R_TOTAL, y, { align: 'right' });
  y += 0.22;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(160, 160, 160);
  doc.text('Final price may vary', M, y);
  if (grandTotal > 0) doc.text('per event', R_TOTAL, y, { align: 'right' });
  y += 0.5;

  // Contact
  ensureSpace(0.6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(120, 120, 120);
  doc.text('Want to get a quote?', M, y);
  y += 0.22;
  doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 139, 49);
  doc.text(`${config?.phone || '(888) 765-2711'}   |   sales@backdrop.com`, M, y);

  const safeName = title.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'booth';
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  doc.save(`${safeName}_quote_${stamp}.pdf`);
}

function ListModal({ sceneItems, catalog, config, projectName, onCaptureCorners, onClose }) {
  const lines = buildLineItems(sceneItems, catalog);
  const grandTotal = lines.reduce((s, l) => s + l.total + l.accs.reduce((a, acc) => a + acc.total, 0), 0);

  // PDF flow: 'list' → 'pick' (choose one of 4 corner views) → download
  const [step,     setStep]     = useState('list');
  const [shots,    setShots]    = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');

  async function startPdf() {
    setBusy(true); setError('');
    await new Promise(r => requestAnimationFrame(r)); // let the busy state paint first
    try {
      const result = onCaptureCorners?.() || [];
      if (!result.length) throw new Error('capture failed');
      setShots(result); setSelected(result[0].id); setStep('pick');
    } catch (e) {
      console.error('Quote capture failed:', e);
      setError('Could not capture the booth views. Please try again.');
    }
    setBusy(false);
  }

  async function downloadPdf() {
    setBusy(true); setError('');
    try {
      await buildQuotePdf({
        projectName, lines, grandTotal, config,
        shot: shots.find(s => s.id === selected),
      });
    } catch (e) {
      console.error('PDF export failed:', e);
      setError('Could not create the PDF. Please try again.');
    }
    setBusy(false);
  }

  const goldBtn = {
    flex:1, padding:'12px 16px', borderRadius:12, border:'none', cursor:'pointer',
    background:'#b48b31', color:'#fff', fontWeight:800, fontSize:13, letterSpacing:'0.02em',
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{step === 'pick' ? 'Choose a view' : 'Your List'}</div>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {step === 'pick' ? (
          <div>
            <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>
              Pick the angle you want on your PDF.
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {shots.map(s => (
                <button key={s.id} onClick={() => setSelected(s.id)} style={{
                  padding:0, background:'#fff', cursor:'pointer', textAlign:'left', overflow:'hidden',
                  borderRadius:10, border: selected === s.id ? '2px solid #b48b31' : '2px solid #eee',
                }}>
                  <img src={s.dataUrl} alt={s.label} style={{ display:'block', width:'100%', aspectRatio:`${s.width} / ${s.height}`, objectFit:'cover' }} />
                  <div style={{ padding:'6px 10px', fontSize:11, fontWeight:700, color: selected === s.id ? '#b48b31' : '#666' }}>
                    {s.label}
                  </div>
                </button>
              ))}
            </div>
            {error && <div style={{ color:'#c0392b', fontSize:12, marginTop:10 }}>{error}</div>}
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button onClick={() => setStep('list')} disabled={busy} style={{ ...goldBtn, flex:'0 0 auto', background:'#f3f3f3', color:'#666' }}>Back</button>
              <button onClick={downloadPdf} disabled={busy || !selected} style={{ ...goldBtn, opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Creating PDF…' : 'Download PDF'}
              </button>
            </div>
          </div>
        ) : (
        <>
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
                <span style={{ textAlign:'right', fontSize:13, color:'#888' }}>
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
                  <span style={{ textAlign:'right', fontSize:11, fontWeight:600, color: acc.total > 0 ? '#1a1a1a' : '#ddd' }}>
                    {acc.total > 0 ? fmt(acc.total) : '—'}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Estimated total */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', padding:'14px 4px 0', borderTop:'2px solid #f0f0f0', marginTop:4 }}>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:11, color:'#1a1a1a', marginBottom:2, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Estimated Price</div>
            <div style={{ fontSize:22, fontWeight:900, color:'#1a1a1a', lineHeight:1 }}>
              {grandTotal > 0 ? fmt(grandTotal) : 'Contact for pricing'}
            </div>
            <div style={{ fontSize:10, color:'#ccc', marginTop:4 }}>Final price may vary</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:11, color:'#1a1a1a', marginBottom:2, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Or Rent for</div>
            <div style={{ fontSize:22, fontWeight:900, color:'#1a1a1a', lineHeight:1 }}>
              {grandTotal > 0 ? fmt(Math.round(grandTotal / 3)) : '—'}
            </div>
            <div style={{ fontSize:10, color:'#ccc', marginTop:4 }}>per event</div>
          </div>
        </div>

        {/* Download PDF */}
        <div style={{ marginTop:16 }}>
          <button onClick={startPdf} disabled={busy || lines.length === 0} style={{
            ...goldBtn, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            opacity: busy || lines.length === 0 ? 0.6 : 1,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {busy ? 'Capturing views…' : 'Download PDF'}
          </button>
          {error && <div style={{ color:'#c0392b', fontSize:12, marginTop:8, textAlign:'center' }}>{error}</div>}
        </div>

        {/* CTA */}
        <div style={{ marginTop:18, padding:'16px 20px', background:'#fdf8ef', borderRadius:14, textAlign:'center' }}>
          <div style={{ fontSize:12, color:'#aaa', marginBottom:12 }}>Want to get a quote?</div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <a href="tel:8887652711" style={{
              fontSize:18, fontWeight:900, color:'#b48b31', textDecoration:'none',
              display:'flex', alignItems:'center', gap:8,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              (888) 765-2711
            </a>
            <a href="mailto:sales@backdrop.com" style={{
              fontSize:18, fontWeight:900, color:'#b48b31', textDecoration:'none',
              display:'flex', alignItems:'center', gap:8,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <polyline points="2,4 12,13 22,4"/>
              </svg>
              sales@backdrop.com
            </a>
          </div>
        </div>
        </>
        )}

      </div>
    </div>
  );
}

// ── QuotePanel pill ───────────────────────────────────────────


export default function QuotePanel({ config, sceneItems, catalog, projectName, onCaptureCorners, onAIRender }) {
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
          {total > 0 && <div className={styles.rentText}>Or rent for {formatPrice(Math.round(total / 3))}</div>}
        </div>
        <button className={styles.quoteBtn} onClick={() => setOpen(true)} disabled={count === 0}>
          Get quote
        </button>
        {config.phone && (
          <div className={styles.phoneRow}>
            or call us at<br />
            <a href={`tel:${config.phoneHref}`} className={styles.phoneLink}>{config.phone}</a>
          </div>
        )}
        {/* AI Render button — hidden until backend is ready
        <button className={styles.aiRenderBtn} onClick={() => onAIRender?.()}>
          Get a branded AI render
        </button>
        */}
      </div>
      {open && <ListModal sceneItems={sceneItems} catalog={catalog} config={config} projectName={projectName} onCaptureCorners={onCaptureCorners} onClose={() => setOpen(false)} />}
    </>
  );
}
