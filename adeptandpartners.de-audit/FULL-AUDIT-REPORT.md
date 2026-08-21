# SEO-Audit www.adeptandpartners.de

**Stand:** 21. August 2026
**Umfang:** 22 Seiten
**Bewertung:** 77 von 100

---

## Wie geprüft wurde, und was das bedeutet

Zwei Einschränkungen gehören an den Anfang, weil sie den ganzen Bericht
einordnen.

**Die Live-Seite war nicht erreichbar.** Die Umgebung, in der dieses Audit
entstanden ist, kommt nicht ins offene Netz; der Proxy weist Verbindungen zu
`www.adeptandpartners.de` mit 403 ab. Geprüft wurde deshalb der lokale Build,
also derselbe Quellstand, der ausgeliefert wird. Für alles, was im Markup
steht, ist das genauer als ein Crawl, weil auch die Rohdaten einsehbar sind.

Nicht messbar waren dadurch: Antwortzeiten und Sicherheits-Header des
Servers, Feldwerte echter Nutzer (CrUX), Weiterleitungsketten, sowie alles,
was Google über externe Verweise auf die Domain sieht.

**Die Seite steht vollständig auf noindex.** Alle 22 Seiten sind derzeit
bewusst von Suchmaschinen ausgenommen, es gibt keine Sitemap. Solange das so
bleibt, ändert keine Maßnahme etwas an der Sichtbarkeit. Alles hier ist
Vorbereitung: Es wirkt in dem Moment, in dem freigegeben wird.

---

## Zusammenfassung

Die technische Grundlage ist ungewöhnlich sauber. Über alle 22 Seiten
hinweg: kein Verstoß gegen WCAG 2.1 A und AA, kein waagerechter Überlauf
zwischen 320 und 1440 px, kein toter interner Verweis, kein Titel und keine
Beschreibung außerhalb der sinnvollen Länge, keine Dublette, kein
Layout-Sprung, keine Anfrage an einen fremden Host, keine Cookies.

**Der Engpass ist der Inhalt.** 13 der 22 Seiten haben weniger als 300 Wörter
im eigentlichen Inhaltsbereich. Fünf Seiten hängen an höchstens zwei
Verweisen aus dem Fließtext. Zwei Platzhalter stehen an der sichtbarsten
Stelle der Startseite.

### Geschäftstyp

Erkannt als **Agentur beziehungsweise Beratung mit lokalem Bezug**:
Referenzprojekte, Branchen- und Funktionsseiten, Kontaktformular mit
Terminbuchung, vollständige Anschrift in Borken, kein Warenkorb, keine
Preisseite, kein Login. Für die Bewertung heißt das: Referenzen und
regionale Signale zählen stark, Produktschema und Shop-Themen entfallen.

### Bewertung nach Bereichen

| Bereich | Gewicht | Wert |
|---|---|---|
| Technik | 22 % | 95 |
| Inhalt | 23 % | 45 |
| Seitenebene | 20 % | 85 |
| Strukturierte Daten | 10 % | 88 |
| Ladeverhalten | 10 % | 92 |
| KI-Suche | 10 % | 70 |
| Bilder | 5 % | 75 |
| **Gesamt** | | **77** |

Am Vortag lag der Wert bei 79. Der Unterschied ist keine Verschlechterung
der Seite, sondern eine schärfere Messung: Der Textumfang wird jetzt nur
über den Inhaltsbereich gezählt, ohne Kopf- und Fußzeile. Die zählten
vorher mit und haben den Umfang beschönigt. Dazu kommen die vier neuen
Kopfbilder, die stark hochskaliert werden.

---

## Technik — 95

Alles Geprüfte in Ordnung.

| Prüfung | Ergebnis |
|---|---|
| Barrierefreiheit (axe-core, WCAG 2.1 A und AA) | 0 Verstöße auf 22 Seiten |
| Waagerechter Überlauf bei 320 / 375 / 768 / 1024 / 1440 px | keiner |
| Tote interne Verweise | keine |
| canonical | überall gesetzt, absolut, https |
| robots-Meta | überall gesetzt |
| Sprachauszeichnung | `lang="de"` überall |
| Anfragen an Dritte | keine |
| Cookies, localStorage, sessionStorage | keine |

