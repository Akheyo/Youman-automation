/**
 * Generates the Felix PWA icons (brand background + white "F") as PNGs,
 * dependency-free (Node's zlib only). Run: `node scripts/gen-felix-icons.js`.
 * Output: public/icons/{icon-192,icon-512,apple-touch-icon}.png
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function pngFromRGBA(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function draw(size) {
  const w = size;
  const h = size;
  const buf = Buffer.alloc(w * h * 4);
  const bg = [13, 115, 252, 255];
  const fg = [255, 255, 255, 255];
  const set = (x, y, c) => {
    const o = (y * w + x) * 4;
    buf[o] = c[0];
    buf[o + 1] = c[1];
    buf[o + 2] = c[2];
    buf[o + 3] = c[3];
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, bg);
  const rect = (x0, y0, x1, y1, c) => {
    for (let y = Math.round(y0 * h); y < Math.round(y1 * h); y++)
      for (let x = Math.round(x0 * w); x < Math.round(x1 * w); x++)
        if (x >= 0 && y >= 0 && x < w && y < h) set(x, y, c);
  };
  // Stylized "F": stem + top arm + middle arm
  rect(0.34, 0.28, 0.46, 0.72, fg);
  rect(0.34, 0.28, 0.66, 0.4, fg);
  rect(0.34, 0.47, 0.6, 0.57, fg);
  return pngFromRGBA(w, h, buf);
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-192.png'), draw(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), draw(512));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), draw(180));
console.log('Felix icons written to', outDir);
