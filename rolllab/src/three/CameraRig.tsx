import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useUI } from '../store/uiStore'
import { runtime } from './runtime'
import type { CounterLayout } from './layout'
import { damp } from '../lib/noise'
import { BOX } from './Packaging3D'

/**
 * Camera choreography. The overview pose is *computed*: we search for the
 * camera distance that fits the whole counter between the top bar and the
 * bottom dock on any screen size.
 */

export interface SafeArea {
  top: number
  bottom: number
  side: number
}

const _cam = new THREE.PerspectiveCamera()
const _v = new THREE.Vector3()

export function fitOverview(layout: CounterLayout, width: number, height: number, fov: number, safe: SafeArea) {
  const el = (layout.elevation * Math.PI) / 180
  const dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el))
  const { minX, maxX, minZ, maxZ } = layout.bounds
  const lidTopZ = layout.box.z - BOX.outer / 2 - 2.1
  // the last two points (open lid) may use the empty centre of the header
  const pts = [
    new THREE.Vector3(minX, 0, minZ),
    new THREE.Vector3(maxX, 0, minZ),
    new THREE.Vector3(minX, 0, maxZ),
    new THREE.Vector3(maxX, 0, maxZ),
    new THREE.Vector3(minX, 1.6, minZ + 0.3),
    new THREE.Vector3(maxX, 1.6, minZ + 0.3),
    new THREE.Vector3(layout.box.x - 1.4, 2.25, lidTopZ),
    new THREE.Vector3(layout.box.x + 1.4, 2.25, lidTopZ),
  ]
  const yTop = 1 - (2 * safe.top) / height
  const yBot = -1 + (2 * safe.bottom) / height
  const xLim = 1 - (2 * safe.side) / width
  const lidAllowance = (2 * Math.max(0, safe.top - 14)) / height
  _cam.fov = fov
  _cam.aspect = width / height
  _cam.near = 0.1
  _cam.far = 200
  _cam.updateProjectionMatrix()

  const target = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2)
  let dist = 12
  const measure = (d: number) => {
    _cam.position.copy(target).addScaledVector(dir, d)
    _cam.lookAt(target)
    _cam.updateMatrixWorld()
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    pts.forEach((p, i) => {
      _v.copy(p).project(_cam)
      x0 = Math.min(x0, _v.x)
      x1 = Math.max(x1, _v.x)
      y0 = Math.min(y0, _v.y)
      y1 = Math.max(y1, _v.y - (i >= pts.length - 2 ? lidAllowance : 0))
    })
    return { x0, x1, y0, y1 }
  }
  for (let iter = 0; iter < 4; iter++) {
    let lo = 3
    let hi = 80
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2
      const m = measure(mid)
      const fits = m.x1 - m.x0 <= xLim * 2 && m.y1 - m.y0 <= yTop - yBot
      if (fits) hi = mid
      else lo = mid
    }
    dist = hi
    // re-centre vertically inside the safe band
    const m = measure(dist)
    const want = (yTop + yBot) / 2
    const have = (m.y0 + m.y1) / 2
    const shift = (have - want) * dist * Math.tan(((fov / 2) * Math.PI) / 180) * 0.9
    target.z -= shift / Math.sin(el)
  }
  const position = target.clone().addScaledVector(dir, dist)
  return { position, target }
}

export function CameraRig({ safe }: { safe: SafeArea }) {
  const { camera, size } = useThree()
  const screen = useUI((s) => s.screen)
  const inspect = useUI((s) => s.inspect)
  const packPhase = useUI((s) => s.packPhase)
  const controls = useRef<OrbitControlsImpl>(null)
  const pos = useRef(new THREE.Vector3(3, 2.4, 6))
  const look = useRef(new THREE.Vector3(0, 0.4, 0))
  const handedOff = useRef(false)
  const [orbitOn, setOrbitOn] = useState(false)
  const layout = runtime.layout
  const fov = (camera as THREE.PerspectiveCamera).fov

  const overview = useMemo(
    () => fitOverview(layout, size.width, size.height, fov, safe),
    [layout, size.width, size.height, fov, safe],
  )

  const tall = size.width / size.height < 1.05

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05)
    const box = layout.box
    const roll = _v.set(box.x, 0.45, box.z)
    let p: THREE.Vector3
    let l: THREE.Vector3
    let speed = 2.6

    if (inspect && screen === 'build') {
      if (handedOff.current) {
        // OrbitControls own the camera now; keep our state in sync
        pos.current.copy(camera.position)
        if (controls.current) look.current.copy(controls.current.target)
        return
      }
      p = new THREE.Vector3(roll.x, roll.y + 2.4, roll.z + 3.3)
      l = roll.clone()
      speed = 3.5
      if (camera.position.distanceTo(p) < 0.08) {
        handedOff.current = true
        setOrbitOn(true)
      }
    } else {
      if (handedOff.current) {
        handedOff.current = false
        setOrbitOn(false)
      }
      const t = state.clock.elapsedTime
      if (screen === 'intro') {
        if (tall) {
          p = new THREE.Vector3(box.x + Math.sin(t * 0.25) * 0.5, 4.6, box.z + 5.4)
          l = new THREE.Vector3(box.x, 0.2, box.z - 0.9)
        } else {
          p = new THREE.Vector3(box.x + 0.7 + Math.sin(t * 0.25) * 0.5, 2.9, box.z + 4.6)
          l = new THREE.Vector3(box.x - 1.55, 0.55, box.z)
        }
        speed = 1.6
      } else if (screen === 'review' || screen === 'checkout') {
        if (tall) {
          p = new THREE.Vector3(roll.x, roll.y + 4.2, roll.z + 4.2)
          l = new THREE.Vector3(roll.x, roll.y - 0.9, roll.z + 1.0)
        } else {
          p = new THREE.Vector3(roll.x + 1.3, roll.y + 2.7, roll.z + 3.6)
          l = new THREE.Vector3(roll.x + 1.25, roll.y - 0.1, roll.z)
        }
      } else if (packPhase === 'closing' || packPhase === 'sealed') {
        p = new THREE.Vector3(box.x, 4.6, box.z + 5.4)
        l = new THREE.Vector3(box.x, 0.4, box.z)
      } else {
        p = overview.position
        l = overview.target
      }
    }
    pos.current.lerp(p, damp(speed, d))
    look.current.lerp(l, damp(speed, d))
    camera.position.copy(pos.current)
    camera.lookAt(look.current)
  })

  const enabled = orbitOn && inspect && screen === 'build'
  return (
    <OrbitControls
      ref={controls}
      enabled={enabled}
      enablePan={false}
      target={[layout.box.x, 0.45, layout.box.z]}
      minDistance={2.2}
      maxDistance={7}
      maxPolarAngle={Math.PI * 0.47}
      enableDamping
      makeDefault={false}
    />
  )
}