**robots.txt und noindex greifen richtig ineinander.** Es steht bewusst kein
`Disallow: /` darin. Ein Disallow verbietet nur das Abrufen, nicht die
Aufnahme in den Index; Google listet eine gesperrte Adresse trotzdem, wenn
irgendwo ein Verweis darauf zeigt, und bekommt das noindex dann nie zu
sehen. Die Sperre steht deshalb in jeder Seite, das Abrufen bleibt erlaubt.

**Nicht prüfbar:** Sicherheits-Header (HSTS, CSP, X-Content-Type-Options),
Weiterleitung von der nackten Domain auf `www`, TLS-Konfiguration,
Server-Antwortzeiten. Das gehört bei GitHub Pages überwiegend zur
Plattform, sollte aber nach der Freigabe einmal von außen geprüft werden.

---

## Inhalt — 45

Der schwächste Bereich, und zugleich der mit dem größten Hebel.

### 13 Seiten unter 300 Wörtern

Gezählt wird nur der Inhaltsbereich, ohne Kopf- und Fußzeile.

| Seite | Wörter |
|---|---|
| /branchen/ | 56 |
| /news/ | 77 |
| /case-studies/ | 78 |
| /funktionen/ | 106 |
| /kontakt/ | 116 |
| /branchen/automobil-und-zulieferer/ | 142 |
| /branchen/fertigung-und-maschinenbau/ | 148 |
| /branchen/logistik-und-versand/ | 162 |
| /funktionen/systemintegration-und-erp-anbindung/ | 169 |
| /funktionen/supply-chain-und-materialsteuerung/ | 182 |
| /funktionen/reporting-und-operative-transparenz/ | 191 |
| /funktionen/logistik-und-versandsteuerung/ | 217 |
| /funktionen/produktion-und-feinplanung/ | 229 |

Die vier Übersichtsseiten bestehen fast nur aus Kacheln. Google bewertet
solche Seiten als dünn und rankt sie kaum eigenständig; sie dienen dann nur
noch der Navigation, obwohl gerade `/funktionen/` und `/branchen/` auf
Suchbegriffe zielen, nach denen tatsächlich gesucht wird.

Die Branchen- und Funktionsseiten sind der eigentliche Verlust. Sie sind
gut geschrieben, aber zu kurz, um gegen längere Wettbewerbsseiten zu
bestehen. Die Branche **Onlinehandel** zeigt, wie es geht: Sie hat mit acht
konkreten Problemstellungen als einzige genug Substanz.

### Zwei Platzhalter im Auslieferzustand

- Startseite, zweiter Block: zwei Kacheln „Platzhalter, Thema folgt"
- `/news/`: Hinweis „2 weitere Beiträge offen"

Das ist die sichtbarste Stelle der Seite, direkt unter dem Erklärband.

### Was stimmt

Die vorhandenen Texte sind belegt und ohne Behauptungen ohne Grundlage. Der
Beitrag zur Logistik führt seine Quellen an und schreibt die Zahlen
ausdrücklich Gartner zu statt sie als eigene Messung auszugeben. Beide
Referenzprojekte nennen Kunde, Branche und Ausgangslage. Für E-E-A-T ist
das die richtige Grundhaltung, sie braucht nur mehr Fläche.

---

## Seitenebene — 85

| Prüfung | Ergebnis |
|---|---|
| Titel, 13 bis 55 Zeichen | alle in der Spanne, keine Dublette |
| Beschreibung, 83 bis 159 Zeichen | alle in der Spanne, keine Dublette |
| Genau eine h1 je Seite | 22 von 22 |
| Übersprungene Überschriftenstufen | keine |
| og:image, og:title | überall, absolut |

### Fünf Seiten hängen an höchstens zwei Verweisen

Gezählt werden nur Verweise aus dem Inhaltsbereich. Kopf- und Fußzeile
zählen für Google wenig, weil sie auf jeder Seite gleich sind.

| Seite | Verweise | von |
|---|---|---|
| /case-studies/absolar-warenwirtschaft/ | 1 | /case-studies/ |
| /ueber-uns/ | 1 | / |
| /case-studies/drahtmueller-palettenoptimierung/ | 2 | /branchen/logistik-und-versand/, /case-studies/ |
| /news/ | 2 | /, /news/logistik-2026-… |
| /news/logistik-2026-kostendruck-automatisierung/ | 2 | /, /news/ |

