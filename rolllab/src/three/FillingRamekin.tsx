import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { catalog } from '../config/catalog'
import type { ExtraOption, FillingOption } from '../types'
import { money } from '../lib/format'
import { useTool } from '../store/toolStore'
import { useBuilder } from '../store/builderStore'
import { ceramicMaterial, fillingCreamMaterial, plasticMaterial } from './materials'
import { cardLabelTexture } from './textures'
import { interaction } from './interaction'
import { runtime } from './runtime'
import { hitMaterial } from './SauceBottle3D'
import { damp } from '../lib/noise'
import { dictionaries } from '../i18n/strings'
import { shortOf, useLang } from '../i18n'

const geo: Record<string, THREE.BufferGeometry> = {}

function ramekinGeometry() {
  if (geo.ramekin) return geo.ramekin
  const prof = [
    [0, 0],
    [0.25, 0],
    [0.285, 0.015],
    [0.3, 0.05],
    [0.3, 0.2],
    [0.296, 0.225],
    [0.28, 0.232],
    [0.262, 0.222],
    [0.262, 0.05],
    [0.24, 0.035],
    [0, 0.035],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const g = new THREE.LatheGeometry(prof, 64)
  // flutes on the outside wall
  const p = g.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const r = Math.hypot(x, z)
    if (r > 0.29 && y > 0.04 && y < 0.215) {
      const a = Math.atan2(z, x)
      const k = 1 + 0.035 * Math.pow(Math.abs(Math.cos(a * 11)), 0.6)
      p.setX(i, x * k)
      p.setZ(i, z * k)
    }
  }
  g.computeVertexNormals()
  geo.ramekin = g
  return g
}

function creamGeometry() {
  if (geo.cream) return geo.cream
  const prof: THREE.Vector2[] = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    const r = t * 0.262
    prof.push(new THREE.Vector2(r, 0.19 + 0.035 * (1 - t * t)))
  }
  const g = new THREE.LatheGeometry(prof.reverse(), 64)
  const p = g.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const r = Math.hypot(x, z)
    const a = Math.atan2(z, x)
    const swirl = Math.sin(a * 2 + r * 34) * 0.012 * Math.min(1, (0.262 - r) * 12)
    p.setY(i, p.getY(i) + swirl)
  }
  g.computeVertexNormals()
  geo.cream = g
  return g
}

function SelectGlow({ on, hover, radius }: { on: boolean; hover: boolean; radius: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (!ref.current) return
    const m = ref.current.material as THREE.MeshBasicMaterial
    m.opacity += ((on ? 0.75 : hover ? 0.3 : 0) - m.opacity) * damp(10, dt)
  })
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position={[0, 0.004, 0]}>
      <ringGeometry args={[radius, radius + 0.07, 48]} />
      <meshBasicMaterial color="#93AE57" transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function useLift(active: boolean) {
  const ref = useRef<THREE.Group>(null)
  const v = useRef(0)
  useFrame((_, dt) => {
    if (!ref.current) return
    v.current += ((active ? 0.06 : 0) - v.current) * damp(12, dt)
    ref.current.position.y = v.current
  })
  return ref
}

function Label({ title, price, accent, kicker, z }: { title: string; price: string; accent: string; kicker: string; z: number }) {
  const rtl = useLang((s) => s.lang) === 'he'
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: cardLabelTexture({ title, price, accent, kicker, rtl }), roughness: 0.7 }),
    [title, price, accent, kicker, rtl],
  )
  return (
    <mesh position={[0, 0.055, z]} rotation-x={-Math.PI / 2 + 0.3} material={mat} castShadow receiveShadow>
      <boxGeometry args={[0.84, 0.342, 0.006]} />
    </mesh>
  )
}

