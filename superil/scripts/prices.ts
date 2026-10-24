/**
 * Admin command-line workflow for official price-transparency files.
 *
 *   npm run prices -- preview  <file> [--retailer <id>] [--published-at <ISO>] [--json]
 *   npm run prices -- import   <file...> [--retailer <id>] [--published-at <ISO>] [--force] [--json]
 *   npm run prices -- imports                         list import history
 *   npm run prices -- report   [--json]               matched / unmatched / duplicates / conflicts
 *   npm run prices -- map      <productId> <GTIN | i:<retailer>:<code>>
 *   npm run prices -- unmap    <productId>
 *
 * Files are read from disk only. This tool never downloads anything.
 * With DATABASE_URL set, data goes to PostgreSQL; otherwise to PRICE_DATA_DIR (default data/imported).
 */
import { promises as fs } from "fs";
import path from "path";
import { RETAILERS } from "../src/data/retailers";
import { commitUpload, getPriceRepository, matchingOverview, previewUpload, setCatalogMapping, type UploadReport } from "../src/server/prices/service";

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string) => args.includes(`--${name}`);
const positional = args.slice(1).filter((a, i, all) => !a.startsWith("--") && !(i > 0 && ["--retailer", "--published-at"].includes(all[i - 1])));

function printReport(r: UploadReport) {
  console.log(`\n${r.mode === "preview" ? "PREVIEW (nothing written)" : "IMPORT"} – ${r.uploadName} (${(r.sizeBytes / 1024).toFixed(0)} KB, sha256 ${r.fileHash.slice(0, 12)}…, store: ${r.repository})`);
  for (const e of r.errors) console.log(`  ✖ ${e}`);
  for (const e of r.entries) {
    console.log(`\n  ▸ ${e.entryName}  [${e.kind ?? "?"}, ${e.container ?? ""}, ${e.encoding ?? ""}]  status: ${e.status.toUpperCase()}`);
    console.log(`    retailer: ${e.retailerName ?? e.retailerId ?? "—"}  chain: ${e.chainId ?? "—"}  store: ${e.storeId ?? "—"}${e.branchName ? ` (${e.branchName})` : ""}`);
    console.log(`    published: ${e.publishedAt ?? "—"} (${e.publishedAtSource ?? "—"})`);
    console.log(`    records: ${e.counts.total}  valid: ${e.counts.valid}  errors: ${e.counts.errors}  warnings: ${e.counts.warnings}`);
    for (const [code, n] of Object.entries(e.issueCounts)) console.log(`      · ${code}: ${n}`);
    for (const b of e.blockers) console.log(`    ✖ ${b}`);
    if (e.alreadyImported) console.log(`    ℹ already imported as ${e.alreadyImported.id} at ${e.alreadyImported.importedAt}${has("force") ? " (re-applying because of --force)" : " (use --force to re-apply; it is idempotent)"}`);
    if (e.matching) {
      const m = e.matching;
      console.log(`    matching: catalog ${m.matchedToCatalog}, known products ${m.knownFeedProducts}, new ${m.newProducts}, internal codes ${m.internalCodes}, size conflicts ${m.sizeConflicts.length}, suggestions ${m.suggestions.length}`);
    }
    if (e.applied) console.log(`    applied: written ${e.applied.written}, unchanged ${e.applied.unchanged}, skipped (older than stored) ${e.applied.skippedOlder}, removed ${e.applied.removed}`);
    for (const i of e.issues.slice(0, 15)) console.log(`      ${i.severity === "error" ? "✖" : "!"} #${i.record ?? "-"} ${i.itemCode ?? ""} ${i.message}`);
    if (e.issues.length > 15 || e.issuesTruncated) console.log(`      … more issues in the JSON report (--json)`);
  }
}

