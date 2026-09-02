# Lokale Auffindbarkeit: Befund youman

## Einordnung

Geprüft wurde der gebaute Auslieferungsstand unter `/home/user/Youman-automation/youman-website/dist` (23 HTML-Seiten) sowie der Vorschauserver unter `http://localhost:4321`. Ein Abgleich hat gezeigt, dass der Vorschauserver exakt den `dist`-Ordner ausliefert, es gibt keine Abweichung zwischen beiden.

youman ist ein einpersonengeführter Dienstleister ohne Ladengeschäft (Amanuel Kheyo, Sitz Dülmener Weg 86a, 46325 Borken), gegründet 2026, mit Tätigkeit im gesamten deutschsprachigen Raum und ausdrücklichem regionalem Schwerpunkt im Münsterland. Für diesen Geschäftstyp zählt lokale Auffindbarkeit vor allem über drei Kanäle: die eigene Website (NAP-Konsistenz, strukturierte Daten, eine ehrliche Regionalseite), das Google-Unternehmensprofil und Zitationen in Verzeichnissen. Von diesen drei Kanälen ließ sich in dieser Prüfung nur der erste tatsächlich untersuchen.

## Was nicht geprüft werden konnte

- **Google-Unternehmensprofil (GBP):** Externe Hosts sind in dieser Sitzung blockiert, ein Abruf war technisch ohnehin nicht möglich. Zusätzlich wurde bestätigt, dass ein solches Profil aktuell nicht existiert. Alle Aussagen dazu in diesem Bericht sind Empfehlungen für die Einrichtung, keine Bestandsprüfung.
- **Branchenverzeichnisse (Tier 1: z. B. Das Örtliche, Gelbe Seiten, 11880, branchenspezifische Verzeichnisse für IT-Dienstleister):** nicht abrufbar, externe Hosts gesperrt. Es lässt sich also nicht sagen, ob und wie NAP dort aktuell steht oder von der Website abweicht.
- **Bewertungen und Rezensionen:** nicht abrufbar. Da das Unternehmen erst 2026 gegründet wurde und kein GBP existiert, ist zusätzlich plausibel, dass ohnehin noch keine nennenswerte Bewertungshistorie besteht.
- **Position im lokalen Suchergebnis (Local Pack) und tatsächliches Suchverhalten:** nicht prüfbar ohne echten Suchzugriff. Der mit 55,2 % der Rankingvarianz dominante Faktor Proximity (Nähe der suchenden Person zum Standort) liegt ohnehin außerhalb dessen, was eine Website beeinflussen kann.
- **Maps-Einbettung, Fotos in einem Unternehmensprofil, Google-Posts:** nicht prüfbar, da kein Profil existiert, an das diese Signale gebunden wären.

## NAP-Konsistenz über die Website

| Quelle | Name | Adresse | Telefon | E-Mail |
|---|---|---|---|---|
| Footer (alle 22 indexierbaren Seiten) | youman | Dülmener Weg 86a, 46325 Borken | +49 155 67541365 | (nicht im Footer) |
| Impressum | youman / Amanuel Kheyo | Dülmener Weg 86a, 46325 Borken, Deutschland | +49 155 67541365 | info@youman-automation.com |
| JSON-LD (alle Seiten, `@type: Organization, ProfessionalService`) | youman | streetAddress/postalCode/addressLocality identisch, addressCountry DE | +49 155 67541365 | info@youman-automation.com |
| Kontaktseite | youman | (nicht im Hauptkontaktblock, siehe Befund) | +49 155 67541365 | info@youman-automation.com |
| Regionalseite /muensterland (Abschlussblock) | youman | Dülmener Weg 86a, 46325 Borken | (nicht dort, aber im Footer der Seite) | (nicht dort) |

