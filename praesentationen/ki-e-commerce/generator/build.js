/* Praesentation "Wie KI die Wirtschaft veraendert: Fokus E-Commerce"
 * Designsystem v2 — Neo-Brutalismus. Build: node build.js
 */
const pptxgen = require('pptxgenjs');
const { C, F, T, G, colX, colW } = require('./design-system.js');
const { block, field, iconBlock, slideLight, slideYellow, slideDark, foot, pageNo, chartTitle, chartOpts, up } = require('./lib.js');
const { SOURCES, FN, ABRUF } = require('./data.js');
const { icon } = require('./assets.js');

const TOTAL = 15;
const PAD = 0.30; // Innenabstand in jedem Block

(async () => {
  const names = ['LuBrainCircuit','LuSparkles','LuBot','LuTrendingUp','LuUsers','LuUserRoundCheck','LuScanSearch',
    'LuTag','LuHeadset','LuFileText','LuTruck','LuShieldCheck','LuDatabase','LuTriangleAlert','LuNetwork','LuLock','LuSearch'];
  const I = {};   // schwarze Icons (auf Gelb/Weiss)
  const IW = {};  // weisse Icons (auf Schwarz)
  for (const n of names) { I[n] = await icon(n, '111111'); IW[n] = await icon(n, 'FFFFFF'); }

  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = 'Erstellt mit Claude Code';
  pres.company = 'Youman Automation';
  pres.title = 'Wie KI die Wirtschaft verändert: Fokus E-Commerce';

  /* ===================================================== 01 TITEL (GELB) */
  {
    const s = pres.addSlide();
    s.background = { color: C.yellow };
    s.addText('PRÄSENTATION · SEPTEMBER 2026', { ...T.kicker, x: G.M, y: 0.55, w: 9, h: 0.28, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('WIE KI\nDIE WIRTSCHAFT\nVERÄNDERT', {
      ...T.hero, x: G.M, y: 1.25, w: 11.4, h: 3.55, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 0.94 });
    block(s, pres, { x: G.M, y: 5.02, w: 6.0, h: 0.86, fill: C.ink, border: null });
    s.addText('FOKUS E-COMMERCE', { ...T.statMid, x: G.M + PAD, y: 5.02, w: 6.0 - 2 * PAD, h: 0.86, color: C.yellow, isTextBox: true, margin: 0, valign: 'middle' });
    // Balkenmotiv rechts: greift die Diagrammsprache der Folien 4 bis 13 auf und
    // fuellt die sonst leere Haelfte, ohne Dekoration um ihrer selbst willen zu sein.
    [[9.55, 1.10], [10.65, 1.85], [11.75, 2.65]].forEach(([bx, bh]) => {
      s.addShape(pres.ShapeType.rect, { x: bx, y: 4.90 - bh, w: 0.85, h: bh, fill: { color: C.ink }, line: { type: 'none' } });
    });
    s.addText('DAUER CA. 15 MINUTEN · DATENSTAND SEPTEMBER 2026 · JEDE ZAHL MIT QUELLE', {
      ...T.mono, fontSize: 9.5, x: G.M, y: 6.34, w: 11.4, h: 0.28, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addNotes(
`Begrüßung. Worum es geht: nicht um Science-Fiction, sondern um das, was heute schon messbar in Unternehmen passiert — besonders sichtbar im Onlinehandel.

Rahmen ansagen: rund 15 Minuten, 15 Folien. Am Ende eine vollständige Quellenliste, jede Zahl auf jeder Folie ist belegt.

Hinweis: Die Zahlen sind auf dem Stand September 2026. Wo eine Zahl eine Prognose ist, steht das ausdrücklich dabei.`);
  }

  /* ===================================================== 02 EINSTIEG (SCHWARZ) */
  {
    const s = slideDark(pres, { kicker: 'Einstieg', title: 'Eine Zahl vorweg' });
    s.addText('12 MRD $', { ...T.statHuge, x: G.M, y: 1.80, w: 8.0, h: 1.60, color: C.yellow, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('zusätzlicher Umsatz in einem einzigen Jahr — erzeugt von einem einzigen KI-Einkaufsassistenten: Amazon Rufus.', {
      ...T.lead, x: G.M, y: 3.58, w: 7.3, h: 1.00, color: C.white, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.3 });

    const bx = colX(8), bw = colW(4);
    const rows = [
      { big: '300 MIO.', txt: 'Menschen haben ihn 2025 benutzt.' },
      { big: '+60 %',    txt: 'häufiger kommt ein Kauf zustande.' },
    ];
    rows.forEach((r, i) => {
      const y = 1.80 + i * 1.78;
      block(s, pres, { x: bx, y, w: bw, h: 1.56, fill: C.yellow, border: null, shadow: false });
      s.addText(r.big, { ...T.statBig, x: bx + PAD, y: y + 0.22, w: bw - 2 * PAD, h: 0.58, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(r.txt, { ...T.body, x: bx + PAD, y: y + 0.86, w: bw - 2 * PAD, h: 0.52, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });
    });
    foot(s, FN.amazon, 'dark'); pageNo(s, pres, 2, TOTAL, true);
    s.addNotes(
`Die Zahl, die hängen bleiben soll: 12 Milliarden Dollar.

So viel zusätzlichen Umsatz führt Amazon auf einen einzigen KI-Assistenten zurück — auf Rufus, den Dialog-Assistenten im Suchfeld. Kein Pilotprojekt, sondern der Effekt eines Produkts, das seit 2024 läuft.

Zwei Einordnungen rechts: 300 Millionen Menschen haben ihn 2025 benutzt. Und wer ihn benutzt, kauft mit rund 60 Prozent höherer Wahrscheinlichkeit.

Übergang: Bevor wir uns ansehen, warum das funktioniert — kurz die Frage, was "KI" hier eigentlich heißt.`);
  }

  /* ===================================================== 03 GRUNDLAGEN */
  {
    const s = slideLight(pres, { kicker: 'Grundlagen', title: 'KI in einer Folie' });
    const items = [
      { ic: 'LuBrainCircuit', h: 'MACHINE LEARNING', t: 'Erkennt Muster in großen Datenmengen. Lernt aus Beispielen statt aus Regeln.', ex: 'NACHFRAGEPROGNOSE · BETRUGS-SCORE', fill: C.yellow, dy: 0 },
      { ic: 'LuSparkles',     h: 'GENERATIVE KI',    t: 'Erzeugt neue Inhalte: Text, Bild, Code. Berechnet Schritt für Schritt das Plausibelste.', ex: 'PRODUKTTEXTE · KAMPAGNEN', fill: C.white, dy: 0.24 },
      { ic: 'LuBot',          h: 'KI-AGENTEN',       t: 'Planen mehrere Schritte, bedienen Werkzeuge und handeln eigenständig bis zum Ziel.', ex: 'ASSISTENT, DER SELBST BESTELLT', fill: C.yellow, dy: 0 },
    ];
    items.forEach((it, i) => {
      const x = colX(i * 4), w = colW(4), y = 1.80 + it.dy;
      block(s, pres, { x, y, w, h: 3.42, fill: it.fill });
      iconBlock(s, pres, { x: x + PAD, y: y + PAD, iconUri: I[it.ic], fill: it.fill === C.yellow ? C.white : C.yellow });
      s.addText(it.h, { ...T.cardHead, fontSize: 15, x: x + PAD, y: y + 0.92, w: w - 2 * PAD, h: 0.34, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(it.t, { ...T.body, x: x + PAD, y: y + 1.34, w: w - 2 * PAD, h: 1.20, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.3 });
      s.addText(it.ex, { ...T.mono, fontSize: 9, x: x + PAD, y: y + 2.72, w: w - 2 * PAD, h: 0.48, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });
    });
    block(s, pres, { x: G.M, y: 5.86, w: G.CW, h: 0.64, fill: C.ink, border: null });
    s.addText('Die Reihenfolge ist der Reifegrad. 2026 verschiebt sich der Schwerpunkt vom Erzeugen zum Handeln.', {
      ...T.lead, x: G.M + PAD, y: 5.86, w: G.CW - 2 * PAD, h: 0.64, color: C.white, isTextBox: true, margin: 0, valign: 'middle' });
    pageNo(s, pres, 3, TOTAL);
    s.addNotes(
`Drei Begriffe, die oft durcheinandergehen — hier sauber getrennt.

Machine Learning: Das System bekommt sehr viele Beispiele und leitet daraus Muster ab. Niemand programmiert eine Regel wie "wenn Regen, dann Gummistiefel". Das System sieht es in den Daten. Steckt heute in jeder Nachfrageprognose und jeder Betrugsprüfung.

Generative KI: Der Bruch von 2023. Das System erzeugt selbst Inhalte — Text, Bild, Code. Für den Handel heißt das vor allem: Produkttexte, Bilder und Kampagnen in Minuten statt Wochen.

KI-Agenten: Die Stufe, die gerade beginnt. Ein Agent plant mehrere Schritte, ruft selbst Werkzeuge auf und handelt, bis das Ziel erreicht ist. Der Unterschied: Generative KI antwortet. Ein Agent erledigt.

Merksatz unten: Die Reihenfolge ist der Reifegrad. Wir bewegen uns gerade vom Erzeugen zum Handeln — und das ist die eigentliche Veränderung für den Handel.`);
  }

  /* ===================================================== 04 MAKRO I */
  {
    const s = slideLight(pres, { kicker: 'Makro 1 von 2', title: 'KI ist in der Breite angekommen' });
    const cx = G.M, cw = colW(7);
    block(s, pres, { x: cx, y: 1.78, w: cw, h: 4.50, fill: C.white });
    chartTitle(s, { x: cx + PAD, y: 2.02, w: cw - 2 * PAD, text: 'Unternehmen in Deutschland, die KI einsetzen', sub: 'Anteil in Prozent · Befragung ab 20 Beschäftigten' });
    s.addChart(pres.ChartType.line, [{ name: 'KI-Einsatz', labels: ['2024', '2025', '2026'], values: [20, 36, 57] }],
      chartOpts({
        x: cx + 0.16, y: 2.62, w: cw - 0.40, h: 3.48,
        chartColors: [C.ink], lineSize: 5, lineSmooth: false,
        lineDataSymbol: 'square', lineDataSymbolSize: 14, lineDataSymbolLineColor: C.ink,
        valAxisMaxVal: 70, valAxisMinVal: 0, valAxisMajorUnit: 20,
        dataLabelPosition: 't', dataLabelFontSize: 15, dataLabelFormatCode: '0" %"',
        catAxisLabelFontSize: 12,
      }));
    const bx = colX(7), bw = colW(5);
    block(s, pres, { x: bx, y: 1.78, w: bw, h: 2.16, fill: C.yellow });
    s.addText('2,59 BIO $', { ...T.statBig, x: bx + PAD, y: 2.06, w: bw - 2 * PAD, h: 0.62, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('weltweite KI-Ausgaben 2026. Ein Plus von 47 % — über 45 % davon fließen in Infrastruktur.', {
      ...T.body, x: bx + PAD, y: 2.76, w: bw - 2 * PAD, h: 0.96, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.28 });
    block(s, pres, { x: bx, y: 4.16, w: bw, h: 2.12, fill: C.white });
    s.addText('NUR 4 %', { ...T.statBig, x: bx + PAD, y: 4.44, w: bw - 2 * PAD, h: 0.62, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('der Unternehmen sagen noch, KI sei kein Thema. Vor zwei Jahren waren es 41 %.', {
      ...T.body, x: bx + PAD, y: 5.14, w: bw - 2 * PAD, h: 0.92, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.28 });
    foot(s, FN.bitkomKi + ' · ' + FN.gartner); pageNo(s, pres, 4, TOTAL);
    s.addNotes(
`Jetzt die große Linie — zuerst Deutschland.

Die Kurve links ist der eigentliche Aufreger: 2024 setzte jedes fünfte Unternehmen KI ein. 2026 ist es mit 57 Prozent erstmals die Mehrheit. Fast eine Verdreifachung in zwei Jahren. Solche Adoptionsgeschwindigkeiten kennen wir sonst kaum.

Wichtig: Das ist keine Konzern-Geschichte. Befragt wurden Unternehmen ab 20 Beschäftigten, also ganz normaler Mittelstand.

Rechts oben die Investitionsseite: 2,59 Billionen Dollar weltweite KI-Ausgaben für 2026, plus 47 Prozent. Über 45 Prozent gehen in Infrastruktur — Rechenzentren, Chips, Server. Deshalb wird gerade so viel über Strom und Rechenzentren gesprochen.

Rechts unten die Zahl, die ich am stärksten finde: Nur noch 4 Prozent sagen "kein Thema". Vor zwei Jahren waren das 41 Prozent. Die Frage ist nicht mehr ob, sondern wie.`);
  }

  /* ===================================================== 05 MAKRO II */
  {
    const s = slideLight(pres, { kicker: 'Makro 2 von 2', title: 'Produktivität und Arbeitsmarkt' });
    const tiles = [
      { big: '4,4 BIO', t: 'US-Dollar jährliches Wertpotenzial generativer KI. Spanne ab 2,6 Billionen.', fill: C.yellow, dy: 0 },
      { big: '+12,8 %', t: 'höheres deutsches BIP im Jahr 2037, wenn KI sich weiter in der Breite durchsetzt.', fill: C.white, dy: 0.22 },
      { big: '1,6 MIO', t: 'Arbeitsplätze geraten in Bewegung. Die Beschäftigung bleibt in Summe stabil.', fill: C.yellow, dy: 0 },
    ];
    tiles.forEach((t, i) => {
      const x = colX(i * 4), w = colW(4), y = 1.78 + t.dy;
      block(s, pres, { x, y, w, h: 2.30, fill: t.fill });
      s.addText(t.big, { ...T.statBig, x: x + PAD, y: y + 0.26, w: w - 2 * PAD, h: 0.66, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(t.t, { ...T.body, x: x + PAD, y: y + 1.02, w: w - 2 * PAD, h: 1.06, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.3 });
    });
    block(s, pres, { x: G.M, y: 4.56, w: G.CW, h: 1.62, fill: C.ink, border: null });
    s.addText('DER REALITÄTSCHECK', { ...T.cardHead, fontSize: 15, x: G.M + PAD, y: 4.80, w: G.CW - 2 * PAD, h: 0.34, color: C.yellow, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('Nur 39 % der Unternehmen weltweit führen überhaupt einen EBIT-Effekt auf KI zurück — bei den meisten liegt er unter 5 %. Rund zwei Drittel haben noch gar nicht begonnen, KI zu skalieren.\nEinsatz ist nicht gleich Ertrag.', {
      ...T.lead, x: G.M + PAD, y: 5.22, w: G.CW - 2 * PAD, h: 0.82, color: C.white, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.26 });
    foot(s, FN.mckGenai + ' · ' + FN.iab + ' · ' + FN.mckState); pageNo(s, pres, 5, TOTAL);
    s.addNotes(
`Drei Ebenen, die man auseinanderhalten sollte.

Produktivität: Bis zu 4,4 Billionen Dollar zusätzlicher Wert pro Jahr, gerechnet über 63 konkrete Anwendungsfälle. Die Spanne beginnt bei 2,6 Billionen. Das ist Potenzial, nicht Ist-Zustand.

Wertschöpfung, konkret für Deutschland: Das IAB rechnet, dass das BIP 2037 um bis zu 12,8 Prozent höher liegen könnte. Auch das eine Simulation unter Annahmen — aber von einer sehr nüchternen Institution.

Arbeitsmarkt — die Zahl, die im Kurs am meisten diskutiert wird: 1,6 Millionen Arbeitsplätze geraten in Bewegung, aber unterm Strich bleibt die Beschäftigung stabil. Es verschwinden nicht netto Jobs, es verschieben sich Tätigkeiten. Das ist eine Qualifizierungsfrage, keine Massenarbeitslosigkeitsfrage.

Der schwarze Kasten unten — bitte ernst nehmen: Nur 39 Prozent sehen überhaupt einen Ergebniseffekt, meist unter 5 Prozent. Zwei Drittel haben noch gar nicht angefangen zu skalieren. Wer erzählt, KI zahle sich automatisch aus, hat die Daten nicht gelesen.`);
  }

  /* ===================================================== 06 MARKT DE */
  {
    const s = slideLight(pres, { kicker: 'Der Markt', title: 'Der deutsche Onlinehandel' });
    const cx = G.M, cw = colW(7);
    block(s, pres, { x: cx, y: 1.78, w: cw, h: 4.50, fill: C.white });
    chartTitle(s, { x: cx + PAD, y: 2.02, w: cw - 2 * PAD, text: 'Nettoumsatz Onlinehandel Deutschland', sub: 'in Milliarden Euro · Wert für 2026 ist eine Prognose' });
    s.addChart(pres.ChartType.bar, [{ name: 'Nettoumsatz', labels: ['2024', '2025', '2026 PROG.'], values: [88.8, 92.3, 96.3] }],
      chartOpts({
        x: cx + 0.16, y: 2.62, w: cw - 0.40, h: 3.48, barDir: 'col', barGapWidthPct: 60,
        chartColors: [C.ink, C.ink, C.yellow], dataBorder: { pct: 1.5, color: C.ink },
        valAxisMaxVal: 110, valAxisMinVal: 0, valAxisMajorUnit: 25,
        dataLabelPosition: 'outEnd', dataLabelFontSize: 14, dataLabelFormatCode: '0.0',
        catAxisLabelFontSize: 11,
      }));
    const bx = colX(7), bw = colW(5);
    block(s, pres, { x: bx, y: 1.78, w: bw, h: 2.16, fill: C.yellow });
    s.addText('56,7 %', { ...T.statBig, x: bx + PAD, y: 2.06, w: bw - 2 * PAD, h: 0.62, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('des Onlineumsatzes laufen über Marktplätze. Mehr als jeder zweite Euro.', {
      ...T.body, x: bx + PAD, y: 2.76, w: bw - 2 * PAD, h: 0.96, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.28 });
    block(s, pres, { x: bx, y: 4.16, w: bw, h: 2.12, fill: C.white });
    s.addText('+4,3 %', { ...T.statBig, x: bx + PAD, y: 4.44, w: bw - 2 * PAD, h: 0.62, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('Onlinewachstum 2026 — der stationäre Handel schafft nur +1,6 %.', {
      ...T.body, x: bx + PAD, y: 5.14, w: bw - 2 * PAD, h: 0.92, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.28 });
    foot(s, FN.hde + '; Wert 2026 eigene Berechnung aus der HDE-Prognose von +4,3 %'); pageNo(s, pres, 6, TOTAL);
    s.addNotes(
`Kurzer Blick auf das Spielfeld, bevor wir in die Anwendungen gehen.

Der deutsche Onlinehandel ist zurück auf Wachstumskurs: 92,3 Milliarden Euro netto im Jahr 2025, ein Plus von 3,9 Prozent. Für 2026 erwartet der HDE nochmal plus 4,3 Prozent — daraus habe ich die gelbe Säule gerechnet, deshalb steht "Prognose" dran.

Entscheidend ist der Vergleich rechts unten: online plus 4,3 Prozent, stationär plus 1,6 Prozent. Der Onlinehandel ist der Wachstumsmotor des Einzelhandels.

Und die strukturell wichtigste Zahl: 56,7 Prozent des Onlineumsatzes laufen über Marktplätze. Mehr als jeder zweite Euro. Das bitte merken — darauf kommen wir bei den Risiken zurück.`);
  }

  /* ===================================================== 07 SIEBEN HEBEL */
  {
    const s = slideLight(pres, { kicker: 'E-Commerce konkret', title: 'Sieben Hebel im Onlinehandel' });
    const tiles = [
      { ic: 'LuUserRoundCheck', h: 'PERSONALI-\nSIERUNG',  t: 'Sortiment je Person', fill: C.yellow },
      { ic: 'LuScanSearch',     h: 'PRODUKT-\nSUCHE',      t: 'Dialog statt Stichwort', fill: C.white },
      { ic: 'LuTag',            h: 'DYNAMIC\nPRICING',     t: 'Preise reagieren live', fill: C.yellow },
      { ic: 'LuHeadset',        h: 'KUNDEN-\nSERVICE',     t: 'Rund um die Uhr', fill: C.white },
      { ic: 'LuFileText',       h: 'CONTENT &\nLISTINGS',  t: 'Texte und Bilder automatisch', fill: C.white },
      { ic: 'LuTruck',          h: 'LOGISTIK &\nPROGNOSE', t: 'Bedarf vorhersagen', fill: C.yellow },
      { ic: 'LuShieldCheck',    h: 'BETRUGS-\nERKENNUNG',  t: 'Prüfung in Millisekunden', fill: C.white },
    ];
    tiles.forEach((t, i) => {
      const col = (i % 4) * 3, row = Math.floor(i / 4);
      const x = colX(col), w = colW(3), y = 1.76 + row * 2.40;
      block(s, pres, { x, y, w, h: 2.20, fill: t.fill });
      iconBlock(s, pres, { x: x + 0.26, y: y + 0.26, iconUri: I[t.ic], fill: t.fill === C.yellow ? C.white : C.yellow, size: 0.42 });
      s.addText(t.h, { ...T.cardHead, fontSize: 12, x: x + 0.26, y: y + 0.82, w: w - 0.52, h: 0.62, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.08 });
      s.addText(t.t, { ...T.mono, fontSize: 9, x: x + 0.26, y: y + 1.54, w: w - 0.52, h: 0.52, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });
    });
    const x8 = colX(9), w8 = colW(3), y8 = 1.76 + 2.40;
    block(s, pres, { x: x8, y: y8, w: w8, h: 2.20, fill: C.ink, border: null });
    iconBlock(s, pres, { x: x8 + 0.26, y: y8 + 0.26, iconUri: I['LuDatabase'], fill: C.yellow, size: 0.42 });
    s.addText('OHNE DATEN\nKEIN HEBEL', { ...T.cardHead, fontSize: 12, x: x8 + 0.26, y: y8 + 0.82, w: w8 - 0.52, h: 0.62, color: C.yellow, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.08 });
    s.addText('Alle sieben stehen auf derselben Grundlage.', { ...T.mono, fontSize: 9, x: x8 + 0.26, y: y8 + 1.54, w: w8 - 0.52, h: 0.52, color: C.white, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });
    pageNo(s, pres, 7, TOTAL);
    s.addNotes(
`Das ist die Landkarte für den Rest der Präsentation. Sieben Stellen, an denen KI im Onlinehandel tatsächlich arbeitet — von vorne im Schaufenster bis hinten im Lager.

Vorne, beim Kunden: Personalisierung, Produktsuche, Dynamic Pricing, Kundenservice.
Hinten, im Betrieb: Content und Listings, Logistik und Nachfrageprognose, Betrugserkennung.

Ein Hinweis zur Produktsuche, weil das der größte Umbruch ist: Klassisch tippt man Stichworte ein und bekommt eine Trefferliste. Mit KI beschreibt man eine Situation — "Regenjacke, atmungsaktiv, unter 100 Euro" — und bekommt eine Empfehlung mit Begründung. Das verändert, wie Produkte überhaupt gefunden werden.

Der schwarze Kasten rechts unten ist die unbequeme Wahrheit: Keiner dieser Hebel funktioniert ohne saubere Daten. Wer schlechte Produktdaten hat, bekommt mit KI schnellere schlechte Ergebnisse.`);
  }

  /* ===================================================== 08 WIRKUNG */
  {
    const s = slideLight(pres, { kicker: 'Wirkung', title: 'Was das messbar bringt' });
    const cx = G.M, cw = colW(8);
    block(s, pres, { x: cx, y: 1.78, w: cw, h: 4.50, fill: C.white });
    chartTitle(s, { x: cx + PAD, y: 2.02, w: cw - 2 * PAD, text: 'Berichtete Effektgrößen', sub: 'in Prozent · Richtung der Veränderung steht in der Beschriftung' });
    s.addChart(pres.ChartType.bar, [{
      name: 'Effekt',
      labels: ['Umsatz Personalisierung (steigt)', 'Lagerbestände (sinken)', 'Prognosefehler (sinkt)', 'Fehlbestände (sinken)', 'Content-Leistung (steigt)', 'Bearbeitungszeit Service (sinkt)'],
      values: [15, 30, 50, 65, 70, 82],
    }], chartOpts({
      x: cx + 0.14, y: 2.62, w: cw - 0.38, h: 3.48, barDir: 'bar', barGapWidthPct: 45,
      chartColors: [C.ink, C.ink, C.ink, C.ink, C.ink, C.yellow], dataBorder: { pct: 1.5, color: C.ink },
      valAxisMaxVal: 100, valAxisMinVal: 0, valAxisHidden: true,
      dataLabelPosition: 'outEnd', dataLabelFontSize: 12, dataLabelFormatCode: '0" %"',
      catAxisLabelFontSize: 10,
    }));
    const bx = colX(8), bw = colW(4);
    block(s, pres, { x: bx, y: 1.78, w: bw, h: 4.50, fill: C.ink, border: null });
    iconBlock(s, pres, { x: bx + PAD, y: 2.06, iconUri: I['LuTriangleAlert'], fill: C.yellow });
    s.addText('BITTE NICHT\nADDIEREN', { ...T.cardHead, fontSize: 15, x: bx + PAD, y: 2.70, w: bw - 2 * PAD, h: 0.74, color: C.yellow, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.1 });
    s.addText('Die Balkenlänge zeigt die Größe des Effekts, nicht die Richtung. Ob ein Wert steigt oder sinkt, steht links in der Beschriftung.\n\nDie Werte stammen aus verschiedenen Studien und Unternehmen. Sie zeigen Größenordnungen, keine Garantien.', {
      ...T.body, x: bx + PAD, y: 3.62, w: bw - 2 * PAD, h: 2.40, color: C.white, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.3 });
    foot(s, 'Personalisierung, Bestände, Prognosefehler: ' + FN.mckGenai + ' · Content: ' + FN.zalando + ' · Bearbeitungszeit: ' + FN.klarna); pageNo(s, pres, 8, TOTAL);
    s.addNotes(
`Jetzt wird es konkret. Das sind berichtete Effektgrößen aus Studien und Unternehmensangaben.

Von unten nach oben: Personalisierung hebt den Umsatz um bis zu 15 Prozent. Lagerbestände sinken um bis zu 30 Prozent, weil besser vorhergesagt wird, was gebraucht wird. Prognosefehler sinken um bis zu 50 Prozent. Fehlbestände — also "leider ausverkauft" — um bis zu 65 Prozent.

Oben die beiden größten Hebel: Content-Leistung plus 70 Prozent bei Zalando. Und der gelbe Spitzenreiter: Die Bearbeitungszeit im Kundenservice sinkt um 82 Prozent — bei Klarna von elf Minuten auf unter zwei.

Zwei Warnhinweise, die ich ausdrücklich betone — sie stehen auch rechts:

Erstens: Die Balkenlänge zeigt die Größe des Effekts, nicht die Richtung. Manche Werte steigen, manche sinken. Steht jeweils in der Beschriftung.

Zweitens: Diese Zahlen darf man nicht addieren. Sie kommen aus unterschiedlichen Unternehmen mit unterschiedlichen Ausgangslagen. Größenordnungen, keine Garantien.`);
  }

  /* ===================================================== 09 AMAZON */
  {
    const s = slideLight(pres, { kicker: 'Praxis 1 von 3', title: 'Amazon Rufus' });
    const cx = G.M, cw = colW(6);
    block(s, pres, { x: cx, y: 1.78, w: cw, h: 4.50, fill: C.white });
    chartTitle(s, { x: cx + PAD, y: 2.02, w: cw - 2 * PAD, text: 'Wahrscheinlichkeit eines Kaufabschlusses', sub: 'Indexwert · Einkauf ohne Assistent = 100' });
    s.addChart(pres.ChartType.bar, [{ name: 'Index', labels: ['OHNE RUFUS', 'MIT RUFUS'], values: [100, 160] }],
      chartOpts({
        x: cx + 0.16, y: 2.66, w: cw - 0.40, h: 3.44, barDir: 'col', barGapWidthPct: 90,
        chartColors: [C.smoke, C.yellow], dataBorder: { pct: 2, color: C.ink },
        valAxisMaxVal: 180, valAxisMinVal: 0, valAxisMajorUnit: 60,
        dataLabelPosition: 'outEnd', dataLabelFontSize: 16, dataLabelFormatCode: '0',
        catAxisLabelFontSize: 11,
      }));
    const bx = colX(6), bw = colW(6);
    block(s, pres, { x: bx, y: 1.78, w: bw, h: 2.10, fill: C.yellow });
    s.addText('12 MRD $', { ...T.statBig, fontSize: 44, x: bx + PAD, y: 2.10, w: bw - 2 * PAD, h: 0.72, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('zusätzlicher Umsatz 2025 · über 300 Mio. Nutzerinnen und Nutzer', {
      ...T.body, x: bx + PAD, y: 2.92, w: bw - 2 * PAD, h: 0.66, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.25 });
    block(s, pres, { x: bx, y: 4.10, w: bw, h: 2.18, fill: C.white });
    s.addText('WAS ER TUT', { ...T.cardHead, fontSize: 14, x: bx + PAD, y: 4.36, w: bw - 2 * PAD, h: 0.32, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText([
      { text: 'beantwortet Produktfragen im Dialog und vergleicht Alternativen', options: { bullet: true, breakLine: true, paraSpaceAfter: 9 } },
      { text: 'beobachtet Preise und kauft beim Wunschpreis selbstständig', options: { bullet: true, breakLine: true, paraSpaceAfter: 9 } },
      { text: 'kauft inzwischen auch in fremden Shops ein', options: { bullet: true } },
    ], { ...T.body, x: bx + PAD, y: 4.76, w: bw - 2 * PAD, h: 1.40, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.22 });
    foot(s, FN.amazon); pageNo(s, pres, 9, TOTAL);
    s.addNotes(
`Erstes Praxisbeispiel — die Zahl vom Anfang, jetzt eingeordnet.

Die Grafik links ist der Kern: Wer Rufus benutzt, kauft mit rund 60 Prozent höherer Wahrscheinlichkeit. Ich habe das als Index dargestellt — ohne Assistent 100, mit Assistent 160.

Warum das wirkt: Rufus beantwortet Fragen im Dialog, statt nur eine Trefferliste auszuspucken. Er vergleicht, begründet, beobachtet Preise und kauft auf Wunsch selbstständig, sobald der Wunschpreis erreicht ist.

Der strategisch spannendste Punkt steht ganz unten: Rufus kauft inzwischen auch in fremden Shops ein. Amazon wird damit zur Einkaufsebene über dem eigenen Sortiment hinaus.

Frage an die Runde, wenn Zeit ist: Was bedeutet das für einen Händler, der nicht Amazon ist? Antwort: Er muss dafür sorgen, dass eine Maschine sein Produkt versteht — nicht nur ein Mensch.`);
  }

  /* ===================================================== 10 ZALANDO */
  {
    const s = slideLight(pres, { kicker: 'Praxis 2 von 3', title: 'Zalando' });
    const tiles = [
      { big: '-8 %',   t: 'größenbedingte Retouren durch Size & Fit', fill: C.yellow },
      { big: '+13 %',  t: 'mehr Artikel im Warenkorb durch KI-Matching', fill: C.white },
      { big: '90 %',   t: 'der Produktinhalte sind KI-erzeugt', fill: C.white },
      { big: '6 MIO',  t: 'Nutzer des Assistant — viermal so viele wie 2024', fill: C.yellow },
    ];
    tiles.forEach((t, i) => {
      const x = colX(i * 3), w = colW(3), y = 1.78 + (i % 2 === 1 ? 0.20 : 0);
      block(s, pres, { x, y, w, h: 2.34, fill: t.fill });
      s.addText(t.big, { ...T.statBig, fontSize: 34, x: x + 0.26, y: y + 0.28, w: w - 0.52, h: 0.62, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(t.t, { ...T.body, fontSize: 12, x: x + 0.26, y: y + 1.02, w: w - 0.52, h: 1.10, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.3 });
    });
    block(s, pres, { x: G.M, y: 4.62, w: G.CW, h: 1.56, fill: C.ink, border: null });
    s.addText('KI SITZT NICHT AN EINER STELLE, SONDERN ENTLANG DER GANZEN KETTE', {
      ...T.cardHead, fontSize: 14, x: G.M + PAD, y: 4.86, w: G.CW - 2 * PAD, h: 0.34, color: C.yellow, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('Content-Leistung +70 %, Kampagnen in Tagen statt sechs Wochen, Lieferzusage 22 Prozentpunkte genauer.\nRahmen 2025: 12,3 Mrd. € Umsatz (+16,8 %) und 591 Mio. € bereinigtes EBIT.', {
      ...T.lead, x: G.M + PAD, y: 5.28, w: G.CW - 2 * PAD, h: 0.80, color: C.white, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.26 });
    foot(s, FN.zalando); pageNo(s, pres, 10, TOTAL);
    s.addNotes(
`Zweites Beispiel — das interessantere für den deutschen Markt, weil es ein europäisches Unternehmen ist und KI hier nicht an einer Stelle sitzt, sondern entlang der ganzen Kette.

Erste Zahl, größter Hebel für Marge und Nachhaltigkeit zugleich: 8 Prozent weniger größenbedingte Retouren. Grundlage sind echte Körpermaße von über einer Million Kundinnen und Kunden. Jede vermiedene Retoure spart Versand, Aufbereitung und CO2.

Plus 13 Prozent Artikel im Warenkorb durch besseres Matching. 90 Prozent der Produktinhalte sind inzwischen KI-erzeugt — von nahezu null in einem Jahr. Und sechs Millionen Menschen nutzen den Assistenten, viermal so viele wie im Vorjahr.

Im schwarzen Kasten der Rest: Content-Leistung plus 70 Prozent, Kampagnen in Tagen statt sechs Wochen, Lieferzusage 22 Prozentpunkte genauer. Rahmen: 12,3 Milliarden Euro Umsatz, plus 16,8 Prozent.

Wichtig für die Einordnung: Das ist Unternehmenskommunikation aus dem Geschäftsbericht. Die Richtung ist belegt, die Kausalität behauptet das Unternehmen selbst.`);
  }

  /* ===================================================== 11 SHOPIFY / KLARNA */
  {
    const s = slideLight(pres, { kicker: 'Praxis 3 von 3', title: 'Shopify und die Klarna-Lektion' });
    const lw = colW(6), lx = G.M, rx = colX(6);
    const cards = [
      { x: lx, fill: C.white, ic: 'LuTrendingUp', name: 'SHOPIFY', big: '15-FACH', lead: 'wuchsen KI-zugeordnete Bestellungen zwischen Januar 2025 und Januar 2026.',
        bul: ['Shopify Magic schreibt Produkttexte und Kampagnen.', 'Shops sind in ChatGPT und Perplexity direkt kaufbar.'] },
      { x: rx, fill: C.yellow, ic: 'LuHeadset', name: 'KLARNA', big: '-82 %', lead: 'Bearbeitungszeit im Service: von elf Minuten auf unter zwei.',
        bul: ['Die KI übernahm zwei Drittel aller Chats — rund 700 Vollzeitkräfte.', '2025 ruderte der Vorstandschef zurück: Die Qualität litt.'] },
    ];
    cards.forEach((c) => {
      block(s, pres, { x: c.x, y: 1.78, w: lw, h: 3.96, fill: c.fill });
      iconBlock(s, pres, { x: c.x + PAD, y: 2.06, iconUri: I[c.ic], fill: c.fill === C.yellow ? C.white : C.yellow, size: 0.42 });
      s.addText(c.name, { ...T.cardHead, fontSize: 14, x: c.x + PAD + 0.60, y: 2.06, w: lw - 2 * PAD - 0.60, h: 0.42, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(c.big, { ...T.statBig, fontSize: 40, x: c.x + PAD, y: 2.70, w: lw - 2 * PAD, h: 0.68, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(c.lead, { ...T.body, x: c.x + PAD, y: 3.46, w: lw - 2 * PAD, h: 0.58, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.25 });
      s.addText(c.bul.map((b, i) => ({ text: b, options: i < c.bul.length - 1 ? { bullet: true, breakLine: true, paraSpaceAfter: 10 } : { bullet: true } })),
        { ...T.body, x: c.x + PAD, y: 4.16, w: lw - 2 * PAD, h: 1.42, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.22 });
    });
    block(s, pres, { x: G.M, y: 5.92, w: G.CW, h: 0.60, fill: C.ink, border: null });
    s.addText('KI SENKT KOSTEN SEHR SCHNELL. QUALITÄT BLEIBT EINE ENTSCHEIDUNG.', {
      ...T.cardHead, fontSize: 14, x: G.M + PAD, y: 5.92, w: G.CW - 2 * PAD, h: 0.60, color: C.yellow, isTextBox: true, margin: 0, valign: 'middle' });
    foot(s, FN.shopify + ' · ' + FN.klarna); pageNo(s, pres, 11, TOTAL);
    s.addNotes(
`Zwei Beispiele auf einer Folie, weil sie zusammengehören: eines für die Chance, eines für die Grenze.

Links Shopify — der Blick auf die kleinen Händler. KI-zugeordnete Bestellungen sind zwischen Januar 2025 und Januar 2026 um das Fünfzehnfache gewachsen. Shopify Magic schreibt Produkttexte und Kampagnen, und über Agentic Storefronts sind Shops direkt in ChatGPT und Perplexity kaufbar. Der Punkt: Werkzeuge, die vor drei Jahren nur Konzerne hatten, liegen jetzt beim Ein-Personen-Shop.

Rechts Klarna — bewusst ein unbequemes Beispiel. Die Zahlen sind spektakulär: Bearbeitungszeit minus 82 Prozent, von elf Minuten auf unter zwei. Zwei Drittel aller Chats von der KI übernommen, die Arbeit von rund 700 Vollzeitkräften.

Und dann kam die Korrektur. 2025 hat der Vorstandschef öffentlich eingeräumt: Die Kosten waren das dominierende Kriterium, die Qualität hat darunter gelitten. Klarna ist zurückgerudert — heute KI zuerst, aber ein Mensch jederzeit erreichbar.

Der Satz im schwarzen Balken ist das, was ich von dieser Folie mitgeben möchte.`);
  }

  /* ===================================================== 12 CHANCEN / RISIKEN */
  {
    const s = slideLight(pres, { kicker: 'Abwägung', title: 'Chancen und Risiken' });
    const lw = colW(6), lx = G.M, rx = colX(6);
    s.addText('CHANCEN', { ...T.kicker, x: lx, y: 1.70, w: lw, h: 0.26, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('RISIKEN', { ...T.kicker, x: rx, y: 1.70, w: lw, h: 0.26, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    const chancen = [
      { ic: 'LuTrendingUp', h: 'WERKZEUGE FÜR ALLE', t: 'Kleine Händler bekommen, was vorher nur Konzerne hatten.' },
      { ic: 'LuHeadset',    h: 'SERVICE OHNE WARTEN', t: 'Beratung rund um die Uhr, in jeder Sprache.' },
      { ic: 'LuTruck',      h: 'WENIGER VERSCHWENDUNG', t: 'Weniger Retouren, Fehlbestände, Überproduktion.' },
    ];
    const risiken = [
      { ic: 'LuUsers',   h: 'BERUFE IM UMBRUCH', t: '1,6 Mio. Arbeitsplätze in Bewegung. Tätigkeiten verschieben sich schnell.' },
      { ic: 'LuNetwork', h: 'PLATTFORMABHÄNGIGKEIT', t: '56,7 % laufen über Marktplätze. Wer dort fehlt, findet nicht statt.' },
      { ic: 'LuLock',    h: 'DATEN UND VERTRAUEN', t: 'Erst 6,3 % kaufen heute vollständig über eine KI.' },
    ];
    const draw = (arr, x, fill) => arr.forEach((r, i) => {
      const y = 2.04 + i * 1.12;
      block(s, pres, { x, y, w: lw, h: 1.00, fill });
      iconBlock(s, pres, { x: x + 0.24, y: y + 0.27, iconUri: I[r.ic], fill: fill === C.yellow ? C.white : C.yellow, size: 0.46 });
      s.addText(r.h, { ...T.cardHead, fontSize: 11.5, x: x + 0.86, y: y + 0.14, w: lw - 1.12, h: 0.28, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(r.t, { ...T.small, fontSize: 10.5, x: x + 0.86, y: y + 0.44, w: lw - 1.12, h: 0.48, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.18 });
    });
    draw(chancen, lx, C.yellow);
    draw(risiken, rx, C.white);

    block(s, pres, { x: G.M, y: 5.50, w: G.CW, h: 1.00, fill: C.ink, border: null });
    s.addText('EU AI ACT', { ...T.cardHead, fontSize: 13, x: G.M + PAD, y: 5.50, w: 1.75, h: 1.00, color: C.yellow, isTextBox: true, margin: 0, valign: 'middle' });
    const steps = [
      { d: '02.08.2026', t: 'Chatbots müssen sich als KI zu erkennen geben, KI-Inhalte werden gekennzeichnet.' },
      { d: '02.12.2027', t: 'Pflichten für Hochrisiko-KI nach Anhang III.' },
      { d: '02.08.2028', t: 'In Produkte eingebettete Hochrisiko-KI.' },
    ];
    steps.forEach((st, i) => {
      const x = 2.85 + i * 3.32, w = 3.10;
      s.addText(st.d, { ...T.mono, fontSize: 11, x, y: 5.68, w, h: 0.24, color: C.yellow, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(st.t, { ...T.small, fontSize: 10, x, y: 5.94, w, h: 0.46, color: C.white, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.15 });
    });
    foot(s, FN.iab + ' · ' + FN.hde + ' · ' + FN.bevh + ' · ' + FN.aiact); pageNo(s, pres, 12, TOTAL);
    s.addNotes(
`Jetzt die Abwägung — und ich möchte, dass beide Spalten gleich ernst genommen werden.

Chancen, links: Erstens werden Werkzeuge demokratisiert. Was vor drei Jahren ein Konzernbudget brauchte, liegt heute im Standardtarif eines Shopsystems. Zweitens Service ohne Warteschlange, rund um die Uhr, in jeder Sprache. Drittens — oft übersehen — weniger Verschwendung: weniger Retouren, Fehlbestände, Überproduktion. Das ist ein Umweltargument, nicht nur ein Kostenargument.

Risiken, rechts: Berufe im Umbruch — 1,6 Millionen Arbeitsplätze in Bewegung. Nicht weg, aber anders. Tätigkeiten verschieben sich schneller, als Qualifikationen nachwachsen.

Plattformabhängigkeit: 56,7 Prozent über Marktplätze. Wenn die KI eines Marktplatzes entscheidet, welches Produkt sie empfiehlt, entscheidet sie über Ihr Geschäft mit.

Daten und Vertrauen: Personalisierung braucht persönliche Daten. Und die Kundschaft ist zurückhaltender, als die Branche gerne hätte — erst 6,3 Prozent kaufen vollständig über eine KI.

Unten die Regulierung, bitte als Kalender lesen: Ab dem 2. August 2026 muss ein Chatbot sagen, dass er eine Maschine ist. Die schärferen Hochrisiko-Pflichten wurden auf Dezember 2027 verschoben, eingebettete Systeme folgen 2028.`);
  }

  /* ===================================================== 13 AUSBLICK 2030 */
  {
    const s = slideLight(pres, { kicker: 'Ausblick', title: 'Ausblick 2030' });
    const cx = G.M, cw = colW(7);
    block(s, pres, { x: cx, y: 1.78, w: cw, h: 4.50, fill: C.white });
    chartTitle(s, { x: cx + PAD, y: 2.02, w: cw - 2 * PAD, text: 'Weltweiter Umsatz im Jahr 2030', sub: 'in Billionen US-Dollar · sämtlich Prognosen, keine Ist-Werte' });
    s.addChart(pres.ChartType.bar, [{ name: '2030', labels: ['AGENTIC\nMINIMUM', 'AGENTIC\nMAXIMUM', 'E-COMMERCE\nGESAMT'], values: [3, 5, 7] }],
      chartOpts({
        x: cx + 0.16, y: 2.66, w: cw - 0.40, h: 3.44, barDir: 'col', barGapWidthPct: 60,
        chartColors: [C.yellow, C.yellow, C.ink], dataBorder: { pct: 1.5, color: C.ink },
        valAxisMaxVal: 8, valAxisMinVal: 0, valAxisMajorUnit: 2,
        dataLabelPosition: 'outEnd', dataLabelFontSize: 16, dataLabelFormatCode: '0',
        catAxisLabelFontSize: 10,
      }));
    const bx = colX(7), bw = colW(5);
    block(s, pres, { x: bx, y: 1.78, w: bw, h: 2.16, fill: C.yellow });
    s.addText('4,1 MRD', { ...T.statBig, x: bx + PAD, y: 2.06, w: bw - 2 * PAD, h: 0.62, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('Menschen kaufen 2030 online — 60,1 % der Weltbevölkerung.', {
      ...T.body, x: bx + PAD, y: 2.76, w: bw - 2 * PAD, h: 0.96, color: C.ink, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.28 });
    block(s, pres, { x: bx, y: 4.16, w: bw, h: 2.12, fill: C.ink, border: null });
    s.addText('DER BRUCH', { ...T.cardHead, fontSize: 15, x: bx + PAD, y: 4.44, w: bw - 2 * PAD, h: 0.34, color: C.yellow, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('Wenn Maschinen einkaufen, ist der Adressat von Marketing nicht mehr nur der Mensch.', {
      ...T.lead, x: bx + PAD, y: 4.90, w: bw - 2 * PAD, h: 1.12, color: C.white, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.28 });
    foot(s, FN.mckAgentic + ' · ' + FN.statista + ' · ' + FN.juniper); pageNo(s, pres, 13, TOTAL);
    s.addNotes(
`Blick nach vorn — alle Zahlen hier sind ausdrücklich Prognosen.

Die Grafik zeigt die Größenordnung: Der gesamte globale E-Commerce wird 2030 bei rund sieben Billionen Dollar erwartet, das ist die schwarze Säule. Und McKinsey schätzt, dass drei bis fünf Billionen davon über Agentic Commerce laufen könnten — also über Einkäufe, die eine KI im Auftrag eines Menschen anbahnt oder abschließt. Das sind die gelben Säulen.

Die Kernaussage: Ein sehr großer Teil des Onlinehandels könnte in wenigen Jahren nicht mehr über eine Website laufen, sondern über einen Assistenten.

Rechts oben eine Randgröße: 4,1 Milliarden Menschen kaufen 2030 online, 60 Prozent der Weltbevölkerung. Nebenbei: Die Ausgaben für Betrugserkennung steigen von 21 auf 39 Milliarden Dollar, weil Betrüger dieselben Werkzeuge nutzen — Deepfakes und synthetische Identitäten.

Der schwarze Kasten ist der Satz, über den es sich zu diskutieren lohnt: Wenn Maschinen einkaufen, ist der Adressat von Marketing nicht mehr nur der Mensch. Produktdaten müssen dann nicht schön sein, sondern maschinenlesbar und eindeutig.

Ehrlich bleiben: Heute kaufen 6,3 Prozent vollständig per KI. Zwischen dieser Zahl und den Prognosen liegt viel Weg.`);
  }

  /* ===================================================== 14 FAZIT (GELB) */
  {
    const s = slideYellow(pres, { kicker: 'Fazit', title: 'Drei Sätze zum Mitnehmen' });
    const items = [
      'Erstmals nutzt mit 57 % die Mehrheit der Unternehmen in Deutschland KI. 2024 waren es 20 %.',
      'Im E-Commerce zahlt sich das messbar aus: 12 Mrd. $ Zusatzumsatz bei Amazon, 8 % weniger größenbedingte Retouren bei Zalando.',
      'Der Engpass ist nicht die Technik, sondern Vertrauen, Daten und Regeln — ab dem 2. August 2026 muss sich jeder Chatbot in der EU als KI zu erkennen geben.',
    ];
    items.forEach((t, i) => {
      const y = 1.88 + i * 1.52;
      block(s, pres, { x: G.M, y, w: G.CW, h: 1.32, fill: C.ink, border: null });
      s.addText(String(i + 1).padStart(2, '0'), { ...T.statBig, fontSize: 36, x: G.M + PAD, y: y + 0.32, w: 1.05, h: 0.68, color: C.yellow, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(t, { ...T.lead, fontSize: 15, x: G.M + 1.50, y: y + 0.20, w: G.CW - 1.90, h: 0.92, color: C.white, isTextBox: true, margin: 0, valign: 'middle', lineSpacingMultiple: 1.3 });
    });
    foot(s, FN.bitkomKi + ' · ' + FN.amazon + ' · ' + FN.zalando + ' · ' + FN.bevh + ' · ' + FN.aiact, 'yellow');
    pageNo(s, pres, 14, TOTAL);
    s.addNotes(
`Zum Schluss drei Sätze — mehr braucht es nicht.

Erstens: KI ist in der Breite angekommen. Erstmals nutzt die Mehrheit der deutschen Unternehmen KI, 57 Prozent. 2024 waren es 20. Das ist keine Zukunftsfrage mehr.

Zweitens: Im E-Commerce zahlt sich das messbar aus. Zwölf Milliarden Dollar Zusatzumsatz über einen einzigen Assistenten bei Amazon. Acht Prozent weniger größenbedingte Retouren bei Zalando. Das sind keine Pilotprojekte, das steht in Geschäftsberichten.

Drittens — der wichtigste Satz: Der Engpass ist nicht die Technik. Er liegt bei Vertrauen, Daten und Regeln. Erst 6,3 Prozent der Kundschaft kauft vollständig per KI. Und ab dem 2. August 2026 muss sich in der EU jeder Chatbot als KI zu erkennen geben.

Wer heute anfängt, fängt nicht beim Modell an. Er fängt bei seinen Produktdaten an.

Vielen Dank — Fragen gerne jetzt. Die Quellen stehen auf der nächsten Folie.`);
  }

  /* ===================================================== 15 QUELLEN */
  {
    const ORG = {
      'bitkom-ki': 'Bitkom e. V.', 'bitkom-handel': 'Bitkom e. V.', 'gartner-ai': 'Gartner',
      'hde': 'HDE', 'bevh': 'bevh', 'mck-genai': 'McKinsey & Company', 'mck-state': 'McKinsey & Company',
      'mck-agentic': 'McKinsey & Company', 'iab': 'IAB', 'amazon': 'Amazon.com, Inc.',
      'zalando': 'Zalando SE', 'shopify': 'Shopify Inc.', 'klarna': 'Klarna Bank AB',
      'juniper': 'Juniper Research', 'aiact': 'Europäische Union', 'statista': 'Statista / ECDB',
    };
    const SHORT = {
      'bitkom-ki':    'KI in Deutschland 2026, Presseinfo 14.09.2026 (n = 603)',
      'bitkom-handel':'Digitaler Handel in Deutschland 2026 (n = 1.072)',
      'gartner-ai':   'Worldwide AI Spending to Grow 47 % in 2026 (19.05.2026)',
      'hde':          'Online-Monitor 2026, Meldung vom 03.06.2026',
      'bevh':         'Jahreszahlen 2025 zum deutschen E-Commerce',
      'mck-genai':    'The economic potential of generative AI',
      'mck-state':    'The state of AI (2025)',
      'mck-agentic':  'Agentic Commerce 2030, via Digital Commerce 360',
      'iab':          'Forschungsbericht 23/2025 zu KI und Beschäftigung',
      'amazon':       'Q4/GJ 2025, Ergebnisse und Earnings Call (02/2026)',
      'zalando':      'Geschäftsjahr 2025, veröffentlicht am 12.03.2026',
      'shopify':      'Editions Winter ’26 und Enterprise-AI-Seite',
      'klarna':       'Presseinfo zum KI-Assistenten; Kurskorrektur 2025',
      'juniper':      'Fraud Detection & Prevention Spending',
      'aiact':        'Verordnung (EU) 2024/1689, Art. 50 und 113',
      'statista':     'Globaler E-Commerce 2022–2030',
    };
    const s = slideLight(pres, { kicker: 'Nachweis', title: 'Quellen und Abrufdatum' });
    s.addText(`ALLE INTERNETQUELLEN ZULETZT ABGERUFEN AM ${ABRUF}`, {
      ...T.mono, fontSize: 9.5, x: G.M, y: 1.58, w: G.CW, h: 0.26, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    const lw = colW(6), rowH = 0.50, top = 1.90;
    SOURCES.forEach((src, i) => {
      const x = i < 8 ? G.M : colX(6);
      const y = top + (i % 8) * rowH;
      s.addText([
        { text: String(i + 1).padStart(2, '0') + '  ', options: { fontFace: F.mono, bold: true, color: C.ink } },
        { text: ORG[src.id] + ': ', options: { bold: true, color: C.ink } },
        { text: SHORT[src.id], options: { color: C.ink } },
      ], { fontFace: F.body, fontSize: 8.5, x, y, w: lw, h: 0.22, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.0 });
      s.addText(src.url, { fontFace: F.mono, fontSize: 7, x: x + 0.30, y: y + 0.23, w: lw - 0.30, h: 0.28, color: C.grey, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.05 });
    });
    block(s, pres, { x: G.M, y: 6.10, w: G.CW, h: 0.46, fill: C.yellow });
    s.addText('Alle Diagramme aus den genannten Daten selbst erstellt (native PowerPoint-Diagramme). Icons: Lucide, ISC-Lizenz. Keine Stockfotos, keine fremden Diagramm-Screenshots.', {
      ...T.small, fontSize: 9.5, x: G.M + 0.24, y: 6.10, w: G.CW - 0.48, h: 0.46, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    pageNo(s, pres, 15, TOTAL);
    s.addNotes(
`Quellenfolie — bitte stehen lassen, solange Fragen kommen.

Grundsatz: Jede Zahl auf jeder Folie hat eine Fußnote, und jede Fußnote löst sich hier auf, mit vollständiger URL und Abrufdatum.

Zwei Hinweise zur Sorgfalt:
Erstens sind Unternehmensangaben — Amazon, Zalando, Shopify, Klarna — als solche gekennzeichnet. Das ist Unternehmenskommunikation, keine unabhängige Prüfung.
Zweitens sind Prognosen überall dort als Prognose beschriftet, wo sie eine sind. Die gelbe Säule für 2026 im deutschen Onlinehandel habe ich selbst aus der HDE-Wachstumsprognose gerechnet; das steht in der Fußnote der Folie.

Unten: Alle Diagramme sind aus den recherchierten Daten selbst erstellt, es wurden keine fremden Charts abfotografiert und keine Stockfotos verwendet.`);
  }

  await pres.writeFile({ fileName: 'KI-und-E-Commerce.pptx' });
  console.log('Fertig: KI-und-E-Commerce.pptx');
})().catch((e) => { console.error('FEHLER:', e); process.exit(1); });
