# SEO-Audit: pizzeria-borken.de

- **Geprueft am:** 03.09.2026
- **Geprueft:** https://www.pizzeria-borken.de/ (Startseite, Impressum, Datenschutzerklaerung, robots.txt, Sitemap, HTTP-Header, Ladeverhalten aller 47 Subressourcen)
- **Technik-Stack:** WordPress 7.1, Theme `pizza-lite` (SKT Themes), Elementor 4.2.4, Yoast SEO, Google Site Kit, Usercentrics, Contact Form 7, Bestellsystem ueber foodbooking.com

> Hinweis zur Methode: Alle Angaben unten stammen aus dem tatsaechlich abgerufenen HTML und aus HTTP-Messungen. Ein Lab-Test der Core Web Vitals (Lighthouse/Chrome) war in dieser Umgebung nicht moeglich, der Browser hat keinen Netzzugang. Die Performance-Punkte sind deshalb aus Dateigroessen, Anzahl der Ressourcen und Blockierverhalten abgeleitet, nicht aus gemessenen LCP/CLS-Werten.

---

## Kurzfassung

Die Seite ist technisch sauber aufgesetzt (HTTPS, korrekte Weiterleitungen, Canonicals, Sitemap, strukturierte Daten vorhanden), scheitert aber an drei Dingen:

1. **Es gibt fast nichts zu ranken.** Die gesamte Website besteht aus drei URLs, davon zwei Rechtstexte. Die Startseite hat rund 111 Woerter sichtbaren Text. Die Speisekarte liegt komplett auf `foodbooking.com` -- auf der eigenen Domain existiert kein einziges Gericht als Text.
2. **Die strukturierten Daten enthalten falsche und richtlinienwidrige Angaben.** Die Oeffnungszeiten im Schema widersprechen den Zeiten auf der Seite, Ort und PLZ fehlen in der Adresse, und es ist eine selbst verfasste Bewertung der Inhaberin hinterlegt.
3. **Acht beworbene Liefergebiete haben null Seiten.** Borken, Gemen, Heiden, Raesfeld, Weseke, Ramsdorf, Burlo und Velen stehen nur in einer einzigen zusammengeklebten Ueberschrift.

Groesster Hebel: eine echte Speisekarten-Seite auf der eigenen Domain plus korrigierte Local-SEO-Daten.

---

## A. Kritisch -- zuerst angehen

### A1. Oeffnungszeiten im Schema widersprechen der Website
Die sichtbaren Zeiten und die Zeiten im `Restaurant`-Schema sind unterschiedlich. Google zieht sich die Zeiten fuer Knowledge Panel und lokale Suche bevorzugt aus dem Markup -- Kunden bekommen also potenziell falsche Zeiten angezeigt.

| Tag | Auf der Seite sichtbar | Im Schema hinterlegt |
|---|---|---|
| Mo / Di / Do | 11:30-14:30 und 17:30-22:00 | 12:00-15:00 und 17:00-22:00 |
| Mittwoch | 17:00-22:00 | 17:00-**20:00** |
| Fr / Sa / So + Feiertage | 11:30-22:00 | 12:00-22:00 |

**Zu tun:** Eine Quelle festlegen (die tatsaechlichen Zeiten), dann Website, Schema und Google Business Profile angleichen.

### A2. Selbst verfasste Bewertung im strukturierten Datensatz
Im `Restaurant`-Schema steht eine `review` mit `ratingValue: 4` und `author: "Veena Kanwal"`. Laut Impressum ist Veena Kanwal die Betreiberin. Selbst erstellte Bewertungen im eigenen Markup verstossen gegen Googles Richtlinien fuer strukturierte Daten ("self-serving reviews") und koennen zu einer manuellen Massnahme fuehren, die alle Rich Results der Domain entfernt.

**Zu tun:** Den `review`-Block ersatzlos entfernen. Wer Sterne in den Suchergebnissen will, sammelt echte Bewertungen im Google Business Profile -- die erscheinen ohnehin in der lokalen Suche, ganz ohne Markup.

### A3. Adresse im Schema unvollstaendig
```json
"address": { "streetAddress": "Brinkstr. 42", "addressLocality": "", "addressRegion": "NRW", "postalCode": "", "addressCountry": "Germany" }
```
`addressLocality` und `postalCode` sind leer, obwohl "46325 Borken" im Impressum steht. Damit ist die Adresse fuer Google praktisch wertlos -- ausgerechnet bei einem Betrieb, dessen komplettes Geschaeft lokal ist.

