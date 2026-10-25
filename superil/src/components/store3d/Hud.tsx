"use client";
import { ArrowRight, HelpCircle, Info, Map as MapIcon, MapPin, Search, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/client/cart-store";
import { useUi } from "@/client/ui-store";
import { AddToCart } from "@/components/AddToCart";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { Logo } from "@/components/Logo";
import { Packshot } from "@/components/Packshot";
import { Price } from "@/components/Price";
import { CartButton } from "@/components/SiteHeader";
import { OfferTable } from "@/components/OfferTable";
import { RETAILER_BY_ID } from "@/data/retailers";
import { sortOffers } from "@/lib/compare";
import { searchProducts } from "@/lib/search";
import { formatPackage } from "@/lib/units";
import type { PriceOffer, Product } from "@/lib/types";
import type { StoreLayout } from "./layout";
import { pickUpFocused } from "./Player";
import { playerLive, touchInput, useStore3d } from "./state";

export interface HudProps {
  layout: StoreLayout;
  productsById: Record<string, Product>;
  products: Product[];
  displayOffer: Record<string, PriceOffer | undefined>;
  offers: Record<string, PriceOffer[]>;
  isTouch: boolean;
}

function exitLock() {
  if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
}

export function Hud(props: HudProps) {
  const { started, locked, panelProductId, searchOpen, helpOpen } = useStore3d();
  const cartOpen = useUi((s) => s.cartOpen);
  useEffect(() => {
    if (cartOpen) exitLock();
  }, [cartOpen]);

  return (
    <div className="pointer-events-none absolute inset-0 select-none" dir="rtl">
      <TopBar {...props} />
      {started && <Crosshair />}
      {started && !panelProductId && !searchOpen && <FocusPrompt {...props} />}
      {started && <Minimap layout={props.layout} />}
      {started && !locked && !props.isTouch && !panelProductId && !searchOpen && !helpOpen && !cartOpen && (
        <div className="absolute inset-x-0 top-20 flex justify-center">
          <div className="glass-dark animate-pop rounded-full px-5 py-2 text-sm text-white">לחצו על התמונה כדי להמשיך לשלוט במבט · Esc לשחרור העכבר</div>
        </div>
      )}
      {props.isTouch && started && !panelProductId && !searchOpen && <TouchControls />}
      {!started && <StartOverlay isTouch={props.isTouch} />}
      {panelProductId && props.productsById[panelProductId] && (
        <ProductPanel product={props.productsById[panelProductId]} offers={props.offers[panelProductId] ?? []} />
      )}
      {searchOpen && <SearchOverlay {...props} />}
      {helpOpen && <HelpOverlay />}
    </div>
  );
}

function TopBar({ layout }: HudProps) {
  const set = useStore3d((s) => s.set);
  const requestTeleport = useStore3d((s) => s.requestTeleport);
  const [zonesOpen, setZonesOpen] = useState(false);
  return (
    <div className="pointer-events-auto absolute inset-x-0 top-0 flex items-center gap-2 p-3">
      <Link href="/" onClick={exitLock} className="glass inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-ink shadow-float">
        <ArrowRight className="h-4 w-4" />
        <span className="hidden sm:inline">יציאה</span>
        <Logo className="text-base" />
      </Link>
      <div className="relative">
        <button type="button" onClick={() => { exitLock(); setZonesOpen((o) => !o); }} className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold shadow-float" aria-expanded={zonesOpen}>
          <MapPin className="h-4 w-4 text-brand-700" />
          <span className="hidden sm:inline">מחלקות</span>
        </button>
        {zonesOpen && (
          <div className="glass animate-pop absolute top-12 right-0 z-10 max-h-[60vh] w-72 overflow-y-auto rounded-2xl p-2 shadow-float">
            {layout.zones.map((z) => (
              <button
                type="button"
                key={z.id}
                className="block w-full rounded-xl px-3 py-2 text-right text-sm hover:bg-brand-50"
                onClick={() => {
                  requestTeleport(z.x, z.z, z.yaw);
                  setZonesOpen(false);
                }}
              >
                {z.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button type="button" onClick={() => { exitLock(); set({ searchOpen: true }); }} className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold shadow-float">
        <Search className="h-4 w-4 text-brand-700" />
        <span className="hidden sm:inline">חיפוש</span>
        <kbd className="hidden rounded bg-slate-200 px-1.5 text-[10px] md:inline">F</kbd>
      </button>
      <button type="button" onClick={() => { exitLock(); set({ helpOpen: true }); }} className="glass rounded-full p-2 shadow-float" aria-label="עזרה ומקשים">
        <HelpCircle className="h-5 w-5 text-slate-700" />
      </button>
      <div className="mr-auto">
        <CartButton dark />
      </div>
    </div>
  );
}

function Crosshair() {
  const focus = useStore3d((s) => s.focus);
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <div className={`rounded-full border-2 transition-all ${focus ? "h-6 w-6 border-sun-400 bg-sun-400/20" : "h-2 w-2 border-white/90 bg-white/60"}`} />
    </div>
  );
}

function OfferLine({ offer }: { offer?: PriceOffer }) {
  if (!offer) return <span className="text-sm text-slate-300">אין מחיר זמין</span>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Price value={offer.price} className="text-2xl font-extrabold" />
      <span className="text-xs text-slate-300">{RETAILER_BY_ID[offer.retailerId]?.nameHe}{offer.branchName ? ` · ${offer.branchName}` : ""}</span>
      <FreshnessBadge status={offer.freshness} />
    </span>
  );
}

function FocusPrompt({ layout, productsById, displayOffer, isTouch }: HudProps) {
  const focus = useStore3d((s) => s.focus);
  const set = useStore3d((s) => s.set);
  const inCart = useCart((s) => (focus ? s.lines[focus.productId]?.quantity ?? 0 : 0));
  if (!focus) return null;
  const p = productsById[focus.productId];
  if (!p) return null;
  const block = layout.blocks[focus.blockIndex];
  return (
    <div className="absolute inset-x-0 bottom-28 flex justify-center px-3 md:bottom-8">
      <div className="glass-dark animate-pop pointer-events-auto w-full max-w-md rounded-2xl p-4 text-white shadow-float" key={focus.productId}>
        <div className="flex items-start gap-3">
          <Packshot product={p} size={64} className="shrink-0 rounded-xl bg-white/10" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-300">{block?.zoneLabel}</p>
            <p className="truncate text-lg font-extrabold">{p.nameHe}</p>
            <p className="text-sm text-slate-300">
              {p.brand} · {formatPackage(p)}
            </p>
            <div className="mt-1">
              <OfferLine offer={displayOffer[p.id]} />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          {isTouch ? (
            <>
              <button type="button" onClick={() => pickUpFocused(layout, productsById)} className="flex-1 rounded-xl bg-brand-600 py-3 text-base font-bold">
                הוספה לסל
              </button>
              <button type="button" onClick={() => set({ panelProductId: p.id })} className="rounded-xl bg-white/15 px-4 py-3 font-bold">
                פרטים
              </button>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5"><kbd className="rounded bg-white px-2 py-0.5 font-bold text-ink">E</kbd> / קליק – הוספה לסל</span>
              <span className="inline-flex items-center gap-1.5"><kbd className="rounded bg-white px-2 py-0.5 font-bold text-ink">Q</kbd> פרטים והשוואה</span>
            </>
          )}
          {inCart > 0 && (
            <span className="mr-auto inline-flex items-center gap-1 text-xs text-brand-200">
              <ShoppingCart className="h-3.5 w-3.5" /> <span className="num">{inCart}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProductPanel({ product, offers }: { product: Product; offers: PriceOffer[] }) {
  const set = useStore3d((s) => s.set);
  const [sort, setSort] = useState<"price" | "unitPrice">("price");
  const sorted = useMemo(() => sortOffers(offers, sort), [offers, sort]);
  const close = () => set({ panelProductId: null });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-slate-900/40 p-3" role="dialog" aria-modal="true" aria-label={product.nameHe}>
      <div className="animate-pop max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start gap-4 p-5">
          <Packshot product={product} size={120} className="shrink-0 rounded-2xl bg-slate-50" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-500">{product.brand}</p>
            <h2 className="text-2xl font-extrabold">{product.nameHe}</h2>
            <p className="text-slate-600">{formatPackage(product)}</p>
            {product.provenance === "curated_demo" && (
              <p className="mt-1 text-xs text-amber-700">פריט קטלוג לדוגמה – פרטי האריזה לא אומתו מול היצרן. התמונה היא איור.</p>
            )}
            <div className="mt-3">
              <AddToCart product={product} withQuantity />
            </div>
          </div>
          <button type="button" onClick={close} className="rounded-full p-2 hover:bg-slate-100" aria-label="סגירה">
            <X />
          </button>
        </div>
        <div className="border-t border-slate-100 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold">מחירים לפי רשת</h3>
            <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-xs">
              {(["price", "unitPrice"] as const).map((k) => (
                <button type="button" key={k} onClick={() => setSort(k)} className={`rounded-full px-3 py-1 ${sort === k ? "bg-white font-bold shadow-sm" : ""}`}>
                  {k === "price" ? "לפי מחיר" : "לפי מחיר ליחידה"}
                </button>
              ))}
            </div>
          </div>
          <OfferTable offers={sorted} />
          <Link href={`/product/${product.id}`} target="_blank" className="mt-3 inline-flex items-center gap-1 text-sm text-brand-700 underline">
            <Info className="h-4 w-4" /> עמוד המוצר המלא (בלשונית חדשה)
          </Link>
        </div>
      </div>
    </div>
  );
}

function SearchOverlay({ products, layout, displayOffer }: HudProps) {
  const set = useStore3d((s) => s.set);
  const requestTeleport = useStore3d((s) => s.requestTeleport);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const placed = useMemo(() => new Set(layout.blocks.map((b) => b.productId)), [layout]);
  const results = useMemo(() => searchProducts(products, q, {}, 12), [products, q]);
  const close = () => set({ searchOpen: false });
  const goTo = (productId: string) => {
    // Pick the block of this product closest to the player.
    let best = layout.blocks.find((b) => b.productId === productId);
    let bd = Infinity;
    for (const b of layout.blocks) {
      if (b.productId !== productId) continue;
      const d = Math.hypot(b.viewpoint.x - playerLive.x, b.viewpoint.z - playerLive.z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    if (best) requestTeleport(best.viewpoint.x, best.viewpoint.z, best.viewpoint.yaw, best.viewpoint.pitch);
    close();
  };
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 bg-slate-900/30 p-3 pt-20" onKeyDown={(e) => e.key === "Escape" && close()} role="dialog" aria-modal="true" aria-label="חיפוש בסופר">
      <div className="animate-pop mx-auto max-w-xl rounded-3xl bg-white p-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-slate-400" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="מה מחפשים? (המיקום שלכם בחנות נשמר)" className="flex-1 bg-transparent py-2 text-lg outline-none" aria-label="חיפוש מוצר" />
          <button type="button" onClick={close} className="rounded-full p-2 hover:bg-slate-100" aria-label="סגירה">
            <X />
          </button>
        </div>
        <ul className="mt-2 max-h-[60dvh] divide-y divide-slate-100 overflow-y-auto">
          {results.map(({ product: p }) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <Packshot product={p} size={44} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{p.nameHe} <span className="font-normal text-slate-500">{p.brand}</span></p>
                <p className="text-xs text-slate-500">{formatPackage(p)}</p>
              </div>
              {displayOffer[p.id] && <Price value={displayOffer[p.id]!.price} className="text-sm font-bold" />}
              {placed.has(p.id) && (
                <button type="button" onClick={() => goTo(p.id)} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold hover:bg-slate-200">
                  <MapIcon className="h-3.5 w-3.5" /> למדף
                </button>
              )}
              <AddToCart product={p} compact />
            </li>
          ))}
          {q && !results.length && <li className="py-6 text-center text-slate-500">לא נמצאו מוצרים</li>}
        </ul>
      </div>
    </div>
  );
}

function StartOverlay({ isTouch }: { isTouch: boolean }) {
  const set = useStore3d((s) => s.set);
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 grid place-items-center bg-gradient-to-b from-slate-900/50 to-slate-900/70 p-4">
      <div className="animate-pop w-full max-w-lg rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8">
        <Logo className="text-2xl" />
        <h1 className="mt-3 text-3xl font-extrabold">ברוכים הבאים לסופר</h1>
        <p className="mt-2 text-slate-600">הסתובבו בין המעברים, הרימו מוצרים מהמדפים והשוו מחירים בין הרשתות.</p>
        <div className="mt-5 grid grid-cols-2 gap-2 text-right text-sm">
          {isTouch ? (
            <>
              <Hint k="ג׳ויסטיק" t="תזוזה (שמאל למטה)" />
              <Hint k="גרירה" t="הסתכלות" />
              <Hint k="מרכז המסך" t="כוונו אל מוצר" />
              <Hint k="הוספה לסל" t="כפתור גדול" />
            </>
          ) : (
            <>
              <Hint k="W A S D" t="הליכה" />
              <Hint k="עכבר" t="הסתכלות" />
              <Hint k="E / קליק" t="הוספת מוצר לסל" />
              <Hint k="Q" t="פרטים והשוואת מחירים" />
              <Hint k="F" t="חיפוש מוצר" />
              <Hint k="C" t="הצגת/הסתרת העגלה" />
              <Hint k="Esc" t="שחרור העכבר" />
            </>
          )}
        </div>
        <button
          type="button"
          autoFocus
          onClick={(e) => {
            set({ started: true });
            if (!isTouch) {
              const canvas = (e.currentTarget.closest("[data-store-root]") as HTMLElement | null)?.querySelector("canvas");
              try {
                (canvas?.requestPointerLock() as unknown as Promise<void> | undefined)?.catch?.(() => undefined);
              } catch {
                // ignore
              }
            }
          }}
          className="mt-6 w-full rounded-2xl bg-brand-700 py-4 text-lg font-extrabold text-white shadow-lg transition hover:bg-brand-800"
        >
          מתחילים לקנות
        </button>
        <p className="mt-3 text-xs text-slate-500">אריזות המוצרים בחנות הן איורים, והמחירים מסומנים לפי מקור הנתונים.</p>
      </div>
    </div>
  );
}

function Hint({ k, t }: { k: string; t: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
      <kbd className="rounded-md bg-white px-2 py-0.5 text-xs font-bold shadow-sm">{k}</kbd>
      <span>{t}</span>
    </div>
  );
}

function HelpOverlay() {
  const set = useStore3d((s) => s.set);
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 grid place-items-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="עזרה">
      <div className="animate-pop w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">עזרה ונגישות</h2>
          <button type="button" onClick={() => set({ helpOpen: false })} className="rounded-full p-2 hover:bg-slate-100" aria-label="סגירה"><X /></button>
        </div>
        <ul className="space-y-2 text-sm text-slate-700">
          <li>• הליכה: W/S קדימה ואחורה, A/D הצידה, חיצים לסיבוב. Shift להליכה מהירה, רווח לקפיצה.</li>
          <li>• הוספה לסל: כוונו את מרכז המסך אל מוצר ולחצו E או קליק.</li>
          <li>• Q פותח את פרטי המוצר עם כל המחירים לפי רשת.</li>
          <li>• העגלה שלפניכם מציגה את המוצרים שבסל. כשעומדים במקום היא זזה הצידה; C מסתיר או מציג אותה.</li>
          <li>• לחצן &quot;מחלקות&quot; מעביר אתכם ישירות למחלקה.</li>
          <li>• מעדיפים בלי תלת־ממד? <Link className="text-brand-700 underline" href="/search">חיפוש מוצרים רגיל</Link> משתמש באותו סל.</li>
          <li>• רגישות העכבר ואיכות הגרפיקה ב<Link className="text-brand-700 underline" href="/settings">הגדרות</Link>.</li>
        </ul>
      </div>
    </div>
  );
}

function Minimap({ layout }: { layout: StoreLayout }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!open) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const b = layout.bounds;
    const W = canvas.width;
    const H = canvas.height;
    const sx = W / (b.maxX - b.minX);
    const sz = H / (b.maxZ - b.minZ);
    const tx = (x: number) => (x - b.minX) * sx;
    const tz = (z: number) => (z - b.minZ) * sz;
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(0, 0, W, H);
      for (const r of layout.mapRects) {
        ctx.fillStyle = r.color;
        ctx.fillRect(tx(r.minX), tz(r.minZ), Math.max(1, (r.maxX - r.minX) * sx), Math.max(1, (r.maxZ - r.minZ) * sz));
      }
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      for (const a of layout.aisles) ctx.fillText(String(a.number), tx(a.x), tz(-8));
      // entrance
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(tx(-3), H - 3, 6 * sx, 3);
      // player
      const px = tx(playerLive.x);
      const pz = tz(playerLive.z);
      ctx.save();
      ctx.translate(px, pz);
      ctx.rotate(-playerLive.yaw);
      ctx.fillStyle = "rgba(4,120,87,0.25)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 22, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
      ctx.fill();
      ctx.fillStyle = "#047857";
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 5);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [layout, open]);
  return (
    <div className="pointer-events-auto absolute top-16 left-3">
      {open ? (
        <div className="overflow-hidden rounded-2xl shadow-float ring-1 ring-black/10">
          <canvas ref={ref} width={150} height={150} className="block h-[120px] w-[120px] md:h-[150px] md:w-[150px]" aria-label="מפת החנות" role="img" />
          <button type="button" onClick={() => setOpen(false)} className="glass block w-full py-1 text-xs">הסתר מפה</button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="glass rounded-full p-2 shadow-float" aria-label="הצג מפה"><MapIcon className="h-5 w-5" /></button>
      )}
    </div>
  );
}

function TouchControls() {
  const knob = useRef<HTMLDivElement>(null);
  const base = useRef<{ x: number; y: number; id: number } | null>(null);
  const look = useRef<{ x: number; y: number; id: number } | null>(null);
  const R = 50;
  return (
    <>
      {/* look pad: right 60% of the screen (in screen coords) */}
      <div
        className="pointer-events-auto absolute top-16 right-0 bottom-0 w-[60%] touch-none"
        onPointerDown={(e) => {
          look.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (look.current?.id !== e.pointerId) return;
          touchInput.lookDX += e.clientX - look.current.x;
          touchInput.lookDY += e.clientY - look.current.y;
          look.current = { ...look.current, x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => (look.current = null)}
        onPointerCancel={() => (look.current = null)}
      />
      {/* joystick */}
      <div
        className="pointer-events-auto absolute bottom-6 left-6 grid h-32 w-32 touch-none place-items-center rounded-full bg-white/25 ring-2 ring-white/60 backdrop-blur"
        aria-label="ג׳ויסטיק תזוזה"
        onPointerDown={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          base.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (base.current?.id !== e.pointerId) return;
          let dx = e.clientX - base.current.x;
          let dy = e.clientY - base.current.y;
          const len = Math.hypot(dx, dy);
          if (len > R) {
            dx = (dx / len) * R;
            dy = (dy / len) * R;
          }
          touchInput.moveX = dx / R;
          touchInput.moveY = -dy / R;
          if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
        }}
        onPointerUp={() => {
          base.current = null;
          touchInput.moveX = touchInput.moveY = 0;
          if (knob.current) knob.current.style.transform = "";
        }}
        onPointerCancel={() => {
          base.current = null;
          touchInput.moveX = touchInput.moveY = 0;
          if (knob.current) knob.current.style.transform = "";
        }}
      >
        <div ref={knob} className="h-14 w-14 rounded-full bg-white/90 shadow-lg" />
      </div>
    </>
  );
}