export function FillingRamekin({ filling, x, z, scale }: { filling: FillingOption; x: number; z: number; scale: number }) {
  const applied = useBuilder((s) => s.design.fillingId === filling.id)
  const lang = useLang((s) => s.lang)
  const hovered = useTool((s) => s.hovered)
  const held = useTool((s) => s.held)
  const isHover = hovered?.kind === 'filling' && hovered.id === filling.id
  const lift = useLift(isHover && !held)

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    interaction.hover({ kind: 'filling', id: filling.id })
    interaction.setTooltipAnchor(new THREE.Vector3(x, 0.5, z))
  }
  const onOut = () => {
    interaction.hover(null)
    interaction.setTooltipAnchor(null)
  }
  return (
    <group position={[x, 0, z]} scale={scale}>
      <SelectGlow on={applied} hover={isHover} radius={0.34} />
      <group ref={lift} onPointerDown={(e) => interaction.pickFilling(e, filling.id)} onPointerOver={onOver} onPointerOut={onOut}>
        <mesh geometry={ramekinGeometry()} material={ceramicMaterial()} castShadow receiveShadow />
        <mesh geometry={creamGeometry()} material={fillingCreamMaterial(filling.color)} receiveShadow />
        <mesh position={[0, 0.15, 0]} material={hitMaterial}>
          <cylinderGeometry args={[0.36, 0.36, 0.32, 16]} />
        </mesh>
      </group>
      <Label title={shortOf(filling, lang)} price={money(filling.price)} accent={filling.color} kicker={dictionaries[lang].kFilling} z={0.5} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Extras                                                             */
/* ------------------------------------------------------------------ */

const copper = new THREE.MeshStandardMaterial({ color: '#c8865a', metalness: 1, roughness: 0.28 })
const oak = new THREE.MeshStandardMaterial({ color: '#b78553', roughness: 0.6 })
const paper = new THREE.MeshStandardMaterial({ color: '#fbf7ef', roughness: 0.8 })

function ExtraModel({ id }: { id: string }) {
  switch (id) {
    case 'warm':
      return (
        <group>
          <mesh position={[0, 0.02, 0]} material={oak} castShadow receiveShadow>
            <cylinderGeometry args={[0.27, 0.28, 0.04, 40]} />
          </mesh>
          <mesh position={[0, 0.04, 0]} material={copper} castShadow>
            <sphereGeometry args={[0.235, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0, 0.3, 0]} material={copper} castShadow>
            <sphereGeometry args={[0.04, 20, 12]} />
          </mesh>
        </group>
      )
    case 'candle':
      return (
        <group>
          <mesh position={[0, 0.07, 0]} material={ceramicMaterial('#f2e6d0')} castShadow receiveShadow>
            <cylinderGeometry args={[0.16, 0.14, 0.14, 32]} />
          </mesh>
          {[
            ['#f27ba6', -0.05, 0.02, 0.1],
            ['#6ec3f2', 0.05, -0.02, -0.12],
            ['#ffd457', 0.0, 0.06, 0.05],
          ].map(([c, cx, cz, tilt], i) => (
            <group key={i} position={[cx as number, 0.14, cz as number]} rotation-z={tilt as number}>
              <mesh position={[0, 0.14, 0]} material={plasticMaterial(c as string, 0.5)} castShadow>
                <cylinderGeometry args={[0.022, 0.022, 0.3, 12]} />
              </mesh>
              <mesh position={[0, 0.3, 0]}>
                <cylinderGeometry args={[0.003, 0.003, 0.03, 4]} />
                <meshStandardMaterial color="#222" />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'sauce-cup':
      return (
        <group>
          {[0, 1].map((k) => (
            <group key={k} position={[k * 0.22 - 0.11, k * 0.0, k * -0.06]}>
              <mesh position={[0, 0.07, 0]} material={paper} castShadow receiveShadow>
                <cylinderGeometry args={[0.13, 0.1, 0.14, 32]} />
              </mesh>
              <mesh position={[0, 0.145, 0]} material={plasticMaterial('#efe8dc', 0.15)} castShadow>
                <cylinderGeometry args={[0.135, 0.135, 0.012, 32]} />
              </mesh>
              <mesh position={[0, 0.06, 0]}>
                <cylinderGeometry args={[0.121, 0.113, 0.03, 32, 1, true]} />
                <meshStandardMaterial color="#93AE57" roughness={0.6} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'gift':
      return (
        <group>
          <mesh position={[0, 0.015, 0]} material={oak} castShadow receiveShadow>
            <cylinderGeometry args={[0.24, 0.24, 0.03, 40]} />
          </mesh>
          <mesh position={[0, 0.11, 0]} castShadow>
            <cylinderGeometry args={[0.19, 0.19, 0.16, 40]} />
            <meshPhysicalMaterial color="#93AE57" roughness={0.4} sheen={1} sheenColor="#d8f0a8" />
          </mesh>
          <mesh position={[0, 0.205, 0]} material={oak} castShadow>
            <cylinderGeometry args={[0.24, 0.24, 0.03, 40]} />
          </mesh>
          <mesh position={[0.26, 0.004, 0.08]} rotation-y={-0.4}>
            <boxGeometry args={[0.32, 0.006, 0.1]} />
            <meshPhysicalMaterial color="#93AE57" roughness={0.4} sheen={1} sheenColor="#d8f0a8" />
          </mesh>
        </group>
      )
    default:
      return (
        <mesh position={[0, 0.1, 0]} material={paper}>
          <boxGeometry args={[0.3, 0.2, 0.3]} />
        </mesh>
      )
  }
}

export function ExtraItem({ extra, x, z, scale }: { extra: ExtraOption; x: number; z: number; scale: number }) {
  const on = useBuilder((s) => s.design.extras.includes(extra.id))
  const lang = useLang((s) => s.lang)
  const hovered = useTool((s) => s.hovered)
  const held = useTool((s) => s.held)
  const isHover = hovered?.kind === 'extra' && hovered.id === extra.id
  const lift = useLift((isHover && !held) || on)
  return (
    <group position={[x, 0, z]} scale={scale}>
      <SelectGlow on={on} hover={isHover} radius={0.3} />
      <group
        ref={lift}
        onPointerDown={(e) => interaction.toggleExtra(e, extra.id)}
        onPointerOver={(e) => {
          e.stopPropagation()
          interaction.hover({ kind: 'extra', id: extra.id })
          interaction.setTooltipAnchor(new THREE.Vector3(x, 0.55, z))
        }}
        onPointerOut={() => {
          interaction.hover(null)
          interaction.setTooltipAnchor(null)
        }}
      >
        <ExtraModel id={extra.id} />
        <mesh position={[0, 0.17, 0]} material={hitMaterial}>
          <cylinderGeometry args={[0.32, 0.32, 0.36, 16]} />
        </mesh>
      </group>
      <Label
        title={shortOf(extra, lang)}
        price={extra.price === 0 ? dictionaries[lang].free : money(extra.price)}
        accent="#C9883F"
        kicker={dictionaries[lang].kExtra}
        z={0.45}
      />
    </group>
  )
}

export function FrontStation() {
  const layout = runtime.layout
  return (
    <group>
      {catalog.fillings.map((f) => {
        const slot = layout.ramekins[f.id]
        return slot ? <FillingRamekin key={f.id} filling={f} x={slot.x} z={slot.z} scale={slot.scale} /> : null
      })}
      {catalog.extras.map((e) => {
        const slot = layout.extras[e.id]
        return slot ? <ExtraItem key={e.id} extra={e} x={slot.x} z={slot.z} scale={slot.scale} /> : null
      })}
    </group>
  )
}
