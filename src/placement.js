// ── Floor placement helpers (pure math, no three.js) ──────────
// Used to drop a preset on the floor without stacking it on top of what the
// user already placed. All units are meters; the floor is centered on (0,0).
//
// A "box" is a model's local footprint: { minX, maxX, minZ, maxZ }.
// A "rect" is a world-space axis-aligned footprint with the same keys.

// World-space AABB of a model box placed at (item.x, item.z) and rotated
// item.rotY radians around the Y axis (same convention as three.js).
export function itemRect(item, box) {
  const cx = item.x || 0, cz = item.z || 0, a = item.rotY || 0;
  const c = Math.cos(a), s = Math.sin(a);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  [[box.minX, box.minZ], [box.maxX, box.minZ], [box.minX, box.maxZ], [box.maxX, box.maxZ]].forEach(([x, z]) => {
    const wx = cx + c * x + s * z;
    const wz = cz - s * x + c * z;
    if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
    if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
  });
  return { minX, maxX, minZ, maxZ };
}

export function unionRects(rects) {
  return rects.reduce((u, r) => ({
    minX: Math.min(u.minX, r.minX), maxX: Math.max(u.maxX, r.maxX),
    minZ: Math.min(u.minZ, r.minZ), maxZ: Math.max(u.maxZ, r.maxZ),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
}

function shift(r, dx, dz) {
  return { minX: r.minX + dx, maxX: r.maxX + dx, minZ: r.minZ + dz, maxZ: r.maxZ + dz };
}

// True if the two rects overlap by more than `gap` (touching is allowed).
export function rectsOverlap(a, b, gap = 0) {
  return a.minX < b.maxX + gap && a.maxX > b.minX - gap &&
         a.minZ < b.maxZ + gap && a.maxZ > b.minZ - gap;
}

// True if a wall segment (x1,z1)-(x2,z2) with the given thickness comes within
// `gap` of the rect. Liang–Barsky clip of the segment against the grown rect.
export function rectHitsWall(r, wall, gap = 0) {
  const pad = (wall.thickness ?? 0.1) / 2 + gap;
  const minX = r.minX - pad, maxX = r.maxX + pad, minZ = r.minZ - pad, maxZ = r.maxZ + pad;
  const dx = wall.x2 - wall.x1, dz = wall.z2 - wall.z1;
  let t0 = 0, t1 = 1;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;            // parallel to this edge: inside or not
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else       { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  return clip(-dx, wall.x1 - minX) && clip(dx, maxX - wall.x1) &&
         clip(-dz, wall.z1 - minZ) && clip(dz, maxZ - wall.z1);
}

// Finds the offset (dx, dz) closest to the preset's original position at which
// every preset footprint lies inside the floor and clear of everything already
// placed. Returns { fits: true, dx, dz } or { fits: false, reason }, where
// reason is 'too_big' (preset is larger than the floor) or 'occupied'.
export function findFreeOffset({
  presetRects, occupiedRects = [], walls = [], floorW, floorD, gap = 0.05, step = 0.1,
}) {
  if (!presetRects.length) return { fits: true, dx: 0, dz: 0 };
  const b = unionRects(presetRects);
  const loX = -floorW / 2 - b.minX, hiX = floorW / 2 - b.maxX;
  const loZ = -floorD / 2 - b.minZ, hiZ = floorD / 2 - b.maxZ;
  if (loX > hiX + 1e-9 || loZ > hiZ + 1e-9) return { fits: false, reason: 'too_big' };

  const isFree = (dx, dz) => {
    for (const pr of presetRects) {
      const r = shift(pr, dx, dz);
      for (const o of occupiedRects) if (rectsOverlap(r, o, gap)) return false;
      for (const w of walls) if (rectHitsWall(r, w, gap)) return false;
    }
    return true;
  };

  // Original position first (keeps the preset as designed whenever it's free)
  const cands = [];
  const ox = Math.min(hiX, Math.max(loX, 0)), oz = Math.min(hiZ, Math.max(loZ, 0));
  cands.push([ox, oz]);
  const xs = [], zs = [];
  for (let x = loX; x <= hiX + 1e-9; x += step) xs.push(Math.min(x, hiX));
  for (let z = loZ; z <= hiZ + 1e-9; z += step) zs.push(Math.min(z, hiZ));
  if (xs[xs.length - 1] < hiX) xs.push(hiX);
  if (zs[zs.length - 1] < hiZ) zs.push(hiZ);
  xs.forEach(x => zs.forEach(z => cands.push([x, z])));
  // Nearest to the original position first (stable for ties)
  const dist = ([x, z]) => Math.hypot(x - ox, z - oz);
  const sorted = cands.slice(1).sort((p, q) => dist(p) - dist(q));
  for (const [dx, dz] of [cands[0], ...sorted]) {
    if (isFree(dx, dz)) return { fits: true, dx, dz };
  }
  return { fits: false, reason: 'occupied' };
}
