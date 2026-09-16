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

const SIMULATE_MS = 6000;

export default function AIRenderLoading({ onComplete, placeholderUrl }) {
  const canvasRef    = useRef(null);
  const mouseRef     = useRef({ x: 0.5, y: 0.5 });
  const [phase, setPhase]       = useState(0);
  const [progress, setProgress] = useState(0);
  const [ripples, setRipples]   = useState([]);
  const [done, setDone]           = useState(false);
  const [resultUrl, setResultUrl] = useState(null);
  const [showResult, setShowResult] = useState(false); // set by real backend later

  // Phase cycling
  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(p => (p + 1) % PHASES.length);
    }, SIMULATE_MS / PHASES.length);
    return () => clearInterval(interval);
  }, []);

  // Progress + completion
  useEffect(() => {
    const start = Date.now();
    let raf;
    const tick = () => {
      const p = Math.min((Date.now() - start) / SIMULATE_MS, 1);
      setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        // Simulate: use booth capture as placeholder until real backend is ready
        setResultUrl(placeholderUrl || null);
        setDone(true);
        setTimeout(() => setShowResult(true), 80);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Interactive grid on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (w > 0 && h > 0) {
        canvas.width  = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        mouseRef.current = { x: 0.5, y: 0.5 };
      }
    };
    // Small delay to let the DOM paint the modal first
    setTimeout(resize, 50);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      const cols = 18, rows = 12;
      const mx = mouseRef.current.x * W;
      const my = mouseRef.current.y * H;
      const radius = Math.min(W, H) * 0.5;

      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          const bx = (c / cols) * W;
          const by = (r / rows) * H;
          const dist = Math.hypot(bx - mx, by - my);
          const pull = Math.max(0, 1 - dist / radius);
          const x = bx + (mx - bx) * pull * 0.2;
          const y = by + (my - by) * pull * 0.2;
          const alpha = 0.07 + pull * 0.2;

          ctx.beginPath();
          ctx.arc(x, y, 1.2 + pull * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180,139,49,${alpha})`;
          ctx.fill();

          if (c < cols) {
            const bx2 = ((c+1)/cols)*W;
            const d2 = Math.hypot(bx2-mx, by-my);
            const p2 = Math.max(0, 1 - d2/radius);
            const x2 = bx2 + (mx-bx2)*p2*0.2;
            const y2 = by  + (my-by) *p2*0.2;
            ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x2,y2);
            ctx.strokeStyle = `rgba(180,139,49,${(alpha+0.07+p2*0.2)/2})`;
            ctx.lineWidth = 0.5; ctx.stroke();
          }
          if (r < rows) {
            const by2 = ((r+1)/rows)*H;
            const d2 = Math.hypot(bx-mx, by2-my);
            const p2 = Math.max(0, 1 - d2/radius);
            const x2 = bx + (mx-bx)*p2*0.2;
            const y2 = by2+ (my-by2)*p2*0.2;
            ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x2,y2);
            ctx.strokeStyle = `rgba(180,139,49,${(alpha+0.07+p2*0.2)/2})`;
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const handleMouseMove = e => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return;
    mouseRef.current = {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top)  / r.height,
    };
  };

  const handleClick = e => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return;
    const id = Date.now();
    setRipples(prev => [...prev, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    setTimeout(() => setRipples(prev => prev.filter(p => p.id !== id)), 900);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', pointerEvents: 'all',
      animation: 'loadingOverlayIn 0.3s ease',
    }}>
      <div style={{
        background: 'white', borderRadius: '1.25rem',
        width: 'min(36rem, 95vw)',
        boxShadow: '0 1.5rem 5rem rgba(0,0,0,0.2)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        animation: 'loadingScaleIn 0.35s cubic-bezier(0.34,1.2,0.64,1)',
      }}>

        {done ? (
          /* ── Result state ── */
          <div style={{
            display: 'flex', flexDirection: 'column',
            opacity: showResult ? 1 : 0,
            transform: showResult ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1)',
          }}>
            {/* Result image */}
            {resultUrl && (
              <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden' }}>
                <img src={resultUrl} alt="AI Render"
                  style={{
                    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                    animation: 'imgReveal 0.9s cubic-bezier(0.22,1,0.36,1) forwards',
                  }} />
                {/* Gold flash overlay */}
                <div style={{
                  position: 'absolute', inset: 0, pointerEvents: 'none',
                  animation: 'goldFlash 0.7s ease-out forwards',
                  background: 'rgba(180,139,49,0.35)',
                }} />
                {/* Simulated badge */}
                <div style={{
                  position: 'absolute', top: '0.75rem', left: '0.75rem',
                  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
                  color: 'white', borderRadius: '0.5rem',
                  padding: '0.25rem 0.625rem', fontSize: '0.6875rem', fontWeight: 500,
                  fontFamily: "'Figtree', sans-serif",
                  animation: 'fadeSlideUp 0.4s 0.5s ease-out both',
                }}>Simulated preview</div>
              </div>
            )}

            <div style={{ padding: '1.5rem 1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.125rem', color: '#1a1a1a', lineHeight: 1.2 }}>
                    Your render is ready!
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#999', marginTop: '0.35rem', lineHeight: 1.5 }}>
                    AI-generated design preview: Colors, graphics, and final product details may vary from the actual product.
                  </div>
                </div>
                {/* Checkmark badge */}
                <div style={{
                  flexShrink: 0,
                  width: '2.5rem', height: '2.5rem', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #b48b31, #d4a842)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(180,139,49,0.35)',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: '#f0f0f0' }} />

              {/* CTAs — equal weight, stacked */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <button onClick={() => onComplete?.({ imageUrl: resultUrl, getInTouch: true })}
                  style={{
                    width: '100%', padding: '0.65rem',
                    background: 'linear-gradient(135deg, #b48b31, #c9a040)',
                    color: 'white', border: 'none',
                    borderRadius: '0.875rem', fontFamily: "'Figtree', sans-serif",
                    fontWeight: 400, fontSize: '0.875rem', cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(180,139,49,0.3)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform='scale(1.01)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(180,139,49,0.4)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 4px 16px rgba(180,139,49,0.3)'; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Talk to our team
                </button>
                <button onClick={() => onComplete?.({ imageUrl: resultUrl })}
                  style={{
                    width: '100%', padding: '0.65rem',
                    background: 'white', color: '#1a1a1a',
                    border: '1.5px solid #e8e8e8',
                    borderRadius: '0.875rem', fontFamily: "'Figtree', sans-serif",
                    fontWeight: 400, fontSize: '0.875rem', cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='#b48b31'; e.currentTarget.style.background='#fdf8ef'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='#e8e8e8'; e.currentTarget.style.background='white'; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download render
                </button>
              </div>

            </div>
          </div>
        ) : (
          /* ── Loading state ── */
          <>
            {/* Interactive grid */}
            <div
              onMouseMove={handleMouseMove}
              onClick={handleClick}
              style={{ position: 'relative', height: '14rem', cursor: 'crosshair', overflow: 'hidden', background: 'white' }}
            >
              <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
              {ripples.map(({ id, x, y }) => (
                <div key={id} style={{
                  position: 'absolute', left: x, top: y,
                  width: 0, height: 0, borderRadius: '50%',
                  border: '1.5px solid rgba(180,139,49,0.5)',
                  transform: 'translate(-50%,-50%)',
                  animation: 'aiRipple 0.9s ease-out forwards',
                  pointerEvents: 'none',
                }} />
              ))}
              {/* Spinner centrado */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: '3.5rem', height: '3.5rem', borderRadius: '50%',
                  border: '2px solid #f0e8d6',
                  borderTop: '2px solid #b48b31',
                  animation: 'aiSpin 1.2s linear infinite',
                }} />
              </div>
            </div>

            {/* Text + progress */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#b48b31', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                  AI Render
                </div>
                <div key={phase} style={{
                  fontSize: '0.9375rem', color: '#555', fontWeight: 400,
                  animation: 'aiFadeIn 0.5s ease-out',
                }}>
                  {PHASES[phase]}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ width: '100%', height: '2px', background: '#f0e8d6', borderRadius: '1px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: '#b48b31', borderRadius: '1px',
                  width: `${progress * 100}%`, transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#ccc', textAlign: 'center' }}>
                This may take a few minutes
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes loadingOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes loadingScaleIn  {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes aiSpin    { to { transform: rotate(360deg); } }
        @keyframes aiRipple  { to { width: 160px; height: 160px; opacity: 0; } }
        @keyframes aiFadeIn  { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes imgReveal {
          from { clip-path: inset(100% 0 0 0); transform: scale(1.04); }
          to   { clip-path: inset(0% 0 0 0);   transform: scale(1); }
        }
        @keyframes goldFlash {
          0%   { opacity: 0.25; }
          40%  { opacity: 0.15; }
          100% { opacity: 0; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
