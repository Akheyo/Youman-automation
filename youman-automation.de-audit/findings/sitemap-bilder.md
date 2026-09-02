# Sitemap und Bilder

Geprüft am gebauten Auslieferungsstand unter `dist/` (Build mit `SITE_URL=https://www.youman-automation.de`, `SITE_BASE=/`). Externe Abrufe waren in dieser Umgebung nicht möglich, daher wurden alle Aussagen aus dem Build selbst abgeleitet: `dist/sitemap-index.xml`, `dist/sitemap-0.xml`, `dist/robots.txt`, den 23 erzeugten HTML-Dateien, dem Quellcode unter `astro.config.mjs`, `src/data/*.ts`, `src/components/HeroSlider.astro`, `src/components/Bildplatz.astro` sowie den Dateien unter `dist/_astro`.

---

## Teil 1: Sitemap

### Ergebnis in Kürze

Die Sitemap ist wohlgeformt, vollständig und korrekt gefiltert. Es gibt keine Critical- oder High-Befunde.

### Befunde

**Info – XML wohlgeformt.**
`dist/sitemap-index.xml` und `dist/sitemap-0.xml` wurden mit `xmllint --noout` geprüft und sind beide syntaktisch fehlerfrei. Die Index-Datei verweist korrekt auf `sitemap-0.xml`, das `urlset` nutzt den Standard-Namensraum `http://www.sitemaps.org/schemas/sitemap/0.9`.

**Info – Adressanzahl stimmt mit den indexierbaren Seiten überein.**
`dist/sitemap-0.xml` enthält 20 `<loc>`-Einträge. Der Build erzeugt 23 HTML-Seiten. Die Differenz sind genau drei Seiten, die bewusst nicht indexiert werden sollen und korrekt fehlen:
- `dist/impressum/index.html` → `<meta name="robots" content="noindex, nofollow">`
- `dist/datenschutz/index.html` → `<meta name="robots" content="noindex, nofollow">`
- `dist/404.html` → `<meta name="robots" content="noindex, nofollow">`

Alle drei wurden im HTML-Quelltext gegengeprüft und tragen tatsächlich das noindex-Meta-Tag. Keine der drei Seiten steht in der Sitemap. Kein Widerspruch zwischen Sitemap-Eintrag und robots-Meta an anderer Stelle gefunden: die restlichen 20 Seiten haben durchweg `<meta name="robots" content="index, follow, ...">` oder kein einschränkendes robots-Tag.

Die Filterlogik dazu liegt in `astro.config.mjs` (Zeile 57f.):
```js
filter: (seite) =>
  INDEXIERUNG_ERLAUBT && !/\/(impressum|datenschutz)\/?$/.test(seite),
```
Das ist bewusst dokumentiert (Kommentar: „Seiten, die auf noindex stehen, gehoeren nicht in die Sitemap“) und funktioniert wie beschrieben.

**Info – Keine fehlenden Seiten.**
Alle 20 sitemapfähigen Seiten aus `src/pages` (Startseite, Branchen-Übersicht + 6 Branchendetailseiten, Case-Studies-Übersicht + 2 Fallstudien, Kontakt, Leistungen-Übersicht + 5 Leistungsdetailseiten, Münsterland, Über uns) tauchen in der Sitemap auf. Keine Seite fehlt, keine überzählige Adresse ist enthalten.

**Info – Adressen sind absolut und durchgehend https.**
Alle 20 `<loc>`-Werte beginnen mit `https://www.youman-automation.de/`. Kein `http://`-Link unter den Seiteneinträgen (die einzigen `http://`-Vorkommen in der Datei sind die XML-Namensraum-Deklarationen selbst, kein Bestandteil einer URL). Die kanonischen Links in den HTML-Seiten stimmen exakt mit den Sitemap-Adressen überein (per `grep` gegengeprüft, alle 22 nicht-404-Canonicals abgeglichen).

**Info – robots.txt verweist korrekt auf die Sitemap.**
```
User-agent: *
Allow: /

Sitemap: https://www.youman-automation.de/sitemap-index.xml
```
Absolute https-Adresse, korrekter Dateiname, zeigt auf die Index-Datei (nicht direkt auf `sitemap-0.xml`) – so, wie es sein soll.

**Info – Deprecated Tags korrekt weggelassen.**
Weder `priority` noch `changefreq` kommen in der Sitemap vor. Beide werden von Google ignoriert; ihr Fehlen ist kein Mangel, sondern korrekt.

