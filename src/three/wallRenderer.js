import * as THREE from 'three';

// ── Constants ─────────────────────────────────────────────────
export const WALL_SNAP_RADIUS = 0.4;   // meters
export const ANGLE_SNAP       = Math.PI / 4; // 45°
export const ACCENT            = 0xb48b31;
export const DOOR_W            = 0.914;  // meters
export const DOOR_H            = 2.032;  // meters

// ── Materials ─────────────────────────────────────────────────
const ghostMat = new THREE.MeshStandardMaterial({
  color: 0x4488ff, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide,
});
const handleMat = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.3, metalness: 0.2 });
const handleHoverMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.2, metalness: 0.3 });

// ── Geometry builders ─────────────────────────────────────────

export function buildWallMesh(item, allItems) {
  const { x1, z1, x2, z2, height = 2.4, thickness = 0.1, glassRatio = 0, color = '#cccccc' } = item;
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.01) return null;

  const group = new THREE.Group();
  group.userData.wallUid = item.uid;

  const solidH  = height * (1 - glassRatio);
  const glassH  = height * glassRatio;
  const solidMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.7, metalness: 0.0, side: THREE.DoubleSide,
  });

  // Solid part
  if (solidH > 0.001) {
    const solidGeo = new THREE.BoxGeometry(len, solidH, thickness);
    const solid = new THREE.Mesh(solidGeo, solidMat);
    solid.position.y = solidH / 2;
    solid.castShadow = solid.receiveShadow = true;
    group.add(solid);
  }

  // Glass part
  if (glassH > 0.001) {
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xadd8e6, transparent: true, opacity: 0.35,
      transmission: 0.88, thickness: thickness, ior: 1.5,
      roughness: 0.05, metalness: 0.0, side: THREE.DoubleSide,
    });
    const glassGeo = new THREE.BoxGeometry(len, glassH, thickness * 0.4);
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.y = solidH + glassH / 2;
    group.add(glass);
  }

  // Position & rotate
  // rotation.y = -atan2(dz,dx) aligns local +X with wall direction
  const angle = -Math.atan2(dz, dx);
  group.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
  group.rotation.y = angle;

  return group;
}

export function buildColumnMesh(item) {
  const { width = 0.3, depth = 0.3, height = 2.4, color = '#cccccc', shape = 'square' } = item;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.0 });
  let geo;
  if (shape === 'circle') {
    geo = new THREE.CylinderGeometry(width / 2, width / 2, height, 16);
  } else {
    geo = new THREE.BoxGeometry(width, height, depth);
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = height / 2;
  mesh.castShadow = mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

export function buildDoorMesh(item, allItems) {
  const { width = DOOR_W, height = DOOR_H, openAngle = 45, color = '#cccccc', wallUid, t = 0.5 } = item;
  const wall = allItems.find(i => i.uid === wallUid);
  if (!wall) return null;

  const frameT   = 0.06;  // frame thickness
  const panelT   = 0.04;  // door panel thickness
  const mat      = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });

  const group = new THREE.Group();

  // Frame: top + two sides
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(width + frameT * 2, frameT, frameT), mat);
  frameTop.position.set(0, height + frameT / 2, 0);
  group.add(frameTop);

  const frameL = new THREE.Mesh(new THREE.BoxGeometry(frameT, height, frameT), mat);
  frameL.position.set(-width / 2 - frameT / 2, height / 2, 0);
  group.add(frameL);

  const frameR = frameL.clone();
  frameR.position.x = width / 2 + frameT / 2;
  group.add(frameR);

  // Door panel — hinged on left side, rotates around its left edge
  const panelGeo = new THREE.BoxGeometry(width, height, panelT);
  const panel    = new THREE.Mesh(panelGeo, mat.clone());
  panel.castShadow = true;
  // Pivot at left edge: translate geo so left edge is at origin
  panelGeo.translate(width / 2, 0, 0);
  panel.position.set(-width / 2, height / 2, 0);
  const angleRad = (openAngle * Math.PI) / 180;
  panel.rotation.y = -angleRad;
  group.add(panel);
  group.userData.panelRef = panel;

  // Position on wall
  const { x1, z1, x2, z2 } = wall;
  const dx = x2 - x1, dz = z2 - z1;
  const wx = x1 + dx * t, wz = z1 + dz * t;
  const wallAngle = -Math.atan2(dz, dx);
  group.position.set(wx, 0, wz);
  group.rotation.y = wallAngle;

  return group;
}

