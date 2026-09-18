/** Brutalistische Grundbausteine. Jede Folie wird ausschliesslich hieraus gebaut. */
const { C, F, T, G, colX, colW } = require('./design-system.js');

const up = (s) => s.toUpperCase();

/**
 * DER Baustein: harte Flaeche mit schwarzer Kante und exakt versetztem
 * Schattenblock dahinter. Kein Weichzeichner — der Schatten ist ein Rechteck.
 */
function block(s, pres, { x, y, w, h, fill = C.white, border = C.ink, shadow = true, borderW = G.BORDER }) {
  if (shadow) {
    s.addShape(pres.ShapeType.rect, {
      x: x + G.SHADOW, y: y + G.SHADOW, w, h,
      fill: { color: C.ink }, line: { type: 'none' },
    });
  }
  s.addShape(pres.ShapeType.rect, {
    x, y, w, h,
    fill: { color: fill },
    line: border ? { color: border, width: borderW } : { type: 'none' },
  });
}

/** Randlose Vollflaeche (Slide-Hintergrund-Felder, Kopfbalken). */
function field(s, pres, { x, y, w, h, fill }) {
  s.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color: fill }, line: { type: 'none' } });
}

/** Motiv: quadratischer Icon-Block, schwarz gerahmt. Kein Kreis, keine Rundung. */
function iconBlock(s, pres, { x, y, iconUri, fill = C.yellow, size = 0.46 }) {
  if (!iconUri) throw new Error('iconBlock(): iconUri fehlt');
  s.addShape(pres.ShapeType.rect, { x, y, w: size, h: size, fill: { color: fill }, line: { color: C.ink, width: G.BORDER } });
  const pad = size * 0.22;
  s.addImage({ data: iconUri, x: x + pad, y: y + pad, w: size - 2 * pad, h: size - 2 * pad });
}

/** Helle Folie (Weiss). */
function slideLight(pres, { kicker, title, titleW = 11.6, titleH = 0.76 }) {
  const s = pres.addSlide();
  s.background = { color: C.white };
  if (kicker) s.addText(up(kicker), { ...T.kicker, x: G.M, y: G.KICKER_Y, w: 8, h: 0.26, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
  if (title) s.addText(up(title), { ...T.title, x: G.M, y: G.TITLE_Y, w: titleW, h: titleH, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
  return s;
}

/** Gelbe Folie (Titel, Fazit). */
function slideYellow(pres, { kicker, title, titleW = 11.6, titleH = 0.76 }) {
  const s = pres.addSlide();
  s.background = { color: C.yellow };
  if (kicker) s.addText(up(kicker), { ...T.kicker, x: G.M, y: G.KICKER_Y, w: 8, h: 0.26, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
  if (title) s.addText(up(title), { ...T.title, x: G.M, y: G.TITLE_Y, w: titleW, h: titleH, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
  return s;
}

/** Schwarze Folie (Einstieg). */
function slideDark(pres, { kicker, title, titleW = 11.6, titleH = 0.76 }) {
  const s = pres.addSlide();
  s.background = { color: C.ink };
  if (kicker) s.addText(up(kicker), { ...T.kicker, x: G.M, y: G.KICKER_Y, w: 8, h: 0.26, color: C.yellow, isTextBox: true, margin: 0, valign: 'middle' });
  if (title) s.addText(up(title), { ...T.title, x: G.M, y: G.TITLE_Y, w: titleW, h: titleH, color: C.white, isTextBox: true, margin: 0, valign: 'middle' });
  return s;
}

/** Quellenfussnote — auf JEDER Folie mit Zahl verpflichtend. Immer Monospace. */
function foot(s, text, mode = 'light') {
  // 'light' = auf Weiss, 'dark' = auf Schwarz, 'yellow' = auf Gelb (dort braucht es Schwarz)
  const color = mode === 'dark' ? 'B9B9B9' : mode === 'yellow' ? C.ink : C.grey;
  s.addText('QUELLE: ' + up(text), {
    ...T.footnote, x: G.M, y: G.FOOT_Y, w: G.CW - 1.15, h: 0.40,
    color, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2,
  });
}

/** Seitenzahl als kleiner Block unten rechts. */
function pageNo(s, pres, n, total, onDark = false) {
  // onDark: true = Folie ist schwarz -> gelber Block mit schwarzer Zahl
  const w = 0.82, h = 0.26, x = G.W - G.M - w, y = G.FOOT_Y - 0.02;
  s.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color: onDark ? C.yellow : C.ink }, line: { type: 'none' } });
  s.addText(`${String(n).padStart(2, '0')}/${total}`, {
    ...T.mono, fontSize: 9, x, y, w, h, color: onDark ? C.ink : C.white,
    align: 'center', isTextBox: true, margin: 0, valign: 'middle',
  });
}

/** Ueberschrift ueber einem Diagramm. */
function chartTitle(s, { x, y, w, text, sub }) {
  s.addText(up(text), { ...T.cardHead, fontSize: 13, x, y, w, h: 0.26, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
  if (sub) s.addText(sub, { ...T.footnote, x, y: y + 0.26, w, h: 0.22, color: C.grey, isTextBox: true, margin: 0, valign: 'middle' });
}

/** Gemeinsame Diagrammoptik: schwarze Balken, keine Gitternetzlinien, Monospace-Zahlen. */
function chartOpts(extra = {}) {
  return {
    showTitle: false, showLegend: false,
    chartColors: [C.ink],
    catAxisLabelFontFace: F.mono, catAxisLabelFontSize: 10, catAxisLabelColor: C.ink,
    valAxisLabelFontFace: F.mono, valAxisLabelFontSize: 9, valAxisLabelColor: C.grey,
    valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    catAxisLineShow: true, valAxisLineShow: false,
    showValue: true, dataLabelFontFace: F.black, dataLabelFontSize: 12, dataLabelColor: C.ink,
    ...extra,
  };
}

module.exports = { block, field, iconBlock, slideLight, slideYellow, slideDark, foot, pageNo, chartTitle, chartOpts, up };
