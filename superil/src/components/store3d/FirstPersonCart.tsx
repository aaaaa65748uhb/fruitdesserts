"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCart } from "@/client/cart-store";
import { useSettings } from "@/client/settings-store";
import type { Product } from "@/lib/types";
import { ShoppingCartModel } from "./Environment";
import { productDims, type StoreLayout } from "./layout";
import { makePhotoMaterial } from "./Products";
import { cartLive, playerLive, useStore3d } from "./state";
import type { Atlas } from "./textures";

const MAX_ITEMS = 24;
const BASKET = { w: 0.5, d: 0.76, floor: 0.56 };

/** Free distance straight ahead of the player before hitting a fixture (for keeping the cart out of shelves). */
function freeAhead(layout: StoreLayout, x: number, z: number, yaw: number, max: number) {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  for (let d = 0.3; d <= max; d += 0.05) {
    const px = x + fx * d;
    const pz = z + fz * d;
    for (const c of layout.colliders) {
      if (px > c.minX - 0.25 && px < c.maxX + 0.25 && pz > c.minZ - 0.25 && pz < c.maxZ + 0.25) return d;
    }
  }
  return max;
}

/** Items in the cart, packed into the basket in rows and layers. */
function packItems(lines: { product: Product; quantity: number }[]) {
  const items: { productId: string; pos: [number, number, number]; scale: [number, number, number]; rotY: number }[] = [];
  let x = -BASKET.w / 2;
  let z = -BASKET.d / 2;
  let rowDepth = 0;
  let layerY = BASKET.floor;
  let layerTop = 0;
  outer: for (const { product, quantity } of lines) {
    const dims = productDims(product);
    // lay tall packs on their back so they fit under the rim
    const tall = dims.h > 0.24;
    const w = Math.min(dims.w, 0.3);
    const h = tall ? dims.d : dims.h;
    const d = tall ? dims.h : dims.d;
    for (let q = 0; q < Math.min(quantity, 4); q++) {
      if (items.length >= MAX_ITEMS) break outer;
      if (x + w > BASKET.w / 2) {
        x = -BASKET.w / 2;
        z += rowDepth + 0.01;
        rowDepth = 0;
      }
      if (z + d > BASKET.d / 2) {
        z = -BASKET.d / 2;
        x = -BASKET.w / 2;
        layerY = layerTop + 0.005;
        rowDepth = 0;
      }
      items.push({
        productId: product.id,
        pos: [x + w / 2, layerY + h / 2, z + d / 2],
        scale: [w, dims.h, dims.d],
        rotY: 0,
      });
      // remember lying orientation through a negative marker in rotY
      if (tall) items[items.length - 1].rotY = -1;
      x += w + 0.01;
      rowDepth = Math.max(rowDepth, d);
      layerTop = Math.max(layerTop, layerY + h);
    }
  }
  return items;
}

export function FirstPersonCart({ productsById, atlas, layout }: { productsById: Record<string, Product>; atlas: Atlas; layout?: StoreLayout }) {
  const enabled = useSettings((s) => s.showCart !== false);
  const started = useStore3d((s) => s.started);
  const lines = useCart((s) => s.lines);
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const offset = useRef(0.9);
  // Pushed straight ahead while walking; parked a little to the right when standing still, so it doesn't hide the shelf.
  const side = useRef(0);
  const last = useRef({ x: 0, z: 0, idle: 0 });
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const contents = useMemo(() => {
    const list = Object.values(lines)
      .map((l) => ({ product: productsById[l.productId], quantity: l.quantity }))
      .filter((l): l is { product: Product; quantity: number } => !!l.product);
    return packItems(list);
  }, [lines, productsById]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const yaw = playerLive.yaw;
    const lay = layoutRef.current;
    const free = lay ? freeAhead(lay, camera.position.x, camera.position.z, yaw, 1.6) : 1.6;
    const target = Math.min(0.9, free - 0.5);
    offset.current += (target - offset.current) * Math.min(1, dt * 10);
    const moved = Math.hypot(camera.position.x - last.current.x, camera.position.z - last.current.z);
    last.current.x = camera.position.x;
    last.current.z = camera.position.z;
    last.current.idle = moved > 0.004 ? 0 : last.current.idle + dt;
    const targetSide = last.current.idle > 0.35 || useStore3d.getState().focus ? 0.62 : 0;
    side.current += (targetSide - side.current) * Math.min(1, dt * 4);
    const visible = offset.current > 0.55;
    g.visible = visible;
    cartLive.visible = visible;
    if (!visible) return;
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    g.position.set(
      camera.position.x - Math.sin(yaw) * offset.current + rx * side.current,
      0,
      camera.position.z - Math.cos(yaw) * offset.current + rz * side.current,
    );
    g.rotation.set(0, yaw + side.current * 0.35, 0);
    cartLive.x = g.position.x;
    cartLive.z = g.position.z;
  });

  useEffect(() => () => void (cartLive.visible = false), []);
  if (!enabled || !started) return null;
  return (
    <group ref={group}>
      <ShoppingCartModel />
      <CartContents items={contents} atlas={atlas} />
    </group>
  );
}

function CartContents({ items, atlas }: { items: ReturnType<typeof packItems>; atlas: Atlas }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const rects = new Float32Array(MAX_ITEMS * 4);
    const sides = new Float32Array(MAX_ITEMS * 3);
    items.forEach((it, i) => {
      rects.set(atlas.rects.get(it.productId) ?? [0, 0, 0.001, 0.001], i * 4);
      sides.set(atlas.sides?.get(it.productId) ?? [0.8, 0.8, 0.8], i * 3);
    });
    g.setAttribute("aUvRect", new THREE.InstancedBufferAttribute(rects, 4));
    g.setAttribute("aSideColor", new THREE.InstancedBufferAttribute(sides, 3));
    return g;
  }, [items, atlas]);
  const material = useMemo(() => makePhotoMaterial(atlas.texture, true), [atlas]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach((it, i) => {
      // Lying packs: rotate -90° about x so the front faces up.
      q.setFromEuler(new THREE.Euler(it.rotY < 0 ? -Math.PI / 2 : 0, 0, 0));
      m.compose(new THREE.Vector3(...it.pos), q, new THREE.Vector3(...it.scale));
      mesh.setMatrixAt(i, m);
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [items, geometry, material]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <instancedMesh ref={ref} args={[geometry, material, MAX_ITEMS]} frustumCulled={false} />;
}
