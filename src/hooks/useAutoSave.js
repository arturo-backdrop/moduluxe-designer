import { useEffect, useRef } from 'react';

const SAVE_KEY    = 'moduluxe_project';
const DEBOUNCE_MS = 1500;

export function useAutoSave(state) {
  const timerRef = useRef(null);
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      } catch(e) {
        console.warn('AutoSave failed:', e);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [state]);
}

export function loadSavedProject() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

export function clearSavedProject() {
  localStorage.removeItem(SAVE_KEY);
}
