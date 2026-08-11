import React, { useState, useEffect, useRef, useCallback } from 'react';

const TOUR_KEY = 'moduluxe_tour_done_v2';

const STEPS = [
  {
    id: 'sidebar',
    title: 'Browse Models',
    body: 'Browse the catalog on the left. Drag any model onto the floor to place it.',
    arrow: 'right',
    action: 'drop_model', // auto-advance when model is dropped
    actionHint: 'Try dragging a model to the floor →',
  },
  {
    id: 'presets-tab',
    title: 'Ready-made Presets',
    body: 'The Presets tab has ready-made booth layouts. Use the ‹ › arrows to scroll through categories.',
    arrow: 'right',
  },
  {
    id: 'camera',
    title: 'Navigate the Scene',
    body: 'Left-click + drag on empty space to orbit · Scroll to zoom · Middle-click to pan.',
    arrow: 'bottom',
    center: true,
  },
  {
    id: 'select',
    title: 'Select & Move',
    body: 'Click any object to select it (white outline). Drag to move it. Arrow keys nudge 1cm at a time.',
    arrow: 'bottom',
    center: true,
    action: 'select_object',
    actionHint: 'Try clicking an object →',
  },
  {
    id: 'radial',
    title: 'Object Options',
    body: 'Right-click any object to open its options:\n• Rotate — spin 90°\n• Color — change color\n• Array — duplicate in a row\n• Accessories — lamps, shelves and more (varies by model)',
    arrow: 'bottom',
    center: true,
    action: 'open_radial',
    actionHint: 'Try right-clicking an object →',
  },
  {
    id: 'mode-toggle',
    title: 'Draw Layout Mode',
    body: 'Switch to Draw Layout to add walls, columns and doors to your booth.',
    arrow: 'top',
    action: 'switch_draw',
    actionHint: 'Try switching to Draw Layout →',
  },
  {
    id: 'mode-toggle',
    title: 'Back to Place Products',
    body: 'Switch back to Place Products mode to continue adding models to your design.',
    arrow: 'top',
    action: 'switch_place',
    actionHint: 'Switch back to Place Products →',
  },
  {
    id: 'tool-wall',
    title: 'Wall Tool',
    body: 'Click to start a wall, click again to place it. Walls snap to 45° — hold Shift for free angle. Esc to cancel.',
    arrow: 'right',
    action: 'select_wall',
    actionHint: 'Try selecting the Wall tool →',
  },
  {
    id: 'tool-column',
    title: 'Column Tool',
    body: 'Click anywhere on the floor to place a column. Right-click it to adjust size and shape.',
    arrow: 'right',
  },
  {
    id: 'tool-door',
    title: 'Door Tool',
    body: 'Click near a wall to place a door — it snaps automatically to the nearest wall.',
    arrow: 'right',
  },
  {
    id: 'quote-panel',
    title: 'Your Price List',
    body: 'Your estimated price updates as you build. Click "Get List" for a full breakdown of items and accessories.',
    arrow: 'left',
  },
];

function getArrowStyle(arrow) {
  const base = {
    position:'absolute', width:10, height:10,
    background:'#1a1a2e', transform:'rotate(45deg)',
  };
  if (arrow === 'right')  return { ...base, left:-5,   top:'50%', marginTop:-5 };
  if (arrow === 'left')   return { ...base, right:-5,  top:'50%', marginTop:-5 };
  if (arrow === 'top')    return { ...base, top:-5,    left:'50%', marginLeft:-5 };
  if (arrow === 'bottom') return { ...base, bottom:-5, left:'50%', marginLeft:-5 };
  return {};
}

function getTooltipPos(el, arrow, center) {
  const TW = 290, GAP = 14;
  if (!el || center) {
    return { position:'fixed', left:'50%', bottom: 32, transform:'translateX(-50%)' };
  }
  const r = el.getBoundingClientRect();
  if (arrow === 'right')  return { position:'fixed', left: r.right + GAP, top: r.top + r.height/2, transform:'translateY(-50%)' };
  if (arrow === 'left')   return { position:'fixed', left: r.left - TW - GAP, top: r.top + r.height/2, transform:'translateY(-50%)' };
  if (arrow === 'top')    return { position:'fixed', left: r.left + r.width/2, top: r.bottom + GAP, transform:'translateX(-50%)' };
  if (arrow === 'bottom') return { position:'fixed', left: r.left + r.width/2, top: r.top - GAP, transform:'translate(-50%,-100%)' };
  return { position:'fixed', left:'50%', bottom:32, transform:'translateX(-50%)' };
}

