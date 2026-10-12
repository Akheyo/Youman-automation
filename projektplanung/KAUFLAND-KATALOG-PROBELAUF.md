# Kaufland-Katalog — erster Probelauf

Mandant `p14443` · Kaufland-Konto **(ID 1028) KomplettKonzept** · Länderplattform **DE**
Durchgeführt am 2026-10-12, **schreibend**.

**Angelegt wurde genau ein Katalog**, für die Kaufland-Produktkategorie
`Türgriffe & -beschläge (DE)` (interner Wert `de_29301`). Die übrigen 35 wurden
**nicht** angelegt. Alle Felder außer den drei vorgegebenen blieben unverändert —
mit einer Ausnahme, die der Assistent erzwingt (→ Abschnitt 4, Punkt 4).

---

## 0. Vorabprüfung — und eine Korrektur am bisherigen Befund

Vor dem Anlegen wurde unter **Daten » Kataloge** nachgesehen, ob für diese Kategorie
schon ein Kaufland-Katalog besteht. Ergebnis: **nein** — es gab vorher **13 Kataloge**,
keiner davon für Kaufland (die Liste führte Amazon, Shopify, Meta und mehrere
Standardformat-Exporte).

**Wichtig:** In [`KAUFLAND-KATEGORIEN.md`](KAUFLAND-KATEGORIEN.md) steht, die
Katalog-Übersicht zeige „0 von 0", der Mandant enthalte „überhaupt keinen Katalog".
**Das stimmt nicht.** Das Raster der Katalog-Übersicht braucht auf diesem Mandanten
**rund 30 Sekunden**, bis es geladen ist; vorher steht ein Ladekringel im leeren
Bereich und der Zähler oben rechts steht auf „0 von 0". Wer nach 10 Sekunden
hinsieht, liest einen leeren Mandanten, wo 13 Kataloge liegen. Nach dem Warten steht
dort **„1 – 14 von 14"**.

Wer die Zahl schnell und sicher will, nimmt die REST-Schnittstelle:

```
GET /rest/v2/catalogs/catalogs?itemsPerPage=100
```

(`/rest/catalogs` und `/rest/v2/catalogs` antworten beide mit 404 — der Pfad heißt
tatsächlich `…/catalogs/catalogs`.)

---

## 1. Der Katalog selbst

Nachgesehen unter **Daten » Kataloge** (Screenshot `19-uebersicht-spaet.png`,
`17-einstellungen.png`, `18-filter.png`) und gegengeprüft über REST.

| | |
| --- | --- |
| **Name** | `Türgriffe & -beschläge (DE)` |
| **ID** | `5873abc4-cb64-525f-ae35-540943a8a44f` (UUID, keine Zahl) |
| Erstellt / zuletzt geändert | 12. Oktober 2026, 14:30:30 (+02:00) |
| Marktplatz | Kaufland |
| Export-Typ | Artikel (Neu) |
| Template-Name | `Türgriffe & -beschläge_DE` |
| Format | Kaufland (JSON), Dezimaltrennzeichen Komma |
| Kaufland-Konto | (ID 1028) KomplettKonzept |
| Kaufland-Länderplattform | `de` |
| Channel map | keine |
| Fehler / Warnungen | 0 |

### Aktiv oder inaktiv?

**Inaktiv.** In der Übersicht steht der Aktiv-Schalter der Zeile auf grau/aus; über
REST liefert der Katalog `"active": false`. Zum Vergleich: die beiden
Amazon-Kataloge im selben Mandanten stehen auf aktiv.

### Zeitplan / automatische Ausführung?

**Keiner.**

```
"schedule": ""
"settings.export.scheduleIntervals": []
```

In den **Exporteinstellungen** sind „Limit", „Bereitstellung" und „Übertragung"
sämtlich leer. Es gibt also weder ein Intervall noch ein Ziel, an das etwas ginge.
(Das Feld `scheduleDays` steht zwar auf allen sieben Wochentagen, das ist aber die
Vorgabe des Formulars und ohne Intervall wirkungslos.)

