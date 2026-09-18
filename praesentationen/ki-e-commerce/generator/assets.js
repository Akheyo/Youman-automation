/**
 * ASSETS — alle Bildelemente werden hier SELBST erzeugt.
 * Es werden keinerlei fremde Screenshots oder Stockfotos eingebunden.
 *  - Icons: Lucide (react-icons/lu), ISC-Lizenz, als SVG gerendert und gerastert.
 *  - Titelgrafik: prozedural erzeugtes SVG (eigenes Werk, deterministisch).
 */
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Lu = require('react-icons/lu');
const sharp = require('sharp');

const cache = new Map();

/** Lucide-Icon als PNG-Data-URI. name z. B. 'LuSearch', color als Hex ohne '#'. */
async function icon(name, color = 'FFFFFF', px = 256) {
  const key = `${name}|${color}|${px}`;
  if (cache.has(key)) return cache.get(key);
  const Comp = Lu[name];
  if (!Comp) throw new Error(`Icon nicht gefunden: ${name}`);
  let svg = renderToStaticMarkup(React.createElement(Comp, { size: px }));
  svg = svg.replace(/currentColor/g, `#${color}`);
  svg = svg.replace(/stroke-width="2"/g, 'stroke-width="2.6"'); // kraeftigere Strichstaerke fuer die brutalistische Optik
  if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  const buf = await sharp(Buffer.from(svg)).resize(px, px).png().toBuffer();
  const uri = 'image/png;base64,' + buf.toString('base64');
  cache.set(key, uri);
  return uri;
}

/** Deterministischer Zufall, damit der Build reproduzierbar bleibt. */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * Titelgrafik: prozedurales Knotennetz ("Daten werden zu Entscheidungen").
 * Eigene Erzeugung — kein Stockmaterial, keine Lizenzfrage.
 */
async function titleArt({ w = 2666, h = 1500, bg = '1E3A8A', dot = '3B82F6', hot = 'F59E0B' } = {}) {
  const r = rng(20260918);
  const N = 68;
  const pts = Array.from({ length: N }, () => ({ x: r() * w, y: r() * h, s: 3 + r() * 7 }));
  const lines = [];
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      if (d < 235) lines.push(`<line x1="${pts[i].x.toFixed(1)}" y1="${pts[i].y.toFixed(1)}" x2="${pts[j].x.toFixed(1)}" y2="${pts[j].y.toFixed(1)}" stroke="#${dot}" stroke-width="1.4" opacity="${(0.30 * (1 - d / 235)).toFixed(3)}"/>`);
    }
  }
  const dots = pts.map((p, i) => {
    const isHot = i % 11 === 0;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.s.toFixed(1)}" fill="#${isHot ? hot : dot}" opacity="${isHot ? 0.85 : 0.42}"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <radialGradient id="vig" cx="72%" cy="34%" r="78%">
        <stop offset="0%" stop-color="#2748A8" stop-opacity="1"/>
        <stop offset="100%" stop-color="#${bg}" stop-opacity="1"/>
      </radialGradient>
      <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#${bg}" stop-opacity="0.97"/>
        <stop offset="52%" stop-color="#${bg}" stop-opacity="0.72"/>
        <stop offset="100%" stop-color="#${bg}" stop-opacity="0.12"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#vig)"/>
    <g>${lines.join('')}</g>
    <g>${dots.join('')}</g>
    <rect width="${w}" height="${h}" fill="url(#fade)"/>
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}

module.exports = { icon, titleArt };
