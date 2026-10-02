import * as THREE from 'three';
import { loadModel } from './glbParser.js';

// Footprint of a model on the floor, in its own local space:
// { minX, maxX, minZ, maxZ } (meters), or null if it has no visible geometry.
// Uses the same cached GLB as the viewport (loadModel), and only reads it.
export async function measureModelBox(url) {
  const root = await loadModel(url);
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  root.traverseVisible(o => {
    if (!o.isMesh || !o.geometry || o.userData.isMeta) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.union(new THREE.Box3().copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
  });
  if (box.isEmpty()) return null;
  return { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
}
