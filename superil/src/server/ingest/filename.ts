/**
 * Official file names follow the regulation's pattern: a type prefix, the chain's 13-digit code, optional
 * sub-chain/store numbers, and a publication timestamp, e.g.
 *   PriceFull7290000000000-001-202610240300.gz
 *   PromoFull7290000000000-001-002-202610240300.xml
 *   Stores7290000000000-202610240000.xml
 * Chains differ in the exact grouping, so filename values are only used as a fallback to the XML header.
 */
export type FileKind = "price_full" | "price" | "promo_full" | "promo" | "stores";

export interface ParsedFileName {
  kind?: FileKind;
  chainId?: string;
  /** Numeric groups between the chain code and the timestamp (store, or sub-chain + store). */
  groups: string[];
  storeId?: string;
  publishedAt?: string;
}

const PREFIXES: [RegExp, FileKind][] = [
  [/^pricefull/i, "price_full"],
  [/^price/i, "price"],
  [/^promofull/i, "promo_full"],
  [/^promo/i, "promo"],
  [/^stores/i, "stores"],
];

/** Converts an Israel-local wall-clock time to an ISO UTC string. */
export function israelLocalToIso(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): string | undefined {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return undefined;
  const naive = Date.UTC(y, mo - 1, d, h, mi, s);
  // Find the offset in effect at that local time (iterate once to settle DST edges).
  let guess = naive;
  for (let i = 0; i < 2; i++) {
    const tz = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", timeZoneName: "shortOffset" })
      .formatToParts(new Date(guess))
      .find((p) => p.type === "timeZoneName")?.value;
    const m = tz?.match(/GMT([+-]\d+)(?::(\d+))?/);
    const offsetMin = m ? Number(m[1]) * 60 + Math.sign(Number(m[1])) * Number(m[2] ?? 0) : 120;
    guess = naive - offsetMin * 60_000;
  }
  return new Date(guess).toISOString();
}

export function parseOfficialFileName(fileName: string): ParsedFileName {
  const base = (fileName.split(/[\\/]/).pop() ?? fileName).replace(/\.(gz|zip|xml)$/gi, "").replace(/\.(gz|zip|xml)$/gi, "");
  const out: ParsedFileName = { groups: [] };
  const prefix = PREFIXES.find(([re]) => re.test(base));
  if (!prefix) return out;
  out.kind = prefix[1];
  const rest = base.replace(/^[a-z]+/i, "");
  const parts = rest.split(/[-_]/).filter(Boolean);
  if (parts[0] && /^\d{13}$/.test(parts[0])) out.chainId = parts.shift();
  // Timestamp: last group of 12 (YYYYMMDDHHmm) or 14 digits, or YYYYMMDD + HHmm[ss] in two groups.
  let ts: string | undefined;
  const last = parts[parts.length - 1];
  const prev = parts[parts.length - 2];
  if (last && /^\d{12}$|^\d{14}$/.test(last)) ts = parts.pop();
  else if (last && prev && /^\d{8}$/.test(prev) && /^\d{4}$|^\d{6}$/.test(last)) {
    ts = prev + parts.pop();
    parts.pop();
  }
  if (ts) {
    const n = (a: number, b: number) => Number(ts!.slice(a, b));
    out.publishedAt = israelLocalToIso(n(0, 4), n(4, 6), n(6, 8), n(8, 10), n(10, 12), ts.length >= 14 ? n(12, 14) : 0);
  }
  out.groups = parts.filter((p) => /^\d{1,4}$/.test(p));
  if (out.kind !== "stores" && out.groups.length) out.storeId = normalizeStoreId(out.groups[out.groups.length - 1]);
  return out;
}

/** Store ids appear as "1", "001" or "0001" across files; compare them without leading zeros. */
export function normalizeStoreId(id: string): string {
  const t = id.trim();
  return /^\d+$/.test(t) ? String(Number(t)) : t;
}
