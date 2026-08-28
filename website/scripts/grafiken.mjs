/**
 * Erzeugt die Grafiken für die Bildstellen, die keine Fotografie brauchen.
 *
 * Statt Stockfotos entstehen hier Schemazeichnungen: Sie zeigen den Ablauf,
 * um den es auf der jeweiligen Seite geht. Für eine Automatisierungs-Website
 * trägt das mehr als ein Bild von einem Schreibtisch.
 *
 * Aufruf:  node scripts/grafiken.mjs
 * Ergebnis: PNG-Dateien in public/bilder/
 */

import { chromium } from '/tmp/claude-0/-home-user-Youman-automation/3c7ef82f-1876-5b72-bb55-e6a9cf042196/scratchpad/node_modules/playwright/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const AUS = path.join(process.cwd(), 'public', 'bilder')

const TINTE = '#0a0a0a'
const PAPIER = '#ffffff'
const LINIE = '#d0d0d0'
const GRAU = '#6b6b6b'

/** Gemeinsame Grundlage: Raster, Typografie, Farben. */
const rahmen = (breite, hoehe, inhalt, dunkel = false) => `<!doctype html>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600&family=Source+Sans+3:wght@400;600&display=swap">
<style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: ${breite}px; height: ${hoehe}px;
    background: ${dunkel ? TINTE : PAPIER};
    font-family: 'Source Sans 3', system-ui, sans-serif;
    color: ${dunkel ? PAPIER : TINTE};
    overflow: hidden;
    position: relative;
  }
  /* Feines Raster wie auf einem Satzspiegel */
  body::before {
    content: ''; position: absolute; inset: 0;
    background-image:
      linear-gradient(to right, ${dunkel ? 'rgba(255,255,255,.06)' : 'rgba(10,10,10,.05)'} 1px, transparent 1px),
      linear-gradient(to bottom, ${dunkel ? 'rgba(255,255,255,.06)' : 'rgba(10,10,10,.05)'} 1px, transparent 1px);
    background-size: 48px 48px;
  }
  svg { position: relative; display: block; }
  .kasten { fill: ${dunkel ? '#161616' : PAPIER}; stroke: ${dunkel ? '#3a3a3a' : TINTE}; stroke-width: 1.5; }
  .kasten-voll { fill: ${dunkel ? PAPIER : TINTE}; }
  .pfad { stroke: ${dunkel ? '#8a8a8a' : GRAU}; stroke-width: 1.5; fill: none; }
  .pfad-stark { stroke: ${dunkel ? PAPIER : TINTE}; stroke-width: 2; fill: none; }
  .beschriftung { font: 600 15px 'Source Sans 3', sans-serif; fill: ${dunkel ? PAPIER : TINTE}; }
  .beschriftung-klein { font: 400 13px 'Source Sans 3', sans-serif; fill: ${dunkel ? '#a8a8a8' : GRAU}; }
  .beschriftung-invers { font: 600 15px 'Source Sans 3', sans-serif; fill: ${dunkel ? TINTE : PAPIER}; }
  .titel { font: 600 26px 'Newsreader', Georgia, serif; fill: ${dunkel ? PAPIER : TINTE}; }
  .marke { font: 600 12px 'Source Sans 3', sans-serif; letter-spacing: .14em; text-transform: uppercase; fill: ${dunkel ? '#a8a8a8' : GRAU}; }
</style>
${inhalt}
`

/** Ein beschrifteter Kasten. */
const kasten = (x, y, b, h, titel, unter, voll = false) => `
  <rect class="kasten ${voll ? 'kasten-voll' : ''}" x="${x}" y="${y}" width="${b}" height="${h}" rx="2"/>
  <text class="${voll ? 'beschriftung-invers' : 'beschriftung'}" x="${x + 20}" y="${y + (unter ? 32 : h / 2 + 5)}">${titel}</text>
  ${unter ? `<text class="beschriftung-klein" x="${x + 20}" y="${y + 54}">${unter}</text>` : ''}
`

