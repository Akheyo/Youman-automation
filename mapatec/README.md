# MAPATEC Landingpage – DCK Vertriebspartner

Statische Single-File-Seite (`index.html`). Alle Bilder sind als Base64 eingebettet,
die Datei läuft ohne Build, Server oder weitere Assets – einfach hochladen bzw. im
Browser öffnen.

## DCK-Positionierung

Die Vertriebspartnerschaft ist an folgenden Stellen sichtbar:

| Stelle | Inhalt |
| --- | --- |
| `<title>` / Meta-Description | „Offizieller DCK Vertriebspartner" |
| Navigation | Link **DCK Distribution** → `#dck` |
| Hero-Badge | „Offizieller DCK Vertriebspartner · Official DCK Distribution Partner" |
| Hero-Lockup | Kleines DCK-Zeichen mit „Offizieller Vertriebspartner von" |
| Sektion `#dck` | Hauptaussage, 3 Fakten-Karten, Hinweis „Mehr Informationen folgen in Kürze", DCK-Anfrage-Button |
| Über uns | Zusatzabsatz DE/EN + Info-Karte „Vertriebspartnerschaft · Distribution" |
| CTA-Band | Ansprache für DCK-Anfragen |
| Sektion `#dck` | zusätzlich: Banner, Produktwelt-Karten, Partner-Plakette (siehe Bilddateien) |
| Footer | DCK-Zeichen + „Offizieller Vertriebspartner" |

## Bilddateien (neben die index.html legen)

Die DCK-Sektion hat vier Bildbereiche. Die Dateien gehören **in denselben Ordner
wie die `index.html`** (also `/mapatec/`) und müssen exakt so heißen:

| Dateiname | Inhalt | Format |
| --- | --- | --- |
| `dck-banner.jpg` | Breites Banner „DCK Deutschland – Power Tools für Profis" | Querformat, ca. 2:1 |
| `dck-tools-kabel.jpg` | Abbruchhammer, Kernbohrgerät, Kappsäge (auf Schwarz) | quadratisch 1:1 |
| `dck-tools-akku.jpg` | 20V-Akku-Serie: Schlagschrauber, Bohrhammer, Winkelschleifer | quadratisch 1:1 |
| `mapatec-meets-dck.png` | Lockup „www.MapaTec.de meets DCK" | quer oder quadratisch |

Hinweise:

- **Fehlt eine Datei, verschwindet ihr Block automatisch** – die Seite sieht nie
  kaputt aus. Sind beide Produktbilder weg, fällt auch die Überschrift
  „Die DCK Produktwelt" mit raus.
- Die Endung wird einmal automatisch gegengeprüft (`.jpg` ↔ `.png`), ein
  abweichendes Format kostet also nicht gleich den ganzen Block.
- Bilder werden per `loading="lazy"` nachgeladen, die Container haben feste
  Seitenverhältnisse – dadurch springt beim Laden nichts.
- Die Produktbilder liegen auf schwarzem Grund und gehen dadurch nahtlos in die
  dunkle Seite über. Das Lockup steht bewusst auf einer hellen Plakette.
- Bewusst **nicht** als Base64 eingebettet: die Seite ist schon 1,1 MB groß,
  vier Fotos zusätzlich würden sie auf mehrere MB aufblähen und den ersten
  Seitenaufbau spürbar bremsen.

## Offizielles DCK-Logo einsetzen

Die DCK-Wortmarke ist aktuell als SVG nachgebaut (geometrische Umsetzung im
Original-Stil, weiss auf Rot). Sobald die offizielle Logodatei vorliegt, im
`<script>`-Block am Ende der Datei setzen:

```js
const DCK_LOGO_URL = 'dck-logo.png';        // Pfad oder data:-URI
const DCK_LOGO_URL_WHITE = 'dck-white.png'; // optional: weisse Variante
```

Damit werden alle drei Stellen (Sektion, Hero, Footer) automatisch ersetzt.
Die Logos stehen jeweils auf roter Fläche – daher eine weisse bzw. transparente
Variante ohne eigenen Hintergrund verwenden.

Die Markenfarbe der Fläche steuert die CSS-Variable `--dck-red` (aktuell `#E2001A`).

## Inhalte, die noch folgen

Der „Mehr Informationen folgen in Kürze"-Block in der Sektion `#dck` ist der
Platzhalter für Produktportfolio, Verfügbarkeiten, Datenblätter und Konditionen.
