# Inhaltsqualität youman-website

Geprüft: gebauter Stand in `dist/` (21 HTML-Seiten plus `404.html`, `llms.txt.ts`, `robots.txt.ts`) sowie die Quelldaten in `src/data/*.ts` und die Seiten unter `src/pages/`. Die Live-Domain war in dieser Sitzung nicht erreichbar, die Vorschau unter `http://localhost:4321` und der gebaute Stand entsprechen sich strukturell.

Wortzahlen unten sind aus dem `<main>`-Element der jeweiligen `dist/*/index.html`-Datei ermittelt (Skripte und Stile entfernt, Kopf- und Fußzeile liegen außerhalb von `<main>` und sind nicht mitgezählt). Sie wurden unabhängig nachgerechnet und liegen im Rahmen von 5 bis 15 Wörtern nahe an den vom Koordinator gemeldeten Werten; die kleinen Abweichungen erklären sich durch Button- und Brotkrumen-Text, der je nach Methode mitgezählt wird oder nicht.

## Einordnung

youman ist ein im Jahr 2026 gegründetes Ein-Personen-Unternehmen (Amanuel Kheyo) mit zwei belegten Referenzprojekten. Der Auftritt verfolgt ausdrücklich eine Zurückhaltungsstrategie: keine erfundenen Kennzahlen, keine Kundenstimmen, keine Einsparquoten. Diese Entscheidung ist im Code mehrfach begründet und an zentraler Stelle (`/case-studies/`) auch für Besucher sichtbar gemacht. Das ist für ein so junges Unternehmen die richtige Grundhaltung, weil jede erfundene Zahl bei einer Prüfung (Kunde, Wettbewerber, Google) sofort auffiele und die gesamte Seite unglaubwürdig machen würde. Der Preis dieser Zurückhaltung ist spürbar: mehrere Seiten sind inhaltlich dünn, und die Beweislage für Autorität und Erfahrung stützt sich fast vollständig auf zwei Fallstudien und eine einzelne Person, deren Werdegang selbst nur vage beschrieben ist.

Die folgenden Befunde sind nach Schweregrad geordnet. "Belegbar verbessern" bedeutet an jeder Stelle: mit echten, vorhandenen Fakten, nicht mit zusätzlichen Behauptungen.

## Befunde

### High: Die sechs Branchenseiten sind dünn und einander strukturell sehr ähnlich

Beleg (Wortzahl im `<main>`, eigene Messung):

- `/branchen/handwerk-und-bau/` – 228 Wörter
- `/branchen/e-commerce-und-onlinehandel/` – 243 Wörter
- `/branchen/spedition-und-logistik/` – 246 Wörter
- `/branchen/dienstleistung-und-agenturen/` – 247 Wörter
- `/branchen/grosshandel-und-distribution/` – 249 Wörter
- `/branchen/produktion-und-fertigung/` – 267 Wörter

Damit liegen alle sechs deutlich unter der in diesem Skill hinterlegten Richtgröße von 500 bis 600 Wörtern für Regionalseiten und noch weiter unter dem, was für eine Branchen-/Themenseite mit Anspruch auf eigenständiges Ranking üblich ist. Der Aufbau ist bei allen sechs identisch: eine Einleitung (ein bis zwei Absätze aus `branchen.ts` → `intro`), fünf `painpoints` in exakt demselben Kachel-Layout, ein Verweis auf die passenden Leistungen. Zitat aus `src/data/branchen.ts` (Kommentar der Autoren selbst, Zeile 8–11): "Die Problemstellungen sind benannte Fachprobleme, keine Aussagen ueber konkrete Projekte. Deshalb ohne Zahlen und ohne Erfolgsbehauptung." Das ist inhaltlich integer, führt aber dazu, dass jede der sechs Seiten praktisch nur aus einer Liste von fünf Ein-Satz-Problemen und einem kurzen Absatz besteht – kein Fallbeispiel, kein branchenspezifisches Detail, das über generische Prozessbeschreibung hinausgeht.

