# Performance-Audit: Ladeverhalten (Core Web Vitals)

## Wichtiger Hinweis zur Messumgebung

Diese Messung ist ausschließlich eine Labormessung. In dieser Umgebung sind externe Hosts blockiert, weder die Live-Seite noch die PageSpeed-Insights-API waren erreichbar, und es liegen keine CrUX-Felddaten vor. Gemessen wurde stattdessen mit Playwright/Chromium (headless, `/opt/pw-browsers/chromium`) direkt gegen den lokalen Vorschauserver `http://localhost:4321`, der den gebauten Stand aus `/home/user/Youman-automation/youman-website/dist` ausliefert.

Das bedeutet konkret:

- **Keine Netzverzögerung.** Der Rechner, auf dem gemessen wurde, und der Server liegen auf derselben Maschine. Es gibt keine Latenz, kein TLS-Handshake über das offene Internet, keine Mobilfunk- oder WLAN-Bedingungen.
- **Kein CDN.** Die echte Seite läuft über GitHub Pages mit dessen Edge-Auslieferung. Der lokale Vorschauserver liefert Dateien direkt aus, ohne CDN-Zwischenschicht.
- **Gewichtsangaben sind dekodierte Ressourcengrößen.** Für die meisten Antworten wurde der `Content-Length`-Header verwendet bzw., wenn dieser fehlte, die vom Browser dekodierte Rumpfgröße. Das entspricht der unkomprimierten Dateigröße. Ein kurzer Test mit `curl -H "Accept-Encoding: gzip"` zeigt, dass der lokale Vorschauserver Text-Ressourcen (HTML, CSS) tatsächlich gzip-komprimiert ausliefert; auf GitHub Pages ist ebenfalls Kompression zu erwarten. Die in diesem Bericht genannten Gewichte sind daher für HTML/CSS etwas höher als die tatsächlich über die Leitung übertragenen Bytes. Bei den Bildern (bereits komprimiertes WebP/JPEG) macht das kaum einen Unterschied.
- **Die Zahlenwerte für LCP und CLS sind also keine Feldwerte.** Sie zeigen Größenordnungen und das Verhältnis zwischen den Seiten (welche Seite ist schwerer, welche hat mehr Anfragen), nicht die tatsächliche Erfahrung realer Besucher auf realen Geräten und Verbindungen. Absolute Millisekundenwerte in dieser Tabelle dürfen nicht mit den in den Google-Schwellenwerten (LCP ≤ 2,5 s usw.) verglichen werden, da im Feld Netzlatenz, Gerätequalität und CDN-Antwortzeiten dominieren, die hier fehlen.
- **INP wurde nicht gemessen.** INP setzt eine echte Nutzerinteraktion voraus (Klick, Tap, Tastatureingabe) und lässt sich ohne einen echten Interaktionsablauf auf einem realistischen Gerät nicht sinnvoll im Labor ermitteln. Eine Zahl hierfür würde geraten und ist deshalb bewusst nicht angegeben. Aus dem Quellcode lässt sich nur sagen, welche Interaktions-Handler existieren (siehe Befunde).

Gemessen wurde jede der 23 Seiten in zwei Ansichten:
- **Mobil:** 390 × 844 px, Pixeldichte 2x (entspricht einem typischen Smartphone)
- **Desktop:** 1440 × 900 px, Pixeldichte 1x

Erfasst wurden je Seite: LCP (via `PerformanceObserver`, `largest-contentful-paint`), CLS (via `PerformanceObserver`, `layout-shift`, kumulativ über Ladezeit plus 1,2 s Nachlauf), Gesamtgewicht aller Netzwerkantworten, Anzahl der Anfragen und die größte einzelne Ressource. Das Messskript liegt unter `/tmp/claude-0/-home-user-Youman-automation/44f7a235-8c9b-5e5b-a5d4-81ac137805fa/scratchpad/measure.js`, die Rohdaten unter `.../scratchpad/results.json`.

Ergänzend wurden Daten zum gebauten Ordner ausgewertet: Der `dist`-Ordner wiegt 13 MB, davon 10,6 MB in 108 Bilddateien (95 WebP, 13 JPEG). Der Quellordner `src/assets/img` wiegt 30 MB vor der Optimierung durch Astro.