export function useTour() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      setTimeout(() => setActive(true), 800);
    }
  }, []);
  const start = () => setActive(true);
  const done  = () => { localStorage.setItem(TOUR_KEY, '1'); setActive(false); };
  return { active, start, done };
}

export default function Tour({ onDone, onAction }) {
  const [step, setStep] = useState(0);
  const [pos, setPos]   = useState({});
  const [visible, setVisible] = useState(false);
  const current = STEPS[step];

  // Recalculate position
  const updatePos = useCallback(() => {
    if (!current) return;
    const el = current.id ? document.querySelector(`[data-tour="${current.id}"]`) : null;
    setPos(getTooltipPos(el, current.arrow, current.center));
  }, [current]);

  useEffect(() => {
    setVisible(false);
    // Retry finding the element — it may not be in DOM yet
    let attempts = 0;
    function tryUpdate() {
      const el = current?.id ? document.querySelector(`[data-tour="${current.id}"]`) : null;
      if (!el && !current?.center && attempts < 10) {
        attempts++;
        setTimeout(tryUpdate, 150);
        return;
      }
      updatePos();
      setVisible(true);
    }
    setTimeout(tryUpdate, 120);
  }, [step, updatePos, current]);

  useEffect(() => {
    window.addEventListener('resize', updatePos);
    return () => window.removeEventListener('resize', updatePos);
  }, [updatePos]);

  // Expose advance function so App.jsx can trigger auto-advance
  useEffect(() => {
    if (onAction) onAction(current?.action || null, () => {
      if (step < STEPS.length - 1) setStep(s => s + 1);
      else onDone();
    });
  }, [step, current, onAction, onDone]);

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else onDone();
  }

  if (!current) return null;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, pointerEvents:'none' }}>
      <div style={{
        ...pos,
        pointerEvents:'all',
        width: 290,
        background:'#1a1a2e',
        borderRadius:16,
        boxShadow:'0 12px 48px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.15)',
        padding:'18px 18px 14px',
        opacity: visible ? 1 : 0,
        transition:'opacity 0.2s ease, transform 0.25s cubic-bezier(0.34,1.15,0.64,1)',
        zIndex:10000,
      }}>
        {/* Arrow */}
        {!current.center && <div style={getArrowStyle(current.arrow)} />}

        {/* Step dots */}
        <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:12 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height:4, borderRadius:2, transition:'all 0.25s',
              width: i === step ? 18 : 4,
              background: i === step ? '#b48b31' : i < step ? 'rgba(180,139,49,0.4)' : 'rgba(255,255,255,0.15)',
            }} />
          ))}
          <span style={{ marginLeft:'auto', fontSize:10, color:'rgba(255,255,255,0.3)', fontFamily:'Figtree,sans-serif' }}>
            {step+1}/{STEPS.length}
          </span>
        </div>

        {/* Title */}
        <div style={{ fontWeight:800, fontSize:14, color:'white', marginBottom:7, fontFamily:'Figtree,sans-serif', letterSpacing:'-0.01em' }}>
          {current.title}
        </div>

        {/* Body */}
        <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', lineHeight:1.6, fontFamily:'Figtree,sans-serif', whiteSpace:'pre-line' }}>
          {current.body}
        </div>

        {/* Action hint */}
        {current.actionHint && (
          <div style={{
            marginTop:10, padding:'7px 10px',
            background:'rgba(180,139,49,0.15)', borderRadius:8,
            fontSize:11, color:'#b48b31', fontFamily:'Figtree,sans-serif',
            fontWeight:600, display:'flex', alignItems:'center', gap:6,
          }}>
            <span style={{ fontSize:14 }}>👆</span>
            {current.actionHint}
          </div>
        )}

        {/* Actions */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14 }}>
          <button onClick={onDone} style={{
            background:'none', border:'none', fontSize:11,
            color:'rgba(255,255,255,0.3)', cursor:'pointer',
            fontFamily:'Figtree,sans-serif', padding:'4px 0',
            transition:'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,0.6)'}
          onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.3)'}>
            Skip all
          </button>
          <button onClick={next} style={{
            background:'#b48b31', color:'white', border:'none',
            borderRadius:9, padding:'8px 16px', fontSize:12,
            fontWeight:700, cursor:'pointer', fontFamily:'Figtree,sans-serif',
            display:'flex', alignItems:'center', gap:5,
            boxShadow:'0 2px 12px rgba(180,139,49,0.4)',
            transition:'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background='#9a7628'}
          onMouseLeave={e => e.currentTarget.style.background='#b48b31'}>
            {step < STEPS.length - 1 ? (
              <>Next <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
            ) : (
              <>Done <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
