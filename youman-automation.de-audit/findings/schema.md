# Strukturierte Daten (Schema.org / JSON-LD)

Geprüft wurde der gebaute Auslieferungsstand unter `youman-website/dist` (23 HTML-Seiten) sowie die erzeugende Quelle `src/layouts/Base.astro`. Die Live-Seite und externe Validatoren (schema.org Validator, Google Rich Results Test) waren in dieser Umgebung nicht erreichbar; die Prüfung erfolgte lokal gegen die Schema.org-Spezifikation und Googles dokumentierte Anforderungen je Typ.

Alle strukturierten Daten entstehen an einer Stelle, `src/layouts/Base.astro` (Objekt `strukturierteDaten`, Zeile 247 bis 252), und werden je Seite als ein einziges `<script type="application/ld+json">` mit einem `@graph` ausgeliefert. Enthalten sein können: `Organization`/`ProfessionalService`, `WebSite`, `BreadcrumbList`, `Article`, `Service`.

## Was vorhanden ist

Auf jeder der 23 Seiten:

- **Organization**, kombiniert mit `ProfessionalService` (`@type: ["Organization", "ProfessionalService"]`), sobald die Anschrift vollständig ist (`anbieterVollstaendig`). Mit `@id`, `name`, `url`, `description`, `slogan`, `areaServed`, `knowsAbout`, `email`, `telephone`, `address` (PostalAddress), `foundingDate`, `founder` (Person, eingebettet) und `contactPoint`.
- **WebSite** mit `@id`, `url`, `name`, `inLanguage`, `publisher` (Verweis per `@id` auf die Organisation).

Zusätzlich, je nach Seitentyp:

- **BreadcrumbList** auf allen Seiten außer der Startseite, `/impressum/` und `/datenschutz/` (dazu unten mehr).
- **Article** ausschließlich auf den beiden Referenzprojekt-Detailseiten (`case-studies/absolar-warenwirtschaft`, `case-studies/drahtmueller-palettenoptimierung`).
- **Service** ausschließlich auf den fünf Leistungsseiten (`leistungen/[slug]`).

Geprüft wurde konkret, ob `Article` und `Service` nur dort erscheinen, wo sie inhaltlich hingehören: das ist der Fall. Die Startseite, die Übersichtsseiten (`leistungen/`, `branchen/`, `case-studies/`) und die Branchenseiten tragen weder `Article` noch `Service` – korrekt, denn dort beschreibt keine der Seiten eine einzelne Leistung oder einen einzelnen redaktionellen Beitrag.

## Befunde

### High

**H1 – `Article` fehlt das Feld `image`, obwohl das Bild bereits im Layout vorliegt.**
Beleg: `src/layouts/Base.astro`, Objekt `artikelObjekt` (Zeile 200–213), enthält `headline`, `description`, `inLanguage`, `mainEntityOfPage`, `author`, `publisher`, optional `datePublished` – aber kein `image`. Gleichzeitig berechnet dieselbe Datei bereits ein zugeschnittenes 1200×630-Bild für Open Graph (`vorschau`, Zeile 93–95) und beide betroffenen Case-Study-Seiten übergeben tatsächlich ein `bild` (`case-studies/absolar-warenwirtschaft.astro:105`, `case-studies/drahtmueller-palettenoptimierung.astro:70`). Im ausgelieferten JSON-LD (`dist/case-studies/*/index.html`) fehlt `image` entsprechend vollständig.
`image` ist nach Googles Dokumentation eine Pflichtangabe für `Article`-Strukturdaten; ohne sie ist der Artikel nicht rich-result-fähig, unabhängig davon, ob eine Aufnahme als Top-Story überhaupt angestrebt wird.
Empfehlung: `vorschau` (bzw. dessen absolute URL) in `artikelObjekt` als `image` übernehmen. Die Daten liegen bereits vor, es müsste nichts erfunden werden – nur die vorhandene Variable in das `Article`-Objekt verdrahtet werden.

### Medium

