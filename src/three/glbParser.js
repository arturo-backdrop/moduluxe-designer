import * as THREE from 'three';

// ── Mini GLB parser (sin GLTFLoader) ─────────────────────────
// Extraído de Booth Planner. Soporta: geometría POSITION/NORMAL/
// TEXCOORD_0/indices, jerarquía de nodos, materiales PBR + texturas embebidas.

const COMPONENT_TYPES = {
  5120: { array: Int8Array,    size: 1 },
  5121: { array: Uint8Array,   size: 1 },
  5122: { array: Int16Array,   size: 2 },
  5123: { array: Uint16Array,  size: 2 },
  5125: { array: Uint32Array,  size: 4 },
  5126: { array: Float32Array, size: 4 },
};
const TYPE_SIZES = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT2:4, MAT3:9, MAT4:16 };

function parseGLB(arrayBuffer) {
  const dv = new DataView(arrayBuffer);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Not a valid .glb');
  const length = dv.getUint32(8, true);
  let offset = 12, json = null, bin = null;
  while (offset < length) {
    const chunkLength = dv.getUint32(offset, true);
    const chunkType   = dv.getUint32(offset + 4, true);
    const chunkStart  = offset + 8;
    if (chunkType === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(arrayBuffer, chunkStart, chunkLength)));
    if (chunkType === 0x004e4942) bin = arrayBuffer.slice(chunkStart, chunkStart + chunkLength);
    offset = chunkStart + chunkLength;
  }
  return { json, bin };
}

function readAccessor(json, bin, idx) {
  const acc = json.accessors[idx];
  const bv  = json.bufferViews[acc.bufferView];
  const { array: ArrType, size: compSize } = COMPONENT_TYPES[acc.componentType];
  const numComponents = TYPE_SIZES[acc.type];
  const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const out    = new Float32Array(acc.count * numComponents);
  const stride = bv.byteStride || numComponents * compSize;
  const dv2    = new DataView(bin, byteOffset);
  for (let i = 0; i < acc.count; i++) {
    const base = i * stride;
    for (let c = 0; c < numComponents; c++) {
      const bi = base + c * compSize;
      let val;
      if      (ArrType === Float32Array) val = dv2.getFloat32(bi, true);
      else if (ArrType === Uint16Array)  val = dv2.getUint16(bi, true);
      else if (ArrType === Uint32Array)  val = dv2.getUint32(bi, true);
      else if (ArrType === Int16Array)   val = dv2.getInt16(bi, true);
      else if (ArrType === Uint8Array)   val = dv2.getUint8(bi, true);
      else                               val = dv2.getInt8(bi, true);
      out[i * numComponents + c] = val;
    }
  }
  return { array: out, itemSize: numComponents };
}

async function buildTexture(json, bin, texIndex) {
  try {
    const tex   = json.textures[texIndex];
    const image = json.images[tex.source];
    if (image.bufferView == null) return null;
    const bv   = json.bufferViews[image.bufferView];
    const blob = new Blob([new Uint8Array(bin, bv.byteOffset || 0, bv.byteLength)], { type: image.mimeType || 'image/png' });
    const bmp  = await createImageBitmap(blob);
    const t    = new THREE.Texture(bmp);
    t.needsUpdate = true;
    t.colorSpace  = THREE.SRGBColorSpace;
    return t;
  } catch(e) { console.warn('Texture decode failed:', e); return null; }
}

// Global material cache — shared across all GLBs for texture-free materials
// paint_color materials are excluded so each instance can be colored independently
const globalMatCache = new Map();

function makeGlobalMatKey(m, pbr, bc) {
  const r = (pbr.roughnessFactor ?? 0.6).toFixed(3);
  const me = (pbr.metallicFactor ?? 0.1).toFixed(3);
  const c = bc.map(v => v.toFixed(4)).join(',');
  const ds = m.doubleSided ? '1' : '0';
  return `${m.name||''}|${c}|${r}|${me}|${ds}`;
}

async function buildMaterial(json, bin, matIndex, matCache) {
  if (matIndex == null || !json.materials) return new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.5, metalness: 0.1 });
  if (matCache.has(matIndex)) return matCache.get(matIndex);
  const m   = json.materials[matIndex] || {};
  const pbr = m.pbrMetallicRoughness || {};
  const bc  = pbr.baseColorFactor || [1,1,1,1];
  const hasTexture = !!pbr.baseColorTexture;
  const isPaintColor = m.name === 'paint_color';

  // Reuse global cache for texture-free, non-paint materials
  if (!hasTexture && !isPaintColor) {
    const key = makeGlobalMatKey(m, pbr, bc);
    if (globalMatCache.has(key)) {
      const cached = globalMatCache.get(key);
      matCache.set(matIndex, cached);
      return cached;
    }
    const mat = new THREE.MeshStandardMaterial({
      color:       new THREE.Color(bc[0], bc[1], bc[2]),
      roughness:   pbr.roughnessFactor ?? 0.6,
      metalness:   pbr.metallicFactor  ?? 0.1,
      transparent: bc[3] < 1,
      opacity:     bc[3] ?? 1,
    });
    if (m.name) mat.name = m.name;
    if (m.doubleSided) mat.side = THREE.DoubleSide;
    globalMatCache.set(key, mat);
    matCache.set(matIndex, mat);
    return mat;
  }

  // Textured or paint_color — always create new (per-GLB cache only)
  const mat = new THREE.MeshStandardMaterial({
    color:       new THREE.Color(bc[0], bc[1], bc[2]),
    roughness:   pbr.roughnessFactor ?? 0.6,
    metalness:   pbr.metallicFactor  ?? 0.1,
    transparent: bc[3] < 1,
    opacity:     bc[3] ?? 1,
  });
  if (m.name) mat.name = m.name;
  if (m.doubleSided) mat.side = THREE.DoubleSide;
  if (hasTexture) {
    const tex = await buildTexture(json, bin, pbr.baseColorTexture.index);
    if (tex) mat.map = tex;
  }
  matCache.set(matIndex, mat);
  return mat;
}

