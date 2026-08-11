import React, { useState, useEffect, useRef } from 'react';

const TOUR_KEY = 'moduluxe_tour_done';

const STEPS = [
  {
    id: 'sidebar',
    title: 'Browse Models',
    body: 'Browse the catalog on the left. Drag any model onto the floor to place it in your design.',
    arrow: 'right',
  },
  {
    id: 'presets-tab',
    title: 'Ready-made Presets',
    body: 'Check the Presets tab for ready-made booth layouts. Load one to get started instantly — you can always customize it.',
    arrow: 'right',
  },
  {
    id: 'camera',
    title: 'Navigate the Scene',
    body: 'Right-click + drag to orbit around your booth · Scroll to zoom in and out · Middle-click + drag to pan.',
    arrow: 'bottom',
    center: true,
  },
  {
    id: 'select',
    title: 'Select & Move',
    body: 'Click any object to select it. Drag to move it around the floor. Use the arrow keys to nudge it 1cm at a time.',
    arrow: 'bottom',
    center: true,
  },
  {
    id: 'radial',
    title: 'Object Options',
    body: 'Right-click any object to open its options menu:\n• Rotate — spin 90° at a time\n• Color — change the panel color\n• Array — duplicate in a row\n• Accessories — lamps, shelves and more (varies by model)',
    arrow: 'bottom',
    center: true,
  },
  {
    id: 'mode-toggle',
    title: 'Draw Layout Mode',
    body: 'Switch to Draw Layout to add structure to your booth. Draw walls, place columns, and add doors.',
    arrow: 'top',
  },
  {
    id: 'tool-wall',
    title: 'Wall Tool',
    body: 'Click to start a wall, click again to place it. Walls snap to 45° angles — hold Shift for free angle. Press Esc to cancel.',
    arrow: 'right',
  },
  {
    id: 'tool-column',
    title: 'Column Tool',
    body: 'Click anywhere on the floor to place a column. Right-click to adjust size and shape.',
    arrow: 'right',
  },
  {
    id: 'tool-door',
    title: 'Door Tool',
    body: 'Click near a wall to place a door. It snaps automatically to the nearest wall.',
    arrow: 'right',
  },
  {
    id: 'quote-panel',
    title: 'Your Price List',
    body: 'See your estimated price here as you build. Click "Get List" to see a full breakdown of items and accessories.',
    arrow: 'left',
  },
];

function getArrowStyle(arrow) {
  const base = { position:'absolute', width:12, height:12, background:'white', transform:'rotate(45deg)', boxShadow:'-2px -2px 4px rgba(0,0,0,0.06)' };
  if (arrow === 'right')  return { ...base, left:-6,  top:'50%', marginTop:-6 };
  if (arrow === 'left')   return { ...base, right:-6, top:'50%', marginTop:-6 };
  if (arrow === 'top')    return { ...base, top:-6,   left:'50%', marginLeft:-6 };
  if (arrow === 'bottom') return { ...base, bottom:-6, left:'50%', marginLeft:-6 };
  return {};
}

function getTooltipPosition(el, arrow, center) {
  if (!el || center) {
    return { left:'50%', top:'50%', transform:'translate(-50%,-50%)', position:'fixed' };
  }
  const r = el.getBoundingClientRect();
  const GAP = 16;
  const TW = 300; // tooltip width
  if (arrow === 'right')  return { position:'fixed', left: r.right + GAP,       top: r.top + r.height/2, transform:'translateY(-50%)' };
  if (arrow === 'left')   return { position:'fixed', left: r.left - TW - GAP,   top: r.top + r.height/2, transform:'translateY(-50%)' };
  if (arrow === 'top')    return { position:'fixed', left: r.left + r.width/2,   top: r.bottom + GAP,     transform:'translateX(-50%)' };
  if (arrow === 'bottom') return { position:'fixed', left: r.left + r.width/2,   top: r.top - GAP,        transform:'translate(-50%,-100%)' };
  return { position:'fixed', left:'50%', top:'50%', transform:'translate(-50%,-50%)' };
}

export function useTour() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) setActive(true);
  }, []);
  const start = () => setActive(true);
  const done  = () => { localStorage.setItem(TOUR_KEY, '1'); setActive(false); };
  return { active, start, done };
}

export default function Tour({ onDone }) {
  const [step, setStep] = useState(0);
  const [pos, setPos]   = useState({});
  const [visible, setVisible] = useState(false);
  const current = STEPS[step];

  useEffect(() => {
    setVisible(false);
    const el = current?.id ? document.querySelector(`[data-tour="${current.id}"]`) : null;
    const p = getTooltipPosition(el, current?.arrow, current?.center);
    setTimeout(() => { setPos(p); setVisible(true); }, 80);
  }, [step]);

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else onDone();
  }

  if (!current) return null;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, pointerEvents:'none' }}>
      {/* Dim overlay */}
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.25)', pointerEvents:'all' }} onClick={onDone} />

      {/* Tooltip */}
      <div style={{
        ...pos,
        pointerEvents:'all',
        width: 300,
        background:'white',
        borderRadius:16,
        boxShadow:'0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
        padding:'20px 20px 16px',
        opacity: visible ? 1 : 0,
        transform: pos.transform + (visible ? '' : ' scale(0.96)'),
        transition:'opacity 0.2s ease, transform 0.2s ease',
        zIndex:10000,
      }}>
        {/* Arrow */}
        {!current.center && <div style={getArrowStyle(current.arrow)} />}

        {/* Step indicator */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 16 : 6, height:6,
              borderRadius:3, transition:'all 0.2s',
              background: i === step ? '#b48b31' : i < step ? '#e8d9b8' : '#f0f0f0',
            }} />
          ))}
        </div>

        {/* Title */}
        <div style={{ fontWeight:800, fontSize:15, color:'#1a1a1a', marginBottom:8, fontFamily:'Figtree,sans-serif' }}>
          {current.title}
        </div>

        {/* Body */}
        <div style={{ fontSize:13, color:'#666', lineHeight:1.55, fontFamily:'Figtree,sans-serif', whiteSpace:'pre-line' }}>
          {current.body}
        </div>

        {/* Actions */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16 }}>
          <button onClick={onDone} style={{
            background:'none', border:'none', fontSize:12, color:'#bbb',
            cursor:'pointer', fontFamily:'Figtree,sans-serif', padding:'4px 0',
          }}>
            Skip all
          </button>
          <button onClick={next} style={{
            background:'#b48b31', color:'white', border:'none',
            borderRadius:10, padding:'8px 18px', fontSize:13,
            fontWeight:700, cursor:'pointer', fontFamily:'Figtree,sans-serif',
            display:'flex', alignItems:'center', gap:6,
            boxShadow:'0 2px 8px rgba(180,139,49,0.3)',
          }}>
            {step < STEPS.length - 1 ? (
              <>Next <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
            ) : (
              <>Done <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