Ergebnis: Über alle 22 geprüften Seiten hinweg ist der NAP-Kern (Name, Straße, PLZ, Ort, Telefonnummer, E-Mail) wortgleich. Keine Diskrepanz gefunden, weder in der Schreibweise noch im Format. Das ist kein Zufall, sondern folgt aus der Architektur: Alle Angaben stammen aus genau zwei Datendateien (`src/data/anbieter.ts` und `src/data/kontakt.ts`), auf die Footer, Impressum, JSON-LD und Regionalseite gleichermaßen zugreifen. Eine künftige Änderung (z. B. Umzug) müsste nur an einer Stelle gepflegt werden und würde automatisch überall konsistent durchschlagen. Das ist strukturell einer der stärksten Befunde dieser Prüfung.

Zusätzlich rendert die Seite Adresse und Telefonnummer nur, wenn alle Pflichtfelder vollständig vorliegen (`anbieterVollstaendig`, siehe `src/data/anbieter.ts:81-89`). Eine halb ausgefüllte oder erfundene Adresse kann durch diesen Mechanismus gar nicht erst entstehen.

## Befunde

### Critical

**1. Kein Google-Unternehmensprofil vorhanden.**
Beleg: durch die Aufgabenstellung bestätigt, kein Profil existiert. Für einen Dienstleister ohne Ladengeschäft ist das GBP nach der Website der wichtigste einzelne Hebel für lokale Sichtbarkeit, es speist den Local Pack, Maps und zunehmend auch KI-Suchoberflächen direkt. Ohne Profil bleibt die Dimension GBP-Signale (25 % Gewichtung im Score) faktisch bei null, unabhängig davon, wie gut die Website selbst aufgestellt ist. Empfehlung: Profil anlegen, siehe eigener Abschnitt unten mit konkreten Feldern.

### High

**2. Widerspruch zwischen strukturierten Daten und Text bei der Gebietsangabe.**
Beleg: In `src/layouts/Base.astro:124` steht `areaServed: { '@type': 'Country', name: 'Deutschland' }`, identisch im Service-Objekt in Zeile 241. Im sichtbaren Text dagegen: `src/pages/muensterland.astro:52` „Wir arbeiten im gesamten DACH-Raum“, `src/pages/kontakt.astro:336` „arbeiten im gesamten deutschsprachigen Raum“, und die Fakten-Box in `src/pages/ueber-uns.astro:45` nennt als „Arbeitsraum“ ausdrücklich „DACH“. Für eine Maschine, die nur die strukturierten Daten liest, ist youman ein rein deutsches Unternehmen. Für eine Person, die den Text liest, ein DACH-weit tätiges. Das ist keine kosmetische Kleinigkeit, sondern eine echte Aussage-Diskrepanz zwischen Auszeichnung und Inhalt, und genau solche Diskrepanzen sind es, die Google bei der Bewertung von Entitäten als Unsicherheitssignal werten kann.

Wofür sich entschieden werden sollte: Der Text behauptet DACH-Weite an drei unabhängigen Stellen, das wirkt wie eine bewusste, wiederholt bestätigte Aussage und nicht wie ein Versehen. Die naheliegendere Reparatur ist deshalb, die Auszeichnung dem Text anzupassen (areaServed um Österreich und die Schweiz zu ergänzen, oder als übergeordnete Angabe eine Region/DACH-Zusammenstellung zu verwenden), das ist eine einzeilige Änderung an einer zentralen Stelle. Die Alternative, den Text auf „Deutschland“ zurückzuschneiden, ist ebenfalls denkbar, sollte aber nur gewählt werden, wenn Aufträge in Österreich und der Schweiz tatsächlich (noch) nicht realistisch sind, etwa weil grenzüberschreitende umsatzsteuerliche oder berufsrechtliche Fragen offen sind. Das ist letztlich eine unternehmerische Entscheidung, keine rein technische. Wichtig ist nur, dass Text und Schema danach dieselbe Aussage treffen.