async function buildMesh(json, bin, meshIndex, matCache) {
  const meshDef = json.meshes[meshIndex];
  const group   = new THREE.Group();
  for (const prim of meshDef.primitives) {
    const geo = new THREE.BufferGeometry();
    const pos = readAccessor(json, bin, prim.attributes.POSITION);
    geo.setAttribute('position', new THREE.BufferAttribute(pos.array, pos.itemSize));
    if (prim.attributes.NORMAL != null) {
      const n = readAccessor(json, bin, prim.attributes.NORMAL);
      geo.setAttribute('normal', new THREE.BufferAttribute(n.array, n.itemSize));
    } else {
      geo.computeVertexNormals();
    }
    if (prim.attributes.TEXCOORD_0 != null) {
      const uv = readAccessor(json, bin, prim.attributes.TEXCOORD_0);
      geo.setAttribute('uv', new THREE.BufferAttribute(uv.array, uv.itemSize));
    }
    if (prim.indices != null) {
      const idx = readAccessor(json, bin, prim.indices);
      geo.setIndex(Array.from(idx.array));
    }
    const mat  = await buildMaterial(json, bin, prim.material, matCache);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

async function buildNode(json, bin, nodeIdx, matCache) {
  const nd  = json.nodes[nodeIdx];
  const obj = new THREE.Object3D();
  if (nd.name) obj.name = nd.name;
  if (nd.matrix) {
    obj.matrix.fromArray(nd.matrix);
    obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
  } else {
    if (nd.translation) obj.position.set(...nd.translation);
    if (nd.rotation)    obj.quaternion.set(...nd.rotation);
    if (nd.scale)       obj.scale.set(...nd.scale);
  }
  if (nd.mesh != null) obj.add(await buildMesh(json, bin, nd.mesh, matCache));
  if (nd.children) {
    for (const ci of nd.children) obj.add(await buildNode(json, bin, ci, matCache));
  }
  return obj;
}

async function buildScene(json, bin) {
  const matCache = new Map();
  const sceneDef = json.scenes[json.scene || 0];
  const root     = new THREE.Group();
  for (const ni of sceneDef.nodes) root.add(await buildNode(json, bin, ni, matCache));

  // Auto-detect toggle_ meshes — hide by default, expose as sockets
  // Pattern: toggle_[group]_[variant] e.g. toggle_feet_center, toggle_feet_edge
  // A real group = multiple meshes sharing the same parts[0] prefix
  const toggleMeshes = [];
  // First pass: collect all toggle meshes and count group members
  const toggleGroups = {}; // groupName -> [meshName, ...]
  root.traverse(obj => {
    if (!obj.name) return;
    const base = obj.name.replace(/\.\d+$/, '');
    if (!base.toLowerCase().startsWith('toggle_')) return;
    const parts = base.slice(7).split('_');
    if (parts.length >= 2) {
      const group = parts[0];
      if (!toggleGroups[group]) toggleGroups[group] = [];
      toggleGroups[group].push(obj.name);
    }
  });
  // Second pass: set visibility and build toggleMeshes list
  root.traverse(obj => {
    if (!obj.name) return;
    const base = obj.name.replace(/\.\d+$/, '');
    if (!base.toLowerCase().startsWith('toggle_')) return;
    obj.userData.isToggleMesh = true;
    const parts = base.slice(7).split('_');
    // Only a real group if multiple meshes share the same prefix
    const isRealGroup = parts.length >= 2 && (toggleGroups[parts[0]] || []).length > 1;
    if (isRealGroup) {
      const group = parts[0];
      const variants = toggleGroups[group] || [];
      const isDefault = variants[0] === obj.name;
      obj.visible = isDefault;
      const label = base.slice(7).replace(/_/g, ' ');
      toggleMeshes.push({ name: obj.name, label, group, variant: parts.slice(1).join('_'), isDefault });
    } else {
      // Simple toggle_ — hidden by default
      obj.visible = false;
      const label = base.slice(7).replace(/_/g, ' ');
      toggleMeshes.push({ name: obj.name, label, group: null, variant: null, isDefault: false });
    }
  });
  root.userData.toggleMeshes = toggleMeshes;
  root.userData.toggleGroups = toggleGroups;

  // Auto-detect socket_ Empties (Object3D with no mesh descendants)
  const socketMap = {};
  // Build socket map directly from GLB JSON — getWorldQuaternion unreliable before scene attach
  function multiplyQuat(a, b) {
    return {
      x: a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
      y: a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
      z: a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
      w: a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z,
    };
  }
  function getNodeWorldTransform(json, nodeIdx, parentPos, parentQuat) {
    const nd = json.nodes[nodeIdx];
    const lPos = nd.translation ? { x: nd.translation[0], y: nd.translation[1], z: nd.translation[2] } : { x:0,y:0,z:0 };
    const lQuat = nd.rotation ? { x: nd.rotation[0], y: nd.rotation[1], z: nd.rotation[2], w: nd.rotation[3] } : { x:0,y:0,z:0,w:1 };
    // Rotate parent quat by local quat
    const wQuat = multiplyQuat(parentQuat, lQuat);
    // Rotate local position by parent quaternion and add parent position
    const p = parentQuat;
    const v = lPos;
    const wPos = {
      x: parentPos.x + v.x + 2*(p.y*v.z - p.z*v.y)*p.w + 2*(p.x*(p.x*v.x+p.y*v.y+p.z*v.z) - v.x*(p.x*p.x+p.y*p.y+p.z*p.z)),
      y: parentPos.y + v.y + 2*(p.z*v.x - p.x*v.z)*p.w + 2*(p.y*(p.x*v.x+p.y*v.y+p.z*v.z) - v.y*(p.x*p.x+p.y*p.y+p.z*p.z)),
      z: parentPos.z + v.z + 2*(p.x*v.y - p.y*v.x)*p.w + 2*(p.z*(p.x*v.x+p.y*v.y+p.z*v.z) - v.z*(p.x*p.x+p.y*p.y+p.z*p.z)),
    };
    return { pos: wPos, quat: wQuat };
  }
  function traverseNodes(json, nodeIdx, parentPos, parentQuat) {
    const nd = json.nodes[nodeIdx];
    const { pos: wPos, quat: wQuat } = getNodeWorldTransform(json, nodeIdx, parentPos, parentQuat);
    if (nd.name && nd.name.toLowerCase().startsWith('socket_') && nd.mesh == null) {
      const base = nd.name.replace(/\.\d+$/, '');
      if (!socketMap[base]) socketMap[base] = [];
      const entry = {
        name: nd.name,
        position: { x: wPos.x, y: wPos.y, z: wPos.z },
        quaternion: { x: wQuat.x, y: wQuat.y, z: wQuat.z, w: wQuat.w },
      };
      socketMap[base].push(entry);
      if (nd.name !== base) socketMap[nd.name] = [entry];
    }
    if (nd.children) {
      for (const ci of nd.children) traverseNodes(json, ci, wPos, wQuat);
    }
  }
  const sceneDef2 = json.scenes[json.scene || 0];
  const identity = { x:0,y:0,z:0,w:1 };
  const origin   = { x:0,y:0,z:0 };
  for (const ni of sceneDef2.nodes) traverseNodes(json, ni, origin, identity);
  Object.values(socketMap).forEach(arr =>
    arr.sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  );
  root.userData.socketPositions = socketMap;

  // Auto-detect snap_ Empties from GLB JSON — store X,Z for snap system
  const snapPoints = [];
  try {
    if (json && json.nodes) {
      const rootQuat = { x:0, y:0, z:0, w:1 };
      const rootPos  = { x:0, y:0, z:0 };
      function visitForSnap(nodeIdx, parentPos, parentQuat) {
        const nd = json.nodes[nodeIdx];
        if (!nd) return;
        const result = getNodeWorldTransform(json, nodeIdx, parentPos, parentQuat);
        if (!result) return;
        const { pos: wPos, quat: wQuat } = result;
        if (nd.name && nd.name.startsWith('snap_')) {
          snapPoints.push({ name: nd.name, x: wPos.x, z: wPos.z });
        }
        (nd.children || []).forEach(ci => visitForSnap(ci, wPos, wQuat));
      }
      (json.scenes?.[0]?.nodes || []).forEach(ni => visitForSnap(ni, rootPos, rootQuat));
    }
  } catch(e) {
    console.warn('snapPoints parse error:', e);
  }
  root.userData.snapPoints = snapPoints;

  return root;
}

// ── Public API ────────────────────────────────────────────────
const modelCache = new Map();

export function loadModel(url) {
  if (modelCache.has(url)) return modelCache.get(url);
  const promise = fetch(url)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`); return r.arrayBuffer(); })
    .then(buf => { const { json, bin } = parseGLB(buf); return buildScene(json, bin); });
  modelCache.set(url, promise);
  return promise;
}

export function cloneModel(original) {
  return original.clone(true);
}

export function clearModelCache() {
  modelCache.clear();
  globalMatCache.clear();
}






