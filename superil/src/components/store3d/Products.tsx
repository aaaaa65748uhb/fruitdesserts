"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { GeometryGroup, ProductBlock } from "./layout";
import { useStore3d } from "./state";
import type { Atlas } from "./textures";

/** Material whose map is sampled through a per-instance UV rectangle (texture atlas). */
export function makeAtlasMaterial(texture: THREE.Texture, opts: THREE.MeshStandardMaterialParameters = {}) {
  const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, metalness: 0.02, ...opts });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aUvRect;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vMapUv * aUvRect.zw + aUvRect.xy;\n#endif");
  };
  mat.customProgramCacheKey = () => "atlas-uv-rect";
  return mat;
}

function geometryFor(group: GeometryGroup): THREE.BufferGeometry {
  switch (group) {
    case "cyl":
      // thetaStart = PI puts the middle of the label (u = 0.5) on the +z side, facing the aisle.
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, false, Math.PI);
    case "sphere":
      return new THREE.SphereGeometry(0.5, 14, 10);
    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

export function ProductInstances({ blocks, group, atlas }: { blocks: ProductBlock[]; group: GeometryGroup; atlas: Atlas }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mine = useMemo(() => blocks.filter((b) => b.group === group), [blocks, group]);
  const count = useMemo(() => mine.reduce((n, b) => n + b.facings.length, 0), [mine]);
  const geometry = useMemo(() => {
    const g = geometryFor(group);
    const rects = new Float32Array(count * 4);
    let i = 0;
    for (const b of mine) {
      const r = atlas.rects.get(b.productId) ?? [0, 0, 0.001, 0.001];
      for (let f = 0; f < b.facings.length; f++) rects.set(r, 4 * i++);
    }
    g.setAttribute("aUvRect", new THREE.InstancedBufferAttribute(rects, 4));
    return g;
  }, [group, mine, count, atlas]);
  const material = useMemo(() => makeAtlasMaterial(atlas.texture, group === "sphere" ? { roughness: 0.45 } : {}), [atlas, group]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    let i = 0;
    for (const b of mine) {
      for (const f of b.facings) {
        q.setFromEuler(e.set(0, f.rotY, 0));
        m.compose(new THREE.Vector3(...f.pos), q, new THREE.Vector3(...f.scale));
        mesh.setMatrixAt(i++, m);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    // geometry/material identity changes recreate the InstancedMesh, so matrices must be rewritten.
  }, [mine, geometry, material]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  if (!count) return null;
  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />;
}

export function PriceTags({ blocks, atlas }: { blocks: ProductBlock[]; atlas: Atlas }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tagged = useMemo(() => blocks.filter((b) => b.tag), [blocks]);
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    const rects = new Float32Array(tagged.length * 4);
    tagged.forEach((b, i) => rects.set(atlas.rects.get(b.productId) ?? [0, 0, 0.001, 0.001], i * 4));
    g.setAttribute("aUvRect", new THREE.InstancedBufferAttribute(rects, 4));
    return g;
  }, [tagged, atlas]);
  const material = useMemo(() => makeAtlasMaterial(atlas.texture, { roughness: 0.8, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.12 }), [atlas]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    tagged.forEach((b, i) => {
      q.setFromEuler(new THREE.Euler(0, b.tag!.rotY, 0));
      const [sx, sy] = b.tag!.scale ?? [0.15, 0.056];
      m.compose(new THREE.Vector3(...b.tag!.pos), q, new THREE.Vector3(sx, sy, 1));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [tagged, geometry, material]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  if (!tagged.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, tagged.length]} frustumCulled={false} />;
}

/** Glowing outline around the facing the player is looking at. */
export function FocusHighlight({ blocks }: { blocks: ProductBlock[] }) {
  const focus = useStore3d((s) => s.focus);
  const group = useRef<THREE.Group>(null);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), []);
  const lineMat = useMemo(() => new THREE.LineBasicMaterial({ color: "#fbbf24", transparent: true, opacity: 0.95, depthTest: false }), []);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#fde68a", transparent: true, opacity: 0.18, depthWrite: false }), []);
  const unitBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => () => { edges.dispose(); lineMat.dispose(); glowMat.dispose(); unitBox.dispose(); }, [edges, lineMat, glowMat, unitBox]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const pulse = 1.04 + Math.sin(clock.elapsedTime * 6) * 0.02;
    group.current.scale.setScalar(1);
    const f = focus ? blocks[focus.blockIndex]?.facings[focus.facing] : undefined;
    group.current.visible = !!f;
    if (!f) return;
    group.current.position.set(...f.pos);
    group.current.rotation.set(0, f.rotY, 0);
    group.current.children.forEach((c) => c.scale.set(f.scale[0] * pulse, f.scale[1] * pulse, f.scale[2] * pulse));
  });
  return (
    <group ref={group} visible={false} renderOrder={10}>
      <lineSegments geometry={edges} material={lineMat} />
      <mesh geometry={unitBox} material={glowMat} />
    </group>
  );
}
