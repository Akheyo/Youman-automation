# Technisches SEO Audit: youman-automation.de

Geprüft gegen den gebauten Auslieferungsstand unter `youman-website/dist` (23 HTML-Dateien, Build mit `SITE_URL=https://www.youman-automation.de` und `SITE_BASE=/`, also identisch zur veröffentlichten Fassung) sowie ergänzend gegen den lokalen Vorschauserver unter `http://localhost:4321`. Die Live-Seite war in dieser Sitzung nicht erreichbar, alle Angaben zu tatsächlich ausgelieferten HTTP-Kopfzeilen, TLS-Konfiguration und Ladezeiten im Feld sind entsprechend als nicht prüfbar gekennzeichnet.

Zusätzlich zur eigenen Prüfung wurde `node .claude/skills/seo-youman/scripts/statisch.mjs youman-website/dist` ausgeführt (Ergebnis unten) sowie Kennzahlen verwendet, die vom koordinierenden Agenten bereitgestellt und stichprobenartig gegen den Quellcode nachgezählt wurden (Titel- und Beschreibungslängen deckungsgleich mit dem Skriptlauf, eingehende Verweise für `/muensterland/`, `/kontakt/` und `/case-studies/absolar-warenwirtschaft/` per `grep` nachgezählt und bestätigt).

Die Seite ist ein statisch gebautes Astro-Projekt (`output: 'static'`), veröffentlicht über GitHub Pages. Das bestimmt den Rahmen der Bewertung: eigene HTTP-Kopfzeilen sind auf dieser Plattform grundsätzlich nicht setzbar, das wird unten entsprechend eingeordnet statt als Mangel gewertet.

## Ergebnis des statischen Prüfskripts

23 Seiten geprüft (20 indexierbar, 3 auf noindex: `/impressum/`, `/datenschutz/`, `/404.html`), Sitemap mit 20 Adressen, **keine Befunde**. Das deckt bereits ab: Titel- und Beschreibungslängen, doppelte Titel/Beschreibungen/h1 unter den indexierbaren Seiten, fehlende oder relative canonicals, Gliederungssprünge, Bilder ohne alt, ungültige strukturierte Daten, tote interne Verweise (`href="/..."` gegen tatsächlich gebaute Dateien) und Widersprüche zwischen Sitemap und noindex.

---

## Befunde

### Critical

Keine.

### High

Keine.

### Medium

**M1. Jede Seite ist unter zwei URL-Formen erreichbar, nur durch canonical vereinheitlicht, nicht durch Weiterleitung.**
Beleg: `astro.config.mjs` setzt `trailingSlash: 'ignore'`. Die interne Navigation verlinkt ohne abschließenden Schrägstrich, z. B. `src/components/Header.astro` und `src/data/navigation.ts`: `href="/branchen"`, `href="/leistungen/webseiten"`, `href="/kontakt"`. Der canonical-Tag derselben Seiten lautet dagegen mit Schrägstrich, z. B. `dist/branchen/index.html`: `<link rel="canonical" href="https://www.youman-automation.de/branchen/">`. Am lokalen Vorschauserver antworten beide Formen mit HTTP 200 ohne Weiterleitung dazwischen (`/branchen` und `/branchen/` beide 200, kein 301/308 auf dem Weg).
Auswirkung: Für Suchmaschinen und für jeden, der einen internen Link kopiert oder teilt, existieren pro Seite zwei crawlbare Adressen. Der canonical-Tag fängt das zwar für die Indexierung ab, aber Linksignale streuen sich auf zwei URL-Formen, und ob GitHub Pages dieses Verhalten dauerhaft beibehält (statt künftig doch weiterzuleiten oder eine der beiden Formen mit 404 zu beantworten), ist plattformseitig nicht zugesichert.
Empfehlung: Interne Links durchgängig in der canonical-Form mit abschließendem Schrägstrich setzen (`withBase()` in `src/lib/url.ts` entsprechend anpassen oder an den Aufrufstellen die Pfade mit `/` enden lassen). Das ist eine kleine, risikoarme Änderung, weil sie nur Linktexte betrifft, keine Seitenstruktur.

