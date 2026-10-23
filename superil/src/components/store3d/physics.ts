import type { AABB, ProductBlock } from "./layout";

/** Pushes a circle (player) out of every overlapping AABB. Returns the corrected position. */
export function resolveCircle(x: number, z: number, r: number, colliders: AABB[]): [number, number] {
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // Center is inside the box: push out along the shallowest axis.
        const pushes = [
          [c.minX - r - x, 0],
          [c.maxX + r - x, 0],
          [0, c.minZ - r - z],
          [0, c.maxZ + r - z],
        ].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
        x += pushes[0][0];
        z += pushes[0][1];
      }
      moved = true;
    }
    if (!moved) break;
  }
  return [x, z];
}

/**
 * Moves the player by (dx, dz) in small sub-steps so fast movement can't tunnel through thin fixtures.
 */
export function moveWithCollisions(x: number, z: number, dx: number, dz: number, r: number, colliders: AABB[]): [number, number] {
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / (r * 0.5)));
  for (let i = 0; i < steps; i++) {
    [x, z] = resolveCircle(x + dx / steps, z + dz / steps, r, colliders);
  }
  return [x, z];
}

/** Ray vs AABB (slab method). Returns distance along the ray or null. */
export function rayBox(
  o: [number, number, number],
  d: [number, number, number],
  min: [number, number, number],
  max: [number, number, number],
): number | null {
  let tmin = -Infinity;
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < min[i] || o[i] > max[i]) return null;
      continue;
    }
    const t1 = (min[i] - o[i]) / d[i];
    const t2 = (max[i] - o[i]) / d[i];
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  }
  if (tmax < Math.max(0, tmin)) return null;
  return tmin >= 0 ? tmin : tmax;
}

/** Finds the closest product block hit by a ray within `range` meters, plus the facing nearest the hit. */
export function pickBlock(
  blocks: ProductBlock[],
  origin: [number, number, number],
  dir: [number, number, number],
  range: number,
): { block: ProductBlock; facing: number; distance: number } | null {
  let best: { block: ProductBlock; facing: number; distance: number } | null = null;
  for (const b of blocks) {
    // Cheap reject by horizontal distance.
    const cx = (b.bounds.min[0] + b.bounds.max[0]) / 2;
    const cz = (b.bounds.min[2] + b.bounds.max[2]) / 2;
    const half = Math.max(b.bounds.max[0] - b.bounds.min[0], b.bounds.max[2] - b.bounds.min[2]) / 2;
    if (Math.hypot(cx - origin[0], cz - origin[2]) > range + half) continue;
    const t = rayBox(origin, dir, b.bounds.min, b.bounds.max);
    if (t === null || t > range || (best && t >= best.distance)) continue;
    const hit = [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t];
    let facing = 0;
    let fd = Infinity;
    b.facings.forEach((f, i) => {
      const dd = (f.pos[0] - hit[0]) ** 2 + (f.pos[1] - hit[1]) ** 2 + (f.pos[2] - hit[2]) ** 2;
      if (dd < fd) {
        fd = dd;
        facing = i;
      }
    });
    best = { block: b, facing, distance: t };
  }
  return best;
}
