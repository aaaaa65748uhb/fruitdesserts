import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/stubs/empty.ts") } },
  test: { environment: "jsdom", include: ["tests/**/*.test.{ts,tsx}"] },
});
