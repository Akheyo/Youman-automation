/* Praesentation "Wie KI die Wirtschaft veraendert: Fokus E-Commerce"
 * Build: node build.js  ->  KI-und-E-Commerce.pptx
 */
const pptxgen = require('pptxgenjs');
const { C, F, T, G, colX, colW, CHART_COLORS } = require('./design-system.js');
const { slideLight, slideDark, foot, pageNo, card, badge, chartTitle, chartOpts } = require('./lib.js');
const { SOURCES, FN, ABRUF } = require('./data.js');
const { icon, titleArt } = require('./assets.js');

const TOTAL = 15;

(async () => {
  // ------------------------------------------------------------- Icons vorab
  const names = ['LuBrainCircuit','LuSparkles','LuBot','LuTrendingUp','LuFactory','LuUsers','LuUserRoundCheck',
    'LuScanSearch','LuTag','LuHeadset','LuFileText','LuTruck','LuShieldCheck','LuDatabase','LuTriangleAlert',
    'LuNetwork','LuLock','LuScale','LuTarget','LuGlobe','LuCircleCheck','LuClock','LuSearch','LuPackage',
    'LuShoppingCart'];
  const I = {};
  for (const n of names) I[n] = await icon(n, 'FFFFFF');
  const IA = {}; // Icons in Amber fuer Risiko-Badges
  for (const n of ['LuTriangleAlert','LuNetwork','LuLock','LuScale','LuUsers']) IA[n] = await icon(n, 'FFFFFF');
  const art = await titleArt();

  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';            // 13.333 x 7.5 Zoll — VOR der ersten Slide setzen
  pres.author = 'Erstellt mit Claude Code';
  pres.company = 'Youman Automation';
  pres.title = 'Wie KI die Wirtschaft verändert: Fokus E-Commerce';

  /* ============================================================ 01 TITEL */
  {
    const s = pres.addSlide();
    s.background = { color: C.ink };
    s.addImage({ data: art, x: 0, y: 0, w: G.W, h: G.H });
    s.addText('PRÄSENTATION · SEPTEMBER 2026', { ...T.kicker, x: 0.95, y: 1.72, w: 7.5, h: 0.28, color: C.accentDark, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('Wie KI die Wirtschaft\nverändert', { ...T.heroTitle, x: 0.95, y: 2.20, w: 8.4, h: 1.75, color: C.white, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.05 });
    s.addText('Fokus E-Commerce', { ...T.heroSub, x: 0.95, y: 4.12, w: 8.4, h: 0.52, color: C.accentDark, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('Dauer ca. 15 Minuten  ·  Datenstand September 2026  ·  Jede Zahl mit Quellenangabe', {
      ...T.small, x: 0.95, y: 5.35, w: 8.4, h: 0.3, color: C.inkSoft, isTextBox: true, margin: 0, valign: 'middle' });
    s.addNotes(
`Begrüßung. Worum es geht: nicht um Science-Fiction, sondern um das, was heute schon messbar in Unternehmen passiert — und zwar besonders sichtbar im Onlinehandel.

Rahmen ansagen: rund 15 Minuten, 15 Folien. Am Ende gibt es eine vollständige Quellenliste, jede Zahl auf jeder Folie ist belegt.

Hinweis an die Zuhörenden: Die Zahlen sind auf dem Stand September 2026. Wo eine Zahl eine Prognose ist, steht das ausdrücklich dabei.`);
  }

  /* ============================================================ 02 DIE ZAHL */
  {
    const s = slideDark(pres, { kicker: 'Einstieg', title: 'Eine Zahl vorweg' });
    s.addText('12 Mrd. $', { ...T.statHuge, fontSize: 72, x: G.M, y: 1.90, w: 6.9, h: 1.20, color: C.white, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('zusätzlicher annualisierter Umsatz — erwirtschaftet von einem einzigen KI-Einkaufsassistenten im Jahr 2025.', {
      ...T.lead, x: G.M, y: 3.26, w: 6.3, h: 0.95, color: C.inkSoft, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.25 });
    s.addText('Amazon Rufus. Eingeführt 2024. Ein Eingabefeld.', {
      ...T.body, bold: true, x: G.M, y: 4.36, w: 6.3, h: 0.32, color: C.accentDark, isTextBox: true, margin: 0, valign: 'middle' });

    const bx = colX(7), bw = colW(5);
    const rows = [
      { ic: 'LuUsers',      big: '300 Mio.', txt: 'Kundinnen und Kunden nutzten den Assistenten im Jahr 2025.' },
      { ic: 'LuTrendingUp', big: '+60 %',    txt: 'höhere Wahrscheinlichkeit, dass ein Kauf zustande kommt.' },
      { ic: 'LuClock',      big: '2024',     txt: 'Jahr der Einführung — der ausgewiesene Effekt ist der Jahreswert 2025.' },
    ];
    rows.forEach((r, i) => {
      const y = 1.82 + i * 1.52;
      card(s, pres, { x: bx, y, w: bw, h: 1.28, fill: '24438F', line: '3B62C9', shadow: false });
      badge(s, pres, { x: bx + 0.30, y: y + 0.30, iconUri: I[r.ic], fill: C.accentDark });
      s.addText(r.big, { ...T.statMid, x: bx + 0.95, y: y + 0.20, w: bw - 1.25, h: 0.42, color: C.white, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(r.txt, { ...T.small, x: bx + 0.95, y: y + 0.64, w: bw - 1.25, h: 0.52, color: C.inkSoft, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.15 });
    });
    foot(s, FN.amazon, true); pageNo(s, 2, TOTAL, true);
    s.addNotes(
`Die Zahl, die hängen bleiben soll: 12 Milliarden Dollar.

So viel zusätzlichen Umsatz führt Amazon auf einen einzigen KI-Assistenten zurück — auf Rufus, den Dialog-Assistenten im Suchfeld. Das ist kein Pilotprojekt, das ist der Effekt eines Produkts, das seit 2024 läuft.

Drei Einordnungen rechts: 300 Millionen Menschen haben ihn 2025 benutzt. Wer ihn benutzt, kauft mit rund 60 Prozent höherer Wahrscheinlichkeit. Und: Von der Einführung bis zu diesem Effekt vergingen etwa 18 Monate.

Übergang: Bevor wir uns ansehen, warum das funktioniert — kurz die Frage, was "KI" hier eigentlich heißt.`);
  }

  /* ============================================================ 03 KI ERKLÄRT */
  {
    const s = slideLight(pres, { kicker: 'Grundlagen', title: 'KI in einer Folie' });
    const items = [
      { ic: 'LuBrainCircuit', h: 'Machine Learning', t: 'Erkennt Muster in großen Datenmengen und leitet daraus Wahrscheinlichkeiten ab. Lernt aus Beispielen statt aus Regeln.', ex: 'Nachfrageprognose · Betrugs-Score · Empfehlungen' },
      { ic: 'LuSparkles',     h: 'Generative KI',    t: 'Erzeugt neue Inhalte: Text, Bild, Code. Sie berechnet Schritt für Schritt, was als Nächstes am plausibelsten ist.', ex: 'Produkttexte · Kampagnenmotive · Übersetzungen' },
      { ic: 'LuBot',          h: 'KI-Agenten',       t: 'Planen mehrere Schritte, bedienen selbst Werkzeuge und handeln eigenständig, bis ein Ziel erreicht ist.', ex: 'Assistent, der recherchiert, vergleicht und bestellt' },
    ];
    items.forEach((it, i) => {
      const x = colX(i * 4), w = colW(4);
      card(s, pres, { x, y: 1.78, w, h: 3.62 });
      badge(s, pres, { x: x + 0.34, y: 2.10, iconUri: I[it.ic] });
      s.addText(it.h, { ...T.cardHead, fontSize: 16, x: x + 0.34, y: 2.72, w: w - 0.68, h: 0.34, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(it.t, { ...T.body, x: x + 0.34, y: 3.14, w: w - 0.68, h: 1.30, color: C.mutedFg, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.28 });
      s.addText(it.ex, { ...T.small, bold: true, x: x + 0.34, y: 4.58, w: w - 0.68, h: 0.62, color: C.accent, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });
    });
    card(s, pres, { x: G.M, y: 5.62, w: G.CW, h: 0.82, fill: C.muted, line: C.border, shadow: false });
    badge(s, pres, { x: G.M + 0.26, y: 5.81, iconUri: I['LuTarget'], size: 0.44 });
    s.addText('Die Reihenfolge ist zugleich der Reifegrad: Machine Learning läuft seit Jahren im Hintergrund, generative KI seit 2023 im Alltag. 2026 verschiebt sich der Schwerpunkt vom Erzeugen zum Handeln.', {
      ...T.body, x: G.M + 0.88, y: 5.74, w: G.CW - 1.20, h: 0.60, color: C.ink, isTextBox: true, margin: 0, valign: 'middle', lineSpacingMultiple: 1.2 });
    pageNo(s, 3, TOTAL);
    s.addNotes(
`Drei Begriffe, die oft durcheinandergehen — hier sauber getrennt.

Machine Learning: Das System bekommt sehr viele Beispiele und leitet daraus Muster ab. Niemand programmiert eine Regel wie "wenn Regen, dann Gummistiefel". Das System sieht es in den Daten. Das steckt heute in jeder Nachfrageprognose und in jeder Betrugsprüfung.

Generative KI: Der Bruch von 2023. Das System erzeugt selbst Inhalte — Text, Bild, Code. Für den Handel heißt das vor allem: Produkttexte, Bilder und Kampagnen entstehen in Minuten statt in Wochen.

KI-Agenten: Die Stufe, die gerade beginnt. Ein Agent plant mehrere Schritte, ruft selbst Werkzeuge auf und handelt, bis das Ziel erreicht ist. Der Unterschied: Generative KI antwortet. Ein Agent erledigt.

Merksatz unten: Die Reihenfolge ist der Reifegrad. Wir bewegen uns gerade vom Erzeugen zum Handeln — und das ist die eigentliche Veränderung für den Handel.`);
  }

  /* ============================================================ 04 MAKRO I */
  {
    const s = slideLight(pres, { kicker: 'Makro-Ebene 1 von 2', title: 'KI ist in der Breite angekommen — das Geld folgt' });
    const cx = G.M, cw = colW(7);
    card(s, pres, { x: cx, y: 1.74, w: cw, h: 4.62 });
    chartTitle(s, { x: cx + 0.34, y: 1.98, w: cw - 0.68, text: 'Unternehmen in Deutschland, die KI einsetzen', sub: 'Anteil in Prozent · Befragung von Unternehmen ab 20 Beschäftigten' });
    s.addChart(pres.ChartType.line, [{ name: 'KI-Einsatz', labels: ['2024', '2025', '2026'], values: [20, 36, 57] }],
      chartOpts({
        x: cx + 0.18, y: 2.52, w: cw - 0.44, h: 3.60,
        chartColors: [C.primary], lineSize: 3.5, lineSmooth: false,
        lineDataSymbol: 'circle', lineDataSymbolSize: 11, lineDataSymbolLineColor: C.primary,
        valAxisMaxVal: 70, valAxisMinVal: 0, valAxisMajorUnit: 20,
        dataLabelPosition: 't', dataLabelFontSize: 14, dataLabelColor: C.ink, dataLabelFormatCode: '0" %"',
        catAxisLabelFontSize: 12,
      }));

    const bx = colX(7), bw = colW(5);
    card(s, pres, { x: bx, y: 1.74, w: bw, h: 2.22 });
    badge(s, pres, { x: bx + 0.32, y: 2.02, iconUri: I['LuGlobe'] });
    s.addText('2,59 Bio. $', { ...T.statBig, x: bx + 0.32, y: 2.58, w: bw - 0.64, h: 0.58, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('weltweite KI-Ausgaben 2026 (Prognose), nach rund 1,5 Bio. $ im Jahr 2025 — ein Plus von 47 %. Über 45 % davon fließen in Infrastruktur.', {
      ...T.small, x: bx + 0.32, y: 3.18, w: bw - 0.64, h: 0.66, color: C.mutedFg, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });

    card(s, pres, { x: bx, y: 4.14, w: bw, h: 2.22 });
    badge(s, pres, { x: bx + 0.32, y: 4.42, iconUri: I['LuFactory'] });
    s.addText('38 % / 4 %', { ...T.statBig, x: bx + 0.32, y: 4.98, w: bw - 0.64, h: 0.58, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('38 % der Unternehmen planen oder diskutieren den Einsatz. Nur noch 4 % sagen, KI sei für sie kein Thema — vor zwei Jahren waren es 41 %.', {
      ...T.small, x: bx + 0.32, y: 5.58, w: bw - 0.64, h: 0.66, color: C.mutedFg, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });

    foot(s, FN.bitkomKi + '  ·  ' + FN.gartner); pageNo(s, 4, TOTAL);
    s.addNotes(
`Jetzt die große Linie — zuerst Deutschland.

Die Kurve links ist der eigentliche Aufreger: 2024 setzte jedes fünfte Unternehmen KI ein. 2026 ist es mit 57 Prozent erstmals die Mehrheit. Das ist fast eine Verdreifachung in zwei Jahren. Solche Adoptionsgeschwindigkeiten kennen wir sonst kaum.

Wichtig für die Einordnung: Das ist keine Konzern-Geschichte. Befragt wurden Unternehmen ab 20 Beschäftigten, also ganz normaler Mittelstand.

Rechts oben die Investitionsseite: 2,59 Billionen Dollar weltweite KI-Ausgaben für 2026, plus 47 Prozent. Über 45 Prozent davon gehen in Infrastruktur — Rechenzentren, Chips, Server. Das ist der Grund, warum gerade so viel über Strom und Rechenzentren gesprochen wird.

Rechts unten: Der Rest kommt nach. 38 Prozent planen oder diskutieren. Nur noch 4 Prozent sagen "kein Thema" — vor zwei Jahren waren das 41 Prozent. Die Frage ist nicht mehr ob, sondern wie.`);
  }

  /* ============================================================ 05 MAKRO II */
  {
    const s = slideLight(pres, { kicker: 'Makro-Ebene 2 von 2', title: 'Produktivität, Wertschöpfung, Arbeitsmarkt' });
    const lx = G.M, lw = colW(7);
    const rows = [
      { ic: 'LuTrendingUp', h: 'Produktivität', t: 'Generative KI könnte weltweit 2,6 bis 4,4 Bio. $ zusätzlichen Wert pro Jahr erzeugen — gerechnet über 63 untersuchte Anwendungsfälle.' },
      { ic: 'LuFactory',    h: 'Wertschöpfung', t: 'Für Deutschland läge das Bruttoinlandsprodukt im Jahr 2037 um bis zu 12,8 % höher, wenn sich KI weiter in der Breite durchsetzt.' },
      { ic: 'LuUsers',      h: 'Arbeitsmarkt',  t: 'Die Beschäftigung bleibt in Summe weitgehend stabil. In Bewegung geraten trotzdem rund 1,6 Mio. Arbeitsplätze über 15 Jahre.' },
    ];
    rows.forEach((r, i) => {
      const y = 1.78 + i * 1.58;
      card(s, pres, { x: lx, y, w: lw, h: 1.34 });
      badge(s, pres, { x: lx + 0.32, y: y + 0.44, iconUri: I[r.ic] });
      s.addText(r.h, { ...T.cardHead, x: lx + 0.98, y: y + 0.24, w: lw - 1.30, h: 0.30, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(r.t, { ...T.body, x: lx + 0.98, y: y + 0.58, w: lw - 1.30, h: 0.66, color: C.mutedFg, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.22 });
    });
    const bx = colX(7), bw = colW(5);
    card(s, pres, { x: bx, y: 1.78, w: bw, h: 4.58, fill: 'FEF6E7', line: 'F3D9A4' });
    badge(s, pres, { x: bx + 0.34, y: 2.10, iconUri: I['LuTriangleAlert'], fill: C.accent });
    s.addText('Der Realitätscheck', { ...T.cardHead, fontSize: 16, x: bx + 0.34, y: 2.72, w: bw - 0.68, h: 0.34, color: '7C4A06', isTextBox: true, margin: 0, valign: 'middle' });
    s.addText([
      { text: 'Nur 39 % der Unternehmen weltweit führen überhaupt einen EBIT-Effekt auf KI zurück — und bei den meisten liegt er unter 5 %.', options: { bullet: true, breakLine: true, paraSpaceAfter: 10 } },
      { text: 'Rund zwei Drittel haben noch gar nicht begonnen, KI im Unternehmen zu skalieren.', options: { bullet: true, breakLine: true, paraSpaceAfter: 10 } },
      { text: 'Einsatz ist nicht gleich Ertrag. Zwischen Pilotprojekt und Bilanz liegt die eigentliche Arbeit.', options: { bullet: true } },
    ], { ...T.body, x: bx + 0.34, y: 3.20, w: bw - 0.68, h: 2.90, color: '7C4A06', isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.25 });
    foot(s, FN.mckGenai + '  ·  ' + FN.iab + '  ·  ' + FN.mckState); pageNo(s, 5, TOTAL);
    s.addNotes(
`Drei Ebenen, die man auseinanderhalten sollte.

Produktivität: Die oft zitierte McKinsey-Zahl — 2,6 bis 4,4 Billionen Dollar zusätzlicher Wert pro Jahr, gerechnet über 63 konkrete Anwendungsfälle. Das ist Potenzial, nicht Ist-Zustand.

Wertschöpfung, konkret für Deutschland: Das IAB rechnet, dass das BIP 2037 um bis zu 12,8 Prozent höher liegen könnte. Auch das ist eine Simulation unter Annahmen — aber von einer sehr nüchternen Institution.

Arbeitsmarkt — und das ist die Zahl, die im Kurs am meisten diskutiert wird: Unterm Strich bleibt die Beschäftigung stabil. Aber rund 1,6 Millionen Arbeitsplätze geraten in Bewegung. Es verschwinden nicht netto Jobs, es verschieben sich Tätigkeiten. Das ist eine Qualifizierungsfrage, keine Massenarbeitslosigkeitsfrage.

Rechts der Realitätscheck — bitte ernst nehmen: Nur 39 Prozent sehen überhaupt einen Ergebniseffekt, und meist unter 5 Prozent. Zwei Drittel haben noch gar nicht angefangen zu skalieren. Wer Ihnen erzählt, KI zahle sich automatisch aus, hat die Daten nicht gelesen.`);
  }

  /* ============================================================ 06 MARKT DE */
  {
    const s = slideLight(pres, { kicker: 'Der Markt', title: 'Onlinehandel in Deutschland wächst wieder' });
    const cx = G.M, cw = colW(7);
    card(s, pres, { x: cx, y: 1.74, w: cw, h: 4.62 });
    chartTitle(s, { x: cx + 0.34, y: 1.98, w: cw - 0.68, text: 'Nettoumsatz im Onlinehandel in Deutschland', sub: 'in Milliarden Euro · Wert für 2026 ist eine Prognose' });
    s.addChart(pres.ChartType.bar, [{ name: 'Nettoumsatz', labels: ['2024', '2025', '2026 (Prognose)'], values: [88.8, 92.3, 96.3] }],
      chartOpts({
        x: cx + 0.18, y: 2.52, w: cw - 0.44, h: 3.60, barDir: 'col', barGapWidthPct: 110,
        chartColors: [C.primary, C.primary, C.accent],
        valAxisMaxVal: 110, valAxisMinVal: 0, valAxisMajorUnit: 25,
        dataLabelPosition: 'outEnd', dataLabelFontSize: 13, dataLabelFormatCode: '0.0',
        catAxisLabelFontSize: 11.5,
      }));
    const bx = colX(7), bw = colW(5);
    const st = [
      { ic: 'LuNetwork',      big: '56,7 %',            t: 'des Onlineumsatzes laufen über Marktplätze — der mit Abstand wichtigste Kanal.' },
      { ic: 'LuShoppingCart', big: '97,5 Mrd. €',       t: 'Gesamtumsatz des deutschen E-Commerce 2025 inklusive digitaler Dienstleistungen.' },
      { ic: 'LuTrendingUp',   big: '+4,3 % zu +1,6 %',  t: 'Prognose 2026: Onlinehandel gegenüber stationärem Handel.' },
    ];
    st.forEach((r, i) => {
      const y = 1.74 + i * 1.57;
      card(s, pres, { x: bx, y, w: bw, h: 1.33 });
      badge(s, pres, { x: bx + 0.30, y: y + 0.44, iconUri: I[r.ic] });
      s.addText(r.big, { ...T.statMid, fontSize: 23, x: bx + 0.94, y: y + 0.20, w: bw - 1.24, h: 0.38, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(r.t, { ...T.small, x: bx + 0.94, y: y + 0.60, w: bw - 1.24, h: 0.60, color: C.mutedFg, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.18 });
    });
    foot(s, FN.hde + '; Wert für 2026 eigene Berechnung aus der HDE-Wachstumsprognose von +4,3 %  ·  ' + FN.bevh); pageNo(s, 6, TOTAL);
    s.addNotes(
`Kurzer Blick auf das Spielfeld, bevor wir in die Anwendungen gehen.

Der deutsche Onlinehandel ist zurück auf Wachstumskurs: 92,3 Milliarden Euro netto im Jahr 2025, ein Plus von 3,9 Prozent. Für 2026 erwartet der HDE nochmal plus 4,3 Prozent — daraus habe ich die dritte Säule gerechnet, deshalb steht "Prognose" dran.

Entscheidend ist der Vergleich rechts unten: online plus 4,3 Prozent, stationär plus 1,6 Prozent. Der Onlinehandel ist der Wachstumsmotor des Einzelhandels.

Und die strukturell wichtigste Zahl: 56,7 Prozent des Onlineumsatzes laufen über Marktplätze. Mehr als jeder zweite Euro. Das merken Sie sich bitte — darauf kommen wir bei den Risiken zurück.

Wer die Gesamtzahl inklusive digitaler Dienstleistungen will: 97,5 Milliarden Euro laut bevh.`);
  }

  /* ============================================================ 07 SIEBEN HEBEL */
  {
    const s = slideLight(pres, { kicker: 'E-Commerce konkret', title: 'Wo KI im Onlinehandel konkret wirkt' });
    const tiles = [
      { ic: 'LuUserRoundCheck', h: 'Personalisierung',  t: 'Startseite, Sortiment und Empfehlungen je Person' },
      { ic: 'LuScanSearch',     h: 'Produktsuche',      t: 'Dialog statt Stichwort: „Regenjacke unter 100 €"' },
      { ic: 'LuTag',            h: 'Dynamic Pricing',   t: 'Preise reagieren auf Nachfrage, Lager, Wettbewerb' },
      { ic: 'LuHeadset',        h: 'Kundenservice',     t: 'Chat und Mail rund um die Uhr, in jeder Sprache' },
      { ic: 'LuFileText',       h: 'Content & Listings',t: 'Produkttexte, Bilder und Kampagnen automatisch' },
      { ic: 'LuTruck',          h: 'Logistik & Prognose',t:'Bedarf vorhersagen, Lieferzusagen schärfen' },
      { ic: 'LuShieldCheck',    h: 'Betrugserkennung',  t: 'Auffällige Bestellungen in Millisekunden bewerten' },
    ];
    tiles.forEach((t, i) => {
      const col = (i % 4) * 3, row = Math.floor(i / 4);
      const x = colX(col), w = colW(3), y = 1.76 + row * 2.42;
      card(s, pres, { x, y, w, h: 2.22 });
      badge(s, pres, { x: x + 0.28, y: y + 0.28, iconUri: I[t.ic] });
      s.addText(t.h, { ...T.cardHead, fontSize: 13.5, x: x + 0.28, y: y + 0.86, w: w - 0.56, h: 0.30, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(t.t, { ...T.small, x: x + 0.28, y: y + 1.20, w: w - 0.56, h: 0.82, color: C.mutedFg, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });
    });
    const x8 = colX(9), w8 = colW(3), y8 = 1.76 + 2.42;
    card(s, pres, { x: x8, y: y8, w: w8, h: 2.22, fill: C.ink, line: null });
    badge(s, pres, { x: x8 + 0.28, y: y8 + 0.28, iconUri: I['LuDatabase'], fill: C.accentDark });
    s.addText('Gemeinsamer Nenner', { ...T.cardHead, fontSize: 13.5, x: x8 + 0.28, y: y8 + 0.86, w: w8 - 0.56, h: 0.30, color: C.white, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('Alle sieben Hebel stehen auf derselben Grundlage: sauberen, zusammengeführten Daten.', { ...T.small, x: x8 + 0.28, y: y8 + 1.20, w: w8 - 0.56, h: 0.82, color: C.inkSoft, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });
    pageNo(s, 7, TOTAL);
    s.addNotes(
`Das ist die Landkarte für den Rest der Präsentation. Sieben Stellen, an denen KI im Onlinehandel tatsächlich arbeitet — von vorne im Schaufenster bis hinten im Lager.

Vorne, beim Kunden: Personalisierung, Produktsuche, Dynamic Pricing, Kundenservice.
Hinten, im Betrieb: Content und Listings, Logistik und Nachfrageprognose, Betrugserkennung.

Ein Hinweis zur Produktsuche, weil das der größte Umbruch ist: Klassisch tippt man Stichworte ein und bekommt eine Trefferliste. Mit KI beschreibt man eine Situation — "Regenjacke, atmungsaktiv, unter 100 Euro" — und bekommt eine Empfehlung mit Begründung. Das verändert, wie Produkte überhaupt gefunden werden.

Und der dunkle Kasten rechts unten ist die unbequeme Wahrheit: Keiner dieser Hebel funktioniert ohne saubere Daten. Wer schlechte Produktdaten hat, bekommt mit KI schnellere schlechte Ergebnisse.

Auf der nächsten Folie: Was das messbar bringt.`);
  }

  /* ============================================================ 08 WIRKUNG */
  {
    const s = slideLight(pres, { kicker: 'Wirkung', title: 'Was das messbar bringt' });
    const cx = G.M, cw = colW(8);
    card(s, pres, { x: cx, y: 1.74, w: cw, h: 4.62 });
    chartTitle(s, { x: cx + 0.34, y: 1.98, w: cw - 0.68, text: 'Berichtete Effektgrößen aus Studien und Unternehmensangaben', sub: 'Angaben in Prozent · Richtung der Veränderung steht in der Beschriftung' });
    s.addChart(pres.ChartType.bar, [{
      name: 'Effektgröße',
      labels: ['Umsatz Personalisierung (steigt)', 'Lagerbestände (sinken)', 'Prognosefehler (sinkt)', 'Fehlbestände (sinken)', 'Content-Performance (steigt)', 'Bearbeitungszeit Service (sinkt)'],
      values: [15, 30, 50, 65, 70, 82],
    }], chartOpts({
      x: cx + 0.14, y: 2.54, w: cw - 0.40, h: 3.58, barDir: 'bar', barGapWidthPct: 55,
      chartColors: [C.primary, C.secondary, C.secondary, C.accent, C.primary, C.accent],
      valAxisMaxVal: 100, valAxisMinVal: 0, valAxisHidden: true, valGridLine: { style: 'none' },
      dataLabelPosition: 'outEnd', dataLabelFontSize: 12, dataLabelFormatCode: '0" %"',
      catAxisLabelFontSize: 10.5,
    }));
    const bx = colX(8), bw = colW(4);
    card(s, pres, { x: bx, y: 1.74, w: bw, h: 2.28, fill: C.ink, line: null });
    badge(s, pres, { x: bx + 0.30, y: 2.02, iconUri: I['LuTarget'], fill: C.accentDark });
    s.addText('So lesen Sie die Grafik', { ...T.cardHead, x: bx + 0.30, y: 2.60, w: bw - 0.60, h: 0.30, color: C.white, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('Die Balkenlänge zeigt die Größe des Effekts, nicht seine Richtung. Ob ein Wert steigt oder sinkt, steht in der Beschriftung.', {
      ...T.small, x: bx + 0.30, y: 2.96, w: bw - 0.60, h: 0.92, color: C.inkSoft, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });
    card(s, pres, { x: bx, y: 4.14, w: bw, h: 2.22 });
    badge(s, pres, { x: bx + 0.30, y: 4.42, iconUri: I['LuTriangleAlert'], fill: C.accent });
    s.addText('Nicht addierbar', { ...T.cardHead, x: bx + 0.30, y: 5.00, w: bw - 0.60, h: 0.30, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('Die Werte stammen aus verschiedenen Studien und Unternehmen mit unterschiedlichen Ausgangslagen. Sie zeigen Größenordnungen, keine Garantien.', {
      ...T.small, x: bx + 0.30, y: 5.36, w: bw - 0.60, h: 0.92, color: C.mutedFg, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });
    foot(s, 'Personalisierung, Lagerbestände, Prognosefehler, Fehlbestände: ' + FN.mckGenai + '  ·  Content-Performance: ' + FN.zalando + '  ·  Bearbeitungszeit: ' + FN.klarna); pageNo(s, 8, TOTAL);
    s.addNotes(
`Jetzt wird es konkret. Das sind berichtete Effektgrößen aus Studien und aus Unternehmensangaben.

Von unten nach oben: Personalisierung hebt den Umsatz um bis zu 15 Prozent. Lagerbestände sinken um bis zu 30 Prozent, weil besser vorhergesagt wird, was gebraucht wird. Prognosefehler sinken um bis zu 50 Prozent. Fehlbestände — also "leider ausverkauft" — um bis zu 65 Prozent.

Oben die beiden größten Hebel: Content-Performance plus 70 Prozent bei Zalando. Und der Spitzenreiter: Die Bearbeitungszeit im Kundenservice sinkt um 82 Prozent — bei Klarna von elf Minuten auf unter zwei.

Zwei Warnhinweise, die ich ausdrücklich betone — die stehen auch rechts auf der Folie:

Erstens: Die Balkenlänge zeigt die Größe des Effekts, nicht die Richtung. Manche Werte steigen, manche sinken. Das steht jeweils in der Beschriftung.

Zweitens: Diese Zahlen darf man nicht addieren. Sie kommen aus unterschiedlichen Unternehmen mit unterschiedlichen Ausgangslagen. Sie zeigen Größenordnungen, keine Garantien.`);
  }

  /* ============================================================ 09 AMAZON */
  {
    const s = slideLight(pres, { kicker: 'Praxisbeispiel 1 von 3', title: 'Amazon Rufus: der Assistent im Suchfeld' });
    const cx = G.M, cw = colW(6);
    card(s, pres, { x: cx, y: 1.74, w: cw, h: 4.62 });
    chartTitle(s, { x: cx + 0.34, y: 1.98, w: cw - 0.68, text: 'Wahrscheinlichkeit eines Kaufabschlusses', sub: 'Indexwert · Einkaufsvorgänge ohne Assistent = 100' });
    s.addChart(pres.ChartType.bar, [{ name: 'Index', labels: ['ohne Rufus', 'mit Rufus'], values: [100, 160] }],
      chartOpts({
        x: cx + 0.18, y: 2.58, w: cw - 0.44, h: 3.52, barDir: 'col', barGapWidthPct: 130,
        chartColors: [C.tertiary, C.primary],
        valAxisMaxVal: 180, valAxisMinVal: 0, valAxisMajorUnit: 45,
        dataLabelPosition: 'outEnd', dataLabelFontSize: 15, dataLabelFormatCode: '0',
        catAxisLabelFontSize: 12,
      }));
    const bx = colX(6), bw = colW(6);
    card(s, pres, { x: bx, y: 1.74, w: bw, h: 2.14, fill: C.ink, line: null });
    s.addText('12 Mrd. $', { ...T.statBig, fontSize: 44, x: bx + 0.34, y: 2.02, w: bw - 0.68, h: 0.72, color: C.white, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('zusätzlicher annualisierter Umsatz im Jahr 2025 · über 300 Mio. Nutzerinnen und Nutzer', {
      ...T.body, x: bx + 0.34, y: 2.82, w: bw - 0.68, h: 0.80, color: C.inkSoft, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.22 });
    card(s, pres, { x: bx, y: 4.04, w: bw, h: 2.32 });
    badge(s, pres, { x: bx + 0.34, y: 4.32, iconUri: I['LuSearch'] });
    s.addText('Was der Assistent tut', { ...T.cardHead, x: bx + 0.98, y: 4.38, w: bw - 1.32, h: 0.32, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText([
      { text: 'beantwortet Produktfragen im Dialog und vergleicht Alternativen', options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
      { text: 'beobachtet Preise und kauft auf Wunsch selbstständig beim Wunschpreis', options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
      { text: 'kauft über „Buy for Me" inzwischen auch in fremden Shops ein', options: { bullet: true } },
    ], { ...T.body, x: bx + 0.34, y: 4.86, w: bw - 0.68, h: 1.36, color: C.mutedFg, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });
    foot(s, FN.amazon); pageNo(s, 9, TOTAL);
    s.addNotes(
`Erstes Praxisbeispiel — und die Zahl vom Anfang, jetzt eingeordnet.

Die Grafik links ist der Kern: Wer Rufus benutzt, kauft mit rund 60 Prozent höherer Wahrscheinlichkeit. Ich habe das als Index dargestellt — ohne Assistent 100, mit Assistent 160.

Warum das so wirkt: Rufus beantwortet Fragen im Dialog, statt nur eine Trefferliste auszuspucken. Er vergleicht, er begründet, er beobachtet Preise und kauft auf Wunsch selbstständig, sobald der Wunschpreis erreicht ist.

Der strategisch spannendste Punkt steht ganz unten: Mit "Buy for Me" kauft Rufus inzwischen auch in fremden Shops. Amazon wird damit zur Einkaufsebene über dem eigenen Sortiment hinaus.

Frage an die Runde, wenn Zeit ist: Was bedeutet das für einen Händler, der nicht Amazon ist? Antwort: Er muss dafür sorgen, dass eine Maschine sein Produkt versteht — nicht nur ein Mensch.`);
  }

  /* ============================================================ 10 ZALANDO */
  {
    const s = slideLight(pres, { kicker: 'Praxisbeispiel 2 von 3', title: 'Zalando: KI entlang der gesamten Kette' });
    const tiles = [
      { big: '−8 %',   t: 'größenbedingte Retouren durch Size & Fit — auf Basis der Körpermaße von über einer Million Kundinnen und Kunden' },
      { big: '+13 %',  t: 'Artikel im Warenkorb durch KI-gestütztes Matching von Stil und Person' },
      { big: '6 Mio.', t: 'Nutzerinnen und Nutzer des Zalando Assistant — viermal so viele wie im Vorjahr' },
      { big: '90 %',   t: 'der Produktinhalte werden KI-erzeugt — innerhalb eines Jahres von nahezu null' },
      { big: '+70 %',  t: 'Content-Performance; Kampagnen entstehen in Tagen statt in sechs Wochen' },
      { big: '+22 Pp', t: 'genauere Lieferzusage an Kundinnen und Kunden durch KI in der Lieferkette' },
    ];
    tiles.forEach((t, i) => {
      const col = (i % 3) * 4, row = Math.floor(i / 3);
      const x = colX(col), w = colW(4), y = 1.76 + row * 2.06;
      card(s, pres, { x, y, w, h: 1.86 });
      s.addText(t.big, { ...T.statBig, fontSize: 34, x: x + 0.30, y: y + 0.18, w: w - 0.60, h: 0.56, color: i % 2 === 0 ? C.primary : C.accent, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(t.t, { ...T.small, x: x + 0.30, y: y + 0.78, w: w - 0.60, h: 0.94, color: C.mutedFg, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.22 });
    });
    card(s, pres, { x: G.M, y: 5.88, w: G.CW, h: 0.56, fill: C.muted, line: C.border, shadow: false });
    s.addText('Rahmen des Geschäftsjahres 2025: 12,3 Mrd. € Umsatz (+16,8 %) und 591 Mio. € bereinigtes EBIT. Das Unternehmen führt die Beschleunigung ausdrücklich auf skalierte KI zurück.', {
      ...T.small, x: G.M + 0.30, y: 5.90, w: G.CW - 0.60, h: 0.52, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    foot(s, FN.zalando); pageNo(s, 10, TOTAL);
    s.addNotes(
`Zweites Beispiel — und das interessantere für den deutschen Markt, weil es ein europäisches Unternehmen ist und weil KI hier nicht an einer Stelle sitzt, sondern entlang der ganzen Kette.

Oben links die Zahl mit dem größten Hebel für Nachhaltigkeit und Marge zugleich: 8 Prozent weniger größenbedingte Retouren. Grundlage sind echte Körpermaße von über einer Million Kundinnen und Kunden. Jede vermiedene Retoure spart Versand, Aufbereitung und CO2.

Plus 13 Prozent Artikel im Warenkorb durch besseres Matching. Sechs Millionen Menschen nutzen den Assistenten, viermal so viele wie im Vorjahr.

Unten die Betriebsseite: 90 Prozent der Produktinhalte sind inzwischen KI-erzeugt — von nahezu null in einem Jahr. Die Content-Performance ist dabei um 70 Prozent gestiegen, Kampagnen entstehen in Tagen statt in sechs Wochen. Und die Lieferzusage ist um 22 Prozentpunkte genauer.

Der Rahmen unten: 12,3 Milliarden Euro Umsatz, plus 16,8 Prozent. Zalando selbst führt die Beschleunigung auf skalierte KI zurück.

Wichtig für die Einordnung: Das ist Unternehmenskommunikation aus dem Geschäftsbericht. Die Richtung ist belegt, die Kausalität behauptet das Unternehmen selbst.`);
  }

  /* ============================================================ 11 SHOPIFY / KLARNA */
  {
    const s = slideLight(pres, { kicker: 'Praxisbeispiel 3 von 3', title: 'Shopify skaliert — und Klarna zeigt die Grenze' });
    const lx = G.M, lw = colW(6), rx = colX(6);
    card(s, pres, { x: lx, y: 1.74, w: lw, h: 3.92 });
    badge(s, pres, { x: lx + 0.34, y: 2.02, iconUri: I['LuPackage'] });
    s.addText('Shopify', { ...T.cardHead, fontSize: 16, x: lx + 0.98, y: 2.08, w: lw - 1.32, h: 0.32, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('15-fach', { ...T.statBig, fontSize: 38, x: lx + 0.34, y: 2.54, w: lw - 0.68, h: 0.60, color: C.primary, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('wuchsen KI-zugeordnete Bestellungen zwischen Januar 2025 und Januar 2026.', {
      ...T.body, x: lx + 0.34, y: 3.16, w: lw - 0.68, h: 0.54, color: C.mutedFg, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });
    s.addText([
      { text: 'Shopify Magic schreibt Produkttexte, Betreffzeilen und Bildhintergründe.', options: { bullet: true, breakLine: true, paraSpaceAfter: 9 } },
      { text: 'Sidekick untersucht Umsatzeinbrüche über Marketing, Lager und Kundensegmente hinweg.', options: { bullet: true, breakLine: true, paraSpaceAfter: 9 } },
      { text: 'Agentic Storefronts machen Shops in ChatGPT und Perplexity direkt kaufbar.', options: { bullet: true } },
    ], { ...T.body, x: lx + 0.34, y: 3.74, w: lw - 0.68, h: 1.82, color: C.mutedFg, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });

    card(s, pres, { x: rx, y: 1.74, w: lw, h: 3.92, fill: 'FEF6E7', line: 'F3D9A4' });
    badge(s, pres, { x: rx + 0.34, y: 2.02, iconUri: I['LuHeadset'], fill: C.accent });
    s.addText('Klarna', { ...T.cardHead, fontSize: 16, x: rx + 0.98, y: 2.08, w: lw - 1.32, h: 0.32, color: '7C4A06', isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('11 → 2 Min.', { ...T.statBig, fontSize: 38, x: rx + 0.34, y: 2.54, w: lw - 0.68, h: 0.60, color: C.accent, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('Bearbeitungszeit im Kundenservice — zwei Drittel aller Chats übernahm die KI.', {
      ...T.body, x: rx + 0.34, y: 3.16, w: lw - 0.68, h: 0.54, color: '7C4A06', isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });
    s.addText([
      { text: 'Der Assistent leistete die Arbeit von rund 700 Vollzeitkräften.', options: { bullet: true, breakLine: true, paraSpaceAfter: 9 } },
      { text: '2025 räumte der Vorstandschef öffentlich ein: Kosten waren das dominierende Kriterium, die Qualität litt darunter.', options: { bullet: true, breakLine: true, paraSpaceAfter: 9 } },
      { text: 'Heute gilt: KI zuerst, Mensch jederzeit erreichbar.', options: { bullet: true } },
    ], { ...T.body, x: rx + 0.34, y: 3.74, w: lw - 0.68, h: 1.82, color: '7C4A06', isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.2 });

    card(s, pres, { x: G.M, y: 5.82, w: G.CW, h: 0.62, fill: C.ink, line: null });
    s.addText('Die Lektion: KI senkt Kosten sehr schnell. Qualität bleibt eine Entscheidung — sie stellt sich nicht von selbst mit ein.', {
      ...T.body, bold: true, x: G.M + 0.32, y: 5.84, w: G.CW - 0.64, h: 0.58, color: C.white, isTextBox: true, margin: 0, valign: 'middle' });
    foot(s, FN.shopify + '  ·  ' + FN.klarna); pageNo(s, 11, TOTAL);
    s.addNotes(
`Zwei Beispiele auf einer Folie, weil sie zusammengehören: eines für die Chance, eines für die Grenze.

Links Shopify — der Blick auf die kleinen Händler. KI-zugeordnete Bestellungen sind zwischen Januar 2025 und Januar 2026 um das Fünfzehnfache gewachsen. Shopify Magic schreibt Produkttexte und Betreffzeilen, Sidekick analysiert selbstständig, warum der Umsatz eingebrochen ist. Und Agentic Storefronts machen Shops direkt in ChatGPT, Perplexity und Copilot kaufbar. Das ist der Punkt: Werkzeuge, die vor drei Jahren nur Konzerne hatten, liegen jetzt beim Ein-Personen-Shop.

Rechts Klarna — und das ist bewusst ein unbequemes Beispiel. Die Zahlen sind spektakulär: Bearbeitungszeit von elf auf unter zwei Minuten, zwei Drittel aller Chats von der KI übernommen, die Arbeit von rund 700 Vollzeitkräften.

Und dann kam die Korrektur. 2025 hat der Vorstandschef öffentlich eingeräumt: Die Kosten waren das dominierende Kriterium, und die Qualität hat darunter gelitten. Klarna ist zurückgerudert — heute KI zuerst, aber ein Mensch jederzeit erreichbar.

Der Satz unten ist das, was ich Ihnen von dieser Folie mitgeben möchte: KI senkt Kosten sehr schnell. Qualität bleibt eine Entscheidung.`);
  }

  /* ============================================================ 12 CHANCEN / RISIKEN */
  {
    const s = slideLight(pres, { kicker: 'Abwägung', title: 'Chancen und Risiken — nüchtern betrachtet' });
    const lx = G.M, lw = colW(6), rx = colX(6);
    s.addText('CHANCEN', { ...T.kicker, x: lx, y: 1.70, w: lw, h: 0.26, color: C.primary, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('RISIKEN', { ...T.kicker, x: rx, y: 1.70, w: lw, h: 0.26, color: C.accent, isTextBox: true, margin: 0, valign: 'middle' });
    const chancen = [
      { ic: 'LuTrendingUp', h: 'Werkzeuge für alle', t: 'Kleine Händler bekommen Fähigkeiten, die vorher nur Konzerne bezahlen konnten.' },
      { ic: 'LuHeadset',    h: 'Service ohne Warteschlange', t: 'Beratung rund um die Uhr, in jeder Sprache, sofort.' },
      { ic: 'LuTruck',      h: 'Weniger Verschwendung', t: 'Weniger Retouren, weniger Fehlbestände, weniger Überproduktion.' },
    ];
    const risiken = [
      { ic: 'LuUsers',   h: 'Berufe im Umbruch', t: 'Rund 1,6 Mio. Arbeitsplätze in Bewegung. Tätigkeiten verschieben sich schneller als Qualifikationen.' },
      { ic: 'LuNetwork', h: 'Plattformabhängigkeit', t: '56,7 % des Onlineumsatzes laufen über Marktplätze. Wer dort nicht gefunden wird, findet nicht statt.' },
      { ic: 'LuLock',    h: 'Daten und Vertrauen', t: 'Personalisierung braucht persönliche Daten. Erst 6,3 % kaufen heute vollständig über eine KI.' },
    ];
    const draw = (arr, x, accent) => arr.forEach((r, i) => {
      const y = 2.06 + i * 1.18;
      card(s, pres, { x, y, w: lw, h: 1.02 });
      badge(s, pres, { x: x + 0.28, y: y + 0.29, iconUri: I[r.ic], fill: accent, size: 0.40 });
      s.addText(r.h, { ...T.cardHead, fontSize: 13, x: x + 0.86, y: y + 0.14, w: lw - 1.16, h: 0.28, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(r.t, { ...T.small, fontSize: 10.5, x: x + 0.86, y: y + 0.44, w: lw - 1.16, h: 0.50, color: C.mutedFg, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.15 });
    });
    draw(chancen, lx, C.primary);
    draw(risiken, rx, C.accent);

    card(s, pres, { x: G.M, y: 5.66, w: G.CW, h: 0.90, fill: C.ink, line: null });
    badge(s, pres, { x: G.M + 0.26, y: 5.89, iconUri: I['LuScale'], fill: C.accentDark, size: 0.44 });
    s.addText('EU AI ACT\nFRISTEN', { ...T.kicker, fontSize: 9.5, x: G.M + 0.86, y: 5.93, w: 1.60, h: 0.38, color: C.accentDark, isTextBox: true, margin: 0, valign: 'middle', lineSpacingMultiple: 1.12 });
    const steps = [
      { d: '02.08.2026', t: 'Transparenzpflichten: Chatbots müssen sich als KI zu erkennen geben, KI-Inhalte werden gekennzeichnet.' },
      { d: '02.12.2027', t: 'Pflichten für Hochrisiko-KI nach Anhang III (verschoben durch den Digital Omnibus).' },
      { d: '02.08.2028', t: 'In Produkte eingebettete Hochrisiko-KI.' },
    ];
    steps.forEach((st, i) => {
      const x = 3.22 + i * 3.16, w = 3.00;
      s.addText(st.d, { ...T.small, bold: true, fontSize: 10.5, x, y: 5.82, w, h: 0.22, color: C.white, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(st.t, { ...T.footnote, fontSize: 8.5, x, y: 6.04, w, h: 0.46, color: C.inkSoft, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.12 });
    });
    foot(s, FN.iab + '  ·  ' + FN.hde + '  ·  ' + FN.bevh + '  ·  ' + FN.aiact); pageNo(s, 12, TOTAL);
    s.addNotes(
`Jetzt die Abwägung — und ich möchte, dass beide Spalten gleich ernst genommen werden.

Chancen, links: Erstens werden Werkzeuge demokratisiert. Was vor drei Jahren ein Konzernbudget brauchte, liegt heute im Standardtarif eines Shopsystems. Zweitens Service ohne Warteschlange, rund um die Uhr, in jeder Sprache. Drittens — und das wird oft übersehen — weniger Verschwendung: weniger Retouren, weniger Fehlbestände, weniger Überproduktion. Das ist ein Umweltargument, nicht nur ein Kostenargument.

Risiken, rechts: Berufe im Umbruch — rund 1,6 Millionen Arbeitsplätze in Bewegung. Nicht weg, aber anders. Die Tätigkeiten verschieben sich schneller, als Qualifikationen nachwachsen.

Plattformabhängigkeit: 56,7 Prozent über Marktplätze. Wenn die KI eines Marktplatzes entscheidet, welches Produkt sie empfiehlt, entscheidet sie über Ihr Geschäft mit.

Daten und Vertrauen: Personalisierung braucht persönliche Daten. Und die Kundschaft ist zurückhaltender, als die Branche gerne hätte — erst 6,3 Prozent kaufen vollständig über eine KI.

Unten die Regulierung, bitte als Kalender lesen: Ab dem 2. August 2026 gelten die Transparenzpflichten. Ein Chatbot muss sagen, dass er eine Maschine ist. Die schärferen Hochrisiko-Pflichten wurden auf Dezember 2027 verschoben, eingebettete Systeme folgen 2028.`);
  }

  /* ============================================================ 13 AUSBLICK 2030 */
  {
    const s = slideLight(pres, { kicker: 'Ausblick', title: 'Was bis 2030 auf dem Tisch liegt' });
    const cx = G.M, cw = colW(7);
    card(s, pres, { x: cx, y: 1.74, w: cw, h: 4.62 });
    chartTitle(s, { x: cx + 0.34, y: 1.98, w: cw - 0.68, text: 'Weltweiter Umsatz im Jahr 2030', sub: 'in Billionen US-Dollar · sämtlich Prognosen, keine Ist-Werte' });
    s.addChart(pres.ChartType.bar, [{ name: '2030', labels: ['Agentic Commerce\nuntere Prognose', 'Agentic Commerce\nobere Prognose', 'Globaler\nE-Commerce'], values: [3, 5, 7] }],
      chartOpts({
        x: cx + 0.18, y: 2.56, w: cw - 0.44, h: 3.56, barDir: 'col', barGapWidthPct: 95,
        chartColors: [C.secondary, C.primary, C.accent],
        valAxisMaxVal: 8, valAxisMinVal: 0, valAxisMajorUnit: 2,
        dataLabelPosition: 'outEnd', dataLabelFontSize: 14, dataLabelFormatCode: '0',
        catAxisLabelFontSize: 10.5,
      }));
    const bx = colX(7), bw = colW(5);
    card(s, pres, { x: bx, y: 1.74, w: bw, h: 1.42 });
    badge(s, pres, { x: bx + 0.30, y: 2.19, iconUri: I['LuUsers'] });
    s.addText('4,1 Mrd.', { ...T.statMid, fontSize: 24, x: bx + 0.94, y: 1.96, w: bw - 1.24, h: 0.38, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('Menschen kaufen 2030 online — eine Durchdringung von 60,1 %.', { ...T.small, x: bx + 0.94, y: 2.36, w: bw - 1.24, h: 0.62, color: C.mutedFg, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.18 });

    card(s, pres, { x: bx, y: 3.34, w: bw, h: 1.42 });
    badge(s, pres, { x: bx + 0.30, y: 3.79, iconUri: I['LuShieldCheck'] });
    s.addText('21 → 39 Mrd. $', { ...T.statMid, fontSize: 24, x: bx + 0.94, y: 3.56, w: bw - 1.24, h: 0.38, color: C.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('Ausgaben für Betrugserkennung, 2025 bis 2030 — ein Plus von 85 %.', { ...T.small, x: bx + 0.94, y: 3.96, w: bw - 1.24, h: 0.62, color: C.mutedFg, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.18 });

    card(s, pres, { x: bx, y: 4.94, w: bw, h: 1.42, fill: C.ink, line: null });
    badge(s, pres, { x: bx + 0.30, y: 5.39, iconUri: I['LuBot'], fill: C.accentDark });
    s.addText('Der eigentliche Bruch', { ...T.cardHead, fontSize: 13.5, x: bx + 0.94, y: 5.16, w: bw - 1.24, h: 0.32, color: C.white, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText('Wenn Maschinen einkaufen, ist der Adressat von Marketing nicht mehr nur der Mensch.', { ...T.small, x: bx + 0.94, y: 5.52, w: bw - 1.24, h: 0.62, color: C.inkSoft, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.18 });
    foot(s, FN.mckAgentic + '  ·  ' + FN.statista + '  ·  ' + FN.juniper); pageNo(s, 13, TOTAL);
    s.addNotes(
`Blick nach vorn — und alle Zahlen hier sind ausdrücklich Prognosen.

Die Grafik zeigt die Größenordnung, um die es geht: Der gesamte globale E-Commerce wird 2030 bei rund sieben Billionen Dollar erwartet. Und McKinsey schätzt, dass drei bis fünf Billionen davon über Agentic Commerce laufen könnten — also über Einkäufe, die eine KI im Auftrag eines Menschen anbahnt oder abschließt.

Das ist die Kernaussage der Folie: Ein sehr großer Teil des Onlinehandels könnte in wenigen Jahren nicht mehr über eine Website laufen, sondern über einen Assistenten.

Rechts zwei Randgrößen: 4,1 Milliarden Menschen kaufen 2030 online, 60 Prozent der Weltbevölkerung. Und die Ausgaben für Betrugserkennung steigen von 21 auf 39 Milliarden Dollar — weil Betrüger dieselben Werkzeuge nutzen. Deepfakes und synthetische Identitäten sind der Grund.

Der dunkle Kasten unten rechts ist der Satz, über den es sich zu diskutieren lohnt: Wenn Maschinen einkaufen, ist der Adressat von Marketing nicht mehr nur der Mensch. Produktdaten müssen dann nicht mehr schön sein, sondern maschinenlesbar und eindeutig.

Ehrlich bleiben: Heute kaufen 6,3 Prozent vollständig per KI. Zwischen dieser Zahl und den Prognosen liegt viel Weg.`);
  }

  /* ============================================================ 14 FAZIT */
  {
    const s = slideDark(pres, { kicker: 'Fazit', title: 'Drei Sätze zum Mitnehmen' });
    const items = [
      'KI ist in der Breite angekommen: Erstmals nutzt mit 57 % die Mehrheit der Unternehmen in Deutschland KI — 2024 waren es erst 20 %.',
      'Im E-Commerce zahlt sich das messbar aus: 12 Mrd. $ zusätzlicher Umsatz über einen einzigen Assistenten bei Amazon, 8 % weniger größenbedingte Retouren bei Zalando.',
      'Der Engpass ist nicht die Technik, sondern Vertrauen, Daten und Regeln — erst 6,3 % kaufen vollständig per KI, und ab dem 2. August 2026 muss sich jeder Chatbot in der EU als KI zu erkennen geben.',
    ];
    items.forEach((t, i) => {
      const y = 1.86 + i * 1.52;
      card(s, pres, { x: G.M, y, w: G.CW, h: 1.28, fill: '24438F', line: '3B62C9', shadow: false });
      s.addText(String(i + 1).padStart(2, '0'), { ...T.statBig, fontSize: 38, x: G.M + 0.38, y: y + 0.30, w: 0.95, h: 0.68, color: C.accentDark, isTextBox: true, margin: 0, valign: 'middle' });
      s.addText(t, { ...T.lead, fontSize: 15, x: G.M + 1.48, y: y + 0.20, w: G.CW - 1.92, h: 0.90, color: C.white, isTextBox: true, margin: 0, valign: 'middle', lineSpacingMultiple: 1.28 });
    });
    foot(s, FN.bitkomKi + '  ·  ' + FN.amazon + '  ·  ' + FN.zalando + '  ·  ' + FN.bevh + '  ·  ' + FN.aiact, true);
    pageNo(s, 14, TOTAL, true);
    s.addNotes(
`Zum Schluss drei Sätze — mehr braucht es nicht.

Erstens: KI ist in der Breite angekommen. Erstmals nutzt die Mehrheit der deutschen Unternehmen KI, 57 Prozent. 2024 waren es 20. Das ist keine Zukunftsfrage mehr.

Zweitens: Im E-Commerce zahlt sich das messbar aus. Zwölf Milliarden Dollar Zusatzumsatz über einen einzigen Assistenten bei Amazon. Acht Prozent weniger größenbedingte Retouren bei Zalando. Das sind keine Pilotprojekte, das steht in Geschäftsberichten.

Drittens — und das ist der Satz, der am wichtigsten ist: Der Engpass ist nicht die Technik. Er liegt bei Vertrauen, Daten und Regeln. Erst 6,3 Prozent der Kundschaft kauft vollständig per KI. Und ab dem 2. August 2026 muss sich in der EU jeder Chatbot als KI zu erkennen geben.

Wer heute anfängt, fängt nicht beim Modell an. Er fängt bei seinen Produktdaten an.

Vielen Dank — Fragen gerne jetzt. Die Quellen stehen auf der nächsten Folie.`);
  }

  /* ============================================================ 15 QUELLEN */
  {
    // Kurzfassungen: jede Zeile muss einzeilig passen, sonst kollidiert sie mit der URL darunter.
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
    const s = slideLight(pres, { kicker: 'Quellen', title: 'Quellen und Abrufdatum' });
    s.addText(`Alle Internetquellen zuletzt abgerufen am ${ABRUF}. Wo eine Zahl aus einer Berichterstattung über eine Primärquelle stammt, ist das ausgewiesen.`, {
      ...T.small, x: G.M, y: 1.60, w: G.CW, h: 0.26, color: C.mutedFg, isTextBox: true, margin: 0, valign: 'middle' });
    const lw = colW(6), rowH = 0.52, top = 1.94;
    SOURCES.forEach((src, i) => {
      const x = i < 8 ? G.M : colX(6);
      const y = top + (i % 8) * rowH;
      s.addText([
        { text: String(i + 1).padStart(2, '0') + '  ', options: { bold: true, color: C.accent } },
        { text: ORG[src.id] + ': ', options: { bold: true, color: C.ink } },
        { text: SHORT[src.id], options: { color: C.ink } },
      ], { fontFace: F.body, fontSize: 8.5, x, y, w: lw, h: 0.22, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.0 });
      s.addText(src.url, { fontFace: F.body, fontSize: 7.5, x: x + 0.28, y: y + 0.23, w: lw - 0.28, h: 0.28, color: C.secondary, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.05 });
    });
    card(s, pres, { x: G.M, y: 6.16, w: G.CW, h: 0.48, fill: C.muted, line: C.border, shadow: false });
    s.addText('Grafiken: Sämtliche Diagramme wurden für diese Präsentation aus den oben genannten Daten selbst erstellt (native PowerPoint-Diagramme). Icons: Lucide Icons, ISC-Lizenz. Titelgrafik: eigene prozedurale Erzeugung. Es wurden keine Stockfotos und keine fremden Diagramm-Screenshots verwendet.', {
      ...T.footnote, fontSize: 8, x: G.M + 0.26, y: 6.18, w: G.CW - 0.52, h: 0.44, color: C.ink, isTextBox: true, margin: 0, valign: 'middle', lineSpacingMultiple: 1.12 });
    pageNo(s, 15, TOTAL);
    s.addNotes(
`Quellenfolie — bitte stehen lassen, solange Fragen kommen.

Grundsatz für diese Präsentation: Jede Zahl auf jeder Folie hat eine Fußnote, und jede Fußnote löst sich hier auf, mit vollständiger URL und Abrufdatum.

Zwei Hinweise zur Sorgfalt:
Erstens sind Unternehmensangaben — Amazon, Zalando, Shopify, Klarna — als solche gekennzeichnet. Das ist Unternehmenskommunikation, keine unabhängige Prüfung.
Zweitens sind Prognosen überall dort ausdrücklich als Prognose beschriftet, wo sie eine sind. Die Säule für 2026 im deutschen Onlinehandel habe ich selbst aus der HDE-Wachstumsprognose gerechnet; das steht in der Fußnote der Folie.

Unten: Alle Diagramme sind aus den recherchierten Daten selbst erstellt, es wurden keine fremden Charts abfotografiert und keine Stockfotos verwendet.`);
  }

  await pres.writeFile({ fileName: 'KI-und-E-Commerce.pptx' });
  console.log('Fertig: KI-und-E-Commerce.pptx');
})().catch((e) => { console.error('FEHLER:', e); process.exit(1); });
