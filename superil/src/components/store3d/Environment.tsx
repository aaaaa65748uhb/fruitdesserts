"use client";
import type { ThreeElements } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { InstancedBoxes } from "./InstancedBoxes";
import type { BoxSpec, Sign, StoreLayout } from "./layout";
import { buildFloorTexture, buildSignTexture } from "./textures";

const CEILING = 4.6;

export function StoreShell({ layout, quality }: { layout: StoreLayout; quality: "high" | "low" }) {
  const b = layout.bounds;
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const floorTex = useMemo(() => {
    const t = buildFloorTexture();
    t.repeat.set(w / 1.2, d / 1.2);
    return t;
  }, [w, d]);
  useEffect(() => () => floorTex.dispose(), [floorTex]);

  const materials = useMemo(
    () => ({
      metal: new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 0.45, roughness: 0.4 }),
      white: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.75 }),
      wood: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 }),
      dark: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6 }),
      accent: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 }),
      glass: new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false }),
      glow: new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }),
    }),
    [],
  );
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  // Ceiling light panels
  const lightPanels: BoxSpec[] = useMemo(
    () => layout.lights.filter((_, i) => quality === "high" || i % 2 === 0).map((p) => ({ pos: p, size: [1.2, 0.04, 0.6] as [number, number, number], color: "#fffdf5" })),
    [layout.lights, quality],
  );

  // Floor path markings along the cross aisles
  const markings: BoxSpec[] = useMemo(
    () => [
      { pos: [0, 0.004, 9.4], size: [58, 0.002, 0.12], color: "#10b981" },
      { pos: [0, 0.004, -25.3], size: [58, 0.002, 0.12], color: "#10b981" },
      { pos: [0, 0.004, 31], size: [5, 0.002, 0.1], color: "#f59e0b" },
    ],
    [],
  );

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={floorTex} roughness={0.35} metalness={0.05} />
      </mesh>
      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[cx, CEILING, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.9} />
      </mesh>
      {/* Walls */}
      <Wall pos={[cx, CEILING / 2, b.minZ]} rotY={0} width={w} />
      <Wall pos={[cx, CEILING / 2, b.maxZ]} rotY={Math.PI} width={w} />
      <Wall pos={[b.minX, CEILING / 2, cz]} rotY={Math.PI / 2} width={d} />
      <Wall pos={[b.maxX, CEILING / 2, cz]} rotY={-Math.PI / 2} width={d} />
      {/* Exterior "daylight" seen through the entrance */}
      <mesh position={[0, 1.4, b.maxZ - 0.02]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[6, 2.8]} />
        <meshBasicMaterial color="#cfe8ff" toneMapped={false} />
      </mesh>

      <InstancedBoxes boxes={layout.boxes.metal} material={materials.metal} />
      <InstancedBoxes boxes={layout.boxes.white} material={materials.white} />
      <InstancedBoxes boxes={layout.boxes.wood} material={materials.wood} />
      <InstancedBoxes boxes={layout.boxes.dark} material={materials.dark} />
      <InstancedBoxes boxes={layout.boxes.accent} material={materials.accent} />
      <InstancedBoxes boxes={[...layout.boxes.glow, ...lightPanels]} material={materials.glow} />
      <InstancedBoxes boxes={markings} material={materials.glow} />
      <InstancedBoxes boxes={layout.boxes.glass} material={materials.glass} />

      <Signs signs={layout.signs} />
      <CartCorral />
    </group>
  );
}

function Wall({ pos, rotY, width }: { pos: [number, number, number]; rotY: number; width: number }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh>
        <planeGeometry args={[width, CEILING]} />
        <meshStandardMaterial color="#f5f3ee" roughness={0.95} />
      </mesh>
      <mesh position={[0, CEILING / 2 - 0.9, 0.01]}>
        <planeGeometry args={[width, 0.5]} />
        <meshStandardMaterial color="#047857" roughness={0.7} />
      </mesh>
      <mesh position={[0, -CEILING / 2 + 0.06, 0.01]}>
        <planeGeometry args={[width, 0.12]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
    </group>
  );
}

function Signs({ signs }: { signs: Sign[] }) {
  const textures = useMemo(() => signs.map((s) => buildSignTexture(s.text, s.sub, s.color, s.width)), [signs]);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  return (
    <>
      {signs.map((s, i) => (
        <group key={i} position={s.pos} rotation={[0, s.rotY, 0]}>
          <mesh position={[0, 0, 0.011]}>
            <planeGeometry args={[s.width, 0.9]} />
            <meshBasicMaterial map={textures[i]} toneMapped={false} />
          </mesh>
          <mesh>
            <boxGeometry args={[s.width + 0.04, 0.94, 0.02]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          {s.doubleSided && (
            <mesh position={[0, 0, -0.011]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[s.width, 0.9]} />
              <meshBasicMaterial map={textures[i]} toneMapped={false} />
            </mesh>
          )}
          {/* hanging cables */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * s.width * 0.4, (CEILING - s.pos[1]) / 2 + 0.45, 0]}>
              <cylinderGeometry args={[0.008, 0.008, CEILING - s.pos[1] - 0.45, 4]} />
              <meshBasicMaterial color="#475569" />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/** Row of shopping carts at the entrance. */
function CartCorral() {
  const carts = [0, 1, 2, 3, 4];
  return (
    <group position={[-6.5, 0, 29.7]}>
      {carts.map((i) => (
        <ShoppingCartModel key={i} position={[-1.2 + i * 0.36, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      ))}
      {/* stacked baskets */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[2.4, 0.12 + i * 0.07, 0]}>
          <boxGeometry args={[0.45, 0.22, 0.32]} />
          <meshStandardMaterial color="#dc2626" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

export function ShoppingCartModel(props: ThreeElements["group"]) {
  const metal = "#9ca3af";
  return (
    <group {...props}>
      {/* basket */}
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[0.55, 0.42, 0.85]} />
        <meshStandardMaterial color={metal} metalness={0.7} roughness={0.3} wireframe />
      </mesh>
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[0.55, 0.02, 0.85]} />
        <meshStandardMaterial color={metal} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* handle */}
      <mesh position={[0, 1.0, 0.48]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.55, 8]} />
        <meshStandardMaterial color="#047857" />
      </mesh>
      {/* frame + wheels */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.45, 0.03, 0.75]} />
        <meshStandardMaterial color={metal} metalness={0.7} roughness={0.3} />
      </mesh>
      {[
        [-0.2, -0.32],
        [0.2, -0.32],
        [-0.2, 0.32],
        [0.2, 0.32],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.06, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      ))}
    </group>
  );
}
