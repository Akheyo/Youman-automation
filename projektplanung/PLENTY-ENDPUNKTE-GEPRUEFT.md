# Plenty-Endpunkte — geprüft

Mandant `https://p14443.my.plentysystems.com` · 2026-09-22

Die Inventur (`PLENTY-INVENTUR.md`) hat geklärt, welche Bereiche der API es gibt.
Hier geht es um die engere Frage: **Funktionieren die Endpunkte, die unser eigener
Code aufruft — und filtern sie das, was wir annehmen?**

Geprüft wurde jeder **lesende** Aufruf aus `PLENTY-LANDKARTE.md`, Abschnitt 3,
mit echten IDs aus dem Lager **Burlo (`warehouseId = 106`)**. Schreibende Aufrufe
(POST/PUT/DELETE) wurden **nicht** ausgeführt; sie stehen unten als ungeprüft.

**Testdaten** (aus `/rest/stockmanagement/stock?warehouseId=106` und
`/rest/warehouses/106/locations`):

| | |
| --- | --- |
| `variationId` | `1026` |
| `itemId` | `917` |
| `number` | `H2_R4_D8` |
| Barcode (EAN) | `1000000012095` |
| Wortfragment | `Vorlageneinzug` |
| `storageLocationId` | `18314` |
| `levelId` | `10391` |

Vergleichswerte ohne Filter: Varianten **60 435**, Artikel **58 665**,
Kategorien **1 242**, Bestand **67 248**, Warenbewegungen (Lager 106) **35 779**.

---

## Die Tabelle

| Pfad | HTTP | filtert korrekt? | Bemerkung |
| --- | --- | --- | --- |
| `/rest/items/variations?id=1026&itemsPerPage=1` | 200 | **ja** | `totalsCount: 1` |
| `/rest/items/variations?itemId=917&itemsPerPage=1` | 200 | **ja** | `totalsCount: 1` |
| `/rest/items/variations?numberExact=H2_R4_D8&itemsPerPage=1` | 200 | **ja** | `totalsCount: 1` |
| `/rest/items/variations?barcode=1000000012095&itemsPerPage=1` | 200 | **ja** | `totalsCount: 1` |
| `/rest/items/variations?name=Vorlageneinzug&itemsPerPage=5` | **422** | — | `„The following filter do not exist: name"`. Diesen Filter gibt es nicht. |
| `/rest/items/variations?itemName=Vorlageneinzug&itemsPerPage=5` | 200 | **ja** | `totalsCount: 1`. Teilwort-Suche: `itemName=Toshiba` → 23, `itemName=Vorlagen` → 1, voller Name → 1. |
| `/rest/items/variations?id=1026,1059,1092&itemsPerPage=3` | 200 | **ja** | `totalsCount: 3`, genau die drei angefragten IDs |
| `/rest/items/variations?itemId=917,953,988&itemsPerPage=15` | 200 | **ja** | `totalsCount: 3` |
| `/rest/items/variations?itemsPerPage=1&with=item,variationDescription` | 200 | — | **halb**: `item` kommt mit, `variationDescription` **nicht** |
| `/rest/items/variations?itemsPerPage=1&with=variationDescription` | 200 | — | **wirkungslos** — kein Zusatzfeld, wie bei einem erfundenen `with`-Wert |
| `/rest/items/917/variations/1026/descriptions` | 200 | — | reines Array, 4 Einträge (Sprachen) |
| `/rest/items/917/variations/1026?with=properties` | 200 | — | Einzelobjekt, Feld `properties` vorhanden (hier leer) |
| `/rest/items/917/images` | 200 | — | reines Array, 1 Bild |
| `/rest/items/917/variations/1026/images` | 200 | — | reines Array, leer — Pfad existiert, dieser Artikel führt Bilder am Artikel |
| `/rest/items?name=Vorlageneinzug&itemsPerPage=5` | 200 | **teilweise** | `totalsCount: 0`. Der Filter verlangt den **vollen Namen**: voller Name → 4 Treffer, `name=Toshiba` → 0. Kein Teilwort. |
| `/rest/categories?type=item&parentCategoryId=2632&itemsPerPage=50&page=1` | 200 | **NEIN** | `parentCategoryId` wird **still ignoriert** — 1 242 = alle Kategorien. Auch mit `parentCategoryId=50` und `=999999`: immer 1 242. |
| `/rest/stockmanagement/warehouses?itemsPerPage=250` | 200 | — | reines Array, 9 Lager |
| `/rest/stockmanagement/stock?itemsPerPage=1` | 200 | — | 67 248 |
| `/rest/stockmanagement/stock?itemsPerPage=1&warehouseId=106` | 200 | **ja** | 61 118 von 67 248 |
| `/rest/stockmanagement/warehouses/106/stock/storageLocations?variationId=1026&itemsPerPage=50` | 200 | **ja** | `totalsCount: 1`, zusätzlich `metaData` |
| `/rest/stockmanagement/warehouses/106/stock/movements?itemsPerPage=1` | **200** | **ja** | **35 779 Bewegungen.** `variationId=72594` → 7, `createdAtFrom/createdAtTo` (ein Tag) → 331 |
| `/rest/stockmanagement/stock/movements?warehouseId=106&itemsPerPage=1` | **404** | — | gibt es in diesem Mandanten nicht (deckt sich mit der Inventur) |
| `/rest/warehouses/locations/stock/18314` | 200 | **ja** | `totalsCount: 1` — **Feldnamen in snake_case**, siehe unten |
| `/rest/warehouses/locations/18314` | 200 | — | Einzelobjekt |
| `/rest/warehouses/locations/levels/10391` | 200 | — | Einzelobjekt |
| `/rest/warehouses/106/locations/dimensions` | 200 | — | reines Array, 4 Spalten: Halle/Regal/Ebene/Feld |
| `/rest/warehouses/106/locations/levels?itemsPerPage=250&page=1` | 200 | **NEIN** | reines Array mit **7 636** Knoten — `itemsPerPage` und `page` werden ignoriert, es kommt immer alles |
| `/rest/warehouses/106/locations?itemsPerPage=1` | 200 | — | 13 409 Lagerorte |

