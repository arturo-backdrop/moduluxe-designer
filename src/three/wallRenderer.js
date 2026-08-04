import * as THREE from 'three';

// ── Constants ─────────────────────────────────────────────────
export const WALL_SNAP_RADIUS = 0.4;
export const ANGLE_SNAP       = Math.PI / 4; // 45°
export const ACCENT            = 0xb48b31;
export const DOOR_W            = 0.914;
export const DOOR_H            = 2.032;

// ── Shared materials ──────────────────────────────────────────
const ghostMat = new THREE.MeshStandardMaterial({
  color: 0x4488ff, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide,
});

// ── Wall with door cutouts ────────────────────────────────────
export function buildWallMesh(item, allItems) {
  const { x1, z1, x2, z2, height = 2.4, thickness = 0.1, glassRatio = 0, color = '#cccccc' } = item;
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.01) return null;

  // -atan2(dz,dx) aligns local +X with wall direction (dx,dz)
  const angle = -Math.atan2(dz, dx);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;

  // Find doors on this wall
  const doors = allItems.filter(i => i.type === 'door' && i.wallUid === item.uid);

  const group = new THREE.Group();
  group.position.set(cx, 0, cz);
  group.rotation.y = angle;
  group.userData.wallUid = item.uid;

  const solidMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.0 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xadd8e6, transparent: true, opacity: 0.35,
    transmission: 0.88, thickness, ior: 1.5, roughness: 0.05, side: THREE.DoubleSide,
  });

  const solidH = height * (1 - glassRatio);
  const glassH = height * glassRatio;

  if (doors.length === 0) {
    // Simple wall — no cutouts
    if (solidH > 0.001) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, solidH, thickness), solidMat);
      m.position.y = solidH / 2; m.castShadow = m.receiveShadow = true;
      group.add(m);
    }
    if (glassH > 0.001) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, glassH, thickness * 0.4), glassMat);
      m.position.y = solidH + glassH / 2;
      group.add(m);
    }
  } else {
    // Wall with door cutouts — build segments around each door
    // Sort doors by t position along wall
    const sorted = [...doors].sort((a, b) => a.t - b.t);

    // Collect intervals to exclude [localStart, localEnd] in local wall coords
    // Local coords: 0 = left end (-len/2), len = right end (+len/2)
    const exclude = sorted.map(d => {
      const dw = d.width || DOOR_W;
      const tc = d.t * len; // center position in local coords (0..len)
      return { start: tc - dw / 2, end: tc + dw / 2, door: d };
    });

    // Build solid segments between/around door openings
    const segments = [];
    let cur = 0;
    exclude.forEach(({ start, end }) => {
      if (start > cur + 0.001) segments.push({ from: cur, to: start });
      cur = end;
    });
    if (cur < len - 0.001) segments.push({ from: cur, to: len });

    segments.forEach(({ from, to }) => {
      const segLen = to - from;
      if (segLen < 0.001) return;
      const localCx = from + segLen / 2 - len / 2; // offset from wall center
      if (solidH > 0.001) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(segLen, solidH, thickness), solidMat);
        m.position.set(localCx, solidH / 2, 0); m.castShadow = m.receiveShadow = true;
        group.add(m);
      }
      if (glassH > 0.001) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(segLen, glassH, thickness * 0.4), glassMat);
        m.position.set(localCx, solidH + glassH / 2, 0);
        group.add(m);
      }
    });

    // Lintel above each door opening
    exclude.forEach(({ start, end, door }) => {
      const dh    = door.height || DOOR_H;
      const segLen = end - start;
      const localCx = (start + end) / 2 - len / 2;
      const lintelH = Math.max(0.01, height - dh);
      if (lintelH > 0.001) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(segLen, lintelH, thickness), solidMat);
        m.position.set(localCx, dh + lintelH / 2, 0); m.castShadow = true;
        group.add(m);
      }
    });
  }

  return group;
}

// ── Column ────────────────────────────────────────────────────
export function buildColumnMesh(item) {
  const { width = 0.3, depth = 0.3, height = 2.4, color = '#cccccc', shape = 'square' } = item;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.0 });
  const geo = shape === 'circle'
    ? new THREE.CylinderGeometry(width / 2, width / 2, height, 16)
    : new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = height / 2;
  mesh.castShadow = mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

