import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CONFIG } from './config.js';
import { useAutoSave, loadSavedProject, clearSavedProject } from './hooks/useAutoSave.js';

import Onboarding  from './components/Onboarding.jsx';
import Viewport    from './components/Viewport.jsx';
import Sidebar     from './components/Sidebar.jsx';
import Header      from './components/Header.jsx';
import BottomBar   from './components/BottomBar.jsx';
import QuotePanel  from './components/QuotePanel.jsx';
import VideoWidget from './components/VideoWidget.jsx';

const styles = {
  root: { position:'relative', width:'100%', height:'100%', overflow:'hidden' },
  ui:   { position:'absolute', inset:0, pointerEvents:'none', zIndex:10 },
};

const DEFAULT_STATE = {
  projectName: 'My Booth Design',
  floorSize:   null,
  activePreset:null,
  sceneItems:  [],
  mode:        'place',
  activeTool:  'select',
};

export default function App() {
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [sidebarWidth,   setSidebarWidth]   = useState(352);
  const sidebarRef = useRef(null);
  const [projectName,    setProjectName]    = useState(DEFAULT_STATE.projectName);
  const [floorSize,      setFloorSize]      = useState(DEFAULT_STATE.floorSize);
  const [activePreset,   setActivePreset]   = useState(DEFAULT_STATE.activePreset);
  const [sceneItems,     setSceneItems]     = useState(DEFAULT_STATE.sceneItems);
  const [mode,           setMode]           = useState(DEFAULT_STATE.mode);
  const [activeTool,     setActiveTool]     = useState(DEFAULT_STATE.activeTool);
  const [history,        setHistory]        = useState([[]]);
  const [historyIdx,     setHistoryIdx]     = useState(0);

  // ── Restore from localStorage on mount ──────────────────────
  useEffect(() => {
    const saved = loadSavedProject();
    if (saved) {
      setProjectName(saved.projectName || DEFAULT_STATE.projectName);
      setFloorSize(saved.floorSize     || null);
      setActivePreset(saved.activePreset || null);
      setSceneItems(saved.sceneItems   || []);
      if (saved.floorSize) setOnboardingDone(true);
    }
  }, []);

  // ── Autosave ─────────────────────────────────────────────────
  useAutoSave({ projectName, floorSize, activePreset, sceneItems });

  // ── History ──────────────────────────────────────────────────
  const canUndo = historyIdx > 0;
  const canRedo = historyIdx < history.length - 1;

  const pushHistory = useCallback((items) => {
    setHistory(prev => {
      const next = [...prev.slice(0, historyIdx + 1), items].slice(-50);
      return next;
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

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // Measure sidebar width for BottomBar offset
  useEffect(() => {
    if (!sidebarRef.current) return;
    const ro = new ResizeObserver(entries => {
      setSidebarWidth(entries[0].contentRect.width + 16 + 20); // width + left margin + right gap
    });
    ro.observe(sidebarRef.current);
    return () => ro.disconnect();
  }, [onboardingDone]);
  const handleNew = useCallback(() => {
    if (sceneItems.length > 0) {
      if (!window.confirm('Start a new design? Your current work will be cleared.')) return;
    }
    clearSavedProject();
    setProjectName(DEFAULT_STATE.projectName);
    setFloorSize(null);
    setActivePreset(null);
    setSceneItems([]);
    setHistory([[]]);
    setHistoryIdx(0);
    setMode('place');
    setActiveTool('select');
    setOnboardingDone(false);
  }, [sceneItems]);

  // ── Onboarding complete ───────────────────────────────────────
  const handleOnboardingComplete = useCallback(({ floorSize, preset }) => {
    setFloorSize(floorSize);
    setActivePreset(preset);
    setOnboardingDone(true);
  }, []);

  // ── Scene items ───────────────────────────────────────────────
  const addSceneItem = useCallback((modelId) => {
    setSceneItems(prev => {
      const next = prev.find(x => x.modelId === modelId)
        ? prev.map(x => x.modelId === modelId ? { ...x, count: x.count + 1 } : x)
        : [...prev, { id: `${modelId}_${Date.now()}`, modelId, count: 1 }];
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  if (!onboardingDone) {
    return <Onboarding config={CONFIG} onComplete={handleOnboardingComplete} />;
  }

  return (
    <div style={styles.root}>
      <Viewport
        config={CONFIG}
        floorSize={floorSize}
        activePreset={activePreset}
        sceneItems={sceneItems}
        mode={mode}
        activeTool={activeTool}
      />
      <div style={styles.ui}>
        <Header
          config={CONFIG}
          projectName={projectName}
          onProjectNameChange={setProjectName}
          mode={mode}
          onModeChange={setMode}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onNew={handleNew}
        />
        <Sidebar
          ref={sidebarRef}
          config={CONFIG}
          mode={mode}
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onAddProduct={addSceneItem}
        />
        <QuotePanel config={CONFIG} sceneItems={sceneItems} />
        <BottomBar config={CONFIG} sceneItems={sceneItems} offsetLeft={sidebarWidth} />
        {CONFIG.youtubeId && <VideoWidget config={CONFIG} />}
      </div>
    </div>
  );
}
