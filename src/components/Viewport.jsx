import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadModel, cloneModel } from '../three/glbParser.js';

// ── Viewport settings ─────────────────────────────────────────
const SETTINGS = {
  bg: { top: 0xebebeb, bottom: 0xd6d6d6 },
  fog: { color: 0xdedede, density: 0.018 },
  ambient:   0.5,
  keyLight:  0.75,
  fillLight: 0.4,
  rimLight:  0.3,
  topLight:  0.5,
  sideLight: 0.25,
  hemi:      0.3,
  floor: { roughness: 0.19, normalScale: 1.1, tiling: 2 },
  outline: { color: 0xffffff, thickness: 0.004, xrayOpacity: 0.4 },
  shadow: { mapSize: 2048, radius: 3, bias: -0.001 },
};

// ── Outline materials ─────────────────────────────────────────
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
    side:         THREE.BackSide,
    depthTest,
    depthWrite:   false,
    transparent:  opacity < 1,
    stencilWrite: depthTest,
    stencilFunc:  THREE.NotEqualStencilFunc,
    stencilRef:   1,
    stencilFail:  THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
  });
}

function makeStencilMat() {
  return new THREE.MeshBasicMaterial({
    colorWrite:   false,
    depthWrite:   false,
    stencilWrite: true,
    stencilFunc:  THREE.AlwaysStencilFunc,
    stencilRef:   1,
    stencilFail:  THREE.ReplaceStencilOp,
    stencilZFail: THREE.ReplaceStencilOp,
    stencilZPass: THREE.ReplaceStencilOp,
  });
}

