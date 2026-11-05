import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useUI } from '../store/uiStore'
import { useBuilder } from '../store/builderStore'
import { useTool } from '../store/toolStore'
import { boxInsideTexture, boxLidTopTexture, boxSideTexture, parchmentTexture, plainCardboardTexture, stickerTexture } from './textures'
import { interaction } from './interaction'
import { createNoise3D, damp } from '../lib/noise'

/**
 * ROLL LAB pastry box — a tuck-top bakery box:
 *  - a base tray with low walls (so the roll is fully visible while you build)
 *  - a hinged lid with front & side flaps that closes over the roll
 *  - a parchment liner, a "MADE BY YOU" seal and an optional gift ribbon
 */

export const BOX = { outer: 2.8, baseH: 0.34, lidH: 0.62, t: 0.026 }
const OPEN_ANGLE = -2.22

function useCardboard() {
  return useMemo(() => {
    const plain = plainCardboardTexture()
    plain.repeat.set(2, 2)
    const plainMat = new THREE.MeshStandardMaterial({ map: plain, roughness: 0.92 })
    const sideMat = new THREE.MeshStandardMaterial({ map: boxSideTexture(), roughness: 0.9 })
    const topMat = new THREE.MeshStandardMaterial({ map: boxLidTopTexture(), roughness: 0.88 })
    const inside = boxInsideTexture()
    const insideMat = new THREE.MeshStandardMaterial({ map: inside, roughness: 0.9 })
    return { plainMat, sideMat, topMat, insideMat }
  }, [])
}

function linerGeometry() {
  const half = BOX.outer / 2 - BOX.t - 0.012
  const g = new THREE.PlaneGeometry(half * 2, half * 2, 56, 56)
  g.rotateX(-Math.PI / 2)
  const noise = createNoise3D(4)
  const p = g.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const edge = Math.max(Math.abs(x), Math.abs(z))
    const curl = Math.max(0, (edge - (half - 0.16)) / 0.16)
    let y = 0.034 + noise(x * 3, z * 3, 0) * 0.004 + noise(x * 9, z * 9, 2) * 0.002
    y += curl * curl * 0.13 + Math.max(0, noise(x * 2.5, z * 2.5, 5)) * curl * 0.05
    p.setY(i, y)
  }
  g.computeVertexNormals()
  return g
}