Das ist kein Duplicate-Content-Problem im engen Sinn (die Fließtexte unterscheiden sich tatsächlich pro Branche), aber ein Thin-Content- und Sameness-Problem: Ein Rater oder ein Sprachmodell, das zwei dieser Seiten nebeneinanderlegt, sieht dasselbe Gerüst mit ausgetauschten Substantiven. Nur zwei der sechs Seiten (Produktion & Fertigung, Dienstleistung & Agenturen) haben durch `referenzHinweis` einen Bezug zu einem echten, benannten Projekt; die anderen vier haben nichts, was sie über generische Aussagen hinaushebt.

Empfehlung, belegbar umsetzbar:
- Für jede Branche mindestens einen konkreten, spezifischen Absatz ergänzen, der über die fünf Painpoints hinausgeht: z. B. übliche Systemlandschaften in dieser Branche (welche ERP-Systeme, welche Marktplätze, welche Regularien), typische Auftragsgrößen, saisonale Besonderheiten. Das ist beschreibbares Fachwissen, keine Erfolgsbehauptung, und braucht keine Kundendaten.
- Falls Amanuel Kheyo Erfahrung mit bestimmten Branchen-Werkzeugen hat (ein ERP, eine Warenwirtschaft, eine Marktplatz-API), das konkret benennen statt allgemein "Systeme". Das ist ein Expertise-Signal, das heute komplett fehlt.
- Sobald ein drittes Projekt abgeschlossen und freigegeben ist, gehört es dorthin, wo die Branche passt, nicht nur in die Fallstudien-Liste.

### High: Die Leistungen-Übersichtsseite `/leistungen/` ist die kürzeste indexierbare Seite der Website

Beleg: 217 Wörter im `<main>`, davon ein guter Teil Navigationstext (Kachel-Teaser, die bereits auf den Unterseiten stehen) statt eigenständigem Fließtext. Der einzige originäre Absatz lautet: "Ein Chatbot ohne Anbindung an den tatsächlichen Bestand gibt Auskünfte, die niemand geprüft hat. Eine Automation ohne festgelegte Grenze entscheidet irgendwann Fälle, die sie nicht entscheiden sollte." Das sind zwei gute, konkrete Sätze, aber es sind praktisch die einzigen. Die Seite trägt den Title "KI-Automation, Chatbots, Webseiten und Software | youman" und soll damit für breite Suchbegriffe stehen, liefert dafür aber die dünnste Textbasis im ganzen Auftritt (nur `/impressum/` mit 83 Wörtern ist kürzer, dort zu Recht: es ist ein Pflichttext mit `noindex`).

Zum Vergleich liegt `/branchen/` mit demselben Seitentyp (Übersicht mit Einleitung plus Kachelraster) bei 975 Wörtern, weil dort zusätzlich die Leistungen als aufklappbare Liste eingebettet sind. `/leistungen/` hat dieses zusätzliche Element nicht.

Empfehlung: Auf `/leistungen/` fehlt genau das Gegenstück zu dem, was `/branchen/` bereits kann – etwa eine kurze, aufklappbare Zuordnung "Welche Branche nutzt was" oder ein Absatz, der die Reihenfolge/Kombination der fünf Leistungen in echten Projektverläufen beschreibt (das Muster "beginnt an einer Stelle, wächst von dort" wird an mehreren Stellen behauptet, aber nirgends an einem Beispiel gezeigt). Auch ein FAQ-Block mit den Fragen, die vor einer Anfrage typischerweise auftauchen (Preise, Dauer, Ablauf), würde hier sowohl Wortumfang als auch KI-Zitierfähigkeit erhöhen, ohne eine einzige Zahl zu erfinden.

### Medium: Wiederkehrende Textblöcke reduzieren den Anteil an einzigartigem Inhalt auf mehreren ohnehin knappen Seiten

Drei Textblöcke sind wortgleich über mehrere Seiten hinweg verbaut, weil sie aus derselben Konstante in `src/data/*.ts` erzeugt werden:

