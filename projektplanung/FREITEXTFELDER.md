# Freitextfelder `free1`–`free20`

Was drinsteht, bei welchen Artikeln, und ob man es löschen kann.

Stand **07.10.2026**, Vollabzug aller **53 648 Artikel** und **54 546 Varianten**
aus dem Mandanten `p14443`. Nur lesend erhoben. Die Rohdaten liegen in
`FREITEXTFELDER.csv` daneben.

> **Hinweis zu den Zahlen in `PLENTY-INVENTUR.md`, Teil G.** Die dortigen Werte
> stammen vom 22.09.2026 und sind nicht falsch, aber überholt: seither sind
> **5 036 Artikel** (58 684 → 53 648) und **5 906 Varianten** (60 453 → 54 547)
> aus dem System verschwunden. Die Aufträge sind im selben Zeitraum von 63 038
> auf 63 483 gewachsen, die Kategorien von 1 242 auf 1 246 — es war also eine
> gezielte Artikelbereinigung, kein Systemfehler. Alle Zahlen hier sind die
> aktuellen.

---

## 1 — Wie viele und wie sie heißen

**Es sind genau 20**, fest benannt `free1` bis `free20`. Jeder Artikel in Plenty
hat alle zwanzig; sie sind Teil des Artikelstamms, nicht etwas, das man anlegt.

**Eigene Bezeichnungen sind über die API nicht abrufbar.** Dreizehn
Kandidatenpfade (`/rest/items/free_fields`, `/rest/items/text_fields`,
`/rest/items/settings` und weitere) antworten mit 404. Wenn im Backend unter
`Einstellungen » Artikel` Klartextnamen für die Felder hinterlegt sind, stehen
sie nur dort. Was die Felder bedeuten, lässt sich von außen also **nur aus ihrem
Inhalt erschließen** — genau das ist unten gemacht.

---

## 2 — Was tatsächlich drinsteht

`belegt` heißt: das Feld ist nicht leer. **Der Haken: der häufigste „Inhalt" ist
die Zeichenkette `"0"`.** Die Spalte `echt` zählt nur Werte, die weder leer noch
`"0"` sind.

| Feld | belegt | davon `"0"` | **echt** | Artikel | verkaufsfähig | verschiedene Werte |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| free1 | 117 | 0 | **117** | 117 | 60 | 63 |
| free2 | 0 | 0 | 0 | 0 | 0 | 0 |
| free3 | 5 | 0 | **5** | 5 | 4 | 1 |
| free4 | 2 | 0 | **2** | 2 | 2 | 2 |
| free5 | 1 | 0 | **1** | 1 | 0 | 1 |
| free6 | 0 | 0 | 0 | 0 | 0 | 0 |
| free7 | 1 794 | 1 385 | **409** | 409 | 208 | 14 |
| free8 | 2 134 | 2 134 | **0** | 0 | 0 | 0 |
| free9 | 2 134 | 2 134 | **0** | 0 | 0 | 0 |
| free10 | 1 021 | 1 005 | **16** | 16 | 10 | 13 |
| free11 | 1 387 | 1 342 | **45** | 45 | 30 | 23 |
| free12 | 1 215 | 1 215 | **0** | 0 | 0 | 0 |
| free13 | 1 214 | 1 214 | **0** | 0 | 0 | 0 |
| free14 | 51 525 | 51 523 | **2** | 2 | 0 | 2 |
| free15 | 51 524 | 51 524 | **0** | 0 | 0 | 0 |
| free16 | 1 214 | 1 214 | **0** | 0 | 0 | 0 |
| free17 | 1 214 | 1 214 | **0** | 0 | 0 | 0 |
| free18 | 1 214 | 1 214 | **0** | 0 | 0 | 0 |
| free19 | 1 009 | 1 009 | **0** | 0 | 0 | 0 |
| free20 | 1 009 | 1 009 | **0** | 0 | 0 | 0 |

**Zusammengefasst:** von 20 Feldern tragen **8 überhaupt einen echten Wert**.
Zusammen sind das **597 Werte auf 581 Artikeln** — also **1,1 % des
Artikelstamms**. Zwölf Felder enthalten ausschließlich `"0"` oder gar nichts.

`free14` und `free15` sind der Extremfall: auf **über 51 500 Artikeln** steht
dort eine `"0"`. Das ist keine Pflege, das ist ein Importstandard, der einmal
über fast den ganzen Stamm gelaufen ist.

---

## 3 — Wofür die acht belegten Felder benutzt wurden

### free1 — Lagerort und Notizen als Prosa (117 Werte, 63 verschieden)

Das inhaltsreichste Feld. Drei Sorten Inhalt durcheinander:

