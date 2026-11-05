import * as THREE from 'three'
import { rollSurface } from './surface'
import type { SauceDrip } from '../types'

/**
 * Sauce geometry builders.
 *  - Drizzle lines: an elliptical (wider than tall) tube that follows the
 *    poured path, sits partly sunk into the surface and has rounded ends.
 *  - Glaze pools: a draped disc that follows the (smoothed) top and runs
 *    over the edge of the roll.
 *  - Drips: a tapered strand that follows the outer wall plus a bulb.
 */

const RAD = 14
const SPACING = 0.0095
const CAP_RINGS = 4

interface Sample {
  x: number
  y: number
  z: number
  r: number
}

function toSamples(points: number[]): Sample[] {
  const raw: Sample[] = []
  for (let i = 0; i < points.length; i += 4) raw.push({ x: points[i], y: points[i + 1], z: points[i + 2], r: points[i + 3] })
  if (raw.length === 0) return raw
  if (raw.length === 1) {
    const p = raw[0]
    return [p, { ...p, x: p.x + 0.004 }]
  }
  // light smoothing (positions and radius) to remove pointer jitter
  for (let it = 0; it < 2; it++) {
    for (let i = 1; i < raw.length - 1; i++) {
      const a = raw[i - 1]
      const b = raw[i]
      const c = raw[i + 1]
      b.x = b.x * 0.5 + (a.x + c.x) * 0.25
      b.z = b.z * 0.5 + (a.z + c.z) * 0.25
      b.y = Math.max(b.y, b.y * 0.4 + (a.y + c.y) * 0.3)
      b.r = b.r * 0.5 + (a.r + c.r) * 0.25
    }
  }
  // resample at uniform spacing
  const out: Sample[] = [raw[0]]
  let carry = 0
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1]
    const b = raw[i]
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    if (len < 1e-6) continue
    let t = SPACING - carry
    while (t <= len) {
      const f = t / len
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, r: a.r + (b.r - a.r) * f })
      t += SPACING
    }
    carry = len - (t - SPACING)
  }
  const last = raw[raw.length - 1]
  const tail = out[out.length - 1]
  if (Math.hypot(last.x - tail.x, last.z - tail.z) > SPACING * 0.3) out.push(last)
  if (out.length === 1) out.push({ ...out[0], x: out[0].x + 0.004 })
  return out
}

