import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CONFIG } from './config.js';
import { useAutoSave, loadSavedProject, clearSavedProject } from './hooks/useAutoSave.js';
import { loadModel } from './three/glbParser.js';

import Onboarding  from './components/Onboarding.jsx';
import Viewport    from './components/Viewport.jsx';
import RadialMenu  from './components/RadialMenu.jsx';
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
  const [catalogReady,   setCatalogReady]   = useState(false);
  const [loadProgress,   setLoadProgress]   = useState({ loaded: 0, total: 0 });
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [catalog,        setCatalog]        = useState({}); // modelId -> item
  const [projectName,    setProjectName]    = useState(DEFAULT_STATE.projectName);
  const [floorSize,      setFloorSize]      = useState(DEFAULT_STATE.floorSize);
  const [activePreset,   setActivePreset]   = useState(DEFAULT_STATE.activePreset);
  const [sceneItems,     setSceneItems]     = useState(DEFAULT_STATE.sceneItems);
  const [mode,           setMode]           = useState(DEFAULT_STATE.mode);
  const [activeTool,     setActiveTool]     = useState(DEFAULT_STATE.activeTool);
  const [radialMenu, setRadialMenu] = useState(null);
  const radialMenuWrapperRef = useRef(null);
  const viewportEngRef       = useRef(null);
  const [history,        setHistory]        = useState([[]]);
  const [historyIdx,     setHistoryIdx]     = useState(0);

  // Load catalog + prefetch all GLBs
  useEffect(() => {
    if (!CONFIG.manifestUrl) { setCatalogReady(true); return; }
    fetch(CONFIG.manifestUrl)
      .then(r => r.json())
      .then(async data => {
        const items = Array.isArray(data) ? data : (data.models || []);
        const map = {};
        items.forEach(item => { map[item.id] = item; });
        setCatalog(map);

        // Prefetch all GLBs — primes glbParser cache so drag is instant
        const withFile = items.filter(i => i.file);
        setLoadProgress({ loaded: 0, total: withFile.length });
        let loaded = 0;
        await Promise.all(withFile.map(item =>
          loadModel(item.file)
            .then(() => { loaded++; setLoadProgress({ loaded, total: withFile.length }); })
            .catch(() => { loaded++; setLoadProgress({ loaded, total: withFile.length }); })
        ));
        setCatalogReady(true);
      })
      .catch(e => { console.warn('Catalog load failed:', e); setCatalogReady(true); });
  }, []);

  // Restore from localStorage
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

  useAutoSave({ projectName, floorSize, activePreset, sceneItems });

  const canUndo = historyIdx > 0;
  const canRedo = historyIdx < history.length - 1;

  const pushHistory = useCallback((items) => {
    setHistory(prev => [...prev.slice(0, historyIdx + 1), items].slice(-50));
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

  const handleOnboardingComplete = useCallback(({ floorSize, preset }) => {
    setFloorSize(floorSize);
    setActivePreset(preset);
    setOnboardingDone(true);
  }, []);

  const addSceneItem = useCallback((modelId) => {
    // Used only for non-viewport additions (future use)
    const uid = `${modelId}_${Date.now()}`;
    setSceneItems(prev => {
      const next = [...prev, { uid, modelId, count: 1 }];
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  if (!catalogReady) {
    const { loaded, total } = loadProgress;
    const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
    return (
      <div style={{ position:'fixed', inset:0, background:'#ffffff', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
        <img src="/moduluxe-designer/backdrop-logo.png" style={{ height:48 }} alt="backdrop" />
        <div style={{ fontFamily:'Figtree,sans-serif', fontSize:14, color:'#aaa', marginTop:8 }}>
          {total > 0 ? `Loading models… ${loaded}/${total}` : 'Loading catalog…'}
        </div>
        <div style={{ width:200, height:4, background:'#e8e8e8', borderRadius:4, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background:'#b48b31', borderRadius:4, transition:'width 0.3s ease' }} />
        </div>
      </div>
    );
  }

  if (!onboardingDone) {
    return <Onboarding config={CONFIG} onComplete={handleOnboardingComplete} />;
  }

  return (
    <div style={styles.root}>
      <Viewport
        config={{ ...CONFIG, _catalogFlat: Object.values(catalog) }}
        floorSize={floorSize}
        activePreset={activePreset}
        sceneItems={sceneItems}
        onSceneItemsChange={items => { setSceneItems(items); pushHistory(items); }}
        mode={mode}
        activeTool={activeTool}
        onRadialMenu={setRadialMenu}
        radialMenuWrapperRef={radialMenuWrapperRef}
        engRef={viewportEngRef}
      />
      <div style={styles.ui}>
        {/* Radial menu — rendered over viewport */}
        {radialMenu && (() => {
          const item    = catalog[radialMenu.modelId];
          const sockets = item?.sockets || [];
          return (
            <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
              <RadialMenu
                x={radialMenu.x}
                y={radialMenu.y}
                modelName={item?.name || radialMenu.modelId}
                sockets={sockets}
                accentColor={CONFIG.accentColor}
                wrapperRef={radialMenuWrapperRef}
                onAction={(action, data) => {
                  if (action === 'del') {
                    // Animate out then remove from state
                    viewportEngRef.current?.deleteContainer(radialMenu.uid);
                    setTimeout(() => { // wait for delete animation
                      setSceneItems(prev => prev.filter(i => i.uid !== radialMenu.uid));
                    }, 380);
                    setRadialMenu(null);
                  }
                }}
                onClose={() => setRadialMenu(null)}
              />
            </div>
          );
        })()}
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
          config={CONFIG}
          mode={mode}
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onAddProduct={addSceneItem}
        />
        <QuotePanel config={CONFIG} sceneItems={sceneItems} catalog={catalog} />
        <BottomBar config={CONFIG} sceneItems={sceneItems} catalog={catalog} />
        <VideoWidget config={CONFIG} />
      </div>
    </div>
  );
}