**M2. IndexNow ist nicht eingerichtet.**
Beleg: Kein Treffer für „indexnow“ im gesamten Projekt (`grep -ril indexnow` liefert nichts), kein Schlüssel-Endpunkt unter `dist/`.
Auswirkung: Bing, Yandex und weitere IndexNow-Teilnehmer erfahren von neuen oder geänderten Seiten erst beim nächsten regulären Crawl, nicht sofort. Bei einer neuen Domain mit noch dünnem Backlink-Profil verlängert das die Zeit bis zur Aufnahme spürbar. Für Google ist das ohne Wirkung, Google nutzt IndexNow nicht.
Empfehlung: Im Deploy-Workflow (`.github/workflows/youman-website-pages.yml`) nach dem erfolgreichen Deploy einen Schritt ergänzen, der die URLs aus `sitemap-0.xml` an `https://api.indexnow.org/indexnow` meldet. Dafür wird eine Schlüsseldatei unter `dist/<schlüssel>.txt` benötigt, die zum Schlüssel im Aufruf passt. Kein Pflichtbestandteil, aber mit wenig Aufwand umsetzbar und für eine junge Domain nützlich.

### Low

**L1. Beschreibung der Kontaktseite mit 89 Zeichen die kürzeste im Bestand.**
Beleg (aus der bereitgestellten Übersicht, deckungsgleich mit dem Skriptlauf): `/kontakt/` Titel 49 / Beschreibung 89 Zeichen. Alle anderen Seiten liegen zwischen 117 und 164 Zeichen. Die projekteigene Regel in `statisch.mjs` verlangt mindestens 70 Zeichen, das ist erfüllt, die Beschreibung ist also nicht fehlerhaft, nur ungewöhnlich knapp im Vergleich zum Rest.
Auswirkung: Google schreibt sich bei knappen Beschreibungen häufiger eine eigene aus dem Seitentext zusammen, dadurch geht die Kontrolle über den Anzeigetext im Suchergebnis verloren. Die Kontaktseite bekommt laut den bereitgestellten Zahlen mit 189 eingehenden internen Verweisen mit Abstand die meiste interne Verlinkung aller Seiten, das macht sie zu einer der Seiten, die am ehesten in den Suchergebnissen auftaucht, gerade dort lohnt sich eine ausformulierte Beschreibung.
Empfehlung: Auf 120 bis 160 Zeichen erweitern, etwa mit einem Hinweis auf Reaktionszeit, Terminbuchung oder was beim Erstkontakt zu erwarten ist.

**L2. Zwei Referenzseiten mit auffällig wenig interner Verlinkung, ohne Querverweis untereinander.**
Beleg: laut bereitgestellter Übersicht `/case-studies/absolar-warenwirtschaft/` 4 eingehende Verweise, `/case-studies/drahtmueller-palettenoptimierung/` 5, beides per `grep` gegen `dist/` nachgezählt und bestätigt. Zusätzlich eigene Prüfung: `dist/case-studies/absolar-warenwirtschaft/index.html` verlinkt nicht auf die Schwesterseite `drahtmueller-palettenoptimierung`, obwohl beide dieselbe Rubrik sind (`grep -o 'href="/case-studies/[^"]*"' case-studies/absolar-warenwirtschaft/index.html` liefert keinen Treffer auf die andere Case Study).
Auswirkung: Referenzseiten sind erfahrungsgemäß starke Vertrauenssignale mit gutem Konversionspotenzial, bekommen hier aber die schwächste interne Anbindung im gesamten Bestand. Das schwächt sowohl ihre Auffindbarkeit als auch die Chance, dass Besucher von einer Case Study zur anderen weiterlesen.
Empfehlung: Auf jeder Case-Study-Seite einen Verweis auf die jeweils andere ergänzen („Ähnliches Projekt“ oder vergleichbar), und von den passenden Leistungs- oder Branchenseiten aus gezielt auf die thematisch passende Case Study verlinken, statt nur über die Übersichtsseite `/case-studies/`.