const _t = new THREE.Vector3()
const _s = new THREE.Vector3()
const _u = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/** Build the tube geometry for a drizzle line. */
export function buildStrokeGeometry(points: number[]): THREE.BufferGeometry | null {
  const samples = toSamples(points)
  if (samples.length < 2) return null
  const n = samples.length
  const ringCount = n + CAP_RINGS * 2
  const positions = new Float32Array((ringCount * RAD + 2) * 3)
  const normals = new Float32Array((ringCount * RAD + 2) * 3)
  let v = 0
  const prevS = new THREE.Vector3(1, 0, 0)

  const frames: { cx: number; cy: number; cz: number; rw: number; rh: number; s: THREE.Vector3; u: THREE.Vector3; t: THREE.Vector3 }[] = []
  for (let i = 0; i < n; i++) {
    const a = samples[Math.max(0, i - 1)]
    const b = samples[Math.min(n - 1, i + 1)]
    _t.set(b.x - a.x, b.y - a.y, b.z - a.z)
    if (_t.lengthSq() < 1e-10) _t.set(1, 0, 0)
    _t.normalize()
    // right-handed frame (side = tangent × up, up = side × tangent) so the
    // triangle winding always faces outward, whatever direction you pour in
    _s.crossVectors(_t, _up)
    if (_s.lengthSq() < 1e-6) _s.copy(prevS)
    _s.normalize()
    prevS.copy(_s)
    _u.crossVectors(_s, _t).normalize()
    const p = samples[i]
    const rw = p.r * 1.45
    const rh = p.r * 0.82
    frames.push({ cx: p.x, cy: p.y + rh * 0.3, cz: p.z, rw, rh, s: _s.clone(), u: _u.clone(), t: _t.clone() })
  }

  const writeRing = (f: (typeof frames)[number], scale: number, along: number, capNormalBlend: number, dir: number) => {
    for (let k = 0; k < RAD; k++) {
      const a = (k / RAD) * Math.PI * 2
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const ox = f.s.x * ca * f.rw * scale + f.u.x * sa * f.rh * scale + f.t.x * along
      const oy = f.s.y * ca * f.rw * scale + f.u.y * sa * f.rh * scale + f.t.y * along
      const oz = f.s.z * ca * f.rw * scale + f.u.z * sa * f.rh * scale + f.t.z * along
      positions[v * 3] = f.cx + ox
      positions[v * 3 + 1] = f.cy + oy
      positions[v * 3 + 2] = f.cz + oz
      let nx = (f.s.x * ca) / f.rw + (f.u.x * sa) / f.rh
      let ny = (f.s.y * ca) / f.rw + (f.u.y * sa) / f.rh
      let nz = (f.s.z * ca) / f.rw + (f.u.z * sa) / f.rh
      const nl = Math.hypot(nx, ny, nz) || 1
      nx /= nl
      ny /= nl
      nz /= nl
      nx = nx * (1 - capNormalBlend) + f.t.x * dir * capNormalBlend
      ny = ny * (1 - capNormalBlend) + f.t.y * dir * capNormalBlend
      nz = nz * (1 - capNormalBlend) + f.t.z * dir * capNormalBlend
      const nl2 = Math.hypot(nx, ny, nz) || 1
      normals[v * 3] = nx / nl2
      normals[v * 3 + 1] = ny / nl2
      normals[v * 3 + 2] = nz / nl2
      v++
    }
  }

  // start cap (from tip towards body)
  const f0 = frames[0]
  for (let c = CAP_RINGS; c >= 1; c--) {
    const phi = (c / (CAP_RINGS + 1)) * (Math.PI / 2)
    writeRing(f0, Math.cos(phi), -Math.sin(phi) * f0.rw * 0.7, Math.sin(phi), -1)
  }
  for (const f of frames) writeRing(f, 1, 0, 0, 1)
  const fl = frames[frames.length - 1]
  for (let c = 1; c <= CAP_RINGS; c++) {
    const phi = (c / (CAP_RINGS + 1)) * (Math.PI / 2)
    writeRing(fl, Math.cos(phi), Math.sin(phi) * fl.rw * 0.7, Math.sin(phi), 1)
  }
  // tip vertices
  const tipStart = v
  const tip = (f: (typeof frames)[number], dir: number) => {
    positions[v * 3] = f.cx + f.t.x * f.rw * 0.7 * dir
    positions[v * 3 + 1] = f.cy + f.t.y * f.rw * 0.7 * dir
    positions[v * 3 + 2] = f.cz + f.t.z * f.rw * 0.7 * dir
    normals[v * 3] = f.t.x * dir
    normals[v * 3 + 1] = f.t.y * dir
    normals[v * 3 + 2] = f.t.z * dir
    v++
  }
  tip(f0, -1)
  tip(fl, 1)

  const idx: number[] = []
  for (let r = 0; r < ringCount - 1; r++) {
    for (let k = 0; k < RAD; k++) {
      const a = r * RAD + k
      const b = r * RAD + ((k + 1) % RAD)
      const c = (r + 1) * RAD + k
      const d = (r + 1) * RAD + ((k + 1) % RAD)
      idx.push(a, c, b, b, c, d)
    }
  }
  for (let k = 0; k < RAD; k++) {
    idx.push(tipStart, k, (k + 1) % RAD)
    const lr = (ringCount - 1) * RAD
    idx.push(tipStart + 1, lr + ((k + 1) % RAD), lr + k)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

/** Approximate sauce volume of a polyline (x,y,z,r) — drives pricing. */
export function strokeVolume(points: number[]) {
  let v = 0
  for (let i = 4; i < points.length; i += 4) {
    const d = Math.hypot(points[i] - points[i - 4], points[i + 2] - points[i - 2])
    const r = (points[i + 3] + points[i - 1]) / 2
    v += Math.PI * r * 1.45 * r * 0.82 * d
  }
  if (points.length >= 4) v += (4 / 3) * Math.PI * points[3] ** 3
  return v
}

/* ------------------------------------------------------------------ */
/*  Glaze pool                                                         */
/* ------------------------------------------------------------------ */

export function buildPoolGeometry(pool: { x: number; z: number; radius: number; thickness: number }): THREE.BufferGeometry {
  const rings = 22
  const segs = 64
  const pos: number[] = []
  const idx: number[] = []
  const { x: cx, z: cz, radius, thickness } = pool
  const centerBase = rollSurface.smoothAt(cx, cz) ?? 0.6
  pos.push(cx, centerBase + thickness, cz)
  for (let r = 1; r <= rings; r++) {
    const rr = (r / rings) * radius
    const prof = thickness * Math.sqrt(Math.max(0, 1 - Math.pow(rr / radius, 4)))
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2
      // slightly irregular rim, like real poured glaze
      const wob = 1 + 0.07 * Math.sin(a * 3 + cx * 7) + 0.04 * Math.sin(a * 7 + cz * 11)
      let x = cx + Math.cos(a) * rr * wob
      let z = cz + Math.sin(a) * rr * wob
      const h = rollSurface.smoothAt(x, z)
      let y: number
      if (h !== null && rollSurface.insideBy(x, z) > 0.0) {
        y = h + prof + 0.004
      } else {
        // ran over the edge: hug the wall and slide down
        const ang = Math.atan2(z, x)
        const edge = rollSurface.edgeAt(ang)
        const over = Math.max(0, Math.hypot(x, z) - edge.r)
        const rad = edge.r + 0.012 + Math.min(over, 0.03) * 0.5
        x = Math.cos(ang) * rad
        z = Math.sin(ang) * rad
        y = Math.max(0.08, edge.h - over * 1.7 + prof * 0.4)
      }
      pos.push(x, y, z)
    }
  }
  for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s)
  for (let r = 0; r < rings - 1; r++) {
    for (let s = 0; s < segs; s++) {
      const a = 1 + r * segs + s
      const b = 1 + r * segs + ((s + 1) % segs)
      const c = 1 + (r + 1) * segs + s
      const d = 1 + (r + 1) * segs + ((s + 1) % segs)
      idx.push(a, b, c, b, d, c)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

export function poolVolume(radius: number, thickness: number) {
  return Math.PI * radius * radius * thickness * 0.7
}

/* ------------------------------------------------------------------ */
/*  Drips down the outer wall                                          */
/* ------------------------------------------------------------------ */

const DRIP_RINGS = 18
const DRIP_RAD = 10
const _w = new THREE.Vector3()

export interface DripMesh {
  geometry: THREE.BufferGeometry
  /** Centre line of the drip, top to bottom (roll-local). */
  path: THREE.Vector3[]
  bulbRadius: number
  ringIndexCount: number
}

export function buildDripGeometry(drip: SauceDrip): DripMesh | null {
  const pts: THREE.Vector3[] = []
  const ca = Math.cos(drip.angle)
  const sa = Math.sin(drip.angle)
  for (let i = 0; i <= DRIP_RINGS; i++) {
    const t = i / DRIP_RINGS
    const y = drip.top - 0.02 - t * drip.length
    if (!rollSurface.wallPoint(drip.angle, Math.max(0.03, y), _w)) {
      _w.set(ca * drip.radius, Math.max(0.03, y), sa * drip.radius)
    }
    const out = drip.width * 0.55
    pts.push(new THREE.Vector3(_w.x + ca * out, Math.max(0.03, y), _w.z + sa * out))
  }
  if (pts.length < 2) return null
  const positions: number[] = []
  const idx: number[] = []
  for (let i = 0; i < pts.length; i++) {
    const t = i / (pts.length - 1)
    const radius = drip.width * (1 - 0.45 * t)
    const tangent = (i < pts.length - 1 ? pts[i + 1].clone().sub(pts[i]) : pts[i].clone().sub(pts[i - 1])).normalize()
    const side = new THREE.Vector3(-sa, 0, ca)
    const nrm = new THREE.Vector3().crossVectors(side, tangent).normalize()
    for (let k = 0; k < DRIP_RAD; k++) {
      const a = (k / DRIP_RAD) * Math.PI * 2
      const off = side.clone().multiplyScalar(Math.cos(a) * radius * 1.25).add(nrm.clone().multiplyScalar(Math.sin(a) * radius * 0.75))
      positions.push(pts[i].x + off.x, pts[i].y + off.y, pts[i].z + off.z)
    }
  }
  for (let r = 0; r < pts.length - 1; r++) {
    for (let k = 0; k < DRIP_RAD; k++) {
      const a = r * DRIP_RAD + k
      const b = r * DRIP_RAD + ((k + 1) % DRIP_RAD)
      const c = (r + 1) * DRIP_RAD + k
      const d = (r + 1) * DRIP_RAD + ((k + 1) % DRIP_RAD)
      idx.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return { geometry: g, path: pts, bulbRadius: drip.width * 1.05, ringIndexCount: DRIP_RAD * 6 }
}
