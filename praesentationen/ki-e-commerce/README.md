# Wie KI die Wirtschaft verändert: Fokus E-Commerce

Deutschsprachige Präsentation, 16:9, 15 Folien, Vortragsdauer ca. 15 Minuten.
Zielgruppe: Berufsschule, Kolleginnen und Kollegen, Kunden.

| Datei | Inhalt |
|---|---|
| `KI-und-E-Commerce.pptx` | die fertige Präsentation, jede Folie mit Speaker Notes |
| `SPICKZETTEL.md` | die wichtigsten Zahlen mit Quelle, zum Ausdrucken |
| `generator/` | der Generator — die Datei ist reproduzierbar, nicht handgeklickt |

## Designsystem — Neo-Brutalismus

Verbindliche Tokens in `generator/design-system.js`, Bausteine in `generator/lib.js`.

* **Farben** — Schwarz `#111111`, Signalgelb `#FFD84D`, Weiß. Rot und Mint sind
  ausschließlich Flächenfarben, nie Schrift. Schrift ist immer schwarz auf hell
  oder weiß auf schwarz; damit liegt jeder Textkontrast über 12:1.
* **Flächen statt Karten** — harte Kanten mit 2,25 pt, 0 px Radius. Der „Schatten"
  ist kein Weichzeichner, sondern ein zweites schwarzes Rechteck mit 0,10" Versatz.
* **Typografie** — `Arial Black` für Überschriften und Großzahlen, `Courier New`
  für Kicker, Diagrammachsen, Fußnoten und Seitenzahlen, `Arial` für Fließtext.
  Alle drei gehören zum Office-Standard, damit die Datei beim Empfänger genauso
  aussieht wie hier.
* **Raster** — Bühne 13,333 × 7,5", Rand 0,62", 12 Spalten, Rinne 0,20".
  Blöcke sitzen bewusst versetzt (0,20–0,24"), nicht in Reih und Glied.
* **Motiv** — quadratischer Icon-Block mit schwarzem Rahmen. Kein Kreis, keine Rundung.
* **Diagramme** — native PowerPoint-Diagramme, schwarze Balken, der hervorgehobene
  Wert in Gelb, keine Gitternetzlinien, Zahlen in Arial Black, Achsen in Courier New.

### Hinweis zur Schriftkontrolle

`Arial Black` ist in dieser Bauumgebung nicht installiert. Für die visuelle Kontrolle
wird sie per fontconfig auf `Inter Black` abgebildet (gleiches Gewicht, minimal
schmaler). In der `.pptx` steht unverändert `Arial Black`. Deshalb rechnet
`design-system.js` mit einer Breitenreserve (`SLACK = 1.22`), und alle Überschriften
bleiben unter 36 Zeichen.

## Bildrechte

Keine Stockfotos, keine fremden Diagramm-Screenshots. Alle Diagramme sind aus den
recherchierten Daten selbst erzeugt. Icons: Lucide Icons (ISC-Lizenz), auf
Strichstärke 2,6 verstärkt.

## Neu bauen

```bash
cd generator
npm install
node build.js        # schreibt KI-und-E-Commerce.pptx
```

Datenstand: 18.09.2026. Beim Aktualisieren zuerst `data.js` anfassen — dort stehen
Quellen und Fußnotentexte an einer Stelle.