- **Lagerort im Klartext:** „Borken" (49×), „Halle 2 Regal 4 Platz B 5-6",
  „Halle 2, Regal 4 Platz B 5 u. 6", „H2R3B1"
- **Alte Einlagerungscodes:** `zwh03082012_23_A024 und A005`,
  `zaz20022013_19_2B13`, `wh05122012_26_A134` — Datum plus Platz, aus 2012/2013
- **Freie Notizen:** „Rest ist bei Amikon", „Abverkauft in Farbe: Lila",
  „Artikel momentan noch nicht lieferbar", Maße und Gewicht als Text,
  Preisnotizen („Entstauber 20.000 netto / Co2 Füllanlage 8610 netto")

**Das ist der kritische Punkt:** hier steht der Lagerort ein zweites Mal im
System, parallel zu den 13 409 gepflegten Lagerorten in Burlo. Zwei Wahrheiten
über denselben Sachverhalt, in unterschiedlicher Schreibweise.

Das Feld ist **historisch**: 65 der 117 Werte hängen an Artikeln aus 2013, 30 aus
2014, nach 2019 praktisch nichts mehr.

> **Eine Zeile enthält personenbezogene Daten** — Nachname und Mobilnummer, bei
> `itemId 21117` und `21118`. In der mitgelieferten `FREITEXTFELDER.csv` ist
> dieser Wert ersetzt; im System steht er unverändert. Wer ihn braucht, sieht
> direkt in Plenty nach.

### free7 — Artikelzustand (409 Werte, 14 Schreibweisen)

| Anzahl | Wert |
| ---: | --- |
| 147 | Gebraucht |
| 132 | Neu |
| 65 | Gebraucht, sehr gut. |
| 19 | neu |
| 15 | Vom Verkäufer generalüberholt |
| 12 | Versandrückläufer des Herstellers, ohne auffällige Gebrauchsspuren … |
| 7 | gebraucht |
| 4 | vom Verkäufer generalüberholt |
| 3 | „Versandrückläufer … *(mit typografischem Anführungszeichen)* |
| je 1 | gebraucht, gut · Sehr gut. · **Gebaucht, sehr gut.** *(Tippfehler)* · Gebraucht, Sehr gut. · Neu ohne Umverpackung |

Das ist der eBay-Zustandstext für Gebrauchtware. Vierzehn Schreibweisen für
vier Zustände, inklusive Tippfehler und zwei Varianten desselben Satzes, die
sich nur im Anführungszeichen unterscheiden.

**Dieses Feld wird noch benutzt.** Neun Werte hängen an Artikeln, die **2026**
angelegt wurden, der jüngste am **20.04.2026**. Es ist kein totes Feld, sondern
ein selten, aber laufend gefülltes.

### free10 — Suchbegriffe (16 Werte)

Keyword-Ketten für Marktplatz-Suche: „Tuning, Ersatzteil, Tankdeckel,
Verschleißteil, Styling" (3×), „rattan garten polyrattan lounge …",
„Fischer, Nageldübel, Kunststoffdübel, Dübel", „Kreissägeblatt, Sägeblatt,
Kreissäge, Scheibenfräser, Fräser".

### free11 — Amazon-Node-IDs (45 Werte, 23 verschieden)

Zehnstellige Amazon-Browse-Node-IDs: `2076259031` (8×), `2076625031` (3×),
`2077232031` (3×). Dazu **6× `2147483647`** — das ist der größte 32-Bit-Integer,
also offensichtlich ein Platzhalter oder Überlauf, keine echte Node-ID.

### free3, free4, free5, free14 — Einzelfälle

| Feld | Inhalt |
| --- | --- |
| free3 | 5× „Outerwear" |
| free4 | 2 Werte, beide alte Einlagerungscodes mit Zeilenumbruch: `MP08112014_06_H1R4E8 / MB06102014_1_H1R4E9` |
| free5 | 1 Wert: `4299088031` (sieht aus wie eine Amazon-Node-ID, steht aber im falschen Feld) |
| free14 | 2 Werte: `1403` und `2404` — bei 51 523 Nullen daneben |

---

## 4 — Bei welchen Artikeln, und ob das noch Sinn hat

| | Werte | Artikel |
| --- | ---: | ---: |
| insgesamt echter Inhalt | 597 | 581 |
| davon an Artikeln mit **mindestens einer aktiven Variante** | 483 | — |
| davon an Artikeln **aktiv UND mit Bestand** („verkaufsfähig") | **314** | — |

Also: **283 der 597 Werte hängen an Artikeln, die gar nicht mehr verkauft
werden** — inaktiv, ohne Bestand oder beides.

Nach Feld, nur verkaufsfähige Artikel:

| Feld | echte Werte | davon verkaufsfähig |
| --- | ---: | ---: |
| free1 | 117 | **60** |
| free3 | 5 | 4 |
| free4 | 2 | 2 |
| free5 | 1 | **0** |
| free7 | 409 | **208** |
| free10 | 16 | 10 |
| free11 | 45 | 30 |
| free14 | 2 | **0** |

Alter der betroffenen Artikel (Anlagejahr): 2013 → 78, 2014 → 33, 2015 → 18,
2016 → 15, 2017 → 42, 2018 → 41, 2019 → 107, 2020 → 125, 2021 → 104,
2022 → 12, 2023 → 13, 2026 → 9.

`free1` ist fast vollständig vor 2016 entstanden. `free7` dagegen hat seinen
Schwerpunkt 2019–2021 und reicht bis 2026.

Nebenbefund aus dem Abzug: drei der 2026 angelegten Artikel mit `free7` haben
**negativen Bestand** (−3, −4) bei aktiver Variante. Das gehört nicht zu dieser
Frage, sollte aber jemand ansehen.

---

## 5 — Können wir die Felder löschen?

**Die Felder selbst: nein.** `free1`–`free20` sind feste Spalten am Artikel.
Die REST-API liefert sie bei **jedem** Artikel mit, auch wenn sie leer sind, und
bietet keinen Endpunkt zum Anlegen oder Entfernen eines Freitextfeldes — alle
dreizehn geprüften Konfigurationspfade antworten mit 404. Was geht, ist
**den Inhalt leeren**. Ob das Backend unter `Einstellungen » Artikel` erlaubt,
ein Feld ganz auszublenden, kann ich von hier aus nicht sehen; das wäre dort
nachzusehen.

**Die Inhalte: differenziert.**

| Gruppe | Felder | Risiko | Empfehlung |
| --- | --- | --- | --- |
| **Komplett leer** | free2, free6 | keins | nichts zu tun |
| **Nur `"0"`** | free8, free9, free12, free13, free15, free16, free17, free18, free19, free20 | gering, **aber nicht null** (siehe unten) | leeren — nach dem Test in Abschnitt 7 |
| **Praktisch nur `"0"`** | free14 (2 echte Werte, beide an nicht verkaufsfähigen Artikeln) | gering | die 2 Werte sichern, dann leeren |
| **Echter Inhalt, tot** | free3, free4, free5 (8 Werte) | gering | sichern, dann leeren |
| **Echter Inhalt, lebendig** | free10 (16), free11 (45) | mittel | erst klären, wer die Keywords/Node-IDs liest |
| **Echter Inhalt, in Benutzung** | **free1** (117), **free7** (409) | **hoch** | **nicht anfassen**, bevor der Inhalt umgezogen ist |

**Warum `"0"` leeren nicht ganz risikolos ist:** wenn irgendein Feed diese Spalte
mitschickt, ändert sich die Ausgabe von `0` auf leer. Bei 51 500 Artikeln in
`free14`/`free15` betrifft das fast jede Zeile jedes Artikel-Feeds. Ein
Empfängersystem, das `0` erwartet, kann daran hängenbleiben. Das ist genau der
Fall, den der Test in Abschnitt 7 abfängt.

**`free1` und `free7` sind kein Löschfall, sondern ein Umzugsfall:**

- `free7` (Zustand) gehört in die dafür vorgesehenen Felder `condition` /
  `conditionApi`, die am Artikel ohnehin existieren und gefüllt sind. Solange
  beides nebeneinander läuft, gibt es drei konkurrierende Quellen für denselben
  Sachverhalt. Und das Feld wird weiter gefüllt — zuletzt im April 2026.
- `free1` (Lagerort) gehört in die Lagerortverwaltung. 60 der 117 Werte hängen
  an Artikeln, die aktiv sind und Bestand haben; dort steht der Lagerplatz
  möglicherweise **nur** in diesem Feld.

---

## 6 — Was kaputtgehen könnte: geprüft und ungeprüft

### Geprüft, ohne Fund

| Was | Ergebnis |
| --- | --- |
| **Projektcode dieses Repos** | Volltextsuche nach `free1`–`free20` und nach `freeField`/`freetext`: **keine einzige Verwendung.** Die Treffer auf „Freitext" in `lib/lagerplatz/` und `lib/plenty/suche` meinen den Variantennamen, nicht diese Felder. |
| **Alle 45 Elastic Exporte, Filter** | Jeder Export einzeln gelesen (`GET /rest/exports/{id}`). Die vorkommenden Filterschlüssel sind: `client, createdAt, credentialsId, deliveryCountry, flag1, isActive, itemFilterUpdatedAt, itemId, itemType, itemWithCategory, lang, listAllVariations, manufacturer, markets, orderItemProducer, orderItemVariationId, orderStatus, status, stock, stockWarehouseId, type, updatedAt, warehouseId, webstore`. **Kein `free`-Filter.** |
| **Alle 45 Exporte, Formateinstellungen** | **Kein Schlüssel mit `free`.** |

### Nicht prüfbar — hier liegt das Restrisiko

| Was | Warum nicht prüfbar | Wie du es prüfst |
| --- | --- | --- |
| **Spalten der FormatDesigner-Exporte** | Der `formatKey` verweist auf ein FormatDesigner-Format (z. B. `FormatDesigner Maschinensucher`). **Welche Spalten dieses Format ausgibt, steht nicht in `/rest/exports`** — es liegt im Plugin. Alle dreizehn geprüften FormatDesigner-Pfade sind 404. **Ein Export kann `free1` also als Spalte ausgeben, ohne dass das irgendwo auftaucht, was ich lesen kann.** | Im Backend jedes Format öffnen und die Spaltenliste durchsehen — oder einfacher: den Test aus Abschnitt 7. |
| **Ereignisaktionen** | Über die REST-API nicht vorhanden (`/rest/events`, `/rest/event_procedures`, `/rest/procedures` → alle 404). Eine Ereignisaktion könnte ein Freitextfeld setzen oder darauf filtern. | `Einrichtung » Aufträge » Ereignisse` durchsehen. |
| **Plugin-Code** | `CategoryTemplates`, `KkExtraComponents` (aus Git), `IO`/`Ceres`-Templates. Deren Quelltext ist über die API nicht lesbar. | Im Git-Repo von `KkExtraComponents` nach `free` suchen. |
| **Marktplatz- und Listing-Konfigurationen** | Feldzuordnungen für eBay/Amazon/Kaufland liegen in den Plugin-Einstellungen. | Backend. |
| **Empfänger der CSV-Dateien** | Was ein externes System mit einer Spalte macht, steht nicht in Plenty. | Beim Empfänger nachfragen. |

**Das ist die ehrliche Antwort auf deine Frage.** Im Projektcode und in den
Export-Filtern ist nichts. Die Stelle, an der ein Freitextfeld am ehesten
unbemerkt hängt, ist die **Spaltendefinition der FormatDesigner-Formate** — und
genau die kann ich von außen nicht lesen.

---

## 7 — Vorgehen, das nichts kaputt macht

1. **Vorher sichern.** `FREITEXTFELDER.csv` ist genau das: alle 597 Werte mit
   Artikel-ID. Wenn später etwas fehlt, steht hier, was wo stand.
2. **Spalten der Formate durchsehen.** Im Backend unter FormatDesigner die
   Formate öffnen, die an den aktiven Exporten hängen, und nach `free` suchen.
   Das kostet eine halbe Stunde und schließt die größte Lücke.
3. **An einem Artikel testen.** Einen Artikel wählen, der `free15 = "0"` trägt
   und in einem laufenden Export vorkommt. Feld leeren, Export abrufen, die
   beiden Dateien vergleichen. Ändert sich die Zeile nicht, ist die Spalte nicht
   im Format. Ändert sie sich, weißt du genau, welcher Feed betroffen ist —
   bevor 51 500 Artikel betroffen sind.
4. **Dann in dieser Reihenfolge leeren:** free19, free20 (1 009), free12, free13,
   free16, free17, free18 (1 214), free8, free9 (2 134), free15 (51 524),
   free14 (51 525, die 2 echten Werte vorher sichern). Nach jedem Schritt einen
   Export gegenprüfen.
5. **free3, free4, free5** (8 Werte) danach — Inhalte stehen in der CSV.
6. **free10 und free11** erst, wenn geklärt ist, ob die Keywords und Node-IDs in
   einen Marktplatz-Feed gehen.
7. **free1 und free7 zuletzt und nicht als Löschung.** `free7` wird weiter
   gefüllt; wer das tut, muss vorher wissen, wohin stattdessen. Für `free1`
   gehören die 60 verkaufsfähigen Artikel einzeln angesehen, ob der Lagerplatz
   anderswo steht.

Wenn der Test aus Punkt 3 steht, sag Bescheid — ich kann vorher und nachher
lesend gegenprüfen, welche Artikel und welche Exportzeilen sich geändert haben.

---

*Erhoben am 07.10.2026 aus dem PlentyONE-Mandanten p14443, ausschließlich mit
GET-Aufrufen; der einzige schreibende Aufruf war `POST /rest/login`. Vollabzug
über 537 Seiten Artikel (53 648) und 546 Seiten Varianten (54 546). Es wurde
nichts im Live-System verändert. Ein Wert mit personenbezogenen Daten ist in der
CSV ersetzt und in diesem Dokument nicht wiedergegeben.*
