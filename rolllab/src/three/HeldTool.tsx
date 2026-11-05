import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { findFilling, findSauce, findTopping } from '../config/catalog'
import { useTool, type HeldTool as Held } from '../store/toolStore'
import { BOTTLE_TIP, SauceBottleModel } from './SauceBottle3D'
import { TrayHeapPieces } from './Topping3D'
import { fillingCreamMaterial, sauceMaterial, steelMaterial } from './materials'
import { runtime } from './runtime'
import { damp } from '../lib/noise'

/**
 * The object currently in the customer's hand. It follows the pointer,
 * tips over to pour above the roll, shakes while sprinkling and flies back
 * to its slot when put down.
 */

const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _anchor = new THREE.Vector3()
const _pos = new THREE.Vector3()

function slotWorld(tool: Held, out: THREE.Vector3) {
  const L = runtime.layout
  const slot = tool.kind === 'sauce' ? L.bottles[tool.id] : tool.kind === 'topping' ? L.trays[tool.id] : L.ramekins[tool.id]
  if (!slot) return out.set(0, 0, 0)
  return out.set(slot.x, tool.kind === 'sauce' ? 0.06 : 0.25, slot.z)
}

export function HeldTool() {
  const held = useTool((s) => s.held)
  const returning = useTool((s) => s.returning)
  const tool = held ?? returning
  const key = tool ? `${tool.kind}:${tool.id}` : 'none'
  return tool ? <HeldObject key={key} tool={tool} isReturning={!held} /> : null
}

function HeldObject({ tool, isReturning }: { tool: Held; isReturning: boolean }) {
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const started = useRef(false)
  const active = useTool((s) => s.active)

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const d = Math.min(dt, 0.05)
    if (!started.current) {
      // start at the slot so the pick-up reads as a lift, not a teleport
      slotWorld(tool, g.position)
      if (tool.kind === 'sauce') g.position.y += 0.0
      started.current = true
    }
    const pose = isReturning ? 'home' : runtime.held.pose
    const t = state.clock.elapsedTime

    // ---- orientation ----
    if (tool.kind === 'sauce') {
      if (pose === 'pour') _e.set(0.18, 0, Math.PI - 0.32)
      else if (pose === 'home') _e.set(0, 0, 0)
      else _e.set(0.12, 0, -0.32)
    } else if (tool.kind === 'topping') {
      if (pose === 'sprinkle') _e.set(0.5 + (runtime.held.shaking ? Math.sin(t * 26) * 0.12 : 0), 0, runtime.held.shaking ? Math.sin(t * 19) * 0.1 : 0)
      else if (pose === 'home') _e.set(0, 0, 0)
      else _e.set(0.15, 0, 0)
    } else {
      if (pose === 'pipe') _e.set(0.1, 0, 0.15)
      else if (pose === 'home') _e.set(0, 0, 0)
      else _e.set(0.25, 0, 0.5)
    }
    _q.setFromEuler(_e)
    g.quaternion.slerp(_q, damp(pose === 'pour' ? 9 : 12, d))

    // ---- position: put the tool's anchor (nozzle / scoop lip / bag tip) on the target ----
    if (isReturning) {
      slotWorld(tool, _pos)
      g.position.lerp(_pos, damp(10, d))
      if (g.position.distanceTo(_pos) < 0.03) useTool.getState().clearReturning()
      return
    }
    if (tool.kind === 'sauce') _anchor.set(0, pose === 'pour' ? BOTTLE_TIP : 0.7, 0)
    else if (tool.kind === 'topping') _anchor.set(0, 0.06, 0.28)
    else _anchor.set(0, 0, 0)
    _anchor.applyQuaternion(g.quaternion)
    _pos.copy(runtime.held.target).sub(_anchor)
    g.position.lerp(_pos, damp(16, d))

    // squeeze while pouring
    if (body.current) {
      const sq = active && tool.kind === 'sauce' ? 0.93 + Math.sin(t * 14) * 0.012 : 1
      body.current.scale.x += (sq - body.current.scale.x) * damp(14, d)
      body.current.scale.z = body.current.scale.x
    }
  })

  return (
    <group ref={group}>
      <group ref={body}>
        {tool.kind === 'sauce' && <HeldBottle id={tool.id} />}
        {tool.kind === 'topping' && <Scoop id={tool.id} />}
        {tool.kind === 'filling' && <PipingBag id={tool.id} />}
      </group>
    </group>
  )
}