// Ghost wall for preview while drawing
export function buildWallGhost(start, end, height = 2.4, thickness = 0.1) {
  const dx = end.x - start.x, dz = end.z - start.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.01) return null;
  const geo   = new THREE.BoxGeometry(len, height, thickness);
  const mesh  = new THREE.Mesh(geo, ghostMat);
  const angle = -Math.atan2(dz, dx);
  mesh.position.set((start.x + end.x) / 2, height / 2, (start.z + end.z) / 2);
  mesh.rotation.y = angle;
  return mesh;
}

export function buildDoorGhost(wallAngle, width = DOOR_W, height = DOOR_H) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4488ff, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide,
  });
  const group = new THREE.Group();
  const panelGeo = new THREE.BoxGeometry(width, height, 0.04);
  panelGeo.translate(width / 2, 0, 0);
  const panel = new THREE.Mesh(panelGeo, mat);
  panel.position.set(-width / 2, height / 2, 0);
  panel.rotation.y = -Math.PI / 4; // 45° open
  group.add(panel);
  group.rotation.y = wallAngle;
  return group;
}

// ── Endpoint handles ──────────────────────────────────────────
export function buildEndpointHandle(pos) {
  const geo  = new THREE.SphereGeometry(0.08, 12, 12);
  const mesh = new THREE.Mesh(geo, handleMat.clone());
  mesh.position.copy(pos);
  mesh.position.y = 0.08;
  mesh.renderOrder = 5;
  mesh.userData.isHandle = true;
  return mesh;
}

// ── Snap helpers ──────────────────────────────────────────────
export function snapWallPoint(rawPt, walls, floorW, floorD, freePos = false) {
  if (freePos) return { pt: rawPt, snapped: false };
  const t = 0.05; // half thickness offset
  const hw = floorW / 2 - t, hd = floorD / 2 - t;
  const candidates = [];

  // Wall endpoints
  walls.forEach(w => {
    if (w.type !== 'wall') return;
    candidates.push(new THREE.Vector3(w.x1, 0, w.z1));
    candidates.push(new THREE.Vector3(w.x2, 0, w.z2));
  });

  // Floor edges
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
  if (len < 0.001) return end;
  const angle   = Math.atan2(dx, dz);
  const snapped = Math.round(angle / ANGLE_SNAP) * ANGLE_SNAP;
  return new THREE.Vector3(
    start.x + Math.sin(snapped) * len, 0,
    start.z + Math.cos(snapped) * len
  );
}

// Find which wall a point is closest to (for door placement)
export function findClosestWall(pt, walls, maxDist = 0.5) {
  let best = null, bestDist = maxDist, bestT = 0;
  walls.forEach(w => {
    if (w.type !== 'wall') return;
    const A = new THREE.Vector3(w.x1, 0, w.z1);
    const B = new THREE.Vector3(w.x2, 0, w.z2);
    const AB = new THREE.Vector3().subVectors(B, A);
    const len = AB.length();
    if (len < 0.01) return;
    const t = Math.max(0, Math.min(1, new THREE.Vector3().subVectors(pt, A).dot(AB) / (len * len)));
    const closest = new THREE.Vector3().addVectors(A, AB.clone().multiplyScalar(t));
    const d = pt.distanceTo(closest);
    if (d < bestDist) { bestDist = d; best = w; bestT = t; }
  });
  return best ? { wall: best, t: bestT } : null;
}

