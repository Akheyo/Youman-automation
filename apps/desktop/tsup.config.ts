import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { main: "electron/main.ts" },
    outDir: "electron/dist",
    format: ["cjs"],
    platform: "node",
    bundle: true,
    external: ["electron", "better-sqlite3"],
    noExternal: ["electron-updater"],
    clean: true,
    sourcemap: false,
    target: "node20",
  },
  {
    entry: { preload: "electron/preload.ts" },
    outDir: "electron/dist",
    format: ["cjs"],
    platform: "node",
    bundle: true,
    external: ["electron"],
    clean: false,
    sourcemap: false,
    target: "node20",
  },
]);
