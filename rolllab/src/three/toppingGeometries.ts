import * as THREE from 'three'
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import type { ToppingShape } from '../types'
import { createNoise3D, createRng } from '../lib/noise'

/**
 * Procedural topping models, all built at unit size (≈1 unit across) and
 * scaled per piece. Each geometry carries a vertex-colour pattern (skins,
 * toasted edges…) which multiplies with the per-piece instance colour.
 */

function setColors(g: THREE.BufferGeometry, fn: (p: THREE.Vector3, n: THREE.Vector3) => [number, number, number]) {
  const pos = g.getAttribute('position')
  const nrm = g.getAttribute('normal')
  const col = new Float32Array(pos.count * 3)
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    if (nrm) n.fromBufferAttribute(nrm, i)
    const [r, gg, b] = fn(p, n)
    col[i * 3] = r
    col[i * 3 + 1] = gg
    col[i * 3 + 2] = b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

const white = (): [number, number, number] => [1, 1, 1]

function hull(points: THREE.Vector3[]) {
  const g = new ConvexGeometry(points)
  g.computeVertexNormals()
  return g
}

function chunk(seed: number, flat = 1) {
  const rng = createRng(seed)
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < 13; i++) {
    pts.push(new THREE.Vector3((rng() - 0.5) * 1, (rng() - 0.5) * 0.72 * flat, (rng() - 0.5) * 0.86))
  }
  return hull(pts)
}

function kernel() {
  const noise = createNoise3D(5)
  const g = new THREE.SphereGeometry(0.5, 18, 12)
  const pos = g.getAttribute('position')
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    const x = p.x * 1.0
    const taper = 1 - 0.18 * (x + 0.5)
    let y = p.y * 0.56 * taper
    const z = p.z * 0.62 * taper
    y += 0.22 * x * x // gentle banana curve
    const n = noise(p.x * 4, p.y * 4, p.z * 4) * 0.03
    pos.setXYZ(i, x + n, y + n, z + n)
  }
  g.computeVertexNormals()
  return setColors(g, (q) => {
    // purple-brown papery skin patches on one side and the tip
    const s = noise(q.x * 3 + 2, q.y * 3, q.z * 3) + (q.x > 0.32 ? 0.6 : 0) + (q.y > 0.12 ? 0.25 : 0)
    if (s > 0.55) return [0.82, 0.48, 0.58]
    if (s > 0.35) return [0.9, 0.75, 0.72]
    return [1, 1, 1]
  })
}

function shard(seed: number) {
  const g = chunk(seed, 0.26)
  return setColors(g, (_p, n) => (n.y > 0.7 ? [1.06, 1.04, 1.0] : [0.86, 0.8, 0.74]))
}

function chip() {
  const pts = [
    [0, 0],
    [0.46, 0],
    [0.5, 0.05],
    [0.47, 0.17],
    [0.36, 0.34],
    [0.22, 0.52],
    [0.1, 0.7],
    [0.03, 0.82],
    [0, 0.86],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const g = new THREE.LatheGeometry(pts, 16)
  g.translate(0, -0.3, 0)
  g.computeVertexNormals()
  return setColors(g, white)
}

function block() {
  const g = new RoundedBoxGeometry(1, 0.62, 0.82, 2, 0.12)
  const pos = g.getAttribute('position')
  const noise = createNoise3D(21)
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    const n = noise(p.x * 3, p.y * 3, p.z * 3) * 0.05
    pos.setXYZ(i, p.x + n, p.y + n * 0.5, p.z + n)
  }
  g.computeVertexNormals()
  return setColors(g, white)
}

function halfnut() {
  const rng = createRng(33)
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < 46; i++) {
    const u = rng() * Math.PI * 2
    const v = Math.acos(rng())
    pts.push(new THREE.Vector3(Math.sin(v) * Math.cos(u) * 0.5, Math.cos(v) * 0.46, Math.sin(v) * Math.sin(u) * 0.46))
  }
  for (let i = 0; i < 14; i++) {
    const u = (i / 14) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(u) * 0.5, 0, Math.sin(u) * 0.46))
  }
  const g = hull(pts)
  g.translate(0, -0.18, 0)
  return setColors(g, (_p, n) => (n.y < -0.85 ? [1.08, 1.05, 1.0] : [0.62, 0.45, 0.33]))
}

