"use client";
import { Canvas } from "@react-three/fiber";
import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";
import { chooseOffer } from "@/client/cart-pricing";
import { useCatalog, useOffers } from "@/client/queries";
import { useSettings } from "@/client/settings-store";
import { StoreShell } from "./Environment";
import { Hud } from "./Hud";
import { buildStoreLayout } from "./layout";
import { PickupEffects, Player } from "./Player";
import { FocusHighlight, PriceTags, ProductInstances } from "./Products";
import { useStore3d } from "./state";
import { buildProductAtlas, buildTagAtlas } from "./textures";

function detectTouch() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

class SceneErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(e: unknown) {
    console.error("3D scene failed", e);
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}

export function Fallback({ message }: { message: string }) {
  return (
    <div className="grid h-full place-items-center bg-slate-100 p-6 text-center">
      <div className="max-w-md">
        <p className="text-xl font-bold">{message}</p>
        <p className="mt-2 text-slate-600">אפשר להמשיך לקנות בממשק הרגיל – הסל משותף.</p>
        <a href="/search" className="mt-4 inline-block rounded-full bg-brand-700 px-6 py-3 font-bold text-white">לחיפוש מוצרים</a>
      </div>
    </div>
  );
}

export default function Store3D() {
  const catalog = useCatalog();
  const graphics = useSettings((s) => s.graphics);
  const preferred = useSettings((s) => s.preferredRetailerId);
  const [env, setEnv] = useState<{ touch: boolean; webgl: boolean } | null>(null);
  useEffect(() => setEnv({ touch: detectTouch(), webgl: webglAvailable() }), []);
  useEffect(() => () => useStore3d.getState().set({ started: false, focus: null, panelProductId: null, searchOpen: false, helpOpen: false }), []);

  const quality: "high" | "low" = graphics === "auto" ? (env?.touch ? "low" : "high") : graphics;
  const products = catalog.data?.products;
  const productsById = catalog.data?.byId;
  const layout = useMemo(() => (products ? buildStoreLayout(products) : null), [products]);
  const placedIds = useMemo(() => (layout ? [...new Set(layout.blocks.map((b) => b.productId))] : []), [layout]);
  const offersQ = useOffers(placedIds);
  const offers = useMemo(() => offersQ.data?.offers ?? {}, [offersQ.data]);
  const displayOffer = useMemo(
    () => Object.fromEntries(placedIds.map((id) => [id, chooseOffer(offers[id] ?? [], undefined, preferred)])),
    [placedIds, offers, preferred],
  );

  const atlas = useMemo(() => {
    if (!products || !layout || typeof document === "undefined") return null;
    const placed = products.filter((p) => placedIds.includes(p.id));
    return buildProductAtlas(placed, quality === "high" ? 256 : 128);
  }, [products, layout, placedIds, quality]);
  const tagAtlas = useMemo(() => {
    if (!productsById || typeof document === "undefined") return null;
    return buildTagAtlas(
      placedIds.map((id) => ({
        productId: id,
        name: productsById[id]?.nameHe ?? "",
        price: displayOffer[id]?.price,
        freshness: displayOffer[id]?.freshness ?? (offersQ.data ? "unavailable" : "sample"),
      })),
    );
  }, [placedIds, productsById, displayOffer, offersQ.data]);
  useEffect(() => () => atlas?.texture.dispose(), [atlas]);
  useEffect(() => () => tagAtlas?.texture.dispose(), [tagAtlas]);

  if (catalog.isError) return <Fallback message="לא הצלחנו לטעון את קטלוג המוצרים." />;
  if (env && !env.webgl) return <Fallback message="הדפדפן או המכשיר אינם תומכים בתלת־ממד (WebGL)." />;
  if (!layout || !atlas || !tagAtlas || !productsById || !products || !env) {
    return (
      <div className="grid h-full place-items-center bg-gradient-to-b from-brand-900 to-slate-900 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-sun-400" />
          <p className="text-lg font-bold">מסדרים את המדפים…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full" data-store-root>
      <SceneErrorBoundary fallback={<Fallback message="אירעה תקלה בהצגת החנות התלת־ממדית." />}>
        <Canvas
          dpr={quality === "high" ? [1, 2] : 1}
          gl={{ antialias: quality === "high", powerPreference: "high-performance", preserveDrawingBuffer: false }}
          camera={{ fov: 70, near: 0.05, far: 120, position: [layout.spawn.x, 1.62, layout.spawn.z] }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
          aria-label="סופרמרקט תלת־ממדי"
        >
          <color attach="background" args={["#e8ece7"]} />
          <fog attach="fog" args={["#e8ece7", 22, 75]} />
          <hemisphereLight args={["#ffffff", "#d6d0c4", 1.15]} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[8, 20, 12]} intensity={1.0} />
          <directionalLight position={[-10, 15, -8]} intensity={0.35} color="#e0f2fe" />
          <StoreShell layout={layout} quality={quality} />
          <ProductInstances blocks={layout.blocks} group="box" atlas={atlas} />
          <ProductInstances blocks={layout.blocks} group="cyl" atlas={atlas} />
          <ProductInstances blocks={layout.blocks} group="sphere" atlas={atlas} />
          <PriceTags blocks={layout.blocks} atlas={tagAtlas} />
          <FocusHighlight blocks={layout.blocks} />
          <PickupEffects productsById={productsById} />
          <Player layout={layout} productsById={productsById} />
        </Canvas>
      </SceneErrorBoundary>
      <Hud layout={layout} productsById={productsById} products={products} displayOffer={displayOffer} offers={offers} isTouch={env.touch} />
    </div>
  );
}
