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

Reservierte Plätze zurzeit:

| Seite | Was dorthin gehört | Format |
| --- | --- | --- |
| Startseite | ein Motiv aus der Arbeit | 16:9 |
| Startseite, „Was wir bauen" | je Leistung ein Motiv (5) | 3:2 |
| Startseite, „Wo wir arbeiten" | je Branche ein Motiv (6) | 3:2 |
| Startseite, „Abgeschlossene Projekte" | je Projekt ein Motiv (2) | 16:9 |
| Leistungen, Übersicht | dieselben fünf Motive | 3:2 |
| Branchen, Übersicht | dieselben sechs Motive | 3:2 |
| Referenzprojekte, Übersicht | dieselben zwei Motive | 4:3 |
| Drahtmüller | Gitterroste in Transportgestellen | 16:9 |
| A&B SolarEnergy | Lager und Kommissionierung | 16:9 |
| Über uns | die Menschen hinter youman | 16:9 |

Die Beschriftung eines Bildplatzes kommt aus den Daten, nicht aus der
Seite: `bildhinweis` in `leistungen.ts`, `branchen.ts` und
`caseStudies.ts`. Ein Motiv einmal gesetzt, erscheint es dadurch überall,
wo dieselbe Leistung, Branche oder Referenz auftaucht.
