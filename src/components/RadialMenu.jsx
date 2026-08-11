import React, { useEffect, useRef } from 'react';

// ── Config (identical to prototype) ──────────────────────────
const CFG = {
  baseRadius:           65,
  radiusPerBtn:         5,
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
  fixed:'ti-bulb', distribute:'ti-layout-rows', toggle_mesh:'ti-eye',
  color:'ti-palette', positions:'ti-layout-columns',
  slide_y:'ti-arrows-up-down', slide_x:'ti-arrows-left-right', slide_z:'ti-arrows-move',
};

// ── Button definitions (no angle — assigned dynamically) ─────
const BASE_ACTIONS = [
  { id:'array',  icon:'ti-layout-columns',   label:'Array',     hasProps:true,  size:42 },
  { id:'color',  icon:'ti-palette',          label:'Color',     hasProps:true,  size:42 },
  { id:'rotate', icon:'ti-rotate-clockwise', label:'Rotate',    hasProps:false, size:42 },
  { id:'dup',    icon:'ti-copy',             label:'Duplicate', hasProps:false, size:42 },
  { id:'del',    icon:'ti-trash',            label:'Delete',    hasProps:false, size:42 },
];
const WALL_BASE = [
  { id:'color', icon:'ti-palette',     label:'Color',  hasProps:true,  size:42 },
  { id:'props', icon:'ti-adjustments', label:'Config', hasProps:true,  size:42 },
  { id:'del',   icon:'ti-trash',       label:'Delete', hasProps:false, size:42 },
];
const COLUMN_BASE = [
  { id:'color', icon:'ti-palette',     label:'Color',     hasProps:true,  size:42 },
  { id:'props', icon:'ti-adjustments', label:'Config',    hasProps:true,  size:42 },
  { id:'dup',   icon:'ti-copy',        label:'Duplicate', hasProps:false, size:42 },
  { id:'del',   icon:'ti-trash',       label:'Delete',    hasProps:false, size:42 },
];
const DOOR_BASE = [
  { id:'color', icon:'ti-palette',     label:'Color',  hasProps:true,  size:42 },
  { id:'props', icon:'ti-adjustments', label:'Config', hasProps:true,  size:42 },
  { id:'del',   icon:'ti-trash',       label:'Delete', hasProps:false, size:42 },
];

// Distribute buttons evenly around 360°, starting from -90° (top)
function distributeAngles(btns, startAngle = -90) {
  const step = 360 / btns.length;
  return btns.map((b, i) => ({ ...b, angle: startAngle + step * i }));
}

function buildButtons(sockets=[], itemType=null, paintable=true) {
  if (itemType === 'wall')   return distributeAngles(WALL_BASE);
  if (itemType === 'column') return distributeAngles(COLUMN_BASE);
  if (itemType === 'door')   return distributeAngles(DOOR_BASE);

  // Group sockets with same label into one button
  const groups = {};
  sockets.forEach(s => {
    const label = s.label || s.name;
    if (!groups[label]) groups[label] = [];
    groups[label].push(s);
  });

  const baseActions = paintable ? BASE_ACTIONS : BASE_ACTIONS.filter(b => b.id !== 'color');
  const socketBtns = Object.entries(groups).map(([label, members]) => {
    if (members.length === 1) {
      const s = members[0];
      return { id: s.name, icon: BEHAVIOR_ICONS[s.behavior]||'ti-adjustments',
        label, size: 48, hasProps: s.behavior !== 'fixed', socket: s };
    }
    // Multiple sockets with same label — group button, always opens panel
    return { id: `group_${label}`, icon: BEHAVIOR_ICONS[members[0].behavior]||'ti-bulb',
      label, size: 48, hasProps: true, socketGroup: members };
  });
  // Interleave: socket1, array, socket2, color, socket3, rotate, socket4, dup, del
  const order = [];
  const fixed = [...baseActions];
  const sock  = [...socketBtns];
  // Place sockets between fixed actions for even spread
  const total = fixed.length + sock.length;
  const step  = 360 / total;
  // Merge: fixed actions get priority positions, sockets fill between
  const merged = [];
  let fi = 0, si = 0;
  for (let i = 0; i < total; i++) {
    // Place a socket every other slot if available
    if (si < sock.length && (fi >= fixed.length || i % 2 === 0 && si * 2 <= fi)) {
      merged.push(sock[si++]);
    } else {
      merged.push(fixed[fi++]);
    }
  }
  return distributeAngles(merged);
}

