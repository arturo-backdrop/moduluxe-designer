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
  { id:'array',  icon:'ti-layout-columns',    label:'Array',     hasProps:true,  size:42 },
  { id:'color',  icon:'ti-palette',           label:'Color',     hasProps:true,  size:42 },
  { id:'rotate', icon:'ti-rotate-clockwise',  label:'Rotate',    hasProps:false, size:42 },
  { id:'dup',    icon:'ti-copy',              label:'Duplicate', hasProps:false, size:42 },
  { id:'del',    icon:'ti-trash',             label:'Delete',    hasProps:false, size:42 },
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

const PRESET_COLORS = [
  '#3a6ea5','#e8e0d0','#2d2d2d','#ffffff','#c4622d',
  '#4a7c5e','#8b4a6b','#d4a843','#6b6b6b','#1a3a5c',
];

function buildCardHTML(modelName, activeBtnId, buttons, socketStates, currentColor='#3a6ea5', currentRotY=0, arrayState={count:1,spacing:0.1}, units='ft') {
  const UNITS_MAP = { m:{label:'m',factor:1}, ft:{label:'ft',factor:3.28084}, cm:{label:'cm',factor:100}, inch:{label:'in',factor:39.3701} };
  const u = UNITS_MAP[units] || UNITS_MAP.m;
  const spacingDisplay = (arrayState.spacing * u.factor).toFixed(units==='m'?2:1);

  if (!activeBtnId) return `<div style="font-size:9px;color:#999;">${modelName}</div>`;

  if (activeBtnId === 'array') return `
    <div style="font-size:9px;color:#999;margin-bottom:6px;">${modelName}</div>
    <div style="font-weight:900;font-size:12px;color:#1a1a1a;margin-bottom:8px;">Array</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div>
        <div style="font-size:9px;color:#999;margin-bottom:4px;">Count</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button id="rm_arr_dec" style="width:26px;height:26px;border-radius:50%;border:none;background:#f0f0f0;font-size:16px;cursor:pointer;">&#8722;</button>
          <span id="rm_arr_count" style="font-weight:900;font-size:20px;color:#1a1a1a;min-width:24px;text-align:center;">${arrayState.count}</span>
          <button id="rm_arr_inc" style="width:26px;height:26px;border-radius:50%;border:none;background:#f0f0f0;font-size:16px;cursor:pointer;">+</button>
        </div>
      </div>
      <div>
        <div style="font-size:9px;color:#999;margin-bottom:4px;">Spacing (${u.label})</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button id="rm_sp_dec" style="width:26px;height:26px;border-radius:50%;border:none;background:#f0f0f0;font-size:16px;cursor:pointer;">&#8722;</button>
          <span id="rm_sp_val" style="font-weight:900;font-size:16px;color:#1a1a1a;min-width:32px;text-align:center;">${spacingDisplay}</span>
          <button id="rm_sp_inc" style="width:26px;height:26px;border-radius:50%;border:none;background:#f0f0f0;font-size:16px;cursor:pointer;">+</button>
        </div>
      </div>
    </div>`;

  if (activeBtnId === 'rotate') return `
    <div style="font-size:9px;color:#999;margin-bottom:4px;">${modelName}</div>
    <div style="font-weight:900;font-size:12px;color:#1a1a1a;margin-bottom:8px;">Rotate</div>
    <div style="display:flex;align-items:center;gap:8px;">
      <button id="rm_rot_left"  style="width:32px;height:32px;border-radius:50%;border:none;background:#f0f0f0;font-size:16px;cursor:pointer;">&#8635;</button>
      <div id="rm_rot_val" style="font-weight:900;font-size:14px;color:#1a1a1a;min-width:44px;text-align:center;">${Math.round(currentRotY * 180/Math.PI)}&#176;</div>
      <button id="rm_rot_right" style="width:32px;height:32px;border-radius:50%;border:none;background:#f0f0f0;font-size:16px;cursor:pointer;">&#8634;</button>
    </div>`;

  if (activeBtnId === 'color') return `
    <div style="font-size:9px;color:#999;margin-bottom:6px;">${modelName}</div>
    <div style="font-weight:900;font-size:12px;color:#1a1a1a;margin-bottom:8px;">Color</div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:center;max-width:120px;">
      ${PRESET_COLORS.map(c=>`
        <div id="rm_color_${c.replace('#','')}" data-color="${c}"
          style="width:20px;height:20px;border-radius:50%;background:${c};cursor:pointer;
          border:2px solid ${c===currentColor?'#1a1a1a':'transparent'};
          transform:scale(${c===currentColor?1.15:1});transition:transform 0.15s;"></div>
      `).join('')}
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-top:8px;">
      <input id="rm_color_custom" type="color" value="${currentColor}"
        style="width:24px;height:24px;border:none;border-radius:4px;cursor:pointer;padding:0;">
      <span style="font-size:9px;color:#999;">Custom</span>
    </div>`;

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
        <button id="rm_dec_${s.name}" style="width:26px;height:26px;border-radius:50%;border:none;background:#f0f0f0;font-size:16px;cursor:pointer;">&#8722;</button>
        <span id="rm_count_${s.name}" style="font-weight:900;font-size:22px;color:#1a1a1a;">${count}</span>
        <button id="rm_inc_${s.name}" style="width:26px;height:26px;border-radius:50%;border:none;background:#f0f0f0;font-size:16px;cursor:pointer;">+</button>
      </div>`;
  }
  return `<div style="font-size:9px;color:#999;">${modelName}</div>`;
}


// ── React wrapper — pure DOM inside ──────────────────────────
export default function RadialMenu({ x, y, modelName, sockets=[], onAction, onClose, wrapperRef, initialColor='#3a6ea5', initialRotY=0, units='ft' }) {
  const rootRef     = useRef(null);
  const stateRef    = useRef({
    open:false, closing:false, activeBtn:null,
    currentR:0, targetR:0,
    radiusRaf:null, closeTimeout:null,
    buttons:[], btnEls:{}, circleEls:{}, cardEl:null,
    currentColor: initialColor,
    currentRotY:  initialRotY,
    arrayState: { count: 1, spacing: 0.1 },
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
      if (state.cardEl) {
        state.cardEl.innerHTML = buildCardHTML(modelName, state.activeBtn, state.buttons, state.socketStates, state.currentColor, state.currentRotY, state.arrayState, units);
        bindCardEvents();
      }
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

    function refreshCard() {
      if (state.cardEl) {
        state.cardEl.innerHTML = buildCardHTML(modelName, state.activeBtn, state.buttons, state.socketStates, state.currentColor, state.currentRotY, state.arrayState, units);
        bindCardEvents();
      }
    }

    function bindCardEvents() {
      // Array
      const UNITS_MAP = { m:{factor:1}, ft:{factor:3.28084}, cm:{factor:100}, inch:{factor:39.3701} };
      const uf = UNITS_MAP[units]?.factor || 1;
      const SPACING_STEP = 1 / uf; // 1 unit in meters

      const arrDec = document.getElementById('rm_arr_dec');
      const arrInc = document.getElementById('rm_arr_inc');
      const spDec  = document.getElementById('rm_sp_dec');
      const spInc  = document.getElementById('rm_sp_inc');

      if (arrDec) arrDec.onclick = () => {
        state.arrayState.count = Math.max(1, state.arrayState.count - 1);
        onAction?.('array', { ...state.arrayState });
        refreshCard();
      };
      if (arrInc) arrInc.onclick = () => {
        state.arrayState.count = Math.min(20, state.arrayState.count + 1);
        onAction?.('array', { ...state.arrayState });
        refreshCard();
      };
      if (spDec) spDec.onclick = () => {
        state.arrayState.spacing = Math.max(0, parseFloat((state.arrayState.spacing - SPACING_STEP).toFixed(4)));
        onAction?.('array', { ...state.arrayState });
        refreshCard();
      };
      if (spInc) spInc.onclick = () => {
        state.arrayState.spacing = parseFloat((state.arrayState.spacing + SPACING_STEP).toFixed(4));
        onAction?.('array', { ...state.arrayState });
        refreshCard();
      };
      const rotLeft  = document.getElementById('rm_rot_left');
      const rotRight = document.getElementById('rm_rot_right');
      if (rotLeft) rotLeft.onclick = () => {
        state.currentRotY -= Math.PI/4;
        onAction?.('rotate', { rotY: state.currentRotY });
        refreshCard();
      };
      if (rotRight) rotRight.onclick = () => {
        state.currentRotY += Math.PI/4;
        onAction?.('rotate', { rotY: state.currentRotY });
        refreshCard();
      };

      // Color presets
      PRESET_COLORS.forEach(c => {
        const el = document.getElementById(`rm_color_${c.replace('#','')}`);
        if (el) el.onclick = () => {
          state.currentColor = c;
          onAction?.('color', { color: c });
          refreshCard();
        };
      });
      // Custom color
      const customInput = document.getElementById('rm_color_custom');
      if (customInput) customInput.oninput = () => {
        state.currentColor = customInput.value;
        onAction?.('color', { color: customInput.value });
      };

      // Socket toggles
      state.buttons.forEach(b => {
        if (!b.socket) return;
        const s = b.socket;
        const toggle = document.getElementById(`rm_toggle_${s.name}`);
        if (toggle) toggle.onclick = () => {
          state.socketStates[s.name] = { ...state.socketStates[s.name], on: !state.socketStates[s.name].on };
          onAction?.('socket', { name:s.name, state:state.socketStates[s.name] });
          refreshCard();
        };
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
    card.innerHTML = buildCardHTML(modelName, null, state.buttons, state.socketStates, state.currentColor, state.currentRotY, state.arrayState, units);
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
      label.style.cssText = `font-family:Figtree,sans-serif;font-weight:500;font-size:9px;color:white;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.4);`;

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
          if (b.id === 'del')    { onAction?.('del'); triggerClose(); }
          else if (b.id === 'rotate') {
            state.currentRotY += Math.PI / 2; // 90°
            onAction?.('rotate', { rotY: state.currentRotY });
            popScale(circle);
          }
          else if (b.id === 'dup') { popScale(circle); onAction?.('dup'); }
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
      style={{ position:'absolute', left:x, top:y, pointerEvents:'all', zIndex:5 }}
      onClick={e=>e.stopPropagation()} />
  );
}
