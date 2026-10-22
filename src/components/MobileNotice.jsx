import { useState, useEffect } from 'react';
import styles from './MobileNotice.module.css';

// Screens narrower than this get the notice instead of the app.
export const MOBILE_MAX_WIDTH = 767;
const QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

export function useIsSmallScreen() {
  const get = () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
  const [small, setSmall] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setSmall(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return small;
}

function MonitorIcon() {
  return (
    <svg width="64" height="56" viewBox="0 0 64 56" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="58" height="38" rx="5" stroke="#b48b31" strokeWidth="2.5" />
      <rect x="10" y="10" width="44" height="24" rx="2" fill="#b48b31" opacity="0.12" />
      <path d="M22 30 L30 21 L36 27 L40 23 L46 30 Z" fill="#b48b31" opacity="0.55" />
      <path d="M26 41 L24 51 M38 41 L40 51" stroke="#b48b31" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 52 H46" stroke="#b48b31" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8Z" fill="currentColor"/>
    </svg>
  );
}

export default function MobileNotice({ config }) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <img
            src={`${import.meta.env.BASE_URL}backdrop-logo-inverse.png`}
            alt="Backdrop"
            className={styles.logo}
          />
        </div>

        <div className={styles.iconWrap}><MonitorIcon /></div>

        <h1 className={styles.title}>Designed for larger screens</h1>
        <p className={styles.text}>
          {config?.appName || 'Moduluxe Designer'} works best on a desktop or laptop,
          where you'll have room to build and customize your booth.
        </p>
        <p className={styles.text}>
          Please visit us from your computer for the full experience.
        </p>

        <a className={styles.btnPrimary} href="https://www.backdrop.com">
          Continue to backdrop.com <span aria-hidden="true">→</span>
        </a>

        {config?.phone && (
          <div className={styles.help}>
            <div className={styles.helpTitle}>Questions?</div>
            <div className={styles.helpText}>We're here to help with your booth.</div>
            <a href={`tel:${config.phoneHref}`} className={styles.phoneBtn}>
              <PhoneIcon /> {config.phone}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