### Wurde ein Export ausgeführt oder eingeplant?

**Nein, beides nicht.** Der Assistent hat nichts angestoßen; der Katalog ist inaktiv
und ohne Zeitplan. Die Werkzeugleiste des Katalogs hat zwar ein „Jetzt ausführen"
(▶) und eine Vorschau — **beides wurde nicht angeklickt**.

Zwei Download-Adressen existieren allerdings bereits (Admin-Link und öffentlicher
Link der Form `https://www.besttra.de/rest/catalogs/export/<ID>/download`), weil
„Optionen für öffentlichen Link" standardmäßig eingeschaltet ist und kein
Sicherheits-Token verlangt wird. Sie liefern erst etwas, wenn ein Export gelaufen
ist — erwähnenswert bleibt es trotzdem.

### Wie viele Artikel fallen in den Katalog?

**Null.**

Benutzerdefinierte Filter: keine. Der **Template-Filter** (fest, vom Kaufland-Template
vorgegeben) lautet:

| Filter | Wert |
| --- | --- |
| Mit mindestens einem Auswahleigenschaftswert verknüpft | **2020** |
| Variante ist aktiv | Aktiv |
| Für mindestens einen Marktplatz sichtbar | Kaufland, Kaufland DE |

`2020` ist die ID des Auswahlwerts, den der Assistent soeben erst angelegt hat
(→ Abschnitt 2). An diesem Wert hängt **keine einzige Variante**:

```
GET /rest/properties/relations?propertyId=27   →   []
```

