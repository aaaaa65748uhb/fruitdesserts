"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ShoppingCartModel } from "./Environment";

/**
 * A few stylised shoppers pushing carts around the open areas of the store (decorative only: they follow fixed
 * loops through the cross aisles, never block the player and never touch products or the cart).
 */

type Loop = [number, number][];

// Closed paths through open floor (front cross aisle, back cross aisle, the side corridors).
const LOOPS: Loop[] = [
  [[-26, 9.6], [-2, 9.6], [-2, 11.5], [-26, 11.5]],
  [[3, 9.4], [26, 9.4], [26, 11.2], [3, 11.2]],
  [[-27.3, 7.5], [-27.3, -24.6], [-21, -24.6], [-21, 7.5]],
  [[27.3, 7.5], [27.3, -24.6], [21, -24.6], [21, 7.5]],
  [[-15, -24.8], [15, -24.8], [15, -23.4], [-15, -23.4]],
  [[-9, 7.6], [-9, -23.8], [-3, -23.8], [-3, 7.6]],
];

const SHIRTS = ["#2563eb", "#db2777", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2"];
const PANTS = ["#1f2937", "#334155", "#1e3a8a", "#57534e"];
const SKIN = ["#f1c7a5", "#d6a27c", "#a86f4c", "#f3d2b8"];
const HAIR = ["#2b1d14", "#5b3a1e", "#111827", "#9a7b4f"];

function loopLength(loop: Loop) {
  let len = 0;
  for (let i = 0; i < loop.length; i++) {
    const [ax, az] = loop[i];
    const [bx, bz] = loop[(i + 1) % loop.length];
    len += Math.hypot(bx - ax, bz - az);
  }
  return len;
}

/** Point and heading at distance `d` along a closed loop. */
function along(loop: Loop, d: number): { x: number; z: number; yaw: number } {
  const total = loopLength(loop);
  let t = ((d % total) + total) % total;
  for (let i = 0; i < loop.length; i++) {
    const [ax, az] = loop[i];
    const [bx, bz] = loop[(i + 1) % loop.length];
    const seg = Math.hypot(bx - ax, bz - az);
    if (t <= seg) {
      const k = t / seg;
      return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, yaw: Math.atan2(-(bx - ax), -(bz - az)) };
    }
    t -= seg;
  }
  return { x: loop[0][0], z: loop[0][1], yaw: 0 };
}

export function Shoppers({ count }: { count: number }) {
  const people = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        loop: LOOPS[i % LOOPS.length],
        offset: i * 7.3,
        speed: 0.75 + (i % 3) * 0.15,
        shirt: SHIRTS[i % SHIRTS.length],
        pants: PANTS[i % PANTS.length],
        skin: SKIN[(i * 3) % SKIN.length],
        hair: HAIR[(i * 5) % HAIR.length],
        height: 0.95 + (i % 4) * 0.04,
      })),
    [count],
  );
  return (
    <>
      {people.map((p, i) => (
        <Shopper key={i} {...p} />
      ))}
    </>
  );
}

function Shopper(p: { loop: Loop; offset: number; speed: number; shirt: string; pants: string; skin: string; hair: string; height: number }) {
  const root = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const yawRef = useRef(0);
  useFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;
    const d = p.offset + clock.elapsedTime * p.speed;
    const { x, z, yaw } = along(p.loop, d);
    // turn smoothly at corners
    let diff = yaw - yawRef.current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    yawRef.current += diff * 0.12;
    g.position.set(x, 0, z);
    g.rotation.y = yawRef.current;
    const swing = Math.sin(d * 5.5) * 0.45;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    g.position.y = Math.abs(Math.sin(d * 5.5)) * 0.02;
  });
  const s = p.height;
  return (
    <group ref={root}>
      <group scale={[s, s, s]}>
        {/* legs (pivot at the hip) */}
        {[-0.09, 0.09].map((x, i) => (
          <group key={x} ref={i === 0 ? legL : legR} position={[x, 0.88, 0]}>
            <mesh position={[0, -0.42, 0]}>
              <capsuleGeometry args={[0.07, 0.68, 3, 8]} />
              <meshStandardMaterial color={p.pants} roughness={0.8} />
            </mesh>
          </group>
        ))}
        {/* torso */}
        <mesh position={[0, 1.22, 0]}>
          <capsuleGeometry args={[0.19, 0.42, 4, 10]} />
          <meshStandardMaterial color={p.shirt} roughness={0.75} />
        </mesh>
        {/* arms reaching to the cart handle */}
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} position={[x, 1.2, -0.2]} rotation={[-1.1, 0, 0]}>
            <capsuleGeometry args={[0.055, 0.42, 3, 6]} />
            <meshStandardMaterial color={p.shirt} roughness={0.75} />
          </mesh>
        ))}
        {/* head + hair */}
        <mesh position={[0, 1.66, 0]}>
          <sphereGeometry args={[0.13, 14, 10]} />
          <meshStandardMaterial color={p.skin} roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.72, 0.02]} scale={[1, 0.75, 1]}>
          <sphereGeometry args={[0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
          <meshStandardMaterial color={p.hair} roughness={0.9} />
        </mesh>
      </group>
      {/* the cart they push, in front of them */}
      <ShoppingCartModel position={[0, 0, -0.95]} />
    </group>
  );
}