export default function Viewport({ config, floorSize, sceneItems, mode, activeTool }) {
  const canvasRef  = useRef(null);
  const engineRef  = useRef(null); // holds all Three.js state

  // ── Init Three.js ─────────────────────────────────────────
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

    // Background scene
    const bgScene = new THREE.Scene();
    const bgCam   = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    bgScene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2,2),
      new THREE.ShaderMaterial({
        uniforms: {
          top:    { value: new THREE.Color(SETTINGS.bg.top) },
          bottom: { value: new THREE.Color(SETTINGS.bg.bottom) },
        },
        vertexShader:  'varying vec2 v;void main(){v=uv;gl_Position=vec4(position,1.0);}',
        fragmentShader:'uniform vec3 top,bottom;varying vec2 v;void main(){gl_FragColor=vec4(mix(bottom,top,v.y),1.0);}',
        depthWrite: false, depthTest: false,
      })
    ));

    // Main scene
    const scene  = new THREE.Scene();
    scene.fog    = new THREE.FogExp2(SETTINGS.fog.color, SETTINGS.fog.density);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(8, 6, 10);

    // Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.06;
    controls.maxPolarAngle  = Math.PI / 2 - 0.03;
    controls.minDistance    = 1;
    controls.maxDistance    = 60;
    controls.mouseButtons   = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, SETTINGS.ambient));

    const key = new THREE.DirectionalLight(0xffffff, SETTINGS.keyLight);
    key.position.set(5, 12, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(SETTINGS.shadow.mapSize, SETTINGS.shadow.mapSize);
    key.shadow.camera.left = key.shadow.camera.bottom = -20;
    key.shadow.camera.right = key.shadow.camera.top   =  20;
    key.shadow.camera.far   = 60;
    key.shadow.bias         = SETTINGS.shadow.bias;
    key.shadow.radius       = SETTINGS.shadow.radius;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xeef4ff, SETTINGS.fillLight);
    fill.position.set(-10, 6, 2); scene.add(fill);
    const rim  = new THREE.DirectionalLight(0xffffff,  SETTINGS.rimLight);
    rim.position.set(0, 8, -12);  scene.add(rim);
    const top  = new THREE.DirectionalLight(0xfff8f0,  SETTINGS.topLight);
    top.position.set(0, 15, 0);   scene.add(top);
    const side = new THREE.DirectionalLight(0xfff5e0,  SETTINGS.sideLight);
    side.position.set(12, 5, 0);  scene.add(side);
    scene.add(new THREE.HemisphereLight(0xfff8f0, 0xd0d0d0, SETTINGS.hemi));

    // Floor
    const texLoader  = new THREE.TextureLoader();
    const floorW     = floorSize?.w || 6;
    const floorD     = floorSize?.d || 6;
    const floorGeo   = new THREE.PlaneGeometry(floorW, floorD);
    const floorMat   = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.8 });

    // Load floor textures if available
    const baseUrl = `${import.meta.env.BASE_URL}textures/floor_basecolor.png`;
    const normUrl = `${import.meta.env.BASE_URL}textures/floor_normal.png`;
    texLoader.load(baseUrl, t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(SETTINGS.floor.tiling, SETTINGS.floor.tiling);
      //t.rotation = 0.15;
      t.center.set(0.5, 0.5);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      floorMat.map = t;
      floorMat.needsUpdate = true;
    });
    texLoader.load(normUrl, t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(SETTINGS.floor.tiling, SETTINGS.floor.tiling);
      floorMat.normalMap   = t;
      floorMat.normalScale = new THREE.Vector2(SETTINGS.floor.normalScale, SETTINGS.floor.normalScale);
      floorMat.needsUpdate = true;
    });
    const roughUrl = `${import.meta.env.BASE_URL}textures/floor_roughness.png`;
    texLoader.load(roughUrl, t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(3.5, 3.5);   // different tiling than base/normal
      t.rotation = 0.3;          // slight rotation breaks pattern
      t.center.set(0.5, 0.5);   // rotate around center
      floorMat.roughnessMap = t;
      floorMat.roughness    = 0.5; // base roughness, map modulates it
      floorMat.needsUpdate  = true;
    });

    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x    = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor border
    const borderGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(floorW, 0.01, floorD));
    const borderMat = new THREE.LineBasicMaterial({ color: 0xaaaaaa, opacity: 0.5, transparent: true });
    scene.add(new THREE.LineSegments(borderGeo, borderMat));

    // Grid
    const grid = new THREE.GridHelper(Math.max(floorW, floorD) * 3, 40, 0xbbbbbb, 0xbbbbbb);
    grid.material.opacity    = 0.1;
    grid.material.transparent = true;
    grid.position.y = 0.002;
    scene.add(grid);

    // Selection dot
    const dotMat  = new THREE.MeshBasicMaterial({ color: SETTINGS.outline.color, depthTest: false });
    const dot     = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), dotMat);
    dot.renderOrder = 10;
    dot.visible     = false;
    scene.add(dot);

    // Model objects map
    const modelObjects = new Map(); // modelId -> THREE.Object3D

    // Outline helpers
    function addOutline(obj) {
      const toProcess = [];
      obj.traverse(child => {
        if (child.isMesh && !child.userData.isOutline && !child.userData.isXray && !child.userData.isStencil) {
          toProcess.push(child);
        }
      });
      toProcess.forEach(child => {
        const sm = new THREE.Mesh(child.geometry, makeStencilMat());
        sm.renderOrder = 1;
        sm.userData.isStencil = true;
        child.add(sm);

        const solid = new THREE.Mesh(child.geometry, makeOutlineMat(SETTINGS.outline.color, SETTINGS.outline.thickness, true));
        solid.renderOrder = 2;
        solid.visible = false;
        solid.userData.isOutline = true;
        child.add(solid);

        const xray = new THREE.Mesh(child.geometry, makeOutlineMat(SETTINGS.outline.color, SETTINGS.outline.thickness, false, SETTINGS.outline.xrayOpacity));
        xray.renderOrder = 3;
        xray.visible = false;
        xray.userData.isXray = true;
        child.add(xray);
      });
    }

    function setOutlineVisible(obj, visible) {
      obj.traverse(child => {
        if (child.userData.isOutline || child.userData.isXray) child.visible = visible;
      });
    }

    // Hover / selection state
    let hoveredId  = null;
    let selectedId = null;
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();
    const selectables = [];

    function updateDot(obj) {
      if (!obj) { dot.visible = false; return; }
      obj.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(obj);
      const center = new THREE.Vector3();
      box.getCenter(center);
      dotBaseY = box.max.y + 0.22;
      dot.position.set(center.x, dotBaseY, center.z);
      dot.visible = true;
    }

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(selectables, true);
      const hitId = hits.length > 0 ? hits[0].object.userData.modelId : null;

      if (hitId !== hoveredId) {
        if (hoveredId && hoveredId !== selectedId) {
          const prev = modelObjects.get(hoveredId);
          if (prev) setOutlineVisible(prev, false);
          dot.visible = false;
        }
        hoveredId = hitId;
        if (hoveredId) {
          const obj = modelObjects.get(hoveredId);
          if (obj) { setOutlineVisible(obj, true); updateDot(obj); }
          canvas.style.cursor = 'pointer';
        } else {
          canvas.style.cursor = 'default';
        }
      }
    });

    canvas.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(selectables, true);
      const hitId = hits.length > 0 ? hits[0].object.userData.modelId : null;
      if (selectedId && selectedId !== hitId) {
        const prev = modelObjects.get(selectedId);
        if (prev) setOutlineVisible(prev, false);
      }
      selectedId = hitId;
    });

    // Zoom events from sidebar
    const handleZoom = e => {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      camera.position.addScaledVector(dir, e.detail * 0.8);
    };
    window.addEventListener('viewport:zoom', handleZoom);

    // Resize
    const handleResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', handleResize);
    const ro = new ResizeObserver(handleResize);
    ro.observe(canvas);

    // Dot bob
    let dotBaseY = 0;

    // Render loop
    let animId;
    (function animate() {
      animId = requestAnimationFrame(animate);
      controls.update();

      // Dot bob
      if (dot.visible) {
        dot.position.y = dotBaseY + Math.sin(performance.now() * 0.003) * 0.04;
      }

      renderer.autoClear = true;
      renderer.render(bgScene, bgCam);
      renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = true;
    })();

    engineRef.current = { scene, camera, renderer, controls, modelObjects, selectables, dot, updateDot, setOutlineVisible, addOutline };

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('viewport:zoom', handleZoom);
      renderer.dispose();
    };
  }, []);

  // ── Sync sceneItems -> 3D objects ─────────────────────────
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const { scene, modelObjects, selectables, addOutline } = eng;
    const currentIds = new Set(sceneItems.map(i => i.modelId));

    // Remove objects no longer in scene
    modelObjects.forEach((obj, id) => {
      if (!currentIds.has(id)) {
        scene.remove(obj);
        modelObjects.delete(id);
        const idx = selectables.indexOf(obj);
        if (idx > -1) selectables.splice(idx, 1);
      }
    });

    // Add new objects
    sceneItems.forEach(item => {
      if (modelObjects.has(item.modelId)) return;

      // Find manifest entry
      const manifestItem = config._catalogFlat?.find(m => m.id === item.modelId);
      if (manifestItem?.file) {
        // Load real GLB
        loadModel(manifestItem.file).then(original => {
          const obj = original.clone(true);
          obj.userData.modelId = item.modelId;
          // Tag all meshes for raycasting
          obj.traverse(child => {
            if (child.isMesh) {
              child.userData.modelId = item.modelId;
              child.castShadow = child.receiveShadow = true;
            }
          });
          // Spread objects in a grid
          const idx = sceneItems.findIndex(i => i.modelId === item.modelId);
          const col = idx % 5, row = Math.floor(idx / 5);
          obj.position.set((col - 2) * 3, 0, -row * 3);
          addOutline(obj);
          scene.add(obj);
          modelObjects.set(item.modelId, obj);
          selectables.push(obj);
        });
      } else {
        // Placeholder box
        const w = manifestItem?.w || 1, h = manifestItem?.h || 1, d = manifestItem?.d || 0.2;
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.5 });
        const obj = new THREE.Mesh(geo, mat);
        obj.userData.modelId = item.modelId;
        obj.castShadow = obj.receiveShadow = true;
        const idx = sceneItems.findIndex(i => i.modelId === item.modelId);
        const col = idx % 5, row = Math.floor(idx / 5);
        obj.position.set((col - 2) * (w + 0.5), h / 2, -row * (d + 0.5));
        addOutline(obj);
        scene.add(obj);
        modelObjects.set(item.modelId, obj);
        selectables.push(obj);
      }
    });
  }, [sceneItems]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', position: 'absolute', inset: 0 }}
    />
  );
}