**Info – Grenzwerte weit unterschritten.**
20 URLs, Dateigröße 1.909 Byte unkomprimiert. Weit unter den Grenzen von 50.000 URLs / 50 MB. Kein `news:`-Namensraum-Inhalt vorhanden, daher ist das 1.000-URL-Limit für News-Sitemaps hier nicht relevant.

**Info – Trailing Slash konsistent.**
`trailingSlash: 'ignore'` in der Astro-Konfiguration, aber sowohl Sitemap-Adressen als auch kanonische Links enden durchgehend auf `/`. Keine Duplicate-Content-Gefahr durch parallel existierende Adressen mit und ohne Schrägstrich in Sitemap oder Canonical-Tag erkennbar.

**Low – Kein lastmod gesetzt.**
Kein einziger `<url>`-Eintrag trägt ein `<lastmod>`. Das ist kein Fehler (Google kommt auch ohne lastmod zurecht), aber ein reales lastmod, das echte inhaltliche Änderungen abbildet, hilft Suchmaschinen bei der Crawl-Priorisierung, besonders bei künftigen Content-Updates. Empfehlung: `lastmod` über das Sitemap-Plugin ergänzen, gespeist aus einem echten Änderungsdatum je Seite (z. B. aus Frontmatter oder Git-Historie der Inhaltsdateien), nicht aus dem Build-Zeitstempel – ein bei jedem Build gleich aktualisiertes lastmod ist wertlos und kann von Google als unzuverlässig eingestuft und ignoriert werden.

### Was gut ist
- Sitemap und robots-Meta sind an einer einzigen Stelle (`sichtbarkeit.ts` + Sitemap-Filter) synchron gehalten, mit explizit dokumentierter Begründung, warum ein noindex-Widerspruch vermieden wird.
- Impressum und Datenschutz sind sauber ausgeschlossen, ohne dass die restliche Sitemap darunter leidet.
- Keine doppelten, keine relativen, keine http-Adressen.
- robots.txt und Sitemap-Referenz sind korrekt verdrahtet.

---

## Teil 2: Bilder

### Ergebnis in Kürze

Die Bild-Pipeline (Astro `<Image>`, zentrale Alt-Texte in `src/data`, `Bildplatz.astro`, `HeroSlider.astro`) ist sorgfältig gebaut: responsive Quellen, korrekt gesetzte Breite/Höhe, durchgängiges Lazy Loading unterhalb der Falz und eine bewusste LCP-Ausnahme für das erste Hero-Bild. Der größte reale Befund betrifft die Quelldateien der Branchen- und Leistungsmotive, die als PNG statt als Foto-taugliches Format vorliegen – das schlägt sich aber, weil Astro alles zu WebP umrechnet, nicht in der Auslieferung nieder, sondern in Repository-Größe und Build-Aufwand.

### Die zehn größten ausgelieferten Bilddateien (`dist/_astro`)

| # | Datei | Größe |
|---|-------|-------|
| 1 | `hero-2.Ss9t-9nN_ZL6gjz.webp` | 1.344 kB |
| 2 | `hero-1.pQIV6dTG_Z25M3fP.webp` | 1.131 kB |
| 3 | `hero-3.CqgPRd6h_V7Nop.webp` | 504 kB |
| 4 | `hero-2.Ss9t-9nN_eAqFG.webp` | 406 kB |
| 5 | `hero-5.TxeG7lQK_Z1aTIaa.webp` | 357 kB |
| 6 | `hero-4.Bq-QdXnz_Zven3C.webp` | 335 kB |
| 7 | `hero-1.pQIV6dTG_vCnI2.webp` | 328 kB |
| 8 | `hero-2.Ss9t-9nN_Z18c2Wj.webp` | 273 kB |
| 9 | `hero-1.pQIV6dTG_ZQa5TX.webp` | 200 kB |
| 10 | `hero-5.TxeG7lQK_2jjUIx.webp` | 176 kB |

Alle zehn größten Dateien sind Varianten der fünf Hero-Bilder. Das ist an sich unauffällig, weil Hero-Bilder großflächig und bildschirmfüllend sind. Auffällig sind Platz 1 und 2: Das sind keine srcset-Varianten, sondern die von Astro erzeugten Standard-`src`-Dateien der `<Image>`-Komponente, siehe Befund unten.

