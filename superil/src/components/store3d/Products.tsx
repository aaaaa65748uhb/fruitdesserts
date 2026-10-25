"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PRODUCT_PHOTOS } from "@/data/product-photos";
import type { Product } from "@/lib/types";
import type { Facing, GeometryGroup, ProductBlock } from "./layout";
import { latheFromProfile } from "./models";
import { produceGeometry } from "./produce";
import { useStore3d } from "./state";
import type { Atlas } from "./textures";

/** Material whose map is sampled through a per-instance UV rectangle (texture atlas), using the geometry's UVs. */
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

/**
 * Material for real product photos. The photo is projected straight onto the model from the front (object-space
 * x/y), so it lands undistorted on the front face of a box and wraps the silhouette of a lathe model. With
 * `sides`, faces that don't point forward/backward (box sides, top, bottom) get the pack's edge colour instead.
 * Transparent photo pixels are cut away (alphaTest), which shapes bottles and jars like the real pack.
 */
export function makePhotoMaterial(texture: THREE.Texture, sides: boolean) {
  const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.42, metalness: 0.0, alphaTest: 0.5, side: sides ? THREE.FrontSide : THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aUvRect;\nattribute vec3 aSideColor;\nvarying vec3 vSideColor;\nvarying float vSideFace;")
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
#ifdef USE_MAP
  vMapUv = (position.xy + 0.5) * aUvRect.zw + aUvRect.xy;
#endif
  vSideColor = aSideColor;
  vSideFace = ${sides ? "abs(normal.z) < 0.5 ? 1.0 : 0.0" : "0.0"};`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSideColor;\nvarying float vSideFace;")
      .replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
  if (vSideFace > 0.5) {
    diffuseColor.rgb *= vSideColor;
  } else {
    diffuseColor *= texture2D(map, vMapUv);
  }
#endif`,
      );
  };
  mat.customProgramCacheKey = () => (sides ? "photo-sides" : "photo-wrap");
  return mat;
}