function flake() {
  // thin curved almond slice: top + bottom ellipse faces and a skin rim
  const seg = 22
  const top: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const th = 0.035
  const ax = 0.5
  const az = 0.32
  const bend = (x: number, z: number) => 0.14 * (x * x) / (ax * ax) * 0.5 + 0.05 * (z * z) / (az * az)
  // centre top (0), rim top (1..seg), centre bottom, rim bottom
  const pushV = (x: number, y: number, z: number, c: [number, number, number]) => {
    top.push(x, y, z)
    col.push(...c)
    return top.length / 3 - 1
  }
  const ct = pushV(0, th, 0, [1, 1, 1])
  const rimTop: number[] = []
  const rimBot: number[] = []
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2
    const x = Math.cos(a) * ax * (1 + 0.1 * Math.cos(a))
    const z = Math.sin(a) * az
    rimTop.push(pushV(x, th + bend(x, z), z, [0.8, 0.62, 0.46]))
  }
  const cb = pushV(0, -th, 0, [0.95, 0.92, 0.88])
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2
    const x = Math.cos(a) * ax * (1 + 0.1 * Math.cos(a))
    const z = Math.sin(a) * az
    rimBot.push(pushV(x, -th + bend(x, z), z, [0.68, 0.48, 0.34]))
  }
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg
    idx.push(ct, rimTop[j], rimTop[i])
    idx.push(cb, rimBot[i], rimBot[j])
    idx.push(rimTop[i], rimTop[j], rimBot[i], rimTop[j], rimBot[j], rimBot[i])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(top, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function sprinkle() {
  const g = new THREE.CapsuleGeometry(0.17, 0.78, 3, 8)
  g.rotateZ(Math.PI / 2)
  return setColors(g, white)
}

function shred() {
  const g = new THREE.BoxGeometry(1, 0.06, 0.24, 10, 1, 1)
  const pos = g.getAttribute('position')
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    const y = p.y + 0.35 * p.x * p.x
    const twist = p.x * 0.8
    const z = p.z * Math.cos(twist) - p.y * Math.sin(twist)
    pos.setXYZ(i, p.x, y + p.z * Math.sin(twist) * 0.3, z)
  }
  g.computeVertexNormals()
  const g2 = mergeVertices(g)
  g2.computeVertexNormals()
  return setColors(g2, (q) => {
    const t = Math.min(1, Math.abs(q.x) * 2)
    return [1 - t * 0.18, 1 - t * 0.3, 1 - t * 0.45]
  })
}

const cache = new Map<ToppingShape, THREE.BufferGeometry>()

export function toppingGeometry(shape: ToppingShape): THREE.BufferGeometry {
  const hit = cache.get(shape)
  if (hit) return hit
  let g: THREE.BufferGeometry
  switch (shape) {
    case 'chunk':
      g = setColors(chunk(7), (_p, n) => (n.y > 0.6 ? [1.05, 1.05, 1.05] : [0.9, 0.9, 0.9]))
      break
    case 'kernel':
      g = kernel()
      break
    case 'shard':
      g = shard(12)
      break
    case 'chip':
      g = chip()
      break
    case 'block':
      g = block()
      break
    case 'halfnut':
      g = halfnut()
      break
    case 'flake':
      g = flake()
      break
    case 'sprinkle':
      g = sprinkle()
      break
    case 'shred':
      g = shred()
      break
  }
  g.computeBoundingSphere()
  cache.set(shape, g)
  return g
}

/** How the piece rests on a surface (lift above the surface in unit size). */
export const restLift: Record<ToppingShape, number> = {
  chunk: 0.2,
  kernel: 0.22,
  shard: 0.08,
  chip: 0.28,
  block: 0.24,
  halfnut: 0.2,
  flake: 0.06,
  sprinkle: 0.14,
  shred: 0.1,
}

/** How freely a piece tumbles when it lands (0 = lies flat, 1 = any orientation). */
export const tumble: Record<ToppingShape, number> = {
  chunk: 0.9,
  kernel: 0.25,
  shard: 0.18,
  chip: 0.12,
  block: 0.35,
  halfnut: 0.6,
  flake: 0.16,
  sprinkle: 0.1,
  shred: 0.4,
}
