import { createHash } from "crypto";
import { RETAILER_BY_ID } from "@/data/retailers";
import { decodeUpload } from "./decode";
import { parseOfficialFileName, type FileKind } from "./filename";
import {
  detectKind,
  extractPrices,
  extractPromotions,
  extractStores,
  parseXml,
  type FileHeader,
  type Issue,
  type ParsedFile,
  type PriceRecord,
  type PromotionRecord,
  type StoreRecord,
} from "./records";

/** How the publication time of a file was established. */
export type PublishedAtSource = "file_name" | "latest_record_timestamp" | "operator";

export interface AnalyzeOptions {
  /** Retailer chosen by the operator. Required unless the file's ChainId is already known. */
  retailerId?: string;
  /** chainId → retailerId mappings confirmed in earlier imports. */
  chainMap: Record<string, string>;
  /** Operator-supplied publication time (ISO), only used when the file has none. */
  publishedAt?: string;
  now?: number;
  staleAfterMs: number;
}

export interface AnalyzedEntry {
  entryName: string;
  kind?: FileKind;
  encoding?: string;
  container?: string;
  retailerId?: string;
  chainId?: string;
  subChainId?: string;
  storeId?: string;
  publishedAt?: string;
  publishedAtSource?: PublishedAtSource;
  totalRecords: number;
  validRecords: number;
  issues: Issue[];
  /** Fatal problems: the entry cannot be imported. */
  blockers: string[];
  prices?: PriceRecord[];
  promotions?: PromotionRecord[];
  stores?: StoreRecord[];
}

