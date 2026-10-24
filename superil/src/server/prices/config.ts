import path from "path";

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