**3. `addressRegion` fehlt in der PostalAddress.**
Beleg: JSON-LD auf allen Seiten enthält `streetAddress`, `postalCode`, `addressLocality`, `addressCountry`, aber kein `addressRegion` (Bundesland, hier „Nordrhein-Westfalen“). Das Feld gehört zu den von Google empfohlenen Bestandteilen einer vollständigen PostalAddress und ist in `src/layouts/Base.astro:156-163` schlicht nicht vorgesehen. Empfehlung: `addressRegion: 'Nordrhein-Westfalen'` ergänzen, eine reine Tatsachenangabe ohne Erfindungsrisiko, passt zur bestehenden „nur vollständig oder gar nicht“-Logik der Datei.

**4. Primäre Kategorie für das künftige Google-Unternehmensprofil ist noch nicht festgelegt.**
Das hängt eng mit Befund 1 zusammen, verdient aber einen eigenen Punkt: Nach der Whitespark-Erhebung 2026 ist die primäre GBP-Kategorie der mit Abstand wichtigste Rankingfaktor, eine falsch gewählte Kategorie ist umgekehrt der stärkste negative Faktor. Bei fünf sehr unterschiedlichen Leistungen (KI-Automation, Chatbots, Webseiten, E-Commerce, individuelle Software) besteht das Risiko, bei der Einrichtung eine zu enge oder zu generische Kategorie zu wählen. Diese Entscheidung sollte vor dem Anlegen des Profils bewusst getroffen und nicht dem Formular überlassen werden. Siehe Empfehlung im GBP-Abschnitt unten.

### Medium

**5. Keine Geokoordinaten in den strukturierten Daten.**
Beleg: `src/layouts/Base.astro:108-111`, im Code ausdrücklich begründet: bewusst weggelassen, weil sonst „erfundene“ Koordinaten drohen würden, und mit dem Verweis, dass dies „ohnehin ins Google-Unternehmensprofil“ gehöre, sobald es existiert. Diese Zurückhaltung ist im Grundsatz richtig, `geo` ist aber unabhängig vom GBP ermittelbar: Die Adresse ist fix und bekannt, eine Geokodierung anhand der echten Anschrift ist keine Erfindung, sondern eine Ableitung aus vorhandenen Fakten. Empfehlung: `geo` mit mindestens 5 Nachkommastellen aus der echten Adresse ergänzen, unabhängig vom Zeitpunkt der GBP-Einrichtung.

**6. Keine `openingHoursSpecification`.**
Ebenfalls in `src/layouts/Base.astro:108-111` bewusst ausgelassen, mangels hinterlegter Zeiten. Für eine Einzelperson mit Terminvereinbarung ist das nachvollziehbar, echte feste Öffnungszeiten gibt es wahrscheinlich nicht. Das ist deshalb kein Website-Mangel, sollte aber bei der GBP-Einrichtung nicht einfach offen bleiben, dort lässt sich „Nur nach Vereinbarung“ als reguläre Option pflegen (siehe GBP-Abschnitt).

**7. Impressum inhaltlich unvollständig und auf `noindex`.**
Beleg: `src/pages/impressum.astro:30` (`noindex={true}`), Fließtext im ausgelieferten HTML umfasst rund 327 Wörter, ein eigener Kasten benennt offen, was fehlt: Haftungsausschluss, Urheberrechtshinweis, Erklärung zur Verbraucherschlichtung nach § 36 VSBG (`src/pages/impressum.astro:114-132`). Die reinen Tatsachenangaben (Name, Anschrift, Telefon, E-Mail) sind vollständig und korrekt, es fehlen ausschließlich rechtliche Erklärungstexte, die laut Code-Kommentar bewusst der Rechtsberatung vorbehalten bleiben. Für die lokale Sichtbarkeit selbst ist `noindex` auf einem Impressum unproblematisch, das ist gängige Praxis. Relevant wird es an zwei Stellen: Erstens ist ein sichtbar unfertiges Impressum ein Vertrauenssignal-Risiko für Menschen, die aus einer lokalen Suche direkt dorthin gelangen, etwa über eine Verzeichnis-Verlinkung. Zweitens ist die Vollständigkeit dieser Seite eine rechtliche Frage außerhalb des Umfangs dieser SEO-Prüfung, sollte aber vor einem stärkeren lokalen Werbeauftritt (GBP, Verzeichniseinträge) abgeschlossen sein, weil dann mit mehr Zulauf gerade auf diese Seite zu rechnen ist.

