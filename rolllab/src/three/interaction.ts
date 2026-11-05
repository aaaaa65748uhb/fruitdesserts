import * as THREE from 'three'
import type { RootState, ThreeEvent } from '@react-three/fiber'
import { catalog, findFilling, findSauce, findTopping } from '../config/catalog'
import { canUseSauce, canUseTopping, toppingCount } from '../engine/customization'
import { useBuilder } from '../store/builderStore'
import { FLOW_RADIUS, SPREAD_SIGMA, useTool, type Hovered, type ToolKind } from '../store/toolStore'
import { useUI } from '../store/uiStore'
import { sfx, startPour, stopPour } from '../lib/audio'
import { clamp, createRng, gaussian } from '../lib/noise'
import { uid } from '../lib/id'
import type { SauceDrip, ToppingPiece } from '../types'
import { rollSurface } from './surface'
import { runtime, useRuntime } from './runtime'
import { poolVolume, strokeVolume } from './sauceGeometry'
import { makePiece } from './Topping3D'

/**
 * InteractionEngine — turns pointer input into physical actions:
 *   pick up → carry → press & hold on the roll to pour / sprinkle → release.
 *
 * Works the same with mouse, pen and touch. Shelf objects call into this
 * module from their R3F event handlers; the per-frame `update` runs inside
 * the canvas (see InteractionController).
 */

type PressKind = 'none' | 'pour' | 'sprinkle' | 'spin' | 'carry' | 'filling'

const NOZZLE_HEIGHT = 0.95
const SCOOP_HEIGHT = 0.78
const BAG_HEIGHT = 0.62
const SYNC_MS = 110
const AUTO_SPEED = 1.45 // units / second along auto patterns

const st = {
  press: 'none' as PressKind,
  pressX: 0,
  pressY: 0,
  pressT: 0,
  moved: 0,
  lastClientX: 0,
  lastMoveT: 0,
  strokeId: null as string | null,
  batchId: null as string | null,
  lastSync: 0,
  lastPointT: 0,
  pattern: null as null | { path: number[]; length: number; travelled: number; seg: number; segT: number },
  sprinkleAcc: 0,
  sprinkleTicks: 0,
  limitWarned: false,
  overRoll: false,
  hit: new THREE.Vector3(),
  hitLocal: new THREE.Vector3(),
  plane: new THREE.Vector3(),
  contactLocal: new THREE.Vector3(),
  contactValid: false,
  fillingId: null as string | null,
  rng: createRng(1234),
}

const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _v = new THREE.Vector3()
const _w = new THREE.Vector3()

function toast(text: string) {
  useUI.getState().showToast(text, 'warn')
  sfx.nope()
}

/* ------------------------------------------------------------------ */
/*  Shelf handlers                                                     */
/* ------------------------------------------------------------------ */

function canInteract() {
  const ui = useUI.getState()
  return ui.screen === 'build' && !ui.inspect && ui.packPhase === 'idle'
}

function beginPress(e: ThreeEvent<PointerEvent>, kind: PressKind) {
  st.press = kind
  st.pressX = e.nativeEvent.clientX
  st.pressY = e.nativeEvent.clientY
  st.lastClientX = e.nativeEvent.clientX
  st.pressT = performance.now()
  st.moved = 0
}

function pick(e: ThreeEvent<PointerEvent>, kind: ToolKind, id: string) {
  e.stopPropagation()
  if (!canInteract()) return
  if (e.nativeEvent.button === 2) return
  const tool = useTool.getState()
  const design = useBuilder.getState().design
  if (tool.held && tool.held.kind === kind && tool.held.id === id) {
    tool.putBack()
    sfx.drop()
    return
  }
  if (kind === 'sauce') {
    const ok = canUseSauce(design, id)
    if (!ok.ok) return toast(ok.reason)
  }
  if (kind === 'topping') {
    const ok = canUseTopping(design, id)
    if (!ok.ok) return toast(ok.reason)
  }
  if (tool.held) tool.putBack()
  tool.pickUp({ kind, id })
  // start the carried object at the slot it came from
  runtime.held.target.copy(e.point).setY(1.0)
  beginPress(e, kind === 'filling' ? 'filling' : 'carry')
  if (kind === 'filling') st.fillingId = id
  sfx.pick()
  useUI.getState().setHint(null)
}

