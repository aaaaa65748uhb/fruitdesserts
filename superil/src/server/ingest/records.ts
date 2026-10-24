import { XMLParser } from "fast-xml-parser";
import { canonicalGtin } from "@/lib/gtin";
import type { PackageUnit } from "@/lib/types";
import { israelLocalToIso, normalizeStoreId, type FileKind } from "./filename";

/**
 * Extracts and validates records from official price-transparency XML (PriceFull/Price, PromoFull/Promo,
 * Stores). Chains wrap records differently (Root/Items/Item, Prices/Products/Product, asx:abap/STORES/STORE,
 * upper/lower case tags), so records are located by their fields rather than by a fixed path.
 *
 * Nothing is invented: a missing value stays missing, and every rejected record is reported with a reason.
 */

export type Severity = "error" | "warning";

export interface Issue {
  severity: Severity;
  code: string;
  message: string;
  /** 1-based position of the record in the file. */
  record?: number;
  itemCode?: string;
}

export interface FileHeader {
  chainId?: string;
  subChainId?: string;
  storeId?: string;
}

export interface PriceRecord {
  record: number;
  itemCode: string;
  /** Canonical GTIN when ItemCode is a valid barcode (never for ItemType=0 internal codes). */
  barcode?: string;
  /** Stable key: "g:<gtin>" across retailers, or "i:<retailer>:<code>" for retailer-internal codes. */
  productKey: string;
  name: string;
  manufacturer?: string;
  quantity: number;
  unit: PackageUnit;
  isWeighted: boolean;
  price: number;
  unitOfMeasurePrice?: number;
  /** PriceUpdateDate: when this price last changed (not when the file was published). */
  priceChangedAt?: string;
}

export interface PromotionRecord {
  record: number;
  promotionId: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  updatedAt?: string;
  minQty?: number;
  maxQty?: number;
  discountedPrice?: number;
  discountedPricePerMida?: number;
  /** Raw club identifiers. "0" (כלל הלקוחות) means the promotion applies to all customers. */
  clubIds: string[];
  /** true = all customers, false = club/coupon restricted, undefined = not stated in the file. */
  generalPublic?: boolean;
  requiresCoupon?: boolean;
  items: { itemCode: string; productKey: string; isGift: boolean }[];
}

export interface StoreRecord {
  record: number;
  storeId: string;
  subChainId?: string;
  chainId?: string;
  name?: string;
  address?: string;
  /** City name as published. Some chains publish a numeric locality code instead of a name. */
  city?: string;
  cityIsCode: boolean;
  zipCode?: string;
  storeType?: string;
}

export interface ParsedFile<T> {
  kind: FileKind;
  header: FileHeader;
  records: T[];
  totalRecords: number;
  issues: Issue[];
  /** Latest timestamp found inside the file (PriceUpdateDate / PromotionUpdateDate / LastUpdateDate). */
  latestInnerTimestamp?: string;
}

type Node = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false, // barcodes and store ids keep their leading zeros
  trimValues: true,
  processEntities: true,
  removeNSPrefix: true,
});

function lowerKeys(node: unknown): Map<string, unknown> {
  const m = new Map<string, unknown>();
  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node as Node)) m.set(k.toLowerCase(), v);
  }
  return m;
}

function field(node: Map<string, unknown>, ...names: string[]): string | undefined {
  for (const n of names) {
    const v = node.get(n.toLowerCase());
    if (v === undefined || v === null) continue;
    if (typeof v === "object") continue;
    const s = String(v).trim();
    if (s.length) return s;
  }
  return undefined;
}

