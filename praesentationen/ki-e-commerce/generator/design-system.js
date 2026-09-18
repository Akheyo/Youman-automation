/**
 * DESIGNSYSTEM — "KI & E-Commerce"
 * Abgeleitet aus dem Skill ui-ux-pro-max (--design-system):
 *   Pattern "Enterprise Gateway" · Style "Data-Dense Dashboard"
 *   Farbnotiz der Quelle: "Blue data + amber highlights [Accent adjusted from #F59E0B]"
 * Verbindlich fuer ALLE Slides. Keine Abweichung, keine Standard-PowerPoint-Optik.
 */

// ---------------------------------------------------------------- FARBPALETTE
// Dominanz 60-70 % Navy, 1-2 Stuetztoene, EIN scharfer Akzent (Amber).
const C = {
  ink:        '1E3A8A', // dunkler Navy  — Hintergrund dunkler Slides, Headline-Farbe hell
  primary:    '1E40AF', // Primaer       — Balken, Badges, Kernflaechen
  secondary:  '3B82F6', // Stuetzton     — zweite Datenreihe, sekundaere Flaechen
  tertiary:   '93C5FD', // Stuetzton     — dritte Datenreihe
  accent:     'D97706', // Akzent hell   — Amber auf HELLEM Grund (kontrastgeprueft)
  accentDark: 'F59E0B', // Akzent dunkel — Amber auf DUNKLEM Grund
  bg:         'F8FAFC', // Slide-Hintergrund hell
  card:       'FFFFFF', // Kartenflaeche
  muted:      'E9EEF6', // stille Flaeche
  mutedFg:    '475569', // stille Schrift (Kontrast 7.4:1 auf F8FAFC)
  border:     'DBEAFE', // Kartenrahmen
  danger:     'DC2626', // Risiko / Rueckgang
  white:      'FFFFFF',
  inkSoft:    'C7D7F5', // Fliesstext auf dunklem Grund (Kontrast 8.9:1 auf 1E3A8A)
};

// Diagrammpalette — feste Reihenfolge, auf jeder Slide identisch.
const CHART_COLORS = [C.primary, C.accent, C.secondary, C.tertiary, C.mutedFg];

// ---------------------------------------------------------------- TYPOGRAFIE
// Serif-Headline + Sans-Body: editorial, klar unterscheidbar von der PPT-Default-Optik.
// Beide Familien sind Office-Standard -> identische Darstellung beim Empfaenger.
const F = {
  display: 'Cambria', // Headlines, Grosszahlen
  body:    'Arial',   // Fliesstext, Labels, Diagramme
};

const T = {
  heroTitle:  { fontFace: F.display, fontSize: 46, bold: true },
  heroSub:    { fontFace: F.display, fontSize: 25, bold: false },
  title:      { fontFace: F.display, fontSize: 29, bold: true },
  kicker:     { fontFace: F.body, fontSize: 10.5, bold: true, charSpacing: 1.8 }, // IMMER UPPERCASE
  lead:       { fontFace: F.body, fontSize: 14.5 },
  cardHead:   { fontFace: F.body, fontSize: 14, bold: true },
  body:       { fontFace: F.body, fontSize: 12.5 },
  small:      { fontFace: F.body, fontSize: 11 },
  statHuge:   { fontFace: F.display, fontSize: 96, bold: true },
  statBig:    { fontFace: F.display, fontSize: 40, bold: true },
  statMid:    { fontFace: F.display, fontSize: 26, bold: true },
  statLabel:  { fontFace: F.body, fontSize: 10.5 },
  footnote:   { fontFace: F.body, fontSize: 9 },
};

// ---------------------------------------------------------------- RASTER 16:9
// Buehne 13.333 x 7.5 Zoll (LAYOUT_WIDE). 12 Spalten, 0.18" Rinne.
const G = {
  W: 13.333, H: 7.5,
  M: 0.62,                 // Aussenrand (> 0.5" Mindestmass)
  GUT: 0.18,               // Rinne
  KICKER_Y: 0.50,
  TITLE_Y: 0.80,
  CONTENT_TOP: 1.72,       // Oberkante Inhaltsflaeche
  CONTENT_BOTTOM: 6.58,    // Unterkante Inhaltsflaeche
  FOOT_Y: 6.80,            // Quellen-Fussnote
  GAP: 0.30,               // Standardabstand zwischen Bloecken
};
G.CW = G.W - 2 * G.M;                       // 12.093 nutzbare Breite
G.COL = (G.CW - 11 * G.GUT) / 12;           // eine Spalte
G.CH = G.CONTENT_BOTTOM - G.CONTENT_TOP;    // 4.86 nutzbare Hoehe

/** x-Position von Spalte i (0-basiert) */
const colX = (i) => G.M + i * (G.COL + G.GUT);
/** Breite ueber n Spalten */
const colW = (n) => n * G.COL + (n - 1) * G.GUT;

// ---------------------------------------------------------------- IKONOGRAFIE
// Lucide (react-icons/lu), Strichstaerke 2, quadratisch, 256 px gerastert.
// Motiv der gesamten Praesentation: abgerundetes Quadrat ("Badge") 0.44",
// Radius 0.10, Navy-Flaeche, weisses Icon. Wiederholt sich auf JEDER Inhaltsslide.
const BADGE = { size: 0.44, radius: 0.10, iconInset: 0.105 };

// Weicher Schatten fuer Karten. pptxgenjs mutiert Optionsobjekte -> immer neu erzeugen.
const cardShadow = () => ({ type: 'outer', color: '1E3A8A', opacity: 0.10, blur: 10, offset: 2, angle: 90 });

module.exports = { C, F, T, G, colX, colW, CHART_COLORS, BADGE, cardShadow };