function Ribbon({ visible }: { visible: boolean }) {
  const mat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#93AE57', roughness: 0.38, sheen: 1, sheenColor: new THREE.Color('#e3f5b8'), clearcoat: 0.3 }),
    [],
  )
  const ref = useRef<THREE.Group>(null)
  const s = useRef(0)
  useFrame((_, dt) => {
    if (!ref.current) return
    s.current += ((visible ? 1 : 0) - s.current) * damp(9, dt)
    ref.current.visible = s.current > 0.02
    ref.current.scale.setScalar(0.85 + 0.15 * s.current)
  })
  const H = BOX.baseH + BOX.lidH
  const W = BOX.outer + 0.03
  return (
    <group ref={ref} visible={false}>
      <mesh position={[0, H + 0.008, 0]} material={mat} castShadow>
        <boxGeometry args={[W, 0.012, 0.17]} />
      </mesh>
      <mesh position={[0, H + 0.008, 0]} material={mat} castShadow>
        <boxGeometry args={[0.17, 0.012, W]} />
      </mesh>
      {[
        [W / 2, 0, 0.012, 0.17],
        [-W / 2, 0, 0.012, 0.17],
      ].map(([x], i) => (
        <mesh key={`x${i}`} position={[x, H / 2, 0]} material={mat}>
          <boxGeometry args={[0.012, H, 0.17]} />
        </mesh>
      ))}
      {[W / 2, -W / 2].map((z, i) => (
        <mesh key={`z${i}`} position={[0, H / 2, z]} material={mat}>
          <boxGeometry args={[0.17, H, 0.012]} />
        </mesh>
      ))}
      {/* bow */}
      <group position={[0, H + 0.05, 0]}>
        {[-1, 1].map((sgn) => (
          <mesh key={sgn} position={[sgn * 0.17, 0.02, 0]} rotation={[Math.PI / 2, 0, sgn * 0.5]} scale={[1.25, 1, 0.55]} material={mat} castShadow>
            <torusGeometry args={[0.15, 0.045, 12, 32]} />
          </mesh>
        ))}
        <mesh material={mat} castShadow>
          <sphereGeometry args={[0.07, 16, 12]} />
        </mesh>
        {[-1, 1].map((sgn) => (
          <mesh key={`t${sgn}`} position={[sgn * 0.1, -0.03, 0.2]} rotation={[0, sgn * 0.5, 0]} material={mat}>
            <boxGeometry args={[0.1, 0.01, 0.36]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function Packaging3D({ x, z, children }: { x: number; z: number; children?: ReactNode }) {
  const mats = useCardboard()
  const liner = useMemo(() => linerGeometry(), [])
  const linerMat = useMemo(() => {
    const t = parchmentTexture()
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.78, side: THREE.DoubleSide })
  }, [])
  const stickerMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: stickerTexture(), transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
    [],
  )

  const lidOpen = useUI((s) => s.lidOpen)
  const packPhase = useUI((s) => s.packPhase)
  const gift = useBuilder((s) => s.design.extras.includes('gift'))
  const hovered = useTool((s) => s.hovered)

  const root = useRef<THREE.Group>(null)
  const lid = useRef<THREE.Group>(null)
  const sticker = useRef<THREE.Mesh>(null)
  const angle = useRef(0)
  const stickerS = useRef(0)

  const { outer: O, baseH, lidH, t } = BOX
  const lidW = O + 0.04

  useEffect(() => {
    if (packPhase === 'arriving' && root.current) {
      root.current.position.x = x - 11
      root.current.position.y = 0
    }
  }, [packPhase, x])

  useFrame((_, dt) => {
    const g = root.current
    if (!g) return
    const d = Math.min(dt, 0.05)
    // lid
    const wantOpen = lidOpen && packPhase !== 'closing' && packPhase !== 'sealed' && packPhase !== 'leaving'
    const target = wantOpen ? OPEN_ANGLE : 0
    angle.current += (target - angle.current) * damp(wantOpen ? 5 : 6.5, d)
    if (lid.current) lid.current.rotation.x = angle.current
    // sticker pop
    const showSticker = packPhase === 'sealed' || packPhase === 'leaving'
    stickerS.current += ((showSticker ? 1 : 0) - stickerS.current) * damp(showSticker ? 14 : 30, d)
    if (sticker.current) {
      const s = stickerS.current
      sticker.current.visible = s > 0.02
      sticker.current.scale.setScalar(s * (1 + 0.25 * Math.sin(s * Math.PI)))
    }
    // travel
    let tx = x
    let ty = 0
    if (packPhase === 'leaving') {
      tx = x + 11
      ty = 0.6
    }
    g.position.x += (tx - g.position.x) * damp(packPhase === 'leaving' ? 3.2 : 4.2, d)
    g.position.y += (ty - g.position.y) * damp(5, d)
    g.position.z = z
    g.rotation.z = (g.position.x - tx) * -0.01
  })

  const lidHover = hovered?.kind === 'lid' && hovered.id === 'box'
  const onLidOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    interaction.hover({ kind: 'lid', id: 'box' })
  }

  return (
    <group ref={root} position={[x, 0, z]}>
      {/* ---------- base tray ---------- */}
      <mesh position={[0, 0.013, 0]} material={mats.plainMat} receiveShadow castShadow>
        <boxGeometry args={[O, 0.026, O]} />
      </mesh>
      {/* front wall (printed) */}
      <mesh position={[0, baseH / 2, O / 2 - t / 2]} receiveShadow castShadow material={[mats.plainMat, mats.plainMat, mats.plainMat, mats.plainMat, mats.sideMat, mats.plainMat]}>
        <boxGeometry args={[O, baseH, t]} />
      </mesh>
      <mesh position={[0, baseH / 2, -O / 2 + t / 2]} receiveShadow castShadow material={mats.plainMat}>
        <boxGeometry args={[O, baseH, t]} />
      </mesh>
      {[-1, 1].map((sgn) => (
        <mesh key={sgn} position={[sgn * (O / 2 - t / 2), baseH / 2, 0]} receiveShadow castShadow material={mats.plainMat}>
          <boxGeometry args={[t, baseH, O - t * 2]} />
        </mesh>
      ))}
      <mesh geometry={liner} material={linerMat} receiveShadow />

      {/* contents (roll, extras) */}
      <group position={[0, 0.04, 0]}>{children}</group>

      {/* ---------- hinged lid ---------- */}
      <group ref={lid} position={[0, baseH, -O / 2]}>
        <group
          onPointerDown={(e) => interaction.lidDown(e)}
          onPointerOver={onLidOver}
          onPointerOut={() => interaction.hover(null)}
        >
          {/* back panel */}
          <mesh position={[0, lidH / 2, -0.012]} material={mats.plainMat} castShadow receiveShadow>
            <boxGeometry args={[lidW, lidH, t]} />
          </mesh>
          {/* top panel: printed outside, greeting inside */}
          <mesh
            position={[0, lidH, O / 2 - 0.0]}
            castShadow
            receiveShadow
            material={[mats.plainMat, mats.plainMat, mats.topMat, mats.insideMat, mats.plainMat, mats.plainMat]}
          >
            <boxGeometry args={[lidW, t, O + 0.03]} />
          </mesh>
          {/* front tuck flap */}
          <mesh position={[0, lidH / 2, O + 0.012]} material={mats.plainMat} castShadow receiveShadow>
            <boxGeometry args={[lidW, lidH, t]} />
          </mesh>
          {[-1, 1].map((sgn) => (
            <mesh key={sgn} position={[sgn * (lidW / 2 - t / 2), lidH / 2, O / 2]} material={mats.plainMat} castShadow receiveShadow>
              <boxGeometry args={[t, lidH, O]} />
            </mesh>
          ))}
          <mesh ref={sticker} position={[0.72, lidH + t / 2 + 0.003, O - 0.55]} rotation-x={-Math.PI / 2} material={stickerMat} visible={false}>
            <circleGeometry args={[0.36, 48]} />
          </mesh>
          {lidHover && (
            <mesh position={[0, lidH + 0.02, O / 2]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[lidW, O]} />
              <meshBasicMaterial color="#fff6dc" transparent opacity={0.08} depthWrite={false} />
            </mesh>
          )}
        </group>
      </group>
      <Ribbon visible={gift && (packPhase === 'sealed' || packPhase === 'leaving')} />
    </group>
  )
}