**L3. `/muensterland/` nur in der Fußzeile verlinkt, entsprechend am Rand der internen Linkstruktur.**
Beleg: `src/data/navigation.ts` trägt den Eintrag mit `nurFooter: true`, laut bereitgestellter Übersicht 25 eingehende Verweise (durch `grep` bestätigt), das ist die zweitniedrigste Zahl unter allen indexierbaren Seiten nach den Case Studies.
Einordnung: Das kann eine bewusste Entscheidung sein, wenn die Seite bewusst nicht in der Hauptnavigation stehen soll. Als technischer Befund trotzdem der Vollständigkeit halber genannt, weil regionale Landingpages von stärkerer interner Verlinkung üblicherweise besonders profitieren.
Empfehlung: Prüfen, ob ein zusätzlicher Verweis von einer oder zwei thematisch passenden Branchen- oder Leistungsseiten aus sinnvoll ist, falls die Seite für lokale Sichtbarkeit im Münsterland eine aktive Rolle spielen soll.

**L4. Keine der beiden meta-basierten Sicherheitsangaben gesetzt, die auf GitHub Pages ohne eigene Kopfzeilen trotzdem möglich wären.**
Beleg: `src/layouts/Base.astro`, Kopfbereich (Zeilen 257 bis 312), enthält `charset`, `viewport`, `theme-color`, aber weder ein `<meta http-equiv="Content-Security-Policy">` noch ein `<meta name="referrer">`.
Einordnung: GitHub Pages liefert ausschließlich statische Dateien aus und erlaubt keine eigenen HTTP-Antwortkopfzeilen (kein `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`, `Strict-Transport-Security` oder klassisches `Content-Security-Policy` per Kopfzeile), das ist eine Plattformgrenze und kein Konfigurationsfehler dieser Seite. Über `<meta>`-Tags im HTML lassen sich davon nur zwei Dinge teilweise nachbilden: eine `Content-Security-Policy` (allerdings ohne `frame-ancestors`, das wirkt nur über die Kopfzeile, ein Meta-CSP schützt also nicht vor Clickjacking) und `<meta name="referrer">`.
Angesichts des geringen Angriffsflächen (keine Anmeldung, keine Cookies, keine Drittanbieter-Skripte außer dem POST-Ziel des Kontaktformulars zu web3forms.com, siehe „Was gut ist“) ist der praktische Nutzen gering, deshalb Einstufung Low statt höher.
Empfehlung: Optional eine Meta-CSP ergänzen, die nur `self` sowie den bekannten Formular-Endpunkt erlaubt, als zusätzliche Absicherung falls künftig weitere Skripte hinzukommen. Kein dringender Schritt.

**L5. canonical auf der 404-Seite verweist auf sich selbst.**
Beleg: `dist/404.html` trägt `<link rel="canonical" href="https://www.youman-automation.de/404/">` bei gleichzeitigem `<meta name="robots" content="noindex, nofollow">`.
Auswirkung: Praktisch folgenlos, weil die Seite ohnehin auf noindex steht, aber unüblich: Fehlerseiten bekommen üblicherweise gar keinen canonical, weil es keine „richtige“ Version dieser Adresse gibt, auf die verwiesen werden könnte.
Empfehlung: Kein Handlungsbedarf, nur zur Vollständigkeit genannt. Falls die Vorlage (`Base.astro`) ohnehin einmal angefasst wird, könnte der canonical für noindex-Seiten optional weggelassen werden.

### Info

**I1. Kein `hreflang` vorhanden, korrekt für eine einsprachige Seite.** Die gesamte Seite ist auf `lang="de"` und richtet sich ausschließlich an ein deutschsprachiges Publikum (`inLanguage: 'de-DE'` in den strukturierten Daten, keine Sprachumschaltung, keine Ländervarianten). Ohne mehrsprachige Varianten wäre ein `hreflang` gegenstandslos, das Fehlen ist hier also kein Mangel. Eine Detailprüfung nach den Regeln der `seo-hreflang`-Teilkompetenz ist entsprechend nicht einschlägig.

**I2. AI-Crawler werden nicht gesondert eingeschränkt, dafür existiert eine `llms.txt`.** `robots.txt` enthält nur `User-agent: * / Allow: /`, keine gezielten Einträge für GPTBot, ClaudeBot, PerplexityBot oder vergleichbare Token. Das ist eine gültige Entscheidung (volle Zugänglichkeit statt Sperrung), keine Auslassung. Ergänzend liegt unter `dist/llms.txt` eine strukturierte Kurzfassung des Angebots mit Verweisen auf alle Leistungs-, Branchen- und Referenzseiten, das unterstützt die Auffindbarkeit durch KI-gestützte Systeme zusätzlich zur klassischen Suche.

