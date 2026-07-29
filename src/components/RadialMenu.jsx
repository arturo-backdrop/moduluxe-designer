import React, { useEffect, useRef } from 'react';

// ── Config (identical to prototype) ──────────────────────────
const CFG = {
  baseRadius:           90,
  radiusPerBtn:         8,
  radiusSpeed:          0.13,
  closeAnimDuration:    280,
  closeMinScale:        0.3,
  closeStagger:         30,
  nudgeDistance:        14,
  nudgeAngleRange:      80,
  selectPopScale:       1.28,
  selectPopUpDuration:  120,
  selectPopDownDuration:320,
};

const ACCENT = '#b48b31';

const BEHAVIOR_ICONS = {
  fixed:'ti-bulb', distribute:'ti-layout-rows', color:'ti-palette',
  positions:'ti-layout-columns', slide_y:'ti-arrows-up-down',
  slide_x:'ti-arrows-left-right', slide_z:'ti-arrows-move',
};

const FIXED_ACTIONS = [
  { id:'rotate', icon:'ti-rotate-clockwise', label:'Rotate',    hasProps:false, size:42 },
  { id:'dup',    icon:'ti-copy',             label:'Duplicate', hasProps:false, size:42 },
  { id:'del',    icon:'ti-trash',            label:'Delete',    hasProps:false, size:42 },
];

function buildButtons(sockets=[]) {
  const socketBtns = sockets.map(s => ({
    id:s.name, icon:BEHAVIOR_ICONS[s.behavior]||'ti-adjustments',
    label:s.label||s.name, size:48, hasProps:true, socket:s,
  }));
  const all = [...socketBtns, ...FIXED_ACTIONS];
  return all.map((b,i) => ({ ...b, angle:(360/all.length)*i - 90 }));
}

function angleDiff(a,b) { let d=((b-a)+180)%360-180; return d<-180?d+360:d; }

function buildCardHTML(modelName, activeBtnId, buttons, socketStates) {
  if (!activeBtnId) return `
    <div style="font-size:9px;color:#999;margin-bottom:4px;">${modelName}</div>
    <div style="font-weight:900;font-size:13px;color:#1a1a1a;margin-top:4px;">Object</div>`;

  const btn = buttons.find(b=>b.id===activeBtnId);
  if (!btn?.socket) return `<div style="font-size:9px;color:#999;">${modelName}</div>`;
  const s = btn.socket, state = socketStates[s.name] || s.state || {};

  if (s.behavior === 'fixed') {
    const on = state.on;
    return `
      <div style="font-size:9px;color:#999;margin-bottom:4px;">${modelName}</div>
      <div style="font-weight:900;font-size:12px;color:#1a1a1a;">${s.label}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <div id="rm_toggle_${s.name}" style="width:34px;height:18px;border-radius:9px;position:relative;cursor:pointer;background:${on?ACCENT:'#e0e0e0'};transition:background 0.2s;flex-shrink:0;">
          <div style="position:absolute;width:14px;height:14px;border-radius:50%;background:white;top:2px;left:${on?'18px':'2px'};transition:left 0.2s;"></div>
        </div>
        <span style="font-size:11px;color:#666;">${on?'On':'Off'}</span>
      </div>`;
  }
  if (s.behavior === 'distribute') {
    const count = state.count ?? 1;
    return `
      <div style="font-size:9px;color:#999;margin-bottom:4px;">${modelName}</div>
      <div style="font-weight:900;font-size:12px;color:#1a1a1a;">${s.label}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:6px;">
        <button id="rm_dec_${s.name}" style="width:26px;height:26px;border-radius:50%;border:none;background:#f0f0f0;font-size:16px;cursor:pointer;">−</button>
        <span id="rm_count_${s.name}" style="font-weight:900;font-size:22px;color:#1a1a1a;">${count}</span>
        <button id="rm_inc_${s.name}" style="width:26px;height:26px;border-radius:50%;border:none;background:#f0f0f0;font-size:16px;cursor:pointer;">+</button>
      </div>`;
  }
  return `<div style="font-size:9px;color:#999;">${modelName}</div>`;
}