**8. Startseite und Leistungsseiten ohne jeden Ortsbezug in Title und Meta-Description.**
Beleg: Titel der Startseite „KI-Automation, Chatbots und Software | youman“, der Leistungsseiten entsprechend, keine dieser Seiten enthält einen Orts- oder Regionsbegriff (`dist/index.html`, `dist/leistungen/index.html`). Die gesamte regionale Textrelevanz liegt damit auf einer einzigen Seite, `/muensterland`. Das ist eine nachvollziehbare, im Code auch begründete Entscheidung (keine Ortsnamen-Streuung, um genau die Doorway-Page-Falle zu vermeiden, die im Projekt ausdrücklich abgelehnt wird). Es bedeutet aber auch: Wer nach „Softwareentwicklung Borken“ oder „KI Automation Münsterland“ sucht, findet organisch nur über eine einzige URL Anschluss, nicht über mehrere thematisch passende Seiten. Das ist eine bewusste Kompromissentscheidung, keine ein klarer Fehler, sollte aber als Trade-off benannt bleiben statt als Versehen missverstanden zu werden.

### Low

**9. Keine klickbare Telefonnummer im Header.**
Beleg: `src/components/Header.astro`, die rechte Handlungsaufforderung führt ausschließlich zu `/kontakt`, es gibt keinen `tel:`-Link in der Kopfzeile. Für mobile Nutzer aus einer lokalen Suche, die direkt anrufen statt ein Formular ausfüllen wollen, ist das ein kleiner Reibungspunkt. Kein Muss, aber ein leicht umsetzbarer Zusatznutzen.

**10. Kein Foto von Person oder Standort auf der Website.**
Beleg: `src/pages/ueber-uns.astro:91-95`, dort steht ein `Bildplatz`-Platzhalter „Die Menschen hinter youman“ ohne übergebenes `bild`-Attribut. Andere Bereiche (Leistungen, Branchen, Referenzen) verwenden bereits echte Bilddateien unter `src/assets/img`, hier fehlt sie noch. Für die Website selbst ist das ein allgemeiner Trust-Punkt, für die spätere GBP-Einrichtung wird es konkret relevant: Ein Profil ganz ohne Fotos wirkt unfertig, und Bildmaterial (Person, Arbeitsplatz, ggf. das Gebäude am Dülmener Weg) sollte vor der Profileinrichtung vorbereitet werden.

**11. Adresse steht auf der Kontaktseite nicht im Hauptkontaktblock.**
Beleg: `src/pages/kontakt.astro:62-105`, der Abschnitt „Direkter Draht“ zeigt Terminlink, E-Mail und Telefon, aber keine Adresse. Sie erscheint auf derselben Seite erst im Footer und in einem weiter unten stehenden Kasten „Vor Ort“ (Zeilen 334-341), der auf `/muensterland` verweist. Für jemanden, der aus einer lokalen Suche gezielt auf die Kontaktseite kommt und dort sofort die Anschrift sehen möchte, ist das ein unnötiger Umweg. Eine Ergänzung im oberen Kontaktblock wäre eine kleine, risikoarme Verbesserung.

**12. Mobilfunknummer als einzige Telefonnummer.**
Die hinterlegte Nummer (+49 155 …) ist eine deutsche Mobilfunknummer. Für ein 2026 gegründetes Einzelunternehmen ist das nicht falsch, in Verzeichnissen und im GBP wirkt eine Festnetz- oder VoIP-Nummer auf manche Suchende etablierter. Kein Handlungsbedarf, nur ein Hinweis zur Abwägung.

### Info

