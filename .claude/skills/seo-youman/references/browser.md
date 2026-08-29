# Prüfungen mit Browser

Die statische Prüfung liest das ausgelieferte HTML. Vier Dinge stehen dort
aber nicht drin, weil sie erst beim Rendern entstehen: ob etwas seitlich
überläuft, ob Bedienelemente barrierefrei sind, ob beim Laden etwas springt
und ob die Seite heimlich Verbindungen nach außen aufbaut.

## Aufruf

```bash
cd youman-website && npm run build
npx astro preview --port 4321 &
cd ..
node .claude/skills/seo-youman/scripts/browser-pruefungen.mjs
```

Läuft kein Vorschauserver, bricht das Skript mit dem Befehl ab, der fehlt,
statt mit einem Verbindungsfehler. Dauer etwa drei bis fünf Minuten für
22 Seiten, das meiste davon der Überlauftest über fünf Breiten.

## Voraussetzungen

`playwright` und `axe-core` stehen als devDependency in
`youman-website/package.json` und kommen mit `npm install` mit. Das war nicht
immer so: anfangs lagen sie nur im Sitzungsverzeichnis, und die Skripte
waren in der nächsten Sitzung kaputt.

Chromium wird nicht mit heruntergeladen. `browser.mjs` sucht der Reihe nach
die Vorgabe von Playwright, dann `PLAYWRIGHT_BROWSERS_PATH`, dann bekannte
Ablagen. Findet es keinen, nennt es den Befehl zum Nachinstallieren. Auch
das ist Erfahrung: der Pfad stand früher fest im Skript, samt Versionsnummer
im Verzeichnisnamen, und zeigte nach dem ersten Update ins Leere.

## Was geprüft wird

### Barrierefreiheit

axe-core gegen WCAG 2.1 Stufe A und AA. Das deckt maschinell Prüfbares ab:
Kontraste, Beschriftungen von Bedienelementen, Gliederung, Sprache,
Fokusreihenfolge. Nicht abgedeckt ist alles, was Urteilsvermögen braucht,
etwa ob ein Alternativtext das Bild tatsächlich beschreibt.

### Waagerechter Überlauf

Geprüft bei 320, 375, 768, 1024 und 1440 px. Absichtlich beschnittene
Elemente zählen nicht, sonst meldet jedes Bild in einer Kachel einen Fehler;
das Skript geht dafür die Vorfahren hoch und prüft `overflow-x`.

Die häufigste Ursache in diesem Projekt waren Rasterspalten, die auf die
Mindestbreite eines langen Wortes gewachsen sind. `overflow-wrap` hilft
dagegen nicht: es erlaubt den Umbruch, senkt aber die gemeldete
Mindestbreite nicht. Der Griff, der wirkt, ist `minmax(0, 1fr)` statt `1fr`.

### Layout-Sprung und Ladezeit

CLS und LCP über die Browser-APIs, bei 390 px Breite und doppelter
Pixeldichte. Ab einem CLS von 0.1 gilt eine Seite als mangelhaft, ab
2500 ms LCP ebenso.

Es sind Laborwerte auf schnellem Rechner ohne Netzverzögerung. Sie zeigen
die Struktur der Seite zuverlässig, nicht die Erfahrung echter Nutzer. Für
Feldwerte braucht es CrUX, und dafür muss die Seite erst Verkehr haben.

Die Bytezahlen schwanken zwischen Läufen, weil der Browser selbst
entscheidet, wie viel er vom Video holt. Sie taugen als Größenordnung, nicht
als Messwert.

Ein Fund aus der Praxis: Schriften, die erst nach dem Stylesheet gefunden
werden, verursachen einen Sprung, wenn der Text von der Ersatzschrift auf
die richtige wechselt. Auf `/ueber-uns` waren das 0.103. Die Lösung steht in
`Base.astro`: die drei lateinischen Schnitte werden im Kopf vorab
angemeldet, mit `crossorigin`, weil Schriften immer im CORS-Modus geholt
werden. Ohne dieses Attribut lädt der Browser die Datei zweimal.

### Fremde Hosts, Cookies, Speicher

Jede Netzanfrage wird protokolliert, auch nach dem Scrollen, weil Bilder
verzögert laden. Erscheint ein anderer Host als der eigene, ist das ein
Befund: Die Datenschutzerklärung sagt zu, dass beim Aufruf nichts von
Dritten geladen wird, und diese Zusage muss messbar bleiben.

Dasselbe gilt für Cookies, localStorage und sessionStorage. Kommt eines
davon dazu, ändert sich die datenschutzrechtliche Lage, und die Erklärung
muss angepasst werden, bevor die Änderung live geht.