1. Der Vierschritt-Prozess (`prozess` in `site.ts`: "Analyse", "Konzept", "Umsetzung", "Betrieb", zusammen rund 70 bis 80 Wörter Beschreibungstext) erscheint identisch auf der Startseite, auf `/ueber-uns/` und auf allen fünf `/leistungen/[slug]/`-Seiten – also auf sieben von 19 indexierbaren Seiten.
2. Der Kasten "Was das kostet" ("Preise und Laufzeiten stehen hier bewusst nicht. Beides hängt daran, wie die vorhandenen Systeme aussehen …", ca. 40 Wörter) steht wortgleich auf allen fünf Leistungsseiten.
3. Der Hinweis `anfrageHinweis` ("Diese fünf Bereiche decken das meiste ab, was angefragt wird …", ca. 36 Wörter) erscheint identisch auf `/leistungen/` und, über die dortige "Nicht dabei?"-Kachel, sinngemäß auch auf `/branchen/`.

Bei einer Seite wie `/leistungen/webseiten/` mit 406 Wörtern insgesamt macht allein der wiederholte Prozessblock plus der Kosten-Kasten rund 25 Prozent des sichtbaren Textes aus. Das ist für Nutzerführung nachvollziehbar (Konsistenz der Kernbotschaft), senkt aber den Anteil einzigartigen, seitenspezifischen Inhalts genau dort, wo die Wortzahl ohnehin knapp ist.

Empfehlung: Den Prozessblock nicht streichen, aber auf den Leistungsseiten um einen Satz ergänzen, der ihn auf die konkrete Leistung bezieht (z. B. bei "Analyse" für Chatbots: welche Unterlagen dafür gesichtet werden), statt der reinen Wiederholung des allgemeinen Textes. Das behält die Konsistenz, macht den Block aber pro Seite einzigartig.

### Medium: E-E-A-T-Expertise steht auf sehr schmaler Beweisgrundlage

Beleg: Die einzige belegte Person ist Amanuel Kheyo (`src/data/anbieter.ts`, Impressum, strukturierte Daten als `founder`). Auf `/ueber-uns/` wird der Werdegang jedoch bewusst vage gehalten: "Lange bevor youman existiert, entstehen im beruflichen Umfeld von Amanuel K. bereits Workflow-Automatisierungen und Softwaremodule, um genau solche Lücken zu schließen." Das ist die einzige Aussage zur fachlichen Vorgeschichte im ganzen Auftritt – ohne Zeitraum, ohne Branche, ohne Technologie, ohne Rolle. Zusätzlich fällt auf, dass hier "Amanuel K." steht, während Impressum und strukturierte Daten "Amanuel Kheyo" führen; das wirkt wie ein Rest einer früheren, anonymisierten Textfassung.

Es gibt außerdem:
- kein Autorenfoto und keine eigene Profilseite zur Person,
- keinen Verweis auf LinkedIn, Xing, GitHub oder ein anderes Profil, das die genannte Vorerfahrung stützen würde (im Footer, Header und in `Base.astro` sind keinerlei Social-/Profil-Links vorgesehen),
- keine genannten Zertifizierungen, Partnerschaften oder Technologien, auf die sich "Fachkenntnis" stützen ließe, außer den beiden Fallstudien.

Das ist bei einem Ein-Personen-Unternehmen im ersten Jahr nicht ungewöhnlich, senkt aber den Expertise- und Authoritativeness-Score deutlich, weil es praktisch keine extern prüfbare Bestätigung der behaupteten Erfahrung gibt.

Empfehlung, ohne etwas zu erfinden: Sofern vorhanden, einen echten LinkedIn- oder GitHub-Link ergänzen (`sameAs` in den strukturierten Daten und ein sichtbarer Link im Footer oder auf `/ueber-uns/`). Den Namen konsistent als "Amanuel Kheyo" führen. Die vage Formulierung zur Vorerfahrung durch etwas Konkretes ersetzen, das sich belegen lässt (z. B. konkrete frühere Tätigkeit, Ausbildung, ein Zeitraum) – oder, falls das nicht belegbar ist, den Satz eher kürzen als ihn vage stehen zu lassen, denn eine unscharfe Behauptung ist für Vertrauenswürdigkeit schlechter als keine.

### Medium: Nur zwei Referenzprojekte tragen fast die gesamte Authoritativeness des Auftritts