**13. `ProfessionalService` in Kombination mit `Organization` ist der passende Schema-Typ.** Für eine Automatisierungs- und Softwareberatung existiert in der von Google unterstützten LocalBusiness-Liste keine spezifischere Unterart (anders als etwa `Restaurant`, `LegalService` oder `Plumber`). Die gewählte generische Kombination ist damit korrekt, nicht bloß eine Verlegenheitslösung.

**14. Keine Bewertungshistorie zu erwarten, da das Unternehmen 2026 gegründet wurde.** Die „18-Tage-Regel“ zur Bewertungs-Frische (Sterling Sky) wird erst relevant, sobald überhaupt erste Bewertungen bestehen. Wichtiger für den Start ist, von Anfang an eine gleichmäßige Kadenz aufzubauen, statt einen Rückstand aufzuholen.

**15. Indexierung ist aktuell global freigegeben.** `src/data/sichtbarkeit.ts` steht auf `FREIGEGEBEN = true`, robots.txt erlaubt vollständig, `sitemap-0.xml` enthält alle 20 regulären Seiten inklusive `/muensterland/`, korrekt ausgenommen sind Impressum, Datenschutz und 404. Das ist die richtige Grundkonfiguration für alles Weitere.

## Regionalseite /muensterland: Bewertung

Diese Seite ist der stärkste Einzelbefund der Prüfung, im positiven Sinn. Es gibt genau eine Regionalseite, keine vervielfältigten Ortsseiten, das entspricht der ausdrücklichen Projektvorgabe und ist im Code selbst mit der Doorway-Page-Problematik begründet (`src/pages/muensterland.astro:13-28`).

Inhaltlich beantwortet die Seite eine echte Frage („was ändert die Nähe praktisch“) statt Ortsnamen in eine generische Vorlage zu streuen. Bemerkenswert ist der Abschnitt „Und wo sie nichts ändert“ (Zeilen 111-131): Die Seite benennt selbst, wo die Nähe zum Anbieter keinen Unterschied macht (Entwicklung läuft ohnehin größtenteils remote, bei reinen Schnittstellenprojekten ist der Standort zweitrangig). Das ist ungewöhnlich ehrlich für eine Marketingseite und wirkt dadurch glaubwürdiger als eine reine Vorteilsliste, es stärkt das Vertrauenssignal, das Google unter E-E-A-T fasst.

Der Beleg für regionale Verankerung ist konkret statt behauptet: Ein realer Kunde aus der Region (Drahtmüller GmbH, Gitterroste nach Maß) wird namentlich verlinkt (Zeilen 147-160), mit einer echten Kennzahl aus dem Projekt. Das ist überprüfbar, anders als eine bloße Aussage „wir kennen die Region“.

Formal ist die Seite sauber eingebunden: Titel „Automation und Softwareentwicklung im Münsterland | youman“ und Meta-Description mit „aus Borken“ enthalten den Ortsbezug klar (`dist/muensterland/index.html`), die Seite ist in der Sitemap, indexierbar, und über den Footer von jeder der 22 Seiten aus in einem Klick erreichbar, zusätzlich kontextuell von `/ueber-uns` und `/kontakt` aus verlinkt. Sie trägt am Seitenende die vollständige Adresse.

Einziger Schwachpunkt, siehe Befund 2: Der Text auf dieser Seite spricht explizit von DACH-Weite, während die strukturierten Daten der ganzen Website nur Deutschland als areaServed führen. Das sollte vor allem hier aufgelöst werden, weil diese Seite die Referenzseite für Regionalität ist.

## Was gut ist

