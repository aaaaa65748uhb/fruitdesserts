"use client";
import type { ThreeElements } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { InstancedBoxes } from "./InstancedBoxes";
import type { BoxSpec, Checkout, LightFixture, Sign, StoreLayout } from "./layout";
import {
  asphaltTexture,
  beltTexture,
  cardboardTexture,
  ceilingTexture,
  floorRoughness,
  floorTexture,
  pavingTexture,
  pegboardTexture,
  posScreenTexture,
  skyTexture,
  stripShadowTexture,
} from "./surfaces";
import { buildSignTexture } from "./textures";

export const CEILING = 4.6;

/** Image-based lighting: a neutral "room" environment gives metal, glass and packaging realistic reflections. */
export function StoreLighting({ quality }: { quality: "high" | "low" }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene]);
  return (
    <>
      <hemisphereLight args={["#ffffff", "#cfc8bb", quality === "high" ? 0.95 : 1.25]} />
      <ambientLight intensity={0.18} />
      <directionalLight position={[6, 18, 10]} intensity={0.75} color="#fffaf0" />
      <directionalLight position={[-12, 14, -10]} intensity={0.25} color="#e0f2fe" />
    </>
  );
}

function useDispose<T extends { dispose: () => void }>(items: T[]) {
  useEffect(() => () => items.forEach((i) => i.dispose()), [items]);
}

export function StoreShell({ layout, quality }: { layout: StoreLayout; quality: "high" | "low" }) {
  const b = layout.bounds;
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;

  const tex = useMemo(() => {
    const floor = floorTexture();
    floor.repeat.set(w / 1.2, d / 1.2);
    const floorRough = floorRoughness();
    floorRough.repeat.set(w / 1.2, d / 1.2);
    const ceiling = ceilingTexture();
    ceiling.repeat.set(w / 1.2, d / 1.2);
    const peg = pegboardTexture();
    peg.repeat.set(56, 4);
    const card = cardboardTexture();
    return { floor, floorRough, ceiling, peg, card };
  }, [w, d]);
  useDispose(useMemo(() => Object.values(tex), [tex]));

  const materials = useMemo(
    () => ({
      metal: new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 0.55, roughness: 0.35 }),
      white: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6 }),
      wood: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.75 }),
      dark: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5, metalness: 0.2 }),
      accent: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.45 }),
      glass: new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0, reflectivity: 0.6, depthWrite: false }),
      glow: new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }),
      peg: new THREE.MeshStandardMaterial({ color: "#ffffff", map: tex.peg, roughness: 0.55, metalness: 0.25 }),
      card: new THREE.MeshStandardMaterial({ color: "#ffffff", map: tex.card, roughness: 0.9 }),
      rail: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35 }),
      chrome: new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 0.9, roughness: 0.18 }),
      crate: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.55 }),
    }),
    [tex],
  );
  useDispose(useMemo(() => Object.values(materials), [materials]));

  return (
    <group>
      {/* Polished tile floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={tex.floor} roughnessMap={tex.floorRough} roughness={quality === "high" ? 0.55 : 0.7} metalness={0.02} envMapIntensity={1.4} />
      </mesh>
      {/* Suspended ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[cx, CEILING, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={tex.ceiling} roughness={0.95} />
      </mesh>
      <Walls layout={layout} />

      {(Object.keys(layout.boxes) as (keyof StoreLayout["boxes"])[]).map((k) => (
        <InstancedBoxes key={k} boxes={layout.boxes[k]} material={materials[k]} />
      ))}

      <FixtureShadows layout={layout} />
      <CeilingLights fixtures={layout.lights} quality={quality} />
      <Signs signs={layout.signs} />
      <Checkouts checkouts={layout.checkouts} />
      <Storefront layout={layout} />
      <Outdoors layout={layout} quality={quality} />
      <CartCorral />
    </group>
  );
}

/** Interior walls: tiled skirting, painted wall, brand band. The storefront wall is built by <Storefront>. */
function Walls({ layout }: { layout: StoreLayout }) {
  const b = layout.bounds;
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  return (
    <>
      <Wall pos={[cx, CEILING / 2, b.minZ]} rotY={0} width={w} />
      <Wall pos={[b.minX, CEILING / 2, cz]} rotY={Math.PI / 2} width={d} />
      <Wall pos={[b.maxX, CEILING / 2, cz]} rotY={-Math.PI / 2} width={d} />
    </>
  );
}

function Wall({ pos, rotY, width }: { pos: [number, number, number]; rotY: number; width: number }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh>
        <planeGeometry args={[width, CEILING]} />
        <meshStandardMaterial color="#f3f1ec" roughness={0.92} />
      </mesh>
      <mesh position={[0, CEILING / 2 - 0.75, 0.01]}>
        <planeGeometry args={[width, 0.42]} />
        <meshStandardMaterial color="#047857" roughness={0.6} />
      </mesh>
      <mesh position={[0, CEILING / 2 - 0.5, 0.012]}>
        <planeGeometry args={[width, 0.05]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.6} />
      </mesh>
      <mesh position={[0, -CEILING / 2 + 0.6, 0.01]}>
        <planeGeometry args={[width, 1.2]} />
        <meshStandardMaterial color="#e7e5df" roughness={0.4} />
      </mesh>
      <mesh position={[0, -CEILING / 2 + 0.06, 0.015]}>
        <planeGeometry args={[width, 0.12]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>
    </group>
  );
}

/** Soft dark strips on the floor along shelving and fixtures (cheap stand-in for ambient occlusion). */
function FixtureShadows({ layout }: { layout: StoreLayout }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const strips = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number }[] = [];
    for (const r of layout.mapRects) {
      const pad = r.kind === "gondola" || r.kind === "endcap" ? 0.45 : 0.35;
      out.push({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2, w: r.maxX - r.minX + pad * 2, d: r.maxZ - r.minZ + pad * 2 });
    }
    return out;
  }, [layout.mapRects]);
  const alpha = useMemo(() => stripShadowTexture(), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: "#000000", alphaMap: alpha, transparent: true, opacity: 0.32, depthWrite: false }), [alpha]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    strips.forEach((s, i) => {
      // The gradient runs across the texture's u axis; orient it across the short side of the fixture.
      const alongZ = s.d >= s.w;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), alongZ ? 0 : Math.PI / 2);
      m.compose(new THREE.Vector3(s.x, 0.003, s.z), q, new THREE.Vector3(alongZ ? s.w : s.d, 1, alongZ ? s.d : s.w));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [strips, geometry, material]);
  useEffect(() => () => { alpha.dispose(); material.dispose(); geometry.dispose(); }, [alpha, material, geometry]);
  return <instancedMesh ref={ref} args={[geometry, material, strips.length]} frustumCulled={false} renderOrder={1} />;
}

