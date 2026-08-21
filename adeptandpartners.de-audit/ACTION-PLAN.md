# Maßnahmen www.adeptandpartners.de

**Stand:** 21. August 2026 · Bewertung 77 von 100

Sortiert nach Wirkung, nicht nach Aufwand. Jede Maßnahme nennt, woran sich
erkennen lässt, ob sie gewirkt hat, und woran sich zeigen würde, dass die
Annahme dahinter falsch war.

---

## Kritisch

Keine. Nichts blockiert die Indexierung, nichts riskiert eine Abstrafung.

Der einzige Befund dieser Stufe war ein Layout-Sprung von 0,103 über dem
Grenzwert und ist am 20. August behoben.

---

## Hoch — innerhalb einer Woche

### 1. Zwei Pressemitteilungen schreiben

Zwei Kacheln „Platzhalter, Thema folgt" stehen als zweiter Block der
Startseite, direkt unter dem Erklärband. Das ist die sichtbarste Stelle der
gesamten Seite.

Nebenwirkung, die den Aufwand rechtfertigt: Beiträge sind der natürliche
Ort, um aus dem Fließtext heraus auf Referenzprojekte und Funktionsbereiche
zu verweisen. Das löst Maßnahme 3 zu großen Teilen mit.

**Braucht:** zwei Themen von adept&. Der Aufbau des vorhandenen
Logistik-Beitrags lässt sich übernehmen.
**Erkennbar an:** kein „Platzhalter" mehr im ausgelieferten HTML.
**Falsifizierbar:** Wenn die Beiträge keine Verweise auf andere Seiten
enthalten, bleibt Maßnahme 3 offen und dieser Nutzen tritt nicht ein.

### 2. Die vier Übersichtsseiten mit Einleitungen versehen

`/branchen/` hat 56 Wörter, `/news/` 77, `/case-studies/` 78,
`/funktionen/` 106. Reine Kachelseiten ranken nicht eigenständig, obwohl
gerade „Funktionen" und „Branchen" auf gesuchte Begriffe zielen.

Je zwei bis drei Absätze: wonach hier gegliedert wird, für wen, und was den
Unterschied zwischen den Einträgen ausmacht.

**Braucht:** nichts Neues, lässt sich aus dem vorhandenen Material
schreiben. Nur Freigabe.
**Erkennbar an:** alle vier über 300 Wörter im Inhaltsbereich.
**Falsifizierbar:** Bleiben die Seiten nach der Freigabe in der Search
Console ohne Impressionen, ziehen sie diese Suchbegriffe nicht, und der
Aufwand gehört stattdessen in die Funktionsseiten.

### 3. Referenzprojekte und Über uns intern verlinken

`/ueber-uns/` und die ABSolar-Referenz haben je einen einzigen Verweis aus
dem Inhaltsbereich, `/kontakt/` hat vierzehn. Die Referenzprojekte sind das
stärkste Verkaufsargument und zugleich am schlechtesten erreichbar.

Konkret: Jede Branchenseite verweist auf das passende Referenzprojekt, jede
Funktionsseite auf mindestens eines. Aus dem Text heraus, nicht als
zusätzlicher Knopf.

**Erkennbar an:** keine Seite mehr unter drei eingehenden Verweisen aus dem
Inhaltsbereich.

---

## Mittel — innerhalb eines Monats

### 4. Funktionsseiten ausbauen

Fünf Seiten zwischen 169 und 229 Wörtern. Sie sind gut geschrieben, aber zu
kurz gegen längere Wettbewerbsseiten. Die Branche Onlinehandel zeigt mit
ihren acht konkreten Problemstellungen, wie viel Substanz nötig ist.

**Braucht:** je drei bis fünf typische Problemstellungen aus der Praxis.
Dieselbe Machart wie bei Onlinehandel.

### 5. Service-Schema auf den Funktionsseiten

Die fünf Seiten beschreiben Dienstleistungen, tragen aber kein
`Service`-Objekt. Mit `provider` auf die Organisation und `areaServed`
werden die Leistungen maschinell erfassbar.

**Erkennbar an:** Rich-Results-Test zeigt Service ohne Warnung.

### 6. Search Console einrichten

Geht schon jetzt und löst keine Indexierung aus. Property vom Typ „Domain"
für `adeptandpartners.de`, Bestätigung über einen TXT-Eintrag bei
Namecheap. Ab dem ersten Tag sichtbar, was Google tatsächlich sieht.

---

## Niedrig — Rückstand

### 7. Größere Bildvorlagen für vier Kopfbereiche

Feinplanung, Versandsteuerung, Reporting und Referenzprojekte laufen auf
Vorlagen zwischen 289 und 328 px, dargestellt über die volle Fensterbreite.
Nötig wären etwa 1600 px. Kein Rankingfaktor, aber ein Qualitätseindruck.

### 8. Kontaktseite mit Substanz

116 Wörter. Für eine Seite, auf die vierzehn interne Verweise zeigen, ist
das wenig. Was passiert nach der Anfrage, wie lange dauert eine Antwort,
was sollte in der ersten Nachricht stehen.

---

## Danach

### Freigeben

Ein Schalter in `src/data/sichtbarkeit.ts`. Danach greift alles
Vorbereitete: Sitemap, llms.txt, strukturierte Daten, robots.txt mit
Sitemap-Verweis.

Sinnvoll erst, wenn die Platzhalter weg sind. Der erste Eindruck bei Google
zählt, und eine Seite mit sichtbaren Lücken zu einem Zeitpunkt indexieren zu
lassen, an dem sie fast fertig ist, verschenkt Startvorteil.

Unmittelbar danach: Sitemap in der Search Console einreichen. Ohne das
dauert die Aufnahme Wochen statt Tage.

### Unternehmensprofil und erste externe Verweise

Nach der Gewerbeanmeldung. Ein Google-Unternehmensprofil mit derselben
Anschrift wie im Impressum, dazu Einträge in Branchenverzeichnissen.

Externe Verweise sind der Bereich, in dem die Seite bei null steht. Das
begrenzt heute sowohl klassische Suchmaschinen als auch die Sichtbarkeit in
KI-Antworten, und es ist der einzige Bereich, den man nicht durch Arbeit an
der eigenen Seite lösen kann.

---

## Was ausdrücklich nicht getan werden sollte

**Kein `Disallow: /` in die robots.txt.** Der Reflex liegt nahe, solange die
Seite gesperrt sein soll, bewirkt aber das Gegenteil: Ein Disallow verbietet
nur das Abrufen, nicht die Aufnahme in den Index. Google listet die Adresse
trotzdem, wenn ein Verweis darauf zeigt, und bekommt das noindex nie zu
sehen, weil es die Seite nicht laden darf.

**Kein FAQPage-Schema.** Google hat die FAQ-Rich-Results am 7. Mai 2026 für
alle Seiten abgeschafft. Es gibt dafür keine Darstellung mehr in den
Ergebnissen.

**Keine erfundenen Daten.** Kein `datePublished` ohne freigegebenes Datum,
keine Bewertungen ohne echte Bewertungen, keine Zahlen ohne Beleg. Leere
Felder in strukturierten Daten sind besser als falsche.