### Feldnamen der Antworten

| Pfad | Felder |
| --- | --- |
| `/rest/items/variations` | `id, isMain, mainVariationId, itemId, position, isActive, number, model, externalId, availability, purchasePrice, createdAt, updatedAt, relatedUpdatedAt, mainWarehouseId, unitCombinationId, name, weightG, weightNetG, widthMM, lengthMM, heightMM, unitsContained, vatId, customsTariffNumber, salesRank, …` (77 Felder) |
| `…/descriptions` | `id, itemId, lang, name, name2, name3, previewDescription, metaDescription, description, technicalData, urlPath, metaKeywords, title` |
| `/rest/items/{id}/images` | `id, itemId, type, fileType, path, position, width, height, size, url, urlMiddle, urlPreview, urlSecondPreview, cleanImageName, names, …` |
| `/rest/categories` | `id, parentCategoryId, level, type, linklist, right, sitemap, hasChildren, details` |
| `/rest/stockmanagement/stock` | `itemId, warehouseId, stockPhysical, reservedStock, reservedEbay, reorderDelta, stockNet, storehouse_type, reordered, reservedBundle, averagePurchasePrice, warehousePriority, updatedAt, variationId` |
| `…/stock/storageLocations` | `storageLocationId, itemId, warehouseId, quantity, variationId, updatedAt, storageLocation, batch, bestBeforeDate` (+ `metaData: totalVariations, totalQuantity`) |
| `…/stock/movements` | `id, processRowId, processRowType, itemId, **variationId**, warehouseId, warehouseName, **storageLocationName**, quantity, reason, reasonString, purchasePrice, attributeValues, batch, bestBeforeDate, createdAt, userId` |
| `/rest/warehouses/locations/stock/{id}` | `id, **storage_location**, **item_id**, **variation_id**, **warehouse_id**, quantity, reserved, attribute_value_set, last_update, lastWrittenAt, name, fullLabel, warehouseLocationLevel` |
| `/rest/warehouses/locations/{id}` | `id, levelId, label, purposeKey, statusKey, position, type, pickupPathPosition, notes, createdAt, updatedAt, fullLabel, warehouseLocationLevel` |
| `/rest/warehouses/{id}/locations/levels` und `…/levels/{id}` | `id, parentId, dimensionId, position, pathName, pickupPathPosition, name, createdAt, updatedAt` |
| `/rest/warehouses/{id}/locations/dimensions` | `id, parentId, warehouseId, level, name, displayInName, shortcut, separator, isActiveForPickupPath, createdAt, updatedAt` |

---

## Die vier Fragen

### 1. Warenbewegungen — gibt es einen funktionierenden Endpunkt?

**Ja.** `/rest/stockmanagement/warehouses/106/stock/movements` antwortet mit
**HTTP 200 und 35 779 Bewegungen**. Die 404 aus der Inventur betraf die *andere*
Schreibweise, `/rest/stockmanagement/stock/movements` — die gibt es hier nicht.