Zum Vergleich liefert derselbe Aufruf für die bestehende Eigenschaft 26
(„Maschinensucher-Kategorie") eine lange Liste — der Endpunkt funktioniert also, die
leere Antwort ist eine echte Null.

Der Katalog ist damit eine **leere Hülle**: Er beschreibt, wie exportiert würde, und
umfasst derzeit nichts.

---

## 2. Was sonst entstanden ist

### Die Eigenschaft

| | |
| --- | --- |
| **Eigenschafts-ID** | **27** |
| Name (de) | **`Kaufland.de-Kategorie`** |
| Name (en) | `Kaufland.de category` |
| **Typ** (`cast`) | **`selection`** — Auswahl |
| Bezug (`typeIdentifier`) | `item` (Artikel) |
| Eigenschaftsgruppe | **ID 3, `Kaufland.de`** (de und en gleich) |
| Angelegt | 12.10.2026, 14:30:30 (+02:00) |

**Neu angelegt, sie gab es vorher nicht.** Vor dem Lauf hatte der Mandant
**16 Eigenschaften** (höchste ID 26, „Maschinensucher-Kategorie"), danach **17**.
Die **Eigenschaftsgruppe „Kaufland.de" (ID 3) ist ebenfalls neu**, mit demselben
Zeitstempel — das war in der Aufgabenstellung nicht erwähnt.

> Kleine Abweichung zur Vorgabe: Die Eigenschaft heißt „Kaufland.de**-**Kategorie"
> mit Bindestrich, nicht „Kaufland.de Kategorie". Umbenannt wurde nichts.

### Die Auswahlwerte

Genau **einer**:

| Auswahlwert-ID | Wert (de = en) |
| --- | --- |
| **2020** | `Türgriffe & -beschläge_DE` |

(Relation-ID 5267, Wert-IDs 5268/5269, alle vom 12.10.2026 14:30:30.)

Der Auswahlwert heißt **`Türgriffe & -beschläge_DE`** — Unterstrich und `DE` ohne
Klammern, also *anders* als die Kaufland-Kategorie `Türgriffe & -beschläge (DE)` und
anders als der Katalogname. Drei Schreibweisen für dieselbe Sache; wer später
automatisiert zuordnet, sollte das wissen.

---

## 3. Ob Artikel verändert wurden

**Kein Hinweis darauf — mit einer Einschränkung, die ich nicht wegreden will.**

Was dafür spricht, dass nichts an Artikeln geschrieben wurde:

* Die neue Eigenschaft hat **null Zuordnungen** zu Artikeln oder Varianten
  (`/rest/properties/relations?propertyId=27` → `[]`). Es wurde also keiner Variante
  eine Kaufland-Kategorie angehängt.
* Der Browser hat während des gesamten Laufs **keinen einzigen** schreibenden Aufruf
  an einen Artikel- oder Varianten-Endpunkt abgesetzt. Mitgeschnitten wurden genau
  drei Aufrufe an PlentyONE (Abschnitt 4), alle unter `/rest/wizards/…`.

Was sich messen ließ — und was nicht:

Im Fünf-Minuten-Fenster um die Anlage herum wurden **2 Varianten** geändert
(77059 / Artikel 73689 um 14:30:44, 77427 / Artikel 74057 um 14:29:03) und dieselben
2 Artikel. Das ist aber **kein Ausschlag**, sondern der normale Grundrauschen-Pegel
dieses Mandanten:

| Fenster (UTC, je 5 min) | geänderte Varianten |
| --- | --- |
| 12:13–12:18 | 4 |
| 12:18–12:23 | 4 |
| 12:23–12:28 | 2 |
| **12:28–12:33 (Anlage 12:30:30)** | **2** |
| 12:33–12:38 | 1 |

Auf dem Mandanten läuft dauernd etwas: in den 24 Stunden vor dem Lauf wurden 317
Varianten und 3.196 Artikel geschrieben. Eine Zählung kann deshalb **nicht beweisen**,
dass der Assistent serverseitig nichts an Artikeln angefasst hat — sie kann nur
zeigen, dass nichts Auffälliges passiert ist und dass keiner der beiden berührten
Artikel die neue Eigenschaft trägt. **Mehr als das kann ich nicht sagen.**

> Nebenbefund zur Methode: Der Filter `updatedBetween` verhält sich bei
> `/rest/items` und `/rest/items/variations` **unterschiedlich** — Varianten rechnen
> den Zeitstempel als UTC, Artikel als Ortszeit (+02:00). Wer beide vergleicht, muss
> umrechnen, sonst misst er zwei verschiedene Stunden.

---

## 4. Was auf dem Weg dorthin zu klicken war

Assistent: **Einrichtung » Assistenten » Omni-Channel » „Kataloge erstellen" (Kaufland)**
`/plenty/terra/system/assistants/run/kaufland_categories_wizard?topic=omni-channel`

Zwei Schritte: **„Kaufland-Katalog erstellen"** und **„Zusammenfassung"**.

### Schritt 1 — Kaufland-Katalog erstellen

1. **Kaufland-Konto** (Auswahlfeld). Nur eine Option vorhanden:
   `(ID 1028) KomplettKonzept`. Keine Vorbelegung — muss gewählt werden.
2. **Kaufland-Länderplattform** (Auswahlfeld). Optionen: `AT, CZ, DE, FR, IT, PL, SK`.
   Keine Vorbelegung. Mit der Wahl von `DE` lädt der Assistent **einmal** den
   gesamten Kategoriebaum
   (`POST /rest/wizards/kaufland_categories_wizard/formfields/category?optionId=default`,
   Body `{"storefront":"de"}`, 5.230 Einträge) und blendet erst dann das dritte Feld ein.
3. **Kaufland-Produktkategorie** (Eingabefeld mit Vorschlagsliste, kein Auswahlfeld).
   Tippen filtert im Browser, ohne weiteren Server-Aufruf. `Türgriffe` ergibt zwei
   Vorschläge: `KFZ-Türgriffe (DE)` und `Türgriffe & -beschläge (DE)`. Gewählt wurde
   der zweite.
4. **Name des Katalogs** — **Pflichtfeld, und es gibt keine Vorgabe.** Es bleibt leer,
   auch nachdem Konto, Plattform und Kategorie gesetzt sind, und füllt sich auch beim
   Verlassen des Feldes nicht. Das ist die **einzige Stelle, an der dieser Lauf etwas
   entscheiden musste**, was die Aufgabe nicht vorgegeben hat. Eingetragen wurde der
   exakte Kategoriename: **`Türgriffe & -beschläge (DE)`**.

„**WEITER**" (unten links) → `PUT /rest/wizards/kaufland_categories_wizard/data/default?stepKey=step1`
mit `{"data":{"accountId":1028,"storefront":"de","category":"de_29301","catalogueName":"Türgriffe & -beschläge (DE)"}}`.
Dieser Klick **speichert bereits** den Zwischenstand auf dem Server — angelegt wird
dabei aber noch nichts.

### Schritt 2 — Zusammenfassung

Eine zusammenklappbare Zeile „Kaufland-Katalog erstellen"; aufgeklappt zeigt sie:

| Kaufland-Konto | (ID 1028) KomplettKonzept |
| --- | --- |
| Kaufland-Länderplattform | DE |
| **Kaufland-Produktkategorie** | **`de_29301`** |
| Name des Katalogs | Türgriffe & -beschläge (DE) |

Hier lässt sich der interne Wert `de_29301` **im Klartext gegenprüfen**, bevor etwas
entsteht — der einzige Ort im Assistenten, der ihn zeigt. Für die weiteren 35 Läufe
ist das die Stelle zum Hinsehen.

„**ABSCHLIESSEN**" (grün) → `POST /rest/wizards/kaufland_categories_wizard/settings/default`
mit demselben Datensatz. Danach springt die Oberfläche zurück auf
`…/system/assistants/omni-channel`.

### Was danach anders aussieht

* Die Kaufland-Kachel „Kataloge erstellen" trägt jetzt die grüne Markierung
  **„Ausgeführt"** (Screenshot `21-assistenten-danach.png`).
* Der Zwischenstand ist **zurückgesetzt**: `GET /rest/wizards/kaufland_categories_wizard/data/default`
  liefert `{"wizardKey":"kaufland_categories_wizard","data":{}}`. Der nächste Lauf
  beginnt leer — es wird **nichts vorbelegt**, auch nicht Konto und Plattform.
* **Channel Maps**: weiterhin 0. Es ist keine entstanden.

### Keine Rückfrage über das Anlegen hinaus

Es gab **keine** Abfrage zum Aktivieren, Exportieren, Freischalten oder
Bestandsübertragen. Der einzige abschließende Knopf heißt „ABSCHLIESSEN"; danach kam
kein Dialog. Regel 4 kam nicht zum Tragen. Zwei-Faktor oder Captcha traten nicht auf.

---

## 5. Einschätzung: ist es gefahrlos, das 35-mal zu wiederholen?

**Weitgehend ja — aber nicht blind, und nicht in einem Zug.**

### Was dafür spricht

* Der Vorgang legt **einen inaktiven Katalog ohne Zeitplan** an. Nichts wird
  exportiert, nichts an Kaufland übertragen, nichts freigeschaltet.
* An Artikeln und Varianten wurde **nichts geschrieben**, soweit feststellbar
  (Abschnitt 3). Der Katalog umfasst 0 Artikel, weil kein Artikel den neuen
  Auswahlwert trägt.
* Rückgängig zu machen ist es einfach: Kataloge lassen sich löschen, und die
  Übersicht hat einen Punkt „Einen gelöschten Katalog wiederherstellen" — dort liegen
  im Mandanten bereits zwei Einträge von 2024 und 2025. (Wie lange ein gelöschter
  Katalog dort bleibt, wurde nicht geprüft.)

### Was man vorher wissen oder klären sollte

1. **Die offene Frage: eine Eigenschaft oder 36?**
   Dieser Lauf hat Eigenschaft 27 samt Gruppe „Kaufland.de" **neu** angelegt, weil es
   sie noch nicht gab. Ob der **zweite** Lauf dieselbe Eigenschaft wiederverwendet und
   nur einen zweiten Auswahlwert anhängt — oder eine zweite Eigenschaft gleichen
   Namens anlegt —, **ist nicht erwiesen**. Die Struktur (generischer Name, Gruppe
   „Kaufland.de", ein Auswahlwert je Kategorie) spricht klar für Wiederverwendung,
   bewiesen ist sie nicht.
   **Empfehlung: den zweiten Katalog ebenfalls einzeln anlegen und nachsehen**, ob
   Eigenschaft 27 dann zwei Auswahlwerte hat. Erst danach die restlichen 34 am Stück.
   Das kostet einen Lauf und erspart im Zweifel 35 doppelte Eigenschaften.

2. **Der Katalogname braucht eine Regel.**
   Pflichtfeld ohne Vorgabe. Dieser Lauf hat den exakten Kategorienamen genommen
   (`Türgriffe & -beschläge (DE)`). Soll es dabei bleiben, oder soll ein Präfix davor
   (`Kaufland DE – …`)? Das sollte **vor** den 35 Läufen feststehen, sonst steht
   hinterher eine uneinheitliche Liste da. Bei 36 Kataloge in einer Übersicht, die
   ohnehin schon 13 fremde enthält, macht ein Präfix die Liste lesbarer.

3. **Doppelte Kategorien im Blick behalten.**
   Der Assistent hat nicht geprüft, ob für diese Kategorie schon ein Katalog besteht.
   Wer zweimal dieselbe Kategorie wählt, bekommt vermutlich zwei Kataloge. Die Liste
   der 36 Kategorien sollte vorher **auf Dubletten geprüft** sein — in
   [`KAUFLAND-KATEGORIEN.md`](KAUFLAND-KATEGORIEN.md) stehen 14 Kategorien, die über
   mehrere Suchbegriffe erreichbar sind.

4. **Die Übersicht braucht ihre 30 Sekunden.**
   Wer nach jedem Lauf kurz nachsieht und zu früh hinschaut, liest einen leeren
   Mandanten. Besser direkt
   `GET /rest/v2/catalogs/catalogs?itemsPerPage=100` abfragen und die Zahl zählen.

5. **Jeder Lauf ist voller Handbetrieb.**
   Der Zwischenstand wird nach dem Abschließen geleert; Konto und Plattform müssen
   36-mal neu gewählt werden. Rechne mit vier Feldern und zwei Knöpfen je Katalog,
   plus dem Nachladen des gesamten Kategoriebaums bei jeder Wahl der Länderplattform
   (laut [`KAUFLAND-KATEGORIEN.md`](KAUFLAND-KATEGORIEN.md) 5.230 Einträge).

### Und der eigentliche Punkt danach

36 Kataloge sind 36 leere Hüllen. Exportiert wird erst etwas, wenn
**jede Variante dem passenden Auswahlwert der Eigenschaft „Kaufland.de-Kategorie"
zugeordnet** ist, aktiv ist und für Kaufland sichtbar ist — und wenn der Katalog
aktiviert wird. Das Anlegen der Kataloge ist der kleine Teil; die Zuordnung der
Artikel ist der große. Das Anlegen vorzuziehen schadet nicht, löst aber noch nichts.

---

## Belege

Erhoben mit Chromium/Playwright in der Oberfläche, gegengeprüft über die
REST-Schnittstelle. Screenshots liegen im Arbeitsverzeichnis dieses Laufs
(`…/scratchpad/pw/shots/`) und sind sitzungsgebunden:

| Datei | zeigt |
| --- | --- |
| `03-wizard-step1.png` | Schritt 1, leer |
| `07-after-DE.png` | Kategoriefeld erscheint nach Wahl von „DE" |
| `08-cat-typed.png` | zwei Vorschläge zu „Türgriffe" |
| `13-summary-expanded.png` | Zusammenfassung mit `de_29301` |
| `17-einstellungen.png` | Grund-, Format-, Kaufland-, Export-, Download-Einstellungen |
| `18-filter.png` | Template-Filter mit Auswahlwert `2020` |
| `19-uebersicht-spaet.png` | Katalog-Übersicht, „1 – 14 von 14", Aktiv-Schalter aus |
| `21-assistenten-danach.png` | Kaufland-Kachel „Ausgeführt" |
