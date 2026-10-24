import { readFileSync } from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const src = (f: string) => readFileSync(path.join(__dirname, "..", "src", f), "utf8");
const env = process.env as Record<string, string | undefined>;
const saved = { NEXT_RUNTIME: env.NEXT_RUNTIME, ADMIN_TOKEN: env.ADMIN_TOKEN };

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
});

describe("instrumentation", () => {
  it("keeps the Node-only import inside the NEXT_RUNTIME === 'nodejs' branch (no early return)", () => {
    const code = src("instrumentation.ts");
    expect(code).toMatch(/if \(process\.env\.NEXT_RUNTIME === "nodejs"\) \{\s*await import\("\.\/instrumentation-node"\);\s*\}/);
    expect(code).not.toMatch(/NEXT_RUNTIME !== "nodejs"\) return/);
  });

  it("start-up checks do not depend on crypto/session code or the storage layer", () => {
    const code = src("server/config-check.ts");
    expect(code).not.toMatch(/from "\.\/admin-auth"/);
    expect(code).not.toMatch(/from "\.\/prices\/service"/);
    const imports = src("server/admin-config.ts").match(/^import .*$/gm) ?? [];
    expect(imports.join("\n")).not.toMatch(/crypto|next\/headers|next\/server/);
  });

  it("does nothing outside the Node.js runtime", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    env.NEXT_RUNTIME = "edge";
    delete env.ADMIN_TOKEN;
    const { register } = await import("@/instrumentation");
    await register();
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs configuration problems in the Node.js runtime without revealing secrets", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    env.NEXT_RUNTIME = "nodejs";
    env.ADMIN_TOKEN = "short-secret-value";
    const { register } = await import("@/instrumentation");
    await register();
    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes("ERROR ADMIN_TOKEN"))).toBe(true);
    expect(lines.join("\n")).not.toContain("short-secret-value");
  });
});