/** LED battens: aluminium housing with a bright diffuser, in rows along the aisles. */
function CeilingLights({ fixtures, quality }: { fixtures: LightFixture[]; quality: "high" | "low" }) {
  const shown = useMemo(() => (quality === "high" ? fixtures : fixtures.filter((_, i) => i % 2 === 0)), [fixtures, quality]);
  const housing: BoxSpec[] = useMemo(
    () => shown.map((f) => ({ pos: [f.pos[0], f.pos[1] + 0.03, f.pos[2]] as [number, number, number], size: rotSize(f, 0.24, 0.07), color: "#d1d5db" })),
    [shown],
  );
  const diffuser: BoxSpec[] = useMemo(
    () => shown.map((f) => ({ pos: [f.pos[0], f.pos[1] - 0.012, f.pos[2]] as [number, number, number], size: rotSize(f, 0.17, 0.02), color: "#ffffff" })),
    [shown],
  );
  const housingMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 0.6, roughness: 0.35 }), []);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), []);
  useEffect(() => () => { housingMat.dispose(); glowMat.dispose(); }, [housingMat, glowMat]);
  return (
    <>
      <InstancedBoxes boxes={housing} material={housingMat} />
      <InstancedBoxes boxes={diffuser} material={glowMat} />
    </>
  );
}