- NAP ist über alle 22 indexierbaren Seiten wortidentisch, keine einzige Diskrepanz gefunden. Das ist strukturell abgesichert, weil Footer, Impressum, JSON-LD und Regionalseite aus denselben zwei Datendateien gespeist werden.
- Adresse und Telefonnummer werden nur gerendert, wenn sie vollständig vorliegen, eine halbe oder erfundene Adresse kann durch den Aufbau der Seite gar nicht erst entstehen.
- Strukturierte Daten sind technisch sauber: gültiges JSON-LD, korrekter Schema-Typ (`ProfessionalService` + `Organization`), vollständige `PostalAddress` (bis auf `addressRegion`), `telephone`, `email`, `founder`, `foundingDate`, `contactPoint`. Felder ohne belastbare Angabe (Öffnungszeiten, Geokoordinaten, Logo) werden bewusst weggelassen statt erfunden, mit Begründung im Code dokumentiert.
- Genau eine Regionalseite, inhaltlich eigenständig, ehrlich auch über die Grenzen der Nähe, mit einem überprüfbaren regionalen Referenzprojekt statt bloßer Behauptung. Keine Doorway-Page-Struktur.
- robots.txt und Sitemap sind korrekt konfiguriert, die Regionalseite ist enthalten und indexierbar, rechtliche Seiten sind korrekt ausgenommen.
- Ortsbezüge im Fließtext wirken an keiner Stelle aufgesetzt oder wie Keyword-Stuffing, weder auf der Regionalseite noch auf Kontakt oder Über uns. „Borken“, „Kreis Borken“ und „Münsterland“ tauchen sparsam und im jeweiligen Satzzusammenhang sinnvoll auf.

## Google-Unternehmensprofil: was fehlt und was einzutragen wäre

Es existiert noch kein Profil. Für einen Dienstleister ohne Ladengeschäft ist dessen Einrichtung der wirkungsvollste einzelne Schritt, den dieser Bericht empfehlen kann, wichtiger als jede weitere Feinjustierung an der Website. Die folgenden Angaben lassen sich aus dem vorhandenen Quellcode direkt entnehmen und sind bereits konsistent, das Profil müsste sie nur unverändert übernehmen:

- **Unternehmensname:** youman (`src/data/anbieter.ts:31`)
- **Adresse:** Dülmener Weg 86a, 46325 Borken, Deutschland (`src/data/anbieter.ts:52-55`). Zu entscheiden ist, ob die Adresse öffentlich auf der Karte erscheinen soll oder ob das Profil als reines Dienstleistungsgebiet-Unternehmen eingerichtet wird, bei dem die Adresse nur zur Verifizierung dient und nicht öffentlich angezeigt wird. Google bietet diese Option ausdrücklich für Anbieter ohne Kundenverkehr vor Ort an, was hier zutrifft.
- **Telefonnummer:** +49 155 67541365 (`src/data/kontakt.ts:24`), muss exakt in diesem Format im Profil stehen, damit keine Abweichung zur Website entsteht.
- **Website-URL:** https://www.youman-automation.de
- **E-Mail:** info@youman-automation.com, sofern im Profil ein Kontaktfeld dafür vorgesehen ist.
- **Gründungsdatum:** 2026 (`src/data/site.ts`, Feld `gruendungsjahr`, auch als `foundingDate` im Schema hinterlegt), lässt sich im Profil als Eröffnungsdatum eintragen.
- **Kurzbeschreibung:** Der vorhandene Beschreibungstext in `src/data/site.ts` („youman verbindet KI-Automation mit individueller Softwareentwicklung…“) ist bereits so geschrieben, dass er sich nahezu unverändert als GBP-Unternehmensbeschreibung verwenden lässt.
- **Terminbuchungslink:** Der bestehende Google-Kalender-Link (`src/data/kontakt.ts:25`) lässt sich direkt als Buchungslink im Profil hinterlegen.
- **Leistungen/Dienste:** Die fünf Leistungsseiten (KI-Automationen, Chatbots, Webseiten, E-Commerce-Lösungen, individuelle Software) geben die Struktur für die „Dienste“-Liste im Profil vor, inklusive der dort bereits vorhandenen Beschreibungstexte.

Was dagegen noch fehlt und vor oder bei der Einrichtung entschieden beziehungsweise beschafft werden muss:

