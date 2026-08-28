# Bilder

Hier liegen die Bilddateien der Website.

## Ein Bild einsetzen

1. Datei hier ablegen, am besten als **WebP** (deutlich kleiner als JPG bei
   gleicher Qualität). Umwandeln z. B. mit https://squoosh.app
2. In `lib/bilder.ts` beim passenden Eintrag `datei: '/bilder/dateiname.webp'`
   ergänzen.

Der Platzhalter verschwindet dann automatisch. Das Layout verschiebt sich nicht,
weil das Seitenverhältnis schon vorher reserviert ist.

## Was gebraucht wird

Die vollständige Liste mit Motiv, Seitenverhältnis und empfohlener Breite steht
in `lib/bilder.ts` — und ist auf der Seite selbst in jedem Platzhalter zu lesen.
Am schnellsten geht es, die Seite lokal zu starten (`npm run dev`) und
durchzuscrollen: Jeder Platzhalter nennt, was an diese Stelle gehört.

## Hinweise zur Bildauswahl

- Echte Arbeitssituationen wirken glaubwürdiger als Stockfotos mit
  Daumen-hoch-Gesten und weißen Zahnreihen.
- Ruhige, gedeckte Farben passen zum Rest der Seite; grelle Motive brechen
  das Erscheinungsbild.
- Menschen bei der Arbeit schlagen leere Räume.
- Auf Nutzungsrechte achten. Bei gekauften Bildern die Lizenz aufbewahren,
  bei eigenen Aufnahmen von abgebildeten Personen eine Einwilligung einholen.