### Befunde

**Medium – Fallback-`src` der Hero-Bilder liegt in nativer Kameraauflösung, nicht in einer der genutzten Breiten.**
Im generierten HTML zeigt sich für jedes Hero-Bild ein `src`-Attribut zusätzlich zum `srcset`:
```html
<img src="/_astro/hero-2.Ss9t-9nN_ZL6gjz.webp"
     srcset="...640w, ...960w, ...1280w, ...1920w, ...2560w"
     sizes="100vw" ...>
```
Geprüft wurde die tatsächliche Pixelgröße der `src`-Datei (per WebP-Header ausgelesen, da kein ImageMagick/PIL in der Umgebung verfügbar war): `hero-2...ZL6gjz.webp` ist 6000×4000 Pixel, `hero-1...Z25M3fP.webp` ist 5184×3456 Pixel – exakt die Originalauflösung der Kamerafotos aus `src/assets/img`, nicht auf 2560 (die größte tatsächlich im `srcset` genutzte Breite) begrenzt. Daraus resultieren die beiden größten ausgelieferten Dateien mit 1.344 kB bzw. 1.131 kB.

Browser mit Unterstützung für `srcset`/`sizes` (praktisch alle aktuellen Browser) laden diese Datei nicht; sie wird nur als Fallback für Software ohne `srcset`-Unterstützung, für manche Vorschau-/Prefetch-Mechanismen oder bei direktem Aufruf der Bild-URL herangezogen. Trotzdem ist sie unnötig groß für ihren Zweck und liegt tot im Ausgabeordner.

*Beleg:* `identify`/`PIL` nicht verfügbar, daher WebP-Header manuell dekodiert (VP8X-Chunk): `hero-2...ZL6gjz.webp` → (6000, 4000) Px bei 1.344 kB; `hero-1...Z25M3fP.webp` → (5184, 3456) Px bei 1.131 kB. Der Quellcode in `src/components/HeroSlider.astro` übergibt `widths={[640, 960, 1280, 1920, 2560]}`, aber keine eigene `width`, wodurch Astro für den Fallback-`src` auf die Originalgröße zurückfällt.

*Empfehlung:* In `HeroSlider.astro` zusätzlich `width={2560}` (oder die größte tatsächlich benötigte Breite) an die `<Image>`-Komponente übergeben, damit auch der Fallback-`src` auf diese Breite begrenzt wird, statt implizit die volle Kameraauflösung zu übernehmen.

**Medium – Branchen- und Leistungsmotive liegen als PNG statt als fototaugliches Format vor.**
Alle fünf Hero-Fotos liegen als JPG vor (korrekt für Fotos). Die elf Branchen- und Leistungsmotive (`branche-*.png`, `leistung-*.png`) liegen dagegen als PNG vor, obwohl es sich inhaltlich um fotorealistische Motive handelt (Alt-Texte beschreiben reale Szenen: „Fertigungshalle mit einer eingehausten Montageanlage“, „Lkw mit geöffneter Plane an der Verladerampe“ usw.). PNG ist verlustfrei und für Fotos erheblich ineffizienter als JPEG/WebP.

Zahlen zum Vergleich, Größe pro Megapixel der Quelldatei:
- `branche-handwerk-und-bau.png`: 1.672×941 Px (1,57 MP), 1,9 MB Quelldatei → **≈ 1,21 MB/MP**
- `leistung-webseiten.png`: 1.536×1.024 Px (1,57 MP), 2,1 MB Quelldatei → **≈ 1,34 MB/MP**
- Alle elf Branchen-/Leistungs-PNGs liegen im Bereich 1,8–2,1 MB bei 1,4–1,7 MP, macht in Summe **≈ 20,9 MB** an Quelldateien für diese elf Motive.

Zum Vergleich die Hero-JPGs derselben Kategorie „Fotomotiv“:
- `hero-1.jpg`: 5.184×3.456 Px (17,9 MP), 2,4 MB → **≈ 0,13 MB/MP**
- `hero-2.jpg`: 6.000×4.000 Px (24,0 MP), 2,2 MB → **≈ 0,09 MB/MP**

Die PNG-Quellen sind damit pro Bildpunkt rund **10- bis 13-mal** so schwer wie die JPG-Quellen, bei gleichzeitig deutlich niedrigerer Auflösung.