// ── Door assembly ─────────────────────────────────────────────
export function buildDoorMesh(item, allItems) {
  const { width = DOOR_W, height = DOOR_H, openAngle = 45, color = '#cccccc', wallUid, t = 0.5 } = item;
  const wall = allItems.find(i => i.uid === wallUid);
  if (!wall) return null;

  const thickness = wall.thickness || 0.1;
  const frameT    = 0.055;
  const leafT     = thickness * 0.5;
  const frameMat  = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
  const leafMat   = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05 });

  const group = new THREE.Group();

  // Frame jambs
  const jGeo = new THREE.BoxGeometry(frameT, height, thickness);
  const lJamb = new THREE.Mesh(jGeo, frameMat);
  lJamb.position.set(-width / 2 - frameT / 2, height / 2, 0);
  group.add(lJamb);
  const rJamb = lJamb.clone();
  rJamb.position.x = width / 2 + frameT / 2;
  group.add(rJamb);

  // Lintel
  const lintelGeo = new THREE.BoxGeometry(width + frameT * 2, frameT, thickness);
  const lintel = new THREE.Mesh(lintelGeo, frameMat);
  lintel.position.set(0, height + frameT / 2, 0);
  group.add(lintel);

  // Header trim
  const headerGeo = new THREE.BoxGeometry(width + frameT * 2, 0.03, thickness);
  const header = new THREE.Mesh(headerGeo, frameMat);
  header.position.set(0, height - 0.015, 0);
  group.add(header);

  // Door leaf — pivots from left jamb
  const pivot = new THREE.Group();
  pivot.position.set(-width / 2, 0, 0);
  const leafGeo = new THREE.BoxGeometry(width, height - 0.02, leafT);
  leafGeo.translate(width / 2, 0, 0); // pivot at left edge
  const leaf = new THREE.Mesh(leafGeo, leafMat);
  leaf.position.set(0, height / 2, 0);
  leaf.castShadow = true;
  const angleRad = (openAngle * Math.PI) / 180; // negative = opens outward
  pivot.rotation.y = -angleRad;
  pivot.add(leaf);

  // Handle
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xb8a060, roughness: 0.3, metalness: 0.8 });
  const knobGeo = new THREE.SphereGeometry(0.02, 10, 10);
  [-1, 1].forEach(side => {
    const knob = new THREE.Mesh(knobGeo, handleMat);
    knob.position.set(width - 0.1, height / 2, side * (leafT / 2 + 0.015));
    pivot.add(knob);
  });
  group.add(pivot);

  // Position on wall
  const dx = wall.x2 - wall.x1, dz = wall.z2 - wall.z1;
  const wallLen = Math.sqrt(dx * dx + dz * dz);
  const wx = wall.x1 + dx * t, wz = wall.z1 + dz * t;
  const wallAngle = -Math.atan2(dz, dx);
  group.position.set(wx, 0, wz);
  group.rotation.y = wallAngle;

  return group;
}

// ── Ghosts ────────────────────────────────────────────────────
export function buildWallGhost(start, end, height = 2.4, thickness = 0.1) {
  const dx = end.x - start.x, dz = end.z - start.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.01) return null;
  const geo  = new THREE.BoxGeometry(len, height, thickness);
  const mesh = new THREE.Mesh(geo, ghostMat);
  mesh.position.set((start.x + end.x) / 2, height / 2, (start.z + end.z) / 2);
  mesh.rotation.y = -Math.atan2(dz, dx);
  return mesh;
}

export function buildColumnGhost(width = 0.3, height = 2.4, depth = 0.3) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x4488ff, transparent: true, opacity: 0.4, depthWrite: false });
  const geo = new THREE.BoxGeometry(width, height, depth);
  geo.translate(0, height / 2, 0); // base at y=0
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.isMeta = true;
  return mesh;
}

export function buildDoorGhost(wallAngle, width = DOOR_W, height = DOOR_H, thickness = 0.1) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4488ff, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide,
  });
  const group = new THREE.Group();
  // Simple door outline ghost
  const frameGeo = new THREE.BoxGeometry(width + 0.11, height + 0.06, thickness);
  const frame = new THREE.Mesh(frameGeo, mat);
  frame.position.y = height / 2;
  group.add(frame);
  group.rotation.y = wallAngle;
  return group;
}

// ── Endpoint handles ──────────────────────────────────────────
export function buildEndpointHandle(pos) {
  const geo  = new THREE.SphereGeometry(0.07, 12, 12);
  const mat  = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.3, metalness: 0.2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.position.y = 0.07;
  mesh.renderOrder = 5;
  mesh.userData.isHandle = true;
  return mesh;
}

// ── Snap helpers ──────────────────────────────────────────────
export function snapWallPoint(rawPt, walls, floorW, floorD, freePos = false) {
  if (freePos) return { pt: rawPt, snapped: false };
  const t = 0.05;
  const hw = floorW / 2 - t, hd = floorD / 2 - t;
  const candidates = [];

  walls.forEach(w => {
    if (w.type !== 'wall') return;
    candidates.push(new THREE.Vector3(w.x1, 0, w.z1));
    candidates.push(new THREE.Vector3(w.x2, 0, w.z2));
  });

  [[-hw,0],[hw,0],[0,-hd],[0,hd],[-hw,-hd],[-hw,hd],[hw,-hd],[hw,hd]].forEach(([x,z]) => {
    candidates.push(new THREE.Vector3(x, 0, z));
  });

  let best = null, bestDist = WALL_SNAP_RADIUS;
  candidates.forEach(c => {
    const d = rawPt.distanceTo(c);
    if (d < bestDist) { bestDist = d; best = c; }
  });
  return best ? { pt: best.clone(), snapped: true } : { pt: rawPt.clone(), snapped: false };
}

export function snapAngle(start, end) {
  const dx = end.x - start.x, dz = end.z - start.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.001) return end.clone();
  const angle   = Math.atan2(dx, dz);
  const snapped = Math.round(angle / ANGLE_SNAP) * ANGLE_SNAP;
  return new THREE.Vector3(
    start.x + Math.sin(snapped) * len, 0,
    start.z + Math.cos(snapped) * len
  );
}

export function findClosestWall(pt, walls, maxDist = 2.0) {
  let best = null, bestDist = maxDist, bestT = 0;
  walls.forEach(w => {
    if (w.type !== 'wall') return;
    const A = new THREE.Vector3(w.x1, 0, w.z1);
    const B = new THREE.Vector3(w.x2, 0, w.z2);
    const AB = new THREE.Vector3().subVectors(B, A);
    const len2 = AB.lengthSq();
    if (len2 < 0.0001) return;
    const t = Math.max(0, Math.min(1, new THREE.Vector3().subVectors(pt, A).dot(AB) / len2));
    const closest = A.clone().addScaledVector(AB, t);
    const d = pt.distanceTo(closest);
    if (d < bestDist) { bestDist = d; best = w; bestT = t; }
  });
  return best ? { wall: best, t: bestT } : null;
}

