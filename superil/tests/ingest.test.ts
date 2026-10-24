import { gzipSync, strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { canonicalGtin } from "@/lib/gtin";
import { analyzeUpload } from "@/server/ingest/analyze";
import { decodeUpload } from "@/server/ingest/decode";
import { normalizeStoreId, parseOfficialFileName } from "@/server/ingest/filename";
import { extractPrices, extractPromotions, extractStores, mapUnit, parseIsraelDateTime, parseXml } from "@/server/ingest/records";
import { encodeUtf16le, encodeWindows1255, fixture, fixtureText } from "./helpers";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-24T12:00:00Z");
const opts = { chainMap: {}, staleAfterMs: 7 * DAY, now: NOW };

describe("identifier normalization", () => {
  it("canonicalizes UPC-A and EAN-13 forms of the same GTIN", () => {
    expect(canonicalGtin("012345678905")).toBe("0012345678905");
    expect(canonicalGtin("0012345678905")).toBe("0012345678905");
    expect(canonicalGtin("00012345678905")).toBe("0012345678905");
    expect(canonicalGtin("7299990000012")).toBe("7299990000012");
  });
  it("rejects invalid check digits and non-GTIN codes", () => {
    expect(canonicalGtin("7299990000011")).toBeUndefined();
    expect(canonicalGtin("7001")).toBeUndefined();
    expect(canonicalGtin("ABC123")).toBeUndefined();
  });
  it("normalizes store ids with leading zeros", () => {
    expect(normalizeStoreId("001")).toBe("1");
    expect(normalizeStoreId("15")).toBe("15");
  });
  it("parses official file names", () => {
    const f = parseOfficialFileName("PriceFull7290000000001-001-202610240300.gz");
    expect(f).toMatchObject({ kind: "price_full", chainId: "7290000000001", storeId: "1", publishedAt: "2026-10-24T00:00:00.000Z" });
    expect(parseOfficialFileName("Price7290000000001-001-202610241100.xml").kind).toBe("price");
    expect(parseOfficialFileName("PromoFull7290000000001-001-002-20261224-030000.xml")).toMatchObject({ kind: "promo_full", storeId: "2", publishedAt: "2026-12-24T01:00:00.000Z" });
    const stores = parseOfficialFileName("Stores7290000000001-202610240000.xml");
    expect(stores.kind).toBe("stores");
    expect(stores.storeId).toBeUndefined();
    expect(parseOfficialFileName("random.xml").kind).toBeUndefined();
  });
  it("parses Israel-local dates in the formats seen in files", () => {
    expect(parseIsraelDateTime("2026-10-20 08:15:00")).toBe("2026-10-20T05:15:00.000Z");
    expect(parseIsraelDateTime("2026-12-20", "08:15")).toBe("2026-12-20T06:15:00.000Z");
    expect(parseIsraelDateTime("20/10/2026 08:15")).toBe("2026-10-20T05:15:00.000Z");
    expect(parseIsraelDateTime("not a date")).toBeUndefined();
    expect(parseIsraelDateTime("2026-13-40")).toBeUndefined();
  });
  it("maps package units without guessing", () => {
    expect(mapUnit("גרמים")).toBe("g");
    expect(mapUnit("100 גרם")).toBe("g");
    expect(mapUnit("ליטרים")).toBe("l");
    expect(mapUnit('מ"ל')).toBe("ml");
    expect(mapUnit("קילוגרמים")).toBe("kg");
    expect(mapUnit("יחידה")).toBe("unit");
    expect(mapUnit("ארגז")).toBeUndefined();
  });
});

describe("archive and encoding decoding", () => {
  const xml = fixtureText("PriceFull7290000000001-001-202610240300.xml");
  it("reads plain, gzip and ZIP (with nested .gz) uploads", () => {
    expect(decodeUpload("a.xml", strToU8(xml)).entries[0].container).toBe("plain");
    const gz = decodeUpload("PriceFull7290000000001-001-202610240300.gz", gzipSync(strToU8(xml)));
    expect(gz.entries[0]).toMatchObject({ container: "gzip", name: "PriceFull7290000000001-001-202610240300" });
    const zip = zipSync({
      "PriceFull7290000000001-001-202610240300.xml": strToU8(xml),
      "nested/Promo.xml.gz": gzipSync(strToU8(fixtureText("PromoFull7290000000001-001-202610240300.xml"))),
      "readme.txt": strToU8("not xml"),
      "__MACOSX/._junk": strToU8("x"),
    });
    const z = decodeUpload("bundle.zip", zip);
    expect(z.entries.map((e) => e.container).sort()).toEqual(["zip", "zip+gzip"]);
    expect(z.errors.some((e) => e.includes("readme.txt"))).toBe(true);
  });
  it("reports corrupt archives and non-XML files instead of ignoring them", () => {
    expect(decodeUpload("bad.gz", new Uint8Array([0x1f, 0x8b, 1, 2, 3])).errors.length).toBe(1);
    expect(decodeUpload("x.bin", new Uint8Array([1, 2, 3])).errors[0]).toMatch(/unsupported/);
  });
  it("decodes windows-1255 and UTF-16 files", () => {
    const body = "<Root><StoreId>1</StoreId><Items><Item><ItemCode>7299990000012</ItemCode><ItemName>במבה</ItemName><UnitQty>גרם</UnitQty><Quantity>80</Quantity><ItemPrice>5</ItemPrice></Item></Items></Root>";
    const w = decodeUpload("w.xml", encodeWindows1255('<?xml version="1.0" encoding="windows-1255"?>' + body)).entries[0];
    expect(w.encoding).toBe("windows-1255");
    expect(w.text).toContain("במבה");
    const u = decodeUpload("u.xml", encodeUtf16le('<?xml version="1.0" encoding="utf-16"?>' + body)).entries[0];
    expect(u.encoding).toBe("utf-16le");
    expect(u.text).toContain("במבה");
  });
});

describe("price records", () => {
  const { doc } = parseXml(fixtureText("PriceFull7290000000001-001-202610240300.xml"));
  const parsed = extractPrices(doc, "shufersal");
  const codes = parsed.issues.map((i) => i.code);
  it("reads the header and valid records", () => {
    expect(parsed.header).toEqual({ chainId: "7290000000001", subChainId: "001", storeId: "1" });
    expect(parsed.totalRecords).toBe(12);
    expect(parsed.records.map((r) => r.itemCode)).toEqual(["7299990000012", "7299990000029", "7299990000036", "012345678905", "7001", "7299990000074", "7299990000011"]);
  });
  it("reports every invalid record with a reason", () => {
    for (const c of ["invalid_price", "non_positive_price", "missing_package_size", "missing_item_code", "duplicate_record", "invalid_barcode"]) expect(codes).toContain(c);
    expect(parsed.issues.filter((i) => i.severity === "error")).toHaveLength(4);
    expect(parsed.issues.find((i) => i.code === "invalid_price")).toMatchObject({ record: 6, itemCode: "7299990000043" });
  });
  it("distinguishes barcodes from retailer-internal codes", () => {
    expect(parsed.records.find((r) => r.itemCode === "7001")).toMatchObject({ barcode: undefined, productKey: "i:shufersal:7001", isWeighted: true, unit: "kg", quantity: 1 });
    expect(parsed.records.find((r) => r.itemCode === "7299990000011")!.productKey).toBe("i:shufersal:7299990000011");
    expect(parsed.records.find((r) => r.itemCode === "012345678905")!.productKey).toBe("g:0012345678905");
  });
  it("keeps the price-change date separate and never invents missing values", () => {
    expect(parsed.records.find((r) => r.itemCode === "7299990000029")!.priceChangedAt).toBe("2026-10-20T04:30:00.000Z");
    expect(parsed.records.find((r) => r.itemCode === "012345678905")!.manufacturer).toBeUndefined(); // "לא ידוע"
    expect(parsed.records.find((r) => r.itemCode === "7299990000074")!.priceChangedAt).toBeUndefined();
  });
  it("rejects conflicting duplicates in the same file", () => {
    const p = extractPrices(parseXml(fixtureText("Price7290000000001-001-202610241100.xml")).doc, "shufersal");
    expect(p.records.map((r) => r.itemCode)).toEqual(["7299990000029"]);
    expect(p.issues.find((i) => i.code === "conflicting_record")?.severity).toBe("error");
  });
  it("handles lower-case and Products/Product variants", () => {
    const p = extractPrices(parseXml(fixtureText("PriceFull7290000000002-015-202610240200.xml")).doc, "rami-levy");
    expect(p.header.storeId).toBe("15");
    expect(p.records).toHaveLength(3);
    expect(p.records[1].productKey).toBe("g:0012345678905"); // same product as the UPC in the other chain's file
  });
});

describe("promotions and stores", () => {
  it("parses promotion dates, items and club restrictions", () => {
    const p = extractPromotions(parseXml(fixtureText("PromoFull7290000000001-001-202610240300.xml")).doc, "shufersal");
    expect(p.records.map((r) => r.promotionId)).toEqual(["1001", "1002", "1003", "1004"]);
    expect(p.records[0]).toMatchObject({ startsAt: "2026-10-19T21:00:00.000Z", minQty: 2, discountedPrice: 9, generalPublic: true, requiresCoupon: false });
    expect(p.records[0].items[0].productKey).toBe("g:7299990000012");
    expect(p.records[2].generalPublic).toBe(false);
    expect(p.records[3].startsAt).toBeUndefined();
    expect(p.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["promotion_dates_unverified", "promotion_without_items"]));
  });
  it("parses SAP-style upper-case store files and flags numeric city codes", () => {
    const s = extractStores(parseXml(fixtureText("Stores7290000000001-202610240000.xml")).doc);
    expect(s.records).toHaveLength(2);
    expect(s.records[0]).toMatchObject({ storeId: "1", name: "סניף בדיקה מרכז", city: "עיר בדיקה", cityIsCode: false });
    expect(s.records[1]).toMatchObject({ storeId: "2", cityIsCode: true });
    expect(s.issues[0].code).toBe("missing_store_id");
  });
});