function toggleFilling(id: string) {
  const b = useBuilder.getState()
  const f = findFilling(id)
  if (b.design.fillingId === id) {
    b.setFilling(null)
    useUI.getState().showToast(`${f?.name ?? 'Filling'} removed`)
  } else {
    b.setFilling(id)
    useUI.getState().showToast(`${f?.name ?? 'Filling'} rolled into every layer`, 'success')
  }
  sfx.squish()
}

/* ------------------------------------------------------------------ */
/*  Pouring                                                            */
/* ------------------------------------------------------------------ */

function zigzagPath(): number[] {
  // a back-to-front zigzag in *world* orientation, converted to roll-local
  const pts: number[] = []
  const zigs = 9
  const N = 420
  const spin = runtime.spin
  const c = Math.cos(spin)
  const s = Math.sin(spin)
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const zw = -0.8 + 1.6 * t
    const amp = Math.sqrt(Math.max(0, 0.86 * 0.86 - zw * zw)) * 0.96
    const ph = (t * zigs) % 2
    const tri = ph < 1 ? ph * 2 - 1 : 3 - ph * 2
    const xw = tri * amp
    // world → local: rotate by -spin around Y (three.js rotation.y convention)
    const xl = xw * c - zw * s
    const zl = xw * s + zw * c
    pts.push(xl, zl)
  }
  return pts
}

function spiralPath(): number[] {
  const d = runtime.rollData
  const pts: number[] = []
  if (!d) return pts
  const u0 = 0.9
  const u1 = d.uMax - 1.2
  for (let u = u0; u <= u1; u += 0.03) {
    const r = d.r0 + (d.pitch * u) / (Math.PI * 2)
    pts.push(Math.cos(u) * r, Math.sin(u) * r)
  }
  return pts
}

function pathLength(p: number[]) {
  let L = 0
  for (let i = 2; i < p.length; i += 2) L += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1])
  return L
}

function startStroke(sauceId: string, kind: 'line' | 'pool') {
  const id = uid('stroke')
  st.strokeId = id
  const live = runtime.live
  live.strokeId = id
  live.kind = kind
  live.points = []
  live.pool = null
  live.sauceId = sauceId
  live.version++
  useBuilder.getState().beginStroke({ id, sauceId, kind, points: [], drips: [], volume: 0 })
  useRuntime.getState().setLive(id)
  st.lastSync = performance.now()
}

function finishStroke() {
  const id = st.strokeId
  if (!id) return
  const live = runtime.live
  const b = useBuilder.getState()
  const drips = useRuntime.getState().liveDrips
  const volume = live.kind === 'pool' && live.pool ? poolVolume(live.pool.radius, live.pool.thickness) : strokeVolume(live.points)
  b.updateStroke(id, {
    points: live.points.slice(),
    pool: live.pool ? { ...live.pool } : undefined,
    drips: drips.slice(),
    volume: live.points.length >= 4 || live.pool ? volume : 0,
  })
  b.discardStrokeIfEmpty(id)
  live.strokeId = null
  live.points = []
  live.pool = null
  live.version++
  st.strokeId = null
  useRuntime.getState().setLive(null)
}

function startPouring() {
  const tool = useTool.getState()
  const held = tool.held
  if (!held || held.kind !== 'sauce') return
  const design = useBuilder.getState().design
  const ok = canUseSauce(design, held.id)
  if (!ok.ok) return toast(ok.reason)
  st.press = 'pour'
  tool.setActive(true)
  const pattern = tool.pattern
  st.pattern = null
  if (pattern === 'zigzag' || pattern === 'spiral') {
    const path = pattern === 'zigzag' ? zigzagPath() : spiralPath()
    st.pattern = { path, length: pathLength(path), travelled: 0, seg: 0, segT: 0 }
  }
  startStroke(held.id, pattern === 'glaze' ? 'pool' : 'line')
  startPour(tool.flow === 'thick' ? 1 : tool.flow === 'thin' ? 0 : 0.5)
}

function stopPouring() {
  stopPour()
  finishStroke()
  st.pattern = null
  useTool.getState().setActive(false)
  runtime.stream.visible = false
}

