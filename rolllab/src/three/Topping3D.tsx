import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { catalog } from '../config/catalog'
import { useBuilder } from '../store/builderStore'
import type { ToppingOption, ToppingPiece } from '../types'
import { restLift, toppingGeometry, tumble } from './toppingGeometries'
import { toppingMaterial } from './materials'
import { rollSurface } from './surface'
import { runtime, useRuntime } from './runtime'
import { createRng, gaussian, type Rng } from '../lib/noise'

/**
 * Toppings on the roll — one InstancedMesh per topping type.
 * Pieces are stored in roll-local x/z; their height is resolved against the
 * surface (dough + sauce) at render time, so they always rest on top.
 */
export function ToppingLayer() {
  const toppings = useBuilder((s) => s.design.toppings)
  const surfaceVersion = useRuntime((s) => s.surfaceVersion)
  const grouped = useMemo(() => {
    const m = new Map<string, ToppingPiece[]>()
    for (const b of toppings) {
      if (!b.pieces.length) continue
      const arr = m.get(b.toppingId) ?? []
      arr.push(...b.pieces)
      m.set(b.toppingId, arr)
    }
    return m
  }, [toppings])

  return (
    <group name="toppings">
      {[...grouped.entries()].map(([id, pieces]) => {
        const t = catalog.toppings.find((x) => x.id === id)
        return t ? <ToppingInstances key={id} topping={t} pieces={pieces} surfaceVersion={surfaceVersion} /> : null
      })}
    </group>
  )
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _n = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _col = new THREE.Color()

const FALL_MS = 420

function pieceMatrix(t: ToppingOption, pc: ToppingPiece, now: number, out: THREE.Matrix4) {
  const size = t.size * pc.s
  const land = rollSurface.heightAt(pc.x, pc.z) ?? 0.5
  rollSurface.normalAt(pc.x, pc.z, _n)
  _n.lerp(_up, 0.35).normalize()
  let y = land + restLift[t.shape] * size * pc.sy
  const age = now - pc.bornAt
  let spin = 0
  if (age < FALL_MS) {
    const k = Math.max(0, age) / FALL_MS
    y += pc.drop * (1 - k * k)
    spin = (1 - k) * 2.4
  } else if (age < FALL_MS + 160) {
    const k = (age - FALL_MS) / 160
    y += Math.sin(k * Math.PI) * size * 0.35
  }
  _q.setFromUnitVectors(_up, _n)
  _e.set(pc.rx + spin, pc.ry + spin * 0.6, pc.rz)
  _q2.setFromEuler(_e)
  _q.multiply(_q2)
  _p.set(pc.x, y, pc.z)
  _s.set(size * pc.sx, size * pc.sy, size * pc.sz)
  out.compose(_p, _q, _s)
  return age < FALL_MS + 160
}

function ToppingInstances({ topping, pieces, surfaceVersion }: { topping: ToppingOption; pieces: ToppingPiece[]; surfaceVersion: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const capacity = Math.max(topping.maxPieces, pieces.length) + 8
  const geometry = toppingGeometry(topping.shape)
  const material = toppingMaterial(topping.id)
  const animating = useRef(false)
  const palette = useMemo(() => topping.colors.map((c) => new THREE.Color(c)), [topping.colors])

  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    const now = Date.now()
    let anim = false
    pieces.forEach((pc, i) => {
      if (pieceMatrix(topping, pc, now, _m)) anim = true
      im.setMatrixAt(i, _m)
      _col.copy(palette[pc.c % palette.length])
      im.setColorAt(i, _col)
    })
    im.count = pieces.length
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    im.computeBoundingSphere()
    animating.current = anim
  }, [pieces, topping, palette, surfaceVersion])

  useFrame(() => {
    if (!animating.current || !ref.current) return
    const im = ref.current
    const now = Date.now()
    let anim = false
    for (let i = pieces.length - 1; i >= 0; i--) {
      const pc = pieces[i]
      if (now - pc.bornAt > FALL_MS + 400) {
        if (i < pieces.length - 40) break
        continue
      }
      if (pieceMatrix(topping, pc, now, _m)) anim = true
      im.setMatrixAt(i, _m)
    }
    im.instanceMatrix.needsUpdate = true
    animating.current = anim
  })

  return <instancedMesh ref={ref} args={[geometry, material, capacity]} castShadow frustumCulled={false} />
}