// ── React wrapper — pure DOM inside ──────────────────────────
export default function RadialMenu({ x, y, modelName, sockets=[], onAction, onClose, wrapperRef }) {
  const rootRef     = useRef(null);
  const stateRef    = useRef({
    open:false, closing:false, activeBtn:null,
    currentR:0, targetR:0,
    radiusRaf:null, closeTimeout:null,
    buttons:[], btnEls:{}, circleEls:{}, cardEl:null,
    socketStates: Object.fromEntries(sockets.map(s=>[s.name,{...(s.state||{})}])),
  });

  useEffect(() => {
    const root  = rootRef.current;
    const state = stateRef.current;
    if (!root) return;

    state.buttons = buildButtons(sockets);

    // ── Radius animation ──────────────────────────────────
    function animateRadius() {
      const diff = state.targetR - state.currentR;
      if (Math.abs(diff) > 0.4) {
        state.currentR += diff * CFG.radiusSpeed;
        updateAllBtnPositions();
        state.radiusRaf = requestAnimationFrame(animateRadius);
      } else {
        state.currentR = state.targetR;
        updateAllBtnPositions();
      }
    }

    function updateAllBtnPositions() {
      state.buttons.forEach(b => {
        const el = state.btnEls[b.id];
        if (!el) return;
        const rad = b.angle * Math.PI / 180;
        el.style.left = (state.currentR * Math.cos(rad)) + 'px';
        el.style.top  = (state.currentR * Math.sin(rad)) + 'px';
      });
    }

    function applyHoverNudge(hoverId) {
      state.buttons.forEach(b => {
        const el = state.btnEls[b.id];
        if (!el) return;
        const rad = b.angle * Math.PI / 180;
        const bx  = state.currentR * Math.cos(rad);
        const by  = state.currentR * Math.sin(rad);
        if (b.id === hoverId || !hoverId) { el.style.left=bx+'px'; el.style.top=by+'px'; return; }
        const hb = state.buttons.find(x=>x.id===hoverId);
        if (!hb) return;
        const diff = angleDiff(hb.angle, b.angle), absDiff = Math.abs(diff);
        if (absDiff < CFG.nudgeAngleRange) {
          const nudge = (1 - absDiff/CFG.nudgeAngleRange) * CFG.nudgeDistance;
          const sign  = diff > 0 ? 1 : -1;
          const hr    = hb.angle * Math.PI / 180;
          el.style.left = (bx - Math.sin(hr)*sign*nudge) + 'px';
          el.style.top  = (by + Math.cos(hr)*sign*nudge) + 'px';
        } else { el.style.left=bx+'px'; el.style.top=by+'px'; }
      });
    }

    function popScale(circleEl) {
      if (!circleEl) return;
      circleEl.style.transition = `transform ${CFG.selectPopUpDuration}ms cubic-bezier(0.2,0,0.4,1)`;
      circleEl.style.transform  = `scale(${CFG.selectPopScale})`;
      setTimeout(() => {
        circleEl.style.transition = `transform ${CFG.selectPopDownDuration}ms cubic-bezier(0.34,1.4,0.64,1)`;
        circleEl.style.transform  = 'scale(1)';
      }, CFG.selectPopUpDuration);
    }

    function setActiveBtn(id, circleEl) {
      state.activeBtn = id;
      state.targetR   = getRadius(id);
      cancelAnimationFrame(state.radiusRaf);
      animateRadius();
      // Update card content
      if (state.cardEl) {
        state.cardEl.innerHTML = buildCardHTML(modelName, state.activeBtn, state.buttons, state.socketStates);
        bindCardEvents();
      }
      // Update active circle styles
      Object.entries(state.circleEls).forEach(([btnId, cel]) => {
        if (!cel) return;
        cel.style.background = btnId === id ? ACCENT : 'white';
        const icon = cel.querySelector('i');
        if (icon) icon.style.color = btnId === id ? 'white' : '#1a1a1a';
      });
      if (circleEl) popScale(circleEl);
    }

    function getRadius(active) {
      const base = CFG.baseRadius + Math.max(0, state.buttons.length-4)*CFG.radiusPerBtn;
      return active ? base+20 : base;
    }

    function bindCardEvents() {
      // Toggle
      state.buttons.forEach(b => {
        if (!b.socket) return;
        const s = b.socket;
        const toggle = document.getElementById(`rm_toggle_${s.name}`);
        if (toggle) {
          toggle.onclick = () => {
            state.socketStates[s.name] = { ...state.socketStates[s.name], on: !state.socketStates[s.name].on };
            onAction?.('socket', { name:s.name, state:state.socketStates[s.name] });
            if (state.cardEl) { state.cardEl.innerHTML = buildCardHTML(modelName, state.activeBtn, state.buttons, state.socketStates); bindCardEvents(); }
          };
        }
        const dec = document.getElementById(`rm_dec_${s.name}`);
        const inc = document.getElementById(`rm_inc_${s.name}`);
        if (dec) dec.onclick = () => {
          state.socketStates[s.name].count = Math.max(1, (state.socketStates[s.name].count||1)-1);
          onAction?.('socket',{name:s.name,state:state.socketStates[s.name]});
          const el = document.getElementById(`rm_count_${s.name}`);
          if (el) el.textContent = state.socketStates[s.name].count;
        };
        if (inc) inc.onclick = () => {
          state.socketStates[s.name].count = Math.min(s.max||5, (state.socketStates[s.name].count||1)+1);
          onAction?.('socket',{name:s.name,state:state.socketStates[s.name]});
          const el = document.getElementById(`rm_count_${s.name}`);
          if (el) el.textContent = state.socketStates[s.name].count;
        };
      });
    }

    // ── Build DOM ─────────────────────────────────────────
    // Center card — z-index:10 so it's always above buttons
    const card = document.createElement('div');
    card.style.cssText = `position:absolute;left:0;top:0;transform:translate(-50%,-50%);
      background:white;border-radius:14px;padding:10px 14px 9px;
      box-shadow:0 4px 20px rgba(0,0,0,0.13);min-width:86px;
      display:flex;flex-direction:column;align-items:center;gap:5px;
      font-family:Figtree,sans-serif;cursor:default;z-index:10;
      opacity:0;transition:opacity 0.22s ease, transform 0.25s cubic-bezier(0.34,1.2,0.64,1);`;
    card.innerHTML = buildCardHTML(modelName, null, state.buttons, state.socketStates);
    root.appendChild(card);
    state.cardEl = card;

    // Buttons — z-index:1, below card
    state.buttons.forEach(b => {
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;left:0;top:0;transform:translate(-50%,-50%);
        display:flex;flex-direction:column;align-items:center;gap:3px;
        cursor:pointer;opacity:0;z-index:1;`;

      const circle = document.createElement('div');
      circle.style.cssText = `width:${b.size}px;height:${b.size}px;border-radius:50%;
        background:white;display:flex;align-items:center;justify-content:center;
        box-shadow:0 3px 12px rgba(0,0,0,0.10);transition:background 0.18s;`;

      const icon = document.createElement('i');
      icon.className = `ti ${b.icon}`;
      icon.style.cssText = `font-size:${Math.round(b.size*0.42)}px;color:#1a1a1a;transition:color 0.15s;`;
      circle.appendChild(icon);

      const label = document.createElement('span');
      label.textContent = b.label;
      label.style.cssText = `font-family:Figtree,sans-serif;font-weight:500;font-size:9px;color:#999;white-space:nowrap;`;

      el.appendChild(circle);
      el.appendChild(label);
      root.appendChild(el);

      state.btnEls[b.id]    = el;
      state.circleEls[b.id] = circle;

      circle.addEventListener('mouseenter', () => { circle.style.background='#f5f5f5'; applyHoverNudge(b.id); });
      circle.addEventListener('mouseleave', () => { circle.style.background = state.activeBtn===b.id ? ACCENT : 'white'; applyHoverNudge(null); });

      el.addEventListener('click', e => {
        e.stopPropagation();
        if (!b.hasProps) {
          if (b.id === 'del') { onAction?.('del'); triggerClose(); }
          else { popScale(circle); onAction?.(b.id); }
          return;
        }
        setActiveBtn(state.activeBtn===b.id ? null : b.id, circle);
      });
    });

    bindCardEvents();

    // ── Open animation ────────────────────────────────────
    state.currentR = 0;
    state.targetR  = getRadius(null);
    cancelAnimationFrame(state.radiusRaf);
    animateRadius();

    // Fade in card
    requestAnimationFrame(() => {
      card.style.opacity   = '1';
      card.style.transform = 'translate(-50%,-50%) scale(1)';
    });

    // Stagger buttons
    state.buttons.forEach((b, i) => {
      setTimeout(() => {
        const el = state.btnEls[b.id];
        if (el) el.style.opacity = '1';
      }, 60 + i*35);
    });

    // ── Close animation ───────────────────────────────────
    function triggerClose() {
      if (state.closing) return;
      state.closing = true;

      // Fade out card
      card.style.transition = `opacity ${CFG.closeAnimDuration}ms ease, transform ${CFG.closeAnimDuration}ms cubic-bezier(0.4,0,1,1)`;
      card.style.opacity    = '0';
      card.style.transform  = 'translate(-50%,-50%) scale(0.7)';

      // Stagger fade out buttons
      state.buttons.forEach((b, i) => {
        const el = state.btnEls[b.id];
        if (!el) return;
        const delay = i * CFG.closeStagger;
        el.style.transition = `opacity ${CFG.closeAnimDuration}ms ease ${delay}ms, transform ${CFG.closeAnimDuration}ms cubic-bezier(0.4,0,1,1) ${delay}ms`;
        el.style.opacity    = '0';
        el.style.transform  = `translate(-50%,-50%) scale(${CFG.closeMinScale})`;
      });

      // Collapse radius
      state.targetR = 0;
      cancelAnimationFrame(state.radiusRaf);
      animateRadius();

      const total = CFG.closeAnimDuration + state.buttons.length * CFG.closeStagger;
      state.closeTimeout = setTimeout(() => onClose?.(), total);
    }

    // Expose triggerClose so parent can call it
    root._triggerClose = triggerClose;

    return () => {
      cancelAnimationFrame(state.radiusRaf);
      clearTimeout(state.closeTimeout);
    };
  }, []);

  return (
    <div ref={el => { rootRef.current=el; if(wrapperRef) wrapperRef.current=el; }}
      style={{ position:'absolute', left:x, top:y, pointerEvents:'all', zIndex:100 }}
      onClick={e=>e.stopPropagation()} />
  );
}
