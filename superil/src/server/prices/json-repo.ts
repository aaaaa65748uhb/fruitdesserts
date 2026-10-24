import { promises as fs } from "fs";
import path from "path";
import { gunzipSync, gzipSync } from "fflate";
import type { Issue } from "../ingest/records";
import { priceConfig } from "./config";
import type {
  ArchivedUpload,
  BranchSnapshot,
  MappingDecision,
  FeedProduct,
  ImportBatch,
  OfferWithBranch,
  PriceRepository,
  PromoSnapshot,
  PromotionWithBranch,
  StoredBranch,
} from "./types";

/**
 * File-based price store (no database needed). Layout under PRICE_DATA_DIR (default data/imported):
 *   imports.json            import history (one row per imported file/entry)
 *   chain-ids.json          chain code → retailer, learned from confirmed imports
 *   products.json           product identities first seen in price files
 *   branches/<r>__<s>.json  current price snapshot per branch
 *   promos/<r>__<s>.json    current promotions per branch
 *   stores/<r>.json         branch details from Stores files
 *   issues/<importId>.json  validation issues of an import
 *   mappings.json           reviewed catalog ↔ identifier decisions
 *   uploads/<sha256>.gz     original uploaded files (+ uploads.json index)
 *   version                 bumped on every write (cache invalidation across processes)
 */
const safe = (s: string) => s.replace(/[^A-Za-z0-9-]/g, "_");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data));
  await fs.rename(tmp, file);
}

export class JsonPriceRepository implements PriceRepository {
  readonly kind = "json" as const;
  private index?: { version: string; offers: Map<string, OfferWithBranch[]>; promos: Map<string, PromotionWithBranch[]> };

  constructor(private readonly dir = priceConfig.dataDir) {}

  private p(...parts: string[]) {
    return path.join(this.dir, ...parts);
  }