function maybeDrip(x: number, z: number, y: number, r: number, base: number) {
  if (rollSurface.insideBy(x, z) > 0.055) return
  if (r < base * 0.85) return
  const ang = Math.atan2(z, x)
  const drips = useRuntime.getState().liveDrips
  if (drips.some((d) => Math.abs(Math.atan2(Math.sin(d.angle - ang), Math.cos(d.angle - ang))) < 0.24)) return
  if (st.rng() > 0.55) return
  const edge = rollSurface.edgeAt(ang)
  const drip: SauceDrip = {
    angle: ang,
    radius: edge.r,
    top: Math.min(y, edge.h + 0.02),
    length: (0.1 + st.rng() * 0.26) * clamp(r / 0.022, 0.6, 1.6),
    width: r * 0.8,
    bornAt: Date.now(),
  }
  useRuntime.getState().addLiveDrip(drip)
}

function addLinePoint(x: number, z: number, dt: number) {
  const tool = useTool.getState()
  const base = FLOW_RADIUS[tool.flow]
  const live = runtime.live
  const pts = live.points
  const now = performance.now()
  const n = pts.length
  const surfaceY = (px: number, pz: number) => rollSurface.heightAt(px, pz)
  if (n === 0) {
    const y = surfaceY(x, z)
    if (y === null) return
    pts.push(x, y, z, base * 0.95)
    st.lastPointT = now
    live.version++
    return
  }
  const lx = pts[n - 4]
  const lz = pts[n - 2]
  const d = Math.hypot(x - lx, z - lz)
  if (d >= 0.011) {
    const steps = Math.max(1, Math.ceil(d / 0.018))
    const since = Math.max(0.008, (now - st.lastPointT) / 1000)
    const speed = d / since
    const r = base * clamp(1.22 - speed * 0.16, 0.68, 1.22)
    const lastR = pts[n - 1]
    for (let k = 1; k <= steps; k++) {
      const f = k / steps
      const px = lx + (x - lx) * f
      const pz = lz + (z - lz) * f
      const y = surfaceY(px, pz)
      if (y === null) continue
      const rr = lastR + (r - lastR) * Math.min(1, f * 0.6 + 0.4)
      pts.push(px, y, pz, rr)
      maybeDrip(px, pz, y, rr, base)
    }
    st.lastPointT = now
    live.version++
  } else {
    // holding still → the sauce pools and the line thickens
    const grown = Math.min(base * 2.2, pts[n - 1] + base * dt * 1.25)
    if (grown !== pts[n - 1]) {
      pts[n - 1] = grown
      live.version++
      maybeDrip(pts[n - 4], pts[n - 2], pts[n - 3], grown, base)
    }
  }
}

