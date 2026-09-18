/**
 * DESIGNSYSTEM v2 — "KI & E-Commerce", Neo-Brutalismus.
 * Loest die blaue Karten-Optik von v1 vollstaendig ab.
 *
 * Prinzipien:
 *   1. Flaeche statt Karte. Harte 2,25-pt-Kanten, 0 Radius, KEIN Weichzeichner-Schatten.
 *   2. Schatten = zweites schwarzes Rechteck dahinter, exakt versetzt.
 *   3. Drei Farben tragen alles: Schwarz, Gelb, Weiss. Rot und Mint nur als Flaeche.
 *   4. Bloecke sitzen versetzt, nicht in Reih und Glied.
 *   5. Wenig Text, grosse Zahlen.
 */

// ---------------------------------------------------------------- FARBPALETTE
const C = {
  ink:    '111111', // Schwarz — Kanten, Schatten, Schrift, Flaechen
  yellow: 'FFD84D', // Signalgelb — die tragende Flaeche
  white:  'FFFFFF',
  red:    'FF4D2E', // nur Flaeche/Grosszahl (Kontrast auf Weiss 3,4:1 — kein Fliesstext)
  mint:   '00D6A3', // nur Flaeche (kein Text)
  smoke:  'EFEFEF', // stille Flaeche fuer Nebenzeilen
  grey:   '5A5A5A', // Sekundaerschrift auf Weiss (7,0:1)
};

/** Schriftfarbe ist IMMER Schwarz auf Weiss/Gelb oder Weiss auf Schwarz. Keine Ausnahmen. */
const CHART_COLORS = [C.ink, C.yellow, C.red, C.mint];

// ---------------------------------------------------------------- TYPOGRAFIE
// Arial Black traegt die Plakatwirkung, Courier New die brutalistische Signatur.
// Beide liegen jeder Office-Installation bei -> beim Empfaenger identisch.
// Kontrollrendering: Arial/Courier haben metrisch kompatible Ersatzschriften,
// Arial Black nicht — dort ist bewusst Reserve eingeplant (siehe SLACK).
const F = {
  black: 'Arial Black',
  mono:  'Courier New',
  body:  'Arial',
};
/** Breitenreserve fuer Arial Black, weil die Kontrollschrift schmaler baut. */
const SLACK = 1.22;

const T = {
  hero:      { fontFace: F.black, fontSize: 58 },
  statHuge:  { fontFace: F.black, fontSize: 84 },
  statBig:   { fontFace: F.black, fontSize: 38 },
  statMid:   { fontFace: F.black, fontSize: 25 },
  title:     { fontFace: F.black, fontSize: 28 },
  cardHead:  { fontFace: F.black, fontSize: 14 },
  kicker:    { fontFace: F.mono, fontSize: 11, bold: true, charSpacing: 2.2 }, // IMMER UPPERCASE
  mono:      { fontFace: F.mono, fontSize: 10, bold: true },
  lead:      { fontFace: F.body, fontSize: 14.5 },
  body:      { fontFace: F.body, fontSize: 12.5 },
  small:     { fontFace: F.body, fontSize: 11 },
  footnote:  { fontFace: F.mono, fontSize: 8 },
};

// ---------------------------------------------------------------- RASTER 16:9
const G = {
  W: 13.333, H: 7.5,
  M: 0.62,
  GUT: 0.20,
  KICKER_Y: 0.46,
  TITLE_Y: 0.76,
  CONTENT_TOP: 1.70,
  CONTENT_BOTTOM: 6.56,
  FOOT_Y: 6.82,
  STEP: 0.22,   // Versatz fuer den harten Schatten UND fuer die Staffelung der Bloecke
  BORDER: 2.25, // Kantenstaerke in pt
  SHADOW: 0.10, // Versatz des Schattenblocks in Zoll
};
G.CW = G.W - 2 * G.M;
G.COL = (G.CW - 11 * G.GUT) / 12;
G.CH = G.CONTENT_BOTTOM - G.CONTENT_TOP;

const colX = (i) => G.M + i * (G.COL + G.GUT);
const colW = (n) => n * G.COL + (n - 1) * G.GUT;

module.exports = { C, F, T, G, colX, colW, CHART_COLORS, SLACK };
