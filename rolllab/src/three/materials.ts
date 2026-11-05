import * as THREE from 'three'
import { catalog } from '../config/catalog'
import { brushedTexture, doughBumpTexture } from './textures'

const cache = new Map<string, THREE.Material>()
function once<T extends THREE.Material>(key: string, make: () => T): T {
  const hit = cache.get(key)
  if (hit) return hit as T
  const m = make()
  cache.set(key, m)
  return m
}

export function doughMaterial() {
  return once('dough', () => {
    const bump = doughBumpTexture()
    bump.repeat.set(1, 1)
    return new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.62,
      bumpMap: bump,
      bumpScale: 1.4,
      sheen: 0.22,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color('#ffcf8f'),
      clearcoat: 0.18,
      clearcoatRoughness: 0.5,
    })
  })
}

export function sauceMaterial(sauceId: string) {
  return once(`sauce:${sauceId}`, () => {
    const s = catalog.sauces.find((x) => x.id === sauceId)
    const color = new THREE.Color(s?.color ?? '#c77d2c')
    const gloss = s?.gloss ?? 0.7
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: THREE.MathUtils.lerp(0.42, 0.1, gloss),
      clearcoat: 0.4 + gloss * 0.6,
      clearcoatRoughness: THREE.MathUtils.lerp(0.25, 0.05, gloss),
      sheen: gloss < 0.6 ? 0.4 : 0,
      sheenColor: color.clone().lerp(new THREE.Color('#ffffff'), 0.5),
      emissive: color.clone().multiplyScalar(0.05),
      side: THREE.DoubleSide,
    })
  })
}

export function fillingCreamMaterial(color: string) {
  return once(`cream:${color}`, () => {
    const c = new THREE.Color(color)
    return new THREE.MeshPhysicalMaterial({
      color: c,
      roughness: 0.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
      emissive: c.clone().multiplyScalar(0.04),
    })
  })
}

export function toppingMaterial(toppingId: string) {
  return once(`top:${toppingId}`, () => {
    const t = catalog.toppings.find((x) => x.id === toppingId)
    if (t?.clearcoat) {
      return new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: t.roughness,
        clearcoat: t.clearcoat,
        clearcoatRoughness: 0.2,
      })
    }
    return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: t?.roughness ?? 0.7, flatShading: t?.shape === 'chunk' || t?.shape === 'shard' })
  })
}

export function steelMaterial() {
  return once('steel', () => {
    const r = brushedTexture()
    r.repeat.set(2, 2)
    return new THREE.MeshStandardMaterial({
      color: '#d9dadc',
      metalness: 1,
      roughness: 0.34,
      roughnessMap: r,
      envMapIntensity: 1.1,
      side: THREE.DoubleSide,
    })
  })
}

export function ceramicMaterial(color = '#fbf7f0') {
  return once(`ceramic:${color}`, () =>
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
  )
}

export function plasticMaterial(color: string, roughness = 0.35) {
  return once(`plastic:${color}:${roughness}`, () =>
    new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
  )
}

export function bottleBodyMaterial(color: string) {
  return once(`bottle:${color}`, () => {
    const c = new THREE.Color(color)
    return new THREE.MeshPhysicalMaterial({
      color: c,
      roughness: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      sheen: 0.3,
      sheenColor: c.clone().lerp(new THREE.Color('#fff'), 0.6),
      emissive: c.clone().multiplyScalar(0.06),
    })
  })
}

export function paperMaterial(map: THREE.Texture, roughness = 0.85) {
  return new THREE.MeshStandardMaterial({ map, roughness })
}
