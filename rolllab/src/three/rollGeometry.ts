import * as THREE from 'three'
import { clamp, createNoise3D, lerp, smoothstep } from '../lib/noise'

/**
 * Procedural cinnamon roll.
 *
 * A real roll is a sheet of dough rolled into a spiral. We reproduce that:
 * a rounded rectangular cross-section (the dough sheet seen edge-on) is swept
 * along an Archimedean spiral. Neighbouring turns touch, so the visible top is
 * a set of puffy crests separated by a groove where the filling shows.
 *
 * Besides the geometry we export per-vertex masks (crust, filling, bottom,
 * mottling) so the colours of any dough base can be painted in real time
 * without rebuilding the mesh.
 */

export const ROLL = {
  radius: 1,
  turns: 3.3,
  baseHeight: 0.52,
  dome: 0.2,
  segPerTurn: 180,
  profileSeg: 44,
  overlap: 1.24,
  squareness: 3.7, // superellipse exponent of the dough cross-section
}

export interface RollData {
  geometry: THREE.BufferGeometry
  crust: Float32Array
  fill: Float32Array
  bottom: Float32Array
  spot: Float32Array
  outer: Float32Array
  /** Spiral helpers — handy for "follow the swirl" sauce patterns. */
  pitch: number
  r0: number
  uMax: number
  width: number
}

