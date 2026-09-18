# Wie KI die Wirtschaft verändert: Fokus E-Commerce

Deutschsprachige Präsentation, 16:9, 15 Folien, Vortragsdauer ca. 15 Minuten.
Zielgruppe: Berufsschule, Kolleginnen und Kollegen, Kunden.

| Datei | Inhalt |
|---|---|
| `KI-und-E-Commerce.pptx` | die fertige Präsentation, jede Folie mit Speaker Notes |
| `SPICKZETTEL.md` | die wichtigsten Zahlen mit Quelle, zum Ausdrucken |
| `generator/` | der Generator — die Datei ist reproduzierbar, nicht handgeklickt |

## Designsystem

Abgeleitet aus dem Skill `ui-ux-pro-max` (`--design-system`):
Pattern **Enterprise Gateway**, Style **Data-Dense Dashboard**.
Die verbindlichen Tokens stehen dokumentiert in `generator/design-system.js`.

* **Farben** — Navy `#1E3A8A` / `#1E40AF` dominant, Blau `#3B82F6` / `#93C5FD` stützend,
  Amber als einziger Akzent (`#D97706` auf hellem, `#F59E0B` auf dunklem Grund).
* **Typografie** — Cambria (Serif) für Überschriften und Großzahlen, Arial für Fließtext,
  Beschriftungen und Diagramme. Beide gehören zum Office-Standard, damit die Datei beim
  Empfänger genauso aussieht wie hier.
* **Raster** — Bühne 13,333 × 7,5 Zoll, Außenrand 0,62", 12 Spalten, Rinne 0,18".
* **Motiv** — abgerundetes Navy-Quadrat („Badge") mit weißem Icon, auf jeder Inhaltsfolie.
* **Icons** — Lucide (ISC-Lizenz), Strichstärke 2, als PNG gerastert.
* **Diagramme** — native PowerPoint-Diagramme, feste Farbreihenfolge, eigener
  Typografie-Titel statt des PowerPoint-Diagrammtitels.

## Bildrechte

Es wurden keine Stockfotos und keine fremden Diagramm-Screenshots verwendet.
Alle Diagramme sind aus den recherchierten Daten selbst erzeugt, die Titelgrafik ist
ein prozedural erzeugtes SVG (`generator/assets.js`, deterministisch über festen Startwert).

## Neu bauen

```bash
cd generator
npm install
node build.js        # schreibt KI-und-E-Commerce.pptx
```

Datenstand: 18.09.2026. Beim Aktualisieren zuerst `data.js` anfassen — dort stehen
Quellen und Fußnotentexte an einer Stelle.