---

## Tabelle: alle 23 Seiten

| Pfad | Gewicht mobil (390px@2x) | Gewicht Desktop (1440px) | Anfragen mobil | Anfragen Desktop | LCP mobil (Labor) | LCP Desktop (Labor) | CLS mobil / Desktop |
|---|---|---|---|---|---|---|---|
| `/` | 488 KB | 976 KB | 11 | 11 | 644 ms | 296 ms | 0 / 0 |
| `/branchen/` | 329 KB | 336 KB | 8 | 12 | 140 ms | 172 ms | 0 / 0 |
| `/branchen/dienstleistung-und-agenturen/` | 242 KB | 231 KB | 7 | 7 | 160 ms | 228 ms | 0 / 0 |
| `/branchen/e-commerce-und-onlinehandel/` | 254 KB | 239 KB | 7 | 7 | 112 ms | 184 ms | 0 / 0 |
| `/branchen/grosshandel-und-distribution/` | 273 KB | 252 KB | 7 | 7 | 156 ms | 200 ms | 0 / 0 |
| `/branchen/handwerk-und-bau/` | 257 KB | 242 KB | 7 | 7 | 136 ms | 372 ms | 0 / 0 |
| `/branchen/produktion-und-fertigung/` | 265 KB | 247 KB | 7 | 7 | 228 ms | 656 ms | 0 / 0 |
| `/branchen/spedition-und-logistik/` | 269 KB | 249 KB | 7 | 7 | 148 ms | 188 ms | 0 / 0 |
| `/case-studies/` | 203 KB | 207 KB | 6 | 7 | 120 ms | 140 ms | 0 / 0 |
| `/case-studies/absolar-warenwirtschaft/` | 222 KB | 222 KB | 7 | 7 | 116 ms | 152 ms | 0 / 0 |
| `/case-studies/drahtmueller-palettenoptimierung/` | 220 KB | 220 KB | 7 | 7 | 348 ms | 292 ms | 0 / 0 |
| `/datenschutz/` | 206 KB | 206 KB | 6 | 6 | 132 ms | 200 ms | 0 / 0 |
| `/impressum/` | 197 KB | 197 KB | 6 | 6 | 96 ms | 180 ms | 0 / 0 |
| `/kontakt/` | 206 KB | 206 KB | 6 | 6 | 192 ms | 252 ms | 0 / 0 |
| `/leistungen/` | 300 KB | 295 KB | 8 | 11 | 140 ms | 168 ms | 0 / 0 |
| `/leistungen/chatbots/` | 262 KB | 245 KB | 7 | 7 | 148 ms | 184 ms | 0 / 0 |
| `/leistungen/e-commerce/` | 260 KB | 244 KB | 7 | 7 | 180 ms | 196 ms | 0 / 0 |
| `/leistungen/individuelle-software/` | 273 KB | 252 KB | 7 | 7 | 184 ms | 200 ms | 0 / 0 |
| `/leistungen/ki-automationen/` | 261 KB | 246 KB | 7 | 7 | 148 ms | 328 ms | 0 / 0 |
| `/leistungen/webseiten/` | 275 KB | 253 KB | 7 | 7 | 172 ms | 176 ms | 0 / 0 |
| `/muensterland/` | 204 KB | 204 KB | 6 | 6 | 116 ms | 204 ms | 0 / 0 |
| `/ueber-uns/` | 206 KB | 206 KB | 6 | 6 | 136 ms | 188 ms | 0 / 0 |
| 404-Seite (nicht existierender Pfad) | 195 KB | 195 KB | 6 | 6 | 100 ms | 216 ms | 0 / 0 |

Auffällig: Die Startseite ist mit Abstand am schwersten (488 KB mobil / 976 KB Desktop). Alle anderen 22 Seiten liegen zwischen 195 KB und 336 KB, die meisten davon Innenseiten mit einem einzigen Kartenbild um 200 bis 275 KB. CLS lag bei allen 46 Messläufen bei 0, LCP lag in allen Fällen weit unter der guten Schwelle, wobei diese absoluten Werte wegen fehlender Netzverzögerung nicht auf echte Nutzer übertragbar sind (siehe Hinweis oben).

