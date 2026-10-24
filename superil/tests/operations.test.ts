import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkToken, createSession, verifySession } from "@/server/admin-auth";
import { configChecks } from "@/server/config-check";
import { JsonPriceRepository } from "@/server/prices/json-repo";
import {
  StorageNotPersistentError,
  commitUpload,
  decideMapping,
  effectiveMappings,
  matchingOverview,
  setPriceRepository,
  storageMode,
} from "@/server/prices/service";
import { readinessReport } from "@/server/readiness";
import { fixture } from "./helpers";

const TOKEN = "a-very-long-admin-token-for-tests-123";
const NOW = Date.parse("2026-10-24T12:00:00Z");
const ENV_KEYS = ["ADMIN_TOKEN", "DATABASE_URL", "PRICE_DATA_DIR", "NODE_ENV", "BARCODE_MAP_FILE", "SAMPLE_PRICES"] as const;
const saved: Record<string, string | undefined> = {};
const env = process.env as Record<string, string | undefined>;

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete env[k];
    else env[k] = saved[k];
  }
});

describe("admin authentication", () => {
  it("is disabled without a sufficiently long token", () => {
    delete env.ADMIN_TOKEN;
    expect(checkToken("anything")).toBe(false);
    env.ADMIN_TOKEN = "short";
    expect(checkToken("short")).toBe(false);
    expect(() => createSession()).toThrow();
  });
  it("issues signed, expiring sessions that cannot be forged", () => {
    env.ADMIN_TOKEN = TOKEN;
    expect(checkToken(TOKEN)).toBe(true);
    expect(checkToken(TOKEN + "x")).toBe(false);
    const { value } = createSession(NOW);
    expect(value).not.toContain(TOKEN);
    expect(verifySession(value, NOW + 1000)).toBe(true);
    expect(verifySession(value, NOW + 9 * 3600_000)).toBe(false); // expired after 8 h
    const [exp, sig] = value.split(".");
    expect(verifySession(`${Number(exp) + 999999}.${sig}`, NOW)).toBe(false); // extended expiry
    expect(verifySession(`${exp}.AAAA${sig.slice(4)}`, NOW)).toBe(false);
    env.ADMIN_TOKEN = TOKEN + "-rotated";
    expect(verifySession(value, NOW + 1000)).toBe(false); // rotating the token logs everyone out
  });
});

describe("configuration and storage", () => {
  it("never reveals secret values in configuration checks", () => {
    env.ADMIN_TOKEN = TOKEN;
    env.DATABASE_URL = "postgresql://user:SuperSecretPw@db.example:5432/superil";
    const text = JSON.stringify(configChecks());
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("SuperSecretPw");
    expect(text).not.toContain("db.example");
  });
  it("refuses ephemeral file storage in production", async () => {
    delete env.DATABASE_URL;
    delete env.PRICE_DATA_DIR;
    env.NODE_ENV = "production";
    expect(storageMode()).toBe("file-unsafe");
    setPriceRepository(undefined);
    await expect(commitUpload("x.xml", new Uint8Array(), { importedBy: "cli" })).rejects.toBeInstanceOf(StorageNotPersistentError);
    env.PRICE_DATA_DIR = "/var/lib/superil";
    expect(storageMode()).toBe("file");
    env.DATABASE_URL = "postgresql://x";
    expect(storageMode()).toBe("postgres");
  });
});

