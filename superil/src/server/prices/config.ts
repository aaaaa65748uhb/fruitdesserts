import path from "path";

export type StorageMode = "postgres" | "file" | "file-unsafe";

/**
 * Where official data is stored:
 * - "postgres":    DATABASE_URL is set (recommended for production).
 * - "file":        JSON files in PRICE_DATA_DIR (development, or production with an explicit persistent volume).
 * - "file-unsafe": production without DATABASE_URL and without an explicit PRICE_DATA_DIR. Imports are refused,
 *                  because the default folder is usually wiped on redeploy.
 */
export function storageMode(): StorageMode {
  if (process.env.DATABASE_URL) return "postgres";
  if (process.env.NODE_ENV === "production" && !process.env.PRICE_DATA_DIR) return "file-unsafe";
  return "file";
}

/** Runtime configuration for official price data (see docs/INTEGRATIONS.md). */
export const priceConfig = {
  /** Where the JSON price store lives when DATABASE_URL is not set. */
  get dataDir() {
    return process.env.PRICE_DATA_DIR ? path.resolve(process.env.PRICE_DATA_DIR) : path.join(process.cwd(), "data", "imported");
  },
  get barcodeMapFile() {
    return process.env.BARCODE_MAP_FILE ? path.resolve(process.env.BARCODE_MAP_FILE) : path.join(process.cwd(), "data", "barcode-map.json");
  },
  /** A file published within this window is shown as "מחיר מאומת". */
  get verifiedMaxAgeMs() {
    return Number(process.env.PRICE_VERIFIED_MAX_AGE_HOURS ?? 36) * 3600_000;
  },
  /** After this, prices are "מחיר לא עדכני" and excluded from totals. */
  get staleAfterMs() {
    return Number(process.env.PRICE_STALE_AFTER_DAYS ?? 7) * 86_400_000;
  },
  /** "auto": sample prices only while no official prices are imported; "on"/"off" force it. */
  get samplePrices(): "auto" | "on" | "off" {
    const v = process.env.SAMPLE_PRICES;
    return v === "on" || v === "off" ? v : "auto";
  },
  get maxUploadBytes() {
    return Number(process.env.ADMIN_MAX_UPLOAD_MB ?? 100) * 1024 * 1024;
  },
};
