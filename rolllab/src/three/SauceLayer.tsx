import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useBuilder } from '../store/builderStore'
import type { SauceDrip, SauceStroke } from '../types'
import { buildDripGeometry, buildPoolGeometry, buildStrokeGeometry } from './sauceGeometry'
import { sauceMaterial } from './materials'
import { rollSurface } from './surface'
import { runtime, useRuntime } from './runtime'

/**
 * Everything poured on the roll. Committed strokes are static meshes; the
 * stroke being poured right now is rebuilt every frame from `runtime.live`.
 */
export function SauceLayer() {
  const sauces = useBuilder((s) => s.design.sauces)
  const liveId = useRuntime((s) => s.liveStrokeId)
  const liveDrips = useRuntime((s) => s.liveDrips)
  const bumpSurface = useRuntime((s) => s.bumpSurface)

  const committed = useMemo(() => sauces.filter((s) => s.id !== liveId), [sauces, liveId])
  const accumKey = committed.map((s) => `${s.id}:${s.volume.toFixed(6)}`).join('|')

  useLayoutEffect(() => {
    if (!rollSurface.ready) return
    rollSurface.rebuildAccum(sauces, liveId)
    bumpSurface()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accumKey])

  const liveSauce = sauces.find((s) => s.id === liveId)

  return (
    <group name="sauces">
      {committed.map((s) => (
        <CommittedStroke key={s.id} stroke={s} />
      ))}
      {liveSauce && <LiveStroke sauceId={liveSauce.sauceId} />}
      {liveSauce && liveDrips.map((d, i) => <Drip key={`live-${i}`} drip={d} sauceId={liveSauce.sauceId} />)}
    </group>
  )
}

const REVEAL_MS = 1000

function CommittedStroke({ stroke }: { stroke: SauceStroke }) {
  const geometry = useMemo(() => {
    if (stroke.kind === 'pool' && stroke.pool) return buildPoolGeometry(stroke.pool)
    return buildStrokeGeometry(stroke.points)
  }, [stroke.kind, stroke.points, stroke.pool])
  useEffect(() => () => geometry?.dispose(), [geometry])
  const mat = sauceMaterial(stroke.sauceId)
  const mesh = useRef<THREE.Mesh>(null)
  const pivot = useRef<THREE.Group>(null)
  const revealing = useRef(!!stroke.bornAt && Date.now() - stroke.bornAt < REVEAL_MS)

  // Chef's picks pour in: a line grows along its path, a glaze spreads from its centre.
  useFrame(() => {
    if (!revealing.current || !geometry || !mesh.current) return
    const t = (Date.now() - (stroke.bornAt ?? 0)) / REVEAL_MS
    const k = Math.max(0, Math.min(1, t))
    mesh.current.visible = t > 0
    if (stroke.kind === 'pool' && pivot.current) {
      const e = 1 - Math.pow(1 - k, 3)
      pivot.current.scale.set(Math.max(0.001, e), 1, Math.max(0.001, e))
    } else {
      const total = geometry.index?.count ?? 0
      geometry.setDrawRange(0, Math.floor((total / 3) * k) * 3)
    }
    if (k >= 1) {
      revealing.current = false
      geometry.setDrawRange(0, Infinity)
    }
  })

  const px = stroke.pool?.x ?? 0
  const pz = stroke.pool?.z ?? 0
  return (
    <group>
      {geometry && (
        <group ref={pivot} position={[px, 0, pz]}>
          <mesh ref={mesh} position={[-px, 0, -pz]} geometry={geometry} material={mat} castShadow visible={!revealing.current} />
        </group>
      )}
      {stroke.drips.map((d, i) => (
        <Drip key={i} drip={d} sauceId={stroke.sauceId} />
      ))}
    </group>
  )
}

function LiveStroke({ sauceId }: { sauceId: string }) {
  const mesh = useRef<THREE.Mesh>(null)
  const lastVersion = useRef(-1)
  const lastBuild = useRef(0)
  const mat = sauceMaterial(sauceId)

  useFrame(() => {
    const live = runtime.live
    const m = mesh.current
    if (!m) return
    if (live.version === lastVersion.current) return
    const now = performance.now()
    // big strokes: rebuild at most every 45ms to stay smooth on phones
    const heavy = live.points.length > 1600
    if (heavy && now - lastBuild.current < 45) return
    lastVersion.current = live.version
    lastBuild.current = now
    let g: THREE.BufferGeometry | null = null
    if (live.kind === 'pool' && live.pool) g = buildPoolGeometry(live.pool)
    else if (live.points.length >= 4) g = buildStrokeGeometry(live.points)
    const old = m.geometry
    if (g) {
      m.geometry = g
      m.visible = true
    } else {
      m.visible = false
    }
    if (old && old !== g) old.dispose()
  })

  useEffect(() => {
    const m = mesh.current
    return () => m?.geometry?.dispose()
  }, [])

  return <mesh ref={mesh} material={mat} castShadow visible={false} />
}

const bulbGeo = new THREE.SphereGeometry(1, 14, 10)

function Drip({ drip, sauceId }: { drip: SauceDrip; sauceId: string }) {
  const built = useMemo(() => buildDripGeometry(drip), [drip])
  const mesh = useRef<THREE.Mesh>(null)
  const bulb = useRef<THREE.Mesh>(null)
  const done = useRef(false)
  const mat = sauceMaterial(sauceId)

  useEffect(() => () => built?.geometry.dispose(), [built])

  useFrame(() => {
    if (!built || done.current || !mesh.current || !bulb.current) return
    const age = (Date.now() - drip.bornAt) / 1000
    mesh.current.visible = bulb.current.visible = age >= 0
    if (age < 0) return
    // sauce runs down quickly, then slows
    const p = Math.min(1, 1 - Math.pow(1 - Math.min(1, age / 1.8), 2.4))
    const rings = built.path.length
    const ringsShown = Math.max(1, Math.round(p * (rings - 1)))
    mesh.current.geometry.setDrawRange(0, ringsShown * built.ringIndexCount)
    const pt = built.path[Math.min(rings - 1, ringsShown)]
    bulb.current.position.copy(pt)
    const s = built.bulbRadius * (0.6 + 0.4 * p)
    bulb.current.scale.set(s * 1.1, s * 1.25, s * 1.1)
    if (p >= 1) done.current = true
  })

  if (!built) return null
  return (
    <group>
      <mesh ref={mesh} geometry={built.geometry} material={mat} castShadow />
      <mesh ref={bulb} geometry={bulbGeo} material={mat} castShadow />
    </group>
  )
}
