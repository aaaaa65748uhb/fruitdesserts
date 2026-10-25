import { describe, expect, it } from "vitest";
import { SEED_PRODUCTS } from "@/data/seed-products";
import { normalizeText, searchProducts, suggest } from "@/lib/search";
import { computeUnitPrice, formatPackage, sameBasis, totalBaseQuantity } from "@/lib/units";
import { isValidGtin } from "@/lib/gtin";

describe("unit prices", () => {
  it("normalizes grams and kilograms to price per 100g", () => {
    expect(computeUnitPrice(5, { packageSize: 80, packageUnit: "g" })).toEqual({ unitPrice: 6.25, basis: "100g" });
    expect(computeUnitPrice(12, { packageSize: 1, packageUnit: "kg" })).toEqual({ unitPrice: 1.2, basis: "100g" });
  });
  it("normalizes litres to price per 100ml and counts multipacks", () => {
    expect(computeUnitPrice(18, { packageSize: 1.5, packageUnit: "l", multipack: 6 })).toEqual({ unitPrice: 0.2, basis: "100ml" });
  });
  it("uses per-unit pricing for counted items", () => {
    expect(computeUnitPrice(39.9, { packageSize: 32, packageUnit: "unit" })?.unitPrice).toBeCloseTo(1.247, 3);
  });
  it("returns undefined for unknown package sizes", () => {
    expect(computeUnitPrice(5, { packageSize: 0, packageUnit: "g" })).toBeUndefined();
  });
  it("distinguishes package sizes and measurement bases", () => {
    const single = { packageSize: 25, packageUnit: "g" as const };
    const multi = { packageSize: 25, packageUnit: "g" as const, multipack: 4 };
    expect(totalBaseQuantity(single).amount).toBe(25);
    expect(totalBaseQuantity(multi).amount).toBe(100);
    expect(formatPackage(multi)).toContain("4 ×");
    expect(sameBasis({ packageSize: 1, packageUnit: "l" }, { packageSize: 500, packageUnit: "g" })).toBe(false);
    expect(sameBasis({ packageSize: 1, packageUnit: "l" }, { packageSize: 330, packageUnit: "ml" })).toBe(true);
  });
});

describe("Hebrew search", () => {
  it("normalizes niqqud, final letters and geresh", () => {
    expect(normalizeText("קוטג'")).toBe(normalizeText("קוטג"));
    expect(normalizeText("שָׁלוֹם")).toBe("שלומ");
  });
  it("ranks exact product matches above broad category matches", () => {
    const hits = searchProducts(SEED_PRODUCTS, "במבה");
    expect(hits[0].product.nameHe).toBe("במבה");
    const cat = searchProducts(SEED_PRODUCTS, "חטיפים");
    expect(cat.length).toBeGreaterThan(5);
    expect(Math.max(...cat.map((h) => h.score))).toBeLessThan(hits[0].score);
  });
  it("supports partial matches, brands and spelling variations", () => {
    expect(searchProducts(SEED_PRODUCTS, "קוט").map((h) => h.product.id)).toContain("cottage-tnuva-250");
    expect(searchProducts(SEED_PRODUCTS, "קוטג").map((h) => h.product.id)).toContain("cottage-tnuva-250");
    expect(searchProducts(SEED_PRODUCTS, "שקולד").length).toBeGreaterThan(0); // defective spelling
    expect(searchProducts(SEED_PRODUCTS, "תנובה").every((h) => h.product.brand === "תנובה")).toBe(true);
    expect(searchProducts(SEED_PRODUCTS, "coke")[0].product.brand).toBe("קוקה-קולה");
  });
  it("does not merge different package sizes into one result", () => {
    const ids = searchProducts(SEED_PRODUCTS, "במבה").map((h) => h.product.id);
    expect(ids).toContain("bamba-80");
    expect(ids).toContain("bamba-200");
  });
  it("matches barcodes exactly", () => {
    const withBarcode = [{ ...SEED_PRODUCTS[0], barcode: "4006381333931" }, ...SEED_PRODUCTS.slice(1)];
    expect(searchProducts(withBarcode, "4006381333931")[0].score).toBe(1000);
  });
  it("respects filters and provides suggestions", () => {
    expect(searchProducts(SEED_PRODUCTS, "", { category: "dairy" }).every((h) => h.product.category === "dairy")).toBe(true);
    expect(suggest(SEED_PRODUCTS, "ביס").length).toBeGreaterThan(0);
  });
});

describe("seed data integrity", () => {
  it("has 100+ products, unique ids, and never invents barcodes", () => {
    expect(SEED_PRODUCTS.length).toBeGreaterThanOrEqual(100);
    expect(new Set(SEED_PRODUCTS.map((p) => p.id)).size).toBe(SEED_PRODUCTS.length);
    expect(SEED_PRODUCTS.every((p) => p.barcode === undefined && p.provenance === "curated_demo")).toBe(true);
  });
  it("validates GTIN check digits", () => {
    expect(isValidGtin("4006381333931")).toBe(true);
    expect(isValidGtin("4006381333932")).toBe(false);
    expect(isValidGtin("7001")).toBe(false);
  });
});