**I3. E-Mail-Adresse in Kontaktdaten und strukturierten Daten läuft auf `.com`, die Website auf `.de`.** Beleg: `src/data/kontakt.ts`, `EMAIL = 'info@youman-automation.com'`, erscheint entsprechend in `organisation.email` und `contactPoint.email` im JSON-LD jeder Seite, während die Domain `youman-automation.de` lautet. Kein technischer SEO-Fehler, nur als Auffälligkeit vermerkt, falls die Abweichung kein Absicht ist.

**I4. HTTPS-Durchsetzung und tatsächlich ausgelieferte HTTP-Kopfzeilen nicht prüfbar.** `astro.config.mjs` erzwingt im Build selbst `https://` in `SITE`, unabhängig davon, was GitHub Pages meldet (dokumentiert im Quellcode). Ob „Enforce HTTPS“ in den Pages-Einstellungen aktuell aktiv ist, ob GitHub Pages für die eigene Domain tatsächlich `Strict-Transport-Security` ausliefert, und ob die dokumentierte Weiterleitung von `youman-automation.de` auf `www.youman-automation.de` (siehe `.github/workflows/domain-setzen.yml`) live funktioniert, lässt sich ohne Zugriff auf die veröffentlichte Seite nicht prüfen. Empfehlung: bei nächster Gelegenheit mit Zugriff auf die Live-Seite per `curl -I` gegenzuprüfen.

**I5. Core Web Vitals nur aus dem Quelltext abgeschätzt, keine Feld- oder Labordaten.** Es standen weder PageSpeed Insights/CrUX-Daten noch ein Lighthouse-Lauf zur Verfügung, LCP, INP und CLS in Zahlen sind daher nicht prüfbar. Die Einschätzung unten beruht ausschließlich auf Auffälligkeiten im HTML/CSS. Empfehlung: `browser-pruefungen.mjs` aus dem seo-youman-Skill bei nächster Gelegenheit laufen lassen (braucht den Vorschauserver und Playwright, misst laut Skill-Dokumentation unter anderem Layout-Sprung und Ladezeit über mehrere Breiten), das war in dieser Sitzung nicht Teil des Auftrags und wurde nicht ausgeführt.

---

## Kategorien im Überblick

**Crawlability:** Bestanden. `robots.txt` erlaubt alles und nennt die Sitemap korrekt (`https://www.youman-automation.de/sitemap-index.xml`), keine veraltete oder widersprüchliche Angabe gefunden. `sitemap-index.xml` verweist auf genau eine `sitemap-0.xml` mit 20 Adressen, die exakt den 20 indexierbaren Seiten entsprechen, keine noindex-Seite und keine 404-Seite darin.

**Indexability:** Bestanden, mit Anmerkung L1 zur Kontaktseite. Canonicals durchgängig absolut, https, ohne Widerspruch zur eigenen Adresse. Keine Duplikate bei Titel, Beschreibung oder h1 unter den 20 indexierbaren Seiten. `/impressum/` und `/datenschutz/` korrekt auf noindex, weil dort laut Seiteninhalt noch Rechtstexte fehlen (Platzhalter-Hinweis im ausgelieferten HTML nachgelesen), und konsequent aus der Sitemap ausgeschlossen (Filter in `astro.config.mjs`).

**Security:** Realistisch bewertet, siehe L4 und I4. Innerhalb dessen, was GitHub Pages als reiner statischer Host zulässt, sind keine zusätzlichen Schritte zwingend erforderlich.

**URL-Struktur:** Sauber, sprechend, konsistent kleingeschrieben mit Bindestrichen, klare zweistufige Hierarchie (`/branchen/<branche>/`, `/leistungen/<leistung>/`, `/case-studies/<projekt>/`). Einzige Auffälligkeit die doppelte Erreichbarkeit mit/ohne Schrägstrich, siehe M1. Keine Weiterleitungsketten im Quelltext oder am Vorschauserver feststellbar; die im Workflow dokumentierte Domain-Weiterleitung (Apex auf `www`) selbst nicht live nachprüfbar (siehe I4).