Wichtig für die Einordnung: In der Auslieferung wirkt sich das kaum aus, weil Astro jedes Bild unabhängig vom Quellformat zu WebP umrechnet. Stichprobe: Die größte tatsächlich genutzte WebP-Variante von `leistung-webseiten.png` (1.440 px breit) liegt bei 102 kB (≈ 74 kB/MP), die vergleichbare Variante von `hero-2.jpg` (2.560 px breit) bei 406 kB (≈ 93 kB/MP) – also in derselben Größenordnung, kein 10-facher Unterschied mehr. Das eigentliche Format-Problem betrifft also nicht die live ausgelieferten Seiten, sondern:
- das Repository (≈ 21 MB zusätzliche Quelldateien allein durch die PNG-Wahl),
- die Build-Zeit (Sharp muss deutlich größere, verlustfrei komprimierte Dateien dekodieren),
- das Risiko, dass eine der PNG-Quellen einmal außerhalb der Astro-Pipeline verwendet wird (z. B. direkter Export, CMS-Anbindung, künftiges `getImage()`-Override) und dann ungebremst mit voller PNG-Größe ausgeliefert würde.

*Empfehlung:* Die elf Branchen-/Leistungsmotive nachträglich als hochwertiges JPEG (Qualität ~85–90) statt PNG ablegen, sofern es sich tatsächlich um Fotos/fotorealistische Renderings handelt und kein Bedarf an Transparenz oder verlustfreier Kantenschärfe (z. B. Text/Icons im Bild) besteht. PNG bleibt sinnvoll für Screenshots mit viel Fläche und wenigen Farben – die beiden `referenz-*.png` (Absolar, Drahtmüller) fallen in diese Kategorie und sind mit 60–64 kB bereits unauffällig klein.

**Info – Formate der Auslieferung sind zeitgemäß.**
`dist/_astro` enthält 95 WebP-Dateien und 13 JPEG-Dateien, keine unkomprimierten PNGs, kein GIF. Die 13 JPEGs sind ausschließlich die per `getImage({format: 'jpeg', width: 1200, height: 630, fit: 'cover'})` erzeugten OG-/Twitter-Vorschaubilder (`src/layouts/Base.astro`, Zeile 94) – das ist beabsichtigt, weil manche Plattformen bei Link-Vorschauen WebP nicht zuverlässig rendern, kein Versehen. Kein AVIF im Einsatz; AVIF wäre nochmals 15–25 % kleiner als WebP, ist aber kein Muss, da WebP breite Unterstützung hat (Info-Empfehlung, keine Pflicht).

**Info – Responsive Bildquellen werden korrekt erzeugt.**
Jedes über `<Image>` eingebundene Bild bekommt ein `srcset` mit mehreren Breiten sowie ein passendes `sizes`-Attribut:
- Hero-Bilder: `widths={[640, 960, 1280, 1920, 2560]}`, `sizes="100vw"` (volle Breite, korrekt für ein bildschirmfüllendes Hero).
- Kachelbilder über `Bildplatz.astro`: `widths={[480, 768, 1024, 1440]}`, `sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"` bzw. layoutabhängig `(min-width: 1024px) 50vw, 100vw` – stimmt mit dem tatsächlichen Kachel-Layout überein.

**Info – Breite und Höhe sind durchgehend gesetzt, kein Layout-Sprung zu erwarten.**
Alle geprüften `<img>`-Tags im Build tragen `width` und `height` mit dem echten Seitenverhältnis der Quelle (z. B. `width="6000" height="4000"` für Hero-2, `width="1536" height="1024"` für die Leistungsbilder). `Bildplatz.astro` reserviert zusätzlich per CSS `aspect-ratio` die Fläche, bevor ein Bild vorliegt – im Kommentar der Komponente ausdrücklich mit Ziel „CLS bleibt 0“ begründet, und das deckt sich mit dem, was im HTML ankommt.

**Info – Lazy Loading unterhalb der Falz ist konsequent gesetzt.**
Von 78 `<img>`-Tags im gesamten Build tragen 77 `loading="lazy"`, genau eines `loading="eager"`: das erste Hero-Bild auf der Startseite, zusätzlich mit `fetchpriority="high"` und `decoding="sync"` – korrektes Verhalten für das voraussichtliche LCP-Element. Die vier übrigen Hero-Bilder (nur sichtbar nach Nutzerinteraktion mit dem Slider) sind `loading="lazy"`, ebenso alle Kachelbilder auf Branchen-, Leistungs- und Case-Study-Seiten. Kein Bild ohne `loading`-Attribut gefunden.