function growPool(dt: number) {
  const live = runtime.live
  if (!live.pool) {
    if (!st.contactValid) return
    live.pool = { x: st.contactLocal.x, z: st.contactLocal.z, radius: 0.05, thickness: 0.022 }
  }
  const p = live.pool
  const rate = useTool.getState().flow === 'thick' ? 0.36 : useTool.getState().flow === 'thin' ? 0.18 : 0.26
  p.radius = Math.min(0.78, p.radius + (dt * rate) / (1 + p.radius * 1.6))
  p.thickness = 0.02 + Math.min(p.radius, 0.6) * 0.022
  live.version++
  // overflow drips where the pool crosses the edge
  const steps = 20
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const x = p.x + Math.cos(a) * p.radius
    const z = p.z + Math.sin(a) * p.radius
    if (rollSurface.insideBy(x, z) < 0.0) {
      const ang = Math.atan2(z, x)
      const drips = useRuntime.getState().liveDrips
      if (drips.some((d) => Math.abs(Math.atan2(Math.sin(d.angle - ang), Math.cos(d.angle - ang))) < 0.38)) continue
      if (st.rng() > 0.35) continue
      const edge = rollSurface.edgeAt(ang)
      useRuntime.getState().addLiveDrip({
        angle: ang,
        radius: edge.r,
        top: edge.h,
        length: 0.14 + st.rng() * 0.28,
        width: 0.022 + st.rng() * 0.014,
        bornAt: Date.now(),
      })
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Sprinkling                                                         */
/* ------------------------------------------------------------------ */

function startSprinkling() {
  const tool = useTool.getState()
  const held = tool.held
  if (!held || held.kind !== 'topping') return
  const design = useBuilder.getState().design
  const ok = canUseTopping(design, held.id)
  if (!ok.ok) return toast(ok.reason)
  st.press = 'sprinkle'
  st.batchId = useBuilder.getState().beginBatch(held.id)
  st.sprinkleAcc = 0.06
  st.sprinkleTicks = 0
  st.limitWarned = false
  tool.setActive(true)
}

function stopSprinkling() {
  if (st.batchId) useBuilder.getState().discardBatchIfEmpty(st.batchId)
  st.batchId = null
  useTool.getState().setActive(false)
}

function sprinkleTick() {
  const tool = useTool.getState()
  const held = tool.held
  if (!held || !st.batchId) return
  const t = findTopping(held.id)
  if (!t) return
  const design = useBuilder.getState().design
  if (toppingCount(design, t.id) >= t.maxPieces) {
    if (!st.limitWarned) {
      st.limitWarned = true
      useUI.getState().showToast(`That's the maximum ${t.name.toLowerCase()} for one roll`, 'warn')
    }
    return
  }
  const sigma = SPREAD_SIGMA[tool.spread]
  const n = t.perTick * (tool.spread === 'handful' ? 2 : 1)
  const pieces: ToppingPiece[] = []
  for (let k = 0; k < n * 2 && pieces.length < n; k++) {
    const x = st.contactLocal.x + gaussian(st.rng) * sigma
    const z = st.contactLocal.z + gaussian(st.rng) * sigma
    if (rollSurface.insideBy(x, z) < 0.03 || rollSurface.heightAt(x, z) === null) continue
    pieces.push(makePiece(t, x, z, st.rng, SCOOP_HEIGHT - 0.1 + st.rng() * 0.12, st.rng() * 60))
  }
  if (!pieces.length) return
  useBuilder.getState().addPieces(st.batchId, pieces)
  st.sprinkleTicks++
  if (st.sprinkleTicks % 2 === 1) setTimeout(() => sfx.sprinkle(pieces.length / 4), 300)
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export const interaction = {
  pickSauce: (e: ThreeEvent<PointerEvent>, id: string) => pick(e, 'sauce', id),
  pickTopping: (e: ThreeEvent<PointerEvent>, id: string) => pick(e, 'topping', id),
  pickFilling: (e: ThreeEvent<PointerEvent>, id: string) => pick(e, 'filling', id),

  toggleExtra(e: ThreeEvent<PointerEvent>, id: string) {
    e.stopPropagation()
    if (!canInteract()) return
    const b = useBuilder.getState()
    const had = b.design.extras.includes(id)
    if (!had && b.design.extras.length >= catalog.limits.maxExtras) return toast('No more extras on this roll.')
    b.toggleExtra(id)
    const ex = catalog.extras.find((x) => x.id === id)
    useUI.getState().showToast(had ? `${ex?.name} removed` : `${ex?.name} added`, had ? 'info' : 'success')
    sfx.tap()
  },

  lidDown(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation()
    if (!canInteract()) return
    if (useTool.getState().held) return
    const ui = useUI.getState()
    ui.setLidOpen(!ui.lidOpen)
    sfx.box(!ui.lidOpen)
  },

  rollDown(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation()
    if (!canInteract()) return
    if (e.nativeEvent.button === 2) return
    const ui = useUI.getState()
    if (!ui.lidOpen) {
      ui.setLidOpen(true)
      sfx.box(true)
      return
    }
    const held = useTool.getState().held
    if (held?.kind === 'sauce') {
      // make sure contact is right under the finger for touch input
      st.hit.copy(e.point)
      st.hitLocal.copy(e.point)
      runtime.rollGroup?.worldToLocal(st.hitLocal)
      st.contactLocal.copy(st.hitLocal)
      st.contactValid = rollSurface.heightAt(st.hitLocal.x, st.hitLocal.z) !== null
      startPouring()
      beginPress(e, 'pour')
    } else if (held?.kind === 'topping') {
      st.hitLocal.copy(e.point)
      runtime.rollGroup?.worldToLocal(st.hitLocal)
      st.contactLocal.copy(st.hitLocal)
      startSprinkling()
      beginPress(e, 'sprinkle')
    } else if (!held) {
      beginPress(e, 'spin')
      runtime.spinVel = 0
      document.body.style.cursor = 'grabbing'
    }
  },

  counterDown(e: ThreeEvent<PointerEvent>) {
    if (!canInteract()) return
    const tool = useTool.getState()
    if (!tool.held || st.press !== 'none') return
    e.stopPropagation()
    tool.putBack()
    sfx.drop()
  },

  hover(h: Hovered | null) {
    useTool.getState().setHovered(h)
    if (st.press === 'spin') return
    const tool = useTool.getState()
    if (!h) document.body.style.cursor = tool.held ? 'none' : ''
    else if (h.kind === 'roll') document.body.style.cursor = tool.held ? 'none' : 'grab'
    else document.body.style.cursor = tool.held ? 'none' : 'pointer'
  },

  setTooltipAnchor(p: THREE.Vector3 | null) {
    if (p) runtime.tooltipAnchor.copy(p)
    runtime.tooltipVisible = !!p
  },

  /** Global pointer move (DOM). */
  onMove(ev: PointerEvent) {
    if (st.press === 'none') return
    const dx = ev.clientX - st.lastClientX
    st.moved += Math.abs(dx) + Math.abs(ev.movementY || 0)
    if (st.press === 'spin') {
      const now = performance.now()
      const dt = Math.max(0.008, (now - st.lastMoveT) / 1000)
      runtime.spin += dx * 0.011
      runtime.spinVel = (dx * 0.011) / dt
      st.lastMoveT = now
    }
    st.lastClientX = ev.clientX
  },

  /** Global pointer up (DOM). */
  onUp(ev: PointerEvent) {
    const press = st.press
    st.press = 'none'
    if (press === 'pour') stopPouring()
    if (press === 'sprinkle') stopSprinkling()
    if (press === 'spin') {
      document.body.style.cursor = useTool.getState().hovered?.kind === 'roll' ? 'grab' : ''
      if (performance.now() - st.lastMoveT > 80) runtime.spinVel = 0
    }
    if (press === 'filling' && st.fillingId) {
      const id = st.fillingId
      st.fillingId = null
      const dist = Math.hypot(ev.clientX - st.pressX, ev.clientY - st.pressY)
      const quick = performance.now() - st.pressT < 450 && dist < 10
      const tool = useTool.getState()
      if (quick) {
        // a click on the ramekin toggles the filling
        toggleFilling(id)
        tool.putBack()
        useTool.getState().clearReturning()
      } else if (st.overRoll) {
        // dropped on the roll: always apply
        if (useBuilder.getState().design.fillingId !== id) toggleFilling(id)
        else sfx.squish()
        tool.putBack()
        useTool.getState().clearReturning()
      } else {
        tool.putBack()
        sfx.drop()
      }
    }
  },

  cancel() {
    if (st.press === 'pour') stopPouring()
    if (st.press === 'sprinkle') stopSprinkling()
    st.press = 'none'
    const tool = useTool.getState()
    if (tool.held) {
      tool.putBack()
      sfx.drop()
    }
  },

  /** Quick add for the held topping (UI button). */
  isPressing: () => st.press === 'pour' || st.press === 'sprinkle',

  /** Per-frame update from inside the canvas. */
  update(state: RootState, dt: number) {
    const tool = useTool.getState()
    const held = tool.held
    const ui = useUI.getState()
    const building = ui.screen === 'build' && !ui.inspect && ui.packPhase === 'idle'

    // --- where is the pointer? ---
    state.raycaster.setFromCamera(state.pointer, state.camera)
    st.overRoll = false
    if (building && runtime.rollMesh && ui.lidOpen) {
      const hits = state.raycaster.intersectObject(runtime.rollMesh, false)
      if (hits.length) {
        st.overRoll = true
        st.hit.copy(hits[0].point)
        st.hitLocal.copy(st.hit)
        runtime.rollGroup?.worldToLocal(st.hitLocal)
      }
    }
    state.raycaster.ray.intersectPlane(_plane, st.plane)
    tool.setOverRoll(st.overRoll)

    // --- contact point (pattern or pointer) ---
    if (st.press === 'pour' && st.pattern) {
      const p = st.pattern
      p.travelled += AUTO_SPEED * dt
      let remaining = p.travelled
      let found = false
      for (let i = 2; i < p.path.length; i += 2) {
        const seg = Math.hypot(p.path[i] - p.path[i - 2], p.path[i + 1] - p.path[i - 1])
        if (remaining <= seg) {
          const f = seg > 0 ? remaining / seg : 0
          st.contactLocal.set(p.path[i - 2] + (p.path[i] - p.path[i - 2]) * f, 0, p.path[i - 1] + (p.path[i + 1] - p.path[i - 1]) * f)
          found = true
          break
        }
        remaining -= seg
      }
      if (!found) {
        // pattern complete — stop pouring but keep holding the bottle
        stopPouring()
        st.press = 'none'
      }
      st.contactValid = found && rollSurface.heightAt(st.contactLocal.x, st.contactLocal.z) !== null
    } else if (st.overRoll) {
      st.contactLocal.copy(st.hitLocal)
      st.contactValid = rollSurface.heightAt(st.hitLocal.x, st.hitLocal.z) !== null
    } else {
      st.contactValid = false
    }

    // --- held tool target ---
    if (held) {
      const contactWorld = _w
      if (st.contactValid && runtime.rollGroup) {
        const y = rollSurface.heightAt(st.contactLocal.x, st.contactLocal.z) ?? 0.6
        contactWorld.set(st.contactLocal.x, y, st.contactLocal.z)
        runtime.rollGroup.localToWorld(contactWorld)
      }
      const lift = held.kind === 'sauce' ? NOZZLE_HEIGHT : held.kind === 'topping' ? SCOOP_HEIGHT : BAG_HEIGHT
      if (st.contactValid) {
        runtime.held.target.copy(contactWorld).add(_v.set(0, lift, 0))
        runtime.held.pose = held.kind === 'sauce' ? 'pour' : held.kind === 'topping' ? 'sprinkle' : 'pipe'
      } else {
        runtime.held.target.set(st.plane.x, 0.9, st.plane.z)
        runtime.held.pose = 'carry'
      }
      runtime.held.shaking = st.press === 'sprinkle' && st.contactValid

      // stream
      const pouring = st.press === 'pour' && st.contactValid
      runtime.stream.visible = pouring && runtime.live.kind === 'line' ? true : pouring
      if (pouring) {
        runtime.stream.to.copy(contactWorld)
        runtime.stream.from.copy(runtime.held.target).add(_v.set(0, -0.02, 0))
        runtime.stream.radius = FLOW_RADIUS[tool.flow] * 0.55
        runtime.stream.color = findSauce(held.id)?.color ?? '#fff'
      }
    } else {
      runtime.stream.visible = false
    }

    // --- actions ---
    if (st.press === 'pour' && held?.kind === 'sauce') {
      if (runtime.live.kind === 'pool') growPool(dt)
      else if (st.contactValid) addLinePoint(st.contactLocal.x, st.contactLocal.z, dt)
      else if (runtime.live.points.length >= 4 && !st.pattern) {
        // slid off the roll: close this stroke, a new one starts when back on
        finishStroke()
        startStroke(held.id, 'line')
      }
      const now = performance.now()
      if (st.strokeId && now - st.lastSync > SYNC_MS) {
        st.lastSync = now
        const live = runtime.live
        const volume = live.kind === 'pool' && live.pool ? poolVolume(live.pool.radius, live.pool.thickness) : strokeVolume(live.points)
        useBuilder.getState().updateStroke(st.strokeId, { volume })
      }
    }
    if (st.press === 'sprinkle' && held?.kind === 'topping') {
      st.sprinkleAcc += dt
      while (st.sprinkleAcc >= 0.065) {
        st.sprinkleAcc -= 0.065
        if (st.contactValid) sprinkleTick()
      }
    }

    // spin inertia
    if (st.press !== 'spin' && Math.abs(runtime.spinVel) > 0.001) {
      runtime.spin += runtime.spinVel * dt
      runtime.spinVel *= Math.exp(-3.2 * dt)
    }
  },
}

export function quickAddTopping(toppingId: string, pieces: ToppingPiece[]) {
  const b = useBuilder.getState()
  const ok = canUseTopping(b.design, toppingId)
  if (!ok.ok) return toast(ok.reason)
  b.addToppingPieces(toppingId, pieces)
  setTimeout(() => sfx.sprinkle(2), 350)
}