function HeldBottle({ id }: { id: string }) {
  const sauce = findSauce(id)
  if (!sauce) return null
  return (
    <group>
      <SauceBottleModel sauce={sauce} />
    </group>
  )
}

let scoopGeo: THREE.LatheGeometry | null = null
function Scoop({ id }: { id: string }) {
  const topping = findTopping(id)
  const geo = useMemo(() => {
    if (scoopGeo) return scoopGeo
    const prof: THREE.Vector2[] = []
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * (Math.PI / 2)
      prof.push(new THREE.Vector2(Math.sin(a) * 0.24, 0.17 - Math.cos(a) * 0.17))
    }
    prof.push(new THREE.Vector2(0.255, 0.18))
    scoopGeo = new THREE.LatheGeometry(prof, 40)
    return scoopGeo
  }, [])
  const heap = useMemo(() => (x: number, z: number) => 0.08 + Math.max(0, 0.05 - (x * x + z * z) * 0.6), [])
  if (!topping) return null
  return (
    <group position={[0, -0.1, 0]}>
      <mesh geometry={geo} material={steelMaterial()} castShadow />
      <mesh position={[0, 0.16, -0.42]} rotation-x={0.3} material={steelMaterial()} castShadow>
        <boxGeometry args={[0.07, 0.03, 0.42]} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 24]} />
        <meshStandardMaterial color={topping.bedColor} roughness={0.9} />
      </mesh>
      <group position={[0, 0.06, 0]}>
        <TrayHeapPieces topping={topping} halfW={0.14} halfD={0.14} heap={heap} scale={0.16} />
      </group>
    </group>
  )
}

function PipingBag({ id }: { id: string }) {
  const filling = findFilling(id)
  const geo = useMemo(() => {
    const prof = [
      [0.0, 0.0],
      [0.03, 0.0],
      [0.035, 0.06],
      [0.16, 0.45],
      [0.2, 0.62],
      [0.17, 0.7],
      [0.05, 0.78],
      [0.0, 0.8],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    return new THREE.LatheGeometry(prof, 32)
  }, [])
  if (!filling) return null
  return (
    <group>
      <mesh geometry={geo} material={fillingCreamMaterial(filling.color)} castShadow />
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.04, 0.02, 0.07, 16]} />
        <meshStandardMaterial color="#e9e4dc" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  The falling stream of sauce                                        */
/* ------------------------------------------------------------------ */

const streamGeo = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 12, 8, true)
  g.translate(0, 0.5, 0)
  // a little taper + wobble, applied per frame via scale
  return g
})()
const splashGeo = new THREE.SphereGeometry(1, 16, 10)

export function SauceStream() {
  const held = useTool((s) => s.held)
  const sauceId = held?.kind === 'sauce' ? held.id : null
  const mesh = useRef<THREE.Mesh>(null)
  const splash = useRef<THREE.Mesh>(null)
  const len = useRef(0)
  const mat = sauceId ? sauceMaterial(sauceId) : null
  const _dir = useMemo(() => new THREE.Vector3(), [])
  const _up = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame((state, dt) => {
    const m = mesh.current
    const s = splash.current
    if (!m || !s) return
    const st = runtime.stream
    const want = st.visible ? 1 : 0
    len.current += (want - len.current) * damp(st.visible ? 22 : 30, dt)
    const visible = len.current > 0.02
    m.visible = visible
    s.visible = visible
    if (!visible) return
    _dir.copy(st.from).sub(st.to)
    const full = _dir.length()
    _dir.normalize()
    // the stream grows downward from the nozzle when pouring starts
    const L = full * len.current
    m.position.copy(st.from).addScaledVector(_dir, -L)
    m.quaternion.setFromUnitVectors(_up, _dir)
    const wobble = 1 + Math.sin(state.clock.elapsedTime * 40) * 0.08
    m.scale.set(st.radius * wobble, L, st.radius * wobble)
    s.position.copy(st.to)
    const r = st.radius * 2.2 * len.current
    s.scale.set(r, r * 0.45, r)
  })

  if (!mat) return null
  return (
    <group>
      <mesh ref={mesh} geometry={streamGeo} material={mat} visible={false} />
      <mesh ref={splash} geometry={splashGeo} material={mat} visible={false} />
    </group>
  )
}
