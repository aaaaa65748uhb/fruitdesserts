import { mkdtempSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { gzipSync, zipSync } from "fflate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { compareBasket } from "@/lib/compare";
import { RETAILERS } from "@/data/retailers";
import { JsonPriceRepository } from "@/server/prices/json-repo";
import { mergePriceSnapshot } from "@/server/prices/merge";
import { sameSize } from "@/server/prices/matching";
import { commitUpload, matchingOverview, previewUpload, setCatalogMapping, setPriceRepository } from "@/server/prices/service";
import { OfficialPriceSource } from "@/server/providers/official-source";
import { fixture } from "./helpers";

const NOW = Date.parse("2026-10-24T12:00:00Z");
const FULL = "PriceFull7290000000001-001-202610240300.xml";
const UPDATE = "Price7290000000001-001-202610241100.xml";
const OTHER_CHAIN = "PriceFull7290000000002-015-202610240200.xml";
const PROMO = "PromoFull7290000000001-001-202610240300.xml";
const STORES = "Stores7290000000001-202610240000.xml";
const opts = { importedBy: "cli" as const, now: NOW };

let dir: string;
let repo: JsonPriceRepository;

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "superil-prices-"));
  repo = new JsonPriceRepository(path.join(dir, "store"));
  setPriceRepository(repo);
  process.env.BARCODE_MAP_FILE = path.join(dir, "barcode-map.json");
  writeFileSync(process.env.BARCODE_MAP_FILE, "{}");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterAll(() => {
  vi.useRealTimers();
  setPriceRepository(undefined);
  delete process.env.BARCODE_MAP_FILE;
});

describe("preview and import", () => {
  it("preview writes nothing and reports counts, errors and matching", async () => {
    const r = await previewUpload(FULL, fixture(FULL), { ...opts, retailerId: "shufersal" });
    const e = r.entries[0];
    expect(e).toMatchObject({ status: "ready", storeId: "1", counts: { total: 12, valid: 7, errors: 4 } });
    expect(e.matching).toMatchObject({ matchedToCatalog: 0, newProducts: 7, internalCodes: 2 });
    expect(await repo.listImports()).toHaveLength(0);
    expect(await repo.listPriceBranches()).toHaveLength(0);
  });

  it("imports a full file and records provenance", async () => {
    const r = await commitUpload(FULL, fixture(FULL), { ...opts, retailerId: "shufersal" });
    expect(r.entries[0]).toMatchObject({ status: "imported", applied: { written: 7, removed: 0 } });
    const [batch] = await repo.listImports();
    expect(batch).toMatchObject({ retailerId: "shufersal", storeId: "1", chainId: "7290000000001", publishedAt: "2026-10-24T00:00:00.000Z", publishedAtSource: "file_name", provenance: "official-price-transparency-file", entryName: FULL });
    expect(batch.importedAt).toBe(new Date(NOW).toISOString());
    expect((await repo.getImportIssues(batch.id)).length).toBeGreaterThan(0);
    expect(await repo.getChainMap()).toEqual({ "7290000000001": "shufersal" });
  });

  it("is safe to repeat: the same file is detected and forced re-imports create no duplicates", async () => {
    await commitUpload(FULL, fixture(FULL), { ...opts, retailerId: "shufersal" });
    const again = await commitUpload(FULL, fixture(FULL), opts); // retailer resolved from learned chain code
    expect(again.entries[0].status).toBe("already_imported");
    const forced = await commitUpload(FULL, fixture(FULL), { ...opts, force: true });
    expect(forced.entries[0]).toMatchObject({ status: "not_applied", applied: { written: 0, unchanged: 0, skippedOlder: 7 } });
    const offers = await repo.offersByKeys(["g:7299990000012"]);
    expect(offers).toHaveLength(1);
  });

  it("detects the same upload when gzipped or zipped and imports archive entries", async () => {
    const zip = zipSync({ [`${FULL}.gz`]: gzipSync(fixture(FULL)), [STORES]: fixture(STORES), [PROMO]: fixture(PROMO) });
    const r = await commitUpload("bundle.zip", zip, { ...opts, retailerId: "shufersal" });
    expect(r.entries.map((e) => [e.kind, e.status])).toEqual([
      ["stores", "imported"],
      ["price_full", "imported"],
      ["promo_full", "imported"],
    ]);
    expect((await repo.getStores("shufersal")).map((s) => s.storeId)).toEqual(["1", "2"]);
  });

  it("applies newer update files and ignores older files", async () => {
    await commitUpload(FULL, fixture(FULL), { ...opts, retailerId: "shufersal" });
    const upd = await commitUpload(UPDATE, fixture(UPDATE), { ...opts, retailerId: "shufersal" });
    expect(upd.entries[0]).toMatchObject({ applied: { written: 1 } });
    expect(upd.entries[0].issueCounts.conflicting_record).toBe(1);
    expect((await repo.offersByKeys(["g:7299990000029"]))[0]).toMatchObject({ price: 6.9, publishedAt: "2026-10-24T08:00:00.000Z" });
    // An older full file must not overwrite newer data.
    const older = "PriceFull7290000000001-001-202610230300.xml";
    const r = await commitUpload(older, fixture(FULL), { ...opts, retailerId: "shufersal" });
    expect(r.entries[0].applied?.skippedOlder).toBe(7);
    expect((await repo.offersByKeys(["g:7299990000029"]))[0].price).toBe(6.9);
  });

  it("a newer full file removes items no longer listed but keeps newer update records", () => {
    const base = { kind: "price_full" as const, retailerId: "shufersal", storeId: "1", entryName: "x", importedAt: "2026-10-24T00:00:00Z" };
    const rec = (code: string, price: number) => ({ record: 1, itemCode: code, productKey: `g:${code}`, name: code, quantity: 1, unit: "unit" as const, isWeighted: false, price });
    const s1 = mergePriceSnapshot(undefined, [rec("a", 1), rec("b", 2)], { ...base, id: "1", publishedAt: "2026-10-23T00:00:00Z" }).snapshot;
    const s2 = mergePriceSnapshot(s1, [rec("b", 3)], { ...base, kind: "price", id: "2", publishedAt: "2026-10-24T10:00:00Z" }).snapshot;
    const { snapshot, stats } = mergePriceSnapshot(s2, [rec("a", 1.5)], { ...base, id: "3", publishedAt: "2026-10-24T00:00:00Z" });
    expect(stats.removed).toBe(0);
    expect(snapshot.offers["g:b"].price).toBe(3); // newer update kept
    expect(snapshot.offers["g:a"].price).toBe(1.5);
    const s4 = mergePriceSnapshot(snapshot, [rec("b", 3)], { ...base, id: "4", publishedAt: "2026-10-25T00:00:00Z" });
    expect(s4.stats.removed).toBe(1); // "a" no longer sold
  });

  it("blocks entries with problems and imports nothing from them", async () => {
    const r = await commitUpload(FULL, fixture(FULL), opts); // retailer unknown
    expect(r.entries[0].status).toBe("blocked");
    expect(await repo.listImports()).toHaveLength(0);
  });
});

