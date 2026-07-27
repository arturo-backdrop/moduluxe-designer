import React, { useState, useCallback } from 'react';
import { CONFIG } from './config.js';

// Components (built one by one)
import Onboarding  from './components/Onboarding.jsx';
import Viewport    from './components/Viewport.jsx';
import Sidebar     from './components/Sidebar.jsx';
import Header      from './components/Header.jsx';
import BottomBar   from './components/BottomBar.jsx';
import QuotePanel  from './components/QuotePanel.jsx';
import VideoWidget from './components/VideoWidget.jsx';

// ── App styles ────────────────────────────────────────────────
const styles = {
  root: {
    position: 'relative',
    width:    '100%',
    height:   '100%',
    overflow: 'hidden',
  },
  ui: {
    position:      'absolute',
    inset:         0,
    pointerEvents: 'none', // canvas handles events by default
    zIndex:        10,
  },
};

export default function App() {
  // ── Onboarding state ────────────────────────────────────────
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [floorSize,      setFloorSize]      = useState(null);
  const [activePreset,   setActivePreset]   = useState(null);

  // ── Scene state ─────────────────────────────────────────────
  const [sceneItems,  setSceneItems]  = useState([]); // { id, modelId, count, ... }
  const [mode,        setMode]        = useState('place'); // 'place' | 'draw'
  const [activeTool,  setActiveTool]  = useState('select');

  // ── History ─────────────────────────────────────────────────
  const [history,    setHistory]    = useState([[]]);
  const [historyIdx, setHistoryIdx] = useState(0);

  const canUndo = historyIdx > 0;
  const canRedo = historyIdx < history.length - 1;

  const pushHistory = useCallback((items) => {
    setHistory(prev => {
      const next = prev.slice(0, historyIdx + 1);
      next.push(items);
      return next.slice(-50); // max 50 snapshots
    });
    setHistoryIdx(prev => Math.min(prev + 1, 49));
  }, [historyIdx]);

  const undo = useCallback(() => {
    if (!canUndo) return;
    setHistoryIdx(prev => prev - 1);
    setSceneItems(history[historyIdx - 1]);
  }, [canUndo, history, historyIdx]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    setHistoryIdx(prev => prev + 1);
    setSceneItems(history[historyIdx + 1]);
  }, [canRedo, history, historyIdx]);

  // ── Keyboard shortcuts ───────────────────────────────────────
  React.useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // ── Onboarding complete ──────────────────────────────────────
  const handleOnboardingComplete = useCallback(({ floorSize, preset }) => {
    setFloorSize(floorSize);
    setActivePreset(preset);
    setOnboardingDone(true);
  }, []);

  // ── Scene item management ────────────────────────────────────
  const addSceneItem = useCallback((modelId) => {
    setSceneItems(prev => {
      const existing = prev.find(x => x.modelId === modelId);
      const next = existing
        ? prev.map(x => x.modelId === modelId ? { ...x, count: x.count + 1 } : x)
        : [...prev, { id: `${modelId}_${Date.now()}`, modelId, count: 1 }];
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  // ── Render ───────────────────────────────────────────────────
  if (!onboardingDone) {
    return (
      <Onboarding
        config={CONFIG}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  return (
    <div style={styles.root}>
      {/* 3D Viewport — renders Three.js scene */}
      <Viewport
        config={CONFIG}
        floorSize={floorSize}
        activePreset={activePreset}
        sceneItems={sceneItems}
        mode={mode}
        activeTool={activeTool}
      />

      {/* UI overlay */}
      <div style={styles.ui}>
        {/* Header — project name, undo/redo, mode toggle */}
        <Header
          config={CONFIG}
          mode={mode}
          onModeChange={setMode}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
        />

        {/* Sidebar — catalog + toolbar */}
        <Sidebar
          config={CONFIG}
          mode={mode}
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onAddProduct={addSceneItem}
        />

        {/* Quote panel — top right */}
        <QuotePanel
          config={CONFIG}
          sceneItems={sceneItems}
        />

        {/* Bottom bar — your build */}
        <BottomBar
          config={CONFIG}
          sceneItems={sceneItems}
        />

        {/* Video widget — bottom right (optional) */}
        {CONFIG.youtubeId && (
          <VideoWidget config={CONFIG} />
        )}
      </div>
    </div>
  );
}