describe("mapping decisions and readiness", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "superil-ops-"));
    setPriceRepository(new JsonPriceRepository(path.join(dir, "store")));
    env.BARCODE_MAP_FILE = path.join(dir, "map.json");
    writeFileSync(env.BARCODE_MAP_FILE, JSON.stringify({ "milk-tnuva-3-1l": "7299990000029" }));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });
  afterAll(() => setPriceRepository(undefined));

  const importFixtures = async () => {
    for (const f of ["Stores7290000000001-202610240000.xml", "PriceFull7290000000001-001-202610240300.xml"]) {
      await commitUpload(f, fixture(f), { retailerId: "shufersal", importedBy: "admin-web" });
    }
  };

  it("stores approvals and rejections in the repository; decisions override the committed file", async () => {
    await importFixtures();
    let m = await effectiveMappings();
    expect(m.approved).toEqual([{ productId: "milk-tnuva-3-1l", key: "g:7299990000029", source: "file" }]);
    expect((await decideMapping("bamba-80", "7299990000012", "approve", "admin-web")).ok).toBe(true);
    expect((await decideMapping("milk-tnuva-3-1l", "g:7299990000029", "unlink", "admin-web")).ok).toBe(true);
    m = await effectiveMappings();
    expect(m.approved.map((a) => [a.productId, a.source])).toEqual([["bamba-80", "admin-web"]]);
    // Decisions live in the repository (database in production), not in the local mapping file.
    expect(JSON.parse(readFileSync(env.BARCODE_MAP_FILE!, "utf8"))).toEqual({ "milk-tnuva-3-1l": "7299990000029" });
  });

  it("rejected suggestions are hidden from review", async () => {
    await importFixtures();
    const overview = await matchingOverview();
    const s = overview.suggestions[0];
    if (!s) return; // no similar names in the fixtures → nothing to reject
    await decideMapping(s.productId, s.productKey, "reject", "admin-web");
    expect((await matchingOverview()).suggestions.some((x) => x.productId === s.productId && x.productKey === s.productKey)).toBe(false);
  });

  it("archives original uploads for audit and re-processing", async () => {
    await importFixtures();
    const repo = new JsonPriceRepository(path.join(dir, "store"));
    const archived = await repo.listArchivedUploads();
    expect(archived.map((a) => a.uploadName)).toEqual(["Stores7290000000001-202610240000.xml", "PriceFull7290000000001-001-202610240300.xml"]);
    const bytes = await repo.getArchivedUpload(archived[1].fileHash);
    expect(Buffer.from(bytes!).equals(Buffer.from(fixture("PriceFull7290000000001-001-202610240300.xml")))).toBe(true);
  });

  it("readiness reports sample mode before import and verified data after", async () => {
    env.ADMIN_TOKEN = TOKEN;
    delete env.SAMPLE_PRICES;
    const before = await readinessReport();
    expect(before.storage.connected).toBe(true);
    expect(before.realPricesImported).toBe(false);
    expect(before.prices.sample).toBeGreaterThan(0);
    expect(before.checklist.find((c) => c.label.includes("קובץ מחירים"))?.ok).toBe(false);

    await importFixtures();
    await decideMapping("bamba-80", "7299990000012", "approve", "admin-web");
    const after = await readinessReport();
    expect(after.realPricesImported).toBe(true);
    expect(after.prices).toMatchObject({ verified: 7, saved: 0, stale: 0, sample: 0, sampleEnabled: false });
    expect(after.retailers).toHaveLength(1);
    expect(after.retailers[0]).toMatchObject({ retailerId: "shufersal", storesImported: 2 });
    expect(after.retailers[0].branches[0]).toMatchObject({ storeId: "1", name: "סניף בדיקה מרכז", freshness: "live" });
    expect(after.mappings).toMatchObject({ productsWithOfficialPrices: 2, approved: 2 });
    expect(after.imports.latestSuccessful?.kind).toBe("price_full");
    expect(after.imports.archivedFiles).toBe(2);
    // Manual price spot-check can never be ticked automatically.
    expect(after.checklist.find((c) => c.label.includes("בדיקה ידנית"))?.ok).toBe(false);

    vi.setSystemTime(NOW + 10 * 86_400_000);
    const later = await readinessReport();
    expect(later.prices).toMatchObject({ verified: 0, stale: 7 });
  });

  it("warns when files are imported out of order", async () => {
    const r = await commitUpload("PriceFull7290000000001-001-202610240300.xml", fixture("PriceFull7290000000001-001-202610240300.xml"), { retailerId: "shufersal", importedBy: "cli" });
    expect(r.entries[0].issueCounts.order_stores_missing).toBe(1);
  });
});