/* ------------------------------------------------------------------ */
/*  Piece factory                                                      */
/* ------------------------------------------------------------------ */

export function makePiece(t: ToppingOption, x: number, z: number, rng: Rng, drop: number, delayMs = 0): ToppingPiece {
  const tb = tumble[t.shape]
  return {
    x,
    z,
    rx: (rng() - 0.5) * Math.PI * tb,
    ry: rng() * Math.PI * 2,
    rz: (rng() - 0.5) * Math.PI * tb,
    s: 0.78 + rng() * 0.44,
    sx: 0.85 + rng() * 0.3,
    sy: 0.85 + rng() * 0.3,
    sz: 0.85 + rng() * 0.3,
    c: Math.floor(rng() * t.colors.length),
    bornAt: Date.now() + delayMs,
    drop,
  }
}

const quickRng = createRng(Date.now() & 0xffff)

/** A handful of pieces spread across the whole roll (quick add / "+" button). */
export function scatterPieces(t: ToppingOption, count: number): ToppingPiece[] {
  const out: ToppingPiece[] = []
  for (let i = 0; i < count * 3 && out.length < count; i++) {
    const a = quickRng() * Math.PI * 2
    const r = Math.sqrt(quickRng()) * 0.93
    const x = Math.cos(a) * r + gaussian(quickRng) * 0.02
    const z = Math.sin(a) * r + gaussian(quickRng) * 0.02
    if (rollSurface.insideBy(x, z) < 0.04 || rollSurface.heightAt(x, z) === null) continue
    out.push(makePiece(t, x, z, quickRng, 0.9 + quickRng() * 0.5, out.length * 14))
  }
  return out
}

/* ------------------------------------------------------------------ */
/*  Heaped pieces inside a tray                                        */
/* ------------------------------------------------------------------ */

const TRAY_COUNTS: Record<ToppingOption['shape'], number> = {
  chunk: 520,
  kernel: 120,
  shard: 230,
  chip: 210,
  block: 130,
  halfnut: 170,
  flake: 240,
  sprinkle: 1100,
  shred: 330,
}

export function TrayHeapPieces({
  topping,
  halfW,
  halfD,
  heap,
  scale = 1,
}: {
  topping: ToppingOption
  halfW: number
  halfD: number
  heap: (x: number, z: number) => number
  scale?: number
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  // phones and low-power devices get lighter heaps (the bed underneath keeps them looking full)
  const count = Math.round(TRAY_COUNTS[topping.shape] * scale * (runtime.quality === 'low' ? 0.55 : 1))
  const geometry = toppingGeometry(topping.shape)
  const material = toppingMaterial(topping.id)

  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    const rng = createRng(topping.id.length * 977 + topping.size * 1000)
    const palette = topping.colors.map((c) => new THREE.Color(c))
    const tb = tumble[topping.shape]
    for (let i = 0; i < count; i++) {
      const x = (rng() * 2 - 1) * halfW * 0.95
      const z = (rng() * 2 - 1) * halfD * 0.93
      const size = topping.size * (0.9 + rng() * 0.45)
      const y = heap(x, z) + restLift[topping.shape] * size * 0.55 + rng() * size * 0.25
      _e.set((rng() - 0.5) * Math.PI * Math.max(0.5, tb), rng() * Math.PI * 2, (rng() - 0.5) * Math.PI * Math.max(0.5, tb))
      _q.setFromEuler(_e)
      _p.set(x, y, z)
      _s.set(size * (0.85 + rng() * 0.3), size * (0.85 + rng() * 0.3), size * (0.85 + rng() * 0.3))
      _m.compose(_p, _q, _s)
      im.setMatrixAt(i, _m)
      im.setColorAt(i, palette[Math.floor(rng() * palette.length)])
    }
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    im.computeBoundingSphere()
  }, [topping, count, halfW, halfD, heap])

  return <instancedMesh ref={ref} args={[geometry, material, count]} castShadow receiveShadow />
}
