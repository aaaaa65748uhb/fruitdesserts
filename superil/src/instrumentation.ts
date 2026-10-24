/** Logs configuration problems once at server start (never the values of secrets). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { configChecks } = await import("./server/config-check");
  for (const c of configChecks()) {
    if (c.level !== "ok") console.warn(`[superil] ${c.level.toUpperCase()} ${c.id}: ${c.detail}`);
  }
}