**M1 – `areaServed` widerspricht einer anderen, ebenfalls belegten Angabe auf der Seite.**
Beleg: `Base.astro` setzt `areaServed` sowohl bei `Organization` (Zeile 124) als auch bei jedem `Service` (Zeile 241) fest auf `{ "@type": "Country", "name": "Deutschland" }`. Auf `/ueber-uns/` steht dagegen als Fakt explizit `{ wert: 'DACH', label: 'Arbeitsraum' }` (`src/pages/ueber-uns.astro:45`), und `/muensterland/` sagt wörtlich „Wir arbeiten im gesamten DACH-Raum“ (`src/pages/muensterland.astro:52`). Die strukturierten Daten behaupten also einen engeren Wirkungsraum, als die Seite selbst an zwei Stellen angibt.
Das ist kein erfundenes Feld – im Gegenteil, die belegbare Angabe (DACH) wird durch die schmalere (Deutschland) unterboten.
Empfehlung: `areaServed` auf `[{ "@type": "Country", "name": "Deutschland" }, { "@type": "Country", "name": "Österreich" }, { "@type": "Country", "name": "Schweiz" }]` erweitern, oder falls „DACH“ auf den Textseiten eigentlich nur eine Absichtserklärung und keine belastbare Zusage ist, umgekehrt die Textseiten auf „Deutschland“ zurückstufen. Beides ist möglich, nur der aktuelle Widerspruch zwischen Text und Markup nicht.

**M2 – `BreadcrumbList`: die URLs der Zwischenstationen tragen keinen abschließenden Schrägstrich, die tatsächlichen Seiten-URLs aber schon.**
Beleg (`dist/branchen/handwerk-und-bau/index.html`): Position 2 der Brotkrumen zeigt `"item": "https://www.youman-automation.de/branchen"` (ohne Schrägstrich), während dieselbe Seite als Ziel derselben Navigation unter `https://www.youman-automation.de/branchen/` (mit Schrägstrich) kanonisch ist – siehe `dist/branchen/index.html`, dort `"og:url"`/`canonical` sowie die eigene Brotkrumen-Angabe auf Position 2. Dasselbe Muster bei `/leistungen` (in `leistungen/chatbots/index.html`), `/case-studies` (in beiden Case-Study-Detailseiten).
Ursache in der Quelle: die Zwischenglieder werden von Hand mit `href: '/branchen'`, `href: '/leistungen'`, `href: '/case-studies'` angegeben (`src/pages/branchen/[slug].astro:32`, `src/pages/leistungen/[slug].astro:34`, `src/pages/case-studies/absolar-warenwirtschaft.astro:86`), während das letzte, aktuelle Glied automatisch aus `Astro.url.pathname` entsteht (`Base.astro:189`), das bei `trailingSlash: 'ignore'` und Astros Standard-Verzeichnisformat immer mit Schrägstrich endet.
Google verlangt zwar keine exakte String-Übereinstimmung, empfiehlt aber, dass `item` die tatsächliche URL der referenzierten Seite ist. Hier weicht sie unnötig ab.
Empfehlung: in den betroffenen `brotkrumen`-Arrays `/branchen/`, `/leistungen/`, `/case-studies/` (mit Schrägstrich) verwenden.

### Low

**L1 – `/impressum/` und `/datenschutz/` erzeugen keine `BreadcrumbList`, obwohl eine Brotkrumennavigation sichtbar angezeigt wird.**
Beleg: Beide Seiten übergeben `breadcrumb={[{ label: 'Home', href: '/' }]}` an die Komponente `PageHeader` (`src/pages/impressum.astro:32`, `src/pages/datenschutz.astro:47`), nicht aber an `<Base>`. Im JSON-LD von `dist/impressum/index.html` und `dist/datenschutz/index.html` fehlt entsprechend der `BreadcrumbList`-Block vollständig, obwohl die Seite eine Brotkrumenleiste zeigt.
Auswirkung gering, weil beide Seiten ohnehin `noindex` tragen (unvollständige Anbieterkennzeichnung bzw. bewusste Sperre) und daher aktuell nicht in der Suche erscheinen. Für den Fall, dass sie freigegeben werden, wäre die Inkonsistenz zwischen sichtbarer Navigation und Markup aber real.
Empfehlung: `breadcrumb={[{ label: 'Home', href: '/' }]}` zusätzlich an `<Base>` übergeben, wie es auf allen anderen Seiten bereits geschieht.

### Info