**Info – Alt-Texte sind vorhanden, beschreibend und zentral gepflegt.**
Alt-Texte liegen wie vom Auftraggeber angegeben in `src/data/leistungen.ts`, `src/data/branchen.ts` und `src/data/caseStudies.ts` im Feld `bildAlt`, mit Kommentar „Bildbeschreibung: was zu sehen ist, nicht die Wiederholung des Titels“. Stichprobenprüfung bestätigt das:
- Leistung „Webseiten“ (Titel „Webseiten“): `bildAlt` = „Dieselbe Unternehmensseite nebeneinander auf einem Laptop und einem Tablet, davor ein Skizzenblock mit dem Aufbau der Seite.“
- Branche „Handwerk & Bau“: `bildAlt` = „Innenausbau im Rohbau: auf einem Arbeitstisch liegt ein Bauplan mit einem Tablet darauf, dahinter Ständerwerk, Leiter und Kappsäge.“
- Branche „Spedition & Logistik“: `bildAlt` = „Lkw mit geöffneter Plane an der Verladerampe, davor palettierte Ware auf einem Hubwagen, daneben ein Bildschirm mit Tourenliste und Karte.“

Keiner der geprüften Alt-Texte wiederholt den Seiten- oder Kachel-Titel, alle beschreiben den konkreten Bildinhalt in einem vollständigen Satz. Für die fünf Hero-Bilder ist `alt=""` (leer) bewusst gesetzt und im Komponentenkommentar begründet: „Die Bilder sind Stimmung, keine Information: Sie tragen ein leeres alt und werden Vorlesewerkzeugen damit nicht angesagt. Der Hero sagt in Text, worum es geht.“ Das ist korrektes Vorgehen für rein schmückende Hintergrundbilder nach WCAG.

**Info – Gesamtgewicht der Auslieferung ist niedrig.**
`dist/` insgesamt: 13 MB für 23 HTML-Seiten inklusive aller Bildvarianten, Schriftdateien und einem CSS-Bundle. `dist/_astro` allein: 12 MB. Das ist für eine bildlastige Unternehmensseite ein unauffälliger Wert; keine einzelne Seite lädt beim Erstaufruf mehr als eine passende srcset-Variante pro Bildplatz.

### Was gut ist
- Alt-Texte sind zentral, gepflegt, beschreibend, und die bewusste Ausnahme (leeres alt bei dekorativen Hero-Bildern) ist sauber dokumentiert und korrekt umgesetzt.
- Responsive Bildauslieferung, Lazy Loading und LCP-Optimierung sind konsistent und ohne Ausreißer über alle 23 Seiten hinweg umgesetzt.
- Breite und Höhe sind überall gesetzt, ergänzt um eine per CSS reservierte Fläche in `Bildplatz.astro` – Layout-Sprünge sind nicht zu erwarten.
- Trotz hochauflösender Quellfotos bleibt die Gesamtauslieferung mit 13 MB für die ganze Seite kompakt.
- OG-/Twitter-Vorschaubilder werden gezielt als JPEG erzeugt, statt versehentlich WebP zu verwenden, wo es Kompatibilitätsprobleme geben könnte.

---

## Zusammenfassung nach Schweregrad

| Schweregrad | Anzahl | Kurzfassung |
|---|---|---|
| Critical | 0 | – |
| High | 0 | – |
| Medium | 2 | Fallback-`src` der Hero-Bilder in nativer Kameraauflösung statt begrenzt auf 2560 px; Branchen-/Leistungsmotive als PNG statt fototaugliches Format (Quelldateien ≈10× schwerer pro Megapixel als die JPG-Heros, wirkt sich aber wegen der WebP-Umrechnung kaum auf die Auslieferung aus) |
| Low | 1 | Kein `lastmod` in der Sitemap |
| Info | 10 | Sitemap wohlgeformt, Adressanzahl korrekt, keine fehlenden Seiten, https/absolut, robots.txt korrekt verlinkt, keine deprecated Tags, Grenzwerte weit unterschritten, Trailing Slash konsistent, Formate der Auslieferung zeitgemäß, responsive Quellen korrekt, Breite/Höhe gesetzt, Lazy Loading konsequent, Alt-Texte vorhanden und beschreibend, Gesamtgewicht niedrig |
