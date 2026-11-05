import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { catalog } from '../config/catalog'
import type { ToppingOption } from '../types'
import { money } from '../lib/format'
import { useTool } from '../store/toolStore'
import { useBuilder } from '../store/builderStore'
import { steelMaterial } from './materials'
import { cardLabelTexture } from './textures'
import { TrayHeapPieces } from './Topping3D'
import { interaction } from './interaction'
import { runtime } from './runtime'
import { hitMaterial } from './SauceBottle3D'
import { createNoise3D, damp } from '../lib/noise'

export const TRAY = { w: 1.18, d: 0.9, h: 0.2, r: 0.12 }

function roundedRectOutline(w: number, d: number, r: number, segPerCorner = 6) {
  const pts: [number, number][] = []
  const corners: [number, number, number][] = [
    [w / 2 - r, d / 2 - r, 0],
    [-w / 2 + r, d / 2 - r, Math.PI / 2],
    [-w / 2 + r, -d / 2 + r, Math.PI],
    [w / 2 - r, -d / 2 + r, (3 * Math.PI) / 2],
  ]
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= segPerCorner; i++) {
      const a = a0 + (i / segPerCorner) * (Math.PI / 2)
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r])
    }
  }
  return pts
}

let trayGeo: THREE.BufferGeometry | null = null
/** Stainless hotel pan: sloped walls, flat floor and a rolled rim. */
function trayGeometry() {
  if (trayGeo) return trayGeo
  const { w, d, h, r } = TRAY
  const rings = [
    { w: w - 0.1, d: d - 0.1, r: r * 0.6, y: 0.008 }, // floor edge
    { w: w - 0.04, d: d - 0.04, r: r * 0.85, y: h * 0.85 },
    { w, d, r, y: h }, // top of wall
    { w: w + 0.07, d: d + 0.07, r: r + 0.035, y: h + 0.012 }, // rim
    { w: w + 0.1, d: d + 0.1, r: r + 0.05, y: h - 0.012 }, // rim roll
    { w: w + 0.06, d: d + 0.06, r: r + 0.03, y: h - 0.03 },
  ]
  const outlines = rings.map((rg) => roundedRectOutline(rg.w, rg.d, rg.r))
  const n = outlines[0].length
  const pos: number[] = []
  const idx: number[] = []
  // floor centre fan
  pos.push(0, 0.008, 0)
  outlines.forEach((o, k) => o.forEach(([x, z]) => pos.push(x, rings[k].y, z)))
  for (let i = 0; i < n; i++) idx.push(0, 1 + ((i + 1) % n), 1 + i)
  for (let k = 0; k < outlines.length - 1; k++) {
    for (let i = 0; i < n; i++) {
      const a = 1 + k * n + i
      const b = 1 + k * n + ((i + 1) % n)
      const c = 1 + (k + 1) * n + i
      const dd = 1 + (k + 1) * n + ((i + 1) % n)
      idx.push(a, b, c, b, dd, c)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // planar UVs for the brushed roughness map
  const uv: number[] = []
  for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 0.8, pos[i + 2] * 0.8 + pos[i + 1])
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  trayGeo = g
  return g
}

const heapNoise = createNoise3D(99)

function makeHeap(seed: number) {
  const hw = TRAY.w / 2 - 0.08
  const hd = TRAY.d / 2 - 0.08
  return (x: number, z: number) => {
    const fx = Math.max(0, 1 - (x / hw) ** 2)
    const fz = Math.max(0, 1 - (z / hd) ** 2)
    const mound = Math.pow(fx, 0.55) * Math.pow(fz, 0.55)
    return 0.03 + mound * 0.17 + heapNoise(x * 4 + seed, z * 4, seed) * 0.012 * mound
  }
}

function bedGeometry(heap: (x: number, z: number) => number) {
  const hw = TRAY.w / 2 - 0.06
  const hd = TRAY.d / 2 - 0.06
  const g = new THREE.PlaneGeometry(hw * 2, hd * 2, 28, 22)
  g.rotateX(-Math.PI / 2)
  const p = g.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    p.setY(i, heap(x, z) - 0.012)
  }
  g.computeVertexNormals()
  return g
}

