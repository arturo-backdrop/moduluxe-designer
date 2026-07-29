import React, { useState, useEffect, useRef } from 'react';

const CFG = {
  baseRadius: 80, radiusPerBtn: 6, radiusSpeed: 0.22,
  closeAnimDuration: 180, closeMinScale: 0.3, closeStagger: 20,
  nudgeDistance: 12, nudgeAngleRange: 80,
};

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

function CardContent({ modelName, activeBtn, buttons, socketStates, onSocketChange }) {
  if (!activeBtn) return (
    <div>
      <div style={{ fontSize:9, color:'#999', marginBottom:4 }}>{modelName}</div>
      <div style={{ fontWeight:900, fontSize:13, marginTop:4 }}>Object</div>
    </div>
  );
  const btn = buttons.find(b=>b.id===activeBtn);
  if (!btn?.socket) return <div style={{ fontSize:9, color:'#999' }}>{modelName}</div>;
  const s=btn.socket, state=socketStates[s.name]||s.state||{};
  if (s.behavior==='fixed') return (
    <div>
      <div style={{ fontSize:9, color:'#999', marginBottom:4 }}>{modelName}</div>
      <div style={{ fontWeight:900, fontSize:12 }}>{s.label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
        <div style={{ width:34, height:18, borderRadius:9, position:'relative', cursor:'pointer',
          background:state.on?'#b48b31':'#e0e0e0', transition:'background 0.2s', flexShrink:0 }}
          onClick={()=>onSocketChange(s.name,{on:!state.on})}>
          <div style={{ position:'absolute', width:14, height:14, borderRadius:'50%', background:'white',
            top:2, left:state.on?18:2, transition:'left 0.2s' }}/>
        </div>
        <span style={{ fontSize:11, color:'#666' }}>{state.on?'On':'Off'}</span>
      </div>
    </div>
  );
  if (s.behavior==='distribute') {
    const count=state.count??1;
    return (
      <div>
        <div style={{ fontSize:9, color:'#999', marginBottom:4 }}>{modelName}</div>
        <div style={{ fontWeight:900, fontSize:12 }}>{s.label}</div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:6 }}>
          <button style={{ width:26,height:26,borderRadius:'50%',border:'none',background:'#f0f0f0',fontSize:16,cursor:'pointer' }}
            onClick={()=>onSocketChange(s.name,{...state,count:Math.max(1,count-1)})}>−</button>
          <span style={{ fontWeight:900, fontSize:22 }}>{count}</span>
          <button style={{ width:26,height:26,borderRadius:'50%',border:'none',background:'#f0f0f0',fontSize:16,cursor:'pointer' }}
            onClick={()=>onSocketChange(s.name,{...state,count:Math.min(s.max||5,count+1)})}>+</button>
        </div>
      </div>
    );
  }
  return <div style={{ fontSize:9, color:'#999' }}>{modelName}</div>;
}

