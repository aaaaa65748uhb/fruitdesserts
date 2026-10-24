import "server-only";
import { RETAILERS, RETAILER_BY_ID } from "@/data/retailers";
import { SEED_PRODUCTS } from "@/data/seed-products";
import { freshnessFromPublication } from "@/lib/freshness";
import type { FreshnessStatus } from "@/lib/types";
import { configChecks, type ConfigCheck } from "./config-check";
import { priceConfig } from "./prices/config";
import { sameSize } from "./prices/matching";
import { effectiveMappings, getPriceRepository, storageMode, type StorageMode } from "./prices/service";
import { getPriceMode, type PriceMode } from "./providers";
import { SampleOfferSource } from "./providers/sample-offers";

export interface BranchReadiness {
  storeId: string;
  name?: string;
  city?: string;
  offers: number;
  lastPublishedAt?: string;
  freshness: FreshnessStatus;
}

export interface RetailerReadiness {
  retailerId: string;
  name: string;
  storesImported: number;
  branches: BranchReadiness[];
  promoImports: number;
  lastImportAt?: string;
}

export interface Readiness {
  generatedAt: string;
  storage: { mode: StorageMode; connected: boolean; persistentForProduction: boolean; error?: string };
  priceMode: PriceMode;
  imports: { total: number; successful: number; byKind: Record<string, number>; latestSuccessful?: { at: string; retailer: string; entryName: string; kind: string }; archivedFiles: number };
  realPricesImported: boolean;
  retailers: RetailerReadiness[];
  mappings: { approved: number; approvedFromFile: number; productsWithApprovedLink: number; productsWithOfficialPrices: number; rejected: number; catalogProducts: number };
  prices: Record<"verified" | "saved" | "stale", number> & { sample: number; sampleEnabled: boolean };
  config: ConfigCheck[];
  checklist: { label: string; ok: boolean; detail?: string }[];
}

