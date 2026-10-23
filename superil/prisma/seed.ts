/** Seeds PostgreSQL with the development catalog, retailers and SAMPLE offers (marked freshness="sample"). */
import { PrismaClient } from "@prisma/client";
import { RETAILERS } from "../src/data/retailers";
import { SEED_PRODUCTS } from "../src/data/seed-products";
import { SampleOfferSource } from "../src/server/providers/sample-offers";

const db = new PrismaClient();

async function main() {
  for (const r of RETAILERS) {
    const data = { nameHe: r.nameHe, nameEn: r.nameEn, homepageUrl: r.homepageUrl, homepageVerified: r.homepageVerified, integration: r.integration, deliveryFee: r.deliveryFee, minimumOrder: r.minimumOrder };
    await db.retailer.upsert({ where: { id: r.id }, update: data, create: { id: r.id, ...data } });
  }
  for (const p of SEED_PRODUCTS) {
    const data = {
      nameHe: p.nameHe, nameEn: p.nameEn, brand: p.brand, category: p.category, packageSize: p.packageSize, packageUnit: p.packageUnit,
      multipack: p.multipack, manufacturer: p.manufacturer, dietaryTags: p.dietaryTags ?? [], productDescription: p.productDescription,
      provenance: p.provenance, imageSource: p.imageSource, packagingShape: p.packaging.shape, packagingColor: p.packaging.color, packagingAccent: p.packaging.accent,
    };
    await db.product.upsert({ where: { id: p.id }, update: data, create: { id: p.id, ...data } });
  }
  const offers = await new SampleOfferSource(new Map(SEED_PRODUCTS.map((p) => [p.id, p])), RETAILERS).offersFor(SEED_PRODUCTS.map((p) => p.id));
  for (const o of offers) {
    const data = { productId: o.productId, retailerId: o.retailerId, price: o.price, unitPrice: o.unitPrice, unitPriceBasis: o.unitPriceBasis, sourceProvider: o.sourceProvider, freshness: o.freshness, matchConfidence: o.matchConfidence };
    await db.priceOffer.upsert({ where: { id: o.id }, update: data, create: { id: o.id, ...data } });
  }
  console.log(`Seeded ${RETAILERS.length} retailers, ${SEED_PRODUCTS.length} products, ${offers.length} sample offers.`);
}

main().finally(() => db.$disconnect());