Bei fast allen Seiten war die größte einzelne Ressource die selbst gehostete Newsreader-Schriftdatei (`newsreader-latin-wght-normal.CCVVNp6i.woff2`, 56,7 KB) oder ein Kartenbild ähnlicher Größe (43-66 KB). Auf der Startseite dagegen ein Hero-Bild (bis 273 KB im Desktop-Fall, siehe Befund zum Hero-Karussell unten).

---

## Befunde

### 1. Kritisch: keine (auf Basis der Laborwerte)

Es gibt keinen Befund, der in dieser Laborumgebung selbst die "Poor"-Schwelle eines Core-Web-Vitals-Metrik überschreitet. Das ist wegen der fehlenden Netzverzögerung und des fehlenden CDN erwartbar und sagt nichts über die Felderfahrung aus. Die nachfolgenden Befunde betreffen Struktur- und Gewichtsprobleme, die im Feld relevant werden, sobald echte Netzbedingungen dazukommen.

### 2. High: Hero-Karussell auf der Startseite lädt alle fünf Motive sofort, obwohl vier davon als "lazy" markiert sind

**Beleg:** Im Quellcode ist nur das erste Hero-Bild mit `loading="eager" fetchpriority="high"` markiert, die Bilder 2 bis 5 mit `loading="lazy" fetchpriority="auto"`. Die Netzwerk-Mitschnitte aus allen 46 Messläufen zeigen aber, dass beim Aufruf der Startseite trotzdem alle fünf Hero-Bilder in der jeweils vom `srcset` gewählten Auflösung sofort angefragt werden:

```
image  57.9 KB  hero-1  (eager)
image  94.4 KB  hero-2  (lazy)
image  39.1 KB  hero-3  (lazy)
image  20.3 KB  hero-4  (lazy)
image  44.4 KB  hero-5  (lazy)   -- mobil, Summe 256 KB allein an Hero-Bildern
```
```
image  200.1 KB hero-1  (eager)
image  273.0 KB hero-2  (lazy)
image  102.6 KB hero-3  (lazy)
image   52.1 KB hero-4  (lazy)
image  116.2 KB hero-5  (lazy)   -- Desktop, Summe 744 KB allein an Hero-Bildern
```

Grund: Alle fünf `<img>`-Elemente liegen im selben, bereits beim Laden sichtbaren Container (`position: absolute; inset: 0` innerhalb einer Box mit `min-height: calc(100svh - ...)`, die Umschaltung zwischen den Motiven erfolgt per CSS-Klasse `ist-aktiv`, nicht über `display:none`). Für den Browser befinden sich damit alle fünf Bilder im sichtbaren Bereich, weshalb die native Lazy-Loading-Heuristik sie trotz `loading="lazy"` sofort lädt. Das `loading="lazy"`-Attribut hat hier faktisch keine Wirkung.

**Auswirkung:** Die Startseite ist dadurch 2- bis 5-mal schwerer als jede andere Seite der Website (488-976 KB gegenüber 195-336 KB). Das kostet vor allem auf mobilen Verbindungen Bandbreite und Verbindungs-Slots, die eigentlich für das LCP-Bild (hero-1) und die übrige Startseite gebraucht würden, auch wenn der Browser hero-1 wegen `fetchpriority="high"` bevorzugt herunterlädt. Auf der Festplatte/im Deployment schlägt sich das ebenfalls nieder: Die zehn größten Dateien im `dist`-Ordner sind ausschließlich Hero-Bild-Varianten (u. a. 1345 KB, 1131 KB, 505 KB, 406 KB, 358 KB, 335 KB, 329 KB, 273 KB, 200 KB, 176 KB, siehe auch Befund 3).

**Frage "sind fünf Motive das Gewicht wert":** Aus Performance-Sicht ist die Antwort nein, jedenfalls nicht in der aktuellen Umsetzung. Da automatisch alle fünf Bilder beim ersten Seitenaufruf geladen werden, entsteht sofort das volle Gewicht aller fünf Motive, obwohl ein Besucher im Schnitt nur die ersten ein bis zwei Motive sieht (Rotation alle 6,5 Sekunden laut dem Karussell-Skript), bevor er weiterklickt.