export function buildRollGeometry(seed = 11): RollData {
  const noise = createNoise3D(seed)
  const n1 = (t: number, o: number) => noise(t, o, 0.37)

  const { radius: R, turns: T, baseHeight, dome, segPerTurn, profileSeg, overlap, squareness } = ROLL
  const pitch = (R - 0.014) / (T + overlap)
  const width = pitch * overlap
  const r0 = width * 0.42
  const uMax = T * Math.PI * 2

  const nu = Math.ceil(T * segPerTurn)
  const nv = profileSeg
  const spiralVerts = (nu + 1) * (nv + 1)
  const KR = 18 // knot rings
  const KS = 32 // knot segments
  const knotVerts = (KR + 1) * (KS + 1)
  const vertCount = spiralVerts + knotVerts

  const pos = new Float32Array(vertCount * 3)
  const uv = new Float32Array(vertCount * 2)
  const crust = new Float32Array(vertCount)
  const fill = new Float32Array(vertCount)
  const bottom = new Float32Array(vertCount)
  const spot = new Float32Array(vertCount)
  const outer = new Float32Array(vertCount)

  // Pre-compute the superellipse profile (seam at the hidden bottom centre).
  const prof: [number, number][] = []
  const e = 2 / squareness
  for (let j = 0; j <= nv; j++) {
    const v = -Math.PI / 2 + (j / nv) * Math.PI * 2
    const c = Math.cos(v)
    const s = Math.sin(v)
    prof.push([Math.sign(c) * Math.pow(Math.abs(c), e), Math.sign(s) * Math.pow(Math.abs(s), e)])
  }

  let arc = 0
  let prevX = 0
  let prevZ = 0
  const outerStart = uMax - Math.PI * 2

  for (let i = 0; i <= nu; i++) {
    const u = (i / nu) * uMax
    const r = r0 + (pitch * u) / (Math.PI * 2)

    // Ends: the centre curls in, the outer end thins into a flap that hugs the roll.
    const startT = smoothstep(0, 1.1, u)
    const flap = 1 - smoothstep(uMax - 1.6, uMax, u)
    const capEnd = Math.sqrt(clamp((uMax - u) / 0.09, 0, 1))
    const capStart = Math.sqrt(clamp(u / 0.09, 0, 1))
    const cap = Math.min(capEnd, capStart)

    const wScale = lerp(0.42, 1, flap) * (1 + 0.035 * n1(u * 0.9, 3.1))
    const wi = width * wScale
    // keep the inner edge of the flap glued to the previous turn
    const rc = r - (width - width * lerp(0.42, 1, flap)) / 2

    // the first turn has no layer inside it: let its inner side curl all the way into the centre
    const innerFill = (Math.max(0, rc - wi / 2) + 0.04) * (1 - smoothstep(Math.PI * 1.55, Math.PI * 2.05, u))

    const hScale = lerp(0.9, 1, flap) * lerp(1.03, 1, startT)

    const cu = Math.cos(u)
    const su = Math.sin(u)
    const dr = pitch / (Math.PI * 2)
    let tx = dr * cu - rc * su
    let tz = dr * su + rc * cu
    const tl = Math.hypot(tx, tz) || 1
    tx /= tl
    tz /= tl
    const nx = tz
    const nz = -tx

    const cx0 = rc * cu
    const cz0 = rc * su
    if (i > 0) arc += Math.hypot(cx0 - prevX, cz0 - prevZ)
    prevX = cx0
    prevZ = cz0

    const outerMaskU = smoothstep(outerStart - 0.35, outerStart + 0.35, u)

    for (let j = 0; j <= nv; j++) {
      const k = i * (nv + 1) + j
      const [px, py] = prof[j]
      const lx = px * (px < 0 ? wi / 2 + innerFill : wi / 2) * cap
      // height follows the vertex's own radius so neighbouring layers meet in one smooth dome
      const vx = cx0 + nx * lx
      const vz = cz0 + nz * lx
      const rv = Math.hypot(vx, vz)
      const hv = (baseHeight + dome * (1 - Math.pow(clamp(rv / R, 0, 1), 2))) * hScale * (1 + 0.03 * noise(vx * 1.3, 3.3, vz * 1.3))
      const crown = Math.max(0, py) * (1 - px * px) * 0.045 * hv
      const ly = hv / 2 + py * cap * (hv / 2) + crown * cap

      let x = cx0 + nx * lx
      let y = ly
      let z = cz0 + nz * lx

      // Organic irregularity — mostly on the top, less on touching sides.
      const top = Math.max(0, py)
      const dispW = smoothstep(0.0, 0.1, y) * (0.35 + 0.65 * top)
      const d =
        (noise(x * 2.1, y * 2.1, z * 2.1) * 0.024 + noise(x * 6.3 + 4, y * 6.3, z * 6.3) * 0.009 + noise(x * 15, y * 15, z * 15 + 7) * 0.003) *
        dispW
      const dl = Math.hypot(px * 0.8, py) || 1
      x += nx * (px * 0.8 / dl) * d
      z += nz * (px * 0.8 / dl) * d
      y += (py / dl) * d
      if (y < 0) y = 0

      pos[k * 3] = x
      pos[k * 3 + 1] = y
      pos[k * 3 + 2] = z
      uv[k * 2] = arc * 2.2
      uv[k * 2 + 1] = (j / nv) * 1.9

      // ---- paint masks ----
      const side = smoothstep(0.62, 0.93, Math.abs(px))
      const outerFace = outerMaskU * smoothstep(0.15, 0.6, px)
      const bot = smoothstep(-0.5, -0.97, py)
      const hNorm = clamp(y / (baseHeight + dome), 0, 1)
      const mott = noise(x * 9, y * 9, z * 9) * 0.5 + 0.5
      const fl = side * (1 - outerFace) * (1 - smoothstep(0.9, 1.0, py)) * (1 - bot * 0.7)
      const crest = 1 - 0.7 * smoothstep(0.25, 0.85, Math.abs(px))
      let cr = 0.12 + 0.8 * smoothstep(0.35, 0.98, py) * crest * (0.7 + 0.3 * hNorm) + 0.45 * outerFace * (1 - bot)
      cr += (mott - 0.5) * 0.35 * smoothstep(0.2, 0.9, py)
      // the very end of the flap and the centre curl bake darker
      cr += (1 - flap) * 0.18 + (1 - startT) * 0.12
      crust[k] = clamp(cr, 0, 1)
      fill[k] = clamp(fl, 0, 1)
      bottom[k] = bot
      spot[k] = mott
      outer[k] = outerFace
    }
  }

  // Centre knot — the tucked-in start of the dough sheet closes the middle.
  {
    const a = width * 0.6
    const ht = (baseHeight + dome) * 0.99
    const kx = r0 * 0.35
    const kz = -r0 * 0.15
    for (let i = 0; i <= KR; i++) {
      const th = (i / KR) * Math.PI
      for (let j = 0; j <= KS; j++) {
        const ph = (j / KS) * Math.PI * 2
        const k = spiralVerts + i * (KS + 1) + j
        const sx = Math.sin(th) * Math.cos(ph)
        const sz = Math.sin(th) * Math.sin(ph)
        const cy = Math.cos(th)
        let x = kx + sx * a
        let z = kz + sz * a
        let y = ht / 2 + (cy * ht) / 2
        const d = noise(x * 6, y * 6, z * 6) * 0.018 * Math.max(0, cy)
        x += sx * d
        z += sz * d
        y += cy * d
        pos[k * 3] = x
        pos[k * 3 + 1] = Math.max(0, y)
        pos[k * 3 + 2] = z
        uv[k * 2] = (j / KS) * 1.5
        uv[k * 2 + 1] = (i / KR) * 0.8
        const mott = noise(x * 9, y * 9, z * 9) * 0.5 + 0.5
        crust[k] = clamp(0.35 + 0.5 * smoothstep(0.1, 0.9, cy) + (mott - 0.5) * 0.3, 0, 1)
        fill[k] = 0
        bottom[k] = smoothstep(-0.5, -0.95, cy)
        spot[k] = mott
        outer[k] = 0
      }
    }
  }

  // "Pan press": real rolls bake snug in a round pan, so the snail-shaped
  // outline of a pure spiral is gently pushed out to a near-round edge.
  const BINS = 360
  const outerR = new Float32Array(BINS)
  for (let k = 0; k < vertCount; k++) {
    const x = pos[k * 3]
    const z = pos[k * 3 + 2]
    if (pos[k * 3 + 1] < 0.08) continue
    const b = Math.floor(((Math.atan2(z, x) / (Math.PI * 2) + 1) % 1) * BINS) % BINS
    const r = Math.hypot(x, z)
    if (r > outerR[b]) outerR[b] = r
  }
  // smooth the outline so the press doesn't follow tiny bumps
  const smoothR = new Float32Array(BINS)
  for (let b = 0; b < BINS; b++) {
    let acc = 0
    for (let d = -12; d <= 12; d++) acc += outerR[(b + d + BINS) % BINS]
    smoothR[b] = acc / 25
  }
  const targetR = R * 0.955
  for (let k = 0; k < vertCount; k++) {
    const x = pos[k * 3]
    const z = pos[k * 3 + 2]
    const r = Math.hypot(x, z)
    if (r < 1e-5) continue
    const f = ((Math.atan2(z, x) / (Math.PI * 2) + 1) % 1) * BINS
    const b0 = Math.floor(f) % BINS
    const b1 = (b0 + 1) % BINS
    const o = smoothR[b0] + (smoothR[b1] - smoothR[b0]) * (f - Math.floor(f))
    const sc = targetR / Math.max(0.5, o)
    const w = Math.pow(clamp(r / o, 0, 1.2), 1.6)
    const k2 = 1 + (sc - 1) * w * 0.92
    pos[k * 3] = x * k2
    pos[k * 3 + 2] = z * k2
  }

  const idx: number[] = []
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j
      const b = (i + 1) * (nv + 1) + j
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }

  for (let i = 0; i < KR; i++) {
    for (let j = 0; j < KS; j++) {
      const a = spiralVerts + i * (KS + 1) + j
      const b = spiralVerts + (i + 1) * (KS + 1) + j
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertCount * 3).fill(1), 3))
  geometry.setIndex(idx)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()

  return { geometry, crust, fill, bottom, spot, outer, pitch, r0, uMax, width }
}

/* ------------------------------------------------------------------ */

export interface RollPaint {
  dough: THREE.Color
  crust: THREE.Color
  bottom: THREE.Color
  filling: THREE.Color
  /** 0..1 how generous / visible the filling is */
  fillStrength: number
}

const _c = new THREE.Color()
const _d = new THREE.Color()

/** Writes vertex colours for a dough base onto the roll geometry. */
export function paintRoll(data: RollData, paint: RollPaint) {
  const attr = data.geometry.getAttribute('color') as THREE.BufferAttribute
  const arr = attr.array as Float32Array
  const n = data.crust.length
  for (let i = 0; i < n; i++) {
    _c.copy(paint.dough).lerp(paint.crust, data.crust[i])
    _c.lerp(paint.bottom, data.bottom[i] * 0.85)
    const f = data.fill[i] * paint.fillStrength
    if (f > 0.001) {
      _d.copy(paint.filling)
      _c.lerp(_d, f)
    }
    const m = 0.9 + 0.2 * data.spot[i]
    arr[i * 3] = _c.r * m
    arr[i * 3 + 1] = _c.g * m
    arr[i * 3 + 2] = _c.b * m
  }
  attr.needsUpdate = true
}