describe("upload analysis", () => {
  const name = "PriceFull7290000000001-001-202610240300.xml";
  it("blocks files whose retailer cannot be established", () => {
    expect(analyzeUpload(name, fixture(name), opts).entries[0].blockers.join(" ")).toMatch(/יש לבחור רשת/);
  });
  it("uses the operator's retailer and the file-name publication time", () => {
    const e = analyzeUpload(name, fixture(name), { ...opts, retailerId: "shufersal" }).entries[0];
    expect(e).toMatchObject({ kind: "price_full", retailerId: "shufersal", storeId: "1", chainId: "7290000000001", publishedAt: "2026-10-24T00:00:00.000Z", publishedAtSource: "file_name", blockers: [] });
  });
  it("refuses a retailer that contradicts a previously confirmed chain code", () => {
    const e = analyzeUpload(name, fixture(name), { ...opts, retailerId: "victory", chainMap: { "7290000000001": "shufersal" } }).entries[0];
    expect(e.blockers.join(" ")).toMatch(/שויך בעבר/);
    expect(analyzeUpload(name, fixture(name), { ...opts, chainMap: { "7290000000001": "shufersal" } }).entries[0].retailerId).toBe("shufersal");
  });
  it("warns about stale files and blocks future-dated ones", () => {
    const stale = analyzeUpload(name, fixture(name), { ...opts, retailerId: "shufersal", now: NOW + 30 * DAY }).entries[0];
    expect(stale.issues.some((i) => i.code === "stale_file")).toBe(true);
    const future = analyzeUpload(name, fixture(name), { ...opts, retailerId: "shufersal", now: NOW - 5 * DAY }).entries[0];
    expect(future.blockers.join(" ")).toMatch(/בעתיד/);
  });
  it("falls back to the latest record timestamp, or requires an operator time", () => {
    const e = analyzeUpload("export.xml", fixture(name), { ...opts, retailerId: "shufersal" }).entries[0];
    expect(e).toMatchObject({ publishedAtSource: "latest_record_timestamp", publishedAt: "2026-10-23T03:00:00.000Z" });
    const noDates = strToU8("<Root><StoreId>1</StoreId><Items><Item><ItemCode>7299990000012</ItemCode><ItemName>x</ItemName><UnitQty>גרם</UnitQty><Quantity>1</Quantity><ItemPrice>1</ItemPrice></Item></Items></Root>");
    expect(analyzeUpload("export.xml", noDates, { ...opts, retailerId: "shufersal" }).entries[0].blockers.join(" ")).toMatch(/זמן פרסום/);
    expect(analyzeUpload("export.xml", noDates, { ...opts, retailerId: "shufersal", publishedAt: "2026-10-24T08:00:00.000Z" }).entries[0].publishedAtSource).toBe("operator");
  });
  it("blocks malformed XML and files without a branch", () => {
    expect(analyzeUpload(name, strToU8("<Root><Items><Item>"), { ...opts, retailerId: "shufersal" }).entries[0].blockers[0]).toMatch(/XML/);
    const noStore = strToU8("<Root><Items><Item><ItemCode>7299990000012</ItemCode><ItemName>x</ItemName><UnitQty>גרם</UnitQty><Quantity>1</Quantity><ItemPrice>1</ItemPrice><PriceUpdateDate>2026-10-24 08:00</PriceUpdateDate></Item></Items></Root>");
    expect(analyzeUpload("x.xml", noStore, { ...opts, retailerId: "shufersal" }).entries[0].blockers.join(" ")).toMatch(/StoreId/);
  });
});
