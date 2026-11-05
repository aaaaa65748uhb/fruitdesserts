import { catalog } from '../config/catalog'
import { createEmptyDesign } from '../engine/customization'
import { computeQuote } from '../engine/pricing'
import { uid } from '../lib/id'
import { createRng } from '../lib/noise'
import { nameOf } from '../i18n'
import { FLOW_RADIUS } from '../store/toolStore'
import type { Preset, RollDesign, SauceDrip, SauceStroke, ToppingBatch } from '../types'
import { spiralPath, zigzagPath } from './patterns'
import { poolVolume, strokeVolume } from './sauceGeometry'
import { rollSurface } from './surface'
import { scatterPieces } from './Topping3D'

/** Time between sauces when a chef's pick is poured in. */
export const PRESET_STEP_MS = 1100

function dripsForLine(points: number[], base: number, bornAt: number, rng: () => number): SauceDrip[] {
  const drips: SauceDrip[] = []
  for (let i = 0; i < points.length; i += 4) {
    const x = points[i]
    const z = points[i + 2]
    if (rollSurface.insideBy(x, z) > 0.055) continue
    const ang = Math.atan2(z, x)
    if (drips.some((d) => Math.abs(Math.atan2(Math.sin(d.angle - ang), Math.cos(d.angle - ang))) < 0.3)) continue
    if (rng() > 0.5) continue
    const edge = rollSurface.edgeAt(ang)
    drips.push({ angle: ang, radius: edge.r, top: Math.min(points[i + 1], edge.h + 0.02), length: 0.1 + rng() * 0.22, width: base * 0.8, bornAt: bornAt + 700 })
  }
  return drips
}

function dripsForPool(pool: { x: number; z: number; radius: number }, bornAt: number, rng: () => number): SauceDrip[] {
  const drips: SauceDrip[] = []
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2
    const x = pool.x + Math.cos(a) * pool.radius * 1.08
    const z = pool.z + Math.sin(a) * pool.radius * 1.08
    if (rollSurface.insideBy(x, z) > 0.02) continue
    const ang = Math.atan2(z, x)
    if (drips.some((d) => Math.abs(Math.atan2(Math.sin(d.angle - ang), Math.cos(d.angle - ang))) < 0.4)) continue
    if (rng() > 0.6) continue
    const edge = rollSurface.edgeAt(ang)
    drips.push({ angle: ang, radius: edge.r, top: edge.h, length: 0.14 + rng() * 0.24, width: 0.024 + rng() * 0.012, bornAt: bornAt + 900 })
  }
  return drips
}

/**
 * Builds a full RollDesign for a chef's pick: sauces are poured along the
 * same paths customers use, each one resting on the sauces before it, and
 * toppings are scattered over the roll.
 */
export function buildPresetDesign(preset: Preset, start = Date.now()): RollDesign {
  const rng = createRng(preset.id.length * 7919 + 13)
  const design = createEmptyDesign(preset.baseId, nameOf(preset))
  design.fillingId = preset.fillingId
  design.extras = [...preset.extras]

  const strokes: SauceStroke[] = []
  const saved = rollSurface.accum.slice()
  rollSurface.accum.fill(0)
  preset.sauces.forEach((ps, i) => {
    const bornAt = start + i * PRESET_STEP_MS
    const base = FLOW_RADIUS[ps.flow]
    if (ps.pattern === 'glaze') {
      const pool = { x: 0.03, z: 0.02, radius: 0.52, thickness: 0.03 }
      strokes.push({ id: uid('stroke'), sauceId: ps.sauceId, kind: 'pool', points: [], pool, drips: dripsForPool(pool, bornAt, rng), volume: poolVolume(pool.radius, pool.thickness), bornAt })
    } else {
      const path = ps.pattern === 'zigzag' ? zigzagPath(0, ps.angle ?? 0) : spiralPath()
      const points: number[] = []
      let k = 0
      let lx = Infinity
      let lz = Infinity
      for (let j = 0; j < path.length; j += 2) {
        const x = path[j]
        const z = path[j + 1]
        if (Math.hypot(x - lx, z - lz) < 0.012) continue
        const y = rollSurface.heightAt(x, z)
        if (y === null) continue
        points.push(x, y, z, base * (1 + 0.1 * Math.sin(k * 0.37) + 0.05 * Math.sin(k * 1.3)))
        lx = x
        lz = z
        k++
      }
      strokes.push({ id: uid('stroke'), sauceId: ps.sauceId, kind: 'line', points, drips: dripsForLine(points, base, bornAt, rng), volume: strokeVolume(points), bornAt })
    }
    // the next sauce rests on this one
    rollSurface.rebuildAccum(strokes, null)
  })
  rollSurface.accum.set(saved)

  const toppingStart = start + preset.sauces.length * PRESET_STEP_MS
  const toppings: ToppingBatch[] = preset.toppings.flatMap((pt, i) => {
    const t = catalog.toppings.find((x) => x.id === pt.toppingId)
    if (!t) return []
    const pieces = scatterPieces(t, Math.round(t.portion * pt.portions)).map((p) => ({ ...p, bornAt: p.bornAt + (toppingStart - Date.now()) + i * 500 }))
    return [{ id: uid('batch'), toppingId: t.id, pieces }]
  })
  design.sauces = strokes
  design.toppings = toppings
  return design
}

/** Price of a chef's pick, computed with the real pricing engine. */
export function presetPrice(preset: Preset) {
  if (!rollSurface.ready) return null
  return computeQuote(buildPresetDesign(preset)).total
}
