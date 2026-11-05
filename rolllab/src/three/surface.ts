import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import type { SauceStroke } from '../types'

/**
 * RollSurface — a height-field of the roll's top (roll-local space) plus a
 * second layer that accumulates poured sauce. Toppings and new sauce strokes
 * query it so they rest exactly on the dough — or on top of earlier sauce.
 */
export class RollSurface {
  readonly N = 176
  readonly L = 1.16
  readonly cell = (2 * this.L) / this.N
  base = new Float32Array(this.N * this.N).fill(-1)
  smooth = new Float32Array(this.N * this.N).fill(-1)
  accum = new Float32Array(this.N * this.N)
  edgeR = new Float32Array(360)
  edgeH = new Float32Array(360)
  bvh: MeshBVH | null = null
  ready = false
  /** Increments whenever `accum` changes (consumers re-settle toppings). */
  version = 0
  private tmp = new Float32Array(this.N * this.N)

  build(geometry: THREE.BufferGeometry) {
    this.bvh = new MeshBVH(geometry)
    const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0))
    const { N, L, cell } = this
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        ray.origin.set(-L + (i + 0.5) * cell, 4, -L + (j + 0.5) * cell)
        const hit = this.bvh.raycastFirst(ray, THREE.DoubleSide)
        this.base[j * N + i] = hit ? hit.point.y : -1
      }
    }
    // blurred copy — glaze pools bridge the grooves instead of sinking into them
    const r = 3
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const h0 = this.base[j * N + i]
        if (h0 < 0) continue
        let s = 0
        let w = 0
        for (let dj = -r; dj <= r; dj++) {
          for (let di = -r; di <= r; di++) {
            const ii = i + di
            const jj = j + dj
            if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue
            const h = this.base[jj * N + ii]
            if (h < 0) continue
            const ww = 1 / (1 + di * di + dj * dj)
            s += Math.max(h, h0 - 0.02) * ww
            w += ww
          }
        }
        this.smooth[j * N + i] = Math.max(h0, s / w)
      }
    }
    // outer edge per degree
    for (let a = 0; a < 360; a++) {
      const ang = (a / 360) * Math.PI * 2
      const ca = Math.cos(ang)
      const sa = Math.sin(ang)
      let lastR = 0.6
      let lastH = 0.4
      for (let rr = 0.6; rr < L; rr += cell * 0.5) {
        const h = this.baseAt(ca * rr, sa * rr)
        if (h === null || h < 0.12) break
        lastR = rr
        lastH = h
      }
      this.edgeR[a] = lastR
      this.edgeH[a] = lastH
    }
    this.ready = true
  }

  private idx(x: number, z: number) {
    const fx = (x + this.L) / this.cell - 0.5
    const fz = (z + this.L) / this.cell - 0.5
    return { fx, fz, i: Math.floor(fx), j: Math.floor(fz) }
  }

  private sample(grid: Float32Array, x: number, z: number, allowInvalid = false): number | null {
    const { N } = this
    const { fx, fz, i, j } = this.idx(x, z)
    if (i < 0 || j < 0 || i >= N - 1 || j >= N - 1) return null
    const tx = fx - i
    const tz = fz - j
    const a = grid[j * N + i]
    const b = grid[j * N + i + 1]
    const c = grid[(j + 1) * N + i]
    const d = grid[(j + 1) * N + i + 1]
    if (!allowInvalid) {
      const valid = (a >= 0 ? 1 : 0) + (b >= 0 ? 1 : 0) + (c >= 0 ? 1 : 0) + (d >= 0 ? 1 : 0)
      if (valid < 3) return null
      const m = Math.max(a, b, c, d)
      const fa = a < 0 ? m : a
      const fb = b < 0 ? m : b
      const fc = c < 0 ? m : c
      const fd = d < 0 ? m : d
      return (fa * (1 - tx) + fb * tx) * (1 - tz) + (fc * (1 - tx) + fd * tx) * tz
    }
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz
  }

  /** Bare dough height (null when off the roll). */
  baseAt(x: number, z: number) {
    return this.sample(this.base, x, z)
  }

  accumAt(x: number, z: number) {
    return this.sample(this.accum, x, z, true) ?? 0
  }

  /** Dough + sauce height — where a new topping or sauce would land. */
  heightAt(x: number, z: number): number | null {
    const b = this.baseAt(x, z)
    if (b === null) return null
    return b + this.accumAt(x, z)
  }

  smoothAt(x: number, z: number): number | null {
    const b = this.sample(this.smooth, x, z)
    if (b === null) return null
    return b + this.accumAt(x, z)
  }

  normalAt(x: number, z: number, out: THREE.Vector3) {
    const e = this.cell * 1.5
    const h = this.heightAt(x, z) ?? 0
    const hx = this.heightAt(x + e, z) ?? h
    const hz = this.heightAt(x, z + e) ?? h
    return out.set(h - hx, e, h - hz).normalize()
  }

  edgeAt(angle: number) {
    let a = Math.round(((((angle * 180) / Math.PI) % 360) + 360) % 360) % 360
    if (a < 0) a += 360
    return { r: this.edgeR[a], h: this.edgeH[a] }
  }

  /** Is (x, z) on the roll and how far inside the edge (in units)? */
  insideBy(x: number, z: number) {
    const ang = Math.atan2(z, x)
    return this.edgeAt(ang).r - Math.hypot(x, z)
  }

  /** Rebuild the sauce layer from committed strokes (in order). */
  rebuildAccum(strokes: SauceStroke[], excludeId: string | null) {
    this.accum.fill(0)
    for (const s of strokes) {
      if (s.id === excludeId) continue
      this.depositStroke(s)
    }
    this.version++
  }

  private depositStroke(s: SauceStroke) {
    const { N, L, cell, tmp } = this
    const touched: number[] = []
    const stamp = (cx: number, cz: number, rad: number, profile: (d: number) => number) => {
      const i0 = Math.max(0, Math.floor((cx - rad + L) / cell))
      const i1 = Math.min(N - 1, Math.ceil((cx + rad + L) / cell))
      const j0 = Math.max(0, Math.floor((cz - rad + L) / cell))
      const j1 = Math.min(N - 1, Math.ceil((cz + rad + L) / cell))
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const x = -L + (i + 0.5) * cell
          const z = -L + (j + 0.5) * cell
          const d = Math.hypot(x - cx, z - cz)
          if (d > rad) continue
          const h = profile(d)
          const k = j * N + i
          if (tmp[k] === 0) touched.push(k)
          if (h > tmp[k]) tmp[k] = h
        }
      }
    }
    if (s.kind === 'pool' && s.pool) {
      const { x, z, radius, thickness } = s.pool
      stamp(x, z, radius, (d) => thickness * Math.sqrt(Math.max(0, 1 - Math.pow(d / radius, 4))))
    } else {
      const p = s.points
      for (let i = 0; i < p.length; i += 4) {
        const r = p[i + 3]
        const rw = r * 1.7
        stamp(p[i], p[i + 2], rw, (d) => r * 0.8 * Math.sqrt(Math.max(0, 1 - (d / rw) ** 2)))
      }
    }
    for (const k of touched) {
      this.accum[k] += tmp[k]
      tmp[k] = 0
    }
  }

  /**
   * Finds the outer wall at a given angle and height — used to run sauce
   * drips down the side of the roll.
   */
  wallPoint(angle: number, y: number, out: THREE.Vector3): boolean {
    if (!this.bvh) return false
    const ca = Math.cos(angle)
    const sa = Math.sin(angle)
    const ray = new THREE.Ray(new THREE.Vector3(ca * 2, y, sa * 2), new THREE.Vector3(-ca, 0, -sa))
    const hit = this.bvh.raycastFirst(ray, THREE.DoubleSide)
    if (!hit) return false
    out.copy(hit.point)
    return true
  }
}

export const rollSurface = new RollSurface()

/** Random point on the roll top — used for "quick add" sprinkles. */
export function randomPointOnRoll(rng: () => number, margin = 0.06) {
  for (let tries = 0; tries < 30; tries++) {
    const a = rng() * Math.PI * 2
    const r = Math.sqrt(rng()) * 0.96
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (rollSurface.insideBy(x, z) > margin && rollSurface.heightAt(x, z) !== null) return { x, z }
  }
  return { x: 0, z: 0 }
}