Beleg: `caseStudies.ts` enthält genau zwei Einträge, beide ohne Veröffentlichungsdatum (`date: null`, bewusst so belassen, siehe Kommentar in der Datei: "date: null. solange kein freigegebenes Datum vorliegt"). Auf sechs Branchenseiten wird nur zweimal (`produktion-und-fertigung`, `dienstleistung-und-agenturen`) tatsächlich auf ein Referenzprojekt verwiesen; für E-Commerce, Spedition, Großhandel und Handwerk gibt es keinen einzigen belegten Fall. Die Startseite zählt die Referenzen selbst korrekt als "2" (`caseStudies.length` in `fakten`), was ehrlich ist, aber eben auch zeigt, wie schmal die Basis ist.

Das ist konsequent zur eigenen Regel (nur zeigen, was freigegeben ist), bedeutet aber: Wer als KI-System oder als Rater die Frage stellt "Wofür gibt es einen Beleg?", findet für vier von sechs Branchen keine Antwort.

Empfehlung: Sobald ein drittes Projekt freigegeben ist, zuerst in einer Branche ohne bisherigen Beleg platzieren. Bis dahin auf den vier unbelegten Branchenseiten nicht so tun, als gäbe es keine Lücke – ein neutraler Satz wie "Ein öffentlich benanntes Projekt aus diesem Bereich liegt noch nicht vor" wäre ehrlicher als das komplette Schweigen zum Thema, das aktuell auf diesen vier Seiten herrscht.

### Medium: Case-Study-Seiten haben keine Datumsangabe, damit fehlt ein Aktualitäts-Signal

Beleg: Sowohl im sichtbaren Text als auch im `Article`-Schema (`Base.astro`, Zeile 209–211) wird `datePublished` bewusst weggelassen: "datePublished wird bewusst weggelassen, solange kein freigegebenes Datum vorliegt – ein erfundenes Datum wäre schlimmer als keines." Das ist als Prinzip richtig. In der Praxis bedeutet es aber, dass die beiden einzigen Beleg-Seiten der Website weder für Google noch für ein Sprachmodell ein Alter erkennen lassen – ein Projekt, das drei Jahre zurückliegt, sieht strukturell genauso aus wie eines von letzter Woche.

Empfehlung: Sobald mit dem jeweiligen Kunden ein grobes Datum (zumindest Quartal oder Jahr) abgestimmt werden kann, dieses ergänzen. Ein Jahr ist in der Regel unkritisch freizugeben und liefert bereits das Aktualitätssignal, ohne dass ein exaktes Datum nötig wäre.

### Low: Uneinheitliche Bezeichnung "die Menschen hinter youman" bei nur einer Person

Beleg: `src/pages/ueber-uns.astro`, Zeile 92: `bezeichnung="Die Menschen hinter youman"` (Plural) im Bildplatzhalter, obwohl `anbieter.personen` genau eine Person enthält und der Seitentitel korrekt "Wer hinter youman steht" (kein Plural) lautet. Kleine Inkonsistenz, aber genau die Art Detail, die bei einem Ein-Personen-Unternehmen aus einer früheren Zwei-Gründer-Fassung übrig geblieben sein dürfte (der Code-Kommentar in derselben Datei bestätigt das: "er war auf zwei Gruender geschrieben. [...] ist hier korrigiert" – dieser eine Bildplatzhalter wurde dabei übersehen).

Empfehlung: `bezeichnung="Die Menschen hinter youman"` auf eine für eine Person passende Formulierung ändern.

### Low: Keine expliziten Frage-Antwort-Passagen trotz mehrfach vorhandener FAQ-tauglicher Inhalte

Beleg: Inhalte, die faktisch schon als Frage-Antwort-Paar formuliert werden könnten, liegen bereits vor, sind aber nicht als solche ausgezeichnet oder auch nur so formuliert: "Was das kostet" (Leistungsseiten), "Was nach Ihrer Anfrage passiert" (`/kontakt/`), "Und wo sie nichts ändert" (`/muensterland/`). Es gibt im gesamten Auftritt kein `FAQPage`-Schema und keine Überschrift in Frageform. Für die Ansprechbarkeit von KI-Suchsystemen (Perplexity, ChatGPT-Suche, Google AI Overviews) sind explizite Frage-Antwort-Paare eine der zuverlässigsten Zitierquellen, weil sie sich unverändert in eine Antwort übernehmen lassen.

