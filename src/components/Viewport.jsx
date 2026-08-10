import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { loadModel } from '../three/glbParser.js';
import {
  buildWallMesh, buildColumnMesh, buildDoorMesh,
  buildWallGhost, buildColumnGhost, buildDoorGhost, buildEndpointHandle,
  snapWallPoint, snapAngle, findClosestWall,
  WALL_SNAP_RADIUS, DOOR_W, DOOR_H,
} from '../three/wallRenderer.js';

// ── Constants ─────────────────────────────────────────────────
const DRAG_THRESHOLD = 5;   // px before drag is armed
const GRID_SNAP      = 0.25; // meters
const ANIM_DURATION  = 280;  // ms for spawn spring
const LIVE_OOB_MAT   = new THREE.MeshStandardMaterial({ color:0xff3333, transparent:true, opacity:0.35, depthWrite:false });

// ── Spring ease (same as Booth Planner) ──────────────────────
function springEase(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 + Math.sin(t * Math.PI * 2) * (1 - t) * 0.12;
}

// ── Settings ──────────────────────────────────────────────────
const S = {
  bg:   { top: 0xebebeb, bottom: 0xd6d6d6 },
  fog:  { color: 0xdedede, density: 0.018 },
  ambient: 0.1, key: 1.5, fill: 0.2, rim: 0.1, top: 0.15, side: 0.20, hemi: 0.2,
  floor: { roughness: 0.25, normalScale: 1.1, tiling: 2, tilingRough: 3.5 },
  shadow: { size: 2048, radius: 8, bias: -0.001 },
};

// ── Outline (view-space normal offset) ───────────────────────
const OUTLINE_COLOR     = 0xffffff;
const OUTLINE_THICKNESS = 0.004;
const OUTLINE_XRAY_OPA  = 0.35;

function makeOutlineMat(depthTest, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      col:   { value: new THREE.Color(OUTLINE_COLOR) },
      thick: { value: OUTLINE_THICKNESS },
    },
    vertexShader: `
      uniform float thick;
      void main() {
        vec3 n = normalize(normalMatrix * normal);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        p.xy += n.xy * thick;
        gl_Position = projectionMatrix * p;
      }
    `,
    fragmentShader: `
      uniform vec3 col;
      void main() { gl_FragColor = vec4(col, ${opacity.toFixed(2)}); }
    `,
    side: THREE.BackSide, depthTest, depthWrite: false,
    transparent: opacity < 1,
    stencilWrite: depthTest,
    stencilFunc: THREE.NotEqualStencilFunc, stencilRef: 1,
    stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp,
  });
}

function makeStencilMat() {
  return new THREE.MeshBasicMaterial({
    colorWrite: false, depthWrite: false, stencilWrite: true,
    stencilFunc: THREE.AlwaysStencilFunc, stencilRef: 1,
    stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp,
  });
}

// Attach stencil + outline meshes to every mesh in obj
function attachOutlines(obj) {
  const meshes = [];
  obj.traverse(c => {
    if (c.isMesh && !c.userData.isMeta) meshes.push(c);
  });
  meshes.forEach(m => {
    const sm = new THREE.Mesh(m.geometry, makeStencilMat());
    sm.renderOrder = 1; sm.userData.isMeta = true; m.add(sm);

    const solid = new THREE.Mesh(m.geometry, makeOutlineMat(true, 1));
    solid.renderOrder = 2; solid.visible = false; solid.userData.isMeta = true; solid.userData.isOutline = true;
    m.add(solid);

    const xray = new THREE.Mesh(m.geometry, makeOutlineMat(false, OUTLINE_XRAY_OPA));
    xray.renderOrder = 3; xray.visible = false; xray.userData.isMeta = true; xray.userData.isXray = true;
    m.add(xray);
  });
}

function setOutlineVisible(container, v) {
  container.traverse(c => {
    if (c.userData.isOutline || c.userData.isXray) c.visible = v;
  });
}

// ── Paint color system ────────────────────────────────────────
const PAINT_MAT = 'paint_color';

function applyPaintColor(root, color) {
  const paintColor = new THREE.Color(color || '#3a6ea5');
  const allMatNames = new Set();
  root.traverse(c => {
    if (!c.isMesh || !c.material) return;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    mats.forEach(m => { if (m.name) allMatNames.add(m.name); });
  });
  const hasPaint = allMatNames.has(PAINT_MAT);
  root.traverse(c => {
    if (!c.isMesh || !c.material) return;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    mats.forEach(mat => {
      if (hasPaint && mat.name !== PAINT_MAT) return;
      const enhanced = new THREE.MeshStandardMaterial({
        name: mat.name, color: paintColor,
        roughness: 0.55, metalness: 0.05, envMapIntensity: 1.2,
        map: mat.map||null, normalMap: mat.normalMap||null,
        roughnessMap: mat.roughnessMap||null, metalnessMap: mat.metalnessMap||null,
        aoMap: mat.aoMap||null,
      });
      if (Array.isArray(c.material)) c.material[c.material.indexOf(mat)] = enhanced;
      else c.material = enhanced;
    });
  });
}