**Zu tun:** `addressLocality: "Borken"`, `postalCode: "46325"`, `addressCountry: "DE"` (ISO-Code statt "Germany") eintragen.

### A4. Kein Speisekarten-Content auf der eigenen Domain
Alle 10 Bestell-Links zeigen auf `https://www.foodbooking.com/api/fb/k_qvpg`. Auf `pizzeria-borken.de` existiert kein Gericht, kein Preis, keine Kategorie als Text. Suchanfragen wie *"Pizza Borken bestellen"*, *"indischer Lieferservice Borken"*, *"Pizzeria Borken Speisekarte"* oder *"Chicken Tikka Masala Borken"* haben schlicht keine Zielseite.

**Zu tun:** Eine eigene Seite `/speisekarte/` mit den Kategorien als echtem HTML-Text (Pizza, Pasta, indische Gerichte, Schnitzel, Getraenke, Beilagen), pro Kategorie eine Ueberschrift und die Gerichte mit Namen und Preis. Der Bestell-Button darf weiter zu foodbooking zeigen -- der Text muss aber auf der eigenen Domain stehen. Ergaenzend `hasMenuSection`/`hasMenuItem` im Schema.

### A5. Duenne Startseite
Rund **111 Woerter** sichtbarer Text auf der wichtigsten URL der Domain. Fuer eine lokal umkaempfte Nische ist das zu wenig, um fuer irgendetwas ausser dem Markennamen zu ranken.

**Zu tun:** 400-600 Woerter, die die tatsaechlichen Suchintentionen abdecken: Was wird gekocht, seit wann gibt es den Betrieb, wohin wird geliefert, ab wann kostenlos, wie lange dauert die Lieferung, welche Zahlarten, Abholung moeglich, Adresse und Anfahrt.

---

## B. Wichtig -- mittlerer Aufwand, klarer Effekt

### B1. Nur drei URLs im Index-Potenzial
Die Sitemap (`page-sitemap.xml`) enthaelt exakt:
- `/` (zuletzt geaendert 04.06.2024)
- `/datenschutzerklaerung/`
- `/impressum/`

Zwei davon sind Rechtstexte, die nie Traffic bringen. Es gibt keine Blogbeitraege, keine Kategorien, keine Leistungsseiten.

### B2. Keine Seiten fuer die acht Liefergebiete
Auf der Startseite steht die Ueberschrift *"Ihre Pizzeria in der NaeheLieferdienste Borken Gemen Heiden Raesfeld Weseke Ramsdorf Burlo Velen"* -- acht Ortsnamen in einer Zeile, ohne Leerzeichen zwischen den beiden Teilen und ohne jede weitere Erwaehnung im Text.

**Zu tun:** Pro relevantem Ort eine eigene Landingpage (`/lieferservice-gemen/`, `/lieferservice-heiden/` usw.) mit ortsspezifischem Inhalt: Lieferzeit dorthin, Mindestbestellwert, belieferte Strassenzuege/Ortsteile. Wichtig: echte Unterschiede pro Seite, keine kopierten Textbausteine mit ausgetauschtem Ortsnamen -- das wertet Google als Doorway Pages ab. Lieber vier gute Ortsseiten als acht identische.

### B3. Ueberschriftenstruktur fehlerhaft
Reihenfolge im Quelltext: `H2` -> `H3` -> `H2` -> **`H1`** -> `H2` -> `H2` -> `H3` -> `H3` -> `H2` -> `H4`.

- Vor der einzigen `H1` stehen bereits drei Ueberschriften.
- Die `H1` lautet nur "Pizzeria Borken" -- kein Keyword, keine Leistung, kein Ort ueber den Markennamen hinaus.
- Die `H2` "Ihre Pizzeria in der NaeheLieferdienste Borken..." ist aus zwei Textbausteinen ohne Trennzeichen zusammengesetzt.

**Zu tun:** `H1` auf etwas wie "Pizzeria Borken -- Lieferservice fuer Pizza, indische und deutsche Kueche" aendern, an den Seitenanfang ziehen, die dekorativen Ueberschriften im Header auf `<div>`/`<p>` umstellen, die zusammengeklebte `H2` trennen.

### B4. NAP-Daten nicht auf der Startseite
Adresse und E-Mail stehen ausschliesslich im Impressum. Auf der Startseite ist nur die Telefonnummer zu finden. Fuer lokale Rankings sollten Name, Adresse und Telefonnummer im Footer jeder Seite stehen -- in identischer Schreibweise wie im Google Business Profile.