Empfehlung: Auf `/leistungen/`, `/kontakt/` und ggf. `/muensterland/` einen kurzen FAQ-Abschnitt mit `FAQPage`-Schema ergänzen, aus bereits vorhandenen, wahren Aussagen formuliert (z. B. "Was kostet eine KI-Automation?" → der bestehende, bereits ehrliche Text). Keine neuen Fakten nötig, nur eine andere Auszeichnung des bereits Gesagten.

### Info: Sehr lange, verschachtelte Sätze an mehreren Stellen

Beleg, `/ueber-uns/`: "Was übrig bleibt, sind die Abläufe, die sich nicht ins Schema pressen lassen, und die am Ende wieder in Tabellen und persönlichen Absprachen landen." Beleg, `/branchen/spedition-und-logistik/`: "Aufträge kommen in fünf Formaten, Statusmeldungen laufen über Anrufe, und Papiere entstehen an einer Stelle, an der jemand von Hand abtippt, was woanders längst digital vorliegt." Solche Sätze mit zwei bis drei eingebetteten Nebensätzen sind für die Zielgruppe (Geschäftsführung und Prozessverantwortliche im Mittelstand) sprachlich angemessen und wirken bewusst gesetzt, nicht wie KI-Textbrei. Für die schnelle Lesbarkeit am Bildschirm und für eine saubere Extraktion durch Sprachmodelle sind kürzere Sätze trotzdem oft vorteilhafter. Ein numerischer Lesbarkeitswert (Flesch o. ä.) wurde nicht ermittelt, da hierfür kein geeignetes Messwerkzeug in dieser Sitzung zur Verfügung stand; diese Einschätzung ist qualitativ.

Empfehlung: An den einleitenden Sätzen jeder Sektion (die "vorspann"-Absätze) besonders auf Kürze achten, da genau diese von KI-Systemen am ehesten als Zitat übernommen werden. Der Rest des Fließtexts kann komplexer bleiben.

### Info: Gute strukturierte Daten, aber ohne `sameAs` und ohne Personen-Entität

Beleg: `Base.astro` erzeugt durchgängig ein sauberes `@graph` mit `Organization`/`ProfessionalService`, `WebSite`, `BreadcrumbList` (auf allen Unterseiten) und `Article` bzw. `Service`, wo zutreffend – jeweils nur mit tatsächlich vorhandenen Feldern (kein leeres `openingHours`, kein erfundenes `logo`, kein `AggregateRating`). Was fehlt: `Amanuel Kheyo` ist zwar als `founder`-Person im `Organization`-Objekt enthalten, aber ohne eigenes `Person`-Objekt mit `sameAs`-Verweisen, und es gibt kein `FAQPage`-Schema (siehe oben).

Empfehlung: Sobald ein LinkedIn- oder vergleichbares Profil existiert, `sameAs` sowohl bei der Organisation als auch bei der Person ergänzen. Das ist eine der am stärksten wirkenden, zugleich am leichtesten belegbaren Verbesserungen für Autorität.

## Was gut ist