- **Primäre Kategorie.** Noch nicht festgelegt (siehe Befund 4). Angesichts der Bandbreite der Leistungen ist „Softwareunternehmen“ die naheliegende, hinreichend breite Hauptkategorie, ergänzt um Nebenkategorien wie „Beratungsunternehmen für Informationstechnologie“ und „Webdesigner“. Diese Wahl sollte bewusst getroffen werden, da eine falsche Kategorie laut Whitespark 2026 der stärkste negative Rankingfaktor überhaupt ist.
- **Öffnungszeiten.** Auf der Website bewusst nicht hinterlegt (Befund 6). Im Profil lässt sich stattdessen die Option „Nur nach Vereinbarung“ setzen, das entspricht der tatsächlichen Arbeitsweise (Terminvereinbarung, kein Publikumsverkehr) und ist ehrlicher als erfundene feste Zeiten.
- **Fotos.** Es gibt aktuell keine verwendbaren Aufnahmen von Person oder Arbeitsplatz auf der Website (Befund 10). Für ein glaubwürdiges Profil sollte mindestens ein Foto von Amanuel Kheyo und/oder dem Arbeitsplatz vorbereitet werden, bevor das Profil veröffentlicht wird.
- **Servicegebiet im Profil.** Hier wirkt sich Befund 2 direkt aus: Bevor das Servicegebiet im GBP eingetragen wird, sollte geklärt sein, ob es realistisch DACH-weit ist oder auf Deutschland (mit Schwerpunkt Münsterland) beschränkt bleiben soll, damit Website-Text, strukturierte Daten und GBP-Servicegebiet dieselbe Aussage treffen. Zu beachten ist außerdem, dass das Servicegebiet-Feld im GBP für ortsungebundene Reichweite (bundesweit oder länderübergreifend) ohnehin nur eingeschränkt geeignet ist, es ist in erster Linie für lokal begrenzte Anfahrtsgebiete gedacht.
- **Erste Bewertungen.** Da das Unternehmen neu ist, existiert noch keine Bewertungshistorie. Sinnvoll ist, nach den ersten abgeschlossenen Projekten (z. B. mit den bereits auf der Website genannten Referenzkunden) gezielt um eine Bewertung zu bitten, um von Beginn an eine gleichmäßige Kadenz aufzubauen, statt später eine Lücke aufzuholen.
- **Nutzerverwaltung und Verifizierung.** Rein organisatorisch: Wer das Profil verwaltet (vermutlich Amanuel Kheyo selbst) und auf welchem Weg verifiziert wird (Post, Anruf oder Video, je nach Kategorie und Adresssichtbarkeit), ist vorab zu klären.

## Empfehlungen in Kurzform, nach Dringlichkeit

1. Google-Unternehmensprofil anlegen, mit vorab bewusst gewählter primärer Kategorie (Critical/High)
2. Widerspruch bei der Gebietsangabe auflösen: strukturierte Daten und Text auf dieselbe Aussage bringen, DACH oder Deutschland (High)
3. `addressRegion` in der PostalAddress ergänzen (High)
4. `geo`-Koordinaten anhand der echten Adresse ergänzen, unabhängig vom GBP (Medium)
5. Impressum inhaltlich vervollständigen (Rechtstexte), bevor stärker lokal geworben wird (Medium)
6. Foto(s) von Person und/oder Arbeitsplatz beschaffen, für Website und künftiges GBP (Low/Medium)
7. Adresse im Hauptkontaktblock von /kontakt ergänzen, nicht nur im Footer (Low)
8. Click-to-call-Link im Header ergänzen (Low)
9. Nach den ersten Projektabschlüssen aktiv um erste Bewertungen bitten, sobald ein GBP existiert (Low, aber zeitkritisch für die spätere 18-Tage-Frische-Regel)
10. Entscheiden, ob Öffnungszeiten als „nur nach Vereinbarung“ im GBP hinterlegt werden (Low)
