/**
 * Imports a retailer's price-transparency file (PriceFull / Price XML, optionally .gz) that the operator
 * downloaded from the chain's official publication portal.
 *
 *   npm run import:feed -- --retailer shufersal --file ./data/price-feeds/PriceFull7290027600007-001-202610230300.gz
 *
 * - Without DATABASE_URL: writes data/imported/<retailer>-<store>.json, read by the local provider.
 * - With DATABASE_URL: also upserts products (by barcode) and branch-specific offers into PostgreSQL.
 * Offers are stored as "cached" (מחיר שמור) with the file's PriceUpdateDate. Nothing is fetched from the network.
 */
import { promises as fs } from "fs";
import path from "path";
import { gunzipSync } from "zlib";
import { RETAILER_BY_ID } from "../src/data/retailers";
import { computeUnitPrice } from "../src/lib/units";
import { parsePriceFullXml } from "../src/server/providers/price-feed-parser";
import { feedProductId, IMPORTED_DIR, type ImportedFeed } from "../src/server/providers/feed-store";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const retailerId = arg("retailer");
  const file = arg("file");
  if (!retailerId || !file) throw new Error("Usage: npm run import:feed -- --retailer <id> --file <path>");
  if (!RETAILER_BY_ID[retailerId]) throw new Error(`Unknown retailer "${retailerId}". Known: ${Object.keys(RETAILER_BY_ID).join(", ")}`);
  let buf = await fs.readFile(file);
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  const text = buf.toString("utf8").replace(/^﻿/, "");
  const feed = parsePriceFullXml(text);
  const imported: ImportedFeed = {
    retailerId,
    chainId: feed.chainId,
    storeId: feed.storeId,
    sourceFile: path.basename(file),
    importedAt: new Date().toISOString(),
    items: feed.items,
  };
  await fs.mkdir(IMPORTED_DIR, { recursive: true });
  const out = path.join(IMPORTED_DIR, `${retailerId}-${feed.storeId ?? "chain"}.json`);
  await fs.writeFile(out, JSON.stringify(imported));
  const withBarcode = feed.items.filter((i) => i.barcode).length;
  console.log(`Parsed ${feed.items.length} items (${withBarcode} with valid barcodes, ${feed.skipped} skipped) → ${out}`);

  if (process.env.DATABASE_URL) {
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    const branchId = feed.storeId ? `${retailerId}:${feed.storeId}` : null;
    if (branchId) {
      await db.branch.upsert({
        where: { id: branchId },
        update: {},
        create: { id: branchId, retailerId, name: `סניף ${feed.storeId}`, city: "לא ידוע", source: imported.sourceFile },
      });
    }
    let n = 0;
    for (const item of feed.items) {
      if (!item.barcode || !item.quantity || !item.unit) continue;
      const existing = await db.product.findUnique({ where: { barcode: item.barcode } });
      const productId = existing?.id ?? feedProductId(item.barcode);
      if (!existing) {
        await db.product.create({
          data: {
            id: productId, nameHe: item.name, brand: item.manufacturer ?? "לא צוין", category: "other", barcode: item.barcode,
            packageSize: item.quantity, packageUnit: item.unit, manufacturer: item.manufacturer, provenance: "price_feed", imageSource: "placeholder-generated",
          },
        });
      }
      const unit = computeUnitPrice(item.price, { packageSize: item.quantity, packageUnit: item.unit });
      const id = `feed:${branchId ?? retailerId}:${item.barcode}`;
      const data = {
        productId, retailerId, branchId, price: item.price, unitPrice: unit?.unitPrice, unitPriceBasis: unit?.basis,
        sourceProvider: "price-transparency-files", freshness: "cached",
        lastVerifiedAt: item.priceUpdateDate ? new Date(item.priceUpdateDate) : new Date(imported.importedAt), matchConfidence: 1,
      };
      await db.priceOffer.upsert({ where: { id }, update: data, create: { id, ...data } });
      n++;
    }
    await db.$disconnect();
    console.log(`Upserted ${n} offers into PostgreSQL.`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
