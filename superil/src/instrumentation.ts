/**
 * Next.js instrumentation hook. Next compiles this file for both the Node.js and the Edge runtime, so
 * Node-only code is loaded through a dynamic import *inside* the runtime check: NEXT_RUNTIME is inlined at
 * build time, which lets the bundler drop the import entirely from the Edge build. (An early `return` before
 * the import is not enough – the Edge build would still try to resolve Node modules such as `crypto`.)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
