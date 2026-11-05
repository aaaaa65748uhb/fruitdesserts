import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { findBase, findFilling } from '../config/catalog'
import { useBuilder } from '../store/builderStore'
import { buildRollGeometry, paintRoll, type RollData, type RollPaint } from './rollGeometry'
import { rollSurface } from './surface'
import { runtime } from './runtime'
import { doughMaterial } from './materials'
import { interaction } from './interaction'
import { damp } from '../lib/noise'

let rollData: RollData | null = null

/** The roll mesh is generated once and shared (it is identical for every base). */
export function getRollData(): RollData {
  if (!rollData) {
    rollData = buildRollGeometry()
    rollSurface.build(rollData.geometry)
    runtime.rollData = rollData
  }
  return rollData
}

function targetPaint(baseId: string, fillingId: string | null): RollPaint {
  const base = findBase(baseId)
  const filling = findFilling(fillingId)
  const fillColor = new THREE.Color(base.colors.filling)
  if (filling) fillColor.lerp(new THREE.Color(filling.color), 0.85)
  return {
    dough: new THREE.Color(base.colors.dough),
    crust: new THREE.Color(base.colors.crust),
    bottom: new THREE.Color(base.colors.bottom),
    filling: fillColor,
    fillStrength: filling ? 1 : 0.88,
  }
}

export function CinnamonRoll3D() {
  const data = getRollData()
  const baseId = useBuilder((s) => s.design.baseId)
  const fillingId = useBuilder((s) => s.design.fillingId)
  const meshRef = useRef<THREE.Mesh>(null)

  const target = useMemo(() => targetPaint(baseId, fillingId), [baseId, fillingId])
  const current = useRef<RollPaint | null>(null)
  const settling = useRef(true)

  if (!current.current) {
    current.current = {
      dough: target.dough.clone(),
      crust: target.crust.clone(),
      bottom: target.bottom.clone(),
      filling: target.filling.clone(),
      fillStrength: target.fillStrength,
    }
    paintRoll(data, current.current)
  }

  useEffect(() => {
    settling.current = true
  }, [target])

  useEffect(() => {
    runtime.rollMesh = meshRef.current
    return () => {
      if (runtime.rollMesh === meshRef.current) runtime.rollMesh = null
    }
  }, [])

  useFrame((_, dt) => {
    if (!settling.current || !current.current) return
    const c = current.current
    const k = damp(7, Math.min(dt, 0.05))
    c.dough.lerp(target.dough, k)
    c.crust.lerp(target.crust, k)
    c.bottom.lerp(target.bottom, k)
    c.filling.lerp(target.filling, k)
    c.fillStrength += (target.fillStrength - c.fillStrength) * k
    paintRoll(data, c)
    const diff =
      Math.abs(c.dough.r - target.dough.r) + Math.abs(c.filling.g - target.filling.g) + Math.abs(c.crust.b - target.crust.b)
    if (diff < 0.002) settling.current = false
  })

  return (
    <mesh
      ref={meshRef}
      name="cinnamon-roll"
      geometry={data.geometry}
      material={doughMaterial()}
      castShadow
      receiveShadow
      onPointerDown={(e: ThreeEvent<PointerEvent>) => interaction.rollDown(e)}
      onPointerOver={() => interaction.hover({ kind: 'roll', id: 'roll' })}
      onPointerOut={() => interaction.hover(null)}
    />
  )
}