**I1 – Kein `FAQPage` und keine Ergänzung dazu empfohlen.**
Google hat FAQ-Rich-Results für alle Websites eingestellt (Mai 2026); ein etwaiger Nutzen für generative Suchsysteme ist nicht belegt. Zusätzlich wurde die Kontaktseite (`src/pages/kontakt.astro`) auf vorhandene Frage-Antwort-Inhalte durchsucht: es gibt keine. Es gäbe also ohnehin keinen Bestand, aus dem sich `FAQPage` oder `QAPage` ohne erfundene Fragen befüllen ließe. Keine Änderung vorgeschlagen.

**I2 – Bewusst fehlende Felder sind korrekt weggelassen.**
Kein `logo` (keine Logodatei vorhanden, im Code kommentiert), kein `geo`, keine `openingHours`, kein `aggregateRating`, kein `datePublished` ohne freigegebenes Datum, kein `Offer`/Preis. Das entspricht der Projektvorgabe, nichts zu erfinden, und ist an jeder Stelle im Code auch so begründet.

**I3 – `Service` und `Organization` tragen `areaServed` nur auf Länderebene, keine Stadt/Region.** Kein Fehler, nur ein Hinweis: `ProfessionalService` könnte zusätzlich `address` bereits für lokale Relevanz sorgen (ist vorhanden), ein weiteres `areaServed` auf Regionalebene (z. B. Münsterland, mit Bezug zu `/muensterland/`) wäre denkbar, ist aber nicht notwendig, um valide zu sein.

## Was gut ist

- Alle geprüften JSON-LD-Blöcke sind syntaktisch gültiges JSON (per `json.loads` gegen alle 23 Seiten verifiziert) und jedes Objekt trägt `@type`.
- `@context` ist überall `https://schema.org` (https, nicht http), URLs sind durchgehend absolut.
- Die `@id`-Verweise sind sauber: `WebSite.publisher`, `Article.author`, `Article.publisher` und `Service.provider` verweisen alle korrekt auf `#organisation`, und dieser Knoten existiert auf jeder Seite, die einen solchen Verweis enthält. Keine hängenden Referenzen gefunden.
- `Service` erscheint ausschließlich auf den fünf Leistungsseiten, `Article` ausschließlich auf den beiden Case-Study-Seiten – keine Vermischung, keine Seite trägt einen Typ, für den ihr Inhalt nicht steht.
- Konsequente Zurückhaltung bei unbelegten Feldern: kein `aggregateRating`, keine `openingHours`, kein Preis, kein `logo` auf eine nicht existierende Datei, `datePublished` wird bei beiden Case-Studies korrekt weggelassen, weil kein freigegebenes Datum vorliegt (verifiziert: `caseStudies.ts` führt für beide Fälle `date: null`, und im ausgelieferten JSON-LD fehlt `datePublished` tatsächlich in beiden Fällen).
- `Organization`/`ProfessionalService` unterscheidet sauber zwischen „Anschrift vollständig“ und „nicht vollständig“ (`anbieterVollstaendig`) und liefert bei unvollständiger Anschrift korrekt nur `Organization`, nicht `LocalBusiness`.
- `PostalAddress` enthält alle für `LocalBusiness`/`ProfessionalService` erforderlichen Felder (`streetAddress`, `postalCode`, `addressLocality`, `addressCountry`).

## Belegbare Ergänzungen (Vorschläge)

Beide Vorschläge verwenden ausschließlich Daten, die im Repository bereits vorhanden und veröffentlicht sind. Kein Feld ist erfunden.

### Vorschlag 1: `Person` für den Gründer, auf `/ueber-uns/`

Datenquelle: `src/data/anbieter.ts` (Name, Telefon, als Gründer geführt), `src/data/site.ts` (`gruendungsjahr: '2026'`), `src/pages/ueber-uns.astro` (Seite handelt inhaltlich von genau dieser Person und der Gründung). Kein `image`, kein `sameAs`: es gibt weder ein Foto noch verlinkte Profile (LinkedIn, Xing o. ä.) im Bestand – beides würde erfunden, deshalb weggelassen.

Aktuell steckt die Person nur eingebettet in `Organization.founder`, ohne eigene `@id` und ohne `jobTitle`. Vorschlag: einen referenzierbaren Knoten daraus machen und zusätzlich in `Organization.founder` per `@id` darauf verweisen, statt der Person zweimal auszuschreiben.

```json
{
  "@type": "Person",
  "@id": "https://www.youman-automation.de/ueber-uns/#amanuel-kheyo",
  "name": "Amanuel Kheyo",
  "jobTitle": "Gründer",
  "telephone": "+49 155 67541365",
  "worksFor": { "@id": "https://www.youman-automation.de/#organisation" }
}
```