`suche.ts:ladeBewegungen` probiert beide Pfade in genau dieser Reihenfolge und
trifft mit dem ersten. Das Signal „Warenbewegungen" ist also **nicht tot** — der
Endpunkt liefert. Die Filter greifen ebenfalls: `variationId=72594` → 7 von
35 779, ein Tagesfenster über `createdAtFrom`/`createdAtTo` → 331 von 35 779.

**Aber** (das ist der eigentliche Befund): Die Antwort enthält **keine
`storageLocationId`**, sondern nur `storageLocationName` — den Klartext-Pfad des
Lagerplatzes, z. B. `"H5/R10/EC F19-0"`. Unser Code liest an beiden Stellen
`b.storageLocationId` (`suche.ts:828` und `suche.ts:977`), bekommt `undefined`,
macht daraus `0` und überspringt den Eintrag (`if (!ortId) continue;`). Ergebnis:
**Beide Bewegungs-Signale laufen über einen funktionierenden Endpunkt mit echten
Daten und liefern trotzdem garantiert null Treffer.** Kein Fehler, keine
Diagnosemeldung — die Meldung „Bestandsbewegungen sind über die API nicht
abrufbar" erscheint gerade *nicht*, weil der Abruf ja klappt.

Ebenfalls abweichend: `reason` (Zahl) statt `reasonId`, dazu `reasonString`.
`bookingTime` gibt es nicht, nur `createdAt` — dort greift der Code über
`b.bookingTime || b.createdAt` richtig.

### 2. Mehrfach-ID-Filter — beachtet `?id=1,2,3` die Liste?

**Ja, korrekt.** `?id=1026,1059,1092&itemsPerPage=3` → `totalsCount: 3`, und
zurück kommen genau diese drei Varianten. Ebenso `?itemId=917,953,988` →
`totalsCount: 3`.

Für diesen Mandanten ist die Laufzeitprüfung (`batchFilterMoeglich` in
`lagerplatz-scan.ts`, die Gruppen-Aufrufe in `suche.ts:327` und
`zuweisung.ts:113`) damit schwarz auf weiß beantwortet: Der Sammelabruf
funktioniert, der Einzel-Fallback wird hier nicht gebraucht.

### 3. `with=` — welche Kombination funktioniert?

| Wert | HTTP | kommt an |
| --- | --- | --- |
| `with=item` | 200 | **`item`** — der Artikeldatensatz, **ohne `texts`** |
| `with=variationDescription` | 200 | **nichts** |
| `with=item,variationDescription` | 200 | nur **`item`** |
| `with=quatschWithXyz` (Gegenprobe) | 200 | nichts |

Plenty **validiert `with` nicht**: Ein unbekannter Wert liefert dasselbe wie ein
bekannter, nämlich HTTP 200 und eine Antwort ohne das Zusatzfeld.