describe("matching, freshness and promotions", () => {
  async function importAll() {
    await commitUpload(STORES, fixture(STORES), { ...opts, retailerId: "shufersal" });
    await commitUpload(FULL, fixture(FULL), { ...opts, retailerId: "shufersal" });
    await commitUpload(PROMO, fixture(PROMO), { ...opts, retailerId: "shufersal" });
    await commitUpload(OTHER_CHAIN, fixture(OTHER_CHAIN), { ...opts, retailerId: "rami-levy" });
  }

  it("the same barcode from two chains is one product; different sizes are not", async () => {
    await importAll();
    const src = new OfficialPriceSource();
    const offers = await src.offersFor(["gtin-7299990000012", "gtin-0012345678905", "gtin-7299990000029"]);
    const by = (id: string) => offers.filter((o) => o.productId === id).map((o) => `${o.retailerId}:${o.price}`).sort();
    expect(by("gtin-7299990000012")).toEqual(["rami-levy:4.9", "shufersal:5.2"]);
    expect(by("gtin-0012345678905")).toEqual(["rami-levy:5.2", "shufersal:4.9"]); // UPC-12 and EAN-13 forms
    expect(by("gtin-7299990000029")).toEqual(["shufersal:7.1"]); // Rami Levy's 3 L record has a different size
    const overview = await matchingOverview();
    expect(overview.conflicts.sizeConflicts.some((c) => c.productKey === "g:7299990000029" && c.found === "3 l")).toBe(true);
  });

  it("offers carry branch, provenance and publication-based freshness", async () => {
    await importAll();
    const src = new OfficialPriceSource();
    const [o] = (await src.offersFor(["gtin-7299990000012"])).filter((x) => x.retailerId === "shufersal");
    expect(o).toMatchObject({
      branchId: "shufersal:1",
      branchName: "סניף בדיקה מרכז, עיר בדיקה",
      publishedAt: "2026-10-24T00:00:00.000Z",
      priceChangedAt: "2026-09-01T05:00:00.000Z",
      sourceFile: FULL,
      freshness: "live",
      sourceProvider: "official-price-files",
      unitPriceBasis: "100g",
    });
    expect(o.unitPrice).toBeCloseTo(6.5, 3);
    vi.setSystemTime(NOW + 3 * 86_400_000);
    expect((await src.offersFor(["gtin-7299990000012"]))[0].freshness).toBe("cached");
    vi.setSystemTime(NOW + 30 * 86_400_000);
    const stale = await src.offersFor(["gtin-7299990000012"]);
    expect(stale.every((x) => x.freshness === "stale")).toBe(true);
    // Stale prices are excluded from basket totals.
    const cmp = compareBasket([{ productId: "gtin-7299990000012", quantity: 1 }], { "gtin-7299990000012": stale }, RETAILERS);
    expect(cmp.cheapestCompleteRetailerId).toBeUndefined();
    expect(cmp.notes.join(" ")).toMatch(/לא עדכניים/);
  });

  it("promotions are shown with a verified status but never applied to totals", async () => {
    await importAll();
    const src = new OfficialPriceSource();
    const snack = (await src.offersFor(["gtin-7299990000012"])).find((o) => o.retailerId === "shufersal")!;
    expect(snack.promotions?.[0]).toMatchObject({ promotionId: "1001", status: "active", generalPublic: true, verified: false });
    expect(snack.promotion).toBeUndefined();
    const milk = (await src.offersFor(["gtin-7299990000029"]))[0];
    expect(milk.promotions?.map((p) => [p.promotionId, p.status, p.generalPublic])).toEqual(
      expect.arrayContaining([["1002", "expired", true], ["1003", "active", false]]),
    );
    const two = (await src.offersFor(["gtin-7299990000036"]))[0];
    expect(two.promotions?.[0].status).toBe("unverified");
  });

  it("links catalog products only through reviewed identifiers, with a size check", async () => {
    await importAll();
    // Bamba 80 g (curated) vs. the 80 g synthetic snack barcode: same size → allowed.
    expect((await setCatalogMapping("bamba-80", "7299990000012")).ok).toBe(true);
    // Milk 1 L product vs. the 2 L barcode → refused.
    const bad = await setCatalogMapping("milk-tnuva-3-1l", "7299990000036");
    expect(bad.ok).toBe(false);
    expect(bad.message).toMatch(/גודל האריזה שונה/);
    // Already linked to another product → refused.
    expect((await setCatalogMapping("bamba-nougat", "7299990000012")).ok).toBe(false);
    const src = new OfficialPriceSource();
    const offers = await src.offersFor(["bamba-80"]);
    expect(offers.map((o) => o.retailerId).sort()).toEqual(["rami-levy", "shufersal"]);
    expect((await src.products()).some((p) => p.id === "gtin-7299990000012")).toBe(false); // merged into the catalog product
    const overview = await matchingOverview();
    expect(overview.matched.map((m) => m.productId)).toEqual(["bamba-80"]);
    expect(overview.unmatchedRecords.total).toBeGreaterThan(0);
    expect(overview.duplicates.reduce((n, d) => n + d.count, 0)).toBe(1);
    expect(overview.unmatchedCatalog.some((p) => p.productId === "bamba-80")).toBe(false);
  });

  it("feed products appear in the catalog with their real package size", async () => {
    await importAll();
    const products = await new OfficialPriceSource().products();
    const tomato = products.find((p) => p.id === "int-shufersal-7001")!;
    expect(tomato).toMatchObject({ packageSize: 1, packageUnit: "kg", provenance: "price_feed", category: "other" });
    expect(sameSize({ quantity: 1, unit: "kg" }, { quantity: 1000, unit: "g" })).toBe(true);
    expect(sameSize({ quantity: 1, unit: "l" }, { quantity: 1000, unit: "g" })).toBe(false);
  });

  it("branch filters never hide other retailers' prices", async () => {
    await importAll();
    const offers = await new OfficialPriceSource().offersFor(["gtin-7299990000012"], { branchId: "shufersal:999" });
    expect(offers.map((o) => o.retailerId)).toEqual(["rami-levy"]);
  });
});

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});