**Empfehlung:**
- Kurzfristig: Zahl der Hero-Motive auf zwei bis drei reduzieren.
- Strukturell: Die nicht-aktiven Motive erst kurz vor ihrem Einsatz laden (z. B. `src` erst per JavaScript setzen, wenn das vorherige Bild zum letzten Mal vor der Anzeige dieses Motivs steht, oder `loading="lazy"` mit tatsächlichem `display:none`/Entfernen aus dem initialen Layout kombinieren, damit die native Lazy-Loading-Heuristik greift).
- Alternativ: Bildqualität/Zielauflösung der Karussell-Motive 2-5 gegenüber dem LCP-Bild bewusst reduzieren, da sie nur kurz und im Hintergrund zu sehen sind.

### 3. Medium: `src`-Attribut der Hero-Bilder verweist auf eine Datei, die größer ist als jeder `srcset`-Eintrag und in der Praxis wahrscheinlich nie geladen wird

**Beleg:** Bei allen fünf Hero-Bildern zeigt `src` auf eine eigene, im `srcset` nicht enthaltene Bildvariante, die deutlich größer ist als der größte `srcset`-Kandidat (2560w):

| Motiv | `src`-Datei | Größe `src` | Größter `srcset`-Eintrag (2560w) | Größe `srcset` |
|---|---|---|---|---|
| hero-1 | `..._Z25M3fP.webp` | 1131 KB | `..._vCnI2.webp` | 329 KB |
| hero-2 | `..._ZL6gjz.webp` | 1345 KB | `..._eAqFG.webp` | 406 KB |
| hero-3 | `..._V7Nop.webp` | 505 KB | `..._1VOvoF.webp` | 148 KB |
| hero-4 | `..._Zven3C.webp` | 335 KB | `..._usjVD.webp` | 79 KB |
| hero-5 | `..._Z1aTIaa.webp` | 358 KB | `..._2jjUIx.webp` | 176 KB |

Nach dem HTML-Standard wird das `src`-Attribut eines `<img>` nur dann als Bildkandidat herangezogen, wenn `srcset` keine Kandidaten mit Breitenbeschreibung (`w`-Deskriptor) enthält. Da hier `srcset` fünf `w`-Kandidaten plus `sizes` definiert, ignorieren alle aktuellen Browser (Chrome, Firefox, Safari, Edge) das `src`-Attribut vollständig und wählen ausschließlich aus dem `srcset` aus. Das lässt sich in dieser Messung auch empirisch bestätigen: In keinem der 46 Seitenaufrufe (23 Seiten × 2 Ansichten) wurde eine dieser fünf `src`-Dateien angefragt.

**Auswirkung:** Für reale Besucher mit einem aktuellen Browser vermutlich keine, da die Datei nie heruntergeladen wird. Das Restrisiko betrifft ausschließlich sehr alte oder nicht standardkonforme Browser bzw. Werkzeuge, die `srcset`/`sizes` nicht auswerten und stattdessen `src` direkt laden, das dürfte 2026 eine sehr kleine Zielgruppe sein. Der eigentliche Schaden liegt im Build: Diese fünf ungenutzten Dateien allein wiegen rund 3,6 MB und vergrößern unnötig den `dist`-Ordner (13 MB gesamt) sowie den auf GitHub Pages ausgelieferten/gespeicherten Datenbestand.

**Empfehlung:** Prüfen, wieso die Astro-`Image`-Komponente bzw. der Hero-Baustein für `src` eine derart große, nicht im `srcset` enthaltene Variante erzeugt (vermutlich wird intern das Originalbild bzw. eine ungekappte Größe als Fallback durchgereicht). `src` stattdessen explizit auf eine der bereits erzeugten, kleinen `srcset`-Breiten (z. B. 640w) setzen, damit auch im theoretischen Fallback-Fall kein übergroßes Bild geladen wird, und die überflüssigen großen Varianten aus dem Build entfernen.

### 4. Info/Gut: LCP-Bild der Startseite ist korrekt priorisiert

