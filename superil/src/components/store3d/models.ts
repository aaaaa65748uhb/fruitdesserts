import * as THREE from "three";

/**
 * A unit-height lathe model whose radius follows the photo's silhouette (bottom → top). The profile is reduced to
 * `rows` bands (keeping each band's widest point, so the cut-out photo is never clipped by the model).
 */
export function latheFromProfile(profile: number[], segments: number, rows: number): THREE.BufferGeometry {
  const n = Math.max(2, Math.min(rows, profile.length));
  const band = profile.length / n;
  const clamp = (r: number) => Math.min(0.5, Math.max(0.004, r));
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -0.5)];
  for (let i = 0; i < n; i++) {
    const slice = profile.slice(Math.floor(i * band), Math.max(Math.floor(i * band) + 1, Math.floor((i + 1) * band)));
    pts.push(new THREE.Vector2(clamp(Math.max(...slice) * 1.02), -0.5 + (i + 0.5) / n));
  }
  pts.push(new THREE.Vector2(clamp(profile[profile.length - 1]) * 0.9, 0.5));
  pts.push(new THREE.Vector2(0, 0.5));
  return new THREE.LatheGeometry(pts, segments);
}