function rotSize(f: LightFixture, width: number, height: number): [number, number, number] {
  const alongZ = Math.abs(Math.cos(f.rotY)) > 0.5;
  return alongZ ? [width, height, f.length] : [f.length, height, width];
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

/** Conveyor belts, cash-register screens and bagging areas. */
function Checkouts({ checkouts }: { checkouts: Checkout[] }) {
  const belt = useMemo(() => {
    const t = beltTexture();
    t.repeat.set(1, 14);
    return t;
  }, []);
  const screens = useMemo(() => checkouts.map((c) => posScreenTexture(c.lane)), [checkouts]);
  useEffect(() => () => { belt.dispose(); screens.forEach((s) => s.dispose()); }, [belt, screens]);
  return (
    <>
      {checkouts.map((c, i) => (
        <group key={c.lane} position={[c.x, 0, 0]}>
          {/* belt */}
          <mesh position={[0, 0.93, c.z0 + 1.75]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.6, 3.1]} />
            <meshStandardMaterial map={belt} roughness={0.8} />
          </mesh>
          {/* belt side rails */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.33, 0.95, c.z0 + 1.75]}>
              <boxGeometry args={[0.04, 0.05, 3.1]} />
              <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.25} />
            </mesh>
          ))}
          {/* divider bar */}
          <mesh position={[0, 0.96, c.z0 + 1.1]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.4, 3]} />
            <meshStandardMaterial color="#facc15" />
          </mesh>
          {/* POS monitor on the cashier side */}
          <group position={[0.32, 1.22, c.z0 + 3.75]} rotation={[0, Math.PI / 2 - 0.5, 0]}>
            <mesh>
              <boxGeometry args={[0.36, 0.25, 0.04]} />
              <meshStandardMaterial color="#111827" roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.021]}>
              <planeGeometry args={[0.32, 0.2]} />
              <meshBasicMaterial map={screens[i]} toneMapped={false} />
            </mesh>
            <mesh position={[0, -0.2, -0.04]}>
              <boxGeometry args={[0.05, 0.22, 0.05]} />
              <meshStandardMaterial color="#374151" />
            </mesh>
          </group>
          {/* cash drawer */}
          <mesh position={[0.25, 0.8, c.z0 + 4.2]}>
            <boxGeometry args={[0.42, 0.14, 0.42]} />
            <meshStandardMaterial color="#1f2937" roughness={0.5} />
          </mesh>
          {/* bag dispenser rack */}
          <mesh position={[0, 1.12, c.z1 - 0.18]}>
            <boxGeometry args={[0.5, 0.35, 0.03]} />
            <meshStandardMaterial color="#e5e7eb" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Front wall with large shop windows, mullions and automatic sliding doors. */