**Beleg:** Nur das erste Hero-Bild trägt `loading="eager"`, `fetchpriority="high"` und `decoding="sync"`, ist über `srcset`/`sizes="100vw"` responsiv eingebunden und hat feste `width`/`height`-Attribute (5184 × 3456, skaliert per CSS). Das ist die von Google empfohlene Behandlung für ein wahrscheinliches LCP-Element: frühe, hochpriorisierte Anforderung, keine Layout-Verschiebung durch fehlende Dimensionen. Auf den Innenseiten (`/branchen/`, `/kontakt/` u. a.) war das größte sichtbare Element in der Messung teils gar kein Bild, sondern ein Text-Absatz bzw. eine Überschrift (`P`/`H1`/`H2` als LCP-Element). Dort ist die Schriftauslieferung (siehe Befund 6) der entscheidende Faktor, nicht ein Bild.

### 5. Gut: Bildmaße und Lazy-Loading unterhalb des sichtbaren Bereichs funktionieren korrekt (außer beim Hero-Karussell)

**Beleg:** Alle 78 im HTML gefundenen `<img>`-Elemente über alle 23 Seiten hinweg haben `width`- und `height`-Attribute gesetzt. Das verhindert layoutbedingte Sprünge beim Bildladen und erklärt mit, warum CLS in jeder Messung bei 0 lag. Kartenbilder auf Übersichtsseiten (`/leistungen/`, `/branchen/`) tragen korrekt `loading="lazy"`, und das Verhalten stimmt: Bei 1440 px Breite werden mehr Bilder sofort geladen als bei 390 px, weil bei der breiteren Ansicht mehr Karten im sichtbaren Bereich liegen (z. B. `/leistungen/` mit 8 Anfragen mobil gegenüber 11 Anfragen Desktop). Das ist korrektes, viewport-abhängiges natives Lazy-Loading, kein Fehler.

### 6. Gut: Schriftladen ohne erkennbaren Textsprung

**Beleg:** Alle drei verwendeten Schriftfamilien (Newsreader Variable, Lexend Variable, Source Sans 3 Variable) sind selbst gehostet (`woff2`, Variable Fonts mit Unicode-Range-Aufteilung je Sprache/Schriftsystem), die lateinischen Basis-Subsets werden im `<head>` per `<link rel="preload" as="font" ... crossorigin>` vor Titel, Meta-Angaben und dem CSS-Link angefordert, und in den CSS-`@font-face`-Regeln ist überall `font-display: swap` gesetzt. In keiner der 46 Messungen wurde eine CLS größer 0 registriert. Da diese Messung ohne Netzverzögerung läuft, lässt sich ein durch langsame Verbindungen verursachter sichtbarer Fallback-zu-Web-Font-Sprung (FOUT) im Labor nicht vollständig ausschließen. Die Konfiguration (Preload plus `swap`, selbst gehostet, kein Warten auf einen externen Font-Anbieter) ist aber genau die von Google empfohlene Vorgehensweise, um dieses Risiko klein zu halten.

### 7. Gut: keine Anfragen an fremde Hosts beim Laden der Seiten

**Beleg:** In allen 46 Messläufen ging keine einzige Netzwerkanfrage an einen anderen Host als `localhost:4321`. Im HTML vorkommende externe URLs (`https://api.web3forms.com/submit` als `<form action>`, `https://calendar.app.google/...` als normaler Link, `https://www.ldi.nrw.de`, `https://policies.google.com`, `https://docs.github.com` als Verweise in Impressum/Datenschutz) werden nur bei aktiver Nutzerhandlung (Formularabsenden, Linkklick) angefragt, nicht beim Laden der Seite. Es sind keine eingebetteten Drittanbieter-Skripte, Tracking-Pixel, Web-Fonts von Google Fonts oder Iframes vorhanden. Das deckt sich mit der Angabe "keine externen Skripte" und ist für Ladeverhalten und Datenschutz gleichermaßen positiv.

### 8. Low: gemeinsame CSS-Datei blockiert das Rendering, ist aber klein und wird über Seiten hinweg gecacht

**Beleg:** Jede der 23 Seiten lädt dieselbe Tailwind-generierte Stylesheet-Datei `/_astro/_slug_.RdiDZhCr.css` (44,8 KB unkomprimiert laut `Content-Length`, per `curl` bestätigt gzip-komprimiert ausgeliefert) über ein normales blockierendes `<link rel="stylesheet">`, ohne kritisches Inline-CSS für den ersten sichtbaren Bereich. Das ist eine gängige, unkritische Astro/Tailwind-Standardauslieferung: Die Datei ist mit 44,8 KB klein, wird nach dem ersten Seitenaufruf vom Browser gecacht und danach bei jeder weiteren Seite der Website wiederverwendet (kein erneuter Download bei interner Navigation). Auf einer einzelnen, sehr schnellen ersten Anfrage kostet sie dennoch einen zusätzlichen blockierenden Round-Trip, bevor der Browser mit dem Rendern beginnen kann.