/** Operational status for administrators only (never rendered on public pages). */
export async function readinessReport(): Promise<Readiness> {
  const mode = storageMode();
  const prod = process.env.NODE_ENV === "production";
  const r = await getPriceRepository();
  let connected = true;
  let error: string | undefined;
  try {
    await r.ping();
  } catch (e) {
    connected = false;
    error = e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : "unknown error";
  }
  const empty: Readiness = {
    generatedAt: new Date().toISOString(),
    storage: { mode, connected, persistentForProduction: mode === "postgres" || (mode === "file" && !!process.env.PRICE_DATA_DIR), error },
    priceMode: "none",
    imports: { total: 0, successful: 0, byKind: {}, archivedFiles: 0 },
    realPricesImported: false,
    retailers: [],
    mappings: { approved: 0, approvedFromFile: 0, productsWithApprovedLink: 0, productsWithOfficialPrices: 0, rejected: 0, catalogProducts: SEED_PRODUCTS.length },
    prices: { verified: 0, saved: 0, stale: 0, sample: 0, sampleEnabled: false },
    config: configChecks(),
    checklist: [],
  };
  if (!connected) {
    empty.checklist = [{ label: "חיבור לאחסון הנתונים", ok: false, detail: error }];
    return empty;
  }

  const [imports, priceBranches, stores, archived, byPublication, mappings, priceMode] = await Promise.all([
    r.listImports(),
    r.listPriceBranches(),
    r.getStores(),
    r.listArchivedUploads(),
    r.priceCountsByPublication(),
    effectiveMappings(),
    getPriceMode(),
  ]);
  const successful = imports.filter((b) => b.applied.written > 0 || b.applied.removed > 0);
  const byKind: Record<string, number> = {};
  for (const b of successful) byKind[b.kind] = (byKind[b.kind] ?? 0) + 1;
  const latest = [...successful].sort((a, b) => a.importedAt.localeCompare(b.importedAt)).at(-1);

  const lastPublished = new Map<string, string>();
  for (const b of successful) {
    if (!b.storeId || !b.kind.startsWith("price")) continue;
    const k = `${b.retailerId}:${b.storeId}`;
    if (!lastPublished.has(k) || lastPublished.get(k)! < b.publishedAt) lastPublished.set(k, b.publishedAt);
  }
  const retailers: RetailerReadiness[] = RETAILERS.map((ret) => {
    const own = successful.filter((b) => b.retailerId === ret.id);
    return {
      retailerId: ret.id,
      name: ret.nameHe,
      storesImported: stores.filter((s) => s.retailerId === ret.id).length,
      promoImports: own.filter((b) => b.kind.startsWith("promo")).length,
      lastImportAt: own.map((b) => b.importedAt).sort().at(-1),
      branches: priceBranches
        .filter((b) => b.retailerId === ret.id)
        .map((b) => {
          const s = stores.find((x) => x.retailerId === b.retailerId && x.storeId === b.storeId);
          const last = lastPublished.get(`${b.retailerId}:${b.storeId}`) ?? b.lastFullPublishedAt;
          return { storeId: b.storeId, name: s?.name, city: s?.cityIsCode ? undefined : s?.city, offers: b.offers, lastPublishedAt: last, freshness: freshnessFromPublication(last, priceConfig.verifiedMaxAgeMs, priceConfig.staleAfterMs) };
        }),
    };
  }).filter((x) => x.branches.length || x.storesImported || x.lastImportAt);

  const prices = { verified: 0, saved: 0, stale: 0 };
  for (const { publishedAt, count } of byPublication) {
    const f = freshnessFromPublication(publishedAt, priceConfig.verifiedMaxAgeMs, priceConfig.staleAfterMs);
    if (f === "live") prices.verified += count;
    else if (f === "cached") prices.saved += count;
    else prices.stale += count;
  }
  const sampleEnabled = priceMode === "sample" || priceMode === "mixed";
  const sample = sampleEnabled
    ? (await new SampleOfferSource(new Map(SEED_PRODUCTS.map((p) => [p.id, p])), RETAILERS).offersFor(SEED_PRODUCTS.map((p) => p.id))).length
    : 0;

  const linkedProducts = new Set(mappings.approved.map((a) => a.productId));
  let productsWithOfficialPrices = 0;
  for (const p of SEED_PRODUCTS) {
    const keys = mappings.map[p.id];
    if (keys && (await r.offersByKeys(keys)).some((o) => sameSize(o, p))) productsWithOfficialPrices++;
  }

  const realPricesImported = successful.some((b) => b.kind.startsWith("price"));
  const adminOk = configChecks().find((c) => c.id === "ADMIN_TOKEN")?.level === "ok";
  const checklist = [
    { label: "שרת בסביבת ייצור (NODE_ENV=production)", ok: prod },
    { label: "אחסון קבוע (PostgreSQL)", ok: mode === "postgres", detail: mode === "postgres" ? undefined : "מומלץ DATABASE_URL לייצור" },
    { label: "חיבור לאחסון הנתונים", ok: connected },
    { label: "קוד גישת מנהל חזק", ok: adminOk },
    { label: "יובא קובץ סניפים רשמי", ok: (byKind.stores ?? 0) > 0 },
    { label: "יובא קובץ מחירים רשמי", ok: realPricesImported },
    { label: "יש מחירים מאומתים או שמורים", ok: prices.verified + prices.saved > 0 },
    { label: "יש מוצרי קטלוג עם קישור ברקוד מאושר ומחירים", ok: productsWithOfficialPrices > 0 },
    { label: "מחירים לדוגמה כבויים", ok: !sampleEnabled },
    { label: "בדיקה ידנית של 3–5 מחירים מול אתר הרשת", ok: false, detail: "יש לבצע ידנית ולתעד – המערכת אינה יכולה לאמת זאת" },
  ];

  return {
    ...empty,
    priceMode,
    imports: {
      total: imports.length,
      successful: successful.length,
      byKind,
      latestSuccessful: latest ? { at: latest.importedAt, retailer: RETAILER_BY_ID[latest.retailerId]?.nameHe ?? latest.retailerId, entryName: latest.entryName, kind: latest.kind } : undefined,
      archivedFiles: archived.length,
    },
    realPricesImported,
    retailers,
    mappings: {
      approved: mappings.approved.length,
      approvedFromFile: mappings.approved.filter((a) => a.source === "file").length,
      productsWithApprovedLink: linkedProducts.size,
      productsWithOfficialPrices,
      rejected: mappings.rejected.size,
      catalogProducts: SEED_PRODUCTS.length,
    },
    prices: { ...prices, sample, sampleEnabled },
    checklist,
  };
}
