import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './Header.module.css';
import { APP_VERSION } from '../version.js';

export default function Header({ config, mode, onModeChange, canUndo, canRedo, onUndo, onRedo }) {
  const [projectName, setProjectName] = useState('My Booth Design');
  const inputRef = useRef(null);
  const spanRef  = useRef(null);

  // Auto-resize input
  useEffect(() => {
    if (spanRef.current && inputRef.current) {
      inputRef.current.style.width = spanRef.current.offsetWidth + 4 + 'px';
    }
  }, [projectName]);

  function commitEdit() {
    if (!projectName.trim()) setProjectName('My Booth Design');
  }

  // ── Liquid slider ─────────────────────────────────────────
  const placeRef    = useRef(null);
  const drawRef     = useRef(null);
  const toggleRef   = useRef(null);
  const sliderRef   = useRef(null);
  const animRef     = useRef(null);
  const currentXRef = useRef(null);
  const currentWRef = useRef(null);

  const getTargetMetrics = useCallback(() => {
    const activeBtn = mode === 'place' ? placeRef.current : drawRef.current;
    if (!activeBtn || !toggleRef.current) return null;
    const containerLeft = toggleRef.current.getBoundingClientRect().left;
    const btnRect       = activeBtn.getBoundingClientRect();
    return {
      x: btnRect.left - containerLeft - 4,
      w: btnRect.width,
    };
  }, [mode]);

  // Init slider without animation
  useEffect(() => {
    const t = setTimeout(() => {
      const m = getTargetMetrics();
      if (!m || !sliderRef.current) return;
      sliderRef.current.style.transition = 'none';
      sliderRef.current.style.width     = m.w + 'px';
      sliderRef.current.style.transform = `translateX(${m.x}px)`;
      currentXRef.current = m.x;
      currentWRef.current = m.w;
    }, 50);
    return () => clearTimeout(t);
  }, []);

  // Animate on mode change — liquid two-phase
  useEffect(() => {
    if (currentXRef.current === null) return;
    const m = getTargetMetrics();
    if (!m || !sliderRef.current) return;

    const fromX = currentXRef.current;
    const fromW = currentWRef.current;
    const distance = Math.abs(m.x - fromX);
    const stretch  = fromW + distance * 0.55;
    const stretchX = Math.min(fromX, m.x);

    // Phase 1 — stretch toward target
    sliderRef.current.style.transition = 'transform 0.22s cubic-bezier(0.4,0,0.6,1), width 0.22s cubic-bezier(0.4,0,0.6,1)';
    sliderRef.current.style.width      = stretch + 'px';
    sliderRef.current.style.transform  = `translateX(${stretchX}px)`;

    // Phase 2 — snap to final with spring
    clearTimeout(animRef.current);
    animRef.current = setTimeout(() => {
      if (!sliderRef.current) return;
      sliderRef.current.style.transition = 'transform 0.3s cubic-bezier(0.34,1.15,0.64,1), width 0.3s cubic-bezier(0.34,1.15,0.64,1)';
      sliderRef.current.style.width      = m.w + 'px';
      sliderRef.current.style.transform  = `translateX(${m.x}px)`;
      currentXRef.current = m.x;
      currentWRef.current = m.w;
    }, 200);
  }, [mode, getTargetMetrics]);

  useEffect(() => {
    const handler = () => {
      const m = getTargetMetrics();
      if (!m || !sliderRef.current) return;
      sliderRef.current.style.transition = 'none';
      sliderRef.current.style.width      = m.w + 'px';
      sliderRef.current.style.transform  = `translateX(${m.x}px)`;
      currentXRef.current = m.x;
      currentWRef.current = m.w;
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [getTargetMetrics]);

  function handleToggleClick() {
    onModeChange(mode === 'place' ? 'draw' : 'place');
  }

  return (
    <>
      <div className={styles.headerWrap}>
        {/* Project name pill */}
        <div className={styles.projectPill}>
          <div className={styles.nameWrap}>
            <span ref={spanRef} className={styles.nameHidden} aria-hidden="true">
              {projectName || ' '}
            </span>
            <input
              ref={inputRef}
              className={styles.nameInput}
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => e.key === 'Enter' && inputRef.current?.blur()}
              spellCheck={false}
            />
            <button className={styles.editBtn} onClick={() => { inputRef.current?.focus(); inputRef.current?.select(); }} tabIndex={-1}>
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
        </div>

        {/* Mode toggle */}
        <div className={styles.modeToggle} ref={toggleRef} onClick={handleToggleClick}>
          <div className={styles.modeSlider} ref={sliderRef} />
          <button
            ref={placeRef}
            className={`${styles.modeBtn} ${mode === 'place' ? styles.modeBtnActive : ''}`}
            onClick={e => { e.stopPropagation(); onModeChange('place'); }}
          >
            {config.modePlace}
          </button>
          <button
            ref={drawRef}
            className={`${styles.modeBtn} ${mode === 'draw' ? styles.modeBtnActive : ''}`}
            onClick={e => { e.stopPropagation(); onModeChange('draw'); }}
          >
            {config.modeDraw}
          </button>
        </div>
      </div>

      {/* Version — fixed bottom right, outside header flow */}
      <div className={styles.version}>v{APP_VERSION}</div>
    </>
  );
}
