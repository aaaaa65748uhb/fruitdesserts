import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useUI } from '../store/uiStore'
import { layoutFor } from './layout'
import { runtime, useRuntime } from './runtime'
import { Countertop, SceneLighting } from './Countertop'
import { CameraRig, type SafeArea } from './CameraRig'
import { Packaging3D } from './Packaging3D'
import { RollAssembly } from './RollAssembly'
import { BottleStation } from './SauceBottle3D'
import { TrayStation } from './IngredientTray'
import { FrontStation } from './FillingRamekin'
import { HeldTool, SauceStream } from './HeldTool'
import { InteractionController, TooltipTracker } from './InteractionController'

/**
 * MainWorkspace — the physical counter.
 * Everything you see is real-time 3D: no images, no pre-rendered video.
 */

function detectQuality(): 'high' | 'low' {
  if (typeof window === 'undefined') return 'high'
  const params = new URLSearchParams(window.location.search)
  const q = params.get('quality')
  if (q === 'low' || q === 'high') return q
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  const cores = navigator.hardwareConcurrency ?? 4
  return coarse || small || cores <= 4 ? 'low' : 'high'
}

function safeAreaFor(width: number, height: number): SafeArea {
  if (height < 520 && width > height) return { top: 54, bottom: 78, side: 6 }
  if (width < 720) return { top: 62, bottom: 176, side: 6 }
  return { top: 76, bottom: 124, side: 18 }
}

function Stations() {
  const size = useThree((s) => s.size)
  const mode = size.width / size.height >= 1.05 ? 'wide' : 'tall'
  const layout = useMemo(() => layoutFor(mode === 'wide' ? 2 : 0.5), [mode])
  runtime.layout = layout
  const setLayoutMode = useRuntime((s) => s.setLayoutMode)
  useEffect(() => setLayoutMode(mode), [mode, setLayoutMode])
  const safe = useMemo(() => safeAreaFor(size.width, size.height), [size.width, size.height])
  return (
    <group key={mode}>
      <CameraRig safe={safe} />
      <Packaging3D x={layout.box.x} z={layout.box.z}>
        <RollAssembly />
      </Packaging3D>
      <BottleStation />
      <TrayStation />
      <FrontStation />
      <HeldTool />
      <SauceStream />
    </group>
  )
}

/** Registers a function that captures a square thumbnail around the roll. */
function SnapshotProvider() {
  const { gl, scene, camera, size } = useThree()
  useEffect(() => {
    runtime.snapshot = async () => {
      try {
        const prevTM = gl.toneMapping
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.render(scene, camera)
        gl.toneMapping = prevTM
        const src = gl.domElement
        const box = runtime.layout.box
        const center = new THREE.Vector3(box.x, 0.45, box.z).project(camera)
        const edge = new THREE.Vector3(box.x, 0.45, box.z)
          .add(new THREE.Vector3(1.35, 0, 0).applyQuaternion(camera.quaternion))
          .project(camera)
        const cx = (center.x * 0.5 + 0.5) * src.width
        const cy = (-center.y * 0.5 + 0.5) * src.height
        const r = Math.max(40, Math.abs(edge.x - center.x) * 0.5 * src.width)
        const out = document.createElement('canvas')
        out.width = out.height = 320
        const ctx = out.getContext('2d')!
        ctx.fillStyle = '#F4EAD9'
        ctx.fillRect(0, 0, 320, 320)
        ctx.drawImage(src, cx - r, cy - r, r * 2, r * 2, 0, 0, 320, 320)
        return out.toDataURL('image/jpeg', 0.82)
      } catch {
        return null
      }
    }
    return () => {
      runtime.snapshot = null
    }
  }, [gl, scene, camera, size])
  return null
}

function ReadySignal() {
  const frames = useRef(0)
  const setReady = useUI((s) => s.setSceneReady)
  useFrame(() => {
    frames.current++
    if (frames.current === 3) setReady()
  })
  return null
}

export function MainWorkspace() {
  const [quality, setQuality] = useState<'high' | 'low'>(detectQuality)
  const [dpr, setDpr] = useState(quality === 'high' ? 1.75 : 1.5)

  return (
    <Canvas
      className="rl-canvas"
      shadows="percentage"
      dpr={[1, dpr]}
      camera={{ fov: 30, near: 0.1, far: 120, position: [3, 2.4, 6] }}
      gl={{ antialias: quality === 'low', powerPreference: 'high-performance', alpha: false, stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.0
      }}
    >
      <color attach="background" args={['#efe4d3']} />
      <PerformanceMonitor
        onDecline={() => {
          setDpr((d) => Math.max(1, d - 0.25))
          if (quality === 'high') setQuality('low')
        }}
      />
      <Suspense fallback={null}>
        <SceneLighting quality={quality} />
        <Environment resolution={256} frames={1} environmentIntensity={0.85}>
          <color attach="background" args={['#5c4838']} />
          <Lightformer form="rect" intensity={2.4} position={[0, 7, 1]} rotation-x={Math.PI / 2} scale={[14, 9, 1]} color="#fff6ea" />
          <Lightformer form="rect" intensity={3.2} position={[-8, 3, 2]} rotation-y={Math.PI / 2} scale={[9, 4, 1]} color="#ffe8cc" />
          <Lightformer form="rect" intensity={1.3} position={[8, 2.5, -1]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} color="#eef3ff" />
          <Lightformer form="ring" intensity={1.6} position={[2, 5, 7]} scale={3} color="#ffffff" />
        </Environment>
        <Countertop />
        <Stations />
        <InteractionController />
        <TooltipTracker />
        <SnapshotProvider />
        <ReadySignal />
        {quality === 'high' && (
          <EffectComposer multisampling={4} enableNormalPass={false}>
            <N8AO aoRadius={0.5} distanceFalloff={0.6} intensity={2.2} quality="low" />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <Vignette offset={0.3} darkness={0.38} />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  )
}
