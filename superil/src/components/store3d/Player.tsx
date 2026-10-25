"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCart } from "@/client/cart-store";
import { useSettings } from "@/client/settings-store";
import { useUi } from "@/client/ui-store";
import type { Product } from "@/lib/types";
import { EYE_HEIGHT, PLAYER_RADIUS, productDims, type StoreLayout } from "./layout";
import { moveWithCollisions, pickBlock } from "./physics";
import { makePhotoMaterial } from "./Products";
import { cartLive, playerLive, touchInput, useStore3d } from "./state";
import type { Atlas } from "./textures";

export const INTERACT_RANGE = 3.2;
const WALK_SPEED = 3.0;
const GRAVITY = 18;

let audioCtx: AudioContext | null = null;
export function playPickupSound() {
  if (!useSettings.getState().sound) return;
  try {
    audioCtx ??= new AudioContext();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(660, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.12);
    g.gain.setValueAtTime(0.08, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.22);
  } catch {
    // Audio is optional.
  }
}

/** Adds the focused product to the cart, with pickup animation and feedback. */
export function pickUpFocused(layout: StoreLayout, productsById: Record<string, Product>, quantity = 1): boolean {
  const { focus, addPickup } = useStore3d.getState();
  if (!focus) return false;
  const product = productsById[focus.productId];
  if (!product) return false;
  if (!useCart.getState().add(product.id, quantity)) return false;
  const facing = layout.blocks[focus.blockIndex]?.facings[focus.facing];
  if (facing) addPickup(product.id, facing.pos);
  playPickupSound();
  useUi.getState().showToast(`${quantity > 1 ? `${quantity} × ` : ""}${product.nameHe} נוסף לסל`);
  return true;
}

function isTyping() {
  const el = document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
}

export function Player({ layout, productsById }: { layout: StoreLayout; productsById: Record<string, Product> }) {
  const { camera, gl } = useThree();
  const keys = useRef(new Set<string>());
  const state = useRef({ x: layout.spawn.x, z: layout.spawn.z, y: EYE_HEIGHT, vy: 0, yaw: layout.spawn.yaw, pitch: -0.05, bob: 0, frame: 0 });
  const lastTeleport = useRef<number | null>(null);

  // Pointer lock + mouse look
  useEffect(() => {
    const el = gl.domElement;
    const onLockChange = () => {
      const locked = document.pointerLockElement === el;
      useStore3d.getState().set({ locked });
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      const sens = 0.0022 * useSettings.getState().mouseSensitivity;
      const s = state.current;
      s.yaw -= e.movementX * sens;
      s.pitch = Math.max(-1.35, Math.min(1.35, s.pitch - e.movementY * sens));
    };
    const onClick = () => {
      const st = useStore3d.getState();
      if (!st.started || st.panelProductId || st.searchOpen) return;
      if (document.pointerLockElement !== el && window.matchMedia("(pointer: fine)").matches) {
        try {
          const p = el.requestPointerLock() as unknown as Promise<void> | undefined;
          p?.catch?.(() => undefined);
        } catch {
          // Pointer lock can be refused (e.g. iframe sandbox); keyboard still works.
        }
      } else if (document.pointerLockElement === el) {
        pickUpFocused(layout, productsById);
      }
    };
    document.addEventListener("pointerlockchange", onLockChange);
    document.addEventListener("mousemove", onMouseMove);
    el.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("click", onClick);
      if (document.pointerLockElement === el) document.exitPointerLock();
    };
  }, [gl, layout, productsById]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping()) return;
      const st = useStore3d.getState();
      if (!st.started) return;
      if (e.code === "KeyE" && !e.repeat && !st.panelProductId) {
        pickUpFocused(layout, productsById);
        return;
      }
      if (e.code === "KeyQ" && st.focus && !st.panelProductId) {
        document.exitPointerLock?.();
        st.set({ panelProductId: st.focus.productId });
        return;
      }
      if (e.code === "KeyC" && !e.repeat && !st.panelProductId) {
        const settings = useSettings.getState();
        settings.set({ showCart: settings.showCart === false });
        return;
      }
      if (e.code === "Slash" || (e.code === "KeyF" && !st.panelProductId)) {
        e.preventDefault();
        document.exitPointerLock?.();
        st.set({ searchOpen: true });
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [layout, productsById]);

  const forward = useRef(new THREE.Vector3());

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = state.current;
    const st = useStore3d.getState();

    if (st.teleport && st.teleport.id !== lastTeleport.current) {
      lastTeleport.current = st.teleport.id;
      [s.x, s.z] = moveWithCollisions(st.teleport.x, st.teleport.z, 0, 0, PLAYER_RADIUS, layout.colliders);
      s.yaw = st.teleport.yaw;
      s.pitch = st.teleport.pitch ?? -0.12;
    }

    const blocked = !st.started || !!st.panelProductId || st.searchOpen || isTyping();
    // Touch look
    if (touchInput.lookDX || touchInput.lookDY) {
      const sens = 0.005 * useSettings.getState().mouseSensitivity;
      s.yaw -= touchInput.lookDX * sens;
      s.pitch = Math.max(-1.35, Math.min(1.35, s.pitch - touchInput.lookDY * sens));
      touchInput.lookDX = touchInput.lookDY = 0;
    }

    let mx = 0;
    let mz = 0;
    if (!blocked) {
      const k = keys.current;
      if (k.has("KeyW") || k.has("ArrowUp")) mz -= 1;
      if (k.has("KeyS") || k.has("ArrowDown")) mz += 1;
      if (k.has("KeyA")) mx -= 1;
      if (k.has("KeyD")) mx += 1;
      if (k.has("ArrowLeft")) s.yaw += 1.8 * dt;
      if (k.has("ArrowRight")) s.yaw -= 1.8 * dt;
      mx += touchInput.moveX;
      mz -= touchInput.moveY;
      if (k.has("Space") && s.y <= EYE_HEIGHT + 1e-3) s.vy = 4.2;
    }
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const speed = WALK_SPEED * useSettings.getState().moveSpeed * (keys.current.has("ShiftLeft") || keys.current.has("ShiftRight") ? 1.7 : 1);
    const sin = Math.sin(s.yaw);
    const cos = Math.cos(s.yaw);
    const dx = (mx * cos + mz * sin) * speed * dt;
    const dz = (-mx * sin + mz * cos) * speed * dt;
    if (dx || dz) [s.x, s.z] = moveWithCollisions(s.x, s.z, dx, dz, PLAYER_RADIUS, layout.colliders);

    // Gravity / grounded movement
    s.vy -= GRAVITY * dt;
    s.y += s.vy * dt;
    if (s.y <= EYE_HEIGHT) {
      s.y = EYE_HEIGHT;
      s.vy = 0;
    }
    s.bob += Math.hypot(dx, dz) * 9;
    camera.position.set(s.x, s.y + Math.sin(s.bob) * 0.025, s.z);
    camera.rotation.set(s.pitch, s.yaw, 0, "YXZ");
    playerLive.x = s.x;
    playerLive.z = s.z;
    playerLive.yaw = s.yaw;
    playerLive.pitch = s.pitch;

    // Product picking ~20 Hz
    if (++s.frame % 3 === 0 && st.started && !st.panelProductId) {
      camera.getWorldDirection(forward.current);
      const hit = pickBlock(layout.blocks, [s.x, s.y, s.z], [forward.current.x, forward.current.y, forward.current.z], INTERACT_RANGE);
      const prev = st.focus;
      if (!hit) {
        if (prev) st.set({ focus: null });
      } else if (!prev || prev.blockIndex !== hit.block.index || prev.facing !== hit.facing) {
        st.set({ focus: { blockIndex: hit.block.index, facing: hit.facing, productId: hit.block.productId } });
      }
    }
  });

  return null;
}