**Empfehlung (optional, geringe Priorität):** Falls weitere Optimierung gewünscht ist, könnte kritisches Above-the-fold-CSS inline in den `<head>` gesetzt und der Rest asynchron nachgeladen werden. Angesichts der geringen Dateigröße und der Cache-Wiederverwendung über alle 23 Seiten ist der zu erwartende Gewinn klein.

### 9. Info: JPEG-Dateien im Build werden nicht beim normalen Seitenaufruf geladen

**Beleg:** Von den 108 Bilddateien im `dist`-Ordner sind 13 JPEG-Dateien. Alle Verweise auf `.jpeg`-Dateien im HTML stecken ausschließlich in `og:image`- und `twitter:image`-Meta-Tags (12 Seiten mit je einem Verweis in beiden Tags). Diese Bilder werden nur von Social-Media- und Messenger-Crawlern beim Erstellen einer Linkvorschau abgerufen, nicht vom Browser eines normalen Websitebesuchers. In keinem der 46 Messläufe wurde eine JPEG-Datei angefragt. Das ist korrekte, absichtliche Verwendung (JPEG als universell von Vorschau-Crawlern unterstütztes Format) und kein Performance-Problem für Websitebesucher.

### 10. Info: INP nicht messbar in dieser Umgebung

Wie eingangs beschrieben, erfordert INP eine echte Interaktion (Klick/Tap/Tastatur) auf einem realistischen Gerät samt Verarbeitungszeit im Hauptthread. Ohne Interaktionssimulation mit realistischem Timing liefert eine Zahl hierzu keinen verlässlichen Anhaltspunkt und wurde deshalb nicht erhoben. Aus dem Quellcode lässt sich beobachten, dass die Website nur wenige, kleine JavaScript-Handler einsetzt (Header-Dropdown-Menü, Hero-Karussell-Steuerung, Reveal-Animationen per `IntersectionObserver`), alle als `type="module"` eingebunden und damit nicht render-blockierend. Es gibt keine Hinweise auf schwere synchrone Skripte oder Drittanbieter-Skripte, die den Hauptthread blockieren könnten. Das senkt tendenziell das Risiko für INP-Probleme, ersetzt aber keine echte Messung.

---

## Zusammenfassung nach Schweregrad

- **Critical:** keiner
- **High:** Hero-Karussell lädt alle fünf Motive beim ersten Seitenaufruf trotz `loading="lazy"` (Befund 2)
- **Medium:** überdimensionierte, ungenutzte `src`-Fallback-Bilder bei den fünf Hero-Motiven, ca. 3,6 MB toter Build-Gewicht (Befund 3)
- **Low:** gemeinsame, blockierende CSS-Datei ohne kritisches Inline-CSS (Befund 8)
- **Info/Gut:** korrekte LCP-Priorisierung des ersten Hero-Bilds (4), korrekte Bildmaße und Lazy-Loading bei Kartenbildern (5), sauberes Schriftladen ohne CLS (6), keine Anfragen an fremde Hosts (7), JPEG-Dateien nur für Social-Preview genutzt (9), INP nicht messbar/kein Anlass zur Sorge laut Code-Durchsicht (10)

## Verwendete Dateien

- Messskript: `/tmp/claude-0/-home-user-Youman-automation/44f7a235-8c9b-5e5b-a5d4-81ac137805fa/scratchpad/measure.js`
- Rohdaten (JSON, alle 46 Messläufe inkl. Einzelanfragen): `/tmp/claude-0/-home-user-Youman-automation/44f7a235-8c9b-5e5b-a5d4-81ac137805fa/scratchpad/results.json`
- Geprüfter Build: `/home/user/Youman-automation/youman-website/dist`
- Vorschauserver: `http://localhost:4321` (Astro-Preview, laufend während der Messung)