function geometryFor(group: GeometryGroup): THREE.BufferGeometry {
  switch (group) {
    case "cyl":
      // thetaStart = PI puts the middle of the label (u = 0.5) on the +z side, facing the aisle.
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 14, 1, false, Math.PI);
    case "sphere":
      return new THREE.SphereGeometry(0.5, 14, 10);
    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

/** Front row plus the rows stocked behind it (`fromRow` = 1 for the back rows only). */
function expandFacings(blocks: ProductBlock[], maxRows: number, fromRow = 0, toRow = Infinity): Facing[] {
  const out: Facing[] = [];
  for (const b of blocks) {
    const rows = Math.min(maxRows, b.depth.rows, toRow);
    for (let r = fromRow; r < rows; r++) {
      for (const f of b.facings) {
        out.push(r === 0 ? f : { ...f, pos: [f.pos[0] + b.depth.step[0] * r, f.pos[1], f.pos[2] + b.depth.step[1] * r] });
      }
    }
  }
  return out;
}

function useInstanceMatrices(ref: React.RefObject<THREE.InstancedMesh | null>, facings: Facing[], deps: unknown[]) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    facings.forEach((f, i) => {
      q.setFromEuler(e.set(0, f.rotY, 0));
      m.compose(p.set(...f.pos), q, s.set(...f.scale));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    // geometry/material identity changes recreate the InstancedMesh, so matrices must be rewritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facings, ...deps]);
}

function atlasAttributes(g: THREE.BufferGeometry, blocks: ProductBlock[], maxRows: number, atlas: Atlas, fromRow = 0, toRow = Infinity) {
  const rowsOf = (b: ProductBlock) => Math.max(0, Math.min(maxRows, b.depth.rows, toRow) - fromRow);
  const count = blocks.reduce((n, b) => n + b.facings.length * rowsOf(b), 0);
  const rects = new Float32Array(count * 4);
  const sides = new Float32Array(count * 3);
  let i = 0;
  for (const b of blocks) {
    const r = atlas.rects.get(b.productId) ?? [0, 0, 0.001, 0.001];
    const side = atlas.sides?.get(b.productId) ?? [0.8, 0.8, 0.8];
    const n = b.facings.length * rowsOf(b);
    for (let k = 0; k < n; k++, i++) {
      rects.set(r, i * 4);
      sides.set(side, i * 3);
    }
  }
  g.setAttribute("aUvRect", new THREE.InstancedBufferAttribute(rects, 4));
  g.setAttribute("aSideColor", new THREE.InstancedBufferAttribute(sides, 3));
  return count;
}

/** Products with generated label artwork (no photo): boxes and cylinders. */
export function ProductInstances({ blocks, group, atlas, maxRows }: { blocks: ProductBlock[]; group: "box" | "cyl"; atlas: Atlas; maxRows: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mine = useMemo(() => blocks.filter((b) => b.group === group || (b.group === "photo" && !atlas.photos?.has(b.productId) && group === "box")), [blocks, group, atlas]);
  const facings = useMemo(() => expandFacings(mine, maxRows), [mine, maxRows]);
  const geometry = useMemo(() => {
    const g = geometryFor(group);
    atlasAttributes(g, mine, maxRows, atlas);
    return g;
  }, [group, mine, maxRows, atlas]);
  const material = useMemo(() => makeAtlasMaterial(atlas.texture), [atlas]);
  useInstanceMatrices(ref, facings, [geometry, material]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  if (!facings.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, facings.length]} frustumCulled={false} />;
}

/** Boxes, bags and cartons wearing their real front photo. */
export function PhotoBoxInstances({ blocks, atlas, maxRows }: { blocks: ProductBlock[]; atlas: Atlas; maxRows: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mine = useMemo(() => blocks.filter((b) => b.group === "photo" && atlas.photos?.has(b.productId)), [blocks, atlas]);
  const facings = useMemo(() => expandFacings(mine, maxRows), [mine, maxRows]);
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    atlasAttributes(g, mine, maxRows, atlas);
    return g;
  }, [mine, maxRows, atlas]);
  const material = useMemo(() => makePhotoMaterial(atlas.texture, true), [atlas]);
  useInstanceMatrices(ref, facings, [geometry, material]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  if (!facings.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, facings.length]} frustumCulled={false} />;
}

/** Bottles, cans, jars and tubs: one lathe model per product, shaped by its photo. */
export function RoundPhotoInstances({ blocks, atlas, maxRows, quality }: { blocks: ProductBlock[]; atlas: Atlas; maxRows: number; quality: "high" | "low" }) {
  const byProduct = useMemo(() => {
    const map = new Map<string, ProductBlock[]>();
    for (const b of blocks) {
      if (b.group !== "round") continue;
      const list = map.get(b.productId) ?? [];
      list.push(b);
      map.set(b.productId, list);
    }
    return [...map.entries()];
  }, [blocks]);
  const material = useMemo(() => makePhotoMaterial(atlas.texture, false), [atlas]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <>
      {byProduct.map(([id, list]) => (
        <RoundProduct key={id} productId={id} blocks={list} atlas={atlas} material={material} maxRows={1} segments={quality === "high" ? 14 : 8} rows={quality === "high" ? 14 : 8} />
      ))}
      {maxRows > 1 &&
        byProduct.map(([id, list]) => (
          <RoundProduct key={`${id}-back`} productId={id} blocks={list} atlas={atlas} material={material} maxRows={maxRows} fromRow={1} segments={6} rows={5} />
        ))}
    </>
  );
}

function RoundProduct(props: {
  productId: string;
  blocks: ProductBlock[];
  atlas: Atlas;
  material: THREE.Material;
  maxRows: number;
  fromRow?: number;
  segments: number;
  rows: number;
}) {
  const { productId, blocks, atlas, material, maxRows, fromRow = 0, segments, rows } = props;
  const ref = useRef<THREE.InstancedMesh>(null);
  const facings = useMemo(() => expandFacings(blocks, maxRows, fromRow), [blocks, maxRows, fromRow]);
  const geometry = useMemo(() => {
    const profile = PRODUCT_PHOTOS[productId]?.profile;
    const g = profile && atlas.photos?.has(productId) ? latheFromProfile(profile, segments, rows) : new THREE.CylinderGeometry(0.5, 0.5, 1, segments);
    atlasAttributes(g, blocks, maxRows, atlas, fromRow);
    return g;
  }, [productId, blocks, maxRows, atlas, segments, rows, fromRow]);
  useInstanceMatrices(ref, facings, [geometry, material]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (!facings.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, facings.length]} frustumCulled={false} />;
}

/** Loose fruit and vegetables, piled in crates. */
export function ProduceInstances({ blocks, productsById, quality }: { blocks: ProductBlock[]; productsById: Record<string, Product>; quality: "high" | "low" }) {
  const mine = useMemo(() => blocks.filter((b) => b.group === "produce"), [blocks]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0 }), []);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <>
      {mine.map((b) => (
        <ProducePile key={b.index} block={b} color={productsById[b.productId]?.packaging.color ?? "#888888"} material={material} quality={quality} />
      ))}
    </>
  );
}

function ProducePile({ block, color, material, quality }: { block: ProductBlock; color: string; material: THREE.Material; quality: "high" | "low" }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => produceGeometry(block.productId, color, quality), [block.productId, color, quality]);
  useInstanceMatrices(ref, block.facings, [geometry, material]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <instancedMesh ref={ref} args={[geometry, material, block.facings.length]} frustumCulled={false} />;
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
