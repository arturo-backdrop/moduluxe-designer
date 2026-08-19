import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CONFIG } from './config.js';
import { useAutoSave, loadSavedProject, clearSavedProject } from './hooks/useAutoSave.js';
import { loadModel } from './three/glbParser.js';
import { toDisplay, fromDisplay } from './units.js';

import Onboarding  from './components/Onboarding.jsx';
import Tour, { useTour } from './components/Tour.jsx';
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
  const [catalog,        setCatalog]        = useState({});
  const [presets,        setPresets]        = useState([]); // preset items from manifest
  const [projectName,    setProjectName]    = useState(DEFAULT_STATE.projectName);
  const [floorSize,      setFloorSize]      = useState(DEFAULT_STATE.floorSize);
  const [activePreset,   setActivePreset]   = useState(DEFAULT_STATE.activePreset);
  const [sceneItems,     setSceneItems]     = useState(DEFAULT_STATE.sceneItems);
  const [mode,           setMode]           = useState(DEFAULT_STATE.mode);
  const [activeTool,     setActiveTool]     = useState(DEFAULT_STATE.activeTool);
  const [units,          setUnits]          = useState('ft');
  const [radialMenu,     setRadialMenu]     = useState(null);
  const { active: tourActive, start: startTour, done: doneTour } = useTour();
  const tourAdvanceRef = useRef(null);
  const tourActionRef  = useRef(null);

  const handleTourAction = useCallback((action, advance) => {
    tourActionRef.current  = action;
    tourAdvanceRef.current = advance;
  }, []);

  // Auto-advance tour when user does the right action
  const checkTourAction = useCallback((action) => {
    if (!tourActive) return;
    if (tourActionRef.current === action && tourAdvanceRef.current) {
      tourAdvanceRef.current();
    }
  }, [tourActive]);
  const radialMenuWrapperRef = useRef(null);
  const viewportEngRef       = useRef(null);
  const [history,        setHistory]        = useState([[]])
  const [historyIdx,     setHistoryIdx]     = useState(0);

  // Load catalog + prefetch all GLBs
  useEffect(() => {
    if (!CONFIG.manifestUrl) { setCatalogReady(true); return; }
    fetch(CONFIG.manifestUrl)
      .then(r => r.json())
      .then(async data => {
        const items = Array.isArray(data) ? data : (data.models || []);
        const map = {};
        const accMap = {};
        const manifestPresets = [];
        items.forEach(item => {
          if (item.type === 'preset') {
            manifestPresets.push(item);
            return;
          }
          map[item.id] = item;
          (item.sockets || []).forEach(s => {
            if (s.accessoryFile && !accMap[s.accessoryFile]) {
              accMap[s.accessoryFile] = { price: s.price || 0, name: s.label || s.name };
            }
          });
        });
        map.__accessories = accMap;
        setCatalog(map);

        // Fetch external preset files if they have a `file` URL
        const resolvedPresets = await Promise.all(manifestPresets.map(async preset => {
          if (!preset.file) return preset;
          try {
            const r = await fetch(preset.file);
            const data = await r.json();
            // Booth Planner project format
            if (data.items) {
              return { ...preset, items: data.items.map(it => ({
                modelId: it.modelId || it.catalogId,
                x: it.x || 0, z: it.z || 0, rotY: it.rotY || 0, color: it.color || null,
              }))};
            }
            // Already an items array
            if (Array.isArray(data)) return { ...preset, items: data };
            return preset;
          } catch(e) {
            console.warn('Failed to load preset file:', preset.file, e);
            return preset;
          }
        }));
        setPresets(resolvedPresets);

        // Prefetch all GLBs
        const withFile = items.filter(i => i.file && i.type !== 'preset');
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

  // Onboarding: load floor + preset items
  const handleOnboardingComplete = useCallback(({ floorSize, preset }) => {
    setFloorSize(floorSize);
    setActivePreset(preset);
    if (preset?.items?.length) {
      const items = preset.items.map((it, i) => ({
        uid: `${it.modelId}_preset_${Date.now()}_${i}`,
        modelId: it.modelId,
        x: it.x || 0,
        z: it.z || 0,
        rotY: it.rotY || 0,
        color: it.color || null,
      }));
      setSceneItems(items);
      pushHistory(items);
    }
    setOnboardingDone(true);
  }, [pushHistory]);

  // Sidebar: load only preset items, keep floor size
  const handleLoadPreset = useCallback((preset) => {
    if (!preset?.items?.length) return;
    const groupId = `preset_group_${Date.now()}`;
    const newItems = preset.items.map((it, i) => ({
      uid: `${it.modelId}_preset_${Date.now()}_${i}`,
      modelId: it.modelId,
      x: it.x || 0,
      z: it.z || 0,
      rotY: it.rotY || 0,
      color: it.color || null,
      groupId,
      isPresetGroup: true,
    }));
    setSceneItems(prev => {
      const next = [...prev, ...newItems];
      pushHistory(next);
      return next;
    });
    setRadialMenu(null);
  }, [pushHistory]);

  const addSceneItem = useCallback((modelId) => {
    const uid = `${modelId}_${Date.now()}`;
    setSceneItems(prev => {
      const next = [...prev, { uid, modelId, count: 1 }];
      pushHistory(next);
      return next;
    });
    checkTourAction('drop_model');
  }, [pushHistory, checkTourAction]);

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
    return <Onboarding config={CONFIG} presets={presets} onComplete={handleOnboardingComplete} />;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>

      {/* Viewport — full screen background */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Viewport
          config={{ ...CONFIG, _catalogFlat: Object.values(catalog).filter(v => v && typeof v === 'object' && v.id) }}
          floorSize={floorSize}
          activePreset={activePreset}
          sceneItems={sceneItems}
          onSceneItemsChange={items => { setSceneItems(items); pushHistory(items); }}
          mode={mode}
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onRadialMenu={(data) => {
            setRadialMenu(data ? { ...data, groupId: data.uid ? sceneItems.find(i=>i.uid===data.uid)?.groupId : null } : null);
            if (data) checkTourAction('open_radial');
          }}
          radialMenuWrapperRef={radialMenuWrapperRef}
          engRef={viewportEngRef}
          onSelect={() => checkTourAction('select_object')}
        />
      </div>

      {/* UI — floats over viewport */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'row',
        padding: '0.75rem',
        gap: '0.10rem',
        boxSizing: 'border-box',
      }}>

        {/* Header — absolute centered over full viewport */}
        <div style={{ position: 'absolute', top: '0.75rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 10 }}>
          <div style={{ pointerEvents: 'all' }}>
            <Header
              config={CONFIG}
              projectName={projectName}
              onProjectNameChange={setProjectName}
              mode={mode}
              onModeChange={(m) => { setMode(m); if (m === 'draw') checkTourAction('switch_draw'); if (m === 'place') checkTourAction('switch_place'); }}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              onNew={handleNew}
              units={units}
              onUnitsChange={setUnits}
              onStartTour={startTour}
            />
          </div>
        </div>

        {/* Sidebar — fixed width, full height */}
        <div style={{ flexShrink: 0, width: 'clamp(380px, 35vw, 500px)', height: '100%', position: 'relative', pointerEvents: 'all' }}>
          <Sidebar
            config={CONFIG}
            units={units}
            mode={mode}
            activeTool={activeTool}
            onToolChange={(t) => { setActiveTool(t); if (t === 'wall') checkTourAction('select_wall'); }}
            onAddProduct={addSceneItem}
            presets={presets}
            onLoadPreset={handleLoadPreset}
          />
        </div>

        {/* Center + Right — flex column, takes remaining width */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0, minHeight: 0 }}>

          {/* Top row: spacer to keep layout, header is absolute */}
          <div style={{ flexShrink: 0, height: 0 }} />

          {/* Middle row: empty (viewport shows through) + Right col panels */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: '0.75rem', minHeight: 0 }}>

            {/* Center — viewport shows through */}
            <div style={{ flex: 1 }} />

            {/* Right col — Video + Quote anchored to bottom */}
            <div style={{ flexShrink: 0, width: 'clamp(220px, 16vw, 280px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '0.75rem', pointerEvents: 'none' }}>
              <VideoWidget config={CONFIG} />
              <QuotePanel config={CONFIG} sceneItems={sceneItems} catalog={catalog} />
            </div>

          </div>

          {/* Bottom bar — full width of center+right, anchored to bottom */}
          <div style={{ flexShrink: 0, pointerEvents: 'all' }}>
            <BottomBar config={CONFIG} sceneItems={sceneItems} catalog={catalog}
              onSelectModel={modelId => viewportEngRef.current?.highlightModel(modelId)} />
          </div>

        </div>

        {/* Radial menu overlay — floats over viewport */}
      {radialMenu && (() => {
          // Preset group — show Ungroup button instead of radial menu
          if (radialMenu.itemType === 'preset_group') {
            const btnStyle = (accent=false) => ({
              background: accent ? '#b48b31' : 'white',
              color: accent ? 'white' : '#1a1a1a',
              border: 'none', borderRadius: 10,
              width: 44, height: 44,
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.12)',
              flexShrink: 0,
            });
            return (
              <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:9 }}>
                <div ref={radialMenuWrapperRef} style={{
                  position:'absolute',
                  left: radialMenu.x,
                  top: radialMenu.y,
                  transform:'translate(-50%, -110%)',
                  pointerEvents:'all',
                  display:'flex', gap:6, alignItems:'center',
                  background:'white', borderRadius:14, padding:6,
                  boxShadow:'0 4px 20px rgba(0,0,0,0.15)',
                }}>
                  {/* Ungroup */}
                  <button title="Ungroup" style={{...btnStyle(), flexDirection:'column', gap:2, width:52, height:52}} onClick={() => {
                    setSceneItems(prev => prev.map(i =>
                      i.groupId === radialMenu.groupId
                        ? { ...i, groupId: undefined, isPresetGroup: undefined }
                        : i
                    ));
                    setRadialMenu(null);
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/>
                      <rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/>
                    </svg>
                    <span style={{fontSize:9,color:'#666',fontWeight:600}}>Ungroup</span>
                  </button>
                  {/* Rotate */}
                  <button title="Rotate 90°" style={{...btnStyle(), flexDirection:'column', gap:2, width:52, height:52}} onClick={() => {
                    const gid = radialMenu.groupId;
                    setSceneItems(prev => prev.map(i => {
                      if (i.groupId !== gid) return i;
                      const cur = viewportEngRef.current?.getRotation?.(i.uid) ?? (i.rotY || 0);
                      const newRotY = cur + Math.PI/2;
                      viewportEngRef.current?.rotateObject(i.uid, newRotY);
                      return { ...i, rotY: newRotY };
                    }));
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                      <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                    </svg>
                    <span style={{fontSize:9,color:'#666',fontWeight:600}}>Rotate</span>
                  </button>
                  {/* Color */}
                  <label title="Color" style={{ ...btnStyle(), flexDirection:'column', gap:2, width:52, height:52, position:'relative', overflow:'hidden', cursor:'pointer' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/>
                      <circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/>
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                    </svg>
                    <span style={{fontSize:9,color:'#666',fontWeight:600,pointerEvents:'none'}}>Color</span>
                    <input type="color" style={{ position:'absolute', opacity:0, width:'100%', height:'100%', top:0, left:0, cursor:'pointer' }}
                      onChange={e => {
                        const color = e.target.value;
                        const gid = radialMenu.groupId;
                        setSceneItems(prev => prev.map(i => {
                          if (i.groupId !== gid) return i;
                          viewportEngRef.current?.applyColor(i.uid, color);
                          return { ...i, color };
                        }));
                      }} />
                  </label>
                  {/* Delete */}
                  <button title="Delete group" style={{...btnStyle(), flexDirection:'column', gap:2, width:52, height:52}} onClick={() => {
                    const gid = radialMenu.groupId;
                    const groupItems = sceneItems.filter(i => i.groupId === gid);
                    groupItems.forEach(i => viewportEngRef.current?.deleteContainer(i.uid));
                    setTimeout(() => {
                      setSceneItems(prev => prev.filter(i => i.groupId !== gid));
                    }, 380);
                    setRadialMenu(null);
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                    <span style={{fontSize:9,color:'#f87171',fontWeight:600}}>Delete</span>
                  </button>
                  {/* Close */}
                  <button style={{ ...btnStyle(), color:'#aaa' }} onClick={() => setRadialMenu(null)}>✕</button>
                </div>
              </div>
            );
          }

          const item    = catalog[radialMenu.modelId];
          const sceneItem = sceneItems.find(i => i.uid === radialMenu.uid);
          const socketPositions = radialMenu.socketPositions || {};
          const savedSocketStates = sceneItem?.socketStates || {};
          const manifestSockets = (item?.sockets || []).map(s => ({
            ...s,
            socketPositions: socketPositions[s.name] || [],
            state: savedSocketStates[s.name] || s.state || {},
          }));
          const toggleSockets = (radialMenu.toggleMeshes || []).map(t => ({
            name:     t.name,
            behavior: 'toggle_mesh',
            label:    t.name.slice(7).replace(/_/g,' '),
            state:    { on: t.visible },
          }));
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
                paintable={item?.paintable !== false}
                itemType={radialMenu.itemType || null}
                wallProps={radialMenu.wallProps || null}
                initialActiveBtn={radialMenu.initialActiveBtn || null}
                wrapperRef={radialMenuWrapperRef}
                onAction={(action, data) => {
                  if (action === 'ungroup') {
                    setSceneItems(prev => prev.map(i =>
                      i.groupId === radialMenu.groupId
                        ? { ...i, groupId: undefined, isPresetGroup: undefined }
                        : i
                    ));
                    setRadialMenu(null);
                  } else if (action === 'del') {
                    const uid = radialMenu.uid;
                    const item = sceneItems.find(i => i.uid === uid);
                    const wallTypes = new Set(['wall','column','door']);
                    if (item && wallTypes.has(item.type)) {
                      const toRemove = new Set([uid]);
                      if (item.type === 'wall') {
                        if (item.groupId) sceneItems.filter(i => i.groupId === item.groupId).forEach(i => toRemove.add(i.uid));
                        sceneItems.filter(i => i.type === 'door' && toRemove.has(i.wallUid)).forEach(i => toRemove.add(i.uid));
                      }
                      setSceneItems(prev => prev.filter(i => !toRemove.has(i.uid)));
                      setRadialMenu(null);
                    } else {
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
                      const newUid = `col_${Date.now()}`;
                      const newCol = { ...item, uid: newUid, x: item.x + 1, z: item.z + 1 };
                      setSceneItems(prev => [...prev, newCol]);
                    } else {
                      viewportEngRef.current?.duplicateObject(radialMenu.uid);
                    }
                  } else if (action === 'toggle_mesh') {
                    viewportEngRef.current?.toggleMeshVisibility(radialMenu.uid, data.meshName, data.visible);
                  } else if (action === 'socket') {
                    const sockItem = catalog[radialMenu.modelId];
                    const sockDef  = sockItem?.sockets?.find(s => s.name === data.name);
                    if (sockDef) {
                      const positions = (radialMenu.socketPositions||{})[data.name] || [];
                      viewportEngRef.current?.applySocketToUids([radialMenu.uid], data.name, data.state, { ...sockDef, socketPositions: positions });
                      setSceneItems(prev => {
                        const clickedItem = prev.find(i => i.uid === radialMenu.uid);
                        const groupId = clickedItem?.groupId;
                        const targetUids = groupId
                          ? prev.filter(i => i.groupId === groupId).map(i => i.uid)
                          : [radialMenu.uid];
                        return prev.map(i => {
                          if (!targetUids.includes(i.uid)) return i;
                          return { ...i, socketStates: { ...(i.socketStates||{}), [data.name]: data.state } };
                        });
                      });
                    }
                  } else if (action === 'units') {
                    setUnits(data.units);
                  }
                }}
                onClose={() => setRadialMenu(null)}
              />
            </div>
          );
        })()}

        {tourActive && <Tour onDone={doneTour} onAction={handleTourAction} />}
      </div>
    </div>
  )
}
