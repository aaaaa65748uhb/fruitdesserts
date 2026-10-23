import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { RETAILERS } from "@/data/retailers";
import { SEED_PRODUCTS } from "@/data/seed-products";
import type { ProviderStatus } from "@/lib/types";
import { ChpAdapter } from "@/server/providers/chp-adapter";
import { CompositeProvider, type ProductStore } from "@/server/providers/composite";
import { fetchJsonFromAllowedHost } from "@/server/providers/http";
import { mapUnit, parseFeedDate, parsePriceFullXml } from "@/server/providers/price-feed-parser";
import { SampleOfferSource } from "@/server/providers/sample-offers";
import type { OfferSource } from "@/server/providers/types";

const xml = readFileSync(path.join(__dirname, "fixtures/PriceFull-sample.xml"), "utf8");

describe("price-transparency feed parser", () => {
  const feed = parsePriceFullXml(xml);
  it("reads store metadata and valid items, skipping malformed rows", () => {
    expect(feed.storeId).toBe("042");
    expect(feed.items).toHaveLength(3);
    expect(feed.skipped).toBe(1);
  });
  it("keeps barcodes as strings (leading zeros) and only accepts valid GTINs", () => {
    expect(feed.items[0].barcode).toBe("4006381333931");
    expect(feed.items[1].barcode).toBe("0012345678905");
    expect(feed.items[2].barcode).toBeUndefined(); // ItemType 0 internal code
    expect(feed.items[2].isWeighted).toBe(true);
  });
  it("maps units, drops unknown manufacturers and converts Israel-local dates", () => {
    expect(feed.items[0]).toMatchObject({ unit: "g", quantity: 500, price: 12.9, manufacturer: "יצרן בדיקה" });
    expect(feed.items[1].unit).toBe("l");
    expect(feed.items[1].manufacturer).toBeUndefined();
    expect(mapUnit("מ\"ל")).toBe("ml");
    expect(mapUnit("ק\"ג")).toBe("kg");
    expect(mapUnit("יחידה")).toBe("unit");
    expect(parseFeedDate("2026-10-20 08:15:00")).toBe("2026-10-20T05:15:00.000Z"); // IDT = UTC+3
    expect(parseFeedDate("2026-12-20 08:15:00")).toBe("2026-12-20T06:15:00.000Z"); // IST = UTC+2
  });
});

const okStore: ProductStore = {
  id: "test",
  load: async () => SEED_PRODUCTS,
  status: async (): Promise<ProviderStatus> => ({ id: "test", name: "t", kind: "catalog", enabled: true, healthy: true, freshness: "sample", message: "" }),
};
const failing: OfferSource = {
  id: "broken",
  offersFor: async () => {
    throw new Error("upstream down");
  },
  status: async () => {
    throw new Error("upstream down");
  },
};

describe("provider composition", () => {
  const sample = new SampleOfferSource(new Map(SEED_PRODUCTS.map((p) => [p.id, p])), RETAILERS);
  const provider = new CompositeProvider(okStore, [sample, failing, new ChpAdapter()]);

  it("keeps answering when one offer source fails", async () => {
    const offers = await provider.getProductOffers("bamba-80");
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o.freshness === "sample" && o.sourceProvider === "superil-demo")).toBe(true);
  });
  it("reports failing providers as unhealthy instead of crashing", async () => {
    const statuses = await provider.getDataFreshness();
    expect(statuses.find((s) => s.id === "broken")?.healthy).toBe(false);
    const chp = statuses.find((s) => s.id === "chp")!;
    expect(chp.enabled).toBe(false);
  });
  it("sample offers are deterministic and some product/retailer pairs are deliberately missing", async () => {
    const a = await sample.offersFor(SEED_PRODUCTS.map((p) => p.id));
    const b = await sample.offersFor(SEED_PRODUCTS.map((p) => p.id));
    expect(a).toEqual(b);
    expect(a.length).toBeLessThan(SEED_PRODUCTS.length * RETAILERS.length);
    expect(a.every((o) => o.unitPrice === undefined || o.unitPrice > 0)).toBe(true);
  });
  it("searches through the provider and returns no branches without real data", async () => {
    expect((await provider.searchProducts("במבה"))[0].id).toBe("bamba-80");
    expect(await provider.getBranches("shufersal")).toEqual([]);
  });
});

describe("safe external fetching", () => {
  it("refuses non-allow-listed hosts and non-https URLs", async () => {
    await expect(fetchJsonFromAllowedHost("t", "https://evil.example/x", ["api.example.org"])).rejects.toThrow(/not allowed/);
    await expect(fetchJsonFromAllowedHost("t", "http://api.example.org/x", ["api.example.org"])).rejects.toThrow(/not allowed/);
    await expect(fetchJsonFromAllowedHost("t", "not a url", ["api.example.org"])).rejects.toThrow(/Invalid URL/);
  });
});