In `Organization` (Base.astro, Zeile 166–168) würde `founder` dann auf diesen Knoten verweisen:

```json
"founder": [{ "@id": "https://www.youman-automation.de/ueber-uns/#amanuel-kheyo" }]
```

Umsetzungshinweis: Da `Organization` seitenübergreifend in `Base.astro` erzeugt wird, der `Person`-Knoten mit vollem `jobTitle`/`telephone` aber sinnvollerweise nur dort steht, wo die Person auch inhaltlich vorkommt (`/ueber-uns/`), müsste der volle `Person`-Knoten nur auf dieser einen Seite ins `@graph` aufgenommen werden; auf allen anderen Seiten bliebe `founder` wie bisher eingebettet, oder referenziert per `@id` ohne dass der Zielknoten auf derselben Seite aufgelöst werden kann (das ist zulässig, aber schwächer). Einfachste Umsetzung ohne Sonderfall: den vorhandenen eingebetteten `founder`-Eintrag in `Base.astro:167` um `jobTitle: 'Gründer'` ergänzen – das ist bereits ohne Zusatzknoten möglich und beruht ebenfalls nur auf vorhandenen Daten.

### Vorschlag 2: `ItemList` auf den drei Übersichtsseiten

Betrifft `/leistungen/`, `/branchen/`, `/case-studies/`. Alle Einträge stammen unverändert aus den bestehenden Datendateien (`src/data/leistungen.ts`, `src/data/branchen.ts`, `src/data/caseStudies.ts`), die ohnehin die Kacheln auf diesen Seiten füllen. Hinweis zur Erwartung: `ItemList` allein löst kein Google-Rich-Result aus (Karussells sind an andere Typen wie `Product` oder `Recipe` gebunden); der Nutzen liegt darin, Suchmaschinen und KI-Systemen die Seitenstruktur explizit zu geben, nicht in einer sichtbaren SERP-Änderung.

Beispiel für `/leistungen/`:

```json
{
  "@type": "ItemList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "KI-Automationen",
      "url": "https://www.youman-automation.de/leistungen/ki-automationen/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Chatbots",
      "url": "https://www.youman-automation.de/leistungen/chatbots/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Webseiten",
      "url": "https://www.youman-automation.de/leistungen/webseiten/"
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "E-Commerce-Lösungen",
      "url": "https://www.youman-automation.de/leistungen/e-commerce/"
    },
    {
      "@type": "ListItem",
      "position": 5,
      "name": "Individuelle Software",
      "url": "https://www.youman-automation.de/leistungen/individuelle-software/"
    }
  ]
}
```

Für `/branchen/` analog mit den sechs Slugs aus `branchen.ts` (`e-commerce-und-onlinehandel`, `spedition-und-logistik`, `produktion-und-fertigung`, `grosshandel-und-distribution`, `handwerk-und-bau`, `dienstleistung-und-agenturen`), für `/case-studies/` mit den beiden vorhandenen Fällen (`drahtmueller-palettenoptimierung`, `absolar-warenwirtschaft`).

## Zusammenfassung nach Schweregrad

| Schweregrad | Anzahl | Kurzbezeichnung |
|---|---|---|
| Critical | 0 | – |
| High | 1 | H1: `Article` ohne `image` |
| Medium | 2 | M1: `areaServed` widerspricht DACH-Angabe; M2: Brotkrumen-URLs ohne Schrägstrich |
| Low | 1 | L1: Impressum/Datenschutz ohne `BreadcrumbList` |
| Info | 3 | I1: kein FAQPage (korrekt); I2: bewusst fehlende Felder (korrekt); I3: `areaServed` nur Länderebene |

Relevante Dateien: `src/layouts/Base.astro`, `src/pages/ueber-uns.astro`, `src/pages/muensterland.astro`, `src/pages/branchen/[slug].astro`, `src/pages/leistungen/[slug].astro`, `src/pages/case-studies/absolar-warenwirtschaft.astro`, `src/pages/case-studies/drahtmueller-palettenoptimierung.astro`, `src/pages/impressum.astro`, `src/pages/datenschutz.astro`, `src/data/anbieter.ts`, `src/data/site.ts`, `src/data/leistungen.ts`, `src/data/branchen.ts`, `src/data/caseStudies.ts`.