function angleDiff(a,b) { let d=((b-a)+180)%360-180; return d<-180?d+360:d; }

const PRESET_COLORS = [
  '#3a6ea5','#e8e0d0','#2d2d2d','#ffffff','#c4622d',
  '#4a7c5e','#8b4a6b','#d4a843','#6b6b6b','#1a3a5c',
];

function buildCardHTML(modelName, activeBtnId, buttons, socketStates, currentColor='#3a6ea5', currentRotY=0, arrayState={count:1,spacing:0}, units='ft', wallProps=null) {
  const UNITS_MAP = { m:{label:'m',factor:1}, ft:{label:'ft',factor:3.28084}, cm:{label:'cm',factor:100}, inch:{label:'in',factor:39.3701} };
  const u = UNITS_MAP[units] || UNITS_MAP.m;
  const spacingDisplay = (arrayState.spacing * u.factor).toFixed(units==='m'?2:1);

  if (!activeBtnId) return `<div style="font-size:9px;color:#999;">${modelName}</div>`;

  // Wall/column/door props card
  if (activeBtnId === 'props' && wallProps) {
    const wp = wallProps;
    const isWall = wp.itemType === 'wall';
    const isDoor = wp.itemType === 'door';
    const isCol  = wp.itemType === 'column';
    const hDisplay = (wp.height * u.factor).toFixed(units==='m'?2:1);
    const tDisplay = wp.thickness != null ? (wp.thickness * u.factor).toFixed(units==='m'?3:2) : null;
    return `
      <div style="font-size:9px;color:#999;margin-bottom:4px;">${modelName}</div>
      <div style="font-weight:900;font-size:12px;color:#1a1a1a;margin-bottom:8px;">Properties</div>
      <div style="display:flex;flex-direction:column;gap:8px;min-width:140px;">
        ${isWall||isCol ? `
        <div>
          <div style="font-size:9px;color:#999;margin-bottom:3px;">Height (${u.label})</div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button id="rm_h_dec" style="width:22px;height:22px;border-radius:50%;border:none;background:#f0f0f0;cursor:pointer;">&#8722;</button>
            <span id="rm_h_val" style="font-weight:700;font-size:14px;min-width:36px;text-align:center;">${hDisplay}</span>
            <button id="rm_h_inc" style="width:22px;height:22px;border-radius:50%;border:none;background:#f0f0f0;cursor:pointer;">+</button>
          </div>
        </div>` : ''}
        ${isWall ? `
        <div>
          <div style="font-size:9px;color:#999;margin-bottom:3px;">Thickness (${u.label})</div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button id="rm_t_dec" style="width:22px;height:22px;border-radius:50%;border:none;background:#f0f0f0;cursor:pointer;">&#8722;</button>
            <span id="rm_t_val" style="font-weight:700;font-size:14px;min-width:36px;text-align:center;">${tDisplay}</span>
            <button id="rm_t_inc" style="width:22px;height:22px;border-radius:50%;border:none;background:#f0f0f0;cursor:pointer;">+</button>
          </div>
        </div>
        <div>
          <div style="font-size:9px;color:#999;margin-bottom:3px;">Glass — ${Math.round((wp.glassRatio||0)*100)}%</div>
          <input id="rm_glass" type="range" min="0" max="1" step="0.05" value="${wp.glassRatio||0}"
            style="width:100%;accent-color:#b48b31;" />
        </div>` : ''}
        ${isDoor ? `
        <div>
          <div style="font-size:9px;color:#999;margin-bottom:3px;">Open — ${Math.round(wp.openAngle||45)}°</div>
          <input id="rm_open" type="range" min="-90" max="90" step="1" value="${wp.openAngle||45}"
            style="width:100%;accent-color:#b48b31;" />
        </div>` : ''}
        ${isCol ? `
        <div>
          <div style="font-size:9px;color:#999;margin-bottom:3px;">Width (${u.label})</div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button id="rm_w_dec" style="width:22px;height:22px;border-radius:50%;border:none;background:#f0f0f0;cursor:pointer;">&#8722;</button>
            <span id="rm_w_val" style="font-weight:700;font-size:14px;min-width:36px;text-align:center;">${((wp.width||0.3)*u.factor).toFixed(units==='m'?2:1)}</span>
            <button id="rm_w_inc" style="width:22px;height:22px;border-radius:50%;border:none;background:#f0f0f0;cursor:pointer;">+</button>
          </div>
        </div>
        <div>
          <div style="font-size:9px;color:#999;margin-bottom:3px;">Shape</div>
          <div style="display:flex;gap:4px;">
            <button id="rm_sq" style="flex:1;padding:4px;border-radius:6px;border:none;font-size:10px;cursor:pointer;
              background:${wp.shape==='square'?'#1a1a1a':'#f0f0f0'};color:${wp.shape==='square'?'white':'#666'};">Square</button>
            <button id="rm_ci" style="flex:1;padding:4px;border-radius:6px;border:none;font-size:10px;cursor:pointer;
              background:${wp.shape==='circle'?'#1a1a1a':'#f0f0f0'};color:${wp.shape==='circle'?'white':'#666'};">Circle</button>
          </div>
        </div>` : ''}
      </div>`;
  }

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
      <div style="border-top:1px solid #f0f0f0;padding-top:8px;">
        <div style="font-size:9px;color:#999;margin-bottom:5px;">Units</div>
        <div style="display:flex;gap:4px;">
          ${['m','ft','cm','in'].map(ul => {
            const key = ul === 'in' ? 'inch' : ul;
            const active = key === units;
            return `<button id="rm_unit_${key}" style="flex:1;padding:4px 0;border-radius:6px;border:none;font-size:10px;font-weight:${active?700:500};cursor:pointer;background:${active?'#1a1a1a':'#f0f0f0'};color:${active?'white':'#666'};">${ul}</button>`;
          }).join('')}
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
  if (!btn) return `<div style="font-size:9px;color:#999;">${modelName}</div>`;

  // Socket group — grid of individual toggles
  if (btn.socketGroup) {
    const members = btn.socketGroup;
    const label = btn.label;
    return `
      <div style="font-size:9px;color:#999;margin-bottom:4px;">${modelName}</div>
      <div style="font-weight:900;font-size:12px;color:#1a1a1a;margin-bottom:8px;">${label}</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;width:100px;">
        ${members.map((s, i) => {
          const on = (socketStates[s.name] || s.state || {}).on;
          return `<div id="rm_grp_${s.name.replace(/\./g,'_')}"
            data-socket="${s.name}"
            style="width:44px;height:44px;border-radius:8px;cursor:pointer;
              background:${on ? ACCENT : '#e8e8e8'};
              display:flex;align-items:center;justify-content:center;
              font-size:11px;font-weight:700;color:${on ? 'white' : '#666'};
              border:2px solid ${on ? ACCENT : 'transparent'};
              transition:all 0.15s;">
            ${i + 1}
          </div>`;
        }).join('')}
      </div>
      <div style="font-size:9px;color:#aaa;margin-top:6px;">Tap to toggle each</div>`;
  }

  if (!btn.socket) return `<div style="font-size:9px;color:#999;">${modelName}</div>`;
  const s = btn.socket, state = socketStates[s.name] || s.state || {};

  if (s.behavior === 'fixed' || s.behavior === 'toggle_mesh') {
    const on = state.on;
    const isMeshToggle = s.behavior === 'toggle_mesh';
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
    const count   = state.count   ?? 0;
    const spacing = state.spacing ?? 0.15;
    const baseY   = state.baseY   ?? 0;
    const UNITS_MAP2 = { m:{factor:1}, ft:{factor:3.28084}, cm:{factor:100}, inch:{factor:39.3701} };
    const u = UNITS_MAP2[units] || UNITS_MAP2.ft;
    const spDisplay  = (spacing * u.factor).toFixed(units==='m'?2:1);
    const baseDisplay= (baseY   * u.factor).toFixed(units==='m'?2:1);
    return `
      <div style="font-size:9px;color:#999;margin-bottom:2px;">${modelName}</div>
      <div style="font-weight:900;font-size:12px;color:#1a1a1a;margin-bottom:6px;">${s.label}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <button id="rm_dec_${s.name}" style="width:26px;height:26px;border-radius:50%;border:none;background:#f0f0f0;font-size:16px;cursor:pointer;">&#8722;</button>
        <span id="rm_count_${s.name}" style="font-weight:900;font-size:22px;color:#1a1a1a;min-width:24px;text-align:center;">${count}</span>
        <button id="rm_inc_${s.name}" style="width:26px;height:26px;border-radius:50%;border:none;background:#f0f0f0;font-size:16px;cursor:pointer;">+</button>
      </div>
      <div style="font-size:10px;color:#666;margin-bottom:2px;">Spacing (${units})</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <button id="rm_sp_dec_${s.name}" style="width:22px;height:22px;border-radius:50%;border:none;background:#f0f0f0;font-size:14px;cursor:pointer;">&#8722;</button>
        <span id="rm_sp_val_${s.name}" style="font-weight:700;font-size:14px;color:#1a1a1a;min-width:28px;text-align:center;">${spDisplay}</span>
        <button id="rm_sp_inc_${s.name}" style="width:22px;height:22px;border-radius:50%;border:none;background:#f0f0f0;font-size:14px;cursor:pointer;">+</button>
      </div>
      <div style="font-size:10px;color:#666;margin-bottom:2px;">Base height (${units})</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button id="rm_by_dec_${s.name}" style="width:22px;height:22px;border-radius:50%;border:none;background:#f0f0f0;font-size:14px;cursor:pointer;">&#8722;</button>
        <span id="rm_by_val_${s.name}" style="font-weight:700;font-size:14px;color:#1a1a1a;min-width:28px;text-align:center;">${baseDisplay}</span>
        <button id="rm_by_inc_${s.name}" style="width:22px;height:22px;border-radius:50%;border:none;background:#f0f0f0;font-size:14px;cursor:pointer;">+</button>
      </div>`;
  }
  if (s.behavior === 'positions') {
    const positions = s.socketPositions || [];
    const total     = positions.length; // number of Blender empties
    const posIdx    = state.positionIndex ?? -1; // -1 = off
    const labels    = positions.map((p,i) => p.name.replace(/.*\./, '') || (i+1));
    return `
      <div style="font-size:9px;color:#999;margin-bottom:4px;">${modelName}</div>
      <div style="font-weight:900;font-size:12px;color:#1a1a1a;margin-bottom:8px;">${s.label}</div>
      <div style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#999;margin-bottom:4px;">
          <span>Off</span>
          <span>${posIdx < 0 ? 'Off' : 'Position ' + (posIdx+1) + ' / ' + total}</span>
          <span>${total}</span>
        </div>
        <input id="rm_pos_${s.name}" type="range" min="-1" max="${total-1}" step="1" value="${posIdx}"
          style="width:100%;accent-color:#b48b31;" />
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">
        <button id="rm_pos_off_${s.name}" style="flex:1;padding:4px 8px;border-radius:6px;border:none;font-size:11px;cursor:pointer;
          background:${posIdx===-1?'#1a1a1a':'#f0f0f0'};color:${posIdx===-1?'white':'#666'};">Off</button>
        ${positions.map((p,i) => `
          <button id="rm_pos_${i}_${s.name}" style="flex:1;padding:4px 8px;border-radius:6px;border:none;font-size:11px;cursor:pointer;
            background:${posIdx===i?'#b48b31':'#f0f0f0'};color:${posIdx===i?'white':'#666'};">
            ${p.name.split('.').pop()}
          </button>
        `).join('')}
      </div>`;
  }
  return `<div style="font-size:9px;color:#999;">${modelName}</div>`;
}


