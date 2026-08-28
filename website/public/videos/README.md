# Videos

## Das Hero-Video einsetzen

1. Video als **MP4 (H.264)** hier ablegen. Optional zusätzlich eine
   **WebM**-Fassung — die ist meist deutlich kleiner und wird von modernen
   Browsern bevorzugt.
2. Ein Standbild aus dem Video nach `public/bilder/` legen. Es wird vor dem
   Start gezeigt und ersetzt das Video bei reduzierter Bewegung.
3. In `lib/videos.ts` `datei`, optional `dateiWebm` und `standbild` eintragen.

## Vorgaben

- **Ohne Ton.** Das Video läuft stumm; eine Tonspur kostet nur Dateigröße.
- **8 bis 15 Sekunden**, nahtlose Schleife. Längere Clips fallen auf, wenn sie
  neu anfangen.
- **Ruhige Bewegung.** Statische Kamera oder sanfte Fahrt. Schnelle Schnitte
  lenken vom Text daneben ab.
- **Dateigröße unter 3 MB.** Das Video lädt auf jedem Seitenaufruf mit; alles
  darüber verlangsamt die Startseite spürbar. Komprimieren z. B. mit HandBrake
  oder `ffmpeg -i eingabe.mp4 -vcodec libx264 -crf 28 -an ausgabe.mp4`.

## Was automatisch passiert

- Das Video startet stumm und läuft in Schleife.
- Unten rechts sitzt ein Knopf zum Anhalten. Der ist keine Zugabe, sondern
  vorgeschrieben: Bewegung, die länger als fünf Sekunden automatisch läuft,
  muss anhaltbar sein (WCAG 2.2.2).
- Wer im Betriebssystem reduzierte Bewegung eingestellt hat, sieht das
  Standbild und keinen automatischen Start.