async function main() {
  const opts = { retailerId: flag("retailer"), publishedAt: flag("published-at"), force: has("force"), importedBy: "cli" as const };
  if (opts.retailerId && !RETAILERS.some((r) => r.id === opts.retailerId)) throw new Error(`Unknown retailer. Use one of: ${RETAILERS.map((r) => r.id).join(", ")}`);
  switch (cmd) {
    case "preview":
    case "import": {
      if (!positional.length) throw new Error(`Usage: npm run prices -- ${cmd} <file> [--retailer <id>]`);
      let failed = false;
      for (const file of positional) {
        const bytes = new Uint8Array(await fs.readFile(file));
        const name = path.basename(file);
        const report = cmd === "preview" ? await previewUpload(name, bytes, opts) : await commitUpload(name, bytes, opts);
        if (has("json")) console.log(JSON.stringify(report, null, 2));
        else printReport(report);
        if (report.errors.length || report.entries.some((e) => e.status === "blocked")) failed = true;
      }
      process.exitCode = failed ? 2 : 0;
      break;
    }
    case "imports": {
      const repo = await getPriceRepository();
      for (const b of await repo.listImports()) {
        console.log(`${b.importedAt}  ${b.retailerId.padEnd(13)} store ${String(b.storeId ?? "-").padEnd(5)} ${b.kind.padEnd(10)} published ${b.publishedAt}  ${b.entryName}  written=${b.applied.written} skippedOlder=${b.applied.skippedOlder}`);
      }
      break;
    }
    case "report": {
      const o = await matchingOverview();
      if (has("json")) return console.log(JSON.stringify(o, null, 2));
      console.log(`Imports: ${o.imports} · branches with prices: ${o.branches.length} · store: ${o.repository}`);
      console.log(`Matched catalog products: ${o.matched.length}`);
      for (const m of o.matched) console.log(`  ✓ ${m.productName}  ${Object.entries(m.offersByRetailer).map(([r, n]) => `${r}:${n}`).join(" ")}`);
      console.log(`Mapped but no offers: ${o.mappedWithoutOffers.length}`);
      console.log(`Unmatched catalog products: ${o.unmatchedCatalog.length}`);
      console.log(`Unmatched price-file products (kept for review): ${o.unmatchedRecords.total}`);
      console.log(`Duplicates: ${o.duplicates.reduce((n, d) => n + d.count, 0)} · price conflicts: ${o.conflicts.priceConflicts.reduce((n, d) => n + d.count, 0)} · size conflicts: ${o.conflicts.sizeConflicts.length}`);
      for (const c of o.conflicts.sizeConflicts.slice(0, 20)) console.log(`  ✖ ${c.productName}: expected ${c.expected}, found ${c.found} (${c.productKey})`);
      console.log(`Suggestions to review (never applied automatically): ${o.suggestions.length}`);
      for (const s of o.suggestions.slice(0, 20)) console.log(`  ? ${s.productId} ⇄ ${s.recordName} (${s.productKey}) score ${s.score.toFixed(2)} → npm run prices -- map ${s.productId} ${s.productKey}`);
      if (o.invalidMapEntries.length) console.log(`Invalid entries in data/barcode-map.json: ${o.invalidMapEntries.join("; ")}`);
      break;
    }
    case "map":
    case "unmap": {
      const [productId, identifier] = positional;
      if (!productId || (cmd === "map" && !identifier)) throw new Error("Usage: npm run prices -- map <productId> <identifier>");
      const res = await setCatalogMapping(productId, cmd === "map" ? identifier : null);
      console.log(res.ok ? `✓ ${res.message}` : `✖ ${res.message}`);
      process.exitCode = res.ok ? 0 : 2;
      break;
    }
    default:
      console.log("Commands: preview | import | imports | report | map | unmap   (see scripts/prices.ts header)");
  }
}

main()
  .catch((e) => {
    console.error(`✖ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) {
      const { prisma } = await import("../src/server/providers/prisma-store");
      await prisma().$disconnect();
    }
  });
