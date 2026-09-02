# GEO-Audit: Auffindbarkeit in KI-Suchsystemen

Geprüfter Stand: gebauter Auslieferungsstand unter `dist/` (23 HTML-Seiten) sowie Quellcode der dynamischen Routen (`robots.txt.ts`, `llms.txt.ts`, Layout mit JSON-LD). Vorschauserver unter `http://localhost:4321` war erreichbar, robots.txt und llms.txt liefern dort denselben Inhalt wie im Build.

## Was in dieser Umgebung nicht prüfbar war

Externe Hosts sind in dieser Sitzung blockiert. Es konnte **nicht** geprüft werden, ob youman von Google AI Overviews, ChatGPT, Perplexity oder Bing Copilot tatsächlich zitiert oder auch nur erwähnt wird, ob die Marke in Wikipedia, Reddit, YouTube oder LinkedIn vorkommt, oder wie die Domain in einem Index wie DataForSEO dasteht. Es gibt dazu auch keine plausible Erwartung: Die Domain ist 2026 registriert, das Unternehmen ist neu gegründet, und ohne Crawl-Historie kann keine der genannten Plattformen bereits etwas zitieren. Jede Aussage zu "Sichtbarkeit heute" wäre erfunden. Alles Folgende bezieht sich deshalb ausschließlich auf die strukturelle Seite: Kann ein KI-Crawler die Seite lesen, und ist der Inhalt so gebaut, dass er sich zitieren ließe, sobald ein Crawl stattfindet.

Aus demselben Grund gibt es unten keine Plattform-Scores für Google AIO, ChatGPT, Perplexity oder Bing Copilot mit Punktzahl. Das wäre Raten. Was es stattdessen gibt: eine strukturelle Einschätzung pro Plattform, begründet über Zugriffsrechte und Inhaltsform.

## Kurze Einordnung

Die technische Basis ist ordentlich: kein Crawler ist ausgesperrt, die Seite ist serverseitig gerendert (kein JavaScript nötig, um an den Inhalt zu kommen), es gibt durchgängig strukturierte Daten, eine llms.txt existiert und wird korrekt aus denselben Daten wie die Seiten selbst erzeugt. Die eigentliche Lücke liegt nicht in der Technik, sondern im Inhaltsformat: Es gibt auf der gesamten Seite keine einzige Seite und keinen Absatz im Frage-Antwort-Format, keine FAQ-Struktur, kein FAQPage-Schema. Für ein Unternehmen mit rund 9.100 Wörtern über 23 Seiten ist das bei einer neuen Seite nachvollziehbar, aber es ist der Hebel mit dem größten Effekt für spätere KI-Zitierfähigkeit, weil KI-Systeme bevorzugt in sich geschlossene Antwortblöcke extrahieren, keine Marketing-Absätze.

---

## Befunde

### 1. robots.txt sperrt keinen KI-Crawler (Severity: Info / gut)

**Beleg:** `dist/robots.txt` (erzeugt aus `src/pages/robots.txt.ts`):
```
User-agent: *
Allow: /

Sitemap: https://www.youman-automation.de/sitemap-index.xml
```
Es gibt keinen eigenen Block für GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot oder Bingbot. Ein pauschales `Allow: /` für `User-agent: *` erlaubt allen genannten Crawlern das Abrufen, ohne Ausnahme.

**Bewertung:** Das ist die richtige Ausgangslage für eine Seite, die sichtbar sein will. Der Code-Kommentar in `robots.txt.ts` zeigt zudem, dass die Entscheidung bewusst getroffen wurde (kein `Disallow: /` während der Sperrphase, damit das `noindex` in den Seiten überhaupt gesehen werden kann) und nicht aus Zufall entstanden ist. Der Schalter `indexierungErlaubt` in `src/data/sichtbarkeit.ts` steht aktuell auf freigegeben.

**Empfehlung:** Keine Änderung nötig. Falls youman KI-Trainingscrawler wie CCBot oder anthropic-ai künftig gezielt vom Training ausschließen möchte (nicht von der Suche, das ist ein Unterschied), könnte ein eigener Block ergänzt werden. Das ist optional und ändert nichts an der Zitierfähigkeit in Such-Kontexten wie GPTBot/OAI-SearchBot oder PerplexityBot, die von der aktuellen Regel ohnehin erfasst sind.

---

### 2. llms.txt vorhanden, sauber gebaut, aber mit realistisch begrenztem Nutzen (Severity: Info)