export interface AnalyzeResult {
  uploadName: string;
  fileHash: string;
  sizeBytes: number;
  entries: AnalyzedEntry[];
  errors: string[];
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function analyzeUpload(uploadName: string, bytes: Uint8Array, opts: AnalyzeOptions): AnalyzeResult {
  const now = opts.now ?? Date.now();
  const decoded = decodeUpload(uploadName, bytes);
  const entries: AnalyzedEntry[] = decoded.entries.map((entry) => {
    const out: AnalyzedEntry = { entryName: entry.name, encoding: entry.encoding, container: entry.container, totalRecords: 0, validRecords: 0, issues: [], blockers: [] };
    const { doc, error } = parseXml(entry.text);
    if (error || !doc) {
      out.blockers.push(`XML לא תקין: ${error ?? "empty"}`);
      return out;
    }
    const fromName = parseOfficialFileName(entry.name);
    const detected = detectKind(doc);
    const kind: FileKind | undefined = fromName.kind
      ? // Filename says "Price"/"Promo" (updates) vs "...Full"; trust it when the content agrees on the family.
        fromName.kind.startsWith("price") && detected === "price_full"
        ? fromName.kind
        : fromName.kind.startsWith("promo") && detected === "promo_full"
          ? fromName.kind
          : fromName.kind === "stores" && detected === "stores"
            ? "stores"
            : detected
      : detected;
    out.kind = kind;
    if (!kind) {
      out.blockers.push("לא זוהה סוג קובץ (מחירים / מבצעים / סניפים) – אין רשומות מוכרות בקובץ");
      return out;
    }
    if (fromName.kind && detected && fromName.kind.slice(0, 4) !== detected.slice(0, 4)) {
      out.issues.push({ severity: "warning", code: "kind_mismatch", message: `שם הקובץ מציין ${fromName.kind} אך התוכן נראה כ-${detected}; נעשה שימוש בתוכן` });
    }

    // Retailer resolution: operator choice, checked against the file's chain code.
    let header: FileHeader = {};
    let parsed: ParsedFile<PriceRecord> | ParsedFile<PromotionRecord> | ParsedFile<StoreRecord>;
    const retailerForKeys = opts.retailerId ?? (fromName.chainId ? opts.chainMap[fromName.chainId] : undefined) ?? "unknown";
    if (kind === "stores") parsed = extractStores(doc);
    else if (kind.startsWith("promo")) parsed = extractPromotions(doc, retailerForKeys);
    else parsed = extractPrices(doc, retailerForKeys);
    header = parsed.header;
    out.totalRecords = parsed.totalRecords;
    out.validRecords = parsed.records.length;
    out.issues.push(...parsed.issues);

    const chainId = header.chainId ?? fromName.chainId;
    if (header.chainId && fromName.chainId && header.chainId !== fromName.chainId) {
      out.blockers.push(`קוד הרשת בשם הקובץ (${fromName.chainId}) שונה מהקוד בתוך הקובץ (${header.chainId})`);
    }
    out.chainId = chainId;
    out.subChainId = header.subChainId;
    const mapped = chainId ? opts.chainMap[chainId] : undefined;
    if (opts.retailerId && !RETAILER_BY_ID[opts.retailerId]) out.blockers.push(`רשת לא מוכרת: ${opts.retailerId}`);
    if (opts.retailerId && mapped && mapped !== opts.retailerId) {
      out.blockers.push(`קוד הרשת ${chainId} שויך בעבר ל"${RETAILER_BY_ID[mapped]?.nameHe ?? mapped}" ולא ל"${RETAILER_BY_ID[opts.retailerId]?.nameHe ?? opts.retailerId}"`);
    }
    out.retailerId = opts.retailerId ?? mapped;
    if (!out.retailerId) out.blockers.push(chainId ? `קוד הרשת ${chainId} אינו משויך לרשת – יש לבחור רשת ידנית` : "לא נמצא קוד רשת – יש לבחור רשת ידנית");

    if (kind !== "stores") {
      out.storeId = header.storeId ?? fromName.storeId;
      if (!out.storeId) out.blockers.push("לא נמצא מספר סניף (StoreId) – מחירים מתפרסמים לפי סניף ולא ניתן לייחס אותם");
      if (header.storeId && fromName.storeId && header.storeId !== fromName.storeId && fromName.groups.length === 1) {
        out.issues.push({ severity: "warning", code: "store_mismatch", message: `מספר הסניף בשם הקובץ (${fromName.storeId}) שונה מהקובץ (${header.storeId}); נעשה שימוש בערך שבקובץ` });
      }
    }

    // Publication time: filename timestamp, else latest record timestamp (a conservative lower bound), else operator.
    if (fromName.publishedAt) {
      out.publishedAt = fromName.publishedAt;
      out.publishedAtSource = "file_name";
    } else if (parsed.latestInnerTimestamp) {
      out.publishedAt = parsed.latestInnerTimestamp;
      out.publishedAtSource = "latest_record_timestamp";
      out.issues.push({ severity: "warning", code: "published_at_inferred", message: "אין חותמת זמן בשם הקובץ; זמן הפרסום נקבע לפי העדכון האחרון בתוך הקובץ (הערכה שמרנית)" });
    } else if (opts.publishedAt) {
      out.publishedAt = opts.publishedAt;
      out.publishedAtSource = "operator";
    } else {
      out.blockers.push("לא ניתן לקבוע את זמן פרסום הקובץ – יש לציין אותו ידנית (published-at)");
    }
    if (out.publishedAt) {
      const t = Date.parse(out.publishedAt);
      if (t > now + 60 * 60 * 1000) out.blockers.push(`זמן הפרסום (${out.publishedAt}) נמצא בעתיד`);
      else if (now - t > opts.staleAfterMs) {
        out.issues.push({ severity: "warning", code: "stale_file", message: `הקובץ פורסם לפני ${Math.round((now - t) / 86_400_000)} ימים – המחירים יסומנו "לא עדכניים"` });
      }
    }
    if (!parsed.records.length) out.blockers.push("לא נמצאו רשומות תקינות לייבוא");

    if (kind === "stores") out.stores = parsed.records as StoreRecord[];
    else if (kind.startsWith("promo")) out.promotions = parsed.records as PromotionRecord[];
    else out.prices = parsed.records as PriceRecord[];
    if (retailerForKeys === "unknown" && out.retailerId && kind !== "stores") {
      // Internal-code keys were built before the retailer was known; rebuild them now that it is.
      const fix = (k: string) => (k.startsWith("i:unknown:") ? `i:${out.retailerId}:${k.slice("i:unknown:".length)}` : k);
      out.prices?.forEach((r) => (r.productKey = fix(r.productKey)));
      out.promotions?.forEach((p) => p.items.forEach((i) => (i.productKey = fix(i.productKey))));
    }
    return out;
  });
  return { uploadName, fileHash: sha256(bytes), sizeBytes: bytes.length, entries, errors: decoded.errors };
}
