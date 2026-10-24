/**
 * Node.js-only start-up work, loaded from instrumentation.ts when NEXT_RUNTIME === "nodejs".
 * Logs configuration problems once at server start – never the values of secrets.
 */
import { configChecks } from "./server/config-check";

for (const c of configChecks()) {
  if (c.level !== "ok") console.warn(`[superil] ${c.level.toUpperCase()} ${c.id}: ${c.detail}`);
}