Zum Vergleich: `/kontakt/` hat 14. Die Referenzprojekte sind das stärkste
Verkaufsargument der Seite und zugleich am schlechtesten intern verlinkt.

---

## Strukturierte Daten — 88

| Typ | Vorkommen |
|---|---|
| Organization | 22 |
| WebSite | 22 |
| BreadcrumbList | 18 |
| Article | 3 |

Die Organisationsangaben sind vollständig: Name, Adresse als PostalAddress,
Logo, Beschreibung, Slogan, E-Mail, Telefon, ContactPoint, Gründungsjahr,
beide Gründer als Person, `knowsAbout` mit sieben Fachbegriffen.

**Offen:** Die fünf Funktionsseiten beschreiben Dienstleistungen, tragen aber
kein `Service`-Objekt. Ergänzt, mit `provider` auf die Organisation und
`areaServed`, macht das die Leistungen für Google maschinell erfassbar.
`datePublished` fehlt bei zwei der drei Artikel, weil kein freigegebenes
Datum vorliegt; das ist richtig so, ein erfundenes Datum wäre schlechter.

---

## Ladeverhalten — 92

Laborwerte bei 390 px Breite und doppelter Pixeldichte.

| Messwert | Ergebnis | Grenzwert |
|---|---|---|
| CLS (Layout-Sprung) | **0,000** auf allen 22 Seiten | unter 0,1 |
| LCP (größtes Element sichtbar) | 60 bis 104 ms | unter 2500 ms |
| Schwerste Seite | /news/ | — |

Es sind Laborwerte auf schnellem Rechner ohne Netzverzögerung. Sie zeigen
die Struktur zuverlässig, nicht die Erfahrung echter Nutzer. INP lässt sich
ohne echte Interaktion nicht messen; die Seite hat kaum JavaScript, das
Risiko ist gering.

Der CLS lag vor dem 20. August bei bis zu 0,103 und damit über dem
Grenzwert. Ursache war das Nachladen der Schriften. Behoben durch
Vorabanmeldung der drei lateinischen Schnitte im Seitenkopf.

---

## KI-Suche — 70

`llms.txt` ist angelegt und entsteht aus denselben Daten wie die Seiten,
kann also nicht veralten. Solange die Seite gesperrt ist, enthält sie nur
den Hinweis, den Inhalt nicht zu übernehmen.

Die strukturierten Daten sind eine gute Grundlage für Zitierbarkeit: klare
Organisationsangaben, benannte Gründer, Fachbegriffe. Was fehlt, ist
Substanz zum Zitieren. Sprachmodelle zitieren Passagen, die eine Frage
beantworten; dafür braucht es mehr Text als die derzeitigen Seiten bieten.

Es gibt keine externen Erwähnungen der Marke. Das ist bei einem Unternehmen
in Gründung normal, begrenzt aber jede Form von KI-Sichtbarkeit.

---

## Bilder — 75

Alle 20 Bilder haben einen Alternativtext, feste Maße gegen Layout-Sprünge
und werden als WebP in mehreren Breiten ausgeliefert. Bilder unterhalb des
sichtbaren Bereichs laden verzögert.

**Einschränkung:** Vier Kopfbilder wurden am 21. August durch neue Vorlagen
ersetzt, die zwischen 289 und 328 px breit sind. Der Kopfbereich zeigt das
Bild über die volle Fensterbreite, was einer vier- bis fünffachen
Vergrößerung entspricht. Bei der Feinplanung mit ihren harten Kanten ist das
deutlich sichtbar, bei den beiden Dokumentmotiven wirkt es eher wie geringe
Schärfentiefe.

Für scharfe Darstellung bräuchten die Vorlagen etwa 1600 px Breite.

---

## Anhang

- `findings/statisch.txt` — vollständige Ausgabe der Markup-Prüfung
- `findings/browser.txt` — Barrierefreiheit, Überlauf, CWV, Netzanfragen
- `findings/inhalt.txt` — Textumfang, interne Verweise, Platzhalter
- `screenshots/` — sechs Seiten, je Desktop und Mobil
- `ACTION-PLAN.md` — Maßnahmen nach Dringlichkeit
- `audit-data.json` — dieselben Daten maschinenlesbar