Zusaetzlich uneinheitlich: die Nummer erscheint als `+492861603336`, als "02861 / 60 33 36" und als "Telefon:  02861 60 33 36" (mit doppeltem Leerzeichen). Die zweite Bestellnummer 02861 / 60 33 38 taucht im Schema gar nicht auf.

### B5. Schema-Bloecke nicht miteinander verknuepft
Die Seite liefert zwei getrennte JSON-LD-Bloecke: den Yoast-Graph (`WebPage`, `WebSite`, `Organization`, `BreadcrumbList`) und einen handgeschriebenen `Restaurant`-Block. Der `Restaurant`-Block hat keine `@id` und ist mit nichts verknuepft. Google sieht damit zwei mutmasslich verschiedene Entitaeten auf einer Seite.

**Zu tun:** Den `Restaurant`-Block ueber `@id` als die Organisation der Seite ausweisen (bzw. Yoast so konfigurieren, dass es selbst `Restaurant` statt `Organization` ausgibt) und ergaenzen:
- `sameAs`: Google Business Profile, Facebook, Instagram
- `areaServed`: die acht Liefergebiete
- `priceRange`: `"€€"` statt `"$"` (aktuell US-Notation)
- `hasMenu` bzw. spaeter die eigene Speisekarten-URL
- `potentialAction` vom Typ `OrderAction` fuer den Bestell-Link

### B6. Fehlende Meta-Descriptions
Impressum und Datenschutzerklaerung haben keine `meta description`. Unkritisch fuer Rankings, aber Google baut sich dann selbst Snippets zusammen.

---

## C. Technik und Performance

### C1. Ressourcen-Overhead
47 Subressourcen, zusammen rund **380 KB komprimiert**, plus 53 KB HTML -- fuer eine Seite mit 111 Woertern Text.

| Datei | Groesse | Anmerkung |
|---|---|---|
| `skt-templates/css/templaters.css` | 65,4 KB | Groesste Einzeldatei der Seite. Plugin-CSS eines Template-Importers, im Frontend hoechstwahrscheinlich unnoetig. |
| `Pizzeria_Borken_1000px.png` (Logo) | 42,4 KB | PNG mit 1010x276 px, kein WebP, kein `srcset`. |
| `jquery.min.js` + `jquery-migrate` + `jquery-ui/core` | 43,2 KB | jQuery Migrate ist ein reines Kompatibilitaets-Shim und gehoert im Live-Betrieb deaktiviert. |
| 9 Zahlungsart-SVGs | ~93 KB | Allein `WW-Diners-Club-text-alt.svg` ist 27 KB. Unoptimierte SVG-Exporte. |

**19 Stylesheets und 14 Scripts**, davon nur 2 Scripts mit `defer`/`async` -- der Rest blockiert das Rendering. Keine `preconnect`/`dns-prefetch`-Hinweise, obwohl auf drei Fremd-Hosts zugegriffen wird (`usercentrics.eu`, `fbgcdn.com`, `maps.google.com`).

**Zu tun:** SKT-Templates-CSS im Frontend abwaehlen (oder Plugin deaktivieren, wenn nur zum Import genutzt), jQuery Migrate abschalten, SVGs durch SVGO jagen, Logo als WebP in Anzeigegroesse, Zahlungs-Icons zu einem einzigen Sprite zusammenfassen, `preconnect` fuer die drei Fremd-Hosts setzen.

### C2. Bilder ohne Groessenangaben
11 der 14 `<img>`-Elemente haben kein `width`/`height`. Da alle im sichtbaren Bereich nachgeladen werden, ist Layout-Shift (CLS) sehr wahrscheinlich -- CLS ist ein Core-Web-Vitals-Rankingfaktor.

Ausserdem hat **kein einziges** Bild `loading="lazy"`; lazy geladen wird nur das Google-Maps-iframe.

**Zu tun:** `width`/`height` (oder `aspect-ratio` per CSS) auf allen Bildern setzen, alles unterhalb des ersten Bildschirms auf `loading="lazy"`, das Logo bewusst `loading="eager"` + `fetchpriority="high"` lassen.

### C3. Caching praktisch deaktiviert
```
cache-control: max-age=3, must-revalidate
x-cache-status: MISS
```
Drei Sekunden Cache-Lebensdauer fuer eine Seite, die zuletzt im Juni 2024 inhaltlich geaendert wurde. Der Plesk-Cache liefert dauerhaft MISS, jeder Aufruf geht durch PHP. Gemessene TTFB: **0,52 s**.

