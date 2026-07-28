import React, { useState } from 'react';
import styles from './VideoWidget.module.css';

// ── Config ────────────────────────────────────────────────────
const MINIMIZED_LABEL = 'Watch tutorial';

export default function VideoWidget({ config }) {
  const [minimized, setMinimized] = useState(false);

  if (!config.youtubeId) return null;

  return (
    <div
      className={`${styles.widget} ${minimized ? styles.widgetMinimized : ''}`}
      style={{ pointerEvents: 'all' }}
    >
      {minimized ? (
        // ── Pill ──
        <button className={styles.pill} onClick={() => setMinimized(false)}>
          <div className={styles.pillIcon}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
          <span className={styles.pillLabel}>{MINIMIZED_LABEL}</span>
          <div className={styles.pillDot} />
        </button>
      ) : (
        // ── Full widget ──
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <div className={styles.playDot} />
              {config.videoTitle || 'Tutorial'}
            </div>
            <button className={styles.minimizeBtn} onClick={() => setMinimized(true)} title="Minimize">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>

          <div className={styles.videoWrap}>
            <iframe
              src={`https://www.youtube.com/embed/${config.youtubeId}?rel=0&modestbranding=1`}
              title={config.videoTitle || 'Tutorial'}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className={styles.iframe}
            />
          </div>

          {config.videoDuration && (
            <div className={styles.duration}>{config.videoDuration}</div>
          )}
        </div>
      )}
    </div>
  );
}