export default function RadialMenu({ x, y, modelName, sockets=[], accentColor='#b48b31', onAction, onClose, wrapperRef }) {
  const [activeBtn,    setActiveBtn]    = useState(null);
  const [currentR,     setCurrentR]    = useState(0);
  const [targetR,      setTargetR]     = useState(0);
  const [btnStyles,    setBtnStyles]   = useState({});
  const [cardStyle,    setCardStyle]   = useState({ opacity:0, transform:'translate(-50%,-50%) scale(0.8)' });
  const [closing,      setClosing]     = useState(false);
  const [hoveredBtn,   setHoveredBtn]  = useState(null);
  const [socketStates, setSocketStates]= useState(()=>{
    const s={}; sockets.forEach(sock=>{s[sock.name]={...(sock.state||{})}}); return s;
  });
  const rafRef      = useRef(null);
  const currentRRef = useRef(0);
  const targetRRef  = useRef(0);
  const buttons     = buildButtons(sockets);

  function getRadius(active) {
    const base = CFG.baseRadius + Math.max(0, buttons.length-4)*CFG.radiusPerBtn;
    return active ? base+20 : base;
  }

  // Radius spring
  useEffect(()=>{
    targetRRef.current=targetR;
    function tick() {
      const diff=targetRRef.current-currentRRef.current;
      if (Math.abs(diff)>0.4) {
        currentRRef.current+=diff*CFG.radiusSpeed;
        setCurrentR(currentRRef.current);
        rafRef.current=requestAnimationFrame(tick);
      } else {
        currentRRef.current=targetRRef.current;
        setCurrentR(targetRRef.current);
      }
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(rafRef.current);
  },[targetR]);

  // Open animation
  useEffect(()=>{
    setTargetR(getRadius(null));
    // Fade in card
    requestAnimationFrame(()=>{
      setCardStyle({ opacity:1, transform:'translate(-50%,-50%) scale(1)', transition:'opacity 0.18s ease, transform 0.25s cubic-bezier(0.34,1.2,0.64,1)' });
    });
    // Stagger buttons
    buttons.forEach((b,i)=>{
      setTimeout(()=>{
        setBtnStyles(prev=>({...prev, [b.id]:{ opacity:1, transform:'translate(-50%,-50%) scale(1)' }}));
      }, 20+i*20);
    });
  },[]);

  // Close with animation, then call onClose
  function triggerClose() {
    if (closing) return;
    setClosing(true);
    setCardStyle({ opacity:0, transform:'translate(-50%,-50%) scale(0.7)', transition:`opacity ${CFG.closeAnimDuration}ms ease, transform ${CFG.closeAnimDuration}ms cubic-bezier(0.4,0,1,1)` });
    buttons.forEach((b,i)=>{
      setTimeout(()=>{
        setBtnStyles(prev=>({...prev,[b.id]:{ opacity:0, transform:`translate(-50%,-50%) scale(${CFG.closeMinScale})`, transition:`opacity ${CFG.closeAnimDuration}ms ease, transform ${CFG.closeAnimDuration}ms cubic-bezier(0.4,0,1,1)` }}));
      }, i*CFG.closeStagger);
    });
    const total = CFG.closeAnimDuration + buttons.length*CFG.closeStagger;
    setTimeout(()=>onClose?.(), total);
  }

  function handleBtnClick(btn, e) {
    e.stopPropagation();
    if (!btn.hasProps) {
      if (btn.id==='del') { onAction?.('del'); triggerClose(); }
      else { onAction?.(btn.id); }
      return;
    }
    const next = activeBtn===btn.id ? null : btn.id;
    setActiveBtn(next);
    setTargetR(getRadius(next));
  }

  function getBtnPos(btn) {
    const rad=btn.angle*Math.PI/180;
    const bx=currentR*Math.cos(rad), by=currentR*Math.sin(rad);
    if (!hoveredBtn||hoveredBtn===btn.id) return {x:bx,y:by};
    const hb=buttons.find(b=>b.id===hoveredBtn);
    if (!hb) return {x:bx,y:by};
    const diff=angleDiff(hb.angle,btn.angle);
    if (Math.abs(diff)<CFG.nudgeAngleRange) {
      const nudge=(1-Math.abs(diff)/CFG.nudgeAngleRange)*CFG.nudgeDistance;
      const sign=diff>0?1:-1;
      const hr=hb.angle*Math.PI/180;
      return {x:bx-Math.sin(hr)*sign*nudge, y:by+Math.cos(hr)*sign*nudge};
    }
    return {x:bx,y:by};
  }

  return (
    <div ref={wrapperRef} style={{ position:'absolute', left:x, top:y, pointerEvents:'all', zIndex:100 }}
      onClick={e=>e.stopPropagation()}>

      {/* Ring */}
      <svg style={{ position:'absolute', left:-(currentR+40), top:-(currentR+40), pointerEvents:'none' }}
        width={(currentR+40)*2} height={(currentR+40)*2}>
        <circle cx={currentR+40} cy={currentR+40} r={currentR+24}
          fill="none" stroke={accentColor+'40'} strokeWidth={1.5} strokeDasharray="4 6"/>
      </svg>

      {/* Center card */}
      <div style={{ position:'absolute', ...cardStyle, background:'white', borderRadius:14,
        padding:'10px 14px 9px', boxShadow:'0 4px 20px rgba(0,0,0,0.13)', minWidth:90,
        display:'flex', flexDirection:'column', gap:4, fontFamily:'Figtree,sans-serif' }}>
        <CardContent modelName={modelName} activeBtn={activeBtn} buttons={buttons}
          socketStates={socketStates} onSocketChange={(n,s)=>{ setSocketStates(p=>({...p,[n]:s})); onAction?.('socket',{name:n,state:s}); }}/>
      </div>

      {/* Buttons */}
      {buttons.map(btn=>{
        const pos=getBtnPos(btn);
        const isActive=activeBtn===btn.id;
        const bs=btnStyles[btn.id]||{ opacity:0, transform:'translate(-50%,-50%) scale(0.5)' };
        return (
          <div key={btn.id} style={{ position:'absolute', left:pos.x, top:pos.y,
            ...bs,
            transition: bs.transition || 'left 0.3s cubic-bezier(0.34,1.4,0.64,1), top 0.3s cubic-bezier(0.34,1.4,0.64,1), opacity 0.2s, transform 0.25s cubic-bezier(0.34,1.2,0.64,1)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', userSelect:'none' }}
            onMouseEnter={()=>setHoveredBtn(btn.id)} onMouseLeave={()=>setHoveredBtn(null)}
            onClick={e=>handleBtnClick(btn,e)}>
            <div style={{ width:btn.size, height:btn.size, borderRadius:'50%',
              background:isActive?accentColor:'white', display:'flex', alignItems:'center',
              justifyContent:'center', boxShadow:'0 3px 12px rgba(0,0,0,0.10)',
              transition:'background 0.18s' }}>
              <i className={`ti ${btn.icon}`} style={{ fontSize:Math.round(btn.size*0.42), color:isActive?'white':'#1a1a1a' }}/>
            </div>
            <span style={{ fontSize:9, color:'#999', whiteSpace:'nowrap', fontFamily:'Figtree,sans-serif', fontWeight:500 }}>
              {btn.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
