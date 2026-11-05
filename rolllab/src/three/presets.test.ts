import { describe, expect, it } from 'vitest'
import { catalog } from '../config/catalog'
import { computeQuote } from '../engine/pricing'
import { buildRollGeometry } from './rollGeometry'
import { rollSurface } from './surface'
import { runtime } from './runtime'
import { buildPresetDesign } from './presets'

const roll = buildRollGeometry()
rollSurface.build(roll.geometry)
runtime.rollData = roll

describe("chef's picks", () => {
  it.each(catalog.presets.map((p) => [p.id, p] as const))('%s builds a valid roll', (_id, preset) => {
    const ids = (arr: { id: string }[]) => arr.map((x) => x.id)
    expect(ids(catalog.bases)).toContain(preset.baseId)
    if (preset.fillingId) expect(ids(catalog.fillings)).toContain(preset.fillingId)
    preset.sauces.forEach((s) => expect(ids(catalog.sauces)).toContain(s.sauceId))
    preset.toppings.forEach((t) => expect(ids(catalog.toppings)).toContain(t.toppingId))
    expect(preset.sauces.length).toBeLessThanOrEqual(catalog.limits.maxSauces)
    expect(preset.toppings.length).toBeLessThanOrEqual(catalog.limits.maxToppings)

    const d = buildPresetDesign(preset)
    expect(d.sauces).toHaveLength(preset.sauces.length)
    for (const s of d.sauces) {
      expect(s.volume).toBeGreaterThan(0)
      if (s.kind === 'line') expect(s.points.length / 4).toBeGreaterThan(80)
    }
    for (const b of d.toppings) expect(b.pieces.length).toBeGreaterThan(5)
    // the advertised price is the plain sum of its parts — no hidden extra-portion charges
    const q = computeQuote(d)
    expect(q.surcharges).toBe(0)
    expect(q.total).toBeGreaterThan(0)
  })
  it('does not disturb the sauce already on the counter', () => {
    rollSurface.accum.fill(0.01)
    buildPresetDesign(catalog.presets[0])
    expect(rollSurface.accum.every((v) => Math.abs(v - 0.01) < 1e-9)).toBe(true)
    rollSurface.accum.fill(0)
  })
})
