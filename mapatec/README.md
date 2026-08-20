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
| Footer | DCK-Zeichen + „Offizieller Vertriebspartner" |

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