Das trifft `lagerplatz-scan.ts:handleWithAus` mitten ins Herz. Die Funktion
probiert `WITH_KANDIDATEN = ['item,variationDescription', 'variationDescription',
'item', '']` durch und nimmt den ersten, der **keinen HTTP-Fehler** wirft. Der
erste wirft keinen — also wird `item,variationDescription` gemerkt und in die
Diagnose geschrieben („Varianten werden mit `with=item,variationDescription`
gelesen"), obwohl `variationDescription` nie ankommt.

Die Folge zieht sich durch: `nameAus()` sucht der Reihe nach
`v.name` → `v.variationDescription?.[0]?.name` → `v.item?.texts?.[0]?.name1`.
Die beiden hinteren sind immer leer — `variationDescription` fehlt ganz, und
`with=item` liefert den Artikel **ohne** `texts`. Bleibt nur `v.name`, das bei
unserer Testvariante leer (`""`) ist. `rohdatenAus()` setzt `beschreibung`
entsprechend auf `null`.

Abgefedert wird das nur teilweise: `lagerplatz-scan.ts:297` lädt Texte über
`/rest/items/{itemId}/variations/{variationId}/descriptions` nach — aber **nur
für Varianten mit Status `kein-treffer` und nur im Rahmen eines Budgets**. Alle
übrigen laufen ohne Texte durch die Bewertung.

Fazit: Für diesen Mandanten ist **`with=item` der einzige Wert, der etwas
bringt**, und auch der liefert die Artikeltexte nicht mit. Texte gibt es hier nur
über den Einzelaufruf `/descriptions`.

### 4. Namensfilter — filtern `name=` und `itemName=` wirklich?

| Aufruf | `totalsCount` | ohne Filter | Urteil |
| --- | --- | --- | --- |
| `/rest/items/variations?name=Vorlageneinzug` | — (**HTTP 422**) | 60 435 | Filter existiert nicht |
| `/rest/items/variations?itemName=Vorlageneinzug` | **1** | 60 435 | filtert, Teilwort |
| `/rest/items/variations?itemName=Toshiba` | **23** | 60 435 | filtert, Teilwort |
| `/rest/items/variations?itemName=<voller Name>` | **1** | 60 435 | filtert |
| `/rest/items?name=Vorlageneinzug` | **0** | 58 665 | filtert, aber **kein** Teilwort |
| `/rest/items?name=Toshiba` | **0** | 58 665 | kein Teilwort |
| `/rest/items?name=<voller Name>` | **4** | 58 665 | filtert nur bei **exaktem** Namen |

Keiner der beiden gibt still die volle Seite zurück — das war die Sorge, und sie
bestätigt sich nicht. Die Lage ist anders:

* **`/rest/items/variations?name=`** gibt es nicht. HTTP 422 mit der Liste der
  gültigen Filter: `itemId, itemName, id, isMain, isActive, categoryId, barcode,
  numberFuzzy, plentyId, referrerId, numberExact, isBundle, itemTagId,
  variationHasAllTagId, supplierId, supplierNumber, supplierNumberFuzzy,
  createdBetween, updatedBetween, relatedUpdatedBetween, manufacturerId, flagOne,
  flagTwo, sku, storeSpecial, itemDescription, itemDescriptionExtended,
  stockWarehouseId, netStockWarehouseId, variationDetails`.
  In `suche.ts:findeGleichnamige` ist das der **erste** von drei Pfaden — er
  wirft, wird gefangen, der nächste kommt dran. Ein Fehlschlag pro Suche, sonst
  harmlos.
* **`itemName=`** ist der brauchbare Filter: Teilwort, saubere Treffermenge.
* **`/rest/items?name=`** verlangt den vollständigen Namen. Für die Namenssuche
  in `suche.ts` ist das der dritte Pfad, und dort steckt ein zweites Problem:
  Der Endpunkt liefert **Artikel**, deren `id` eine `itemId` ist — der Code liest
  aber `v.id` und behandelt das Ergebnis als **Varianten-IDs** (`suche.ts:565`).
  Wenn dieser Pfad je greift, sind die gemeldeten IDs aus der falschen Nummernreihe.

Ergänzend, weil es zur selben Frage gehört: **`/rest/items` prüft Filternamen
nicht.** `?quatschFilterXyz=1` → HTTP 200 und alle 58 665 Artikel. Ein Tippfehler
in einem Filter fällt dort nie auf. `/rest/items/variations` dagegen prüft (siehe
422 oben), und `…/stock/movements` prüft ebenfalls nicht
(`?quatschFilterXyz=1` → alle 35 779).

---

## Was ins Leere läuft, ohne dass der Code es merkt

Der wichtigste Teil. Alle fünf Punkte antworten mit **HTTP 200** — es gibt also
weder Ausnahme noch Diagnosemeldung.

1. **Warenbewegungen → `storageLocationId` existiert nicht.**
   `suche.ts:828` und `suche.ts:977`. Die Antwort führt `storageLocationName`
   (Klartext wie `"H5/R10/EC F19-0"`). Beide Bewegungs-Signale der Suche liefern
   dadurch immer null Treffer, obwohl 35 779 Bewegungen bereitstehen.
   *Der Endpunkt lebt — die Auswertung nicht.*

2. **`/rest/warehouses/locations/stock/{id}` → snake_case.**
   `suche.ts:ladePlatzbelegung` liest `z.variationId`; die Antwort führt
   `variation_id` (ebenso `item_id`, `warehouse_id`, `storage_location`).
   `zahl(undefined)` → `undefined` → wegge­filtert. Das Signal „was liegt sonst
   noch auf diesem Platz" (Vertauschungen) ist damit **tot**.
   `lagerort-aufraeumen.ts:202` liest dagegen `quantity`, das es gibt — dort
   stimmt alles.

3. **`with=variationDescription` wird stillschweigend verworfen.**
   `lagerplatz-scan.ts:handleWithAus` prüft nur den HTTP-Status und meldet in der
   Diagnose, es werde mit `with=item,variationDescription` gelesen. Ankommen tut
   nur `item` — und das **ohne `texts`**. Die Textbewertung des Scans arbeitet
   für die meisten Varianten auf `beschreibung: null`.

4. **`/rest/categories?parentCategoryId=` wird ignoriert.**
   Jeder Wert liefert alle 1 242 Kategorien, auch `999999`. `client.ts:222`
   fängt das mit einem eigenen Eltern-Guard ab
   (`if (Number(cat.parentCategoryId) !== Number(parentId)) continue;`) — das
   Ergebnis stimmt also. Der Preis: Jede Kategoriesuche blättert alle 25 Seiten
   durch statt einer. Bei 1 242 Kategorien und der Obergrenze `page > 40`
   (= 2 000) geht das noch auf; wächst der Baum über 2 000 Kategorien, findet die
   Suche vorhandene Kategorien nicht mehr und legt sie doppelt an.

5. **`/rest/items?name=` liefert Artikel-IDs, die als Varianten-IDs weiterlaufen.**
   `suche.ts:572`/`suche.ts:578` (dritter Pfad in `findeGleichnamige`). Greift nur, wenn die
   ersten beiden Pfade leer ausgehen, und nur bei exaktem Namen — dann aber mit
   IDs aus der falschen Nummernreihe.

Zusätzlich, weniger folgenreich:

* **`/rest/warehouses/{id}/locations/levels` ignoriert `itemsPerPage` und `page`**
  und liefert immer alle 7 636 Knoten als reines Array. Die Seitenparameter in
  `lagerort-anlegen.ts:273` und `laufweg.ts` sind wirkungslos — die Daten sind
  vollständig, aber jeder Aufruf zieht den ganzen Baum.
* **`/rest/items` und `…/stock/movements` prüfen Filternamen nicht.** Ein
  Tippfehler im Filter liefert dort still die volle Menge.
* **Lesedrosselung:** Bei dichter Abfolge antwortet der Mandant mit
  **HTTP 429 `short period read limit reached`**. Für Läufe über viele Artikel
  (Lagerplatz-Scan) ist das einzuplanen.

---

## Ungeprüft, weil schreibend

Nicht ausgeführt — dieser Mandant ist ein Live-System. Ob diese Pfade in diesem
Mandanten existieren und die erwarteten Antworten geben, ist **offen**.

| Methode | Pfad | Wo |
| --- | --- | --- |
| POST | `/rest/categories` | `client.ts:264` |
| POST | `/rest/items` | `client.ts:316/325` |
| POST | `/rest/items/{itemId}/variations/{variationId}/descriptions` | `client.ts:343` |
| POST | `/rest/items/{itemId}/variations/{variationId}/variation_barcodes` | `client.ts:600` |
| POST | `/rest/properties/relations` | `client.ts:492` |
| POST | `/rest/properties/relations/values` | `client.ts:428` |
| DELETE | `/rest/properties/relations/values/{id}` | `client.ts:455` |
| PUT | `/rest/items/{itemId}/variations/{variationId}/stock/redistribute?itemId=` | `zuweisung.ts:155` |
| POST | `/rest/warehouses/locations/levels` | `lagerort-anlegen.ts:564` |
| POST | `/rest/warehouses/locations` | `lagerort-anlegen.ts:649` |
| PUT | `/rest/warehouses/locations/levels/{id}` | `laufweg.ts:371` |
| DELETE | `/rest/warehouses/locations/{id}` | `lagerort-aufraeumen.ts:226` |
| DELETE | `/rest/warehouses/locations/levels/{id}` | `lagerort-aufraeumen.ts:244` |
| POST | `/plenty/api/ui.php` (multipart, kein REST) | `client.ts:557` |

Einzige Ausnahme von der Nur-Lesen-Regel war `POST /rest/login` — ohne Token
geht kein Aufruf.

---

## Zählung

**28 lesende Aufrufe geprüft.** 26 × HTTP 200, 1 × HTTP 404
(`/rest/stockmanagement/stock/movements`), 1 × HTTP 422
(`/rest/items/variations?name=` — der Filter existiert nicht; derselbe Endpunkt
antwortet mit anderen Filtern mit 200).

Von den 200ern filtern **zwei nachweislich nicht**, obwohl sie so aufgerufen
werden: `/rest/categories?parentCategoryId=` und die Seitenparameter von
`/rest/warehouses/{id}/locations/levels`.

**Kein einziger Endpunkt fehlt**, der für unseren Code wirklich gebraucht wird —
die Ausfälle liegen nicht an fehlenden Pfaden, sondern an **Feldnamen und
stillschweigend verworfenen Parametern**.
