import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Smoke-Flows brauchen echte Timer-Abläufe (Kaltstart-Retry 2,5 s u. ä.).
    testTimeout: 20_000,
    globals: false,
  },
});
