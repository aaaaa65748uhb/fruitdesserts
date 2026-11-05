import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useBuilder } from '../store/builderStore'
import { useUI } from '../store/uiStore'
import { findSauce } from '../config/catalog'
import { usedSauceIds } from '../engine/customization'
import { CinnamonRoll3D } from './CinnamonRoll3D'
import { SauceLayer } from './SauceLayer'
import { ToppingLayer } from './Topping3D'
import { runtime } from './runtime'
import { rollSurface } from './surface'
import { plasticMaterial } from './materials'
import { createRng, damp } from '../lib/noise'
import { sfx } from '../lib/audio'

/** The roll and everything on it. Lives inside the box. */
export function RollAssembly() {
  const group = useRef<THREE.Group>(null)
  const drop = useRef<THREE.Group>(null)
  const serial = useBuilder((s) => s.rollSerial)
  const baseId = useBuilder((s) => s.design.baseId)
  const screen = useUI((s) => s.screen)
  const yOff = useRef(0)
  const yVel = useRef(0)
  const firstBase = useRef(true)
  const pending = useRef(false)
  const readySince = useRef(0)
  const landed = useRef(true)

  useEffect(() => {
    runtime.rollGroup = group.current
  }, [])

  // a fresh roll waits (hidden) until the lid is open, then drops into the box
  useEffect(() => {
    if (serial === 0) return
    pending.current = true
    readySince.current = 0
    if (drop.current) drop.current.visible = false
  }, [serial])

  useEffect(() => {
    if (firstBase.current) {
      firstBase.current = false
      return
    }
    runtime.popAt = performance.now()
  }, [baseId])

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05)
    if (screen === 'review' || screen === 'checkout') runtime.spin += d * 0.35
    if (group.current) group.current.rotation.y = runtime.spin
    if (pending.current && drop.current) {
      const ui = useUI.getState()
      if (ui.lidOpen && ui.packPhase === 'idle') {
        if (!readySince.current) readySince.current = performance.now()
        if (performance.now() - readySince.current > 380) {
          pending.current = false
          yOff.current = 2.6
          yVel.current = 0
          landed.current = false
          runtime.spin = (Math.random() - 0.5) * 0.6
          drop.current.visible = true
        }
      } else {
        readySince.current = 0
      }
    }
    // spring for the drop-in
    if (drop.current && !pending.current) {
      const k = 70
      const c = 9
      const acc = -k * yOff.current - c * yVel.current
      yVel.current += acc * d
      yOff.current += yVel.current * d
      if (yOff.current < 0 && yVel.current < 0) {
        yOff.current = 0
        if (!landed.current) {
          landed.current = true
          sfx.drop()
        }
        yVel.current = -yVel.current * 0.35
      }
      drop.current.position.y = yOff.current
      // dough swap "pop"
      const since = (performance.now() - runtime.popAt) / 1000
      const pop = since < 0.6 ? Math.sin(since * Math.PI * 3.3) * Math.exp(-since * 6) * 0.09 : 0
      drop.current.scale.set(1 + pop, 1 - pop * 0.8, 1 + pop)
    }
  })

  return (
    <group ref={drop}>
      <group ref={group} name="roll-assembly">
        <CinnamonRoll3D />
        <SauceLayer />
        <ToppingLayer />
        <RollExtras />
      </group>
      <SauceCup />
    </group>
  )
}

/* ------------------------------------------------------------------ */

function RollExtras() {
  const extras = useBuilder((s) => s.design.extras)
  const lidOpen = useUI((s) => s.lidOpen)
  const packPhase = useUI((s) => s.packPhase)
  const open = lidOpen && packPhase === 'idle'
  return (
    <group>
      {extras.includes('candle') && <Candle visible={open || packPhase === 'arriving'} />}
      {extras.includes('warm') && <Steam visible={open} />}
    </group>
  )
}