/** Product flying from the shelf into the cart. */
export function PickupEffects({ productsById, atlas }: { productsById: Record<string, Product>; atlas: Atlas }) {
  const pickups = useStore3d((s) => s.pickups);
  const material = useMemo(() => makePhotoMaterial(atlas.texture, true), [atlas]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <>
      {pickups.map((p) => {
        const product = productsById[p.productId];
        if (!product) return null;
        return <FlyingProduct key={p.id} id={p.id} from={p.from} product={product} atlas={atlas} material={material} />;
      })}
    </>
  );
}

function FlyingProduct({ id, from, product, atlas, material }: { id: number; from: [number, number, number]; product: Product; atlas: Atlas; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dims = useMemo(() => productDims(product), [product]);
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.setAttribute("aUvRect", new THREE.InstancedBufferAttribute(new Float32Array(atlas.rects.get(product.id) ?? [0, 0, 0.001, 0.001]), 4));
    g.setAttribute("aSideColor", new THREE.InstancedBufferAttribute(new Float32Array(atlas.sides?.get(product.id) ?? [0.8, 0.8, 0.8]), 3));
    return g;
  }, [atlas, product.id]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const t0 = useRef<number | null>(null);
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    t0.current ??= clock.elapsedTime;
    const t = Math.min(1, (clock.elapsedTime - t0.current) / 0.5);
    // Target: the cart basket in front of the player (or just below the view when the cart is hidden)
    const yaw = playerLive.yaw;
    if (cartLive.visible && useSettings.getState().showCart !== false) target.current.set(cartLive.x, 0.75, cartLive.z);
    else target.current.set(camera.position.x - Math.sin(yaw) * 0.6, camera.position.y - 0.5, camera.position.z - Math.cos(yaw) * 0.6);
    const e = 1 - Math.pow(1 - t, 3);
    const mat = new THREE.Matrix4().compose(
      new THREE.Vector3(
        from[0] + (target.current.x - from[0]) * e,
        from[1] + (target.current.y - from[1]) * e + Math.sin(t * Math.PI) * 0.3,
        from[2] + (target.current.z - from[2]) * e,
      ),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw + t * Math.PI * 2, 0)),
      new THREE.Vector3(dims.w, dims.h, dims.d),
    );
    m.setMatrixAt(0, mat);
    m.instanceMatrix.needsUpdate = true;
    if (t >= 1) useStore3d.getState().removePickup(id);
  });
  return <instancedMesh ref={ref} args={[geometry, material, 1]} frustumCulled={false} />;
}