- **Der Verzicht auf erfundene Zahlen ist konsequent durchgehalten und wird an der richtigen Stelle sichtbar gemacht.** Auf `/case-studies/` steht ein eigener Kasten "Was hier bewusst fehlt" mit der offenen Aussage: "Drei Dinge stehen nirgends, weil sie in den Unterlagen zu beiden Projekten nicht belegt sind: Einsparquoten, Amortisationszeiten, Kundenstimmen." Das ist genau die Art von Transparenz, die die Google-Qualitätsrichtlinien von September 2025 unter Trustworthiness honorieren, und es ist ungewöhnlich, dass eine Agentur-Website das explizit ausspricht statt die Lücke stillschweigend zu lassen.
- **Die einzige Zahl im ganzen Auftritt (2.556 Palettentypen bei Drahtmüller) ist durchgängig konsistent und immer im selben Kontext verwendet** – auf der Fallstudie selbst, auf der Branchenseite Produktion & Fertigung, auf `/muensterland/` und in der Fallstudienübersicht. Keine der Stellen weicht in Wortlaut oder Zahl ab.
- **Konsistente NAP-Angabe (Name, Anschrift, Telefon) auf jeder Seite im Footer**, nicht nur im Impressum, mit `<address>`-Auszeichnung. Das ist ein solides lokales Vertrauenssignal und selten so konsequent umgesetzt.
- **Die Datenschutzerklärung ist erkennbar selbst geprüft statt aus einer Vorlage kopiert**: Der Code-Kommentar beschreibt eine tatsächliche Messung aller Netzanfragen ("jede Netzanfrage wurde protokolliert … keine einzige Anfrage an einen fremden Host, keine Cookies"), und der Text behauptet nur, was daraus folgt.
- **Bewusster Verzicht auf ausufernde Umsatz- oder Größenangaben zur eigenen Firma.** Es wird nirgends eine Mitarbeiterzahl, ein Umsatz oder eine Kundenzahl behauptet, die sich bei einem Ein-Personen-Unternehmen im ersten Jahr sofort widerlegen ließe.
- **Sinnvolle Content-Governance im Quellcode selbst**: Mehrere Datendateien enthalten Kommentare, die begründen, warum etwas *nicht* aufgenommen wurde (z. B. `leistungen.ts`: "Es steht hier nichts, wofuer es keine Seite gibt. Ein Eintrag ohne Inhalt dahinter waere eine Behauptung."). Das deutet auf einen bereits etablierten redaktionellen Prozess hin, der Übertreibung strukturell verhindert.
- **Erkennbare Selbstkorrektur in der Praxis**: Ein Code-Kommentar auf `/kontakt/` hält fest, dass die Seite früher nur 116 Wörter hatte und "bei vierzehn internen Verweisen darauf die dünnste Stelle im ganzen Auftritt" war; inzwischen liegt sie bei rund 420 Wörtern mit einem konkreten Ablaufabschnitt. Das zeigt, dass Thin-Content-Probleme hier bereits erkannt und behoben wurden, was die oben genannten verbleibenden dünnen Seiten (Branchen, `/leistungen/`) als lösbar erscheinen lässt.
- **Barrierefreiheit und technische Sauberkeit der Inhalte**: korrekte Überschriftenhierarchie (ein `h1` je Seite, `Kasten`-Titel bewusst als `<p>` statt als falsche Überschrift ausgezeichnet), `BreadcrumbList` auf jeder Unterseite, saubere `Service`- und `Article`-Schemata nur mit tatsächlich vorhandenen Feldern.

## Geprüfte Dateien (Auswahl)

- `/home/user/Youman-automation/youman-website/src/data/leistungen.ts`
- `/home/user/Youman-automation/youman-website/src/data/branchen.ts`
- `/home/user/Youman-automation/youman-website/src/data/caseStudies.ts`
- `/home/user/Youman-automation/youman-website/src/data/anbieter.ts`
- `/home/user/Youman-automation/youman-website/src/data/kontakt.ts`
- `/home/user/Youman-automation/youman-website/src/data/site.ts`
- `/home/user/Youman-automation/youman-website/src/layouts/Base.astro`
- `/home/user/Youman-automation/youman-website/src/pages/index.astro`
- `/home/user/Youman-automation/youman-website/src/pages/ueber-uns.astro`
- `/home/user/Youman-automation/youman-website/src/pages/muensterland.astro`
- `/home/user/Youman-automation/youman-website/src/pages/kontakt.astro`
- `/home/user/Youman-automation/youman-website/src/pages/leistungen/index.astro` und `/leistungen/[slug].astro`
- `/home/user/Youman-automation/youman-website/src/pages/branchen/index.astro` und `/branchen/[slug].astro`
- `/home/user/Youman-automation/youman-website/src/pages/case-studies/index.astro`, `/case-studies/drahtmueller-palettenoptimierung.astro`, `/case-studies/absolar-warenwirtschaft.astro`
- `/home/user/Youman-automation/youman-website/src/pages/impressum.astro`, `/datenschutz.astro`
- `/home/user/Youman-automation/youman-website/src/pages/llms.txt.ts`
- `/home/user/Youman-automation/youman-website/src/components/Footer.astro`, `SectionHeading.astro`, `Kasten.astro`
- gebauter Stand: `/home/user/Youman-automation/youman-website/dist/**/index.html` (alle 21 Seiten plus `404.html`)
