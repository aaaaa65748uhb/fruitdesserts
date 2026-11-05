import { useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { interaction } from './interaction'
import { runtime } from './runtime'
import { useTool } from '../store/toolStore'
import { useBuilder } from '../store/builderStore'

/** Bridges DOM pointer events + the frame loop to the interaction engine. */
export function InteractionController() {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const move = (e: PointerEvent) => interaction.onMove(e)
    const up = (e: PointerEvent) => interaction.onUp(e)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') interaction.cancel()
    }
    const ctx = (e: MouseEvent) => {
      if (useTool.getState().held) {
        e.preventDefault()
        interaction.cancel()
      }
    }
    const leave = () => interaction.hover(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('keydown', key)
    gl.domElement.addEventListener('contextmenu', ctx)
    gl.domElement.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('keydown', key)
      gl.domElement.removeEventListener('contextmenu', ctx)
      gl.domElement.removeEventListener('pointerleave', leave)
    }
  }, [gl])

  useFrame((state, dt) => interaction.update(state, Math.min(dt, 0.05)))

  // Dev-only hook used by the automated browser tests to find objects on screen.
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __rollLab?: unknown }
    w.__rollLab = {
      project(kind: 'sauce' | 'topping' | 'filling' | 'extra' | 'roll', id = '', dx = 0, dz = 0) {
        const L = runtime.layout
        const slot =
          kind === 'sauce' ? L.bottles[id] : kind === 'topping' ? L.trays[id] : kind === 'filling' ? L.ramekins[id] : kind === 'extra' ? L.extras[id] : L.box
        if (!slot) return null
        const y = kind === 'sauce' ? 0.7 : kind === 'roll' ? 0.72 : 0.15
        const p = new THREE.Vector3(slot.x + dx, y, slot.z + dz).project(camera)
        return { x: (p.x * 0.5 + 0.5) * size.width, y: (-p.y * 0.5 + 0.5) * size.height }
      },
      debug() {
        const d = useBuilder.getState().design
        const group = runtime.rollGroup?.getObjectByName('sauces')
        const meshes: { verts: number; visible: boolean; pos: number[] }[] = []
        group?.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.isMesh) {
            m.geometry.computeBoundingBox()
            const bb = m.geometry.boundingBox
            meshes.push({ verts: m.geometry.getAttribute('position')?.count ?? 0, visible: m.visible, pos: bb ? [bb.min.y, bb.max.y].map((v) => +v.toFixed(3)) : [] })
          }
        })
        return {
          sauces: d.sauces.map((s) => ({ id: s.sauceId, kind: s.kind, n: s.points.length / 4, vol: +s.volume.toFixed(5), drips: s.drips.length, y: s.points.slice(1, 2) })),
          toppings: d.toppings.map((b) => ({ id: b.toppingId, n: b.pieces.length })),
          meshes,
          live: runtime.live.strokeId,
        }
      },
      material() {
        const group = runtime.rollGroup?.getObjectByName('sauces')
        let out: unknown = null
        group?.traverse((o) => {
          const m = o as THREE.Mesh
          if (!m.isMesh || out) return
          const mat = m.material as THREE.MeshPhysicalMaterial
          const n = m.geometry.getAttribute('normal')
          let ny = 0
          for (let i = 0; i < n.count; i++) ny += n.getY(i)
          out = { type: mat.type, color: mat.color.getHexString(), side: mat.side, ny: ny / n.count, opacity: mat.opacity, visible: m.visible, worldScale: m.getWorldScale(new THREE.Vector3()).toArray() }
        })
        return out
      },
    }
  }, [camera, size])
  return null
}

const _p = new THREE.Vector3()

/** Positions the HTML tooltip over the hovered 3D object (no React re-render). */
export function TooltipTracker() {
  const size = useThree((s) => s.size)
  useFrame(({ camera }) => {
    const el = document.getElementById('rl-tooltip')
    if (!el) return
    if (!runtime.tooltipVisible || useTool.getState().held) {
      el.style.opacity = '0'
      return
    }
    _p.copy(runtime.tooltipAnchor).project(camera)
    const x = (_p.x * 0.5 + 0.5) * size.width
    const y = (-_p.y * 0.5 + 0.5) * size.height
    el.style.opacity = '1'
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`
  })
  return null
}
