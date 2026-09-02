# Maßnahmenplan youman-automation.de

Abgeleitet aus dem Audit vom 2. September 2026, Gesamtbewertung 76 von 100.
Sortiert nach Wirkung geteilt durch Aufwand, nicht nach Schweregrad allein.

## Phase 1: sofort, in einer Stunde erledigt

Alles hier sind Einzeiler oder Textänderungen an einer Stelle. Zusammen
heben sie die Bewertung um etwa vier Punkte.

1. **Bildfeld ins Article-Objekt eintragen.** In `src/layouts/Base.astro`
   liegt die Variable für das Vorschaubild bereits berechnet vor, sie ist
   nur nicht in das Objekt für den Beitrag eingetragen. Google führt das
   Feld als Pflichtangabe. Aufwand: eine Zeile.

2. **Widerspruch beim Wirkungsraum auflösen.** Die Auszeichnung sagt
   "Deutschland", der Text sagt an drei Stellen "DACH-Raum". Entweder die
   Auszeichnung um Österreich und die Schweiz erweitern, oder die Textseiten
   auf Deutschland zurückstufen. Die erste Fassung ist wahrscheinlich die
   richtige, weil die Textaussage bewusst so geschrieben wurde.

3. **Beschreibung der Kontaktseite verlängern.** 89 Zeichen liegen unter der
   Schwelle, ab der Google die eigene Beschreibung übernimmt statt sich eine
   aus dem Seitentext zu bauen. Ziel sind 120 bis 160 Zeichen. Betrifft
   ausgerechnet die am stärksten verlinkte Seite des Auftritts.

4. **Region in die Anschrift eintragen.** In den strukturierten Daten fehlt
   das Feld für das Bundesland. Nordrhein-Westfalen ist belegt und steht
   bereits im Impressum.

5. **Schrägstriche in den Brotkrumen angleichen.** Die Zwischenglieder
   werden von Hand ohne abschließenden Schrägstrich angegeben, die
   tatsächlichen Adressen tragen einen. Betrifft drei Stellen in den
   Seitenvorlagen.

## Phase 2: diese Woche, je ein bis drei Stunden

6. **Hero auf zwei bis drei Motive kürzen oder das Laden staffeln.** Die
   Startseite lädt derzeit alle fünf Bilder sofort, weil sie übereinander
   im sichtbaren Bereich liegen und die Verzögerungsmarkierung deshalb nicht
   greift. Zwei Wege: die Zahl der Motive senken, oder die Bilder erst per
   Skript nachladen, sobald das erste angezeigt wird. Ersparnis: rund die
   Hälfte des Gewichts der Startseite.

7. **Fallback der Hero-Bilder begrenzen.** Das src-Attribut zeigt auf die
   Kameraauflösung mit bis zu 6000 mal 4000 Bildpunkten. Kein aktueller
   Browser lädt diese Dateien, sie liegen aber als rund 3,6 MB im
   Auslieferungsstand. In der Bildkomponente die größte genutzte Breite
   als Obergrenze setzen.

8. **Die beiden Referenzseiten anbinden.** Sie bekommen vier und fünf
   interne Verweise, die Kontaktseite 189. Mindestens: ein Querverweis
   zwischen den beiden Projekten, ein Verweis von jeder passenden
   Leistungsseite, ein Verweis von jeder passenden Branchenseite.

9. **Die Regionalseite aus der Fußzeile holen.** Sie ist derzeit nur dort
   verlinkt und hat entsprechend 25 eingehende Verweise. Ein Verweis von
   der Startseite und von Über uns wäre angemessen.

10. **Datum an die Referenzprojekte.** Beide haben keines, damit fehlt jedes
    Aktualitätssignal. Wenn kein genaues Datum vorliegt, genügt das Jahr.
    Erfinden ist keine Option, aber nachfragen schon.

## Phase 3: dieser Monat, der eigentliche Hebel