export function IngredientTray({ topping, x, z, scale }: { topping: ToppingOption; x: number; z: number; scale: number }) {
  const heap = useMemo(() => makeHeap(topping.id.length * 3.1), [topping.id])
  const bed = useMemo(() => bedGeometry(heap), [heap])
  const bedMat = useMemo(() => new THREE.MeshStandardMaterial({ color: topping.bedColor, roughness: 0.9 }), [topping.bedColor])
  const labelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: cardLabelTexture({ title: topping.name, price: money(topping.price), accent: topping.bedColor, kicker: 'Topping' }),
        roughness: 0.7,
      }),
    [topping],
  )
  const hovered = useTool((s) => s.hovered)
  const held = useTool((s) => s.held)
  const isHeld = held?.kind === 'topping' && held.id === topping.id
  const isHover = hovered?.kind === 'topping' && hovered.id === topping.id
  const used = useBuilder((s) => s.design.toppings.some((b) => b.toppingId === topping.id && b.pieces.length > 0))
  const group = useRef<THREE.Group>(null)
  const glow = useRef<THREE.Mesh>(null)
  const lift = useRef(0)

  useFrame((_, dt) => {
    if (!group.current) return
    const target = isHover && !held ? 0.05 : 0
    lift.current += (target - lift.current) * damp(12, dt)
    group.current.position.y = lift.current
    if (glow.current) {
      const m = glow.current.material as THREE.MeshBasicMaterial
      m.opacity += ((isHeld ? 0.55 : isHover ? 0.3 : 0) - m.opacity) * damp(10, dt)
    }
  })

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    interaction.hover({ kind: 'topping', id: topping.id })
    interaction.setTooltipAnchor(new THREE.Vector3(x, 0.6, z - 0.2))
  }
  const onOut = () => {
    interaction.hover(null)
    interaction.setTooltipAnchor(null)
  }

  return (
    <group position={[x, 0, z]} scale={scale}>
      {/* selection glow on the counter */}
      <mesh ref={glow} rotation-x={-Math.PI / 2} position={[0, 0.004, 0]}>
        <planeGeometry args={[TRAY.w + 0.28, TRAY.d + 0.28]} />
        <meshBasicMaterial color="#f6d77b" transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={group} onPointerDown={(e) => interaction.pickTopping(e, topping.id)} onPointerOver={onOver} onPointerOut={onOut}>
        <mesh geometry={trayGeometry()} material={steelMaterial()} castShadow receiveShadow />
        <mesh geometry={bed} material={bedMat} receiveShadow />
        <TrayHeapPieces topping={topping} halfW={TRAY.w / 2 - 0.1} halfD={TRAY.d / 2 - 0.1} heap={heap} />
        <mesh position={[0, 0.15, 0]} material={hitMaterial}>
          <boxGeometry args={[TRAY.w + 0.1, 0.36, TRAY.d + 0.1]} />
        </mesh>
      </group>
      {/* printed label card */}
      <group position={[0, 0.03, TRAY.d / 2 + 0.185]} rotation-x={-Math.PI / 2 + 0.12}>
        <mesh material={labelMat} receiveShadow>
          <planeGeometry args={[0.9, 0.366]} />
        </mesh>
        {used && (
          <mesh position={[0.41, 0.14, 0.002]}>
            <circleGeometry args={[0.035, 20]} />
            <meshBasicMaterial color="#93AE57" />
          </mesh>
        )}
      </group>
    </group>
  )
}

export function TrayStation() {
  const layout = runtime.layout
  return (
    <group>
      {catalog.toppings.map((t) => {
        const slot = layout.trays[t.id]
        return slot ? <IngredientTray key={t.id} topping={t} x={slot.x} z={slot.z} scale={slot.scale} /> : null
      })}
    </group>
  )
}
