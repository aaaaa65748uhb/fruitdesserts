import { catalog, findBase, findExtra, findFilling, findSauce, findTopping } from '../config/catalog'
import type { Catalog, RollDesign } from '../types'
import { uid } from '../lib/id'
import { nameOf, tr, type Lang, currentLang } from '../i18n'

/**
 * CustomizationEngine — pure helpers that read or validate a RollDesign.
 * The 3D scene and UI never compute business rules themselves; they ask here.
 */

export function createEmptyDesign(baseId = catalog.bases[0].id, name = ''): RollDesign {
  return { id: uid('roll'), name, baseId, fillingId: null, sauces: [], toppings: [], extras: [] }
}

/** Sauce ids in order of first use. */
export function usedSauceIds(design: RollDesign): string[] {
  const out: string[] = []
  for (const s of design.sauces) if (!out.includes(s.sauceId)) out.push(s.sauceId)
  return out
}

/** Topping ids (with at least one piece) in order of first use. */
export function usedToppingIds(design: RollDesign): string[] {
  const out: string[] = []
  for (const b of design.toppings) if (b.pieces.length > 0 && !out.includes(b.toppingId)) out.push(b.toppingId)
  return out
}

export function sauceVolume(design: RollDesign, sauceId: string) {
  let v = 0
  for (const s of design.sauces) if (s.sauceId === sauceId) v += s.volume
  return v
}

export function toppingCount(design: RollDesign, toppingId: string) {
  let n = 0
  for (const b of design.toppings) if (b.toppingId === toppingId) n += b.pieces.length
  return n
}

export function saucePortions(design: RollDesign, sauceId: string, cat: Catalog = catalog) {
  return sauceVolume(design, sauceId) / cat.pricing.saucePortionVolume
}

export function toppingPortions(design: RollDesign, toppingId: string, cat: Catalog = catalog) {
  const t = cat.toppings.find((x) => x.id === toppingId)
  if (!t) return 0
  return toppingCount(design, toppingId) / t.portion
}

export type AmountLevel = 'light' | 'regular' | 'extra'

export function amountLevel(portions: number, extraThreshold: number): AmountLevel {
  if (portions >= extraThreshold) return 'extra'
  if (portions < 0.45) return 'light'
  return 'regular'
}

export type LimitCheck = { ok: true } | { ok: false; reason: string }

export function canUseSauce(design: RollDesign, sauceId: string, cat: Catalog = catalog): LimitCheck {
  const used = usedSauceIds(design)
  if (used.includes(sauceId)) return { ok: true }
  if (used.length >= cat.limits.maxSauces) return { ok: false, reason: tr().limitSauces(cat.limits.maxSauces) }
  return { ok: true }
}

export function canUseTopping(design: RollDesign, toppingId: string, cat: Catalog = catalog): LimitCheck {
  const used = usedToppingIds(design)
  const t = cat.toppings.find((x) => x.id === toppingId)
  if (!t) return { ok: false, reason: 'Unknown topping.' }
  if (used.includes(toppingId)) {
    if (toppingCount(design, toppingId) >= t.maxPieces) return { ok: false, reason: tr().maxOf(nameOf(t)) }
    return { ok: true }
  }
  if (used.length >= cat.limits.maxToppings) return { ok: false, reason: tr().limitToppings(cat.limits.maxToppings) }
  return { ok: true }
}

export function isDesignEmpty(design: RollDesign) {
  return !design.fillingId && design.sauces.length === 0 && usedToppingIds(design).length === 0 && design.extras.length === 0
}

/** Human readable one-liner, used in the cart and the order message. */
export function summarizeDesign(design: RollDesign, cat: Catalog = catalog, lang: Lang = currentLang()): string {
  const t = tr()
  const extraWord = t.levels.extra.toLowerCase()
  const parts: string[] = [nameOf(findBase(design.baseId), lang)]
  const filling = findFilling(design.fillingId)
  if (filling) parts.push(nameOf(filling, lang))
  const sauces = usedSauceIds(design)
    .map((id) => {
      const s = findSauce(id)
      if (!s) return null
      const lvl = amountLevel(saucePortions(design, id, cat), cat.pricing.sauceExtraThreshold)
      return lvl === 'extra' ? `${nameOf(s, lang)} (${extraWord})` : nameOf(s, lang)
    })
    .filter(Boolean)
  if (sauces.length) parts.push(sauces.join(', '))
  const tops = usedToppingIds(design)
    .map((id) => {
      const tp = findTopping(id)
      if (!tp) return null
      const lvl = amountLevel(toppingPortions(design, id, cat), cat.pricing.toppingExtraThreshold)
      return lvl === 'extra' ? `${nameOf(tp, lang)} (${extraWord})` : nameOf(tp, lang)
    })
    .filter(Boolean)
  if (tops.length) parts.push(tops.join(', '))
  const extras = design.extras.map((e) => nameOf(findExtra(e), lang)).filter(Boolean)
  if (extras.length) parts.push(extras.join(', '))
  return parts.join(' · ')
}

/** Deep-ish copy used when a cart item is re-opened for editing. */
export function cloneDesign(design: RollDesign): RollDesign {
  return JSON.parse(JSON.stringify(design)) as RollDesign
}
