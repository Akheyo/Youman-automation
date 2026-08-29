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
| Referenzprojekte, Übersicht | je Projekt ein Motiv | 4:3 |
| Drahtmüller | Gitterroste in Transportgestellen | 16:9 |
| A&B SolarEnergy | Lager und Kommissionierung | 16:9 |
| Über uns | die Menschen hinter youman | 16:9 |
