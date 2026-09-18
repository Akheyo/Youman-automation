/** Wiederverwendbare Bausteine. Jede Slide wird ausschliesslich hieraus gebaut,
 *  damit das Layout auf allen 15 Slides identisch ist. */
const { C, F, T, G, colX, colW, BADGE, cardShadow } = require('./design-system.js');

const up = (s) => s.toUpperCase();

/** Grundgeruest einer hellen Inhaltsslide. */
function slideLight(pres, { kicker, title, titleW = 11.4 }) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  if (kicker) s.addText(up(kicker), { ...T.kicker, x: G.M, y: G.KICKER_Y, w: 8, h: 0.26, color: C.accent, isTextBox: true, margin: 0, valign: 'middle' });
  if (title) s.addText(title, { ...T.title, x: G.M, y: G.TITLE_Y, w: titleW, h: 0.72, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
  return s;
}

/** Grundgeruest einer dunklen Slide (Titel, Einstieg, Fazit). */
function slideDark(pres, { kicker, title, titleW = 11.4 }) {
  const s = pres.addSlide();
  s.background = { color: C.ink };
  if (kicker) s.addText(up(kicker), { ...T.kicker, x: G.M, y: G.KICKER_Y, w: 8, h: 0.26, color: C.accentDark, isTextBox: true, margin: 0, valign: 'middle' });
  if (title) s.addText(title, { ...T.title, x: G.M, y: G.TITLE_Y, w: titleW, h: 0.72, color: C.white, isTextBox: true, margin: 0, valign: 'middle' });
  return s;
}

/** Quellenfussnote — auf JEDER Slide mit Zahlen verpflichtend. */
function foot(s, text, dark = false) {
  s.addText('Quelle: ' + text, {
    ...T.footnote, x: G.M, y: G.FOOT_Y, w: G.CW - 1.1, h: 0.42,
    color: dark ? '8FAEE4' : C.mutedFg, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.15,
  });
}

/** Seitenzahl unten rechts. */
function pageNo(s, n, total, dark = false) {
  s.addText(`${String(n).padStart(2, '0')} / ${total}`, {
    ...T.footnote, x: G.W - G.M - 1.0, y: G.FOOT_Y, w: 1.0, h: 0.22,
    color: dark ? '8FAEE4' : C.mutedFg, align: 'right', isTextBox: true, margin: 0,
  });
}

/** Karte — das durchgaengige Flaechenelement. Kein Randstreifen, nur Flaeche + Rahmen + Schatten. */
function card(s, pres, { x, y, w, h, fill = C.card, line = C.border, shadow = true }) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, fill: { color: fill }, rectRadius: 0.06,
    line: line ? { color: line, width: 1 } : { type: 'none' },
    ...(shadow ? { shadow: cardShadow() } : {}),
  });
}

/** Motiv der Praesentation: abgerundetes Navy-Quadrat mit weissem Icon. */
function badge(s, pres, { x, y, iconUri, fill = C.primary, size = BADGE.size }) {
  if (!iconUri) throw new Error('badge(): iconUri fehlt — Icon nicht vorgeladen?');
  s.addShape(pres.ShapeType.roundRect, { x, y, w: size, h: size, fill: { color: fill }, rectRadius: BADGE.radius, line: { type: 'none' } });
  const inset = size * (BADGE.iconInset / BADGE.size);
  s.addImage({ data: iconUri, x: x + inset, y: y + inset, w: size - 2 * inset, h: size - 2 * inset });
}

/** Ueberschrift ueber einem Diagramm — eigene Typografie statt PowerPoint-Diagrammtitel. */
function chartTitle(s, { x, y, w, text, sub, dark = false }) {
  s.addText(text, { ...T.cardHead, x, y, w, h: 0.24, color: dark ? C.white : C.ink, isTextBox: true, margin: 0, valign: 'middle' });
  if (sub) s.addText(sub, { ...T.footnote, x, y: y + 0.24, w, h: 0.22, color: dark ? '8FAEE4' : C.mutedFg, isTextBox: true, margin: 0, valign: 'middle' });
}

/** Gemeinsame Diagrammoptik. */
function chartOpts(extra = {}) {
  return {
    showTitle: false, showLegend: false,
    chartColors: [C.primary],
    catAxisLabelFontFace: F.body, catAxisLabelFontSize: 11, catAxisLabelColor: C.mutedFg,
    valAxisLabelFontFace: F.body, valAxisLabelFontSize: 10, valAxisLabelColor: C.mutedFg,
    valGridLine: { color: C.border, size: 1 }, catGridLine: { style: 'none' },
    catAxisLineShow: false, valAxisLineShow: false,
    showValue: true, dataLabelFontFace: F.body, dataLabelFontSize: 11, dataLabelFontBold: true, dataLabelColor: C.ink,
    ...extra,
  };
}

module.exports = { slideLight, slideDark, foot, pageNo, card, badge, chartTitle, chartOpts, up };