**Beleg:** `src/pages/llms.txt.ts` erzeugt `dist/llms.txt` aus denselben Datenquellen wie die Seiten (Branchen, Leistungen, Referenzprojekte, Kontakt). Der Code-Kommentar im Quelltext ist bereits ehrlich formuliert: *"Google wertet die Datei nicht aus."* Das ist korrekt so und muss hier nicht wiederholt werden, es ist aber wichtig, es im Audit zu bestätigen statt es unkommentiert zu lassen: llms.txt ist keine offiziell von Google, OpenAI, Anthropic oder Perplexity bestätigte Norm. Sie wird von manchen KI-Werkzeugen (v. a. Entwickler-Tools, die Seiteninhalte für einen Prompt zusammenfassen) gelesen, aber es gibt keinen bestätigten, breiten Einsatz durch die großen Such- und Antwortsysteme selbst als Ranking- oder Zitierquelle.

**Inhaltliche Qualität der Datei:** gut. Kurze Beschreibung, klare Liste aller Branchen- und Leistungsseiten mit Ein-Satz-Teaser, beide Referenzprojekte mit Kunde und Kernaussage, vollständige Kontaktdaten. Sie ist an den Sperr-Schalter gekoppelt (bei `indexierungErlaubt = false` liefert sie nur einen Hinweis statt Inhalt) — konsistent mit robots.txt und den Meta-Tags, keine widersprüchliche Botschaft an verschiedene Abnehmer.

**Bewertung:** Weder schädlich noch ein Hebel mit großer Wirkung. Sie kostet, wie im Code-Kommentar richtig festgehalten, nichts an Pflegeaufwand, weil sie aus denselben Daten wie die Seiten entsteht. Das rechtfertigt, sie zu behalten, aber sie ersetzt keine der folgenden Maßnahmen zur Zitierfähigkeit der eigentlichen Seiten.

**Empfehlung:** So belassen. Keine Priorität, keine Investition draufsetzen.

---

### 3. RSL 1.0 (Really Simple Licensing) nicht vorhanden (Severity: Low / Info)

**Beleg:** Keine RSL-Datei, kein entsprechender Header oder Link-Tag im Quellcode gefunden.

**Bewertung:** RSL ist ein sehr junger, noch nicht breit unterstützter Standard zur maschinenlesbaren Lizenzierung von Inhalten für KI-Training. Das Fehlen ist für ein zweiseitiges, gerade gegründetes Unternehmen kein reales Problem, die allermeisten Websites haben das aktuell nicht. Nur der Vollständigkeit halber erwähnt.

**Empfehlung:** Keine Handlung nötig. Beobachten, ob sich der Standard etabliert, bevor Aufwand investiert wird.

---

### 4. Keine einzige Seite im Frage-Antwort-Format, kein FAQPage-Schema (Severity: High)

**Beleg:** Durchsucht wurden alle 23 HTML-Seiten nach `FAQPage`-Markup: keine Treffer. Überschriften mit Fragezeichen existieren (15 von 288 H2/H3), sind aber durchweg Handlungsaufforderungen statt Informationsfragen, zum Beispiel "Klingt nach Ihrem Fall?", "Passt das zu Ihrer Situation?", "Wo klemmt es bei Ihnen?". Das sind CTA-Formulierungen, keine Fragen, wie ein Interessent sie in eine Suche oder einen Chat eingeben würde. Ausklappbare Abschnitte (`<details>`/`<summary>`) gibt es auf den fünf Leistungsseiten und der Branchenübersicht, ihre Titel sind aber Themenlabels ("01 Antworten aus Ihren Unterlagen", "02 Grenzen und Übergabe"), keine Fragen.

**Konkrete Fragen, die ein Interessent stellen würde und für die es hier keine eigene, direkt extrahierbare Antwort gibt**, obwohl der Stoff dafür an anderer Stelle im Text steckt:
- "Was kostet ein Chatbot / eine KI-Automation bei youman?" — auf keiner Seite beantwortet, auch nicht in Größenordnungen.
- "Wie lange dauert die Umsetzung eines Projekts?" — der Ablauf (Analyse, Konzept, Umsetzung, Betrieb) ist beschrieben, aber ohne Zeitangaben.
- "Was ist der Unterschied zwischen einem Chatbot und einer KI-Automation?" — beide Begriffe kommen mehrfach vor, eine explizite Abgrenzung fehlt.
- "Lässt sich das an mein bestehendes ERP- oder Warenwirtschaftssystem anbinden (z. B. SAP, Lexware)?" — in den zwei Case Studies faktisch beantwortet (Drahtmüller/ERP, Absolar/Lexware Office), aber nur als Teil einer langen Fallgeschichte, nicht als eigenständig zitierbarer Satz.
- "Arbeitet youman auch mit kleinen Betrieben / kleinem Budget?" — nirgends adressiert.
- "Ist youman nur im Münsterland tätig oder auch überregional?" — die Münsterland-Seite beschreibt den Standortvorteil, beantwortet die Reichweitenfrage aber nicht direkt in einem Satz.
- "Was passiert nach der ersten Anfrage / dem Erstgespräch?" — Prozessschritte sind vorhanden, aber wieder ohne konkrete Antwort auf "was passiert als Nächstes, wenn ich anfrage".

