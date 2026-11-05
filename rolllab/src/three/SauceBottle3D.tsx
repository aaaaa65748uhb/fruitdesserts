import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { catalog } from '../config/catalog'
import type { SauceOption } from '../types'
import { money } from '../lib/format'
import { useTool } from '../store/toolStore'
import { bottleBodyMaterial, plasticMaterial } from './materials'
import { bottleLabelTexture } from './textures'
import { interaction } from './interaction'
import { runtime } from './runtime'
import { damp } from '../lib/noise'
import { nameOf, useLang } from '../i18n'

/** Height of the nozzle tip above the bottle base (model units). */
export const BOTTLE_TIP = 1.46

const geoCache: Record<string, THREE.BufferGeometry> = {}
function bottleGeometries() {
  if (geoCache.body) return geoCache
  const body = [
    [0, 0],
    [0.19, 0],
    [0.225, 0.012],
    [0.24, 0.05],
    [0.242, 0.2],
    [0.243, 0.72],
    [0.238, 0.84],
    [0.215, 0.93],
    [0.17, 1.0],
    [0.122, 1.045],
    [0.112, 1.075],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  geoCache.body = new THREE.LatheGeometry(body, 40)
  // ribbed screw cap
  const cap: THREE.Vector2[] = []
  cap.push(new THREE.Vector2(0.0, 1.06))
  cap.push(new THREE.Vector2(0.128, 1.06))
  for (let i = 0; i <= 8; i++) cap.push(new THREE.Vector2(0.132 + (i % 2) * 0.006, 1.07 + i * 0.016))
  cap.push(new THREE.Vector2(0.128, 1.205))
  cap.push(new THREE.Vector2(0.08, 1.215))
  cap.push(new THREE.Vector2(0.0, 1.215))
  geoCache.cap = new THREE.LatheGeometry(cap, 36)
  const nozzle = [
    [0, 1.21],
    [0.066, 1.21],
    [0.058, 1.25],
    [0.036, 1.36],
    [0.021, 1.44],
    [0.012, BOTTLE_TIP],
    [0, BOTTLE_TIP],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  geoCache.nozzle = new THREE.LatheGeometry(nozzle, 24)
  const label = new THREE.CylinderGeometry(0.2465, 0.2465, 0.44, 48, 1, true, -1.3, 2.6)
  label.translate(0, 0.43, 0)
  geoCache.label = label
  return geoCache
}

export function SauceBottleModel({ sauce, squeeze = 1 }: { sauce: SauceOption; squeeze?: number }) {
  const g = bottleGeometries()
  const lang = useLang((s) => s.lang)
  const labelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: bottleLabelTexture({ title: nameOf(sauce, lang), price: money(sauce.price), accent: sauce.capColor, rtl: lang === 'he' }),
        roughness: 0.55,
      }),
    [sauce, lang],
  )
  return (
    <group>
      <group scale={[squeeze, 1, squeeze]}>
        <mesh geometry={g.body} material={bottleBodyMaterial(sauce.color)} castShadow receiveShadow />
        <mesh geometry={g.label} material={labelMat} />
      </group>
      <mesh geometry={g.cap} material={plasticMaterial(sauce.capColor, 0.4)} castShadow />
      <mesh geometry={g.nozzle} material={plasticMaterial('#f4efe6', 0.3)} castShadow />
    </group>
  )
}

/** A bottle standing in its spot on the caddy. Click / drag to pick it up. */
export function ShelfBottle({ sauce, x, z, scale }: { sauce: SauceOption; x: number; z: number; scale: number }) {
  const held = useTool((s) => s.held)
  const returning = useTool((s) => s.returning)
  const hovered = useTool((s) => s.hovered)
  const isAway = (held?.kind === 'sauce' && held.id === sauce.id) || (returning?.kind === 'sauce' && returning.id === sauce.id)
  const isHover = hovered?.kind === 'sauce' && hovered.id === sauce.id
  const ref = useRef<THREE.Group>(null)
  const lift = useRef(0)

  useFrame((state, dt) => {
    if (!ref.current) return
    const target = isHover && !held ? 0.09 : 0
    lift.current += (target - lift.current) * damp(12, dt)
    ref.current.position.y = 0.06 + lift.current
    ref.current.rotation.z = isHover && !held ? Math.sin(state.clock.elapsedTime * 7) * 0.025 : 0
  })

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    interaction.hover({ kind: 'sauce', id: sauce.id })
    interaction.setTooltipAnchor(new THREE.Vector3(x, 1.75 * scale, z))
  }
  const onOut = () => {
    interaction.hover(null)
    interaction.setTooltipAnchor(null)
  }

  return (
    <group position={[x, 0, z]} scale={scale}>
      <group ref={ref} visible={!isAway}>
        <group
          onPointerDown={(e) => interaction.pickSauce(e, sauce.id)}
          onPointerOver={onOver}
          onPointerOut={onOut}
        >
          <SauceBottleModel sauce={sauce} />
          {/* generous invisible hit area — easier to grab on touch screens */}
          <mesh position={[0, 0.75, 0]} material={hitMaterial}>
            <cylinderGeometry args={[0.36, 0.36, 1.6, 12]} />
          </mesh>
        </group>
      </group>
      {/* ring left on the caddy when the bottle is picked up */}
      {isAway && (
        <mesh position={[0, 0.065, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.2, 0.25, 32]} />
          <meshBasicMaterial color="#000" transparent opacity={0.18} />
        </mesh>
      )}
    </group>
  )
}

/** Invisible but raycastable material for generous touch targets. */
export const hitMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })

const walnut = new THREE.MeshPhysicalMaterial({ color: '#6b4128', roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 })

/** Walnut caddies holding the bottles. */
export function BottleStation() {
  const layout = runtime.layout
  const groups = useMemo(() => {
    // group bottles in rows so each row gets one caddy board
    const rows = new Map<number, { minX: number; maxX: number; z: number; scale: number }>()
    for (const s of catalog.sauces) {
      const slot = layout.bottles[s.id]
      if (!slot) continue
      const key = Math.round(slot.z * 10) * 100 + (layout.mode === 'wide' ? (slot.x < 0 ? 0 : 1) : 0)
      const r = rows.get(key) ?? { minX: Infinity, maxX: -Infinity, z: slot.z, scale: slot.scale }
      r.minX = Math.min(r.minX, slot.x)
      r.maxX = Math.max(r.maxX, slot.x)
      rows.set(key, r)
    }
    return [...rows.values()]
  }, [layout])

  return (
    <group>
      {groups.map((g, i) => (
        <RoundedBox
          key={i}
          args={[g.maxX - g.minX + 0.72 * g.scale, 0.06, 0.74 * g.scale]}
          radius={0.025}
          smoothness={3}
          position={[(g.minX + g.maxX) / 2, 0.03, g.z]}
          material={walnut}
          castShadow
          receiveShadow
        />
      ))}
      {catalog.sauces.map((s) => {
        const slot = layout.bottles[s.id]
        return slot ? <ShelfBottle key={s.id} sauce={s} x={slot.x} z={slot.z} scale={slot.scale} /> : null
      })}
    </group>
  )
}
