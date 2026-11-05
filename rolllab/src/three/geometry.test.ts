import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildRollGeometry } from './rollGeometry'
import { rollSurface } from './surface'
import { buildPoolGeometry, buildStrokeGeometry, strokeVolume } from './sauceGeometry'

const roll = buildRollGeometry()
rollSurface.build(roll.geometry)

function faceStats(g: THREE.BufferGeometry, outward: (centroid: THREE.Vector3, normal: THREE.Vector3) => number) {
  const p = g.getAttribute('position')
  const idx = g.index!
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const n = new THREE.Vector3()
  let good = 0
  let bad = 0
  for (let t = 0; t < idx.count; t += 3) {
    a.fromBufferAttribute(p, idx.getX(t))
    b.fromBufferAttribute(p, idx.getX(t + 1))
    c.fromBufferAttribute(p, idx.getX(t + 2))
    n.subVectors(b, a).cross(c.clone().sub(a))
    if (n.lengthSq() < 1e-16) continue
    n.normalize()
    const s = outward(a.clone().add(b).add(c).divideScalar(3), n)
    if (s > 0.2) good++
    else if (s < -0.2) bad++
  }
  return { good, bad }
}

describe('cinnamon roll mesh', () => {
  it('has outward-facing top surfaces', () => {
    const s = faceStats(roll.geometry, (cen, n) => (cen.y > 0.55 ? n.y : 0))
    expect(s.bad / (s.good + s.bad)).toBeLessThan(0.06)
  })
  it('has a closed centre and a round outline', () => {
    expect(rollSurface.baseAt(0, 0)).not.toBeNull()
    let holes = 0
    for (let z = -0.4; z <= 0.4; z += 0.02) for (let x = -0.4; x <= 0.4; x += 0.02) if (rollSurface.baseAt(x, z) === null) holes++
    expect(holes).toBe(0)
    const radii = Array.from(rollSurface.edgeR)
    expect(Math.min(...radii)).toBeGreaterThan(0.85)
    expect(Math.max(...radii)).toBeLessThan(1.12)
  })
  it('is domed: centre higher than the rim', () => {
    expect(rollSurface.baseAt(0.05, 0.05)!).toBeGreaterThan(rollSurface.baseAt(0.8, 0)!)
  })
})

describe('sauce geometry', () => {
  it.each([
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.7, 0.7],
    [-0.7, 0.6],
  ])('drizzle heading %s,%s faces outward', (dx, dz) => {
    const pts: number[] = []
    for (let k = 0; k < 30; k++) pts.push(dx * k * 0.02, 0.6, dz * k * 0.02, 0.02)
    const g = buildStrokeGeometry(pts)!
    const s = faceStats(g, (m, n) => {
      const t = Math.max(0, Math.min(29 * 0.02, m.x * dx + m.z * dz))
      return n.dot(m.clone().sub(new THREE.Vector3(dx * t, 0.6 + 0.02 * 0.62 * 0.25, dz * t)).normalize())
    })
    expect(s.bad / (s.good + s.bad)).toBeLessThan(0.08)
  })
  it('glaze pool faces up', () => {
    const s = faceStats(buildPoolGeometry({ x: 0.1, z: 0.1, radius: 0.4, thickness: 0.03 }), (_c, n) => n.y)
    expect(s.bad).toBe(0)
  })
  it('measures more volume for longer, thicker lines', () => {
    const line = (r: number, n: number) => Array.from({ length: n }, (_, k) => [k * 0.02, 0.6, 0, r]).flat()
    expect(strokeVolume(line(0.02, 40))).toBeGreaterThan(strokeVolume(line(0.02, 20)))
    expect(strokeVolume(line(0.03, 20))).toBeGreaterThan(strokeVolume(line(0.02, 20)))
  })
})