**Bewertung:** Das ist die größte strukturelle Lücke für KI-Zitierfähigkeit. KI-Antwortsysteme extrahieren bevorzugt kurze, in sich geschlossene Blöcke, die eine konkrete Frage direkt beantworten. Ohne solche Blöcke muss ein Sprachmodell den Fließtext selbst zusammenfassen, was die Wahrscheinlichkeit einer korrekten, vollständigen Zitierung senkt, und liefert bei Fragen wie "Was kostet..." schlicht keine Grundlage, weil die Information gar nicht existiert.

**Empfehlung (kleinste sinnvolle Maßnahme):** Kein vollständiger Ratgeberbereich oder Blog, das wäre für den aktuellen Umfang der Seite (zwei Referenzprojekte, 23 Seiten) unverhältnismäßig viel Aufwand und ließe sich mit dem vorhandenen Beleg-Material auch nicht glaubwürdig füllen. Sinnvoller: ein kompakter FAQ-Block mit 5 bis 8 Fragen (die oben genannten sind ein guter Ausgangspunkt) auf der Leistungen-Übersicht oder der Startseite, jede Antwort als eigenständiger Absatz von 40 bis 60 Wörtern, ohne Verweis auf vorherigen Kontext nötig, ergänzt um `FAQPage`-Schema. Aufwand: klein, die Antworten lassen sich aus vorhandenem Wissen (Preislogik, Ablaufzeiten, Zielgruppe) formulieren, ohne neue Recherche.

---

### 5. Passagenlänge unter dem für KI-Zitate günstigen Bereich (Severity: Medium)

**Beleg:** Automatisierte Auszählung aller `<p>`-Absätze innerhalb von `<main>` über alle 23 Seiten (391 Absätze mit mindestens 8 Wörtern): Median 15 Wörter, längster einzelner Absatz 65 Wörter. Kein einziger Absatz erreicht den für KI-Zitate günstigen Bereich von 134 bis 167 Wörtern. Rechnet man Überschrift plus zugehörigen Absatz und Liste zusammen (ein ganzer inhaltlicher Abschnitt), kommen einzelne Abschnitte in die Nähe des Zielbereichs, zum Beispiel der Abschnitt "Was dabei gebaut wird" auf der Seite `leistungen/ki-automationen` mit rund 147 Wörtern, verlässt sich dabei aber auf nummerierte Listenpunkte ("01 Dokumente auslesen und einordnen…"), deren Nummerierung außerhalb der Seite keinen Sinn ergibt.

**Bewertung:** Der knappe, werbliche Schreibstil (kurze Sätze, viel Weißraum) ist für menschliche Leser auf einer Marketingseite eine bewusste und nachvollziehbare Entscheidung. Für KI-Extraktion ist er ungünstig, weil ein Sprachmodell selten einen einzelnen 15-Wort-Satz als vollständige, stehende Antwort zitiert. Das ist kein Fehler, sondern ein Zielkonflikt zwischen Lesbarkeit für Menschen und Extrahierbarkeit für Maschinen, und muss nicht flächendeckend aufgelöst werden.

**Empfehlung:** Nicht die ganze Seite umschreiben. Stattdessen gezielt an den Stellen, an denen bereits eine klare Aussage steht (die FAQ-Antworten aus Befund 4, plus die "Worum es geht"-Einleitung jeder Leistungsseite), einen zusammenhängenden Absatz von 100 bis 160 Wörtern anbieten, der ohne Liste und ohne vorherigen Kontext eine vollständige Antwort ist. Der bestehende knappe Stil kann daneben stehen bleiben.

---

### 6. Strukturierte Daten: solide Basis, aber ohne Datumsangaben und ohne FAQ (Severity: Medium)

