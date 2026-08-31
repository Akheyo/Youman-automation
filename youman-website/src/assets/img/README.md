# Bilder ablegen

Dateien hier hineinlegen (WebP oder JPEG, mindestens 1600 px breit) und im
gewünschten `Bildplatz` übergeben:

```astro
import motiv from '../assets/img/motiv.webp';
<Bildplatz bild={motiv} alt="Was zu sehen ist" bezeichnung="…" />
```

Astro erzeugt daraus selbst die kleineren Varianten. Es rechnet dabei nur
herunter, nie hoch: Ein 600 px breites Original bleibt auf großen Bildschirmen
unscharf.

## Welche Dateien gebraucht werden

15 Motive. Mit diesen Namen abgelegt, lassen sie sich ohne Rückfrage
einsetzen; ein Motiv reicht jeweils für alle Stellen, an denen dieselbe
Leistung, Branche oder Referenz vorkommt.

| Dateiname | Was zu sehen sein soll | Format |
| --- | --- | --- |
| `start` | ein Motiv aus der Arbeit | 16:9 |
| `leistung-ki-automationen` | Arbeitsplatz, an dem ein Ablauf durchläuft | 3:2 |
| `leistung-chatbots` | Chatfenster im laufenden Gespräch | 3:2 |
| `leistung-webseiten` | dieselbe Seite auf mehreren Geräten | 3:2 |
| `leistung-e-commerce` | Kommissionierung und Versandvorbereitung | 3:2 |
| `leistung-individuelle-software` | Bildschirm mit einer eigenen Anwendung | 3:2 |
| `branche-e-commerce-und-onlinehandel` | Versandvorbereitung im Lager | 3:2 |
| `branche-spedition-und-logistik` | Lkw an der Verladerampe | 3:2 |
| `branche-produktion-und-fertigung` | Fertigungshalle im Betrieb | 3:2 |
| `branche-grosshandel-und-distribution` | Hochregallager | 3:2 |
| `branche-handwerk-und-bau` | Werkstatt oder Baustelle | 3:2 |
| `branche-dienstleistung-und-agenturen` | Besprechung am Bildschirm | 3:2 |
| `referenz-drahtmueller` | Gitterroste in Transportgestellen | 16:9 |
| `referenz-absolar` | Lager und Kommissionierung | 16:9 |
| `ueber-uns` | die Menschen hinter youman | 16:9 |

Endung `.webp` oder `.jpg`, beides geht. Das Format muss nicht genau
stimmen, es wird mittig zugeschnitten. Wo der Ausschnitt schiefgeht, lässt
sich das an der Stelle nachstellen.

Die Beschriftung eines Bildplatzes kommt aus den Daten, nicht aus der
Seite: `bildhinweis` in `leistungen.ts`, `branchen.ts` und
`caseStudies.ts`. Ein Motiv einmal gesetzt, erscheint es dadurch überall,
wo dieselbe Leistung, Branche oder Referenz auftaucht.

## Was noch dazugehört

Zu jedem Bild braucht es eine Bildbeschreibung (`alt`). Sie ist keine
Formsache: Sie ist das, was blinde Besucher statt des Bildes hören, und
das, was Google über den Bildinhalt erfährt. Sie wird beim Einsetzen
geschrieben, nicht vom Dateinamen abgeleitet.