**Mobile:** Bestanden. Korrektes `<meta name="viewport" content="width=device-width, initial-scale=1">` auf jeder Seite. Bedienelemente in `Header.astro` durchgängig mit `min-h-11` (44px) bis `min-h-12` (48px) ausgezeichnet, das erfüllt gängige Touch-Target-Empfehlungen. Navigation kollabiert unterhalb von `xl` in ein Vollbildmenü statt eine zu enge Leiste zu erzwingen.

**Core Web Vitals (Quelltext-Indizien, siehe I5):** Das Hero-Bild der Startseite ist mit `fetchpriority="high"`, `loading="eager"` und passendem `srcset` (640w bis 2560w) für LCP ausgezeichnet, alle anderen Bilder mit `loading="lazy"`. Die drei eingesetzten Schriftschnitte (Newsreader, Lexend, Source Sans 3, je als variable Schrift in einer Datei) sind mit `<link rel="preload">` und `crossorigin` vorab angemeldet, zusammen rund 124 KB. Ein Kommentar in `Base.astro` dokumentiert einen früher gemessenen CLS von 0,103 auf `/ueber-uns` vor Einführung dieses Preloads, das liegt über dem Schwellenwert von 0,1 für „Gut“, wurde aber durch die jetzige Maßnahme adressiert; ob der Wert aktuell wieder im grünen Bereich liegt, ist ohne Messung nicht bestätigbar. `<img>`-Elemente tragen durchgängig `width`/`height`, das beugt zusätzlichem Layout-Sprung vor. Kein INP-relevantes schweres JavaScript gefunden, siehe „JavaScript-Rendering“.

**Structured Data:** Bestanden. Jede Seite trägt gültiges JSON-LD mit `@context` und durchgängig gesetztem `@type` (vom Skript geprüft), im `@graph` je nach Seitentyp `Organization`/`ProfessionalService`, `WebSite`, `BreadcrumbList`, zusätzlich `Article` auf den Case Studies und `Service` auf den Leistungsseiten. Bewusst weggelassene Felder (kein `logo`, kein `datePublished` ohne Datum, kein `Offer` ohne Preis, keine erfundenen Öffnungszeiten) sind im Quelltext begründet und stimmen mit der SEO-Regel überein, dass fehlende Angaben besser sind als erfundene.

**JavaScript-Rendering:** Bestanden, kein Rendering-Bedarf. `output: 'static'` in `astro.config.mjs`, sämtlicher Seiteninhalt liegt vollständig im ausgelieferten HTML, keine clientseitige Hydration von Inhalten. Das wenige eingebundene JavaScript (Header-Dropdowns, Vollbildmenü, Einblenden beim Scrollen) ist rein dekorativ beziehungsweise bedienungsbezogen und ohne `IntersectionObserver`-Unterstützung oder bei `prefers-reduced-motion: reduce` sofort sichtbar, ohne Fallback-Lücke. Keine externen Analyse- oder Tracking-Skripte, keine Drittanbieter-Hosts außer dem Formularziel `web3forms.com`.

**IndexNow:** Nicht eingerichtet, siehe M2.

---

## Was gut ist