**Beleg:** Alle 22 inhaltlichen Seiten (alles außer der 404-Seite) tragen `Organization`/`ProfessionalService`- und `WebSite`-Schema mit vollständiger Adresse, Telefon, E-Mail, `foundingDate: "2026"` und einem benannten Gründer (`founder`: Amanuel Kheyo). 19 Seiten zusätzlich `BreadcrumbList`. Die fünf Leistungsseiten tragen `Service`-Schema, die zwei Referenzseiten `Article`-Schema mit Titel, Beschreibung und `author`/`publisher`-Verweis auf die Organisation. Es fehlt in allen `Article`-Blöcken `datePublished` und `dateModified`. Es gibt auf der gesamten Seite kein `FAQPage`-Schema (Grund: keine FAQ-Inhalte, siehe Befund 4) und keine sichtbaren oder maschinenlesbaren Aktualisierungsdaten auf irgendeiner Seite.

**Bewertung:** Die Entity-Signale (Name, Adresse, Gründer, Branche, Leistungen als `knowsAbout`) sind für eine neue Seite ungewöhnlich gut ausgebaut, das hilft KI-Systemen, youman als konkrete, eindeutige Organisation statt als generischen Text einzuordnen. Die fehlenden Datumsangaben sind ein reales Manko: KI-Systeme gewichten frische, datierte Inhalte stärker, und ohne `datePublished`/`dateModified` kann weder Google noch ein Sprachmodell erkennen, wie aktuell eine Referenzgeschichte ist.

**Empfehlung:** `datePublished` und `dateModified` zum `Article`-Schema der beiden Case Studies ergänzen (Datum ist im Projektverlauf vermutlich bekannt oder lässt sich auf das Veröffentlichungsdatum der Seite setzen). Sobald ein FAQ-Block existiert (Befund 4), dafür `FAQPage`-Schema ergänzen. Beides geringer Aufwand, da die technische Infrastruktur für JSON-LD (`@graph`, zentrale Organisation-Referenz per `@id`) bereits sauber steht und nur erweitert werden muss.

---

### 7. Technische Zugänglichkeit für KI-Crawler: gut, weil serverseitig gerendert (Severity: Info / gut)

**Beleg:** Der Build erzeugt statisches HTML (`dist/*/index.html`), sämtlicher Fließtext, sämtliche Überschriften und alle JSON-LD-Blöcke liegen direkt im ausgelieferten HTML, ohne dass JavaScript ausgeführt werden müsste. Das wurde direkt an den ausgelieferten Dateien geprüft (Textextraktion ohne Browser-Rendering).

**Bewertung:** Das ist ein klarer Vorteil gegenüber Single-Page-Apps mit reinem Client-seitigem Rendering. GPTBot, ClaudeBot, PerplexityBot und vergleichbare Crawler lesen üblicherweise kein oder nur eingeschränkt JavaScript aus; hier ist das irrelevant, weil der Inhalt bereits im Rohmarkup steht.

**Empfehlung:** Keine Änderung nötig. Bei künftigen Erweiterungen (etwa interaktiven Elementen) darauf achten, dass zitierfähiger Text weiterhin serverseitig im HTML landet und nicht nur clientseitig nachgeladen wird.

---

### 8. Case Studies enthalten konkrete, zitierfähige Einzelaussagen (Severity: Info / gut)

**Beleg:** Zum Beispiel im Fließtext: "2.556 aktive Palettentypen" (Drahtmüller-Fallstudie) und "Lexware Office unterstützt laut Herstellerangabe unter anderem das Lesen, Anlegen und Abschließen von…" (Absolar-Fallstudie, mit Attribution "laut Herstellerangabe").

**Bewertung:** Genau solche konkreten, mit Zahl oder Quelle versehenen Einzelsätze sind das, was KI-Systeme gern zitieren, weil sie überprüfbar und spezifisch statt allgemein sind. Mit nur zwei Referenzprojekten ist die Menge an solchem Material naturgemäß klein, aber die Qualität des Vorhandenen ist gut.

**Empfehlung:** Dieses Muster bei künftigen Case Studies beibehalten: konkrete Zahl, benannter Kunde, wo möglich Quellenangabe.

---

### 9. Kein Multimedia-Fußabdruck über die eigene Seite hinaus prüfbar/vorhanden (Severity: Low, außerhalb der Reichweite dieses Audits)

**Beleg:** Auf der Seite selbst: keine eingebetteten Videos, keine YouTube-Einbettung, keine Vergleichstabellen. Bilder (78 im Build) sind bis auf die fünf Hero-Bilder der Startseite mit Alt-Text versehen; die fünf Hero-Bilder haben bewusst leeren `alt`, was für rein dekorative Hintergrundbilder korrekt ist, kein echter Mangel.

**Bewertung:** YouTube-Präsenz korreliert laut den in diesem Auftrag hinterlegten Referenzwerten am stärksten mit KI-Zitationen, gefolgt von Reddit und Wikipedia. Ob youman dort präsent ist, konnte in dieser Umgebung nicht geprüft werden (siehe Einordnung oben) und liegt ohnehin außerhalb dessen, was sich im Code dieser Website ändern lässt. Es ist eine Marken- und Kanalfrage, keine Website-Frage.