function Storefront({ layout }: { layout: StoreLayout }) {
  const b = layout.bounds;
  const z = b.maxZ;
  const { windows, door } = layout.storefront;
  const sill = 0.45;
  const head = 3.2;
  const segments = useMemo(() => {
    // Solid wall pieces between/around the glazing.
    const pieces: { x0: number; x1: number }[] = [];
    let x = b.minX;
    for (const [w0, w1] of [...windows, door].sort((a, b2) => a[0] - b2[0])) {
      if (w0 > x) pieces.push({ x0: x, x1: w0 });
      x = Math.max(x, w1);
    }
    if (x < b.maxX) pieces.push({ x0: x, x1: b.maxX });
    return pieces;
  }, [b.minX, b.maxX, windows, door]);
  const mullions = useMemo(() => {
    const out: number[] = [];
    for (const [w0, w1] of windows) {
      const n = Math.max(1, Math.round((w1 - w0) / 2.2));
      for (let i = 0; i <= n; i++) out.push(w0 + ((w1 - w0) * i) / n);
    }
    out.push(door[0], door[1], (door[0] + door[1]) / 2);
    return out;
  }, [windows, door]);
  const width = b.maxX - b.minX;
  const cx = (b.minX + b.maxX) / 2;
  return (
    <group>
      {/* Wall above the glazing and below the window sills */}
      <mesh position={[cx, (head + CEILING) / 2, z]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width, CEILING - head]} />
        <meshStandardMaterial color="#f3f1ec" roughness={0.92} side={THREE.DoubleSide} />
      </mesh>
      {windows.map(([w0, w1], i) => (
        <mesh key={`sill-${i}`} position={[(w0 + w1) / 2, sill / 2, z]}>
          <boxGeometry args={[w1 - w0, sill, 0.2]} />
          <meshStandardMaterial color="#d6d3cd" roughness={0.7} />
        </mesh>
      ))}
      {segments.map((s, i) => (
        <mesh key={`seg-${i}`} position={[(s.x0 + s.x1) / 2, head / 2, z]}>
          <boxGeometry args={[s.x1 - s.x0, head, 0.2]} />
          <meshStandardMaterial color="#f3f1ec" roughness={0.92} />
        </mesh>
      ))}
      {/* Glass */}
      {windows.map(([w0, w1], i) => (
        <mesh key={`glass-${i}`} position={[(w0 + w1) / 2, (sill + head) / 2, z]}>
          <planeGeometry args={[w1 - w0, head - sill]} />
          <meshPhysicalMaterial color="#e0f2fe" transparent opacity={0.12} roughness={0.03} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {/* Sliding doors (shown partly open) */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 2.2, 1.35, z - 0.06]}>
          <boxGeometry args={[1.6, 2.7, 0.03]} />
          <meshPhysicalMaterial color="#e0f2fe" transparent opacity={0.18} roughness={0.03} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, 2.85, z - 0.08]}>
        <boxGeometry args={[6.4, 0.3, 0.2]} />
        <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Mullions and transom */}
      {mullions.map((x, i) => (
        <mesh key={`m-${i}`} position={[x, (sill + head) / 2, z]}>
          <boxGeometry args={[0.07, head - sill, 0.14]} />
          <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      {windows.map(([w0, w1], i) => (
        <mesh key={`t-${i}`} position={[(w0 + w1) / 2, head, z]}>
          <boxGeometry args={[w1 - w0, 0.08, 0.16]} />
          <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

/** What you see through the windows: sidewalk, parking lot, street, trees and sky. Purely decorative. */
function Outdoors({ layout, quality }: { layout: StoreLayout; quality: "high" | "low" }) {
  const z = layout.bounds.maxZ;
  const tex = useMemo(() => {
    const asphalt = asphaltTexture();
    asphalt.repeat.set(30, 12);
    const paving = pavingTexture();
    paving.repeat.set(70, 4);
    const sky = skyTexture();
    return { asphalt, paving, sky };
  }, []);
  useDispose(useMemo(() => Object.values(tex), [tex]));
  const trees = useMemo(() => [-26, -18, -10, 10, 18, 26].map((x, i) => ({ x, z: z + 5.2 + (i % 2) * 0.4, s: 0.9 + (i % 3) * 0.15 })), [z]);
  const cars = useMemo(
    () => [
      { x: -20, c: "#dc2626" },
      { x: -14, c: "#e5e7eb" },
      { x: -5, c: "#1e3a8a" },
      { x: 9, c: "#111827" },
      { x: 15, c: "#9ca3af" },
      { x: 24, c: "#f59e0b" },
    ],
    [],
  );
  const { camera } = useThree();
  useEffect(() => {
    // The scene reaches beyond the store now (outdoors); make sure it is not clipped.
    const cam = camera as THREE.PerspectiveCamera;
    cam.far = 400;
    cam.updateProjectionMatrix();
  }, [camera]);
  return (
    <group>
      {/* Sky dome */}
      <mesh position={[0, 0, z]}>
        <sphereGeometry args={[220, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial map={tex.sky} side={THREE.BackSide} toneMapped={false} fog={false} />
      </mesh>
      {/* Sidewalk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, z + 3]}>
        <planeGeometry args={[140, 6]} />
        <meshStandardMaterial map={tex.paving} roughness={0.9} />
      </mesh>
      {/* Parking lot and street */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, z + 30]}>
        <planeGeometry args={[300, 48]} />
        <meshStandardMaterial map={tex.asphalt} roughness={0.95} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-29 + i * 4.5, 0.01, z + 10]}>
          <planeGeometry args={[0.12, 5]} />
          <meshBasicMaterial color="#f8fafc" />
        </mesh>
      ))}
      {Array.from({ length: 20 }, (_, i) => (
        <mesh key={`lane-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[-60 + i * 6.5, 0.01, z + 26]}>
          <planeGeometry args={[3, 0.18]} />
          <meshBasicMaterial color="#fde047" />
        </mesh>
      ))}
      {/* Grass verge beyond the street */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, z + 70]}>
        <planeGeometry args={[400, 40]} />
        <meshStandardMaterial color="#6b8f47" roughness={1} />
      </mesh>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.12, 0.16, 2.4, 6]} />
            <meshStandardMaterial color="#6b4423" />
          </mesh>
          <mesh position={[0, 3.1, 0]}>
            <icosahedronGeometry args={[1.5, quality === "high" ? 1 : 0]} />
            <meshStandardMaterial color="#3f7d32" roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
      {cars.map((c, i) => (
        <group key={i} position={[c.x, 0, z + 10.5]}>
          <mesh position={[0, 0.55, 0]}>
            <boxGeometry args={[1.8, 0.7, 4.2]} />
            <meshStandardMaterial color={c.c} metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh position={[0, 1.1, -0.2]}>
            <boxGeometry args={[1.6, 0.55, 2.2]} />
            <meshStandardMaterial color="#1f2937" metalness={0.3} roughness={0.15} />
          </mesh>
          {[-0.8, 0.8].map((x) =>
            [-1.3, 1.3].map((zz) => (
              <mesh key={`${x}-${zz}`} position={[x, 0.32, zz]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.32, 0.32, 0.22, 12]} />
                <meshStandardMaterial color="#111827" />
              </mesh>
            )),
          )}
        </group>
      ))}
      {/* Buildings across the street */}
      {[-40, -22, -4, 14, 32, 50].map((x, i) => (
        <mesh key={x} position={[x, 6 + (i % 3) * 2.5, z + 62]}>
          <boxGeometry args={[14, 12 + (i % 3) * 5, 10]} />
          <meshStandardMaterial color={["#e7dccb", "#d9d4cc", "#efe8dd"][i % 3]} roughness={0.95} />
        </mesh>
      ))}
    </group>
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
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[2.4, 0.12 + i * 0.07, 0]}>
          <boxGeometry args={[0.45, 0.22, 0.32]} />
          <meshStandardMaterial color="#dc2626" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** Wire shopping cart (also used as the first-person cart). */
export function ShoppingCartModel(props: ThreeElements["group"]) {
  const wire = useMemo(() => wireTexture(), []);
  useEffect(() => () => wire.dispose(), [wire]);
  const metal = "#c0c6cc";
  return (
    <group {...props}>
      {/* wire basket: 5 see-through panels */}
      {(
        [
          [[0, 0.75, -0.42], [0.56, 0.42, 0.01], 0],
          [[0, 0.75, 0.42], [0.56, 0.42, 0.01], 0],
          [[-0.28, 0.75, 0], [0.84, 0.42, 0.01], Math.PI / 2],
          [[0.28, 0.75, 0], [0.84, 0.42, 0.01], Math.PI / 2],
        ] as [[number, number, number], [number, number, number], number][]
      ).map(([pos, size, rot], i) => (
        <mesh key={i} position={pos} rotation={[0, rot, 0]}>
          <boxGeometry args={size} />
          <meshStandardMaterial color={metal} map={wire} alphaMap={wire} alphaTest={0.4} transparent metalness={0.8} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, 0.54, 0]}>
        <boxGeometry args={[0.56, 0.015, 0.84]} />
        <meshStandardMaterial color={metal} map={wire} alphaMap={wire} alphaTest={0.4} transparent metalness={0.8} roughness={0.3} />
      </mesh>
      {/* top rim */}
      {[-0.42, 0.42].map((z) => (
        <mesh key={z} position={[0, 0.96, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.58, 6]} />
          <meshStandardMaterial color={metal} metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, 0.96, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.86, 6]} />
          <meshStandardMaterial color={metal} metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
      {/* handle */}
      <mesh position={[0, 1.02, 0.52]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, 0.58, 10]} />
        <meshStandardMaterial color="#047857" roughness={0.4} />
      </mesh>
      {[-0.27, 0.27].map((x) => (
        <mesh key={x} position={[x, 0.97, 0.47]} rotation={[0.6, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.14, 6]} />
          <meshStandardMaterial color={metal} metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
      {/* chassis + wheels */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.46, 0.025, 0.78]} />
        <meshStandardMaterial color={metal} metalness={0.8} roughness={0.3} />
      </mesh>
      {[
        [-0.2, -0.32],
        [0.2, -0.32],
        [-0.2, 0.32],
        [0.2, 0.32],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.13, 0]}>
            <boxGeometry args={[0.02, 0.14, 0.02]} />
            <meshStandardMaterial color={metal} metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

let wireCache: HTMLCanvasElement | null = null;
/** Square wire-mesh pattern (alpha) for cart baskets. */
function wireTexture(): THREE.CanvasTexture {
  if (!wireCache) {
    const s = 64;
    wireCache = document.createElement("canvas");
    wireCache.width = wireCache.height = s;
    const ctx = wireCache.getContext("2d")!;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    for (let i = 0; i <= s; i += s / 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, s);
      ctx.moveTo(0, i);
      ctx.lineTo(s, i);
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(wireCache);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 3);
  return t;
}