/** Depth-first walk collecting every object node that satisfies `match`. Matching nodes are not descended. */
function collect(root: unknown, match: (m: Map<string, unknown>) => boolean): Map<string, unknown>[] {
  const out: Map<string, unknown>[] = [];
  const stack: unknown[] = [root];
  while (stack.length) {
    const cur = stack.pop();
    if (Array.isArray(cur)) {
      for (let i = cur.length - 1; i >= 0; i--) stack.push(cur[i]);
      continue;
    }
    if (!cur || typeof cur !== "object") continue;
    const m = lowerKeys(cur);
    if (match(m)) {
      out.push(m);
      continue;
    }
    const children = Object.values(cur as Node);
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
  return out;
}

/** Finds header values (ChainId etc.) outside the record nodes, breadth-first. */
function findHeader(root: unknown, isRecord: (m: Map<string, unknown>) => boolean): FileHeader {
  const header: FileHeader = {};
  const queue: unknown[] = [root];
  while (queue.length && (!header.chainId || !header.storeId || !header.subChainId)) {
    const cur = queue.shift();
    if (Array.isArray(cur)) {
      queue.push(...cur);
      continue;
    }
    if (!cur || typeof cur !== "object") continue;
    const m = lowerKeys(cur);
    if (isRecord(m)) continue;
    header.chainId ??= field(m, "ChainId");
    header.subChainId ??= field(m, "SubChainId");
    header.storeId ??= field(m, "StoreId");
    queue.push(...Object.values(cur as Node));
  }
  if (header.storeId) header.storeId = normalizeStoreId(header.storeId);
  return header;
}

function parseNumber(v?: string): number | undefined {
  if (v === undefined) return undefined;
  const s = v.replace(/,/g, ".").replace(/[^\d.\-]/g, "");
  if (!s || !/^-?\d*\.?\d+$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Parses "2026-10-20 08:15:00", "2026-10-20T08:15", "20/10/2026 08:15" or a date + separate hour (Israel time). */
export function parseIsraelDateTime(date?: string, time?: string): string | undefined {
  if (!date) return undefined;
  const d = date.trim();
  let y: number, mo: number, day: number;
  let rest = "";
  let m = d.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](.*))?$/);
  if (m) {
    [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    rest = m[4] ?? "";
  } else if ((m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(.*))?$/))) {
    [day, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    rest = m[4] ?? "";
  } else if ((m = d.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?$/))) {
    return israelLocalToIso(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
  } else return undefined;
  const t = (time ?? rest).trim();
  const tm = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (t && !tm) return undefined;
  return israelLocalToIso(y, mo, day, tm ? Number(tm[1]) : 0, tm ? Number(tm[2]) : 0, tm?.[3] ? Number(tm[3]) : 0);
}

