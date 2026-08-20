import React, { useRef, useEffect, useCallback } from 'react';
import styles from './Header.module.css';
import { APP_VERSION } from '../version.js';
import { UNIT_KEYS, UNITS } from '../units.js';

export default function Header({
  config, projectName, onProjectNameChange,
  mode, onModeChange,
  canUndo, canRedo, onUndo, onRedo,
  onNew, units, onUnitsChange, onStartTour,
}) {
  const inputRef = useRef(null);
  const spanRef  = useRef(null);

  useEffect(() => {
    if (spanRef.current && inputRef.current) {
      inputRef.current.style.width = spanRef.current.offsetWidth + 4 + 'px';
    }
  }, [projectName]);

  // ── Liquid slider ─────────────────────────────────────────
  const placeRef  = useRef(null);
  const drawRef   = useRef(null);
  const toggleRef = useRef(null);
  const sliderRef = useRef(null);
  const animRef   = useRef(null);
  const fromRef   = useRef({ x: null, w: null });

  const getMetrics = useCallback(() => {
    const btn = mode === 'place' ? placeRef.current : drawRef.current;
    if (!btn || !toggleRef.current) return null;
    const cLeft = toggleRef.current.getBoundingClientRect().left;
    const r     = btn.getBoundingClientRect();
    return { x: r.left - cLeft - 4, w: r.width };
  }, [mode]);

  useEffect(() => {
    const t = setTimeout(() => {
      const m = getMetrics();
      if (!m || !sliderRef.current) return;
      sliderRef.current.style.transition = 'none';
      sliderRef.current.style.width      = m.w + 'px';
      sliderRef.current.style.transform  = `translateX(${m.x}px)`;
      fromRef.current = m;
    }, 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (fromRef.current.x === null) return;
    const m = getMetrics();
    if (!m || !sliderRef.current) return;
    const { x: fx, w: fw } = fromRef.current;
    const stretch  = fw + Math.abs(m.x - fx) * 0.55;
    const stretchX = Math.min(fx, m.x);
    sliderRef.current.style.transition = 'transform 0.22s cubic-bezier(0.4,0,0.6,1), width 0.22s cubic-bezier(0.4,0,0.6,1)';
    sliderRef.current.style.width      = stretch + 'px';
    sliderRef.current.style.transform  = `translateX(${stretchX}px)`;
    clearTimeout(animRef.current);
    animRef.current = setTimeout(() => {
      if (!sliderRef.current) return;
      sliderRef.current.style.transition = 'transform 0.3s cubic-bezier(0.34,1.15,0.64,1), width 0.3s cubic-bezier(0.34,1.15,0.64,1)';
      sliderRef.current.style.width      = m.w + 'px';
      sliderRef.current.style.transform  = `translateX(${m.x}px)`;
      fromRef.current = m;
    }, 200);
  }, [mode, getMetrics]);

  useEffect(() => {
    const handler = () => {
      const m = getMetrics();
      if (!m || !sliderRef.current) return;
      sliderRef.current.style.transition = 'none';
      sliderRef.current.style.width      = m.w + 'px';
      sliderRef.current.style.transform  = `translateX(${m.x}px)`;
      fromRef.current = m;
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [getMetrics]);

  return (
    <>
      <div className={styles.headerWrap}>
        {/* Project pill */}
        <div className={styles.projectPill}>
          <div className={styles.nameWrap}>
            <span ref={spanRef} className={styles.nameHidden} aria-hidden="true">
              {projectName || ' '}
            </span>
            <input
              ref={inputRef}
              className={styles.nameInput}
              value={projectName}
              onChange={e => onProjectNameChange(e.target.value)}
              onBlur={() => { if (!projectName.trim()) onProjectNameChange('My Booth Design'); }}
              onKeyDown={e => e.key === 'Enter' && inputRef.current?.blur()}
              spellCheck={false}
            />
            <button className={styles.editBtn}
              onClick={() => { inputRef.current?.focus(); inputRef.current?.select(); }}
              tabIndex={-1} title="Rename">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>

          <div className={styles.pillDivider} />

          <div className={styles.historyBtns}>
            <button className={styles.historyBtn} disabled={!canUndo} onClick={onUndo} title="Undo (Ctrl+Z)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
              </svg>
            </button>
            <button className={styles.historyBtn} disabled={!canRedo} onClick={onRedo} title="Redo (Ctrl+Y)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>
              </svg>
            </button>
          </div>

          <div className={styles.pillDivider} />

          {/* New project */}
          <button className={styles.newBtn} onClick={onNew} title="New design">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="11" x2="12" y2="17"/>
              <line x1="9"  y1="14" x2="15" y2="14"/>
            </svg>
            <span>New</span>
          </button>




        </div>

        {/* Mode toggle */}
        <div className={styles.modeToggle} ref={toggleRef} data-tour="mode-toggle" onClick={() => onModeChange(mode === 'place' ? 'draw' : 'place')}>
          <div className={styles.modeSlider} ref={sliderRef} />
          <button ref={placeRef}
            className={`${styles.modeBtn} ${mode === 'place' ? styles.modeBtnActive : ''}`}
            onClick={e => { e.stopPropagation(); onModeChange('place'); }}>
            {config.modePlace}
          </button>
          <button ref={drawRef}
            className={`${styles.modeBtn} ${mode === 'draw' ? styles.modeBtnActive : ''}`}
            onClick={e => { e.stopPropagation(); onModeChange('draw'); }}>
            {config.modeDraw}
          </button>
        </div>
      </div>

      {/* Version — fixed bottom right */}
      <div className={styles.version}>v{APP_VERSION}</div>
    </>
  );
}