/** Pfeil von A nach B. */
const pfeil = (x1, y1, x2, y2, stark = false) => `
  <path class="${stark ? 'pfad-stark' : 'pfad'}" d="M ${x1} ${y1} L ${x2 - 9} ${y2}"/>
  <path class="${stark ? 'pfad-stark' : 'pfad'}" d="M ${x2 - 14} ${y2 - 5} L ${x2 - 7} ${y2} L ${x2 - 14} ${y2 + 5}"/>
`

const grafiken = [
  {
    datei: 'leistungAutomation.png',
    breite: 1200, hoehe: 900,
    inhalt: `<svg width="1200" height="900" viewBox="0 0 1200 900">
      <text class="marke" x="80" y="90">Ablauf</text>
      <text class="titel" x="80" y="132">Auslöser, Regel, Ergebnis</text>
      ${kasten(80, 220, 300, 96, 'Auslöser', 'Bestellung, E-Mail, Zeitplan')}
      ${pfeil(380, 268, 470, 268, true)}
      ${kasten(470, 220, 300, 96, 'Regelwerk', 'Prüfen, zuordnen, umformen', true)}
      ${pfeil(770, 268, 860, 268, true)}
      ${kasten(860, 220, 260, 96, 'Zielsystem', 'ERP, Shop, Lager')}
      <path class="pfad" d="M 620 316 L 620 420"/>
      ${kasten(470, 420, 300, 96, 'Fehler', 'Warteschlange und Meldung')}
      <path class="pfad" d="M 470 468 L 230 468 L 230 316"/>
      ${kasten(80, 600, 1040, 96, 'Überwachung', 'Jeder Durchlauf wird protokolliert; bleibt einer liegen, geht eine Meldung raus')}
    </svg>`,
  },
  {
    datei: 'leistungChatbot.png',
    breite: 1200, hoehe: 900,
    inhalt: `<svg width="1200" height="900" viewBox="0 0 1200 900">
      <text class="marke" x="80" y="90">Aufbau</text>
      <text class="titel" x="80" y="132">Antwort mit Beleg</text>
      ${kasten(80, 220, 280, 96, 'Frage', 'Chat, Formular, Telefon')}
      ${pfeil(360, 268, 450, 268, true)}
      ${kasten(450, 220, 300, 96, 'Suche', 'Passende Stellen finden', true)}
      ${pfeil(750, 268, 840, 268, true)}
      ${kasten(840, 220, 280, 96, 'Antwort', 'Mit Quellenangabe')}
      <path class="pfad" d="M 600 316 L 600 400"/>
      ${kasten(450, 400, 300, 96, 'Wissensbasis', 'Ihre eigenen Dokumente')}
      <path class="pfad-stark" d="M 980 316 L 980 560 L 750 560"/>
      ${kasten(450, 512, 300, 96, 'Übergabe', 'Bei Unsicherheit an Menschen')}
      ${kasten(80, 700, 1040, 84, 'Auswertung', 'Welche Fragen kommen, wo fehlt Wissen, wo wird eskaliert')}
    </svg>`,
  },
  {
    datei: 'leistungEcommerce.png',
    breite: 1200, hoehe: 900,
    inhalt: `<svg width="1200" height="900" viewBox="0 0 1200 900">
      <text class="marke" x="80" y="90">Kanäle</text>
      <text class="titel" x="80" y="132">Ein Bestand, alle Kanäle</text>
      ${kasten(420, 240, 360, 110, 'Führender Bestand', 'ERP oder Warenwirtschaft', true)}
      ${kasten(80, 480, 260, 88, 'Eigener Shop', '')}
      ${kasten(470, 480, 260, 88, 'Marktplatz', '')}
      ${kasten(860, 480, 260, 88, 'Weiterer Kanal', '')}
      <path class="pfad-stark" d="M 560 350 L 560 420 L 210 420 L 210 480"/>
      <path class="pfad-stark" d="M 600 350 L 600 480"/>
      <path class="pfad-stark" d="M 640 350 L 640 420 L 990 420 L 990 480"/>
      <path class="pfad" d="M 210 568 L 210 640 L 600 640 L 600 590"/>
      <path class="pfad" d="M 990 568 L 990 640 L 600 640"/>
      <text class="beschriftung-klein" x="620" y="672">Verkauf meldet zurück, der Bestand sinkt überall</text>
    </svg>`,
  },
  {
    datei: 'refMarktplatz.png',
    breite: 1600, hoehe: 900,
    inhalt: `<svg width="1600" height="900" viewBox="0 0 1600 900">
      <text class="marke" x="100" y="100">Referenzprojekt</text>
      <text class="titel" x="100" y="144">Marktplatz-Synchronisation</text>
      ${kasten(100, 280, 380, 110, 'Verkauf auf einem Kanal', 'Auslöser per Webhook')}
      ${pfeil(480, 335, 580, 335, true)}
      ${kasten(580, 280, 380, 110, 'Führender Bestand', 'Ein Stand für alle', true)}
      ${pfeil(960, 335, 1060, 335, true)}
      ${kasten(1060, 280, 440, 110, 'Alle übrigen Kanäle', 'Aktualisierung in Sekunden')}
      <path class="pfad" d="M 770 390 L 770 520"/>
      ${kasten(580, 520, 380, 110, 'Preisregeln', 'Aufschläge je Kanal')}
      ${kasten(100, 700, 1400, 96, 'Fehlgeschlagene Übertragungen', 'Warteschlange mit wachsendem Abstand, danach Meldung')}
    </svg>`,
  },
  {
    datei: 'refChatbot.png',
    breite: 1600, hoehe: 900,
    inhalt: `<svg width="1600" height="900" viewBox="0 0 1600 900">
      <text class="marke" x="100" y="100">Referenzprojekt</text>
      <text class="titel" x="100" y="144">KI-Kundenservice mit Wissensbasis</text>
      ${kasten(100, 300, 340, 110, 'Kundenanfrage', '')}
      ${pfeil(440, 355, 540, 355, true)}
      ${kasten(540, 300, 380, 110, 'Belegte Antwort', 'Aus eigenen Dokumenten', true)}
      ${pfeil(920, 355, 1020, 355, true)}
      ${kasten(1020, 300, 300, 110, 'Erledigt', '')}
      <path class="pfad-stark" d="M 730 410 L 730 540"/>
      ${kasten(540, 540, 380, 110, 'Keine Grundlage gefunden', 'Übergabe mit Verlauf')}
      ${pfeil(920, 595, 1020, 595, false)}
      ${kasten(1020, 540, 300, 110, 'Mitarbeitende', '')}
      ${kasten(100, 740, 1400, 84, 'Dashboard', 'Welche Fragen häufen sich, wo fehlt Wissen')}
    </svg>`,
  },
  {
    datei: 'refVoice.png',
    breite: 1600, hoehe: 900,
    inhalt: `<svg width="1600" height="900" viewBox="0 0 1600 900">
      <text class="marke" x="100" y="100">Referenzprojekt</text>
      <text class="titel" x="100" y="144">Sprachnotiz zu strukturierter Aufgabe</text>
      ${kasten(100, 320, 300, 110, 'Sprachnotiz', 'Unterwegs aufgenommen')}
      ${pfeil(400, 375, 480, 375, true)}
      ${kasten(480, 320, 300, 110, 'Transkription', '')}
      ${pfeil(780, 375, 860, 375, true)}
      ${kasten(860, 320, 320, 110, 'Einordnung', 'Was, wer, wie dringend', true)}
      ${pfeil(1180, 375, 1260, 375, true)}
      ${kasten(1260, 320, 240, 110, 'Aufgabe', 'Im Projekt angelegt')}
      <path class="pfad" d="M 1380 430 L 1380 560 L 250 560 L 250 430"/>
      <text class="beschriftung-klein" x="640" y="592">Kurze Rückmeldung: Missverständnisse fallen sofort auf</text>
    </svg>`,
  },
  {
    datei: 'refDrahtmueller.png',
    breite: 1600, hoehe: 900,
    inhalt: `<svg width="1600" height="900" viewBox="0 0 1600 900">
      <text class="marke" x="100" y="100">Referenzprojekt</text>
      <text class="titel" x="100" y="144">Palettenoptimierung</text>
      <text class="titel" x="100" y="330" style="font-size:96px">2.556</text>
      <text class="beschriftung-klein" x="100" y="368">aktive Palettentypen im Einsatz</text>
      ${kasten(560, 260, 340, 110, 'Auftragsdaten', 'Maße und Mengen')}
      ${pfeil(900, 315, 980, 315, true)}
      ${kasten(980, 260, 360, 110, 'Palettenlogik', 'Standard oder Sonderbau', true)}
      <path class="pfad-stark" d="M 1160 370 L 1160 470"/>
      ${kasten(980, 470, 360, 110, 'Bedarf je Typ', 'Menge und Termin')}
      <path class="pfad" d="M 980 525 L 900 525"/>
      ${kasten(560, 470, 340, 110, 'ERP-System', 'Bleibt führend')}
      ${kasten(100, 700, 1400, 96, 'Ohne Systemablösung', 'Das Modul setzt neben dem ERP an und gibt die Ergebnisse dorthin zurück')}
    </svg>`,
  },
  {
    datei: 'refSolar.png',
    breite: 1600, hoehe: 900,
    inhalt: `<svg width="1600" height="900" viewBox="0 0 1600 900">
      <text class="marke" x="100" y="100">Referenzprojekt</text>
      <text class="titel" x="100" y="144">Warenwirtschaft für Solarprojekte</text>
      ${kasten(100, 300, 300, 104, 'Angebot', 'Lexware Office')}
      ${pfeil(400, 352, 480, 352, true)}
      ${kasten(480, 300, 320, 104, 'Annahme', 'Auftrag bestätigt', true)}
      ${pfeil(800, 352, 880, 352, true)}
      ${kasten(880, 300, 320, 104, 'Projekt', 'Automatisch angelegt')}
      ${pfeil(1200, 352, 1280, 352, true)}
      ${kasten(1280, 300, 220, 104, 'Baustelle', '')}
      <path class="pfad" d="M 1040 404 L 1040 520"/>
      ${kasten(880, 520, 320, 104, 'Materialbedarf', 'Je Projekt abgeleitet')}
      <path class="pfad" d="M 880 572 L 640 572 L 640 404"/>
      ${kasten(100, 720, 1400, 88, 'Ein Datenstand', 'Kunden, Projekte, Material und Kaufmännisches bleiben verbunden')}
    </svg>`,
  },
  {
    datei: 'statement.png',
    breite: 1800, hoehe: 772,
    dunkel: true,
    inhalt: `<svg width="1800" height="772" viewBox="0 0 1800 772">
      ${kasten(980, 180, 320, 104, 'Ihr ERP', '')}
      ${kasten(980, 330, 320, 104, 'Ihr Shop', '')}
      ${kasten(980, 480, 320, 104, 'Ihr Lager', '')}
      ${kasten(1420, 330, 280, 104, 'Eine Oberfläche', '', true)}
      <path class="pfad-stark" d="M 1300 232 L 1360 232 L 1360 382 L 1420 382"/>
      <path class="pfad-stark" d="M 1300 382 L 1420 382"/>
      <path class="pfad-stark" d="M 1300 532 L 1360 532 L 1360 382"/>
    </svg>`,
  },
]

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

await mkdir(AUS, { recursive: true })

for (const g of grafiken) {
  const p = await b.newPage({ viewport: { width: g.breite, height: g.hoehe } })
  await p.setContent(rahmen(g.breite, g.hoehe, g.inhalt, g.dunkel), { waitUntil: 'load' })
  await p.waitForTimeout(600) // Schriften laden lassen
  const png = await p.screenshot({ type: 'png' })
  await writeFile(path.join(AUS, g.datei), png)
  console.log('✓', g.datei, `${g.breite}×${g.hoehe}`)
  await p.close()
}

await b.close()
