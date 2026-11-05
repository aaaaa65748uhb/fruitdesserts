import { catalog } from '../config/catalog'

/**
 * Counter layout.
 *
 *  WIDE (desktop / landscape tablets) — follows the reference composition:
 *    top:    squeeze bottles flanking the open lid
 *    centre: the open branded box with the roll
 *    left:   six ingredient trays          right: four trays + extras
 *    front:  filling ramekins              bottom: HTML controls
 *
 *  TALL (phones / portrait tablets) — same physical counter, re-stacked:
 *    box → bottle row → tray rows → ramekins → extras
 */

export interface Slot {
  x: number
  z: number
  scale: number
}

export interface CounterLayout {
  mode: 'wide' | 'tall'
  box: Slot
  bottles: Record<string, Slot>
  trays: Record<string, Slot>
  ramekins: Record<string, Slot>
  extras: Record<string, Slot>
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  /** Camera elevation in degrees for the overview. */
  elevation: number
}

const s = (x: number, z: number, scale = 1): Slot => ({ x, z, scale })

const LEFT_TRAYS = ['chopped-pistachio', 'chocolate-chips', 'cookie-crumbs', 'almond-flakes', 'hazelnut', 'coconut']
const RIGHT_TRAYS = ['whole-pistachio', 'lotus-crumbs', 'white-chocolate', 'sprinkles']

export function wideLayout(): CounterLayout {
  const bottles: Record<string, Slot> = {}
  const sauceIds = catalog.sauces.map((x) => x.id)
  const half = Math.ceil(sauceIds.length / 2)
  sauceIds.forEach((id, i) => {
    const left = i < half
    const k = left ? i : i - half
    const x = left ? -4.55 + k * 0.8 : 2.15 + k * 0.8
    bottles[id] = s(x, -2.3)
  })

  const trays: Record<string, Slot> = {}
  const tx = [-4.25, -2.95]
  const tz = [-1.2, 0.12, 1.44]
  const orderedLeft = LEFT_TRAYS.filter((id) => catalog.toppings.some((t) => t.id === id))
  const orderedRight = [
    ...RIGHT_TRAYS.filter((id) => catalog.toppings.some((t) => t.id === id)),
    ...catalog.toppings.map((t) => t.id).filter((id) => !LEFT_TRAYS.includes(id) && !RIGHT_TRAYS.includes(id)),
  ]
  orderedLeft.forEach((id, i) => (trays[id] = s(tx[i % 2], tz[Math.floor(i / 2)] ?? 2.3)))
  orderedRight.forEach((id, i) => (trays[id] = s([2.95, 4.25][i % 2], [-1.2, 0.12, 1.44][Math.floor(i / 2)] ?? 2.7)))

  const ramekins: Record<string, Slot> = {}
  const nF = catalog.fillings.length
  catalog.fillings.forEach((f, i) => (ramekins[f.id] = s((i - (nF - 1) / 2) * 0.9, 2.15)))

  const extras: Record<string, Slot> = {}
  catalog.extras.forEach((e, i) => (extras[e.id] = s(2.6 + (i % 2) * 1.3, 1.5 + Math.floor(i / 2) * 0.95 + (orderedRight.length > 4 ? 1.32 : 0))))

  return {
    mode: 'wide',
    box: s(0, 0.15),
    bottles,
    trays,
    ramekins,
    extras,
    bounds: { minX: -4.95, maxX: 4.95, minZ: -2.65, maxZ: 2.95 },
    elevation: 58,
  }
}

export function tallLayout(): CounterLayout {
  const bottles: Record<string, Slot> = {}
  const nS = catalog.sauces.length
  catalog.sauces.forEach((sc, i) => (bottles[sc.id] = s((i - (nS - 1) / 2) * 0.68, 0.95, 0.86)))

  const trays: Record<string, Slot> = {}
  const ids = [...LEFT_TRAYS, ...RIGHT_TRAYS, ...catalog.toppings.map((t) => t.id)].filter(
    (id, i, a) => a.indexOf(id) === i && catalog.toppings.some((t) => t.id === id),
  )
  ids.forEach((id, i) => {
    const row = Math.floor(i / 5)
    const col = i % 5
    trays[id] = s((col - 2) * 1.12, 1.95 + row * 1.22, 0.9)
  })
  const trayRows = Math.ceil(ids.length / 5)
  const rz = 1.95 + trayRows * 1.22 - 0.1

  const ramekins: Record<string, Slot> = {}
  const nF = catalog.fillings.length
  catalog.fillings.forEach((f, i) => (ramekins[f.id] = s((i - (nF - 1) / 2) * 0.98, rz, 0.95)))

  const extras: Record<string, Slot> = {}
  const nE = catalog.extras.length
  catalog.extras.forEach((e, i) => (extras[e.id] = s((i - (nE - 1) / 2) * 1.05, rz + 1.0, 0.95)))

  return {
    mode: 'tall',
    box: s(0, -1.2),
    bottles,
    trays,
    ramekins,
    extras,
    bounds: { minX: -2.9, maxX: 2.9, minZ: -3.3, maxZ: rz + 1.45 },
    elevation: 66,
  }
}

export function layoutFor(aspect: number): CounterLayout {
  return aspect >= 1.05 ? wideLayout() : tallLayout()
}
