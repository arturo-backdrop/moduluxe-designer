import React, { useState, useEffect } from 'react';
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

export default function MobileNotice({ config }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: config?.appName || 'Moduluxe Designer', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // user cancelled the share sheet or clipboard is blocked — nothing to do
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <img
          src={`${import.meta.env.BASE_URL}backdrop-logo.png`}
          alt="Backdrop"
          className={styles.logo}
        />

        <div className={styles.iconWrap}><MonitorIcon /></div>

        <h1 className={styles.title}>Designed for larger screens</h1>
        <p className={styles.text}>
          {config?.appName || 'Moduluxe Designer'} works best on a desktop or laptop,
          where you'll have room to build and customize your booth.
        </p>
        <p className={styles.text}>
          Please visit us from your computer for the full experience.
        </p>

        <button className={styles.btnPrimary} onClick={copyLink}>
          {copied ? 'Link copied ✓' : 'Send this link to my computer'}
        </button>

        {config?.phone && (
          <div className={styles.contact}>
            Questions? Call us at{' '}
            <a href={`tel:${config.phoneHref}`} className={styles.phone}>{config.phone}</a>
          </div>
        )}
      </div>
    </div>
  );
}
