# Fotos für die Sapore-Grill-Seite

Solange eine Datei hier fehlt, zeigt die Seite an der Stelle einen ruhigen
Platzhalter mit dem gesuchten Motiv. Das Layout bleibt dabei vollständig — es
muss also nichts am Code geändert werden, sobald ein Foto nachgereicht wird.
Einfach die Datei unter dem genannten Namen ablegen und neu laden.

| Datei                  | Motiv                                                        | Format                        |
| ---------------------- | ------------------------------------------------------------ | ----------------------------- |
| `hero.jpg`             | Steakdöner, seitlich fotografiert — das beste Produktfoto     | Hochformat, ab 1200 × 1500 px |
| `steakdoener.jpg`      | Steakdöner im Anschnitt, Fleisch und Salat sichtbar           | Querformat 3:2, ab 1600 px    |
| `gemuese-kebap.jpg`    | Gemüse Kebap mit sichtbarem Grillgemüse und Käse              | Querformat 3:2, ab 1600 px    |
| `galerie-pizza.jpg`    | Pizza aus dem Ofen, von oben                                  | Quadratisch, ab 1000 px       |
| `galerie-salat.jpg`    | Salatschale, schräg von oben                                  | Quadratisch, ab 1000 px       |
| `galerie-imbiss.jpg`   | Imbiss-Teller komplett angerichtet                            | Quadratisch, ab 1000 px       |
| `galerie-laden.jpg`    | Innen- oder Außenansicht des Ladens                           | Quadratisch, ab 1000 px       |
| `logo.webp` / `logo.jpg` | Das Wappen. Beides wird aus deinem Original erzeugt — siehe unten | liegt bereits vor |

Hinweise:

- JPG oder WebP, gerne unter 300 KB pro Datei — die Seite lädt sonst spürbar
  langsamer, was auch das Suchmaschinen-Ranking kostet.
- Bei Handyfotos hilft schon: Tageslicht, ruhiger Hintergrund, Teller nicht
  mittig, sondern leicht versetzt aufnehmen.
## Zum Wappen

Es liegt in zwei Fassungen, beide aus dem hochgeladenen Original erzeugt:

- **`logo.webp`** (47 KB) — was die Seite anzeigt. Das Wappen laedt in Kopf und
  Fusszeile bei jedem Aufruf mit; als PNG waere dieselbe Datei 535 KB schwer.
  Bei Gaesten im Mobilfunknetz ist das der Unterschied zwischen schnell und
  zaeh, und Ladezeit zaehlt bei Google mit.
- **`logo.jpg`** (68 KB) — was erscheint, wenn jemand den Link verschickt.
  JPEG, weil WhatsApp und Facebook es zuverlaessig lesen; bei WebP ist das je
  nach Dienst nicht garantiert.

Das Original (1254 x 1254 px, 1,2 MB) bleibt in der Git-Historie erhalten.

**Wenn du das Logo aenderst:** lade einfach das neue Original in diesen Ordner
und sag Bescheid — die beiden Fassungen erzeuge ich daraus neu. Selbst
umbenennen reicht nicht, die Groesse waere sonst wieder bei ueber einem Megabyte.

Sobald ein eigenes Teilen-Bild vorliegt (quer, genau 1200 x 630 px, am besten
ein Produktfoto statt des Wappens), wird der Pfad in
`app/sapore-grill/page.tsx` eingetragen — er steht dort an drei Stellen.
