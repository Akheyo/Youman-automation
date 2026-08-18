# Bilder

Dateien hier ablegen, benannt nach dem Schlüssel aus `src/data/images.ts`.
Endung egal – gesucht wird in dieser Reihenfolge: `.avif` `.webp` `.jpg` `.jpeg` `.png`.

| Dateiname      | Motiv                                             |
| -------------- | ------------------------------------------------- |
| `halle`        | Produktionshalle, Mittelgang mit Tiefe (Hero)     |
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
