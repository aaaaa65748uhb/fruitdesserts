import type { PackageUnit } from "@/lib/types";
import { extractPrices, mapUnit as mapUnitImpl, parseIsraelDateTime, parseXml } from "../ingest/records";

/**
 * Backwards-compatible facade over the validated ingestion pipeline (src/server/ingest).
 * New code should use `analyzeUpload` / the import service, which also report every rejected record.
 */
export interface FeedItem {
  itemCode: string;
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

export const mapUnit = mapUnitImpl;
export const parseFeedDate = (v?: string) => parseIsraelDateTime(v);

export function parsePriceFullXml(xml: string): ParsedFeed {
  const { doc, error } = parseXml(xml);
  if (error || !doc) return { items: [], skipped: 0 };
  const parsed = extractPrices(doc, "unknown");
  return {
    chainId: parsed.header.chainId,
    subChainId: parsed.header.subChainId,
    storeId: parsed.header.storeId === undefined ? undefined : parsed.header.storeId.padStart(3, "0"),
    items: parsed.records.map((r) => ({
      itemCode: r.itemCode,
      barcode: r.barcode,
      name: r.name,
      manufacturer: r.manufacturer,
      quantity: r.quantity,
      unit: r.unit,
      isWeighted: r.isWeighted,
      price: r.price,
      unitOfMeasurePrice: r.unitOfMeasurePrice,
      priceUpdateDate: r.priceChangedAt,
    })),
    skipped: parsed.totalRecords - parsed.records.length,
  };
}
