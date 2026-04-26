/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Copy Cesium's pre-built bundle into ./public/cesium so it is served from
 * the same origin as the app. Cesium ships its workers + chunks pre-built
 * and can't be re-bundled by webpack/swc — so we serve them as static
 * assets and load Cesium via a <Script> tag in app/layout.tsx.
 *
 * Runs as `npm postinstall`. Idempotent.
 */
const fs = require('node:fs');
const path = require('node:path');

const src = path.join('node_modules', 'cesium', 'Build', 'Cesium');
const dst = path.join('public', 'cesium');

if (!fs.existsSync(src)) {
  console.warn('[cesium] node_modules/cesium not found yet — skipping copy.');
  process.exit(0);
}
if (fs.existsSync(dst)) {
  fs.rmSync(dst, { recursive: true, force: true });
}
fs.cpSync(src, dst, { recursive: true });
console.log(`[cesium] copied ${src} → ${dst}`);
