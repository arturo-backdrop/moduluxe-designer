import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadModel } from '../three/glbParser.js';

// ── Settings ──────────────────────────────────────────────────
const SETTINGS = {
  bg: { top: 0xebebeb, bottom: 0xd6d6d6 },
  fog: { color: 0xdedede, density: 0.018 },
  ambient: 0.5, keyLight: 0.75, fillLight: 0.4,
  rimLight: 0.3, topLight: 0.5, sideLight: 0.25, hemi: 0.3,
  floor: { roughness: 0.19, normalScale: 1.1, tiling: 2, tilingRoughness: 3.5 },
  outline: { color: 0xffffff, thickness: 0.004, xrayOpacity: 0.4 },
  shadow: { mapSize: 2048, radius: 3, bias: -0.001 },
  DRAG_THRESHOLD: 5,
  GRID_SNAP: 0.25,  // snap increment in meters
};

// ── Outline helpers ───────────────────────────────────────────
function makeOutlineMat(color, thickness, depthTest, opacity = 1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      outlineColor:     { value: new THREE.Color(color) },
      outlineThickness: { value: thickness },
    },
    vertexShader: `
      uniform float outlineThickness;
      void main() {
        vec3 vN = normalize(normalMatrix * normal);
        vec4 vP = modelViewMatrix * vec4(position, 1.0);
        vP.xy += vN.xy * outlineThickness;
        gl_Position = projectionMatrix * vP;
      }
    `,
    fragmentShader: `
      uniform vec3 outlineColor;
      void main() { gl_FragColor = vec4(outlineColor, ${opacity.toFixed(2)}); }
    `,
    side: THREE.BackSide, depthTest, depthWrite: false,
    transparent: opacity < 1,
    stencilWrite: depthTest,
    stencilFunc:  THREE.NotEqualStencilFunc, stencilRef: 1,
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

function addOutline(obj) {
  const toProcess = [];
  obj.traverse(child => {
    if (child.isMesh && !child.userData.isOutline && !child.userData.isXray && !child.userData.isStencil)
      toProcess.push(child);
  });
  toProcess.forEach(child => {
    const sm = new THREE.Mesh(child.geometry, makeStencilMat());
    sm.renderOrder = 1; sm.userData.isStencil = true; child.add(sm);
    const solid = new THREE.Mesh(child.geometry, makeOutlineMat(SETTINGS.outline.color, SETTINGS.outline.thickness, true));
    solid.renderOrder = 2; solid.visible = false; solid.userData.isOutline = true; child.add(solid);
    const xray = new THREE.Mesh(child.geometry, makeOutlineMat(SETTINGS.outline.color, SETTINGS.outline.thickness, false, SETTINGS.outline.xrayOpacity));
    xray.renderOrder = 3; xray.visible = false; xray.userData.isXray = true; child.add(xray);
  });
}

function setOutlineVisible(obj, v) {
  obj.traverse(c => { if (c.userData.isOutline || c.userData.isXray) c.visible = v; });
}