export default function Viewport({ config, floorSize, sceneItems, onSceneItemsChange, onRadialMenu, radialMenuWrapperRef, engRef: externalEngRef, mode = 'place', activeTool = 'select', onToolChange }) {
  const canvasRef = useRef(null);
  const engRef    = useRef(null);
  const itemsRef    = useRef(sceneItems);
  const onChangeRef = useRef(onSceneItemsChange);
  const onRadialMenuRef = useRef(onRadialMenu);
  const catalogRef  = useRef(config._catalogFlat || []);
  const modeRef     = useRef(mode);
  const activeToolRef = useRef(activeTool);
  const onToolChangeRef = useRef(onToolChange);
  useEffect(() => { onRadialMenuRef.current = onRadialMenu; }, [onRadialMenu]);
  useEffect(() => {
    modeRef.current = mode;
    const c = canvasRef.current;
    if (c) c.style.cursor = mode === 'draw' ? 'crosshair' : 'default';
    // Always re-enable orbit when mode changes
    if (engRef.current?.controls) engRef.current.controls.enabled = true;
  }, [mode]);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { onToolChangeRef.current = onToolChange; }, [onToolChange]);

  useEffect(() => { itemsRef.current    = sceneItems; }, [sceneItems]);
  useEffect(() => { onChangeRef.current = onSceneItemsChange; }, [onSceneItemsChange]);
  useEffect(() => { catalogRef.current  = config._catalogFlat || []; }, [config._catalogFlat]);

  // ── Init Three.js once ────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.toneMapping       = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace  = THREE.SRGBColorSpace;

    // Background (no bloom, rendered before scene)
    const bgScene = new THREE.Scene();
    const bgCam   = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), new THREE.ShaderMaterial({
      uniforms: { t:{ value:new THREE.Color(S.bg.top) }, b:{ value:new THREE.Color(S.bg.bottom) } },
      vertexShader:  'varying vec2 v;void main(){v=uv;gl_Position=vec4(position,1.0);}',
      fragmentShader:'uniform vec3 t,b;varying vec2 v;void main(){gl_FragColor=vec4(mix(b,t,v.y),1.0);}',
      depthWrite:false, depthTest:false,
    })));

    // Main scene
    const scene = new THREE.Scene();
    scene.fog   = new THREE.FogExp2(S.fog.color, S.fog.density);

    // Camera + controls
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 200);
    camera.position.set(8, 6, 10);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI/2 - 0.03;
    controls.minDistance = 1; controls.maxDistance = 60;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, S.ambient));
    const key = new THREE.DirectionalLight(0xffffff, S.key);
    key.position.set(5,12,8); key.castShadow = true;
    key.shadow.mapSize.set(S.shadow.size, S.shadow.size);
    key.shadow.camera.left = key.shadow.camera.bottom = -20;
    key.shadow.camera.right = key.shadow.camera.top   =  20;
    key.shadow.camera.far   = 60;
    key.shadow.bias = S.shadow.bias; key.shadow.radius = S.shadow.radius;
    scene.add(key);
    [[0xeef4ff,S.fill,[-10,6,2]],[0xffffff,S.rim,[0,8,-12]],[0xfff8f0,S.top,[0,15,0]],[0xfff5e0,S.side,[12,5,0]]].forEach(([c,i,p])=>{
      const l=new THREE.DirectionalLight(c,i); l.position.set(...p); scene.add(l);
    });
    scene.add(new THREE.HemisphereLight(0xfff8f0, 0xd0d0d0, S.hemi));

    // Environment map (EXR) — affects reflections and ambient lighting
    new EXRLoader().load(`${import.meta.env.BASE_URL}textures/environment.exr`, texture => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture; // no scene.background — keep gradient
    });

    // Floor
    const tl      = new THREE.TextureLoader();
    const floorW  = floorSize?.w || 6;
    const floorD  = floorSize?.d || 6;
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.8 });
    const BASE = import.meta.env.BASE_URL;
    tl.load(`${BASE}textures/floor_basecolor.png`, t=>{
      t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(S.floor.tiling,S.floor.tiling);
      t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=renderer.capabilities.getMaxAnisotropy();
      floorMat.map=t; floorMat.needsUpdate=true;
    });
    tl.load(`${BASE}textures/floor_normal.png`, t=>{
      t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(S.floor.tiling,S.floor.tiling);
      floorMat.normalMap=t; floorMat.normalScale=new THREE.Vector2(S.floor.normalScale,S.floor.normalScale);
      floorMat.needsUpdate=true;
    });
    tl.load(`${BASE}textures/floor_roughness.png`, t=>{
      t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(S.floor.tilingRough,S.floor.tilingRough);
      t.rotation=0.3; t.center.set(0.5,0.5);
      floorMat.roughnessMap=t; floorMat.roughness=0.5; floorMat.needsUpdate=true;
    });
    const FLOOR_H = 0.1;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(floorW, FLOOR_H, floorD), floorMat);
    floor.position.y = -FLOOR_H / 2;
    floor.receiveShadow = true; scene.add(floor);

    // Floor border
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(floorW,FLOOR_H,floorD)),
      new THREE.LineBasicMaterial({ color:0xaaaaaa, opacity:0.5, transparent:true })
    );
    border.position.y = -FLOOR_H / 2;
    scene.add(border);

    // Grid
    const grid = new THREE.GridHelper(Math.max(floorW,floorD)*3, 40, 0xbbbbbb, 0xbbbbbb);
    grid.material.opacity=0.1; grid.material.transparent=true; grid.position.y=0.002;
    scene.add(grid);

    // Hover dot
    const dotMat = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, depthTest: false });
    const dot    = new THREE.Mesh(new THREE.SphereGeometry(0.08,16,16), dotMat);
    dot.renderOrder=10; dot.visible=false; scene.add(dot);
    let dotBaseY = 0;

    function updateDot(container) {
      container.updateWorldMatrix(true,true);
      const box = new THREE.Box3().setFromObject(container);
      const c   = new THREE.Vector3(); box.getCenter(c);
      dotBaseY  = box.max.y + 0.22;
      dot.position.set(c.x, dotBaseY, c.z);
      dot.visible = true;
    }

    // Item group
    const itemGroup = new THREE.Group();
    scene.add(itemGroup);

    // Wall group (separate from itemGroup so raycasting is clean)
    const wallGroup = new THREE.Group();
    scene.add(wallGroup);
    const wallMeshMap = new Map(); // uid -> THREE.Group

    // Spawn animations
    const spawnAnims = []; // { container, startTime }

    // ── Wall Tool State ───────────────────────────────────────
    const wallState = {
      active: false,       // currently drawing a chain
      start: null,         // THREE.Vector3
      end: null,           // THREE.Vector3
      ghost: null,         // ghost mesh in scene
      startMarker: null,   // cyan dot
      chainGroup: [],      // uids of walls in current chain
    };

    // Start marker (cyan sphere)
    const startMarkerGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const startMarkerMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, roughness: 0.3 });
    const startMarker    = new THREE.Mesh(startMarkerGeo, startMarkerMat);
    startMarker.visible  = false;
    startMarker.renderOrder = 10;
    startMarker.raycast  = () => {};
    scene.add(startMarker);

    // Door ghost
    let doorGhost = null;
    let doorGhostWall = null; // { wall, t }

    // Endpoint handles group
    const handleGroup = new THREE.Group();
    scene.add(handleGroup);
    let hoveredHandle = null;
    let draggingHandle = null;
    let dragHandleWallUid = null;
    let dragHandleWhich = null; // 'start' | 'end'

    // Column ghost
    let colGhost = null;

    // ── Interaction state ─────────────────────────────────────
    const raycaster  = new THREE.Raycaster();
    const pointer    = new THREE.Vector2();
    const planeY0    = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
    let hoveredUid   = null;
    let selectedUid  = null;   // the "anchor" uid (source of array)
    let selectedUids = [];     // all uids in the selection (group)
    let draggingUid  = null;
    let dragArmed    = false;
    let dragStartX   = 0, dragStartY = 0;
    let dragOffsets  = {};     // uid -> {dx, dz}

    // Get all uids in the same group as uid (or just [uid] if no group)
    function getGroupUids(uid) {
      // Check Three.js userData first — catches clones even when not in sceneItems
      const obj = itemGroup.children.find(x => x.userData.uid === uid);
      const groupId = obj?.userData.groupId;
      if (groupId) {
        return itemGroup.children
          .filter(x => x.userData.groupId === groupId)
          .map(x => x.userData.uid);
      }
      // Fallback: sceneItems
      const item = itemsRef.current.find(i => i.uid === uid);
      if (!item?.groupId) return [uid];
      return itemsRef.current
        .filter(i => i.groupId === item.groupId)
        .map(i => i.uid);
    }

    // Get the source uid of a group (the one that is not a clone)
    function getSourceUid(uid) {
      // First check Three.js userData — reliable even if sceneItems is stale
      const obj = itemGroup.children.find(x => x.userData.uid === uid);
      if (obj?.userData.arrayParent) return obj.userData.arrayParent;
      // Fallback: check sceneItems
      const item = itemsRef.current.find(i => i.uid === uid);
      if (!item?.groupId) return uid;
      const source = itemsRef.current.find(i => i.groupId === item.groupId && !i.isArrayClone);
      return source?.uid || uid;
    }

    function setGroupOutline(uids, visible) {
      uids.forEach(uid => {
        const c = itemGroup.children.find(x => x.userData.uid === uid);
        if (c) setOutlineVisible(c, visible);
      });
    }

    // ── Wall / Column / Door sync ─────────────────────────────
    function syncWallItem(item) {
      if (wallMeshMap.has(item.uid)) {
        wallGroup.remove(wallMeshMap.get(item.uid));
        wallMeshMap.delete(item.uid);
      }
      let mesh = null;
      if (item.type === 'wall')   mesh = buildWallMesh(item, itemsRef.current);
      if (item.type === 'column') {
        mesh = buildColumnMesh(item);
        if (mesh) mesh.position.set(item.x || 0, 0, item.z || 0);
      }
      if (item.type === 'door') {
        mesh = buildDoorMesh(item, itemsRef.current);
        // Also rebuild parent wall to update cutout
        const parentWall = itemsRef.current.find(i => i.uid === item.wallUid);
        if (parentWall) {
          const oldMesh = wallMeshMap.get(parentWall.uid);
          if (oldMesh) { wallGroup.remove(oldMesh); wallMeshMap.delete(parentWall.uid); }
          const wMesh = buildWallMesh(parentWall, itemsRef.current);
          if (wMesh) {
            wMesh.userData.uid = parentWall.uid; wMesh.userData.type = 'wall';
            wallGroup.add(wMesh); wallMeshMap.set(parentWall.uid, wMesh);
          }
        }
      }
      if (!mesh) return;
      mesh.userData.uid  = item.uid;
      mesh.userData.type = item.type;
      wallGroup.add(mesh);
      wallMeshMap.set(item.uid, mesh);
    }

    let draggingWallUid = null;
    let wallDragStart   = null; // { x, z } ground point at drag start
    let wallDragOrigItem = null; // original item state

    let hoveredWallUid   = null;
    let selectedWallUid  = null;

    function setWallHighlight(uid, type) {
      if (!uid) return;
      const mesh = wallMeshMap.get(uid);
      // Remove old outlines (stored as children with isWallOutline flag)
      if (mesh) {
        const toRemove = [];
        mesh.traverse(c => { if (c.userData.isWallOutline) toRemove.push(c); });
        toRemove.forEach(c => c.parent?.remove(c));
      }
      if (type === 'none' || !mesh) return;
      const color = type === 'select' ? 0xb48b31 : 0x88aaff;
      // Attach outline lines as children of each mesh so they move with it
      mesh.traverse(c => {
        if (!c.isMesh || c.userData.isMeta || c.userData.isWallOutline) return;
        const edges = new THREE.EdgesGeometry(c.geometry, 15);
        const line  = new THREE.LineSegments(edges,
          new THREE.LineBasicMaterial({ color, linewidth: 2, depthTest: false }));
        line.renderOrder = 999;
        line.userData.isWallOutline = true;
        c.add(line); // child of mesh — moves/rotates with parent automatically
      });
    }

    function removeWallItem(uid) {
      if (wallMeshMap.has(uid)) {
        wallGroup.remove(wallMeshMap.get(uid));
        wallMeshMap.delete(uid);
      }
    }

    function rebuildHandles() {
      handleGroup.clear();
      itemsRef.current.forEach(item => {
        if (item.type !== 'wall') return;
        const s = new THREE.Vector3(item.x1, 0, item.z1);
        const e = new THREE.Vector3(item.x2, 0, item.z2);
        const hs = buildEndpointHandle(s);
        hs.userData = { wallUid: item.uid, which: 'start' };
        const he = buildEndpointHandle(e);
        he.userData = { wallUid: item.uid, which: 'end' };
        handleGroup.add(hs, he);
      });
    }

    function getWallItems() {
      return itemsRef.current.filter(i => i.type === 'wall' || i.type === 'column' || i.type === 'door');
    }

    function openWallRadialMenu(item, screenPt) {
      const vw = window.innerWidth, vh = window.innerHeight;
      const minX = SAFE_AREA.left   + MENU_RADIUS;
      const maxX = vw - SAFE_AREA.right  - MENU_RADIUS;
      const minY = SAFE_AREA.top    + MENU_RADIUS;
      const maxY = vh - SAFE_AREA.bottom - MENU_RADIUS;
      // Clamp to usable viewport — if already inside, use original position
      const sp = {
        x: Math.max(minX, Math.min(maxX, screenPt.x)),
        y: Math.max(minY, Math.min(maxY, screenPt.y)),
      };
      onRadialMenuRef.current?.({
        x: screenPt.x, y: screenPt.y,
        uid: item.uid,
        itemType: item.type,
        modelId: null,
        initialColor: item.color || '#cccccc',
        initialRotY: 0,
        initialActiveBtn: 'props',
        wallProps: {
          itemType:   item.type,
          height:     item.height     ?? 2.4,
          thickness:  item.thickness  ?? 0.1,
          glassRatio: item.glassRatio ?? 0,
          openAngle:  item.openAngle  ?? 45,
          shape:      item.shape      ?? 'square',
          width:      item.width      ?? 0.3,
          depth:      item.depth      ?? 0.3,
        },
      });
    }

    function snap(v) { return Math.round(v/GRID_SNAP)*GRID_SNAP; }

    function clampFloor(x, z, hw, hd) {
      return {
        x: Math.max(-floorW/2+hw, Math.min(floorW/2-hw, x)),
        z: Math.max(-floorD/2+hd, Math.min(floorD/2-hd, z)),
      };
    }

    function groundPt(cx, cy) {
      const r = canvas.getBoundingClientRect();
      pointer.x =  ((cx-r.left)/r.width) *2-1;
      pointer.y = -((cy-r.top) /r.height)*2+1;
      raycaster.setFromCamera(pointer, camera);
      const pt = new THREE.Vector3();
      raycaster.ray.intersectPlane(planeY0, pt);
      return pt;
    }

    function getContainer(mesh) {
      let o = mesh;
      while (o.parent && o.parent !== itemGroup) o = o.parent;
      return o.parent === itemGroup ? o : null;
    }

    function getHitContainer(cx, cy) {
      const r = canvas.getBoundingClientRect();
      pointer.x =  ((cx-r.left)/r.width) *2-1;
      pointer.y = -((cy-r.top) /r.height)*2+1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(itemGroup.children, true)
        .filter(h => !h.object.userData.isMeta);
      return hits.length ? getContainer(hits[0].object) : null;
    }

    // Pending drop positions — uid -> {x, z}
    const pendingPositions = new Map();

    // Close radial menu with animation if possible
    function closeRadialMenu() {
      const wrapper = radialMenuWrapperRef?.current;
      if (wrapper?._triggerClose) wrapper._triggerClose();
      else onRadialMenuRef.current?.(null);
      restoreOOBMaterials();
    }

    function restoreOOBMaterials() {
      itemGroup.children.forEach(c => {
        if (!c.userData.isArrayClone || !c.userData.outOfBounds) return;
        const source = itemGroup.children.find(x => x.userData.uid === c.userData.arrayParent);
        const srcMeshes = [];
        if (source) source.traverse(ch => { if (ch.isMesh && !ch.userData.isMeta) srcMeshes.push(ch); });
        let si = 0;
        c.traverse(ch => {
          if (ch.isMesh && !ch.userData.isMeta) { ch.material = srcMeshes[si]?.material ?? ch.material; si++; }
        });
        c.userData.outOfBounds = false;
        c.userData.origMats = [];
      });
    }
    // Project 3D position to screen coords
    function project3D(obj) {
      obj.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(obj);
      const top = new THREE.Vector3();
      box.getCenter(top);
      top.y = box.max.y + 1.2;
      top.project(camera);
      const rect = canvas.getBoundingClientRect();
      return {
        x: (top.x + 1) / 2 * rect.width  + rect.left,
        y: (-top.y + 1) / 2 * rect.height + rect.top,
      };
    }

    // Pan camera so radial menu stays fully visible inside the usable viewport
    // (accounting for sidebar, quote panel, header, bottom bar)
    const PAN_DUR = 520; // ms — slower = smoother feel
    const SAFE_AREA = {
      left:   350, // sidebar panel (260) + toolbar (~48) + gaps
      right:  260, // quote panel min-width + margin
      top:    110, // header pill + margin
      bottom: 110, // bottom bar + margin
    };
    const MENU_RADIUS = 140; // px — radial menu radius + small padding
    let panAnim = null;
    function panCameraToShowMenu(sp) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const minX = SAFE_AREA.left   + MENU_RADIUS;
      const maxX = vw - SAFE_AREA.right  - MENU_RADIUS;
      const minY = SAFE_AREA.top    + MENU_RADIUS;
      const maxY = vh - SAFE_AREA.bottom - MENU_RADIUS;

      let dx = 0, dy = 0;
      if (sp.x < minX) dx = sp.x - minX;
      if (sp.x > maxX) dx = sp.x - maxX;
      if (sp.y < minY) dy = sp.y - minY;
      if (sp.y > maxY) dy = sp.y - maxY;
      if (dx === 0 && dy === 0) return;

      // Convert pixel delta → world-space using camera right & up vectors
      const dist = camera.position.distanceTo(controls.target);
      const fovRad = camera.fov * Math.PI / 180;
      const unitsPerPx = 2 * Math.tan(fovRad / 2) * dist / vh;

      const right = new THREE.Vector3();
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      right.crossVectors(forward, camera.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, forward).normalize();

      const worldDelta = new THREE.Vector3()
        .addScaledVector(right, dx * unitsPerPx)
        .addScaledVector(up,   -dy * unitsPerPx);

      const startTarget = controls.target.clone();
      const startCamPos = camera.position.clone();
      const endTarget   = startTarget.clone().add(worldDelta);
      const endCamPos   = startCamPos.clone().add(worldDelta);
      const startTime   = performance.now();

      if (panAnim) cancelAnimationFrame(panAnim);
      function doPan() {
        const t = Math.min((performance.now() - startTime) / PAN_DUR, 1);
        // Cubic ease in-out: smooth start and end
        const e = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2;
        camera.position.lerpVectors(startCamPos, endCamPos, e);
        controls.target.lerpVectors(startTarget, endTarget, e);
        controls.update();
        if (t < 1) panAnim = requestAnimationFrame(doPan);
      }
      doPan();
    }

    const onPointerDown = e => {
      // ── Right click: end wall chain ───────────────────────
      if (e.button === 2) {
        if (modeRef.current === 'draw') {
          clearDrawGhosts();
          onToolChangeRef.current?.('select');
        }
        return;
      }
      if (e.button !== 0) return;

      // ── Draw Layout mode ──────────────────────────────────
      if (modeRef.current === 'draw') {
        const raw = groundPt(e.clientX, e.clientY);

        // ── Handle drag (endpoint handles) ───────────────
        raycaster.setFromCamera(pointer, camera);
        const handleHits = raycaster.intersectObjects(handleGroup.children, false);
        if (handleHits.length > 0) {
          const h = handleHits[0].object;
          draggingHandle = h;
          dragHandleWallUid = h.userData.wallUid;
          dragHandleWhich  = h.userData.which;
          controls.enabled = false; // disable orbit only during handle drag
          return;
        }

        // ── Wall tool ─────────────────────────────────────
        if (activeToolRef.current === 'wall') {
          const walls = itemsRef.current.filter(i => i.type === 'wall');
          const { pt } = snapWallPoint(raw, walls, floorW, floorD);
          if (!wallState.active) {
            // First click — set start
            wallState.active = true;
            wallState.start  = pt;
            wallState.end    = pt.clone();
            startMarker.position.set(pt.x, 0.06, pt.z);
            startMarker.visible = true;
          } else {
            // Second+ click — confirm wall segment
            const endPt = e.shiftKey ? pt : snapAngle(wallState.start, pt);
            // Clamp endpoint to floor
            const eCl = clampFloor(endPt.x, endPt.z, 0, 0);
            endPt.x = eCl.x; endPt.z = eCl.z;
            const dx = endPt.x - wallState.start.x, dz = endPt.z - wallState.start.z;
            if (Math.sqrt(dx*dx + dz*dz) > 0.1) {
              const uid = `wall_${Date.now()}`;
              const newWall = {
                uid, type: 'wall',
                x1: wallState.start.x, z1: wallState.start.z,
                x2: endPt.x,          z2: endPt.z,
                height: 2.4, thickness: 0.1, glassRatio: 0, color: '#cccccc',
              };
              wallState.chainGroup.push(uid);
              const next = [...itemsRef.current, newWall];
              itemsRef.current = next;
              onChangeRef.current?.(next);
              syncWallItem(newWall);
              rebuildHandles();
              // Chain: new start = this end
              wallState.start = endPt.clone();
              startMarker.position.set(endPt.x, 0.06, endPt.z);
            }
          }
          return;
        }

        // ── Column tool ───────────────────────────────────
        if (activeToolRef.current === 'column') {
          const uid = `col_${Date.now()}`;
          const colHalf = 0.15; // default half-size
          const clamped = clampFloor(snap(raw.x), snap(raw.z), colHalf, colHalf);
          const newCol = {
            uid, type: 'column',
            x: clamped.x, z: clamped.z,
            width: 0.3, depth: 0.3, height: 2.4, color: '#cccccc', shape: 'square',
          };
          const next = [...itemsRef.current, newCol];
          itemsRef.current = next;
          onChangeRef.current?.(next);
          syncWallItem(newCol);
          clearDrawGhosts();
          onToolChangeRef.current?.('select');
          return;
        }

        // ── Door tool ─────────────────────────────────────
        if (activeToolRef.current === 'door') {
          const walls = itemsRef.current.filter(i => i.type === 'wall');
          const hit = findClosestWall(raw, walls);
          if (hit) {
            const uid = `door_${Date.now()}`;
            const newDoor = {
              uid, type: 'door',
              wallUid: hit.wall.uid, t: hit.t,
              width: DOOR_W, height: DOOR_H,
              openAngle: 45, color: '#cccccc',
            };
            const next = [...itemsRef.current, newDoor];
            itemsRef.current = next;
            onChangeRef.current?.(next);
            syncWallItem(newDoor);
            clearDrawGhosts();
            onToolChangeRef.current?.('select');
          }
          return;
        }

        // ── Select in draw mode (only when select tool active) ──
        if (activeToolRef.current !== 'select') return;
        // Update pointer from actual click position
        const r2 = canvas.getBoundingClientRect();
        pointer.x =  ((e.clientX - r2.left) / r2.width)  * 2 - 1;
        pointer.y = -((e.clientY - r2.top)  / r2.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const wallHit = raycaster.intersectObjects(wallGroup.children, true)
          .filter(h => !h.object.userData.isMeta && !h.object.userData.isWallOutline);
        if (wallHit.length > 0) {
          let cur = wallHit[0].object;
          while (cur && !cur.userData?.uid) cur = cur.parent;
          const uid = cur?.userData?.uid;
          if (uid) {
            const item = itemsRef.current.find(i => i.uid === uid);
            if (item) {
              if (selectedWallUid && selectedWallUid !== uid) setWallHighlight(selectedWallUid, 'none');
              selectedWallUid = uid;
              setWallHighlight(uid, 'select');
              // Start potential drag
              draggingWallUid  = uid;
              wallDragStart    = { x: raw.x, z: raw.z };
              wallDragOrigItem = { ...item };
              controls.enabled = false; // disable orbit during wall drag
              // Open radial menu above item
              const mesh = wallMeshMap.get(uid);
              if (mesh) {
                const box = new THREE.Box3().setFromObject(mesh);
                const top = new THREE.Vector3(); box.getCenter(top);
                top.y = box.max.y + 0.5;
                top.project(camera);
                const rect = canvas.getBoundingClientRect();
                const sp = {
                  x: (top.x + 1) / 2 * rect.width + rect.left,
                  y: (-top.y + 1) / 2 * rect.height + rect.top,
                };
                panCameraToShowMenu(sp);
                openWallRadialMenu(item, sp);
              }
            }
          }
          return;
        }
        // Click on empty — deselect
        if (selectedWallUid) { setWallHighlight(selectedWallUid, 'none'); selectedWallUid = null; }
        closeRadialMenu();
        return;
      }

      const c = getHitContainer(e.clientX, e.clientY);
      if (!c) {
        // Deselect
        setGroupOutline(selectedUids, false);
        selectedUid = null; selectedUids = [];
        if(engRef.current) engRef.current.selectedUidRef.current = null;
        closeRadialMenu();
        return;
      }
      draggingUid = c.userData.uid;
      dragArmed   = false;
      dragStartX  = e.clientX; dragStartY = e.clientY;
      controls.enabled = false;
      onRadialMenuRef.current?.(null);
      restoreOOBMaterials(); // clear array OOB red and reset outOfBounds flags
      // Pre-compute drag offsets for the whole group — always recalculate fresh
      const pt   = groundPt(e.clientX, e.clientY);
      const uids = getGroupUids(draggingUid);
      dragOffsets = {};
      uids.forEach(uid => {
        const obj = itemGroup.children.find(x => x.userData.uid === uid);
        if (obj) dragOffsets[uid] = { dx: obj.position.x - pt.x, dz: obj.position.z - pt.z };
      });
    };

    const onPointerMove = e => {
      // ── Draw Layout mode move ─────────────────────────────
      if (modeRef.current === 'draw') {
        const raw = groundPt(e.clientX, e.clientY);
        const walls = itemsRef.current.filter(i => i.type === 'wall');

        // Handle drag
        if (draggingHandle && dragHandleWallUid) {
          const { pt } = snapWallPoint(raw, walls, floorW, floorD);
          const next = itemsRef.current.map(i => {
            if (i.uid !== dragHandleWallUid) return i;
            if (dragHandleWhich === 'start') return { ...i, x1: pt.x, z1: pt.z };
            return { ...i, x2: pt.x, z2: pt.z };
          });
          itemsRef.current = next;
          onChangeRef.current?.(next);
          rebuildHandles();
          return;
        }

        // Wall/column/door drag in select mode - with grid snap
        if (draggingWallUid && wallDragStart && wallDragOrigItem && activeToolRef.current === 'select') {
          const orig = wallDragOrigItem;
          let updated;
          if (orig.type === 'wall') {
            const dx = snap(raw.x) - snap(wallDragStart.x);
            const dz = snap(raw.z) - snap(wallDragStart.z);
            const c1 = clampFloor(orig.x1+dx, orig.z1+dz, 0, 0);
            const c2 = clampFloor(orig.x2+dx, orig.z2+dz, 0, 0);
            updated = { ...orig, x1: c1.x, z1: c1.z, x2: c2.x, z2: c2.z };
          } else if (orig.type === 'column') {
            const colW = (orig.width || 0.3) / 2;
            const cc = clampFloor(snap(raw.x), snap(raw.z), colW, colW);
            updated = { ...orig, x: cc.x, z: cc.z };
          } else if (orig.type === 'door') {
            const wall = itemsRef.current.find(i => i.uid === orig.wallUid);
            if (wall) {
              const wx = wall.x2 - wall.x1, wz = wall.z2 - wall.z1;
              const wlen2 = wx*wx + wz*wz;
              const t = Math.max(0.05, Math.min(0.95,
                ((raw.x - wall.x1)*wx + (raw.z - wall.z1)*wz) / wlen2
              ));
              updated = { ...orig, t };
            } else return;
          } else return;
          const next = itemsRef.current.map(i => i.uid === draggingWallUid ? updated : i);
          itemsRef.current = next;
          onChangeRef.current?.(next);
          syncWallItem(updated);
          if (orig.type !== 'door') rebuildHandles();
          return;
        }

        if (activeToolRef.current === 'wall') {
          if (wallState.active && wallState.start) {
            const snapped = e.shiftKey
              ? snapWallPoint(raw, walls, floorW, floorD).pt
              : snapAngle(wallState.start, snapWallPoint(raw, walls, floorW, floorD).pt);
            // Clamp endpoint to floor
            const cl = clampFloor(snapped.x, snapped.z, 0, 0);
            const pt = new THREE.Vector3(cl.x, 0, cl.z);
            // Update ghost
            if (wallState.ghost) scene.remove(wallState.ghost);
            const def = itemsRef.current.find(i => i.uid === wallState.chainGroup[0]);
            const h = def?.height ?? 2.4, t = def?.thickness ?? 0.1;
            wallState.ghost = buildWallGhost(wallState.start, pt, h, t);
            if (wallState.ghost) { wallState.ghost.raycast = () => {}; scene.add(wallState.ghost); }
          }
        }

        if (activeToolRef.current === 'column') {
          if (colGhost) scene.remove(colGhost);
          colGhost = buildColumnGhost();
          const cg = clampFloor(snap(raw.x), snap(raw.z), 0.15, 0.15);
          colGhost.position.set(cg.x, 0, cg.z);
          colGhost.raycast = () => {};
          scene.add(colGhost);
        }

        if (activeToolRef.current === 'door') {
          if (doorGhost) { scene.remove(doorGhost); doorGhost = null; }
          const hit = findClosestWall(raw, walls);
          if (hit) {
            const { wall, t } = hit;
            const dx = wall.x2 - wall.x1, dz = wall.z2 - wall.z1;
            const wallAngle = -Math.atan2(dz, dx);
            doorGhost = buildDoorGhost(wallAngle);
            doorGhost.raycast = () => {};
            const wx = wall.x1 + dx * t, wz = wall.z1 + dz * t;
            doorGhost.position.set(wx, 0, wz);
            scene.add(doorGhost);
          }
        }
        return;
      }

      if (!draggingUid) {
        if (e.buttons !== 0) return;
        const c   = getHitContainer(e.clientX, e.clientY);
        const uid = c?.userData.uid || null;
        if (uid !== hoveredUid) {
          // Clear old hover outline (only if not selected)
          if (hoveredUid) {
            const hoverGroup = getGroupUids(hoveredUid);
            const notSelected = hoverGroup.filter(u => !selectedUids.includes(u));
            setGroupOutline(notSelected, false);
            dot.visible = false;
          }
          hoveredUid = uid;
          if (uid) {
            setGroupOutline(getGroupUids(uid), true);
            updateDot(c);
            canvas.style.cursor = 'grab';
          } else {
            dot.visible = false;
            canvas.style.cursor = 'default';
          }
        }
        return;
      }
      if (!dragArmed) {
        if (Math.hypot(e.clientX-dragStartX, e.clientY-dragStartY) < DRAG_THRESHOLD) return;
        dragArmed = true;
        canvas.style.cursor = 'grabbing';
      }
      const pt = groundPt(e.clientX, e.clientY);
      const anchorOff = dragOffsets[draggingUid];
      const anchorObj = itemGroup.children.find(x => x.userData.uid === draggingUid);
      if (!anchorOff || !anchorObj) return;
      // Clamp using only in-bounds members (OOB clones don't constrain movement)
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      Object.entries(dragOffsets).forEach(([uid, off]) => {
        const obj = itemGroup.children.find(x => x.userData.uid === uid);
        if (!obj || obj.userData.outOfBounds) return;
        const b = new THREE.Box3().setFromObject(obj);
        const relX = off.dx - anchorOff.dx, relZ = off.dz - anchorOff.dz;
        const hw = (b.max.x - b.min.x) / 2, hd = (b.max.z - b.min.z) / 2;
        minX = Math.min(minX, relX - hw); maxX = Math.max(maxX, relX + hw);
        minZ = Math.min(minZ, relZ - hd); maxZ = Math.max(maxZ, relZ + hd);
      });
      if (minX === Infinity) {
        const b = new THREE.Box3().setFromObject(anchorObj);
        const hw = (b.max.x-b.min.x)/2, hd = (b.max.z-b.min.z)/2;
        minX=-hw; maxX=hw; minZ=-hd; maxZ=hd;
      }
      const rawX = snap(pt.x + anchorOff.dx), rawZ = snap(pt.z + anchorOff.dz);
      const clampedX = Math.max(-floorW/2 - minX, Math.min(floorW/2 - maxX, rawX));
      const clampedZ = Math.max(-floorD/2 - minZ, Math.min(floorD/2 - maxZ, rawZ));
      const ddx = clampedX - (pt.x + anchorOff.dx);
      const ddz = clampedZ - (pt.z + anchorOff.dz);
      // Move ALL members including OOB clones
      Object.entries(dragOffsets).forEach(([uid, off]) => {
        const obj = itemGroup.children.find(x => x.userData.uid === uid);
        if (!obj) return;
        obj.position.x = pt.x + off.dx + ddx;
        obj.position.z = pt.z + off.dz + ddz;
      });
      updateDot(anchorObj);
    };

    const onPointerUp = e => {
      controls.enabled = true;
      if (draggingHandle) {
        draggingHandle = null; dragHandleWallUid = null; dragHandleWhich = null;
        return;
      }
      if (draggingWallUid) {
        draggingWallUid = null; wallDragStart = null; wallDragOrigItem = null;
      }
      if (modeRef.current === 'draw') return;
      if (!draggingUid) return;

      if (!dragArmed) {
        // Click = select group
        const clickedGroupUids = getGroupUids(draggingUid);
        const sourceUid = getSourceUid(draggingUid);

        if (selectedUid === sourceUid) {
          // Deselect
          setGroupOutline(selectedUids, false);
          selectedUid = null; selectedUids = [];
          if(engRef.current) engRef.current.selectedUidRef.current = null;
          onRadialMenuRef.current?.(null);
        } else {
          // Select whole group, outline all
          setGroupOutline(selectedUids, false); // clear old
          selectedUid  = sourceUid;
          selectedUids = clickedGroupUids;
          if(engRef.current) engRef.current.selectedUidRef.current = sourceUid;
          setGroupOutline(selectedUids, true);
          // Show radial menu over the source object
          const sourceObj = itemGroup.children.find(x => x.userData.uid === sourceUid);
          if (sourceObj) {
            const sp = project3D(sourceObj);
            panCameraToShowMenu(sp);
            const savedItem = itemsRef.current.find(i => i.uid === sourceUid);
            // Collect toggle meshes and socket positions from loaded GLB
            const toggleMeshes = [];
            const socketPositions = {};
            sourceObj.traverse(child => {
              if (child.userData.isToggleMesh) toggleMeshes.push({ name: child.name, visible: child.visible });
            });
            // Get socketPositions from the GLB root userData
            const glbRoot = sourceObj.children.find(c => c.userData.socketPositions);
            if (glbRoot?.userData.socketPositions) Object.assign(socketPositions, glbRoot.userData.socketPositions);
            // Also check direct children
            sourceObj.traverse(c => { if (c.userData?.socketPositions) Object.assign(socketPositions, c.userData.socketPositions); });
            onRadialMenuRef.current?.({
              x: sp.x, y: sp.y, uid: sourceUid,
              modelId: sourceObj.userData.modelId,
              initialRotY: sourceObj.rotation.y,
              initialColor: savedItem?.color || null,
              initialArrayState: savedItem?.groupId
                ? { count: itemsRef.current.filter(i=>i.groupId===savedItem.groupId).length, spacing: savedItem?.arrayGap || 0 }
                : null,
              toggleMeshes,
              socketPositions,
            });
          }
        }
      } else {
        // Drag ended — update positions in React state for all moved objects
        const sourceUid = getSourceUid(draggingUid);
        selectedUid  = sourceUid;
        selectedUids = getGroupUids(draggingUid);
        if(engRef.current) engRef.current.selectedUidRef.current = sourceUid;
        setGroupOutline(selectedUids, true);

        const next = itemsRef.current.map(i => {
          const obj = itemGroup.children.find(x => x.userData.uid === i.uid);
          if (obj && dragOffsets[i.uid]) return { ...i, x: obj.position.x, z: obj.position.z };
          return i;
        });
        onChangeRef.current?.(next);

        // Reshow menu over source
        const sourceObj = itemGroup.children.find(x => x.userData.uid === sourceUid);
        if (sourceObj) {
          const sp = project3D(sourceObj);
          panCameraToShowMenu(sp);
          const savedItem2 = itemsRef.current.find(i => i.uid === sourceUid);
          onRadialMenuRef.current?.({
            x: sp.x, y: sp.y, uid: sourceUid,
            modelId: sourceObj.userData.modelId,
            initialRotY: sourceObj.rotation.y,
            initialColor: savedItem2?.color || null,
            initialArrayState: savedItem2?.groupId
              ? { count: itemsRef.current.filter(i=>i.groupId===savedItem2.groupId).length, spacing: savedItem2?.arrayGap || 0 }
              : null,
          });
        }
        canvas.style.cursor = hoveredUid ? 'grab' : 'default';
      }
      draggingUid = null; dragArmed = false; dragOffsets = {};
    };

    function clearDrawGhosts() {
      if (wallState.ghost) { scene.remove(wallState.ghost); wallState.ghost = null; }
      if (colGhost)  { scene.remove(colGhost);  colGhost  = null; }
      if (doorGhost) { scene.remove(doorGhost); doorGhost = null; }
      startMarker.visible = false;
      wallState.active = false;
      wallState.start  = null;
      wallState.chainGroup = [];
      if (selectedWallUid) { setWallHighlight(selectedWallUid, 'none'); selectedWallUid = null; }
      if (hoveredWallUid)  { setWallHighlight(hoveredWallUid, 'none');  hoveredWallUid  = null; }
      closeRadialMenu();
    }

    const onKeyDown = e => {
      if (e.key === 'Escape') {
        clearDrawGhosts();
        closeRadialMenu();
        onToolChangeRef.current?.('select');
        return;
      }
      if (e.key!=='Delete' && e.key!=='Backspace') return;
      if (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
      if (!selectedUid) return;
      // Remove all selected group members with animation
      const uidsToRemove = new Set(selectedUids);
      selectedUids.forEach(uid => deleteContainer(uid));
      setTimeout(() => {
        const next = itemsRef.current.filter(i=>!uidsToRemove.has(i.uid));
        onChangeRef.current?.(next);
      }, 400);
      selectedUid=null; selectedUids=[]; dot.visible=false;
      onRadialMenuRef.current?.(null);
    };

    // ── Drag ghost ────────────────────────────────────────────
    let dragGhost = null;
    let dragGhostModelId = null;

    function createDragGhost(modelId) {
      if (dragGhost) { itemGroup.remove(dragGhost); dragGhost = null; }
      dragGhostModelId = modelId;
      const def = (config._catalogFlat || []).find(d => d.id === modelId);
      if (!def?.file) return;
      loadModel(def.file).then(original => {
        if (dragGhostModelId !== modelId) return; // drag changed or ended
        const ghost = original.clone(true);
        ghost.userData.isMeta = true;
        ghost.traverse(c => {
          if (c.isMesh && !c.userData.isMeta) {
            c.material = new THREE.MeshStandardMaterial({
              color: 0x4488ff, transparent: true, opacity: 0.45, depthWrite: false,
            });
          }
        });
        dragGhost = ghost;
        itemGroup.add(dragGhost);
      });
    }

    function moveDragGhost(clientX, clientY) {
      if (!dragGhost) return;
      const pt = groundPt(clientX, clientY);
      dragGhost.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(dragGhost);
      const hw = (box.max.x - box.min.x) / 2 || 0.5;
      const hd = (box.max.z - box.min.z) / 2 || 0.5;
      const cl = clampFloor(snap(pt.x), snap(pt.z), hw, hd);
      dragGhost.position.x = cl.x;
      dragGhost.position.z = cl.z;
    }

    function removeDragGhost() {
      if (dragGhost) { itemGroup.remove(dragGhost); dragGhost = null; dragGhostModelId = null; }
    }

    const onDragEnter = e => {
      const modelId = e.dataTransfer?.types?.includes('text/plain')
        ? null : null; // can't read data in dragenter, will get it in dragover
      e.preventDefault();
    };

    const onDragOver = e => {
      e.preventDefault();
      const modelId = window.__dragModelId;
      if (modelId && modelId !== dragGhostModelId) createDragGhost(modelId);
      moveDragGhost(e.clientX, e.clientY);
    };

    const onDragLeave = e => {
      // Only remove if leaving the canvas entirely
      if (!canvas.contains(e.relatedTarget)) removeDragGhost();
    };

    const onDrop = e => {
      e.preventDefault();
      const modelId = e.dataTransfer?.getData('modelId');
      if (!modelId) return;
      // Use ghost position if available (already clamped to floor)
      const x = dragGhost ? dragGhost.position.x : snap(groundPt(e.clientX, e.clientY).x);
      const z = dragGhost ? dragGhost.position.z : snap(groundPt(e.clientX, e.clientY).z);
      removeDragGhost();
      const uid = `${modelId}_${Date.now()}`;
      pendingPositions.set(uid, { x, z });
      const next = [...itemsRef.current, { uid, modelId, count: 1, x, z, rotY: 0 }];
      onChangeRef.current?.(next);
    };

    const onContextMenu = e => { if (modeRef.current === 'draw') e.preventDefault(); };
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup',   onPointerUp);
    window.addEventListener('keydown',     onKeyDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('dragenter',   onDragEnter);
    canvas.addEventListener('dragover',    onDragOver);
    canvas.addEventListener('dragleave',   onDragLeave);
    canvas.addEventListener('drop',        onDrop);

    // ── Spawn container ───────────────────────────────────────
    function spawnContainer(modelId, uid, x, z) {
      const def = catalogRef.current.find(m=>m.id===modelId);
      const w   = def?.w||1, h = def?.h||1, d = def?.d||0.2;

      const container = new THREE.Group();
      container.userData.uid     = uid;
      container.userData.modelId = modelId;
      container.position.set(x, 0, z);

      // Placeholder box (shown while GLB loads)
      const ph = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(def?.color || '#3a6ea5'), roughness: 0.45, metalness: 0.15 })
      );
      ph.position.y = h/2;
      ph.castShadow = ph.receiveShadow = true;
      ph.userData.isPlaceholder = true;
      container.add(ph);
      attachOutlines(ph);

      itemGroup.add(container);

      // Spawn animation
      container.scale.set(0.01, 0.01, 0.01);
      spawnAnims.push({ container, startTime: performance.now() });

      // Load real GLB if available
      function createObj(root) {
        root.userData.uid     = uid;
        root.userData.modelId = modelId;
        root.traverse(c => { if (c.isMesh) { c.castShadow=c.receiveShadow=true; } });
        applyPaintColor(root, def?.color);
        container.remove(ph);
        container.add(root);
        attachOutlines(root);
        const isActive = selectedUids.includes(uid) || hoveredUid === uid ||
          (uid !== hoveredUid && getGroupUids(hoveredUid || '').includes(uid)) ||
          getGroupUids(selectedUid || '').includes(uid);
        setOutlineVisible(container, isActive);
        const saved = itemsRef.current.find(i=>i.uid===uid);
        if (saved?.rotY) container.rotation.y = saved.rotY;
        if (saved?.color) applyColor(uid, saved.color);
        // Restore toggle mesh states
        if (saved?.toggleStates) {
          Object.entries(saved.toggleStates).forEach(([meshName, visible]) => {
            root.traverse(obj => { if (obj.name === meshName) obj.visible = visible; });
          });
        }
        // Restore socket accessory states
        if (saved?.socketStates) {
          const catalogItem = catalogRef.current.find(d => d.id === modelId);
          Object.entries(saved.socketStates).forEach(([socketName, state]) => {
            const socketDef = catalogItem?.sockets?.find(s => s.name === socketName);
            if (socketDef) {
              const positions = root.userData?.socketPositions?.[socketName] || [];
              applySocket(uid, socketName, state, { ...socketDef, socketPositions: positions });
            }
          });
        }
      }

      if (def?.file) {
        loadModel(def.file).then(original => {
          if (!itemGroup.children.includes(container)) return;
          createObj(original.clone(true));
        }).catch(err => console.warn('GLB load failed:', err));
      }

      return container;
    }

    // Expose for sync effect
    // Delete with exit animation
    function deleteContainer(uid) {
      const c = itemGroup.children.find(x=>x.userData.uid===uid);
      if (!c) return;
      const POP_DUR    = 150;
      const SHRINK_DUR = 220;
      const startPop   = performance.now();
      function animPop() {
        const t = Math.min((performance.now()-startPop)/POP_DUR, 1);
        const s = 1 + Math.sin(t * Math.PI) * 0.28;
        c.scale.set(s, s, s);
        if (t < 1) { requestAnimationFrame(animPop); return; }
        // Phase 2 — shrink
        const startShrink = performance.now();
        function animShrink() {
          const t2 = Math.min((performance.now()-startShrink)/SHRINK_DUR, 1);
          const s2 = Math.max(0, 1 - springEase(t2));
          c.scale.set(s2, s2, s2);
          if (t2 < 1) requestAnimationFrame(animShrink);
          else itemGroup.remove(c);
        }
        requestAnimationFrame(animShrink);
      }
      requestAnimationFrame(animPop);
    }

    // Lerp rotation animations
    const rotAnims = new Map(); // uid -> { from, to, startTime }
    const ROT_DUR  = 300; // ms

    function rotateObject(uid, rotY) {
      const source = itemGroup.children.find(x=>x.userData.uid===uid);
      if (!source) return;
      const item = itemsRef.current.find(i=>i.uid===uid);
      const groupUids = item?.groupId
        ? itemsRef.current.filter(i=>i.groupId===item.groupId).map(i=>i.uid)
        : [uid];
      const prevRotY = source.rotation.y;
      const delta    = rotY - prevRotY;
      // Animate source rotation
      rotAnims.set(uid, { from: prevRotY, to: rotY, startTime: performance.now() });
      // Rotate clones around source origin
      const ox = source.position.x, oz = source.position.z;
      const cos = Math.cos(delta), sin = Math.sin(delta);
      groupUids.forEach(cuid => {
        if (cuid === uid) return;
        const clone = itemGroup.children.find(x=>x.userData.uid===cuid);
        if (!clone) return;
        const dx = clone.position.x - ox, dz = clone.position.z - oz;
        // 2D rotation: x' = dx*cos - dz*sin, z' = dx*sin + dz*cos  (standard CCW)
        // Three.js rotY is CCW so we negate sin for CW visual match
        const nx = dx*cos + dz*sin + ox;
        const nz = -dx*sin + dz*cos + oz;
        rotAnims.set(cuid, {
          from: clone.rotation.y, to: clone.rotation.y + delta,
          startTime: performance.now(),
          posAnim: { fromX: clone.position.x, fromZ: clone.position.z, toX: nx, toZ: nz }
        });
      });
      // Update React state
      const next = itemsRef.current.map(i => {
        if (!groupUids.includes(i.uid) || i.uid === uid) return i;
        const dx = i.x - ox, dz = i.z - oz;
        return { ...i, x: dx*cos + dz*sin + ox, z: -dx*sin + dz*cos + oz, rotY: i.rotY + delta };
      });
      onChangeRef.current?.(next);
    }

    function applyColor(uid, color) {
      // Apply to all group members
      const item = itemsRef.current.find(i=>i.uid===uid);
      const groupUids = item?.groupId
        ? itemsRef.current.filter(i=>i.groupId===item.groupId).map(i=>i.uid)
        : [uid];
      groupUids.forEach(gid => _applyColorToContainer(gid, color));
      // Update React state for all
      const next = itemsRef.current.map(i => groupUids.includes(i.uid) ? { ...i, color } : i);
      onChangeRef.current?.(next);
    }
    function _applyColorToContainer(uid, color) {
      const c = itemGroup.children.find(x=>x.userData.uid===uid);
      if (!c) return;
      const paintColor = new THREE.Color(color);
      let hasPaintMat = false;
      // Check if any mesh has paint_color
      c.traverse(child => {
        if (!child.isMesh || child.userData.isMeta) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => { if (m.name === 'paint_color') hasPaintMat = true; });
      });
      c.traverse(child => {
        if (!child.isMesh || child.userData.isMeta) return;
        if (Array.isArray(child.material)) {
          child.material = child.material.map(m => {
            if (hasPaintMat && m.name !== 'paint_color') return m;
            const cloned = m.clone(); // clone so we don't affect other instances
            cloned.color.set(paintColor);
            return cloned;
          });
        } else {
          if (hasPaintMat && child.material.name !== 'paint_color') return;
          child.material = child.material.clone();
          child.material.color.set(paintColor);
        }
      });
    }

    function toggleMeshVisibility(uid, meshName, visible) {
      const container = itemGroup.children.find(x=>x.userData.uid===uid);
      if (!container) return;
      container.traverse(obj => {
        if (obj.name === meshName) obj.visible = visible;
      });
      const next = itemsRef.current.map(i => {
        if (i.uid !== uid) return i;
        const toggleStates = { ...(i.toggleStates||{}), [meshName]: visible };
        return { ...i, toggleStates };
      });
      onChangeRef.current?.(next);
    }

    // ── Socket accessory management ───────────────────────────
    // socketContainers: uid -> { socketName -> THREE.Group (the loaded accessory) }
    const socketContainers = new Map();

    function getSocketContainer(uid) {
      if (!socketContainers.has(uid)) socketContainers.set(uid, {});
      return socketContainers.get(uid);
    }

    // Cancellation tokens for async socket loads: "uid:socketName" -> token object
    const socketLoadTokens = new Map();

    function applySocketVisual(uid, container, sc, socketName, state, socketDef) {
      // Cancel any pending async loads for this uid+socket
      const tokenKey = uid + ':' + socketName;
      const token = { cancelled: false };
      socketLoadTokens.set(tokenKey, token);

      const behavior = socketDef?.behavior || 'fixed';
      if (behavior === 'fixed') {
        if (!state?.on) return;
        const positions = socketDef?.socketPositions || [];
        if (positions.length === 0) return;
        const pos = positions[0];
        if (!socketDef?.accessoryFile) return;
        loadModel(socketDef.accessoryFile).then(orig => {
          if (token.cancelled) return;
          const acc = orig.clone(true);
          acc.userData.isSocketAccessory = true;
          acc.userData.socketName = socketName;
          acc.position.set(pos.position.x, pos.position.y, pos.position.z);
          if (pos.quaternion) acc.quaternion.set(pos.quaternion.x, pos.quaternion.y, pos.quaternion.z, pos.quaternion.w);
          acc.rotateY(Math.PI);
          container.add(acc);
          sc[socketName] = acc;
        });
      } else if (behavior === 'positions') {
        const posIdx = state?.positionIndex ?? -1;
        if (posIdx < 0) return;
        const positions = socketDef?.socketPositions || [];
        const pos = positions[posIdx];
        if (!pos || !socketDef?.accessoryFile) return;
        loadModel(socketDef.accessoryFile).then(orig => {
          if (token.cancelled) return;
          const acc = orig.clone(true);
          acc.userData.isSocketAccessory = true;
          acc.userData.socketName = socketName;
          acc.position.set(pos.position.x, pos.position.y, pos.position.z);
          if (pos.quaternion) acc.quaternion.set(pos.quaternion.x, pos.quaternion.y, pos.quaternion.z, pos.quaternion.w);
          acc.rotateY(Math.PI);
          container.add(acc);
          sc[socketName] = acc;
        });
      } else if (behavior === 'distribute') {
        const count   = state?.count ?? 0;
        const spacing = state?.spacing ?? 0;
        const baseY   = state?.baseY ?? 0;
        if (count === 0) return;
        const positions = socketDef?.socketPositions || [];
        if (!socketDef?.accessoryFile || positions.length === 0) return;
        const grp = new THREE.Group();
        grp.userData.isSocketAccessory = true;
        grp.userData.socketName = socketName;
        container.add(grp);
        sc[socketName] = grp;
        const step = (positions.length - 1) / Math.max(count - 1, 1);
        for (let i = 0; i < count; i++) {
          const idx = Math.min(Math.round(i * step), positions.length - 1);
          const capturedPos = positions[idx];
          const offsetY = baseY + i * spacing;
          loadModel(socketDef.accessoryFile).then(orig => {
            if (token.cancelled) return;
            const acc = orig.clone(true);
            acc.position.set(capturedPos.position.x, capturedPos.position.y + offsetY, capturedPos.position.z);
            if (capturedPos.quaternion) acc.quaternion.set(capturedPos.quaternion.x, capturedPos.quaternion.y, capturedPos.quaternion.z, capturedPos.quaternion.w);
            acc.rotateY(Math.PI);
            grp.add(acc);
          });
        }
      }
    }

    function cancelSocketToken(uid, socketName) {
      const tokenKey = uid + ':' + socketName;
      const old = socketLoadTokens.get(tokenKey);
      if (old) old.cancelled = true;
    }

    function applySocket(uid, socketName, state, socketDef) {
      const container = itemGroup.children.find(x=>x.userData.uid===uid);
      if (!container) return;
      const sc = getSocketContainer(uid);
      // Cancel pending async loads and remove existing accessory
      cancelSocketToken(uid, socketName);
      if (sc[socketName]) { container.remove(sc[socketName]); delete sc[socketName]; }
      // Apply visual to this uid
      applySocketVisual(uid, container, sc, socketName, state, socketDef);

      // Propagate to whole group
      const item = itemsRef.current.find(i => i.uid === uid);
      const groupId = item?.groupId;
      const targetUids = groupId
        ? itemsRef.current.filter(i => i.groupId === groupId).map(i => i.uid)
        : [uid];
      targetUids.forEach(tuid => {
        if (tuid === uid) return;
        const tContainer = itemGroup.children.find(x => x.userData.uid === tuid);
        if (!tContainer) return;
        const tSc = getSocketContainer(tuid);
        cancelSocketToken(tuid, socketName);
        if (tSc[socketName]) { tContainer.remove(tSc[socketName]); delete tSc[socketName]; }
        applySocketVisual(tuid, tContainer, tSc, socketName, state, socketDef);
      });
      const next = itemsRef.current.map(i => {
        if (!targetUids.includes(i.uid)) return i;
        const socketStates = { ...(i.socketStates||{}), [socketName]: state };
        return { ...i, socketStates };
      });
      onChangeRef.current?.(next);
    }
    function duplicateObject(uid) {

      const item = itemsRef.current.find(i=>i.uid===uid);
      const groupUids = item?.groupId
        ? itemsRef.current.filter(i=>i.groupId===item.groupId).map(i=>i.uid)
        : [uid];
      const offset     = 1.5;
      const newGroupId = item?.groupId ? `arr_dup_${Date.now()}` : null;
      const newItems   = [];
      groupUids.forEach((gid, idx) => {
        const obj  = itemGroup.children.find(x=>x.userData.uid===gid);
        const orig = itemsRef.current.find(i=>i.uid===gid);
        if (!obj || !orig) return;
        const newUid  = `${obj.userData.modelId}_dup_${Date.now()}_${idx}`;
        const newX    = obj.position.x + offset;
        const newZ    = obj.position.z + offset;
        const newRotY = obj.rotation.y;
        const capturedColor = orig.color || null;
        const capturedUid   = newUid; // capture in closure
        const newCont = spawnContainer(obj.userData.modelId, capturedUid, newX, newZ);
        if (newCont) newCont.rotation.y = newRotY;
        // Use increasing delays so each item's timeout is unique
        setTimeout(() => {
          const c = itemGroup.children.find(x=>x.userData.uid===capturedUid);
          if (c) c.rotation.y = newRotY;
          if (capturedColor) _applyColorToContainer(capturedUid, capturedColor);
        }, 80 + idx * 60);
        newItems.push({
          uid: newUid, modelId: obj.userData.modelId, count: 1,
          x: newX, z: newZ, rotY: newRotY,
          color: orig.color || null,
          groupId: newGroupId,
          isArrayClone: newGroupId ? orig.isArrayClone : false,
          arrayParent: newGroupId && orig.isArrayClone ? newGroupId : undefined,
        });
      });
      onChangeRef.current?.([...itemsRef.current, ...newItems]);
    }

    // Array — distribute copies in +X with gap between bounding boxes
    const arrayGroups = new Map(); // sourceUid -> [cloneUids]

    function applyArray(uid, count, gap) {
      const source = itemGroup.children.find(x=>x.userData.uid===uid);
      if (!source) return;

      // Remove previous Three.js clones
      const prevClones = arrayGroups.get(uid) || [];
      prevClones.forEach(cuid => {
        const c = itemGroup.children.find(x=>x.userData.uid===cuid);
        if (c) itemGroup.remove(c);
      });
      arrayGroups.set(uid, []);

      const groupId = `arr_${uid}`;
      source.userData.groupId = groupId;

      if (count <= 1) {
        source.userData.groupId = null;
        // Remove clones from sceneItems immediately (before sync runs)
        const updated = itemsRef.current
          .filter(i => !(i.isArrayClone && i.arrayParent === uid))
          .map(i => i.uid === uid ? { ...i, count: 1, arrayGap: undefined, groupId: null } : i);
        itemsRef.current = updated; // update ref immediately to prevent sync from re-adding
        onChangeRef.current?.(updated);
        return;
      }

      // Measure object size along its local +X axis (direction of array)
      source.updateWorldMatrix(true, true);
      const rotY = source.rotation.y;
      const dir  = new THREE.Vector3(Math.cos(rotY), 0, -Math.sin(rotY)); // local +X in world
      // Project bounding box onto the array direction to get true width
      const box  = new THREE.Box3().setFromObject(source);
      const corners = [
        new THREE.Vector3(box.min.x, 0, box.min.z),
        new THREE.Vector3(box.max.x, 0, box.min.z),
        new THREE.Vector3(box.min.x, 0, box.max.z),
        new THREE.Vector3(box.max.x, 0, box.max.z),
      ];
      let minP = Infinity, maxP = -Infinity;
      corners.forEach(c => {
        const p = c.dot(dir);
        if (p < minP) minP = p;
        if (p > maxP) maxP = p;
      });
      const objW = maxP - minP;
      const step = objW + gap;

      // Create Three.js clones — mark out-of-bounds ones with red ghost material
      const OOB_MAT = new THREE.MeshStandardMaterial({
        color: 0xff3333, transparent: true, opacity: 0.35,
        depthWrite: false,
      });
      const newClones = [];
      for (let i = 1; i < count; i++) {
        const cuid = `${uid}_arr_${i}`;
        const clone = source.clone(true);
        clone.userData.uid          = cuid;
        clone.userData.modelId      = source.userData.modelId;
        clone.userData.isArrayClone = true;
        clone.userData.arrayParent  = uid;
        clone.userData.groupId      = groupId;
        const cx = source.position.x + dir.x * step * i;
        const cz = source.position.z + dir.z * step * i;
        clone.position.set(cx, source.position.y, cz);
        clone.rotation.copy(source.rotation);

        // Save original materials for OOB toggle during drag
        const origMats = [];
        clone.traverse(c => {
          if (c.isMesh && !c.userData.isMeta) origMats.push({ mesh: c, mat: c.material });
        });
        clone.userData.origMats = origMats;

        // Check OOB and apply red immediately so user sees it while editing array
        clone.updateWorldMatrix(true, true);
        const cb = new THREE.Box3().setFromObject(clone);
        const oob = cb.min.x < -floorW/2 || cb.max.x > floorW/2 ||
                    cb.min.z < -floorD/2 || cb.max.z > floorD/2;
        clone.userData.outOfBounds = oob;
        if (oob) origMats.forEach(({ mesh }) => { mesh.material = LIVE_OOB_MAT; });

        itemGroup.add(clone);
        newClones.push(cuid);
        clone.scale.set(0.01, 0.01, 0.01);
        spawnAnims.push({ container: clone, startTime: performance.now() });
      }
      arrayGroups.set(uid, newClones);

      // Update sceneItems
      const filtered   = itemsRef.current.filter(i => !(i.isArrayClone && i.arrayParent === uid));
      const withSource = filtered.map(i => i.uid === uid ? { ...i, count: 1, arrayGap: gap, groupId } : i);
      const cloneItems = newClones.map((cuid, i) => ({
        uid: cuid, modelId: source.userData.modelId, count: 1,
        x: source.position.x + dir.x * step * (i+1),
        z: source.position.z + dir.z * step * (i+1),
        rotY: source.rotation.y,
        isArrayClone: true, arrayParent: uid, groupId,
      }));
      const next = [...withSource, ...cloneItems];
      itemsRef.current = next; // update ref immediately
      onChangeRef.current?.(next);
    }

    engRef.current = {
      itemGroup, spawnContainer, pendingPositions, project3D, camera, controls,
      selectedUidRef: { current: null },
      deleteContainer, rotateObject, applyColor, duplicateObject, applyArray,
      toggleMeshVisibility, applySocket,
      syncWallItem, removeWallItem, rebuildHandles, wallMeshMap,
    };
    if (externalEngRef) externalEngRef.current = engRef.current;

    // ── Zoom from toolbar ──────────────────────────────────────
    const onZoom = e => {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      camera.position.addScaledVector(dir, e.detail*0.8);
    };
    window.addEventListener('viewport:zoom', onZoom);

    // ── Resize ────────────────────────────────────────────────
    const onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    window.addEventListener('resize', onResize);

    // ── Render loop ───────────────────────────────────────────
    let raf;
    (function animate() {
      raf = requestAnimationFrame(animate);
      controls.update();

      // Spawn animations
      const now = performance.now();
      for (let i=spawnAnims.length-1; i>=0; i--) {
        const { container, startTime } = spawnAnims[i];
        const t = Math.min((now-startTime)/ANIM_DURATION, 1);
        const s = springEase(t);
        container.scale.set(s,s,s);
        if (t>=1) { container.scale.set(1,1,1); spawnAnims.splice(i,1); }
      }

      // Lerp rotations
      rotAnims.forEach((anim, uid) => {
        const t = Math.min((now - anim.startTime) / ROT_DUR, 1);
        const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // ease in-out quad
        const c = itemGroup.children.find(x=>x.userData.uid===uid);
        if (c) {
          c.rotation.y = anim.from + (anim.to - anim.from) * ease;
          if (anim.posAnim) {
            c.position.x = anim.posAnim.fromX + (anim.posAnim.toX - anim.posAnim.fromX) * ease;
            c.position.z = anim.posAnim.fromZ + (anim.posAnim.toZ - anim.posAnim.fromZ) * ease;
          }
        }
        if (t >= 1) rotAnims.delete(uid);
      });

      // Dot bob
      if (dot.visible) dot.position.y = dotBaseY + Math.sin(now*0.003)*0.04;

      // Update radial menu position to follow selected object every frame
      if (radialMenuWrapperRef?.current && engRef.current?.selectedUidRef?.current) {
        const selObj = itemGroup.children.find(x => x.userData.uid === engRef.current.selectedUidRef.current);
        if (selObj) {
          const sp = project3D(selObj);
          radialMenuWrapperRef.current.style.left = sp.x + 'px';
          radialMenuWrapperRef.current.style.top  = sp.y + 'px';
        }
      }

      renderer.autoClear=true;
      renderer.render(bgScene, bgCam);
      renderer.autoClear=false;
      renderer.render(scene, camera);
      renderer.autoClear=true;

      // Wall/handle hover in draw mode
      if (modeRef.current === 'draw') {
        // Update raycaster from last known pointer
        raycaster.setFromCamera(pointer, camera);
        // Handle hover
        const handleHits = raycaster.intersectObjects(handleGroup.children, false);
        const newHovHandle = handleHits.length > 0 ? handleHits[0].object : null;
        if (newHovHandle !== hoveredHandle) {
          if (hoveredHandle) hoveredHandle.material.color.setHex(0xb48b31);
          hoveredHandle = newHovHandle;
          if (hoveredHandle) hoveredHandle.material.color.setHex(0xffd700);
        }
        // Wall hover highlight
        const wallHits = raycaster.intersectObjects(wallGroup.children, true)
          .filter(h => !h.object.userData.isMeta && !h.object.userData.isWallOutline);
        let newHovWall = null;
        if (wallHits.length > 0) {
          let cur = wallHits[0].object;
          while (cur && !cur.userData?.uid) cur = cur.parent;
          newHovWall = cur?.userData?.uid || null;
        }
        if (newHovWall !== hoveredWallUid) {
          if (hoveredWallUid && hoveredWallUid !== selectedWallUid) setWallHighlight(hoveredWallUid, 'none');
          hoveredWallUid = newHovWall;
          if (hoveredWallUid && hoveredWallUid !== selectedWallUid) setWallHighlight(hoveredWallUid, 'hover');
        }
        canvas.style.cursor = (newHovHandle || newHovWall) ? 'pointer' : 'crosshair';
      }
    })();

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup',   onPointerUp);
      window.removeEventListener('keydown',     onKeyDown);
      canvas.removeEventListener('dragenter',   onDragEnter);
      canvas.removeEventListener('dragover',    onDragOver);
      canvas.removeEventListener('dragleave',   onDragLeave);
      canvas.removeEventListener('drop',        onDrop);
      window.removeEventListener('viewport:zoom', onZoom);
      window.removeEventListener('resize',      onResize);
      renderer.dispose();
    };
  }, []);

  // ── Sync React items → Three.js ───────────────────────────
  useEffect(() => {
    const eng = engRef.current;
    if (!eng) return;
    if (!config._catalogFlat?.length) return;
    const { itemGroup, spawnContainer, pendingPositions, syncWallItem, removeWallItem, rebuildHandles } = eng;

    const currentUids = new Set(sceneItems.map(i=>i.uid));

    // Sync wall/column/door items
    const wallTypes = new Set(['wall','column','door']);
    sceneItems.filter(i => wallTypes.has(i.type)).forEach(item => {
      syncWallItem(item);
    });
    // Remove deleted wall items
    eng.wallMeshMap && eng.wallMeshMap.forEach((mesh, uid) => {
      if (!currentUids.has(uid)) removeWallItem(uid);
    });
    rebuildHandles();

    // Remove product containers no longer in items
    [...itemGroup.children].forEach(c => {
      if (c.userData.isArrayClone) return;
      if (!currentUids.has(c.userData.uid)) itemGroup.remove(c);
    });

    // Add new product items
    sceneItems.forEach((item, idx) => {
      if (item.isArrayClone) return;
      if (wallTypes.has(item.type)) return; // handled above
      if (itemGroup.children.find(c=>c.userData.uid===item.uid)) return;
      let x, z;
      if (pendingPositions.has(item.uid)) {
        const pos = pendingPositions.get(item.uid);
        x = pos.x; z = pos.z;
        pendingPositions.delete(item.uid);
      } else if (item.x != null && item.z != null) {
        x = item.x; z = item.z;
      } else {
        const col = idx%5, row = Math.floor(idx/5);
        x = (col-2)*3; z = -row*3;
      }
      spawnContainer(item.modelId, item.uid, x, z);
      if (item.count > 1 && item.arrayGap != null) {
        setTimeout(() => {
          if (eng.applyArray) eng.applyArray(item.uid, item.count, item.arrayGap);
        }, 300);
      }
    });
  }, [sceneItems, config._catalogFlat]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display:'block', width:'100%', height:'100%', position:'absolute', inset:0 }}
    />
  );
}
























