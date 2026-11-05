import { describe, expect, it } from 'vitest'
import { catalog } from '../config/catalog'
import { dictionaries } from './strings'
import { nameOf, shortOf } from './index'

describe('Hebrew translation', () => {
  it('covers every catalog item', () => {
    const groups = [catalog.bases, catalog.sauces, catalog.toppings, catalog.fillings, catalog.extras, catalog.presets]
    for (const g of groups) {
      for (const item of g) {
        expect(item.he?.name, `${item.id} needs a Hebrew name`).toBeTruthy()
        expect(item.he?.description, `${item.id} needs a Hebrew description`).toBeTruthy()
        expect(nameOf(item, 'he')).toMatch(/[֐-׿]/)
      }
    }
  })
  it('falls back to English names when asked', () => {
    expect(nameOf(catalog.bases[0], 'en')).toBe('Classic Cinnamon')
    expect(shortOf(catalog.fillings[0], 'en')).toBe('Pistachio')
    expect(shortOf(catalog.fillings[0], 'he')).toBe('פיסטוק')
  })
  it('has every dictionary entry in both languages', () => {
    const en = dictionaries.en as Record<string, unknown>
    const he = dictionaries.he as Record<string, unknown>
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort())
    for (const [k, v] of Object.entries(he)) {
      if (typeof v === 'string' && !['switchTo', 'dir', 'langName'].includes(k)) expect(v.length, k).toBeGreaterThan(0)
    }
    expect(he.dir).toBe('rtl')
  })
})