- Das statische Prüfskript findet über 23 Seiten hinweg **keinen einzigen Befund**: keine doppelten Titel, Beschreibungen oder h1, keine Gliederungssprünge, keine Bilder ohne `alt`, kein ungültiges JSON-LD, keine toten internen Verweise, kein Widerspruch zwischen Sitemap und noindex.
- Titel und canonical-Erzeugung sind sauber getrennt gebaut: `astro.config.mjs` erzwingt `https://` unabhängig davon, was GitHub Pages meldet, canonicals sind überall absolut und stimmen mit der eigenen Adresse überein.
- `noindex` ist an einer einzigen Stelle zentral geschaltet (`src/data/sichtbarkeit.ts`), bewusst ohne `Disallow: /` in `robots.txt`, mit einer im Code dokumentierten, technisch korrekten Begründung, warum ein `Disallow` die Sperre eher schwächen als verstärken würde.
- Die Sitemap schließt `/impressum/` und `/datenschutz/` korrekt aus, solange dort Platzhaltertexte stehen, das vermeidet die klassische Search-Console-Meldung „Als noindex gekennzeichnet“.
- LCP-Bild der Startseite korrekt priorisiert (`fetchpriority="high"`, `loading="eager"`, responsives `srcset`), alle übrigen Bilder `loading="lazy"`, Schriften selbst gehostet und vorab angemeldet statt von einem externen Font-Dienst geladen.
- Keine Drittanbieter-Skripte, kein Tracking, keine Cookies bis auf den externen POST-Endpunkt des Kontaktformulars, das ist sowohl für Datenschutz als auch für Ladeverhalten und die Sicherheitslage ein klarer Vorteil, gerade weil GitHub Pages selbst keine Kopfzeilen absichern kann.
- Strukturierte Daten sind durchdacht schlank gehalten: keine erfundenen Felder, `@id`-Referenzen statt doppelter Organisationsangaben, passender Zusatztyp (`Article`, `Service`) je nach Seitenart.
- Berührungsziele in der Navigation durchgängig auf mindestens 44px ausgelegt, Sprung-Link „Zum Inhalt springen“ vorhanden, Fokus-Handling beim Anker-Sprung im Code bedacht (`tabindex="-1"` mit Begründung).
- URL-Struktur klar, sprechend und konsequent zweistufig, keine kryptischen IDs oder Parameter.
- Vollständig serverseitig vorgerenderte Seite ohne jeden JavaScript-Rendering-Bedarf, das ist die technisch robusteste Ausgangslage für Crawler jeder Art, einschließlich KI-Systeme, zusätzlich unterstützt durch eine eigene `llms.txt`.

---

## Nicht prüfbar in dieser Sitzung

- Tatsächlich ausgelieferte HTTP-Kopfzeilen der Live-Seite (u. a. `Strict-Transport-Security`, `Content-Type`, Caching) und ob „Enforce HTTPS“ aktuell aktiv ist: kein Zugriff auf `https://www.youman-automation.de`.
- Ob die dokumentierte Weiterleitung von `youman-automation.de` auf `www.youman-automation.de` und von `http://` auf `https://` im Feld tatsächlich mit 301 funktioniert.
- Core Web Vitals als Messwerte (LCP, INP, CLS in Sekunden/Millisekunden/Einheiten), sowohl aus dem Feld (CrUX) als auch aus einem Lighthouse-Lauf. Die Aussagen oben sind Indizien aus dem Quelltext, keine Messungen.
- Barrierefreiheits- und Layout-Prüfung über mehrere Breiten (`browser-pruefungen.mjs` mit axe-core und Playwright): nicht ausgeführt, weil außerhalb des hier beauftragten Umfangs.
- Tatsächliches Crawl- und Indexierungsverhalten von Google, Bing oder KI-Systemen: ohne Search-Console-Zugriff nicht einsehbar.

---

## Relevante Dateien

- `/home/user/Youman-automation/youman-website/dist/robots.txt`
- `/home/user/Youman-automation/youman-website/dist/sitemap-index.xml`, `/home/user/Youman-automation/youman-website/dist/sitemap-0.xml`
- `/home/user/Youman-automation/youman-website/dist/llms.txt`
- `/home/user/Youman-automation/youman-website/src/layouts/Base.astro`
- `/home/user/Youman-automation/youman-website/src/lib/url.ts`
- `/home/user/Youman-automation/youman-website/src/components/Header.astro`
- `/home/user/Youman-automation/youman-website/src/data/navigation.ts`
- `/home/user/Youman-automation/youman-website/src/data/sichtbarkeit.ts`
- `/home/user/Youman-automation/youman-website/src/data/kontakt.ts`
- `/home/user/Youman-automation/youman-website/astro.config.mjs`
- `/home/user/Youman-automation/.github/workflows/youman-website-pages.yml`
- `/home/user/Youman-automation/.github/workflows/domain-setzen.yml`
- `/home/user/Youman-automation/.claude/skills/seo-youman/scripts/statisch.mjs`
