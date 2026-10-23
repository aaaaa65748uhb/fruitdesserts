import { XMLParser } from "fast-xml-parser";
import { isValidGtin } from "@/lib/gtin";
import type { PackageUnit } from "@/lib/types";

/**
 * Parser for the "PriceFull" / "Price" XML files that large Israeli retailers must publish under the
 * Food Act price-transparency regulations (חוק קידום התחרות בענף המזון, תקנות שקיפות מחירים).
 *
 * Chains differ in casing and wrapper elements (Root/root, Items/Item vs Products/Product), so lookups are
 * case-insensitive. Files are provided by the operator (downloaded from the chains' official publication
 * portals) — this module never fetches anything by itself.
 */

export interface FeedItem {
  itemCode: string;
  /** Set only when itemCode is a valid GTIN; internal store codes (ItemType=0) are not barcodes. */
  barcode?: string;
  name: string;
  manufacturer?: string;
  quantity?: number;
  unit?: PackageUnit;
  isWeighted: boolean;
  price: number;
  unitOfMeasurePrice?: number;
  priceUpdateDate?: string;
}

export interface ParsedFeed {
  chainId?: string;
  subChainId?: string;
  storeId?: string;
  items: FeedItem[];
  skipped: number;
}

type Node = Record<string, unknown>;

function get(node: unknown, key: string): unknown {
  if (!node || typeof node !== "object") return undefined;
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(node as Node)) if (k.toLowerCase() === lower) return v;
  return undefined;
}

function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function num(v: unknown): number | undefined {
  const s = str(v);
  if (!s) return undefined;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function mapUnit(unitQty?: string): PackageUnit | undefined {
  if (!unitQty) return undefined;
  const u = unitQty.replace(/["'׳״]/g, "").trim();
  if (/^(ק\s*ג|קג|קילו|קילוגרם|קילוגרמים|kg)/i.test(u)) return "kg";
  if (/^(ג\s*ר|גר|גרם|גרמים|g\b|gr)/i.test(u) || /100\s*גרם/.test(u)) return "g";
  if (/^(מ\s*ל|מל|מיליליטר|מיליליטרים|ml)/i.test(u)) return "ml";
  if (/^(ליטר|ליטרים|ל\b|l\b|lt)/i.test(u)) return "l";
  if (/^(יח|יחידה|יחידות|unit)/i.test(u)) return "unit";
  return undefined;
}

/** Converts "2026-10-20 08:15:00" / "2026-10-20T08:15:00" (Israel local time) to ISO. */
export function parseFeedDate(v?: string): string | undefined {
  if (!v) return undefined;
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return undefined;
  // Treat as Asia/Jerusalem; approximate offset (+02:00 winter / +03:00 summer) via Intl.
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  const tzName = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", timeZoneName: "shortOffset" })
    .formatToParts(new Date(naive))
    .find((p) => p.type === "timeZoneName")?.value;
  const offsetHours = Number(tzName?.replace("GMT", "") || 2);
  return new Date(naive - offsetHours * 3600_000).toISOString();
}

export function parsePriceFullXml(xml: string): ParsedFeed {
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false, // keep barcodes as strings (leading zeros!)
    trimValues: true,
    processEntities: true,
    isArray: (name) => ["item", "product"].includes(name.toLowerCase()),
  });
  const doc = parser.parse(xml) as Node;
  const root = get(doc, "Root") ?? get(doc, "Prices") ?? doc;
  const container = get(root, "Items") ?? get(root, "Products") ?? root;
  const rawItems = (get(container, "Item") ?? get(container, "Product") ?? []) as unknown[];

  const items: FeedItem[] = [];
  let skipped = 0;
  for (const raw of rawItems) {
    const itemCode = str(get(raw, "ItemCode"));
    const name = str(get(raw, "ItemName")) ?? str(get(raw, "ItemNm")) ?? str(get(raw, "ManufacturerItemDescription"));
    const price = num(get(raw, "ItemPrice"));
    if (!itemCode || !name || price === undefined || price < 0) {
      skipped++;
      continue;
    }
    const itemType = str(get(raw, "ItemType"));
    const isWeighted = ["1", "true"].includes((str(get(raw, "bIsWeighted")) ?? "0").toLowerCase());
    const barcode = itemType !== "0" && isValidGtin(itemCode) ? itemCode : undefined;
    const manufacturer = str(get(raw, "ManufacturerName")) ?? str(get(raw, "ManufactureName"));
    items.push({
      itemCode,
      barcode,
      name,
      manufacturer: manufacturer && !/^לא ידוע|^unknown$/i.test(manufacturer) ? manufacturer : undefined,
      quantity: num(get(raw, "Quantity")),
      unit: mapUnit(str(get(raw, "UnitQty")) ?? str(get(raw, "UnitOfMeasure"))),
      isWeighted,
      price,
      unitOfMeasurePrice: num(get(raw, "UnitOfMeasurePrice")),
      priceUpdateDate: parseFeedDate(str(get(raw, "PriceUpdateDate"))),
    });
  }
  return {
    chainId: str(get(root, "ChainId")),
    subChainId: str(get(root, "SubChainId")),
    storeId: str(get(root, "StoreId")),
    items,
    skipped,
  };
}