// ── React wrapper — pure DOM inside ──────────────────────────
export default function RadialMenu({ x, y, modelName, sockets=[], onAction, onClose, wrapperRef, initialColor='#3a6ea5', initialRotY=0, units='ft', initialArrayState=null, itemType=null, wallProps=null, initialActiveBtn=null }) {
  const rootRef     = useRef(null);
  const unitsRef    = useRef(units);
  const stateRef    = useRef({
    open:false, closing:false, activeBtn:null,
    currentR:0, targetR:0,
    radiusRaf:null, closeTimeout:null,
    buttons:[], btnEls:{}, circleEls:{}, cardEl:null,
    currentColor: initialColor,
    currentRotY:  initialRotY,
    arrayState: initialArrayState ? { count: initialArrayState.count, spacing: initialArrayState.spacing } : { count: 1, spacing: 0 },
    socketStates: Object.fromEntries(sockets.map(s=>[s.name,{
      ...(s.behavior==='distribute' ? { spacing: 0.15, baseY: 0, count: 0 } : {}),
      ...(s.state||{})
    }])),
  });

  // Keep unitsRef current and refresh card when units change
  useEffect(() => {
    unitsRef.current = units;
    const state = stateRef.current;
    if (state.cardEl && state.activeBtn) {
      state.cardEl.innerHTML = buildCardHTML(modelName, state.activeBtn, state.buttons, state.socketStates, state.currentColor, state.currentRotY, state.arrayState, units, state.wallProps);
      state._bindCardEvents?.();
    }
  }, [units]);

  useEffect(() => {
    const root  = rootRef.current;
    const state = stateRef.current;
    if (!root) return;

    state.buttons = buildButtons(sockets, itemType, paintableRef.current);
    state.wallProps = wallProps ? { ...wallProps } : null;
    if (initialActiveBtn) { state.activeBtn = initialActiveBtn; }

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
      // Update card HTML first so we can measure it
      if (state.cardEl) {
        state.cardEl.innerHTML = buildCardHTML(modelName, state.activeBtn, state.buttons, state.socketStates, state.currentColor, state.currentRotY, state.arrayState, unitsRef.current, state.wallProps);
        bindCardEvents();
      }
      // Measure after browser renders the new card content
      requestAnimationFrame(() => {
        state.targetR = getRadius(id);
        cancelAnimationFrame(state.radiusRaf);
        animateRadius();
      });
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
      if (!active) return base;
      // Measure actual card size to ensure buttons clear it
      if (state.cardEl) {
        const rect = state.cardEl.getBoundingClientRect();
        const halfDiag = Math.sqrt(rect.width*rect.width + rect.height*rect.height) / 2;
        return Math.max(base + 20, halfDiag + 30);
      }
      return base + 20;
    }

    function refreshCard() {
      if (state.cardEl) {
        state.cardEl.innerHTML = buildCardHTML(modelName, state.activeBtn, state.buttons, state.socketStates, state.currentColor, state.currentRotY, state.arrayState, unitsRef.current, state.wallProps);
        bindCardEvents();
      }
    }

    function bindCardEvents() {
      state._bindCardEvents = bindCardEvents; // expose for units refresh
      // Array
      const UNITS_MAP = { m:{factor:1}, ft:{factor:3.28084}, cm:{factor:100}, inch:{factor:39.3701} };
      const uf = UNITS_MAP[unitsRef.current]?.factor || 1;
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

      // Unit buttons
      ['m','ft','cm','inch'].forEach(key => {
        const el = document.getElementById(`rm_unit_${key}`);
        if (el) el.onclick = () => {
          onAction?.('units', { units: key });
        };
      });
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

      // Socket group grid toggles
      state.buttons.forEach(b => {
        if (!b.socketGroup) return;
        b.socketGroup.forEach(s => {
          const safeId = s.name.replace(/\./g, '_');
          const el = document.getElementById(`rm_grp_${safeId}`);
          if (!el) return;
          el.onclick = () => {
            const curOn = state.socketStates[s.name]?.on;
            state.socketStates[s.name] = { ...state.socketStates[s.name], on: !curOn };
            onAction?.('socket', { name: s.name, state: state.socketStates[s.name] });
            // Update button color immediately without full refresh
            const isOn = !curOn;
            el.style.background = isOn ? ACCENT : '#e8e8e8';
            el.style.color = isOn ? 'white' : '#666';
            el.style.borderColor = isOn ? ACCENT : 'transparent';
            // Also update the radial button color
            const radialCircle = state.circleEls[b.id];
            if (radialCircle) {
              const anyOn = b.socketGroup.some(m => state.socketStates[m.name]?.on);
              radialCircle.style.background = anyOn ? ACCENT : 'white';
              const icon = radialCircle.querySelector('i');
              if (icon) icon.style.color = anyOn ? 'white' : '#1a1a1a';
            }
          };
        });
      });

      // Socket toggles
      state.buttons.forEach(b => {
        if (!b.socket) return;
        const s = b.socket;
        const toggle = document.getElementById(`rm_toggle_${s.name}`);
        if (toggle) toggle.onclick = () => {
          const curOn = state.socketStates[s.name]?.on;
          state.socketStates[s.name] = { ...state.socketStates[s.name], on: !curOn };
          if (s.behavior === 'toggle_mesh') {
            // Direct mesh visibility toggle
            onAction?.('toggle_mesh', { meshName: s.name, visible: !curOn });
          } else {
            onAction?.('socket', { name:s.name, state:state.socketStates[s.name] });
          }
          refreshCard();
        };
        const dec = document.getElementById(`rm_dec_${s.name}`);
        const inc = document.getElementById(`rm_inc_${s.name}`);
        if (dec) dec.onclick = () => {
          state.socketStates[s.name].count = Math.max(0, (state.socketStates[s.name].count||0)-1);
          onAction?.('socket',{name:s.name,state:state.socketStates[s.name]});
          const el = document.getElementById(`rm_count_${s.name}`);
          if (el) el.textContent = state.socketStates[s.name].count;
        };
        if (inc) inc.onclick = () => {
          state.socketStates[s.name].count = Math.min(s.max||4, (state.socketStates[s.name].count||0)+1);
          onAction?.('socket',{name:s.name,state:state.socketStates[s.name]});
          const el = document.getElementById(`rm_count_${s.name}`);
          if (el) el.textContent = state.socketStates[s.name].count;
        };
        // Spacing controls
        const UNITS_MAP2 = { m:{factor:1}, ft:{factor:3.28084}, cm:{factor:100}, inch:{factor:39.3701} };
        const u = UNITS_MAP2[unitsRef.current] || UNITS_MAP2.ft;
        const STEP_SP = 0.1 / u.factor; // 0.1 display units in meters
        const spDec = document.getElementById(`rm_sp_dec_${s.name}`);
        const spInc = document.getElementById(`rm_sp_inc_${s.name}`);
        if (spDec) spDec.onclick = () => {
          state.socketStates[s.name].spacing = Math.max(0, parseFloat(((state.socketStates[s.name].spacing||0) - STEP_SP).toFixed(4)));
          onAction?.('socket',{name:s.name,state:state.socketStates[s.name]});
          const el = document.getElementById(`rm_sp_val_${s.name}`);
          if (el) el.textContent = (state.socketStates[s.name].spacing * u.factor).toFixed(1);
        };
        if (spInc) spInc.onclick = () => {
          state.socketStates[s.name].spacing = parseFloat(((state.socketStates[s.name].spacing||0) + STEP_SP).toFixed(4));
          onAction?.('socket',{name:s.name,state:state.socketStates[s.name]});
          const el = document.getElementById(`rm_sp_val_${s.name}`);
          if (el) el.textContent = (state.socketStates[s.name].spacing * u.factor).toFixed(1);
        };
        // Base height controls
        const STEP_BY = 0.1 / u.factor;
        const byDec = document.getElementById(`rm_by_dec_${s.name}`);
        const byInc = document.getElementById(`rm_by_inc_${s.name}`);
        if (byDec) byDec.onclick = () => {
          state.socketStates[s.name].baseY = parseFloat(((state.socketStates[s.name].baseY||0) - STEP_BY).toFixed(4));
          onAction?.('socket',{name:s.name,state:state.socketStates[s.name]});
          const el = document.getElementById(`rm_by_val_${s.name}`);
          if (el) el.textContent = (state.socketStates[s.name].baseY * u.factor).toFixed(1);
        };
        if (byInc) byInc.onclick = () => {
          state.socketStates[s.name].baseY = parseFloat(((state.socketStates[s.name].baseY||0) + STEP_BY).toFixed(4));
          onAction?.('socket',{name:s.name,state:state.socketStates[s.name]});
          const el = document.getElementById(`rm_by_val_${s.name}`);
          if (el) el.textContent = (state.socketStates[s.name].baseY * u.factor).toFixed(1);
        };
        // Positions slider
        const posSlider = document.getElementById(`rm_pos_${s.name}`);
        const setPos = (idx) => {
          state.socketStates[s.name] = { ...state.socketStates[s.name], positionIndex: idx };
          onAction?.('socket', { name: s.name, state: state.socketStates[s.name] });
          refreshCard();
        };
        if (posSlider) posSlider.oninput = () => setPos(parseInt(posSlider.value));
        const offBtn = document.getElementById(`rm_pos_off_${s.name}`);
        if (offBtn) offBtn.onclick = () => setPos(-1);
        (s.socketPositions||[]).forEach((p,i) => {
          const btn = document.getElementById(`rm_pos_${i}_${s.name}`);
          if (btn) btn.onclick = () => setPos(i);
        });
      });

      // Wall/column/door props bindings
      if (state.wallProps) {
        const wp = state.wallProps;
        const STEP_H = 0.1, STEP_T = 0.01;
        const hDec = document.getElementById('rm_h_dec');
        const hInc = document.getElementById('rm_h_inc');
        const tDec = document.getElementById('rm_t_dec');
        const tInc = document.getElementById('rm_t_inc');
        const glass = document.getElementById('rm_glass');
        const open  = document.getElementById('rm_open');
        const sqBtn = document.getElementById('rm_sq');
        const ciBtn = document.getElementById('rm_ci');
        const emit  = () => onAction?.('wallProps', { ...wp });
        if (hDec) hDec.onclick = () => { wp.height = Math.max(0.5, parseFloat((wp.height-STEP_H).toFixed(2))); emit(); refreshCard(); };
        if (hInc) hInc.onclick = () => { wp.height = parseFloat((wp.height+STEP_H).toFixed(2)); emit(); refreshCard(); };
        if (tDec) tDec.onclick = () => { wp.thickness = Math.max(0.05, parseFloat((wp.thickness-STEP_T).toFixed(3))); emit(); refreshCard(); };
        if (tInc) tInc.onclick = () => { wp.thickness = parseFloat((wp.thickness+STEP_T).toFixed(3)); emit(); refreshCard(); };
        if (glass) glass.oninput = () => { wp.glassRatio = parseFloat(glass.value); emit(); };
        if (open)  open.oninput  = () => { wp.openAngle  = parseFloat(open.value);  emit(); };
        const wDec = document.getElementById('rm_w_dec');
        const wInc = document.getElementById('rm_w_inc');
        const STEP_W = 0.05;
        if (wDec) wDec.onclick = () => { wp.width = wp.depth = Math.max(0.1, parseFloat(((wp.width||0.3)-STEP_W).toFixed(2))); emit(); refreshCard(); };
        if (wInc) wInc.onclick = () => { wp.width = wp.depth = parseFloat(((wp.width||0.3)+STEP_W).toFixed(2)); emit(); refreshCard(); };
        if (sqBtn) sqBtn.onclick = () => { wp.shape = 'square'; emit(); refreshCard(); };
        if (ciBtn) ciBtn.onclick = () => { wp.shape = 'circle'; emit(); refreshCard(); };
      }
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
    card.innerHTML = buildCardHTML(modelName, null, state.buttons, state.socketStates, state.currentColor, state.currentRotY, state.arrayState, unitsRef.current);
    root.appendChild(card);
    state.cardEl = card;

    // Buttons — z-index:1, below card
    state.buttons.forEach(b => {
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;left:0;top:0;transform:translate(-50%,-50%);
        display:flex;flex-direction:column;align-items:center;gap:3px;
        cursor:pointer;opacity:0;z-index:1;transition:left 0s, top 0s;`;

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

      // If fixed socket is already on, show active color immediately
      if (b.socket?.behavior === 'fixed' && state.socketStates[b.socket.name]?.on) {
        circle.style.background = ACCENT;
        const icon = circle.querySelector('i');
        if (icon) icon.style.color = 'white';
      }
      // If socket group has any on, show active color
      if (b.socketGroup) {
        const anyOn = b.socketGroup.some(s => state.socketStates[s.name]?.on);
        if (anyOn) {
          circle.style.background = ACCENT;
          const icon = circle.querySelector('i');
          if (icon) icon.style.color = 'white';
        }
      }

      circle.addEventListener('mouseenter', () => { circle.style.background='#f5f5f5'; applyHoverNudge(b.id); });
      circle.addEventListener('mouseleave', () => {
        const isFixedOn = b.socket?.behavior === 'fixed' && state.socketStates[b.socket.name]?.on;
        const isGroupOn = b.socketGroup?.some(s => state.socketStates[s.name]?.on);
        circle.style.background = (state.activeBtn===b.id || isFixedOn || isGroupOn) ? ACCENT : 'white';
        applyHoverNudge(null);
      });

      el.addEventListener('click', e => {
        e.stopPropagation();
        // Fixed socket — toggle directly on the button, no panel
        if (b.socket?.behavior === 'fixed') {
          const curOn = state.socketStates[b.socket.name]?.on;
          state.socketStates[b.socket.name] = { ...state.socketStates[b.socket.name], on: !curOn };
          onAction?.('socket', { name: b.socket.name, state: state.socketStates[b.socket.name] });
          const isOn = !curOn;
          circle.style.background = isOn ? ACCENT : 'white';
          const icon = circle.querySelector('i');
          if (icon) icon.style.color = isOn ? 'white' : '#1a1a1a';
          popScale(circle);
          return;
        }
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

    // Enable smooth nudge transition after open animation completes
    const nudgeDelay = 60 + state.buttons.length * 35 + 80;
    setTimeout(() => {
      Object.values(state.btnEls).forEach(el => {
        if (el) el.style.transition = 'left 0.22s cubic-bezier(0.34,1.1,0.64,1), top 0.22s cubic-bezier(0.34,1.1,0.64,1)';
      });
      // Auto-open initialActiveBtn card
      if (initialActiveBtn) {
        const btn = state.buttons.find(b => b.id === initialActiveBtn);
        if (btn && btn.hasProps) {
          const circleEl = state.circleEls[initialActiveBtn];
          setActiveBtn(initialActiveBtn, circleEl);
        }
      }
    }, nudgeDelay);

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

















