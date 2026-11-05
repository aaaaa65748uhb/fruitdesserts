import { useMemo } from 'react'
import { tileTexture, woodTexture } from './textures'
import { interaction } from './interaction'

/** Light-oak butcher-block counter with a tiled back wall. */
export function Countertop() {
  const { wood, tiles } = useMemo(() => {
    const w = woodTexture().clone()
    w.needsUpdate = true
    w.repeat.set(4.2, 4.2)
    const t = tileTexture().clone()
    t.needsUpdate = true
    t.repeat.set(6, 2)
    return { wood: w, tiles: t }
  }, [])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow onPointerDown={(e) => interaction.counterDown(e)}>
        <planeGeometry args={[34, 24]} />
        <meshStandardMaterial map={wood} bumpMap={wood} bumpScale={0.6} roughness={0.62} color="#f2e2cc" />
      </mesh>
      <mesh position={[0, 4, -9]} receiveShadow>
        <planeGeometry args={[34, 8]} />
        <meshStandardMaterial map={tiles} roughness={0.35} color="#efe3cf" />
      </mesh>
    </group>
  )
}

export function SceneLighting({ quality }: { quality: 'high' | 'low' }) {
  const shadowSize = quality === 'high' ? 2048 : 1024
  return (
    <>
      <hemisphereLight args={['#fff4e4', '#b88f66', 0.7]} />
      <directionalLight
        position={[-5.5, 11, 4.5]}
        intensity={2.15}
        color="#fff1df"
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-radius={5}
        shadow-blurSamples={16}
      />
      <directionalLight position={[7, 6, 7]} intensity={0.45} color="#ffe6cc" />
      <directionalLight position={[0, 5, -8]} intensity={0.35} color="#fff8f0" />
    </>
  )
}