**Empfehlung:** Nicht Teil dieses Website-Audits. Falls youman perspektivisch Sichtbarkeit in KI-Antworten aufbauen will, wäre ein eigener YouTube-Kanal mit den Case Studies als Kurzvideo der Hebel mit der laut Aufgabenstellung stärksten Korrelation, das ist aber eine strategische Entscheidung außerhalb des Codes.

---

### 10. Rechtsseiten korrekt mit noindex, keine Doppeldeutigkeit (Severity: Info / gut)

**Beleg:** `impressum/index.html` und `datenschutz/index.html` tragen `noindex`, ebenso `404.html`. Die übrigen 20 Seiten sind indexierbar und stehen vollständig in `sitemap-0.xml`.

**Bewertung:** Konsistent und sauber getrennt: Inhalte, die zitiert werden sollen, sind offen; Pflichtseiten ohne inhaltlichen Mehrwert für eine Suche sind ausgenommen. Keine widersprüchlichen Signale zwischen robots.txt, Sitemap und Meta-Tags gefunden.

**Empfehlung:** Keine Änderung nötig.

---

## Strukturelle Einschätzung pro Plattform

Ausdrücklich keine Punktzahl, weil keine Messung möglich war. Nur eine Einordnung, wie gut die strukturellen Voraussetzungen je Plattform aktuell sind:

- **Google AI Overviews:** Crawler-Zugriff gegeben, strukturierte Daten vorhanden, aber ohne FAQ-Format und ohne Datumsangaben fehlt genau das Format, aus dem AI Overviews bevorzugt kurze Antworten ziehen. llms.txt spielt hier keine Rolle, wie im Code selbst korrekt vermerkt.
- **ChatGPT (inkl. Suche):** Crawler (GPTBot, OAI-SearchBot) nicht blockiert, llms.txt vorhanden und sauber, aber ohne bestätigte breite Nutzung durch ChatGPT als Zitierquelle. Der entscheidende Faktor bleibt auch hier extrahierbarer Fließtext, nicht die llms.txt.
- **Perplexity:** PerplexityBot nicht blockiert. Perplexity zitiert erfahrungsgemäß gern kurze, faktische Aussagen mit Zahl oder Quelle, wie sie in den Case Studies bereits vorkommen, aber selten genug vorhanden sind.
- **Bing Copilot:** Bingbot nicht blockiert, Sitemap vorhanden. Gleiche strukturelle Lücken wie bei Google AI Overviews.

Für alle vier gilt gleichermaßen: Ohne Frage-Antwort-Inhalte und mit sehr wenig Gesamttextmenge (rund 9.100 Wörter über 23 Seiten, sechs Branchenseiten mit nur 222 bis 259 Wörtern) ist die Ausgangsbasis für Zitate schmal, unabhängig von der Plattform. Das ist bei einer neuen, bewusst schlank gehaltenen Seite mit zwei Referenzprojekten nachvollziehbar, aber es ist der gemeinsame Nenner aller vier Plattform-Einschätzungen.

---

## Zusammenfassung: was gut ist

- Kein KI-Crawler wird ausgesperrt, robots.txt ist korrekt und bewusst so gebaut.
- llms.txt existiert, ist inhaltlich stimmig und ehrlich im eigenen Code dazu kommentiert, was sie bei Google nicht leistet.
- Durchgängige, sauber verkettete strukturierte Daten (Organization, WebSite, Breadcrumb, Service, Article) mit vollständigen Kontaktdaten, Gründungsjahr und benanntem Gründer.
- Statisches, serverseitig gerendertes HTML: kein Zugänglichkeitsproblem für KI-Crawler.
- Konkrete, mit Zahlen und teils Quellenangaben versehene Aussagen in den zwei Case Studies.
- Konsistente noindex-Behandlung der Rechtsseiten, keine widersprüchlichen Signale.

## Größte Lücke

Kein Frage-Antwort-Inhalt irgendwo auf der Seite. Das ist der Punkt mit dem größten Hebel für künftige KI-Zitierfähigkeit und lässt sich mit vertretbarem Aufwand schließen: ein kompakter FAQ-Block mit 5 bis 8 Fragen (Kosten, Dauer, Abgrenzung Chatbot/Automation, ERP-Anbindung, Eignung für kleine Betriebe, regionale Reichweite, Ablauf nach Erstkontakt), mit `FAQPage`-Schema, plus Datumsangaben in den bestehenden `Article`-Schemas der zwei Case Studies.
