import { runtime } from './runtime'

/**
 * Pour patterns as flat [x, z, x, z, …] paths in roll-local space.
 * Shared by the live pouring interaction and the chef's picks.
 */

/** Back-to-front zigzag in *world* orientation (so it reads straight on screen), converted to roll-local. */
export function zigzagPath(spin = runtime.spin, angleDeg = 0): number[] {
  const pts: number[] = []
  const zigs = 9
  const N = 420
  const a = spin - (angleDeg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const zw = -0.8 + 1.6 * t
    const amp = Math.sqrt(Math.max(0, 0.86 * 0.86 - zw * zw)) * 0.96
    const ph = (t * zigs) % 2
    const tri = ph < 1 ? ph * 2 - 1 : 3 - ph * 2
    const xw = tri * amp
    pts.push(xw * c - zw * s, xw * s + zw * c)
  }
  return pts
}

/** Follows the dough spiral from the centre outwards. */
export function spiralPath(): number[] {
  const d = runtime.rollData
  const pts: number[] = []
  if (!d) return pts
  const u0 = 0.9
  const u1 = d.uMax - 1.2
  for (let u = u0; u <= u1; u += 0.03) {
    const r = d.r0 + (d.pitch * u) / (Math.PI * 2)
    pts.push(Math.cos(u) * r, Math.sin(u) * r)
  }
  return pts
}

export function pathLength(p: number[]) {
  let L = 0
  for (let i = 2; i < p.length; i += 2) L += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1])
  return L
}