  private async bump() {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.p("version"), `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    this.index = undefined;
  }

  async version() {
    try {
      return (await fs.readFile(this.p("version"), "utf8")).trim();
    } catch {
      return "empty";
    }
  }

  async listImports() {
    return readJson<ImportBatch[]>(this.p("imports.json"), []);
  }

  async findImport(fileHash: string, entryName: string) {
    return (await this.listImports()).find((b) => b.fileHash === fileHash && b.entryName === entryName);
  }

  async getChainMap() {
    return readJson<Record<string, string>>(this.p("chain-ids.json"), {});
  }

  async learnChain(chainId: string, retailerId: string) {
    const map = await this.getChainMap();
    if (map[chainId] === retailerId) return;
    map[chainId] = retailerId;
    await writeJson(this.p("chain-ids.json"), map);
  }

  async getFeedProducts() {
    return readJson<Record<string, FeedProduct>>(this.p("products.json"), {});
  }

  async getBranchSnapshot(retailerId: string, storeId: string) {
    return readJson<BranchSnapshot | undefined>(this.p("branches", `${safe(retailerId)}__${safe(storeId)}.json`), undefined);
  }

  async saveBranchSnapshot(s: BranchSnapshot, newProducts: FeedProduct[]) {
    await writeJson(this.p("branches", `${safe(s.retailerId)}__${safe(s.storeId)}.json`), s);
    if (newProducts.length) {
      const products = await this.getFeedProducts();
      for (const np of newProducts) products[np.productKey] ??= np;
      await writeJson(this.p("products.json"), products);
    }
    await this.bump();
  }

  async getPromoSnapshot(retailerId: string, storeId: string) {
    return readJson<PromoSnapshot | undefined>(this.p("promos", `${safe(retailerId)}__${safe(storeId)}.json`), undefined);
  }

  async savePromoSnapshot(s: PromoSnapshot) {
    await writeJson(this.p("promos", `${safe(s.retailerId)}__${safe(s.storeId)}.json`), s);
    await this.bump();
  }

  async saveStores(retailerId: string, stores: StoredBranch[]) {
    const existing = await this.getStores(retailerId);
    const byId = new Map(existing.map((s) => [s.storeId, s]));
    for (const s of stores) {
      const prev = byId.get(s.storeId);
      if (!prev || prev.publishedAt <= s.publishedAt) byId.set(s.storeId, s);
    }
    await writeJson(this.p("stores", `${safe(retailerId)}.json`), [...byId.values()]);
    await this.bump();
  }

  async getStores(retailerId?: string) {
    if (retailerId) return readJson<StoredBranch[]>(this.p("stores", `${safe(retailerId)}.json`), []);
    const files = await fs.readdir(this.p("stores")).catch(() => [] as string[]);
    const all = await Promise.all(files.filter((f) => f.endsWith(".json")).map((f) => readJson<StoredBranch[]>(this.p("stores", f), [])));
    return all.flat();
  }

  private async loadIndex() {
    const version = await this.version();
    if (this.index?.version === version) return this.index;
    const offers = new Map<string, OfferWithBranch[]>();
    const promos = new Map<string, PromotionWithBranch[]>();
    for (const f of await fs.readdir(this.p("branches")).catch(() => [] as string[])) {
      if (!f.endsWith(".json")) continue;
      const s = await readJson<BranchSnapshot | undefined>(this.p("branches", f), undefined);
      if (!s) continue;
      for (const o of Object.values(s.offers)) {
        const list = offers.get(o.productKey) ?? [];
        list.push({ ...o, retailerId: s.retailerId, storeId: s.storeId });
        offers.set(o.productKey, list);
      }
    }
    for (const f of await fs.readdir(this.p("promos")).catch(() => [] as string[])) {
      if (!f.endsWith(".json")) continue;
      const s = await readJson<PromoSnapshot | undefined>(this.p("promos", f), undefined);
      if (!s) continue;
      for (const pr of Object.values(s.promotions)) {
        for (const item of pr.items) {
          const list = promos.get(item.productKey) ?? [];
          list.push(pr);
          promos.set(item.productKey, list);
        }
      }
    }
    this.index = { version, offers, promos };
    return this.index;
  }

  async listPriceBranches() {
    const out: { retailerId: string; storeId: string; offers: number; lastFullPublishedAt?: string }[] = [];
    for (const f of await fs.readdir(this.p("branches")).catch(() => [] as string[])) {
      if (!f.endsWith(".json")) continue;
      const s = await readJson<BranchSnapshot | undefined>(this.p("branches", f), undefined);
      if (s) out.push({ retailerId: s.retailerId, storeId: s.storeId, offers: Object.keys(s.offers).length, lastFullPublishedAt: s.lastFullPublishedAt });
    }
    return out;
  }

  async offersByKeys(keys: string[]) {
    const { offers } = await this.loadIndex();
    return keys.flatMap((k) => offers.get(k) ?? []);
  }

  async promotionsByKeys(keys: string[]) {
    const { promos } = await this.loadIndex();
    return keys.flatMap((k) => promos.get(k) ?? []);
  }

  async recordImport(batch: ImportBatch, issues: Issue[]) {
    const list = await this.listImports();
    list.push(batch);
    await writeJson(this.p("imports.json"), list);
    await writeJson(this.p("issues", `${safe(batch.id)}.json`), issues);
    await this.bump();
  }

  async getImportIssues(importId: string) {
    return readJson<Issue[]>(this.p("issues", `${safe(importId)}.json`), []);
  }

  async getMappingDecisions() {
    return readJson<MappingDecision[]>(this.p("mappings.json"), []);
  }

  async saveMappingDecision(d: MappingDecision) {
    const list = (await this.getMappingDecisions()).filter((x) => !(x.productId === d.productId && x.key === d.key));
    list.push(d);
    await writeJson(this.p("mappings.json"), list);
    await this.bump();
  }

  async archiveUpload(meta: ArchivedUpload, bytes: Uint8Array) {
    const list = await this.listArchivedUploads();
    if (list.some((u) => u.fileHash === meta.fileHash)) return;
    await fs.mkdir(this.p("uploads"), { recursive: true });
    await fs.writeFile(this.p("uploads", `${safe(meta.fileHash)}.gz`), gzipSync(bytes));
    list.push(meta);
    await writeJson(this.p("uploads.json"), list);
  }

  async listArchivedUploads() {
    return readJson<ArchivedUpload[]>(this.p("uploads.json"), []);
  }

  async getArchivedUpload(fileHash: string) {
    try {
      return gunzipSync(new Uint8Array(await fs.readFile(this.p("uploads", `${safe(fileHash)}.gz`))));
    } catch {
      return undefined;
    }
  }

  async priceCountsByPublication() {
    const { offers } = await this.loadIndex();
    const counts = new Map<string, number>();
    for (const list of offers.values()) for (const o of list) counts.set(o.publishedAt, (counts.get(o.publishedAt) ?? 0) + 1);
    return [...counts].map(([publishedAt, count]) => ({ publishedAt, count }));
  }

  async ping() {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.access(this.dir, (await import("fs")).constants.W_OK);
  }
}
