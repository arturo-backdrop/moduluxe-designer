import React, { useState, useRef, useEffect } from 'react';
import styles from './Header.module.css';
import { APP_VERSION } from '../version.js';

export default function Header({ config, mode, onModeChange, canUndo, canRedo, onUndo, onRedo }) {
  const [projectName, setProjectName] = useState('My Booth Design');
  const [editing,     setEditing]     = useState(false);
  const inputRef = useRef(null);

  // Auto-resize input width
  const spanRef = useRef(null);
  useEffect(() => {
    if (spanRef.current && inputRef.current) {
      inputRef.current.style.width = spanRef.current.offsetWidth + 4 + 'px';
    }
  }, [projectName]);

  function startEdit() {
    setEditing(true);
    setTimeout(() => { inputRef.current?.select(); }, 10);
  }

  function commitEdit() {
    setEditing(false);
    if (!projectName.trim()) setProjectName('My Booth Design');
  }

  // Sliding pill animation
  const [sliderStyle, setSliderStyle] = useState({});
  const placeRef  = useRef(null);
  const drawRef   = useRef(null);
  const toggleRef = useRef(null);

  function updateSlider(immediate = false) {
    const activeBtn = mode === 'place' ? placeRef.current : drawRef.current;
    if (!activeBtn || !toggleRef.current) return;
    const containerLeft = toggleRef.current.getBoundingClientRect().left;
    const btnRect       = activeBtn.getBoundingClientRect();
    setSliderStyle({
      width:     btnRect.width,
      transform: `translateX(${btnRect.left - containerLeft - 4}px)`,
      transition: immediate ? 'none' : undefined,
    });
  }

  useEffect(() => { setTimeout(() => updateSlider(true), 50); }, []);
  useEffect(() => { updateSlider(false); }, [mode]);
  useEffect(() => {
    window.addEventListener('resize', () => updateSlider(true));
    return () => window.removeEventListener('resize', () => updateSlider(true));
  }, [mode]);

  function handleToggleClick() {
    onModeChange(mode === 'place' ? 'draw' : 'place');
  }

  return (
    <div className={styles.headerWrap}>
      {/* Project name pill */}
      <div className={styles.projectPill}>
        <div className={styles.nameWrap}>
          {/* Hidden span for measuring text width */}
          <span ref={spanRef} className={styles.nameHidden} aria-hidden="true">
            {projectName || ' '}
          </span>
          <input
            ref={inputRef}
            className={styles.nameInput}
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            onFocus={() => setEditing(true)}
            onBlur={commitEdit}
            onKeyDown={e => e.key === 'Enter' && inputRef.current?.blur()}
            spellCheck={false}
          />
          <button className={styles.editBtn} onClick={startEdit} tabIndex={-1}>
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

      {/* Mode toggle pill */}
      <div className={styles.modeToggle} ref={toggleRef} onClick={handleToggleClick}>
        <div className={styles.modeSlider} style={sliderStyle} />
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

      {/* Version */}
      <div className={styles.version}>v{APP_VERSION}</div>
    </div>
  );
}
