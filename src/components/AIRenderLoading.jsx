import React, { useState, useEffect, useRef } from 'react';

const PHASES = [
  'Analyzing your booth structure...',
  'Building the trade show environment...',
  'Placing your booth in the real world...',
  'Applying your brand identity...',
  'Adding lighting and atmosphere...',
  'Populating with attendees...',
  'Rendering final details...',
  'Almost ready...',
];

// Simulated duration in ms (change to real timeout when backend is ready)
const SIMULATE_MS = 6000;

export default function AIRenderLoading({ onComplete }) {
  const canvasRef      = useRef(null);
  const mouseRef       = useRef({ x: 0.5, y: 0.5 });
  const animFrameRef   = useRef(null);
  const [phase, setPhase]       = useState(0);
  const [progress, setProgress] = useState(0);
  const [ripples, setRipples]   = useState([]);

  // Phase cycling
  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(p => (p + 1) % PHASES.length);
    }, SIMULATE_MS / PHASES.length);
    return () => clearInterval(interval);
  }, []);

  // Progress bar
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / SIMULATE_MS, 1);
      setProgress(p);
      if (p < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        setTimeout(() => onComplete?.({ imageUrl: null, simulated: true }), 400);
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [onComplete]);

  // Interactive grid canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const cols = 24, rows = 16;
      const mx = mouseRef.current.x * W;
      const my = mouseRef.current.y * H;
      const radius = Math.min(W, H) * 0.35;

      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          const bx = (c / cols) * W;
          const by = (r / rows) * H;
          const dist = Math.hypot(bx - mx, by - my);
          const pull = Math.max(0, 1 - dist / radius);
          const x = bx + (mx - bx) * pull * 0.18;
          const y = by + (my - by) * pull * 0.18;
          const alpha = 0.06 + pull * 0.18;

          // dots at intersections
          ctx.beginPath();
          ctx.arc(x, y, 1.5 + pull * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180,139,49,${alpha})`;
          ctx.fill();

          // horizontal lines
          if (c < cols) {
            const bx2 = ((c+1) / cols) * W;
            const dist2 = Math.hypot(bx2 - mx, by - my);
            const pull2 = Math.max(0, 1 - dist2 / radius);
            const x2 = bx2 + (mx - bx2) * pull2 * 0.18;
            const y2 = by  + (my - by)  * pull2 * 0.18;
            ctx.beginPath();
            ctx.moveTo(x, y); ctx.lineTo(x2, y2);
            ctx.strokeStyle = `rgba(180,139,49,${(alpha + 0.06 + pull2 * 0.18) / 2})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
          // vertical lines
          if (r < rows) {
            const bx2 = (c / cols) * W;
            const by2 = ((r+1) / rows) * H;
            const dist2 = Math.hypot(bx2 - mx, by2 - my);
            const pull2 = Math.max(0, 1 - dist2 / radius);
            const x2 = bx2 + (mx - bx2) * pull2 * 0.18;
            const y2 = by2 + (my - by2) * pull2 * 0.18;
            ctx.beginPath();
            ctx.moveTo(x, y); ctx.lineTo(x2, y2);
            ctx.strokeStyle = `rgba(180,139,49,${(alpha + 0.06 + pull2 * 0.18) / 2})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handleMouseMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    mouseRef.current = {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top)  / r.height,
    };
  };

  const handleClick = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const id = Date.now();
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 900);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'white',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', cursor: 'crosshair',
        fontFamily: "'Figtree', sans-serif",
      }}
    >
      {/* Interactive grid */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* Ripples */}
      {ripples.map(({ id, x, y }) => (
        <div key={id} style={{
          position: 'absolute', left: x, top: y,
          width: 0, height: 0, borderRadius: '50%',
          border: '2px solid rgba(180,139,49,0.6)',
          transform: 'translate(-50%,-50%)',
          animation: 'ripple 0.9s ease-out forwards',
          pointerEvents: 'none',
        }} />
      ))}

      {/* Center content */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '1.5rem',
        textAlign: 'center',
      }}>
        {/* Spinner frame */}
        <div style={{
          width: '5rem', height: '5rem',
          borderRadius: '50%',
          border: '2px solid #f0e8d6',
          borderTop: '2px solid #b48b31',
          animation: 'spin 1.2s linear infinite',
        }} />

        {/* Phase text */}
        <div style={{ minHeight: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#b48b31', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            AI Render
          </div>
          <div key={phase} style={{
            fontSize: '1rem', color: '#555', fontWeight: 400,
            animation: 'fadeSlideIn 0.5s ease-out',
          }}>
            {PHASES[phase]}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: '2.5rem', left: '50%', transform: 'translateX(-50%)',
        width: 'min(28rem, 80vw)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
        zIndex: 1,
      }}>
        <div style={{ width: '100%', height: '2px', background: '#f0e8d6', borderRadius: '1px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: '#b48b31', borderRadius: '1px',
            width: `${progress * 100}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ fontSize: '0.75rem', color: '#ccc' }}>This may take a few minutes</div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ripple { to { width: 200px; height: 200px; opacity: 0; } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
