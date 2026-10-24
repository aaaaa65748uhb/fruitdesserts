#!/usr/bin/env node
/**
 * Builds a STATIC DEMO of SUPERIL into ./netlify-drop – a plain folder of HTML/CSS/JS that can be dragged onto
 * https://app.netlify.com/drop (or any static host).
 *
 *   npm run build:static
 *
 * What the static demo contains: the 3D store, catalog, search, product pages, cart, comparison and the
 * checkout handoff – all running in the browser with the built-in catalog and SAMPLE prices ("נתון לדוגמה").
 * What it does NOT contain: the admin area, price imports, official prices, the database. Those need the server
 * deployment (docs/DEPLOYMENT.md).
 *
 * The real source tree is never modified: the build runs on a temporary copy in the system temp folder.
 */
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The temporary copy must live outside the project (a folder cannot be copied into itself).
const work = fs.mkdtempSync(path.join(os.tmpdir(), "superil-static-"));
const outDir = path.join(root, "netlify-drop");
const SKIP = new Set(["node_modules", ".next", "out", ".static-build", "netlify-drop", "screenshots", ".git"]);

const step = (msg) => console.log(`\n▸ ${msg}`);
const rel = (...p) => path.join(work, ...p);
function edit(file, fn) {
  const f = rel(file);
  fs.writeFileSync(f, fn(fs.readFileSync(f, "utf8")));
}

step("Preparing a temporary copy of the project");
fs.cpSync(root, work, {
  recursive: true,
  filter: (src) => {
    const r = path.relative(root, src);
    if (!r) return true;
    const top = r.split(path.sep)[0];
    if (SKIP.has(top)) return false;
    if (r.startsWith(path.join("data", "imported") + path.sep)) return false; // never ship local price data
    if (/^\.env(\.|$)/.test(path.basename(src)) && path.basename(src) !== ".env.example") return false; // never ship secrets
    return true;
  },
});
fs.symlinkSync(path.join(root, "node_modules"), rel("node_modules"), process.platform === "win32" ? "junction" : "dir");

step("Removing server-only parts (API, admin, start-up checks)");
for (const p of ["src/app/api", "src/app/admin", "src/instrumentation.ts", "src/instrumentation-node.ts"]) fs.rmSync(rel(p), { recursive: true, force: true });

step("Making server-rendered pages static");
edit("src/app/data-sources/page.tsx", (s) => s.replace('export const dynamic = "force-dynamic";', 'export const dynamic = "force-static";'));
edit("src/app/page.tsx", (s) => s.replace("export const revalidate = 60;", "export const dynamic = \"force-static\";"));
edit("src/app/product/[id]/page.tsx", (s) =>
  s.replace(
    "type Props = { params: Promise<{ id: string }> };",
    `type Props = { params: Promise<{ id: string }> };

// Static demo: pre-render every catalog product.
export const dynamicParams = false;
export async function generateStaticParams() {
  const { SEED_PRODUCTS } = await import("@/data/seed-products");
  return SEED_PRODUCTS.map((p) => ({ id: p.id }));
}`,
  ),
);

step("Static export configuration");
fs.writeFileSync(
  rel("next.config.ts"),
  `import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
`,
);
// Security headers for Netlify (next.config headers() is not available in a static export).
fs.writeFileSync(
  rel("public", "_headers"),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=(self)
`,
);

step("Building (this takes about a minute)");
const emptyData = fs.mkdtempSync(path.join(os.tmpdir(), "superil-static-data-"));
const env = { ...process.env, NEXT_PUBLIC_STATIC_DEMO: "1", NEXT_TELEMETRY_DISABLED: "1", PRICE_DATA_DIR: emptyData, SAMPLE_PRICES: "auto" };
delete env.DATABASE_URL; // the demo never talks to a database
delete env.ADMIN_TOKEN;
const res = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "build"], { cwd: work, env, stdio: "inherit", shell: process.platform === "win32" });
if (res.status !== 0) {
  console.error("\n✖ Static build failed – see the output above.");
  process.exit(res.status ?? 1);
}

step(`Copying the result to ${path.relative(root, outDir)}/`);
fs.rmSync(outDir, { recursive: true, force: true });
fs.cpSync(rel("out"), outDir, { recursive: true });
fs.rmSync(work, { recursive: true, force: true });
fs.rmSync(emptyData, { recursive: true, force: true });

let files = 0;
let bytes = 0;
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else {
      files++;
      bytes += fs.statSync(f).size;
    }
  }
};
walk(outDir);
console.log(`\n✓ Static demo ready: ${outDir}  (${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB)`);
console.log("  Drag this folder onto https://app.netlify.com/drop");
console.log("  Note: sample prices only; no admin area or price imports (they need the server version).");