export default function Viewport({ config, floorSize, sceneItems, onSceneItemsChange, mode, activeTool }) {
  const canvasRef = useRef(null);
  const engRef    = useRef(null);

  // Keep latest sceneItems accessible in event handlers without re-binding
  const sceneItemsRef    = useRef(sceneItems);
  const onChangeRef      = useRef(onSceneItemsChange);
  const catalogFlatRef   = useRef(config._catalogFlat || []);
  useEffect(() => { sceneItemsRef.current    = sceneItems; }, [sceneItems]);
  useEffect(() => { onChangeRef.current      = onSceneItemsChange; }, [onSceneItemsChange]);
  useEffect(() => { catalogFlatRef.current   = config._catalogFlat || []; }, [config._catalogFlat]);

  // ── Init ──────────────────────────────────────────────────
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

    // Background
    const bgScene = new THREE.Scene();
    const bgCam   = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), new THREE.ShaderMaterial({
      uniforms: { top:{ value:new THREE.Color(SETTINGS.bg.top) }, bottom:{ value:new THREE.Color(SETTINGS.bg.bottom) } },
      vertexShader:  'varying vec2 v;void main(){v=uv;gl_Position=vec4(position,1.0);}',
      fragmentShader:'uniform vec3 top,bottom;varying vec2 v;void main(){gl_FragColor=vec4(mix(bottom,top,v.y),1.0);}',
      depthWrite:false, depthTest:false,
    })));

    // Scene
    const scene = new THREE.Scene();
    scene.fog   = new THREE.FogExp2(SETTINGS.fog.color, SETTINGS.fog.density);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 200);
    camera.position.set(8, 6, 10);

    // Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI/2 - 0.03;
    controls.minDistance = 1; controls.maxDistance = 60;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, SETTINGS.ambient));
    const key = new THREE.DirectionalLight(0xffffff, SETTINGS.keyLight);
    key.position.set(5,12,8); key.castShadow = true;
    key.shadow.mapSize.set(SETTINGS.shadow.mapSize, SETTINGS.shadow.mapSize);
    key.shadow.camera.left = key.shadow.camera.bottom = -20;
    key.shadow.camera.right = key.shadow.camera.top = 20;
    key.shadow.camera.far = 60; key.shadow.bias = SETTINGS.shadow.bias; key.shadow.radius = SETTINGS.shadow.radius;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xeef4ff, SETTINGS.fillLight); fill.position.set(-10,6,2); scene.add(fill);
    const rim  = new THREE.DirectionalLight(0xffffff,  SETTINGS.rimLight);  rim.position.set(0,8,-12);  scene.add(rim);
    const top  = new THREE.DirectionalLight(0xfff8f0,  SETTINGS.topLight);  top.position.set(0,15,0);   scene.add(top);
    const side = new THREE.DirectionalLight(0xfff5e0,  SETTINGS.sideLight); side.position.set(12,5,0);  scene.add(side);
    scene.add(new THREE.HemisphereLight(0xfff8f0, 0xd0d0d0, SETTINGS.hemi));

    // Floor
    const texLoader = new THREE.TextureLoader();
    const floorW = floorSize?.w || 6, floorD = floorSize?.d || 6;
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.8 });
    const base = import.meta.env.BASE_URL;
    texLoader.load(`${base}textures/floor_basecolor.png`, t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(SETTINGS.floor.tiling, SETTINGS.floor.tiling);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      floorMat.map = t; floorMat.needsUpdate = true;
    });
    texLoader.load(`${base}textures/floor_normal.png`, t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(SETTINGS.floor.tiling, SETTINGS.floor.tiling);
      floorMat.normalMap = t; floorMat.normalScale = new THREE.Vector2(SETTINGS.floor.normalScale, SETTINGS.floor.normalScale);
      floorMat.needsUpdate = true;
    });
    texLoader.load(`${base}textures/floor_roughness.png`, t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(SETTINGS.floor.tilingRoughness, SETTINGS.floor.tilingRoughness);
      t.rotation = 0.3; t.center.set(0.5, 0.5);
      floorMat.roughnessMap = t; floorMat.roughness = 0.5; floorMat.needsUpdate = true;
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(floorW, floorD), floorMat);
    floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);

    // Floor border
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(floorW, 0.01, floorD)),
      new THREE.LineBasicMaterial({ color: 0xaaaaaa, opacity: 0.5, transparent: true })
    );
    scene.add(border);

    // Grid
    const grid = new THREE.GridHelper(Math.max(floorW,floorD)*3, 40, 0xbbbbbb, 0xbbbbbb);
    grid.material.opacity = 0.1; grid.material.transparent = true; grid.position.y = 0.002;
    scene.add(grid);

    // Hover dot
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 16),
      new THREE.MeshBasicMaterial({ color: SETTINGS.outline.color, depthTest: false })
    );
    dot.renderOrder = 10; dot.visible = false; scene.add(dot);
    let dotBaseY = 0;

    function updateDot(obj) {
      if (!obj) { dot.visible = false; return; }
      obj.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(obj);
      const center = new THREE.Vector3(); box.getCenter(center);
      dotBaseY = box.max.y + 0.22;
      dot.position.set(center.x, dotBaseY, center.z);
      dot.visible = true;
    }

    // Item group — all placed objects live here
    const itemGroup = new THREE.Group();
    scene.add(itemGroup);

    // State
    const modelObjects = new Map(); // uid -> Object3D
    const planeY0      = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
    const raycaster    = new THREE.Raycaster();
    const pointer      = new THREE.Vector2();
    let hoveredId      = null;
    let selectedId     = null;
    let draggingId     = null;
    let dragArmed      = false;
    let dragStartX     = 0, dragStartY = 0;
    let dragOffsetX    = 0, dragOffsetZ = 0;
    let isOrbiting     = false; // track orbit state to suppress hover

    // Grid snap
    function snap(v) {
      return Math.round(v / SETTINGS.GRID_SNAP) * SETTINGS.GRID_SNAP;
    }

    // Clamp to floor bounds (accounting for object half-size)
    function clampToFloor(x, z, hw, hd) {
      const halfW = floorW / 2, halfD = floorD / 2;
      return {
        x: Math.max(-halfW + hw, Math.min(halfW - hw, x)),
        z: Math.max(-halfD + hd, Math.min(halfD - hd, z)),
      };
    }

    // Ground projection
    function groundPoint(cx, cy) {
      const rect = canvas.getBoundingClientRect();
      pointer.x =  ((cx - rect.left) / rect.width)  * 2 - 1;
      pointer.y = -((cy - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const pt = new THREE.Vector3();
      raycaster.ray.intersectPlane(planeY0, pt);
      return pt;
    }

    // Get top-level item object from any child mesh
    function getItemObj(mesh) {
      let obj = mesh;
      while (obj.parent && obj.parent !== itemGroup) obj = obj.parent;
      return obj.parent === itemGroup ? obj : null;
    }

    // ── Pointer down ─────────────────────────────────────────
    const onPointerDown = (e) => {
      if (e.button !== 0) return;
      isOrbiting = false;
      const rect = canvas.getBoundingClientRect();
      pointer.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(itemGroup.children, true)
        .filter(h => !h.object.userData.isOutline && !h.object.userData.isXray && !h.object.userData.isStencil);

      if (!hits.length) return;
      const topObj = getItemObj(hits[0].object);
      if (!topObj) return;

      draggingId  = topObj.userData.uid;
      dragArmed   = false;
      dragStartX  = e.clientX;
      dragStartY  = e.clientY;
      const pt    = groundPoint(e.clientX, e.clientY);
      dragOffsetX = topObj.position.x - pt.x;
      dragOffsetZ = topObj.position.z - pt.z;
      controls.enabled = false;
    };

    // ── Pointer move ─────────────────────────────────────────
    const onPointerMove = (e) => {
      // Detect orbit — if mouse moved while no dragging item, it's orbiting
      if (!draggingId && e.buttons === 1) {
        isOrbiting = true;
      }
      if (!draggingId && e.buttons === 0) {
        isOrbiting = false;
      }

      // Hover — only when not orbiting
      if (!draggingId && !isOrbiting) {
        const rect = canvas.getBoundingClientRect();
        pointer.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(itemGroup.children, true)
          .filter(h => !h.object.userData.isOutline && !h.object.userData.isXray && !h.object.userData.isStencil);
        const hitObj = hits.length ? getItemObj(hits[0].object) : null;
        const hitId  = hitObj?.userData.uid || null;

        if (hitId !== hoveredId) {
          if (hoveredId && hoveredId !== selectedId) {
            const prev = modelObjects.get(hoveredId);
            if (prev) { setOutlineVisible(prev, false); dot.visible = false; }
          }
          hoveredId = hitId;
          if (hoveredId) {
            const obj = modelObjects.get(hoveredId);
            if (obj) { setOutlineVisible(obj, true); updateDot(obj); }
            canvas.style.cursor = 'grab';
          } else {
            canvas.style.cursor = 'default';
          }
        }
        return;
      }

      if (!draggingId) return;

      // Drag threshold
      if (!dragArmed) {
        if (Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) < SETTINGS.DRAG_THRESHOLD) return;
        dragArmed = true;
        canvas.style.cursor = 'grabbing';
      }

      // Move object with snap + floor clamp
      const obj = modelObjects.get(draggingId);
      if (!obj) return;
      const pt  = groundPoint(e.clientX, e.clientY);
      const box = new THREE.Box3().setFromObject(obj);
      const hw  = (box.max.x - box.min.x) / 2;
      const hd  = (box.max.z - box.min.z) / 2;
      const rawX = pt.x + dragOffsetX;
      const rawZ = pt.z + dragOffsetZ;
      const snapped = clampToFloor(snap(rawX), snap(rawZ), hw, hd);
      obj.position.x = snapped.x;
      obj.position.z = snapped.z;
      updateDot(obj);
    };

    // ── Pointer up ───────────────────────────────────────────
    const onPointerUp = (e) => {
      controls.enabled = true;
      if (!draggingId) return;

      if (!dragArmed) {
        // Click — select / deselect
        if (selectedId && selectedId !== draggingId) {
          const prev = modelObjects.get(selectedId);
          if (prev) setOutlineVisible(prev, selectedId === hoveredId);
        }
        selectedId = selectedId === draggingId ? null : draggingId;
        if (selectedId) {
          const obj = modelObjects.get(selectedId);
          if (obj) setOutlineVisible(obj, true);
        }
      } else {
        canvas.style.cursor = hoveredId ? 'grab' : 'default';
      }

      draggingId = null;
      dragArmed  = false;
    };

    // ── Delete key ───────────────────────────────────────────
    const onKeyDown = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (!selectedId) return;
      const obj = modelObjects.get(selectedId);
      if (obj) { itemGroup.remove(obj); modelObjects.delete(selectedId); }
      const next = sceneItemsRef.current.filter(i => i.uid !== selectedId);
      onChangeRef.current?.(next);
      selectedId = null;
      dot.visible = false;
    };

    // ── Drop from sidebar ─────────────────────────────────────
    const onDragOver = (e) => e.preventDefault();
    const onDrop = (e) => {
      e.preventDefault();
      const modelId = e.dataTransfer?.getData('modelId');
      if (!modelId) return;
      const pt = groundPoint(e.clientX, e.clientY);
      const uid = `${modelId}_${Date.now()}`;
      addObjectToScene(modelId, uid, snap(pt.x), snap(pt.z));
      // Update React state
      const prev = sceneItemsRef.current;
      const existing = prev.find(i => i.modelId === modelId);
      const next = existing
        ? prev.map(i => i.modelId === modelId ? { ...i, count: i.count + 1 } : i)
        : [...prev, { uid, modelId, count: 1 }];
      onChangeRef.current?.(next);
    };

    canvas.addEventListener('pointerdown',  onPointerDown);
    window.addEventListener('pointermove',  onPointerMove);
    window.addEventListener('pointerup',    onPointerUp);
    window.addEventListener('keydown',      onKeyDown);
    canvas.addEventListener('dragover',     onDragOver);
    canvas.addEventListener('drop',         onDrop);

    // ── Add object to scene ───────────────────────────────────
    function addObjectToScene(modelId, uid, x = 0, z = 0) {
      const manifestItem = catalogFlatRef.current.find(m => m.id === modelId);
      const w = manifestItem?.w || 1, h = manifestItem?.h || 1, d = manifestItem?.d || 0.2;

      const createObj = (obj) => {
        obj.userData.uid     = uid;
        obj.userData.modelId = modelId;
        obj.traverse(child => {
          if (child.isMesh && !child.userData.isOutline && !child.userData.isXray && !child.userData.isStencil) {
            child.userData.uid     = uid;
            child.userData.modelId = modelId;
            child.castShadow = child.receiveShadow = true;
          }
        });
        // Clamp initial position to floor
        const clamped = clampToFloor(x, z, w/2, d/2);
        obj.position.set(clamped.x, h / 2, clamped.z);
        addOutline(obj);
        itemGroup.add(obj);
        modelObjects.set(uid, obj);
      };

      if (manifestItem?.file) {
        loadModel(manifestItem.file).then(original => createObj(original.clone(true)));
      } else {
        createObj(new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.5 })
        ));
      }
    }

    // ── Zoom from sidebar ─────────────────────────────────────
    const handleZoom = e => {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      camera.position.addScaledVector(dir, e.detail * 0.8);
    };
    window.addEventListener('viewport:zoom', handleZoom);

    // ── Resize ────────────────────────────────────────────────
    const handleResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', handleResize);
    const ro = new ResizeObserver(handleResize);
    ro.observe(canvas);

    // ── Render loop ───────────────────────────────────────────
    let animId;
    (function animate() {
      animId = requestAnimationFrame(animate);
      controls.update();
      if (dot.visible) dot.position.y = dotBaseY + Math.sin(performance.now() * 0.003) * 0.04;
      renderer.autoClear = true;
      renderer.render(bgScene, bgCam);
      renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = true;
    })();

    engRef.current = { scene, itemGroup, modelObjects, addObjectToScene };

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup',   onPointerUp);
      window.removeEventListener('keydown',     onKeyDown);
      canvas.removeEventListener('dragover',    onDragOver);
      canvas.removeEventListener('drop',        onDrop);
      window.removeEventListener('viewport:zoom', handleZoom);
      window.removeEventListener('resize',      handleResize);
      renderer.dispose();
    };
  }, []);

  // ── Sync sceneItems → 3D ────────────────────────────────
  useEffect(() => {
    const eng = engRef.current;
    if (!eng) return;
    const { modelObjects, addObjectToScene, itemGroup } = eng;
    const currentUids = new Set(sceneItems.map(i => i.uid));

    // Remove objects no longer in scene
    modelObjects.forEach((obj, uid) => {
      if (!currentUids.has(uid)) {
        itemGroup.remove(obj);
        modelObjects.delete(uid);
      }
    });

    // Add new objects
    sceneItems.forEach((item, idx) => {
      if (modelObjects.has(item.uid)) return;
      const col = idx % 5, row = Math.floor(idx / 5);
      addObjectToScene(item.modelId, item.uid, (col - 2) * 3, -row * 3);
    });
  }, [sceneItems]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', position: 'absolute', inset: 0 }}
    />
  );
}