**Zu tun:** Page-Cache im Plesk/Nginx-Layer aktivieren, `max-age` fuer statische Assets auf ein Jahr mit Versionsstempel. Damit ist TTFB unter 200 ms realistisch.

### C4. Kleinere Punkte
- Kein `Strict-Transport-Security`-Header.
- Kein `<nav>`-Element; das Menue ist ein `<div>`, der Hamburger-Link hat `href="#"`.
- Zwei Bilder mit leerem `alt` (`call-for-order-icon.png`, `bike-img.png`). Bei rein dekorativen Icons ist das korrekt -- beim Liefer-Fahrrad-Bild sollte geprueft werden, ob es Inhalt transportiert.
- Die externen Links zu foodbooking, App Store und Play Store haben weder `target="_blank"` noch `rel`. Bei Absprung in den Bestellprozess ist das eher ein UX- als ein SEO-Thema, sollte aber bewusst entschieden sein.
- `<meta name="generator" content="WordPress 7.1">` gibt die exakte Version preis (Sicherheit, nicht SEO).

---

## D. Was bereits richtig laeuft

- HTTPS mit HTTP/2, gzip aktiv.
- Alle vier Domain-Varianten (`http://`, `https://`, mit und ohne `www`, sowie `/index.php`) leiten mit genau einer 301-Weiterleitung auf `https://www.pizzeria-borken.de/` -- sauber, keine Weiterleitungsketten.
- `robots.txt` vorhanden, gibt alles frei und verweist auf die Sitemap.
- Nicht existierende URLs liefern korrekt HTTP 404.
- Selbstreferenzierende Canonicals auf allen drei Seiten.
- `lang="de"`, `charset=UTF-8`, Viewport-Meta gesetzt.
- Vollstaendige Open-Graph- und Twitter-Card-Tags inklusive Bildmassen.
- Favicons in allen relevanten Groessen inklusive Apple-Touch-Icon.
- Titel der Startseite mit 61 Zeichen und Meta-Description mit 140 Zeichen liegen beide im optimalen Bereich und enthalten Ort sowie Zahlarten.
- Google Site Kit ist eingebunden -- Search-Console-Daten sollten also bereits vorliegen.

---

## E. Empfohlene Reihenfolge

| # | Massnahme | Aufwand | Effekt |
|---|---|---|---|
| 1 | `review`-Block aus dem Schema loeschen | 10 Min | Risiko einer manuellen Massnahme faellt weg |
| 2 | Oeffnungszeiten vereinheitlichen (Seite / Schema / Google Business Profile) | 30 Min | Korrekte Anzeige in der lokalen Suche |
| 3 | PLZ und Ort ins Adress-Schema, `priceRange` auf `€€`, `addressCountry` auf `DE` | 15 Min | Local Pack |
| 4 | Seite `/speisekarte/` mit echtem Textinhalt | 1 Tag | Groesster Ranking-Hebel |
| 5 | Startseite auf 400-600 Woerter, `H1` korrigieren, NAP in den Footer | 3 Std | Relevanz + Local SEO |
| 6 | Caching aktivieren, `templaters.css` und jQuery Migrate entfernen | 2 Std | Ladezeit, Core Web Vitals |
| 7 | `width`/`height` + `loading="lazy"` auf allen Bildern, SVGs optimieren | 2 Std | CLS, Ladezeit |
| 8 | 3-4 Ortsseiten mit echtem, unterschiedlichem Inhalt | 2 Tage | Reichweite im Umland |
| 9 | `sameAs`, `areaServed`, `OrderAction` im Schema ergaenzen | 1 Std | Entitaets-Verstaendnis |

---

## F. Nicht geprueft

Ausserhalb dessen, was von aussen aus dem HTML ablesbar ist:

- Gemessene Core Web Vitals (LCP, INP, CLS) aus Feld- oder Labordaten
- Google-Search-Console-Daten: tatsaechliche Indexierung, Impressionen, Klicks, Suchanfragen
- Google Business Profile: Vollstaendigkeit, Kategorien, Fotos, Bewertungen, Beitraege
- Backlinkprofil und lokale Verzeichniseintraege (Branchenbuecher, Gelbe Seiten, Lieferando & Co.)
- Wettbewerbsvergleich zu anderen Lieferdiensten in Borken
- Verhalten der Seite auf echten mobilen Geraeten
