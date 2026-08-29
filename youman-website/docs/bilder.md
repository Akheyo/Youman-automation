# Bilder

Dateien hier ablegen, benannt nach dem Schlüssel aus `src/data/images.ts`.
Endung egal – gesucht wird in dieser Reihenfolge: `.avif` `.webp` `.jpg` `.jpeg` `.png`.

| Dateiname      | Motiv                                             |
| -------------- | ------------------------------------------------- |
| `halle`        | Produktionshalle, Mittelgang mit Tiefe – **Poster hinter dem Hero-Video**, nicht dessen Ersatz |
| `paletten`     | Gestapelte Paletten / Lagerware                   |
| `oberflaeche`  | Bildschirm mit Software in der Produktion         |
| `logistik`     | Gang zwischen Hochregalen                         |
| `maschinenbau` | Zerspanung, bearbeitete Metallteile               |
| `material`     | Stahlcoils, Rohmaterial                           |
| `automobil`    | Blechteile auf Transportgestellen                 |
| `handel`       | Kartons auf Förderstrecke                         |
| `reporting`    | Leitstand mit Bildschirmen                        |
| `architektur`  | Stahlträger, hohe Hallenfenster                   |
| `gitter`       | Makro: Raster aus Stahldraht                      |
| `buero`        | Büro mit Blick in die Produktion                  |

Anforderungen: Querformat, ab 2000 px breit, kühle Farbigkeit, kein Rot als
Fläche, keine erkennbaren Gesichter, keine fremden Logos.

Fehlt eine Datei, rendert `<Bild>` automatisch eine gestaltete Farbfläche –
die Seite bleibt also immer vollständig.

## Hero: Video und Poster

Der Hero zeigt ein Video. `halle` ist das Standbild darunter und wird immer
dann sichtbar, wenn das Video nicht laeuft:

- bevor das Video geladen ist und waehrend es puffert
- bei `prefers-reduced-motion` (dann bewusst kein Autoplay)
- wenn der Browser Autoplay blockiert
- als Vorschaubild beim Teilen (OpenGraph)

Sobald das Video vorliegt, sollte das Poster ein **Einzelbild aus dem Video
selbst** sein, damit beim Start kein Sprung sichtbar wird. Bis dahin ist ein
passendes Foto die bessere Zwischenloesung als die abstrakte Grafik.
