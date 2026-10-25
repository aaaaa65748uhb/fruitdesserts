import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildStoreLayout, productDims } from "@/components/store3d/layout";
import { latheFromProfile } from "@/components/store3d/models";
import { PRODUCT_PHOTOS } from "@/data/product-photos";
import { SEED_PRODUCTS } from "@/data/seed-products";

const byId = Object.fromEntries(SEED_PRODUCTS.map((p) => [p.id, p]));

describe("product photos", () => {
  it("every photo belongs to a catalog product and its file is shipped", () => {
    for (const [id, photo] of Object.entries(PRODUCT_PHOTOS)) {
      expect(byId[id], id).toBeDefined();
      expect(photo.url).toBe(`/products/${id}.webp`);
      expect(existsSync(path.join(process.cwd(), "public", photo.url)), photo.url).toBe(true);
      expect(photo.aspect).toBeGreaterThan(0.1);
      expect(photo.aspect).toBeLessThan(10);
      expect(photo.offCode).toMatch(/^\d{8,14}$/);
      expect(photo.side).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  it("is credited for every photo (CC BY-SA attribution)", () => {
    const credits = readFileSync(path.join(process.cwd(), "public/products/CREDITS.txt"), "utf8");
    expect(credits).toContain("Attribution-ShareAlike 3.0");
    for (const [id, photo] of Object.entries(PRODUCT_PHOTOS)) {
      expect(credits).toContain(`${id}.webp`);
      expect(credits).toContain(`https://world.openfoodfacts.org/product/${photo.offCode}`);
    }
  });
  it("products with a photo use it, others stay marked as generated illustrations", () => {
    for (const p of SEED_PRODUCTS) {
      if (PRODUCT_PHOTOS[p.id]) {
        expect(p.imageUrl).toBe(PRODUCT_PHOTOS[p.id].url);
        expect(p.imageLicense).toBe("CC BY-SA 3.0");
      } else {
        expect(p.imageUrl).toBeUndefined();
        expect(p.imageSource).toBe("placeholder-generated");
      }
      // Photos never introduce barcodes into the catalog.
      expect(p.barcode).toBeUndefined();
    }
  });
  it("covers most packaged products", () => {
    const packaged = SEED_PRODUCTS.filter((p) => p.packaging.shape !== "produce");
    expect(packaged.filter((p) => PRODUCT_PHOTOS[p.id]).length).toBeGreaterThanOrEqual(100);
  });
});

describe("3D models from photos", () => {
  it("round packs become silhouette-shaped models, others photo boxes; width follows the photo", () => {
    const coke = byId["coke-1.5"];
    const dims = productDims(coke);
    expect(dims.group).toBe("round");
    expect(dims.w / dims.h).toBeCloseTo(PRODUCT_PHOTOS["coke-1.5"].aspect, 2);
    expect(productDims(byId["bamba-80"]).group).toBe("photo");
    expect(productDims(byId["tomatoes"]).group).toBe("produce");
  });
  it("lathe profiles are well-formed and the model stays within the unit box", () => {
    for (const photo of Object.values(PRODUCT_PHOTOS)) {
      if (!photo.profile) continue;
      expect(photo.profile.length).toBe(32);
      for (const r of photo.profile) {
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(0.5);
      }
    }
    const g = latheFromProfile(PRODUCT_PHOTOS["coke-1.5"].profile!, 12, 12);
    g.computeBoundingBox();
    expect(g.boundingBox!.min.y).toBeCloseTo(-0.5);
    expect(g.boundingBox!.max.y).toBeCloseTo(0.5);
    expect(g.boundingBox!.max.x).toBeLessThanOrEqual(0.5 + 1e-6);
  });
  it("stocks shelves several rows deep without affecting what can be picked", () => {
    const layout = buildStoreLayout(SEED_PRODUCTS);
    const shelf = layout.blocks.filter((b) => b.group === "photo" || b.group === "round");
    expect(shelf.some((b) => b.depth.rows > 1)).toBe(true);
    expect(layout.blocks.every((b) => b.depth.rows >= 1)).toBe(true);
  });
});
