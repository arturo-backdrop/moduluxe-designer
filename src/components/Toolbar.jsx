import React from 'react';
import styles from './Toolbar.module.css';
import { UNIT_KEYS, UNITS } from '../units.js';

const DRAW_TOOLS = [
  {
    id: 'wall',
    label: 'Wall',
    tooltip: 'Click on the floor to start drawing a wall, right click to stop.',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'column',
    label: 'Column',
    tooltip: 'Click anywhere on the floor to place a column.',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="8" y="2" width="8" height="20" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'door',
    label: 'Door',
    tooltip: 'Click on the bottom of any wall to insert a door opening.',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="2" width="13" height="20" rx="1"/>
        <circle cx="14" cy="12" r="1" fill="currentColor"/>
      </svg>
    ),
  },
];

export default function Toolbar({ mode, activeTool, onToolChange, units, onUnitsChange, onModeChange }) {
  const activeDrawTool = DRAW_TOOLS.find(t => t.id === activeTool);

  return (
    <div className={styles.toolbarStack}>

      {/* Camera hint */}
      <div className={styles.cameraHint}>
        Orbit: left click · Pan: right click
      </div>

      {/* Draw tools pill — only in draw mode */}
      {mode === 'draw' && (
        <>
          {/* Tooltip */}
          {activeDrawTool && (
            <div className={styles.tooltip}>
              {activeDrawTool.tooltip}
            </div>
          )}

          <div className={styles.drawPill}>
            {DRAW_TOOLS.map((tool, i) => (
              <React.Fragment key={tool.id}>
                {i > 0 && <div className={styles.divider} />}
                <button
                  className={`${styles.toolBtn} ${activeTool === tool.id ? styles.toolBtnActive : ''}`}
                  onClick={() => onToolChange(tool.id)}
                  title={tool.label}
                >
                  <span className={styles.toolIcon}>{tool.icon}</span>
                  <span className={styles.toolLabel}>{tool.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </>
      )}

      {/* Main pill — always visible */}
      <div className={styles.toolbar}>
        {/* Select */}
        <button
          className={`${styles.toolBtn} ${activeTool === 'select' ? styles.toolBtnActive : ''}`}
          onClick={() => onToolChange('select')}
          title="Select"
        >
          <span className={styles.toolIcon}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3l14 9-7 1-4 6z"/>
            </svg>
          </span>
          <span className={styles.toolLabel}>Select</span>
        </button>

        {/* Units — only in place mode */}
        {mode === 'place' && (
          <>
            <div className={styles.divider} />
            <div className={styles.unitsGroup}>
              {UNIT_KEYS.map(u => (
                <button
                  key={u}
                  className={`${styles.unitBtn} ${units === u ? styles.unitBtnActive : ''}`}
                  onClick={() => onUnitsChange(u)}
                >
                  {UNITS[u].label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Zoom */}
        <div className={styles.divider} />
        <button className={styles.toolBtn} title="Zoom in"
          onClick={() => window.dispatchEvent(new CustomEvent('viewport:zoom', { detail: 1 }))}>
          <span className={styles.toolIcon}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </span>
          <span className={styles.toolLabel}>+</span>
        </button>
        <button className={styles.toolBtn} title="Zoom out"
          onClick={() => window.dispatchEvent(new CustomEvent('viewport:zoom', { detail: -1 }))}>
          <span className={styles.toolIcon}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </span>
          <span className={styles.toolLabel}>-</span>
        </button>
      </div>



    </div>
  );
}
