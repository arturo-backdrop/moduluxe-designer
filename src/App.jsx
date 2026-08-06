import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CONFIG } from './config.js';
import { useAutoSave, loadSavedProject, clearSavedProject } from './hooks/useAutoSave.js';
import { loadModel } from './three/glbParser.js';
import { toDisplay, fromDisplay } from './units.js';

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
  const [units,          setUnits]          = useState('ft');
  const [radialMenu,     setRadialMenu]     = useState(null);
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
    setRadialMenu(null);
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
        onToolChange={setActiveTool}
        onRadialMenu={setRadialMenu}
        radialMenuWrapperRef={radialMenuWrapperRef}
        engRef={viewportEngRef}
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
          units={units}
          onUnitsChange={setUnits}
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
        {radialMenu && (() => {
          const item    = catalog[radialMenu.modelId];
          // Merge manifest sockets with auto-detected toggle meshes from GLB
          const manifestSockets = item?.sockets || [];
          const toggleSockets   = (radialMenu.toggleMeshes || []).map(t => ({
            name:     t.name,
            behavior: 'toggle_mesh',
            label:    t.name.slice(7).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
            state:    { on: t.visible },
          }));
          // Don't duplicate sockets already in manifest
          const manifestNames = new Set(manifestSockets.map(s=>s.name));
          const sockets = [...manifestSockets, ...toggleSockets.filter(s=>!manifestNames.has(s.name))];
          return (
            <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:9 }}>
              <RadialMenu
                x={radialMenu.x}
                y={radialMenu.y}
                modelName={item?.name || radialMenu.modelId || radialMenu.itemType || ''}
                sockets={sockets}
                accentColor={CONFIG.accentColor}
                units={units}
                initialRotY={radialMenu.initialRotY || 0}
                initialColor={radialMenu.initialColor || '#cccccc'}
                initialArrayState={radialMenu.initialArrayState || null}
                itemType={radialMenu.itemType || null}
                wallProps={radialMenu.wallProps || null}
                initialActiveBtn={radialMenu.initialActiveBtn || null}
                wrapperRef={radialMenuWrapperRef}
                onAction={(action, data) => {
                  if (action === 'del') {
                    const uid = radialMenu.uid;
                    const item = sceneItems.find(i => i.uid === uid);
                    const wallTypes = new Set(['wall','column','door']);
                    if (item && wallTypes.has(item.type)) {
                      // Wall/column/door delete — also delete doors attached to this wall
                      const toRemove = new Set([uid]);
                      if (item.type === 'wall') {
                        // Remove entire wall chain group
                        if (item.groupId) sceneItems.filter(i => i.groupId === item.groupId).forEach(i => toRemove.add(i.uid));
                        // Remove doors attached to any wall in group
                        sceneItems.filter(i => i.type === 'door' && toRemove.has(i.wallUid)).forEach(i => toRemove.add(i.uid));
                      }
                      setSceneItems(prev => prev.filter(i => !toRemove.has(i.uid)));
                      setRadialMenu(null);
                    } else {
                      // Product delete
                      const groupUids = item?.groupId
                        ? sceneItems.filter(i => i.groupId === item.groupId).map(i => i.uid)
                        : [uid];
                      groupUids.forEach(gid => viewportEngRef.current?.deleteContainer(gid));
                      setTimeout(() => {
                        const toRemove = new Set(groupUids);
                        setSceneItems(prev => prev.filter(i => !toRemove.has(i.uid)));
                      }, 380);
                      setRadialMenu(null);
                    }
                  } else if (action === 'wallProps') {
                    // Update wall/column/door properties
                    setSceneItems(prev => prev.map(i => {
                      if (i.uid !== radialMenu.uid) return i;
                      return { ...i, ...data };
                    }));
                  } else if (action === 'color') {
                    const item = sceneItems.find(i => i.uid === radialMenu.uid);
                    const wallTypes = new Set(['wall','column','door']);
                    if (item && wallTypes.has(item.type)) {
                      setSceneItems(prev => prev.map(i =>
                        i.uid === radialMenu.uid ? { ...i, color: data.color } : i
                      ));
                    } else {
                      viewportEngRef.current?.applyColor(radialMenu.uid, data.color);
                      setSceneItems(prev => prev.map(i =>
                        i.uid === radialMenu.uid ? { ...i, color: data.color } : i
                      ));
                    }
                  } else if (action === 'rotate') {
                    viewportEngRef.current?.rotateObject(radialMenu.uid, data.rotY);
                    setSceneItems(prev => prev.map(i =>
                      i.uid === radialMenu.uid ? { ...i, rotY: data.rotY } : i
                    ));
                  } else if (action === 'array') {
                    viewportEngRef.current?.applyArray(radialMenu.uid, data.count, data.spacing);
                  } else if (action === 'dup') {
                    const item = sceneItems.find(i => i.uid === radialMenu.uid);
                    if (item?.type === 'column') {
                      // Duplicate column
                      const newUid = `col_${Date.now()}`;
                      const newCol = { ...item, uid: newUid, x: item.x + 1, z: item.z + 1 };
                      setSceneItems(prev => [...prev, newCol]);
                    } else {
                      viewportEngRef.current?.duplicateObject(radialMenu.uid);
                    }
                  } else if (action === 'toggle_mesh') {
                    viewportEngRef.current?.toggleMeshVisibility(radialMenu.uid, data.meshName, data.visible);
                  } else if (action === 'units') {
                    setUnits(data.units);
                  }
                }}
                onClose={() => setRadialMenu(null)}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
}






