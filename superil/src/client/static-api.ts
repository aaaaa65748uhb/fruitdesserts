/**
 * In-browser implementation of the public SUPERIL API, used only by the static demo build
 * (NEXT_PUBLIC_STATIC_DEMO=1, e.g. for Netlify Drop). It answers the same requests as src/app/api/* using the
 * built-in catalog and the SAMPLE offers, so prices are always labelled "נתון לדוגמה". There is no admin area,
 * no imports and no official prices in this mode – those need the server deployment (docs/DEPLOYMENT.md).
 */
import { RETAILERS } from "@/data/retailers";
import { SEED_PRODUCTS } from "@/data/seed-products";
import { buildCheckoutHandoff } from "@/lib/checkout";
import { compareBasket } from "@/lib/compare";
import { searchProducts, suggest } from "@/lib/search";
import type { CategoryId, PriceOffer, ProviderStatus } from "@/lib/types";
import { SampleOfferSource } from "@/server/providers/sample-offers";

const byId = new Map(SEED_PRODUCTS.map((p) => [p.id, p]));
const sample = new SampleOfferSource(byId, RETAILERS);

async function offersFor(ids: string[]): Promise<Record<string, PriceOffer[]>> {
  const out: Record<string, PriceOffer[]> = Object.fromEntries(ids.map((id) => [id, []]));
  for (const o of await sample.offersFor(ids)) (out[o.productId] ??= []).push(o);
  return out;
}

const STATUS_PROVIDERS: ProviderStatus[] = [
  { id: "local-seed", name: "קטלוג מוצרים", kind: "catalog", enabled: true, healthy: true, freshness: "sample", message: "קטלוג שנאסף ידנית (פרטי אריזה לא אומתו מול היצרן)." },
  { id: "superil-demo", name: "נתוני הדגמה מובנים", kind: "prices", enabled: true, healthy: true, freshness: "sample", message: "גרסת הדגמה סטטית: כל המחירים הם נתונים לדוגמה ואינם מחירים אמיתיים." },
  { id: "official-price-files", name: "קבצי שקיפות מחירים רשמיים", kind: "prices", enabled: false, healthy: true, freshness: "unavailable", message: "לא זמין בגרסת ההדגמה – דורש את גרסת השרת." },
];

function body(init?: RequestInit): Record<string, unknown> {
  try {
    return JSON.parse(String(init?.body ?? "{}"));
  } catch {
    return {};
  }
}

/** Resolves an /api/* request locally. Returns the JSON the server route would return. */
export async function staticApi(url: string, init?: RequestInit): Promise<unknown> {
  const u = new URL(url, "http://local");
  const p = u.pathname.replace(/\/$/, "");
  const q = u.searchParams;
  const b = body(init);
  const items = (Array.isArray(b.items) ? b.items : []) as { productId: string; quantity: number }[];

  if (p === "/api/catalog") return { products: SEED_PRODUCTS };
  if (p === "/api/products") {
    const query = q.get("q") ?? "";
    const limit = Math.min(100, Math.max(1, Number(q.get("limit") ?? 40) || 40));
    const products = searchProducts(SEED_PRODUCTS, query, { category: (q.get("category") as CategoryId) || undefined, brand: q.get("brand") || undefined }, limit).map((h) => h.product);
    return { products, suggestions: query ? suggest(SEED_PRODUCTS, query) : [] };
  }
  if (p === "/api/products/batch") return { products: ((b.ids as string[]) ?? []).map((id) => byId.get(id)).filter(Boolean) };
  const m = p.match(/^\/api\/products\/([^/]+)$/);
  if (m) {
    const product = byId.get(decodeURIComponent(m[1]));
    if (!product) throw new Error("המוצר לא נמצא");
    return { product, offers: (await offersFor([product.id]))[product.id] };
  }
  if (p === "/api/offers") return { offers: await offersFor((b.productIds as string[]) ?? []) };
  if (p === "/api/basket/compare") return compareBasket(items, await offersFor(items.map((i) => i.productId)), RETAILERS);
  if (p === "/api/checkout/handoff") {
    const retailer = RETAILERS.find((r) => r.id === b.retailerId);
    if (!retailer) throw new Error("הרשת לא נמצאה");
    const products = Object.fromEntries(items.map((i) => [i.productId, byId.get(i.productId)]));
    return buildCheckoutHandoff(retailer, items, products, await offersFor(items.map((i) => i.productId)));
  }
  if (p === "/api/retailers") return { retailers: RETAILERS };
  if (p === "/api/branches") return { branches: [], note: "גרסת הדגמה: אין נתוני סניפים. סניפים מוצגים רק מקבצים רשמיים שיובאו בגרסת השרת." };
  if (p === "/api/status") return { providers: STATUS_PROVIDERS, priceMode: "sample", coverage: [] };
  throw new Error("לא זמין בגרסת ההדגמה");
}