function Candle({ visible }: { visible: boolean }) {
  const flame = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.Mesh>(null)
  const grp = useRef<THREE.Group>(null)
  const top = useMemo(() => (rollSurface.heightAt(0.05, 0.02) ?? 0.7) + 0.0, [])
  const stripe = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 256
    const x = c.getContext('2d')!
    x.fillStyle = '#fff6ea'
    x.fillRect(0, 0, 64, 256)
    x.strokeStyle = '#f27ba6'
    x.lineWidth = 14
    for (let i = -4; i < 10; i++) {
      x.beginPath()
      x.moveTo(0, i * 40)
      x.lineTo(64, i * 40 + 40)
      x.stroke()
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (flame.current) {
      flame.current.scale.set(1 + Math.sin(t * 23) * 0.06, 1 + Math.sin(t * 17) * 0.12 + Math.sin(t * 31) * 0.05, 1)
      flame.current.rotation.z = Math.sin(t * 9) * 0.08
    }
    if (glow.current) (glow.current.material as THREE.MeshBasicMaterial).opacity = 0.32 + Math.sin(t * 19) * 0.05
    if (grp.current) grp.current.scale.setScalar(THREE.MathUtils.lerp(grp.current.scale.x, visible ? 1 : 0.001, 0.2))
  })
  return (
    <group ref={grp} position={[0.05, top - 0.04, 0.02]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.032, 0.032, 0.42, 16]} />
        <meshStandardMaterial map={stripe} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.43, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.05, 6]} />
        <meshStandardMaterial color="#2a2018" />
      </mesh>
      <mesh ref={flame} position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.03, 16, 12]} />
        <meshBasicMaterial color="#ffd27a" toneMapped={false} />
      </mesh>
      <mesh ref={glow} position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.09, 16, 12]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.3} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

function steamTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62)
  g.addColorStop(0, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

function Steam({ visible }: { visible: boolean }) {
  const count = 7
  const tex = useMemo(() => steamTexture(), [])
  const refs = useRef<(THREE.Sprite | null)[]>([])
  const seeds = useMemo(() => {
    const r = createRng(5)
    return Array.from({ length: count }, () => ({ x: (r() - 0.5) * 1.1, z: (r() - 0.5) * 1.1, o: r(), s: 0.6 + r() * 0.5 }))
  }, [])
  const fade = useRef(0)
  useFrame((state, dt) => {
    fade.current += ((visible ? 1 : 0) - fade.current) * damp(3, dt)
    const t = state.clock.elapsedTime
    seeds.forEach((sd, i) => {
      const sp = refs.current[i]
      if (!sp) return
      const life = (t * 0.22 + sd.o) % 1
      sp.position.set(sd.x + Math.sin(t * 0.8 + i) * 0.08 * life, 0.75 + life * 1.3, sd.z)
      const s = (0.35 + life * 0.9) * sd.s
      sp.scale.set(s, s * 1.3, 1)
      ;(sp.material as THREE.SpriteMaterial).opacity = Math.sin(life * Math.PI) * 0.45 * fade.current
    })
  })
  return (
    <group>
      {seeds.map((_, i) => (
        <sprite key={i} ref={(el) => void (refs.current[i] = el)}>
          <spriteMaterial map={tex} transparent depthWrite={false} opacity={0} />
        </sprite>
      ))}
    </group>
  )
}

function SauceCup() {
  const on = useBuilder((s) => s.design.extras.includes('sauce-cup'))
  const firstSauce = useBuilder((s) => usedSauceIds(s.design)[0])
  const color = findSauce(firstSauce ?? 'salted-caramel')?.color ?? '#C77D2C'
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (!ref.current) return
    const s = ref.current.scale.x + ((on ? 1 : 0.001) - ref.current.scale.x) * damp(10, dt)
    ref.current.scale.setScalar(s)
    ref.current.visible = s > 0.01
  })
  return (
    <group ref={ref} position={[1.05, 0, 1.05]} scale={0.001}>
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.18, 32, 1, true]} />
        <meshStandardMaterial color="#fbf7ef" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.005, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.01, 32]} />
        <meshStandardMaterial color="#fbf7ef" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.15, 0]} material={plasticMaterial(color, 0.12)}>
        <cylinderGeometry args={[0.188, 0.188, 0.02, 32]} />
      </mesh>
    </group>
  )
}