11. **Google-Unternehmensprofil einrichten.** Das ist die wirkungsvollste
    einzelne Maßnahme in diesem Plan, wirksamer als jede weitere Feinarbeit
    an der Website. Alle Angaben liegen im Projekt vor und sind stimmig:
    Name, Anschrift, Telefon, Website, Gründungsjahr, Beschreibung,
    Terminlink, Leistungsliste. Zu entscheiden ist, ob die Adresse
    öffentlich erscheint oder das Profil als reines Dienstleistungsgebiet
    läuft. Google bietet das ausdrücklich für Anbieter ohne Kundenverkehr
    vor Ort an, was hier zutrifft.

12. **Die sechs Branchenseiten inhaltlich trennen.** Derzeit 222 bis 259
    Wörter, alle nach demselben Bauplan, vier ohne Referenzbezug. Je Seite
    braucht es etwas, das nur dort steht: ein benanntes System aus der
    Branche, ein konkreter Ablauf mit seinen Übergabepunkten, eine
    Eigenheit, die nur dort auftritt. Ziel sind 500 bis 700 Wörter je Seite,
    aber nur mit echtem Inhalt, nicht mit Füllmaterial.

13. **Die Übersicht der Leistungen ausbauen.** 217 Wörter für eine Seite,
    die den gesamten Leistungsumfang tragen soll. Was fehlt, ist die
    Einordnung: wie die fünf Bereiche zusammenhängen, womit ein Projekt
    üblicherweise anfängt, was zuerst gebaut wird.

14. **Einen Frage-Antwort-Bereich anlegen.** Fünf bis acht Fragen genügen,
    mit passender Auszeichnung. Konkret ohne Antwort auf der Seite: Was
    kostet ein Chatbot? Wie lange dauert die Umsetzung? Worin unterscheiden
    sich Chatbot und KI-Automation? Lässt sich das an SAP oder Lexware
    anbinden? Lohnt sich das für kleine Betriebe? Arbeitet ihr nur im
    Münsterland? Das Wissen dafür ist vorhanden, es steht nur nirgends als
    Frage und Antwort.

15. **Die Fachkenntnis belegen.** Derzeit gibt es keine Profile, keinen
    ausgeschriebenen Werdegang und einen uneinheitlich geschriebenen Namen.
    Ein LinkedIn-Profil, verknüpft über das entsprechende Feld in den
    strukturierten Daten, und ein Absatz zum Werdegang wären belegbare
    Substanz, kein Marketing.

## Phase 4: laufend

16. **Sitemap in der Search Console einreichen.** Unter der neuen Domain als
    Property anlegen und `sitemap-index.xml` einreichen. Ohne das dauert die
    Aufnahme Wochen statt Tage.

17. **Nach dem Umzug die Live-Seite gegenprüfen.** In dieser Sitzung war das
    nicht möglich, weil externe Hosts blockiert sind. Zu prüfen: ob die
    HTTPS-Erzwingung greift, ob die Adresse ohne www korrekt weiterleitet,
    und welche HTTP-Kopfzeilen GitHub Pages tatsächlich ausliefert.

18. **IndexNow einrichten.** Ein Schlüssel und ein Anstoß im
    Veröffentlichungsablauf, damit Bing und Microsoft Copilot Änderungen
    sofort erfahren.

19. **Impressum vervollständigen.** Es steht zu Recht auf noindex, weil dort
    Platzhalter statt Rechtstexten stehen. Vor stärkerer Bewerbung gehört
    das nachgeholt.

20. **Bei der nächsten Änderung an Seiten die Prüfung mitlaufen lassen.**
    Der Skill unter `.claude/skills/seo-youman` prüft gegen den gebauten
    Stand und ist in wenigen Minuten durch.

## Was ausdrücklich nicht getan werden sollte

- **Keine Ortsseiten vervielfältigen.** Eine Seite je Stadt mit
  ausgetauschtem Ortsnamen wertet Google seit Jahren ab. Die eine
  Regionalseite mit eigener Aussage trägt weiter als zehn ohne.
- **Keine Zahlen erfinden, um Umfang zu erzeugen.** Die Zurückhaltung bei
  Einsparquoten und Kundenstimmen ist eine Stärke des Auftritts, nicht eine
  Lücke. Umfang entsteht aus Fachinhalt, nicht aus Behauptungen.
- **Keine Sternebewertungen in die strukturierten Daten.** Ohne echte
  Bewertungen ist das eine Falschangabe an genau der Stelle, an der Google
  Verlässlichkeit prüft.