/** Maps the UnitQty / UnitOfMeasure texts used in the files. Unknown → undefined (never guessed). */
export function mapUnit(unitQty?: string): PackageUnit | undefined {
  if (!unitQty) return undefined;
  const u = unitQty.replace(/["'׳״.]/g, "").replace(/^100\s*/, "").trim().toLowerCase();
  if (/^(ק\s*ג|קג|קילו|קילוגרם|קילוגרמים|kg|kilo)/.test(u)) return "kg";
  if (/^(ג\s*ר|גר|גרם|גרמים|g|gr|gram)/.test(u)) return "g";
  if (/^(מ\s*ל|מל|מיליליטר|מיליליטרים|ml)/.test(u)) return "ml";
  if (/^(ליטר|ליטרים|ל$|l$|lt|liter|litre)/.test(u)) return "l";
  if (/^(יח|יחידה|יחידות|unit|each|מארז|אריזה)/.test(u)) return "unit";
  return undefined;
}

// Records are recognised by several characteristic fields, so a row that is missing one key field (e.g. no
// ItemCode) is still counted and reported as invalid instead of disappearing silently.
const PRICE_FIELDS = ["itemcode", "itemprice", "itemname", "itemnm", "unitqty", "quantity", "priceupdatedate"];
const isPriceNode = (m: Map<string, unknown>) => !m.has("promotionid") && PRICE_FIELDS.filter((f) => m.has(f)).length >= 2 && (m.has("itemprice") || m.has("itemcode"));
const isPromoNode = (m: Map<string, unknown>) => m.has("promotionid");
const isStoreNode = (m: Map<string, unknown>) =>
  (m.has("storeid") && (m.has("storename") || m.has("address") || m.has("city"))) || (m.has("storename") && (m.has("address") || m.has("city")));

export function detectKind(doc: unknown): FileKind | undefined {
  if (collect(doc, isPromoNode).length) return "promo_full";
  if (collect(doc, isPriceNode).length) return "price_full";
  if (collect(doc, isStoreNode).length) return "stores";
  return undefined;
}

export function parseXml(text: string): { doc?: unknown; error?: string } {
  try {
    const doc = parser.parse(text, true);
    return { doc };
  } catch (e) {
    return { error: e instanceof Error ? e.message.split("\n")[0] : "Invalid XML" };
  }
}

export function productKeyFor(retailerId: string, itemCode: string, itemType?: string): { productKey: string; barcode?: string; internal: boolean } {
  const barcode = itemType === "0" ? undefined : canonicalGtin(itemCode);
  if (barcode) return { productKey: `g:${barcode}`, barcode, internal: false };
  return { productKey: `i:${retailerId}:${itemCode.trim()}`, internal: true };
}

const MAX_PRICE = 20_000;

export function extractPrices(doc: unknown, retailerId: string): ParsedFile<PriceRecord> {
  const nodes = collect(doc, isPriceNode);
  const issues: Issue[] = [];
  const valid: PriceRecord[] = [];
  let latest: string | undefined;

  nodes.forEach((m, i) => {
    const record = i + 1;
    const itemCode = field(m, "ItemCode");
    const name = field(m, "ItemName", "ItemNm", "ManufacturerItemDescription");
    const rawPrice = field(m, "ItemPrice");
    const reject = (code: string, message: string) => issues.push({ severity: "error", code, message, record, itemCode });
    if (!itemCode) return reject("missing_item_code", "חסר ItemCode – הרשומה לא יובאה");
    if (!name) return reject("missing_name", "חסר שם מוצר (ItemName) – הרשומה לא יובאה");
    if (rawPrice === undefined) return reject("missing_price", "חסר מחיר (ItemPrice) – הרשומה לא יובאה");
    const price = parseNumber(rawPrice);
    if (price === undefined) return reject("invalid_price", `מחיר לא תקין "${rawPrice}" – הרשומה לא יובאה`);
    if (price <= 0) return reject("non_positive_price", `מחיר ${price} אינו חיובי – הרשומה לא יובאה`);
    if (price > MAX_PRICE) return reject("implausible_price", `מחיר ${price} חריג – הרשומה לא יובאה`);

    const isWeighted = ["1", "true", "כן"].includes((field(m, "bIsWeighted", "BisWeighted") ?? "0").toLowerCase());
    const quantity = parseNumber(field(m, "Quantity"));
    const unit = mapUnit(field(m, "UnitQty")) ?? mapUnit(field(m, "UnitOfMeasure"));
    if (quantity === undefined || quantity <= 0 || !unit) {
      return reject("missing_package_size", `גודל אריזה חסר או לא מוכר (Quantity="${field(m, "Quantity") ?? ""}", UnitQty="${field(m, "UnitQty") ?? ""}") – לא ניתן להשוות מחיר ליחידה, הרשומה לא יובאה`);
    }

    const itemType = field(m, "ItemType");
    const key = productKeyFor(retailerId, itemCode, itemType);
    if (key.internal && itemType !== "0" && /^\d{8,14}$/.test(itemCode)) {
      issues.push({ severity: "warning", code: "invalid_barcode", message: `ItemCode ${itemCode} נראה כברקוד אך ספרת הביקורת שגויה – טופל כקוד פנימי של הרשת`, record, itemCode });
    }
    const rawDate = field(m, "PriceUpdateDate");
    const priceChangedAt = parseIsraelDateTime(rawDate);
    if (rawDate && !priceChangedAt) issues.push({ severity: "warning", code: "invalid_date", message: `PriceUpdateDate לא תקין "${rawDate}"`, record, itemCode });
    if (priceChangedAt && (!latest || priceChangedAt > latest)) latest = priceChangedAt;

    const manufacturer = field(m, "ManufacturerName", "ManufactureName");
    valid.push({
      record,
      itemCode,
      barcode: key.barcode,
      productKey: key.productKey,
      name,
      manufacturer: manufacturer && !/^(לא ידוע|unknown|כללי)$/i.test(manufacturer) ? manufacturer : undefined,
      quantity,
      unit,
      isWeighted,
      price,
      unitOfMeasurePrice: parseNumber(field(m, "UnitOfMeasurePrice")),
      priceChangedAt,
    });
  });

  // Duplicates inside one file: identical price → keep one (warning); different prices → conflict, both rejected.
  const byKey = new Map<string, PriceRecord[]>();
  for (const r of valid) byKey.set(r.productKey, [...(byKey.get(r.productKey) ?? []), r]);
  const records: PriceRecord[] = [];
  for (const [key, list] of byKey) {
    if (list.length === 1) {
      records.push(list[0]);
      continue;
    }
    const prices = new Set(list.map((r) => r.price));
    if (prices.size === 1) {
      records.push(list[0]);
      issues.push({ severity: "warning", code: "duplicate_record", message: `${list.length} רשומות זהות לאותו פריט (${key}) – נשמרה אחת`, record: list[1].record, itemCode: list[0].itemCode });
    } else {
      issues.push({ severity: "error", code: "conflicting_record", message: `לאותו פריט (${key}) הופיעו מחירים שונים בקובץ: ${[...prices].join(", ")} – אף אחד מהם לא יובא`, record: list[0].record, itemCode: list[0].itemCode });
    }
  }
  return { kind: "price_full", header: findHeader(doc, isPriceNode), records, totalRecords: nodes.length, issues, latestInnerTimestamp: latest };
}

export function extractPromotions(doc: unknown, retailerId: string): ParsedFile<PromotionRecord> {
  const nodes = collect(doc, isPromoNode);
  const issues: Issue[] = [];
  const records: PromotionRecord[] = [];
  let latest: string | undefined;
  const seen = new Set<string>();

  nodes.forEach((m, i) => {
    const record = i + 1;
    const promotionId = field(m, "PromotionId");
    if (!promotionId) return issues.push({ severity: "error", code: "missing_promotion_id", message: "חסר PromotionId – המבצע לא יובא", record });
    if (seen.has(promotionId)) {
      issues.push({ severity: "warning", code: "duplicate_promotion", message: `מבצע ${promotionId} מופיע יותר מפעם אחת – נשמר הראשון`, record });
      return;
    }
    // Items may be nested anywhere under the promotion (PromotionItems/Item, Items/Item…).
    const itemNodes = collect(Object.fromEntries(m), (n) => n.has("itemcode"));
    const items = itemNodes
      .map((n) => {
        const code = field(n, "ItemCode");
        if (!code) return undefined;
        const k = productKeyFor(retailerId, code, field(n, "ItemType"));
        return { itemCode: code, productKey: k.productKey, isGift: field(n, "IsGiftItem") === "1" };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    if (!items.length) return issues.push({ severity: "error", code: "promotion_without_items", message: `למבצע ${promotionId} אין פריטים – לא יובא`, record });

    const startsAt = parseIsraelDateTime(field(m, "PromotionStartDate"), field(m, "PromotionStartHour"));
    const endsAt = parseIsraelDateTime(field(m, "PromotionEndDate"), field(m, "PromotionEndHour") ?? "23:59:59");
    const updatedAt = parseIsraelDateTime(field(m, "PromotionUpdateDate"));
    if (!startsAt || !endsAt) issues.push({ severity: "warning", code: "promotion_dates_unverified", message: `למבצע ${promotionId} אין תאריכי תחילה/סיום תקינים – יוצג כ"לא מאומת"`, record });
    if (updatedAt && (!latest || updatedAt > latest)) latest = updatedAt;

    const clubIds = collect(Object.fromEntries(m), (n) => n.has("clubid")).flatMap((n) => {
      const v = n.get("clubid");
      return (Array.isArray(v) ? v : [v]).map((x) => String(x ?? "").trim()).filter(Boolean);
    });
    const generalPublic = clubIds.length ? clubIds.some((c) => /^0(\D|$)/.test(c)) && clubIds.every((c) => /^0(\D|$)/.test(c)) : undefined;
    const coupon = collect(Object.fromEntries(m), (n) => n.has("additionaliscoupon"))[0];

    seen.add(promotionId);
    records.push({
      record,
      promotionId,
      description: field(m, "PromotionDescription"),
      startsAt,
      endsAt,
      updatedAt,
      minQty: parseNumber(field(m, "MinQty")),
      maxQty: parseNumber(field(m, "MaxQty")),
      discountedPrice: parseNumber(field(m, "DiscountedPrice")),
      discountedPricePerMida: parseNumber(field(m, "DiscountedPricePerMida")),
      clubIds,
      generalPublic,
      requiresCoupon: coupon ? field(coupon, "AdditionalIsCoupon") === "1" : undefined,
      items,
    });
  });
  return { kind: "promo_full", header: findHeader(doc, isPromoNode), records, totalRecords: nodes.length, issues, latestInnerTimestamp: latest };
}

export function extractStores(doc: unknown): ParsedFile<StoreRecord> {
  const nodes = collect(doc, isStoreNode);
  const issues: Issue[] = [];
  const records: StoreRecord[] = [];
  const seen = new Set<string>();
  nodes.forEach((m, i) => {
    const record = i + 1;
    const raw = field(m, "StoreId");
    if (!raw) return issues.push({ severity: "error", code: "missing_store_id", message: "חסר StoreId – הסניף לא יובא", record });
    const storeId = normalizeStoreId(raw);
    const subChainId = field(m, "SubChainId");
    const key = `${subChainId ?? ""}:${storeId}`;
    if (seen.has(key)) return issues.push({ severity: "warning", code: "duplicate_store", message: `סניף ${storeId} מופיע יותר מפעם אחת – נשמר הראשון`, record });
    seen.add(key);
    const city = field(m, "City");
    records.push({
      record,
      storeId,
      subChainId,
      chainId: field(m, "ChainId"),
      name: field(m, "StoreName"),
      address: field(m, "Address"),
      city,
      cityIsCode: !!city && /^\d+$/.test(city),
      zipCode: field(m, "ZipCode"),
      storeType: field(m, "StoreType"),
    });
  });
  const lastUpdate = (() => {
    const top = collect(doc, (n) => n.has("lastupdatedate"))[0];
    return top ? parseIsraelDateTime(field(top, "LastUpdateDate"), field(top, "LastUpdateTime")) : undefined;
  })();
  return { kind: "stores", header: findHeader(doc, isStoreNode), records, totalRecords: nodes.length, issues, latestInnerTimestamp: lastUpdate };
}
