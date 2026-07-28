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

async function buildMaterial(json, bin, matIndex, matCache) {
  if (matIndex == null || !json.materials) return new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.5, metalness: 0.1 });
  if (matCache.has(matIndex)) return matCache.get(matIndex);
  const m   = json.materials[matIndex] || {};
  const pbr = m.pbrMetallicRoughness || {};
  const bc  = pbr.baseColorFactor || [1,1,1,1];
  const mat = new THREE.MeshStandardMaterial({
    color:       new THREE.Color(bc[0], bc[1], bc[2]),
    roughness:   pbr.roughnessFactor ?? 0.6,
    metalness:   pbr.metallicFactor  ?? 0.1,
    transparent: bc[3] < 1,
    opacity:     bc[3] ?? 1,
  });
  if (m.name) mat.name = m.name;
  if (pbr.baseColorTexture) {
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
}
