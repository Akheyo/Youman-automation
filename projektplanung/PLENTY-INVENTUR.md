# Plenty-Inventur

Mandant: `https://p14443.my.plentysystems.com` · Benutzer: `kheyo` · 2026-09-22


## Teil A — Welche Bereiche der API sind da?

Alle Zeilen stammen aus `scripts/plenty-inventur.mjs` (nur GET). Nachtraege zu
einzelnen 404ern stehen unter „Teil A – Nachtrag".

### Bestaetigung: das nutzen wir bereits

| Was | Status | Umfang | Pfad |
| --- | --- | --- | --- |
| Lager | 200 da | mind. 9 | `/rest/stockmanagement/warehouses?itemsPerPage=50` |
| Bestand | 200 da | 67242 | `/rest/stockmanagement/stock?itemsPerPage=1` |
| Varianten | 200 da | 60430 | `/rest/items/variations?itemsPerPage=1` |
| Artikel | 200 da | 58660 | `/rest/items?itemsPerPage=1` |
| Kategorien | 200 da | 1242 | `/rest/categories?type=item&itemsPerPage=1` |
| Eigenschaften | 200 da | 24 | `/rest/properties?itemsPerPage=5` |
| Barcodes | 200 da | 18 | `/rest/items/barcodes?itemsPerPage=10` |

### Auftragswesen (heute ungenutzt)

| Was | Status | Umfang | Pfad |
| --- | --- | --- | --- |
| Auftraege | 200 da | 63038 | `/rest/orders?itemsPerPage=1` |
| Auftragsstatus | 404 gibt es nicht | — | `/rest/orders/status?itemsPerPage=50` |
| Auftragsherkunft | 200 da | mind. 340 | `/rest/orders/referrers` |
| Auftragstypen | 404 gibt es nicht | — | `/rest/orders/types` |
| Belege | 200 da | 141220 | `/rest/orders/documents?itemsPerPage=1` |
| Zahlungen | 200 da | mind. 1 | `/rest/payments?itemsPerPage=1` |
| Zahlungsarten | 200 da | mind. 282 | `/rest/payments/methods` |
| Versandprofile | 200 da | mind. 32 | `/rest/orders/shipping/presets` |
| Versanddienstleister | 404 gibt es nicht | — | `/rest/orders/shipping/serviceProviders` |
| Kontakte | 200 da | 60380 | `/rest/accounts/contacts?itemsPerPage=1` |

### Artikelstamm (heute ungenutzt)

| Was | Status | Umfang | Pfad |
| --- | --- | --- | --- |
| Verkaufspreise | 200 da | 29 | `/rest/items/sales_prices?itemsPerPage=10` |
| Hersteller | 200 da | 4170 | `/rest/items/manufacturers?itemsPerPage=10` |
| Einheiten | 200 da | 52 | `/rest/items/units?itemsPerPage=20` |
| Attribute | 200 da | 125 | `/rest/items/attributes?itemsPerPage=10` |
| Artikel-Sets (Bundles) | 404 gibt es nicht | — | `/rest/items/item_sets?itemsPerPage=5` |
| Verfuegbarkeiten | 200 da | mind. 10 | `/rest/availabilities` |
| Merkmalsgruppen | 200 da | 2 | `/rest/properties/groups?itemsPerPage=10` |

### Lager jenseits der Lagerorte

| Was | Status | Umfang | Pfad |
| --- | --- | --- | --- |
| Umlagerungen | 404 gibt es nicht | — | `/rest/redistributions?itemsPerPage=1` |
| Nachbestellungen | 404 gibt es nicht | — | `/rest/reorders?itemsPerPage=1` |
| Bestandspuffer | 404 gibt es nicht | — | `/rest/stockmanagement/buffer?itemsPerPage=5` |
| Warenbewegungen | 404 gibt es nicht | — | `/rest/stockmanagement/stock/movements?itemsPerPage=1` |

### Vertriebskanaele

| Was | Status | Umfang | Pfad |
| --- | --- | --- | --- |
| Mandanten/Webshops | 200 da | mind. 6 | `/rest/webstores` |
| Marktplaetze | 404 gibt es nicht | — | `/rest/markets/orders/referrers` |
| Listings | 200 da | 55104 | `/rest/listings?itemsPerPage=1` |

### System und Verwaltung

| Was | Status | Umfang | Pfad |
| --- | --- | --- | --- |
| Plugins | 500 Fehler | — | `/rest/plugins?itemsPerPage=5` |
| Benutzer | 200 da | 68 | `/rest/users?itemsPerPage=5` |
| Rollen | 404 gibt es nicht | — | `/rest/roles?itemsPerPage=5` |
| Umsatzsteuer | 200 da | 116 | `/rest/vat` |
| Logs | 200 da | 32555 | `/rest/logs?itemsPerPage=1` |

---

25 erreichbar, 0 ohne Recht, 10 nicht vorhanden (von 36).


### Teil A – Nachtrag: nachgefasste 404er

Fuer jeden 404 aus der Tabelle oben wurden naheliegende Schreibweisen probiert.
Ein Treffer, sonst bleibt es beim „gibt es nicht".

| Gesuchter Bereich | Probierter Pfad | HTTP | Ergebnis |
| --- | --- | --- | --- |
| Auftragsstatus | `/rest/orders/status` | 404 | gibt es nicht |
| Auftragsstatus | `/rest/orders/statuses` | **200** | **richtiger Pfad, 58 Eintraege** |
| Auftragsstatus | `/rest/orders/status/names` | 404 | gibt es nicht |
| Auftragstypen | `/rest/orders/types`, `/rest/orders/type`, `/rest/orders/order_types` | 404 | gibt es nicht |
| Versanddienstleister | `/rest/orders/shipping/serviceProviders`, `…/service_provider`, `…/packages` | 404 | gibt es nicht |
| Belegarten | `/rest/orders/documents/types` | 404 | gibt es nicht |
| Artikel-Sets | `/rest/items/item_sets` | 404 | gibt es nicht |
| Artikel-Sets | `/rest/item_sets` | **200** | **richtiger Pfad, 0 Eintraege** |
| Umlagerungen | `/rest/redistributions` | 404 | gibt es nicht |
| Nachbestellungen | `/rest/reorders` | 404 | gibt es nicht |
| Bestandspuffer | `/rest/stockmanagement/buffer` | 404 | gibt es nicht |
| Warenbewegungen | `/rest/stockmanagement/stock/movements` | 404 | gibt es nicht |
| Marktplaetze | `/rest/markets/orders/referrers` | 404 | gibt es nicht (Herkuenfte stehen in `/rest/orders/referrers`) |
| Rollen | `/rest/roles` | 404 | gibt es nicht |

`/rest/plugins?itemsPerPage=5` antwortet mit **HTTP 500**, nicht mit 403 oder 404.
Die Fehlermeldung nennt den Grund: `Too few arguments to function
PluginController::listAllPlugins()` — der Endpunkt erwartet ein Argument (Plugin-Set),
das wir nicht kennen. Damit ist die Plugin-Liste ueber die API nicht abrufbar.

---

## Teil B — Die konkreten IDs

### B1 — Lager

Fundstelle: `GET /rest/stockmanagement/warehouses?itemsPerPage=50` → HTTP 200,
Antwort ist ein **Array** (kein `entries`/`totalsCount`), 9 Eintraege.

| id | name | typeId | logisticsType | storageLocationType | Bestandszeilen |
| --- | --- | --- | --- | --- | --- |
| **106** | **Burlo** | 0 | own | none | **61 114** |
| 107 | FBA | 1 | amazon | none | 0 |
| 108 | Drop Shipping | 0 | own | none | 478 |
| 109 | Hildesheim | 0 | own | none | 445 |
| 110 | Borken I | 0 | own | none | 4 340 |
| 111 | Borken II | 0 | own | none | 583 |
| 112 | Oeding | 0 | own | none | 225 |
| 113 | Transfer | 5 | own | medium | 54 |
| 115 | Rostock | 7 | own | none | 1 |

**Burlo ist `id = 106`.** Es ist auch faktisch das Hauptlager: 61 114 der 67 240
Bestandszeilen (91 %) liegen dort, und es ist das einzige Lager mit einer
ausgebauten Lagerort-Struktur (siehe B6). Bestandszeilen je Lager aus
`GET /rest/stockmanagement/stock?itemsPerPage=1&warehouseId=<id>` (`totalsCount`).

### B2 — Kategorie „Projekte"

Fundstelle: `GET /rest/categories?type=item&itemsPerPage=250&with=details`,
5 Seiten, HTTP 200, `totalsCount` = 1242, 1242 Eintraege eingesammelt.

- **`id = 2632`**, Name (de) „Projekte", `parentCategoryId = null`, `level = 1`,
  `type = item`, `hasChildren = true`, `linklist = N`, `right = all`, `sitemap = N`.
- Es gibt **genau eine** Kategorie mit diesem Namen — keine Verwechslungsgefahr.
- **8 direkte Unterkategorien** (alle `level = 2`):

| id | Name | Varianten darin |
| --- | --- | --- |
| 2636 | RBM Handelsonderneming Almelo NL | 4 |
| 2671 | cohline GmbH Montabaur | 1 |
| 2673 | Technische Antriebselemente GmbH Hamburg | 90 |
| 2676 | Kuka Bremen | 0 |
| 2678 | Troostwijk | 0 |
| 2684 | Cafe Liege Aachen | 0 |
| 2700 | Reifenservice Billing Stadtbergen | 0 |
| 2702 | Greinwald GmbH Memmingen | 0 |

Varianten je Kategorie aus `GET /rest/items/variations?itemsPerPage=1&categoryId=<id>`
(`totalsCount`). In der Kategorie 2632 selbst haengen **0** Varianten — die Artikel
sitzen ausschliesslich in den Unterkategorien, zusammen **95**.

### B3 — Barcode-Konfigurationen

Fundstelle: `GET /rest/items/barcodes?itemsPerPage=50` → HTTP 200,
`totalsCount` = 18 (Achtung: die Seitengroesse wird auf 100 gedeckelt, hier ohne Folgen).

| id | name | type |
| --- | --- | --- |
| 1 | EAN_13 1 | GTIN_13 |
| **2** | **EAN_13 2** | **GTIN_13** |
| 3 | EAN_13 3 | GTIN_13 |
| 4 | EAN_13 4 | GTIN_13 |
| 5–8 | CODE_128 1–4 | CODE_128 |
| 9–12 | EAN_128 1–4 | GTIN_128 |
| 13–16 | UPC 1–4 | UPC |
| 17 | ISBN | ISBN |
| 23 | Fotostudio | GTIN_13 |

**Die im Projekt als `EAN13_2` bezeichnete Konfiguration ist `id = 2`**
(„EAN_13 2", Typ `GTIN_13`). Die ids 18–22 existieren nicht; die Zaehlung springt
von 17 auf 23.

Nebenbefund: Die Konfigurationen 1–17 sind nur fuer `referrerId = -1` (alle)
freigegeben, die Konfiguration 23 („Fotostudio") dagegen fuer rund 300 einzeln
aufgezaehlte Referrer.

### B4 — Eigenschaften (Properties)

Fundstelle: `GET /rest/properties?itemsPerPage=100` → HTTP 200, `totalsCount` = 24,
alle 24 eingesammelt. Namen/Gruppen/Optionen liefert der Endpunkt von sich aus mit;
`?with=names,groups` quittiert er mit **HTTP 500**.

| id | cast | Gruppe | Name (de) |
| --- | --- | --- | --- |
| 1–6 | shortText | 1 | DPD Versand Services — IdentificationUnNo / IdentificationClass / ClassificationCode / PackingGroup / Factor / NotOtherwiseSpecified |
| 7 | file | 1 | Betriebsanleitung |
| 8 | file | 1 | Technische Daten |
| **9** | **file** | **1** | **Dokument 1** |
| 10 | file | 1 | Dokument 2 |
| 11 | file | 1 | Dokument 3 |
| 12 | file | 1 | Dokument 4 |
| 14 | string | 2 | GLS ShipIT — hazardous goods code |
| 15 | float | 2 | GLS ShipIT — limited quantities value (kg/l) |
| 16 | float | 2 | GLS ShipIT — hazardous goods value (kg/l) |
| 17 | shortText | 1 | MS Hersteller |
| 18 | shortText | 1 | MS Listing-URL |
| 19 | shortText | 1 | MS Produkttyp |
| 20 | longText | 1 | MS Letzter Fehler |
| 21 | shortText | 1 | MS Listing-ID |
| 22 | selection | 1 | MS Kategorie |
| 23 | shortText | 1 | MS Letzter Sync |
| 24 | shortText | 1 | MS Modell |
| 25 | shortText | 1 | MS Sync Status |

**„Dokument 1" ist `id = 9`, `cast = file`, `typeIdentifier = item`.** Sie liegt in
**Gruppe 1**, die laut `GET /rest/properties/groups?itemsPerPage=50` heisst:
„keine Gruppe (automatisch generiert)". Es gibt nur zwei Gruppen — 1 und 2
(„GLS ShipIT hazardous"). Die `id = 13` fehlt (geloescht).

Fuer Rechnungen an Artikel stehen vier Datei-Eigenschaften bereit: 9, 10, 11, 12
(„Dokument 1"–„Dokument 4"), dazu 7 und 8 mit fester Bedeutung.

### B5 — Einheit „Stück"

Fundstelle: `GET /rest/items/units?itemsPerPage=250` → HTTP 200, `totalsCount` = 52.

- **`unitId = 1`**, `unitOfMeasurement = "C62"`, Name de „Stück", en „piece".
- **Die im Projekt fest verdrahtete `unitId: 1` ist korrekt** — keine Korrektur noetig.

Zum Vergleich: 2 = KGM/Kilogramm, 3 = GRM/Gramm, 4 = MGM/Milligramm,
5 = LTR/Liter, 6 = DPC/„12 Stück".

### B6 — Lagerort-Struktur des Hauptlagers (Burlo, 106)

Die Lagerort-Endpunkte antworten fuer **alle neun** Lager mit HTTP 200, aber nur
drei haben ueberhaupt Inhalt:

| Lager | dimensions | levels | locations |
| --- | --- | --- | --- |
| **106 Burlo** | **4** | **7 636** | **13 409** |
| 110 Borken I | 2 | 2 | 1 |
| 111 Borken II | 2 | 2 | 1 |
| 107, 108, 109, 112, 113, 115 | 0 | 0 | 0 |

**Dimensionen** — `GET /rest/warehouses/106/locations/dimensions` → HTTP 200, 4 Eintraege:

| id | level | name | Kuerzel (`shortcut`) | Trennzeichen (`separator`) | Knoten |
| --- | --- | --- | --- | --- | --- |
| 9 | 1 | Halle | `H` | `/` | 11 |
| 10 | 2 | Regal | `R` | `/` | 88 |
| 11 | 3 | Ebene | `E` | ` ` (Leerzeichen) | 571 |
| 7 | 4 | Feld | `F` | `-` | 6 966 |

Alle vier haben `displayInName = true` und `isActiveForPickupPath = true`.
Die `id` der Dimensionen folgt **nicht** der Reihenfolge: die unterste Stufe
(Feld) hat die kleinste id (7). Wer sortieren will, muss `level` nehmen, nicht `id`.

**Knoten** — `GET /rest/warehouses/106/locations/levels?itemsPerPage=250` →
HTTP 200, **`totalsCount` = 7 636**, alle 7 636 eingesammelt.
Felder: `id, parentId, dimensionId, position, pathName, pickupPathPosition, name, createdAt, updatedAt`.

**Lagerorte** — `GET /rest/warehouses/106/locations?itemsPerPage=250` →
HTTP 200, **`totalsCount` = 13 409**, alle 13 409 eingesammelt (135 Seiten).
Felder: `id, levelId, label, purposeKey, statusKey, position, type, pickupPathPosition, notes, createdAt, updatedAt, fullLabel, warehouseLocationLevel`.

Verteilung ueber alle 13 409:

| Feld | Wert | Anzahl |
| --- | --- | --- |
| `statusKey` | `active` | **13 409 (alle)** |
| `purposeKey` | `picking` | 13 285 |
| `purposeKey` | `box` | 124 |
| `type` | `""` (leer) | 12 201 |
| `type` | `small` | 1 208 |

Es gibt **keinen** Lagerort mit `statusKey` ausser `active` und keinen anderen
`purposeKey` als `picking`/`box`.

**Drei Beispiel-Lagerorte:**

| id | label | fullLabel | levelId | purposeKey | statusKey |
| --- | --- | --- | --- | --- | --- |
| 18314 | `SL0` | `H3/R9/EA F8-SL0` | 10391 | box | active |
| 18335 | `0` | `H3/R9/EA F8-0` | 10391 | picking | active |
| 18313 | `SL0` | `H3/R9/EA F7-SL0` | 10390 | box | active |

Die Namensform ist damit bestaetigt: `H<Halle>/R<Regal>/E<Ebene> F<Feld>-<Lagerort>`,
also z. B. `H1/R6/EA F05-K12` wie erwartet. Zusammengesetzt wird sie aus
Kuerzel + Knotenname je Dimension, verbunden mit dem `separator` der jeweils
**darueberliegenden** Stufe.

Lagerorte je Halle:

| Halle | Lagerorte |
| --- | --- |
| H1 | 4 566 |
| H4 | 2 704 |
| H2 | 1 963 |
| H5 | 1 517 |
| H6 | 1 371 |
| H3 | 1 176 |
| HWagen | 100 |
| H7 | 5 |
| H8 | 5 |
| H9 | 1 |
| HOF | 1 |

---

## Teil C — Mengengeruest

Alle Zahlen sind `totalsCount` aus der jeweiligen Antwort, nicht die Seitenlaenge.

| Was | Wie viele | Pfad | HTTP |
| --- | --- | --- | --- |
| Artikel (items) | **58 660** | `/rest/items?itemsPerPage=1` | 200 |
| Varianten | **60 430** | `/rest/items/variations?itemsPerPage=1` | 200 |
| Bestandszeilen | **67 240** | `/rest/stockmanagement/stock?itemsPerPage=1` | 200 |
| Lagerorte (Burlo 106) | **13 409** | `/rest/warehouses/106/locations?itemsPerPage=250` | 200 |
| Struktur-Knoten (levels, Burlo 106) | **7 636** | `/rest/warehouses/106/locations/levels?itemsPerPage=250` | 200 |
| Kategorien gesamt | **1 242** | `/rest/categories?type=item&itemsPerPage=250` | 200 |
| Auftraege gesamt | **63 038** | `/rest/orders?itemsPerPage=1` | 200 |
| Auftraege letzte 30 Tage | **877** | `/rest/orders?itemsPerPage=1&createdAtFrom=2026-08-23T00:00:00Z&createdAtTo=2026-09-22T23:59:59Z` | 200 |

Beim Bestand steht in Teil A 67 242 und hier 67 240 — die Werte stammen aus zwei
Aufrufen wenige Minuten auseinander. Das System ist live, die Zahl bewegt sich.

Weitere Zaehlungen aus demselben Lauf:

| Was | Wie viele | Pfad |
| --- | --- | --- |
| Belege (documents) | 141 220 | `/rest/orders/documents?itemsPerPage=1` |
| Kontakte | 60 380 | `/rest/accounts/contacts?itemsPerPage=1` |
| Listings | 55 104 | `/rest/listings?itemsPerPage=1` |
| Hersteller | 4 170 | `/rest/items/manufacturers?itemsPerPage=1` |
| Log-Eintraege | 32 644 | `/rest/logs?itemsPerPage=1` |
| Attribute | 125 | `/rest/items/attributes?itemsPerPage=1` |
| USt-Saetze | 116 | `/rest/vat` |
| Benutzer | 68 | `/rest/users?itemsPerPage=5` |
| Auftragsstatus | 58 | `/rest/orders/statuses?itemsPerPage=100` |
| Einheiten | 52 | `/rest/items/units?itemsPerPage=250` |
| Verkaufspreise | 29 | `/rest/items/sales_prices?itemsPerPage=1` |
| Eigenschaften | 24 | `/rest/properties?itemsPerPage=100` |
| Barcode-Konfigurationen | 18 | `/rest/items/barcodes?itemsPerPage=50` |
| Verfuegbarkeiten | 10 | `/rest/availabilities` |
| Lager | 9 | `/rest/stockmanagement/warehouses?itemsPerPage=50` |
| Webshops | 6 | `/rest/webstores` |
| Eigenschaftsgruppen | 2 | `/rest/properties/groups?itemsPerPage=50` |
| Artikel-Sets | 0 | `/rest/item_sets?itemsPerPage=1` |

Nicht zaehlbar: **Zahlungen**. `/rest/payments` liefert ein Array ohne
`totalsCount`; die „mind. 1" in Teil A ist nur die Seitenlaenge bei
`itemsPerPage=1`, keine Gesamtzahl.

---

## Teil D — Auftragswesen genauer

### D1 — Auftragsstatus

`GET /rest/orders/statuses?itemsPerPage=100` → HTTP 200, `totalsCount` = 58.
(`/rest/orders/status` ohne „es" ist 404.)
Felder je Status: `updatedAt, isFrontendVisible, createdAt, names, statusId, isErasable, color`.
`statusId` ist eine **Dezimalzahl als String** (`"5.7"`), kein Integer.

| statusId | Bezeichnung (de) | statusId | Bezeichnung (de) |
| --- | --- | --- | --- |
| 1 | [1] Unvollständige Daten | 7 | [7] Warenausgang gebucht |
| 1.1 | [1.1] Warten auf Zahlung & Freischaltung | 7.1 | [7.1] Auftrag exportiert |
| 1.2 | [1.2] Freigeschaltet, warten auf Zahlung | 7.2 | [7.2] Gelangensbestätigung versendet |
| 2 | [2] Warten auf Freischaltung | 7.3 | [7.3] Gelangensbestätigung unterschrieben zurück |
| 3 | [3] Warten auf Zahlung | 8 | [8] Storniert |
| 3.1 | [3.1] Start PayPal-Zahlungsprozess | 8.1 | [8.1] Storniert durch Kunden |
| 3.2 | [3.2] In Warteposition | 8.2 | Ware nicht abgeholt -> Warenbestand zurückgesetzt |
| 3.3 | [3.3] Versandfertig; warten auf Zahlung | 8.3 | [8.3] Angebot angenommen |
| 3.4 | [3.4] Mahnung versendet | 9 | [9] Retoure |
| 3.5 | [3.5] Angebot 1x Nachgefasst | 9.1 | [9.1] Ware wird geprüft |
| 3.6 | [3.6] Angebot 2x Nachgefasst | 9.2 | [9.2] Warten auf Retoure von Großhändler |
| 4 | [4] In Versandvorbereitung | 9.3 | [9.3] Gewährleistung eingeleitet |
| 5 | [5] Freigabe Versand | 9.4 | [9.4] Umtausch eingeleitet |
| 5.1 | [5.1] Abwicklung extern | 9.5 | [9.5] Gutschrift angelegt |
| 5.2 | [5.2] Abwicklung intern | 10 | [10] Gewährleistung |
| 5.3 | [5.3] Abwicklung Spedition | 11 | [11] Gutschrift |
| 5.4 | [5.4] Selbstabholung | 11.1 | [11.1] Gutschrift ausgezahlt |
| 5.5 | [5.5] Kommissionieren – Paket | 12 | [12] Reparatur |
| 5.6 | [5.6] Kommissionieren – Spedition | 13 | [13] Sammelauftrag |
| 5.7 | [5.7] Wird kommissioniert | 14 | [14] Sammelgutschrift |
| 5.8 | [5.8] Kommissionierung Fehler | 19 | Offen |
| 6 | [6] Gerade im Versand | 19.1 | Bestellt |
| 6.1 | [6.1] Paketdienst DPD | 19.2 | Bestätigt |
| 6.2 | [6.2] Spedition | 19.3 | Teilweise geliefert |
| 6.3 | [6.3] Bei Spedition angemeldet | 19.4 | Geliefert |
| 6.4 | [6.4] Selbstabholung | 19.5 | Ware eingebucht |
| 6.5 | [6.5] Paketdienst DHL/GLS/UPS | 19.8 | Lieferung nicht möglich |
| 6.6 | [6.6] Bestellware | 19.9 | Lieferung storniert |
| 6.7 | [6.7] Export | | |
| 6.8 | [6.8] Demontage | | |

**Tatsaechlich belegt in den letzten 30 Tagen** (877 Auftraege, Auszaehlung ueber
`statusId` der eingesammelten Auftraege — nur Zaehlung, keine Inhalte):

| statusId | Bezeichnung | Anzahl |
| --- | --- | --- |
| 7 | Warenausgang gebucht | 571 |
| 11.1 | Gutschrift ausgezahlt | 64 |
| 3 | Warten auf Zahlung | 47 |
| 8 | Storniert | 44 |
| 8.3 | Angebot angenommen | 35 |
| 6.1 | Paketdienst DPD | 30 |
| 8.1 | Storniert durch Kunden | 22 |
| 5.7 | Wird kommissioniert | 15 |
| 6 | Gerade im Versand | 9 |
| 5.6 | Kommissionieren – Spedition | 8 |
| 7.2 | Gelangensbestätigung versendet | 8 |
| 9.5 | Gutschrift angelegt | 7 |
| 5.8 | Kommissionierung Fehler | 4 |
| 5.5 | Kommissionieren – Paket | 3 |
| 7.3 | Gelangensbestätigung unterschrieben zurück | 3 |
| 9 | Retoure | 2 |
| 6.5 | Paketdienst DHL/GLS/UPS | 2 |
| 6.3 | Bei Spedition angemeldet | 2 |
| 6.4 | Selbstabholung | 1 |

**19 von 58 Status sind in Gebrauch, 39 sind tote Konfiguration** — darunter die
gesamte 19er-Reihe (Offen/Bestellt/Bestätigt/…, offenbar fuer Bestellungen
beim Lieferanten gedacht) und die Reparatur-/Sammel-Status 12, 13, 14.

### D2 — Auftragsherkuenfte (Referrer)

`GET /rest/orders/referrers` → HTTP 200, Array mit **340** Eintraegen (ohne Paginierung).
Felder: `id, isEditable, backendName, name, orderOwnerId, isFilterable, origin`.
`id` ist ein String mit zwei Nachkommastellen (`"2.08"`, `"0.00"`).

Herkuenfte nach `origin`: 308 `plenty`, dazu je 1–3 aus angebundenen Systemen:
Shopify (2), Octopia (3), EbayFulfillment (1), ABOUT YOU (12 Laender), Limango (2),
Bauhaus (2), Shop-Apotheke/Farmaline/Redcare (5), Neckermann.at/Topagers.de (3).

**Auftraege je Herkunft, letzte 30 Tage:**

| referrerId | Name | Auftraege |
| --- | --- | --- |
| 2.08 | eBay Germany | **571** |
| 0.00 | Manuelle Eingabe | 192 |
| 1.00 | Mandant (Shop) | 84 |
| 4.01 | Amazon Germany | 24 |
| 15.00 | *(Name leer in der API)* | 5 |
| 16.00 | *(Name leer in der API)* | 1 |

**6 von 340 Herkuenften sind in Gebrauch.** Zwei davon (15, 16) haben in
`/rest/orders/referrers` einen **leeren** `backendName` — aus der API allein ist
nicht zu sagen, welcher Kanal das ist.

### D3 — Auftragstypen

Eine Liste der Auftragstypen gibt es in diesem Mandanten **nicht**:
`/rest/orders/types`, `/rest/orders/type` und `/rest/orders/order_types` sind alle 404.

Die tatsaechlich vorkommenden `typeId` lassen sich nur aus den Auftraegen selbst
auszaehlen (letzte 30 Tage):

| typeId | Auftraege | Bedeutung laut Plenty-Standard |
| --- | --- | --- |
| 1 | 707 | Auftrag (Sales Order) |
| 7 | 99 | Gutschrift (Credit Note) |
| 4 | 71 | Angebot (Offer) |

Die Spalte „Bedeutung" ist die Plenty-Standardbelegung, **nicht** aus diesem
Mandanten belegt — der Endpunkt, der sie bestaetigen wuerde, fehlt.

### D4 — Belege (documents)

`GET /rest/orders/documents?itemsPerPage=1` → HTTP 200, `totalsCount` = **141 220**.
Felder: `id, type, number, numberWithPrefix, directoryId, path, userId, source,
createdAt, updatedAt, displayDate, newOrderArchitecture, status, endOfRetentionPeriod`.

Eine Liste der Belegarten gibt es nicht (`/rest/orders/documents/types` → 404).
Der `type` des ersten Belegs ist `delivery_note`.

**Wichtig:** der Parameter `?type=` wird von diesem Endpunkt **ignoriert**.
`type=invoice`, `type=delivery_note` und sogar `type=quatschtyp` liefern alle
dieselbe Zahl 141 220. Eine Auszaehlung je Belegart ist ueber diesen Filter also
nicht moeglich. `?orderId=` wirkt dagegen (`orderId=999999999` → `totalsCount` = 0).

Ein Beleg-PDF laege laut Feld `path` hinter dem Dokumentenpfad des Eintrags;
den Abruf habe ich **nicht ausgefuehrt**, weil jeder echte Beleg eine
Kundenrechnung ist. Damit ist „laesst sich ein Beleg-PDF abrufen?" hier
**ungeprueft** — geraten wird nicht.

### D5 — Zahlungsarten und Versandprofile

**Zahlungsarten** — `GET /rest/payments/methods` → HTTP 200, Array mit **282** Eintraegen.
Felder: `id, pluginKey, paymentKey, name, isDocumentBuilderActive`.

**Versandprofile** — `GET /rest/orders/shipping/presets` → HTTP 200, Array mit **32** Eintraegen:

| id | backendName | parcelServiceId |
| --- | --- | --- |
| 10 | DPD Versandkostenfrei | 107 |
| 11 | Spedition 85€ | 103 |
| 12 | Selbstabholung/Nach Absprache (Z) | 105 |
| 14 | DHL | 101 |
| 16 | ter Hürne GmbH (Z) | 108 |
| 20 | FSK 18 - 7,90 € (Z) | 109 |
| 31 | UPS Paket (Z) | 113 |
| 37 | DHL Express (Z) | 101 |
| 40 | Selbstauslieferung (Z) | 118 |
| 41 | Hövelmann (Z) | 120 |
| 42 | FedEx (Z) | 121 |
| 43 | Paket bis 5kg 7,90 € (Z) | 107 |
| 44 | Paket bis 10kg 9,90 € (Z) | 107 |
| 45 | Paket bis 30kg 14,90 € (Z) | 107 |
| 46 | Paket bis 30kg 19,90 € (Z) | 107 |
| 47 | Paket bis 30kg 29,90 € (Z) | 107 |
| 48 | Spedition 85 + 85 (Z) | 103 |
| 49 | Spedition 119 + 119 (Z) | 103 |
| 50 | Spedition 179 + 179 (Z) | 103 |
| 51 | Spedition 219 + 219 (Z) | 103 |
| 52 | Spedition 299 + 299 (Z) | 103 |
| 53 | Spedition 450 + 450 (Z) | 103 |
| 54 | Spedition 500 + 500 (Z) | 103 |
| 55 | Spedition 690 + 690 (Z) | 103 |
| 56 | Spedition 850 + 850 (Z) | 103 |
| 57 | GLS (Sperrgut) bis 40kg 49 + 49 (Z) | 104 |
| 58 | Rottbeck (Z) | 122 |
| 59 | Fremdspedition (Z) | 123 |
| 60 | Spedition 349 + 349 (Z) | 103 |
| 61 | DPD 7,90 (nur Deutschland) | 107 |
| 62 | Paket 7,90 + 0 € (Z) | 107 |
| 63 | DHL Paket Inland | 125 |

### D6 — Feldnamen (keine Werte)

**Auftrag** (`GET /rest/orders?itemsPerPage=1&with=orderItems`):
`id, referrerId, roundTotalsOnly, numberOfDecimals, statusName, plentyId, typeId,
lockStatus, locationId, createdAt, updatedAt, statusId, ownerId, relations,
properties, dates, amounts, orderReferences, orderItems, addressRelations`

Unterobjekte des Auftrags:
- `relations[]`: `orderId, referenceType, referenceId, relation`
- `properties[]`: `orderId, typeId, value, createdAt, updatedAt`
- `dates[]`: `orderId, typeId, date`
- `amounts[]`: `id, orderId, isSystemCurrency, isNet, currency, exchangeRate, netTotal, grossTotal, vatTotal, invoiceTotal, paidAmount, giftCardAmount, createdAt, updatedAt, shippingCostsGross, shippingCostsNet, taxlessAmount, prepaidAmount, vats`
- `addressRelations[]`: `id, orderId, typeId, addressId`

**Auftragsposition** (`orderItems[]`):
`id, orderId, typeId, referrerId, itemVariationId, quantity, orderItemName,
attributeValues, shippingProfileId, countryVatId, vatField, vatRate, position,
createdAt, updatedAt, warehouseId, orderProperties, properties, dates, amounts, references`

Unterobjekte der Position:
- `properties[]`: `id, orderItemId, typeId, value, createdAt, updatedAt`
- `dates[]`: `id, orderItemId, typeId, date, createdAt, updatedAt`
- `amounts[]`: `id, orderItemId, isSystemCurrency, currency, exchangeRate, purchasePrice, priceOriginalGross, priceOriginalNet, priceGross, priceNet, surcharge, discount, isPercentage, createdAt, updatedAt`

Die Kundendaten haengen **nicht** direkt am Auftrag, sondern nur als `addressId`
in `addressRelations[]` und als `referenceId` in `relations[]`. Wer Auftraege
auswertet, ohne die aufzuloesen, bekommt keine personenbezogenen Daten zu sehen.

**Zahlung** (`GET /rest/payments?itemsPerPage=1`):
`id, amount, exchangeRatio, mopId, parentId, deleted, unaccountable, currency,
type, hash, receivedAt, importedAt, status, transactionType, isSystemCurrency,
parent, method, histories, properties, order, contact, children`
— `method` enthaelt `id, pluginKey, paymentKey, name, isDocumentBuilderActive`.

**Kontakt** (`GET /rest/accounts/contacts?itemsPerPage=1`) — nur die Schluessel,
bewusst ohne jeden Wert:
`id, number, externalId, typeId, firstName, lastName, gender, title, formOfAddress,
newsletterAllowanceAt, classId, blocked, rating, bookAccount, lang, referrerId,
userId, birthdayAt, lastLoginAt, lastOrderAt, createdAt, updatedAt, valuta,
discountDays, discountPercent, timeForPaymentAllowedDays, salesRepresentativeContactId,
anonymizeAt, position_id, isAnonymized, plentyId, email, ebayName, privatePhone,
privateFax, privateMobile, paypalEmail, paypalPayerId, klarnaPersonalId,
dhlPostIdent, singleAccess, contactPerson, marketplacePartner, fullName, options, accounts`

Dieser Endpunkt gibt Klarnamen, E-Mail-Adressen, Telefonnummern und
Zahlungskennungen direkt in der Listenantwort aus — wer ihn anfasst, verarbeitet
personenbezogene Daten.

**Variante** (`GET /rest/items/variations?itemsPerPage=1`) — 75 Felder, darunter
die fuer uns wichtigen: `id, isMain, mainVariationId, itemId, number, model,
externalId, isActive, availability, mainWarehouseId, unitCombinationId, name,
weightG, weightNetG, widthMM, lengthMM, heightMM, purchasePrice, movingAveragePrice,
vatId, customsTariffNumber, stockLimitation, picking, createdAt, updatedAt`
sowie per `?with=` nachladbar `variationBarcodes, variationCategories, stock`.

**Artikel** (`GET /rest/items?itemsPerPage=1`) — 62 Felder, darunter
`id, position, manufacturerId, stockType, condition, itemType, mainVariationId,
ownerId, producingCountryId, revenueAccount, customsTariffNumber, createdAt,
updatedAt, texts` und **20 Freitextfelder** `free1`–`free20`.

**Bestandszeile** (`GET /rest/stockmanagement/stock?itemsPerPage=1`):
`itemId, warehouseId, stockPhysical, reservedStock, reservedEbay, reorderDelta,
stockNet, storehouse_type, reordered, reservedBundle, averagePurchasePrice,
warehousePriority, updatedAt, variationId`

---

## Teil E — Rechte des API-Benutzers

> **Korrektur (Nachtrag).** Der erste Stand dieses Abschnitts sagte „kein
> einziger 403". Das galt nur fuer die 36 Proben aus Teil A. Die spaetere breite
> Endpunkt-Suche (Teil J) hat **einen** 403 gefunden — siehe unten.

In den 36 Proben aus Teil A antwortet kein Bereich mit 403; jeder Fehlschlag dort
ist ein 404 oder der 500 bei `/rest/plugins`. Ueber alle rund 150 geprueften
Pfade hinweg gibt es aber **genau eine** 403-Stelle:

| Pfad | HTTP | Fehlendes Recht laut Antwort |
| --- | --- | --- |
| `/rest/warehouses` | **403** | `stock.warehouse.show`, `stock.warehouse` („Lager"), `stock` („Warenbestaende") |

Die Antwort nennt das fehlende Recht im Klartext:
`{"error":{"message":"This action is unauthorized.","missing_permissions":{"stock.warehouse.show":…}}}`

Bemerkenswert daran: **der alte Pfad `/rest/stockmanagement/warehouses` liefert
dieselben Lagerdaten mit HTTP 200.** Dem Benutzer fehlt das Recht nur auf dem
neueren Endpunkt. Wer die Rechte-Lage aus dem alten Pfad ableitet, haelt den
Zugang faelschlich fuer vollstaendig.

Rolle und Rechte lassen sich nur teilweise klaeren:

- `/rest/roles` → **404**, gibt es in diesem Mandanten nicht. Rollennamen sind
  ueber die API also nicht aufloesbar.
- `/rest/users?itemsPerPage=5` → HTTP 200, `totalsCount` = **68** Benutzer.
- `GET /rest/users/128` → HTTP 200. Rechte-relevante Felder (Klarname und
  E-Mail bewusst nicht ausgegeben):

| Feld | Wert |
| --- | --- |
| `id` | 128 |
| `userType` | `backend` |
| `loginType` | `legacy` |
| `disabled` | 0 |
| `Ustatus` | 2 |
| `user_role_id` | `null` |
| `globalRoles` | `[]` (leer) |
| `publicRoles` | `[2, 3, 93]` |
| `plenty_api` | 0 |
| `access_control_list` | leer |
| `backend_set_id` | 19 |
| `storehouse_id` | `null` |
| `del_order` / `del_article` / `del_record` | 0 / 0 / 0 |
| `supportAccess` / `isSupportUser` | false / false |

Der verwendete Zugang ist damit **kein eigener REST-API-Benutzer, sondern ein
normaler Backend-Benutzer** mit `loginType = legacy` und `plenty_api = 0`.
Welche Rechte hinter `publicRoles [2, 3, 93]` stecken, ist ueber die API nicht
aufloesbar, weil `/rest/roles` fehlt.

---

## Teil F — Was wovon tatsaechlich genutzt wird

Nicht im urspruenglichen Fragenkatalog, aber fuer jede Automatisierung die
eigentliche Frage: was ist Konfiguration und was ist Betrieb.

| Bereich | Konfiguriert | Tatsaechlich in Gebrauch | Anteil |
| --- | --- | --- | --- |
| Lager | 9 | 8 mit Bestand (107 FBA leer), 1 mit Lagerort-Struktur | 1 von 9 gepflegt |
| Auftragsstatus | 58 | 19 (30 Tage) | 33 % |
| Auftragsherkuenfte | 340 | 6 (30 Tage) | 1,8 % |
| Zahlungsarten | 282 | ueber die API nicht auszaehlbar | — |
| Versandprofile | 32 | nicht ausgezaehlt | — |
| Barcode-Konfigurationen | 18 | EAN_13 2 (`id=2`) laut Projektcode | — |
| Eigenschaften | 24 | 6 Datei-Eigenschaften, 9 „MS …"-Felder | — |
| Webshops | 6 | 4 mit Auftraegen (30 Tage) | — |
| Kategorien | 1 242 | „Projekte" (2632) mit 95 Varianten in 3 von 8 Unterkategorien | — |
| Artikel-Sets | 0 | 0 | ungenutzt |

**Auftraege je Mandant/Webshop, letzte 30 Tage** (Feld `plentyId` am Auftrag):

| plentyId | Webshop | Auftraege |
| --- | --- | --- |
| 14616 | Komplett Konzept | **828** |
| 14443 | www.besttra.de | 41 |
| 15933 | Gastrokönig | 4 |
| 36636 | Parlitz Partner | 4 |
| 15218 | Scala Deutschland | 0 |
| 24971 | Komplett Konzept int. | 0 |

Der Mandant heisst `p14443` und der Shop `besttra.de`, aber **94 % der Auftraege
laufen ueber plentyId 14616 „Komplett Konzept"**. Wer nach `plentyId = 14443`
filtert, sieht ein Zwanzigstel des Geschaeftes.

**Vertriebskanaele:** 55 104 Listings stehen 60 430 Varianten gegenueber — der
Artikelstamm ist fast vollstaendig in Kanaele ausgespielt. Angebunden sind laut
`origin` der Referrer neben Plenty selbst: Shopify, Octopia, eBay Fulfillment,
ABOUT YOU (12 Laender), Limango, Bauhaus, Shop-Apotheke/Farmaline/Redcare,
Neckermann.at/Topagers.de. Auftraege kamen in den letzten 30 Tagen aber nur ueber
eBay Germany, manuelle Eingabe, den Shop und Amazon Germany.

---

## Teil G — Die Freitextfelder `free1`–`free20`

Erhoben durch **Vollabzug aller Artikel**: `GET /rest/items?itemsPerPage=100&page=1…587`,
587 Seiten, HTTP 200, **58 667 Artikel** vollstaendig ausgewertet (nicht gesampelt).

| Feld | belegt | Anteil | verschiedene Werte | Ø Laenge |
| --- | ---: | ---: | ---: | ---: |
| free1 | 179 | 0,31 % | 116 | 27,6 |
| free2 | **0** | 0 % | 0 | — |
| free3 | 5 | 0,01 % | 1 | 10 |
| free4 | 4 | 0,01 % | 4 | 40,3 |
| free5 | 1 | 0,00 % | 1 | 10 |
| free6 | **0** | 0 % | 0 | — |
| free7 | 3 504 | 5,97 % | 28 | 3,3 |
| free8 | 3 587 | 6,11 % | **1** | 1 |
| free9 | 3 587 | 6,11 % | **1** | 1 |
| free10 | 1 554 | 2,65 % | 43 | 10,2 |
| free11 | 2 627 | 4,48 % | 101 | 2,3 |
| free12 | 2 095 | 3,57 % | **1** | 1 |
| free13 | 1 956 | 3,33 % | **1** | 1 |
| free14 | **53 978** | **92,01 %** | 3 | 1 |
| free15 | **53 969** | **91,99 %** | 11 | 1 |
| free16 | 2 021 | 3,44 % | 4 | 1,1 |
| free17 | 1 966 | 3,35 % | 5 | 1 |
| free18 | 1 958 | 3,34 % | 2 | 1 |
| free19 | 1 497 | 2,55 % | **1** | 1 |
| free20 | 1 497 | 2,55 % | **1** | 1 |

**Der entscheidende Punkt: „belegt" heisst hier fast immer die Zeichenkette `"0"`.**
Wer nur zaehlt, ob das Feld nicht leer ist, haelt `free14` fuer zu 92 % gepflegt.
Tatsaechlich steht dort 53 976-mal `"0"` und genau zweimal ein echter Wert.

Aufschluesselung der belegten Felder nach tatsaechlichem Inhalt:

| Feld | davon `"0"` | echter Inhalt | Wofuer es offensichtlich benutzt wurde |
| --- | ---: | ---: | --- |
| free1 | 0 | **179** | Lagerort als Freitext: „Borken" (50×), „Halle 2 Regal 4 Platz B 5-6", „H2R3B1", „a31012013_1_burlo"; dazu Vermerke wie „Privat eingestellt" und Lieferhinweise |
| free3 | 0 | 5 | genau ein Wert: „Outerwear" |
| free4 | 0 | 4 | Lagerort-Notizen mit Zeilenumbruch, z. B. „MP08112014_06_H1R4E8\nMB06102014_1_H1R4E9" |
| free5 | 0 | 1 | eine Zahl: „4299088031" |
| free7 | 2 620 | **884** | Artikelzustand als Freitext: „Neu" (397), „Gebraucht" (260), „Gebraucht, sehr gut." (82), „neu" (53), „Vom Verkäufer generalüberholt" (24), „gebraucht" (15) — 28 verschiedene Schreibweisen |
| free8 | 3 587 | **0** | ausschliesslich `"0"` |
| free9 | 3 587 | **0** | ausschliesslich `"0"` |
| free10 | 1 443 | 111 | eBay-/Suchmaschinen-Keywordketten, z. B. „ABT AUDI VW Tuning Shirt T-Shirt …" (31×) |
| free11 | 2 217 | 410 | Amazon-Node-IDs, z. B. „360603031" (100×), „2147483647" (29×) |
| free12 | 2 095 | **0** | ausschliesslich `"0"` |
| free13 | 1 956 | **0** | ausschliesslich `"0"` |
| free14 | 53 976 | **2** | praktisch leer: nur „1403" und „2404" |
| free15 | 53 899 | **70** | kleine Zahlen (3, 4, 36, 18, 5, 8, 6 …) |
| free16 | 1 956 | 65 | Zeiteinheiten: „years" (36), „year" (19), „months" (10) |
| free17 | 1 957 | 9 | Geschlecht: „Unisex" (6), „unisex", „mädchen", dazu einmal „DPD" |
| free18 | 1 957 | 1 | einmal „Pokémon" |
| free19 | 1 497 | **0** | ausschliesslich `"0"` |
| free20 | 1 497 | **0** | ausschliesslich `"0"` |

**Fazit fuer die Automatisierung:** sechs Felder (free8, free9, free12, free13,
free19, free20) enthalten **nur** `"0"` und tragen keinerlei Information. Zwei
(free2, free6) sind komplett leer. Echte Bedeutung haben nur vier:
`free1` (Lagerort als Freitext), `free7` (Zustand), `free10` (Keywords),
`free11` (Amazon-Node-ID) — und selbst die sind uneinheitlich geschrieben.
`free1` und `free4` sind besonders heikel: dort steht der Lagerort als Prosa,
**parallel** zur echten Lagerort-Verwaltung aus Teil B6.

### Weitere Verteilungen aus dem Artikel-Vollabzug (58 667 Artikel)

| Feld | Verteilung |
| --- | --- |
| `itemType` | `default` = 58 667 (**alle**) |
| `stockType` | 0 = 58 538, 3 = 127, 1 = 2 |
| `condition` | 0 = 34 306, 1 = 24 052, 2 = 235, 4 = 61, 3 = 13 |
| `conditionApi` | 0 = 34 700, 3 = 14 830, 2 = 7 193, 1 = 1 375, 4 = 483, 5 = 86 |
| `ownerId` | `null` = 50 035, **128 = 8 626**, 13 = 4, 5 = 1, 14 = 1 |
| `producingCountryId` | 1 (DE) = 46 838, 0 = 9 357, dann 47 weitere Laender mit je < 300 |
| `revenueAccount` | 0 = 58 667 (**alle**) |
| `flagOne` | 25 Werte, fuehrend 18 = 16 116, 0 = 13 790, 24 = 8 475 |
| `flagTwo` | 12 Werte, fuehrend 0 = 37 181, 6 = 5 040, 2 = 4 036 |
| `ageRestriction` | 0 = 58 646, 3 = 12, 18 = 6, 16 = 2, 6 = 1 |
| `isSerialNumber` | true = **6** |
| `isShippingPackage` | true = **6** |
| `isSubscribable` | true = **5** |
| `isShippableByAmazon` | true = **1** |
| `storeSpecial` | 0 = 58 375, 2 = 142, 3 = 82, 1 = 68 |
| `couponRestriction` | 0 = 58 667 (**alle**) |
| `add_cms_page` | 0 = 58 667 (**alle**) |
| `amazonProductType` | 0 = 58 047, dann 50 weitere mit je < 230 |
| `ebayPresetId` | `null` = 44 128, **30 = 11 800**, 0 = 2 569, Rest < 90 |
| `amazonFbaPlatform` | 0 = 58 667 (**alle**) |
| Hersteller gesetzt | 50 548 von 58 667 (86,2 %) |
| Zolltarifnummer gesetzt | **6** von 58 667 (0,01 %) |

Der API-Benutzer 128 ist bei **8 626 Artikeln** als `ownerId` eingetragen — der
Zugang ist also nicht nur lesend im Einsatz gewesen, sondern hat in der
Vergangenheit Artikel angelegt.

---

## Teil H — Wofuer die Kategorien genutzt werden

Erhoben durch **Vollabzug aller Varianten**:
`GET /rest/items/variations?itemsPerPage=100&with=variationCategories,variationBarcodes&page=1…605`,
605 Seiten, HTTP 200, **60 438 Varianten** vollstaendig ausgewertet.

- **1 242 Kategorien** insgesamt, davon **637 mit mindestens einer Variante**
  und **605 vollstaendig leer** (48,7 %).
- **56 241 Kategoriezuordnungen** auf 60 438 Varianten.
- **10 271 Varianten (17,0 %) haengen in gar keiner Kategorie.**

**Die 25 groessten Kategorien:**

| Varianten | id | Ebene | Pfad |
| ---: | --- | --- | --- |
| 4 304 | 526 | L2 | Autom.,Antrieb,Steuerung > Pneumatik |
| 4 176 | 216 | L2 | Autom.,Antrieb,Steuerung > SPS, Bus- & Logiksysteme |
| **3 087** | **2246** | **L1** | **Dummy** |
| 2 080 | 88 | L2 | Elektronik & Elektrotechnik > Zubehör & Sonstiges |
| 1 624 | 212 | L2 | Autom.,Antrieb,Steuerung > Sensoren & Regler |
| 1 520 | 206 | L3 | Industriebedarf > Metallbearbeitung & Schlosser > Kugellager |
| 1 432 | 209 | L2 | Autom.,Antrieb,Steuerung > Motoren & Getriebe |
| 1 274 | 323 | L1 | Gastronomie |
| 1 266 | 500 | L3 | Elektronik & Elektrotechnik > Elektromaterial > Kabel |
| **1 175** | **894** | **L3** | **Filter & Sortierungen > Papierkorb > Alte Artikel - Nicht mehr auf Lager** |
| 1 164 | 202 | L3 | Industriebedarf > Metallbearbeitung & Schlosser > Werkzeug für Metallbearbeitung |
| 1 108 | 203 | L3 | Industriebedarf > Metallbearbeitung & Schlosser > Maschinen & Zubehör |
| 1 004 | 113 | L3 | Industriebedarf > Sonstige Branchen & Produkte > Diverse Produkte |
| 893 | 283 | L3 | Industriebedarf > Auto, Motorrad & Zubehör > Ersatzteile & Zubehör |
| 850 | 205 | L3 | Industriebedarf > Metallbearbeitung & Schlosser > Mess- & Prüfmittel |
| 827 | 89 | L2 | Elektronik & Elektrotechnik > Mess & Prüftechnik |
| 788 | 157 | L4 | Industriebedarf > Produktions & Industriebedarf > Werkzeuge & Werkstattbedarf > Bohrer & Aufsätze |
| 732 | 158 | L4 | Industriebedarf > Produktions & Industriebedarf > Werkzeuge & Werkstattbedarf > Befestigungstechnik |
| 731 | 214 | L2 | Autom.,Antrieb,Steuerung > Lineartechnik |
| 578 | 1438 | L2 | Industriebedarf > trademaschines |
| 562 | 200 | L2 | Industriebedarf > Maschinen & Anlagen |
| 498 | 1501 | L2 | Lagertechnik > Regale |
| 473 | 1206 | L2 | Industriebedarf > Machinio |
| 466 | 90 | L2 | Elektronik & Elektrotechnik > Netzgeräte & Stromversorgung |
| 452 | 1498 | L2 | Industriebedarf > Neu eingetroffen |

**Acht Wurzelkategorien enthalten keine einzige Variante:**
456 „Geräte", 1505 „Haus Heimwerken und Freizeit", 1543 „Suchergebnis",
1558 „Import (nicht löschen!)", 2240 „Filter & Sortierungen",
2478 „Industriebedarf Neu", **2632 „Projekte"** und 2686 (Testkategorie).

Dass „Projekte" (2632) selbst leer ist, deckt sich mit Teil B2: die 95 Varianten
sitzen in den Unterkategorien, nicht in der Wurzel.

### Wofuer die Kategorien faktisch benutzt werden

Die Namen der grossen Kategorien verraten drei ganz verschiedene Zwecke, die im
selben Baum stecken:

1. **Echter Warenkatalog** — die Aeste „Autom.,Antrieb,Steuerung",
   „Industriebedarf", „Elektronik & Elektrotechnik", „Gastronomie",
   „Lagertechnik". Das ist die Mehrheit.
2. **Kanal- und Prozessmarker** — „trademaschines" (578), „Machinio" (473),
   „Neu eingetroffen" (452). Das sind keine Warengruppen, sondern
   Ausspiel-/Workflow-Kennzeichen, die als Kategorie missbraucht werden.
3. **Ablage und Testreste** — „Dummy" (**3 087 Varianten**, drittgroesste
   Kategorie ueberhaupt) und „Filter & Sortierungen > Papierkorb > Alte Artikel -
   Nicht mehr auf Lager" (1 175). Zusammen **4 262 Varianten**, also 7 % des
   Sortiments, liegen in Kategorien, deren Name sie selbst als Muell ausweist.

### Barcode-Nutzung (aus demselben Vollabzug)

| barcodeId | Name laut Teil B3 | Varianten |
| --- | --- | ---: |
| **2** | **EAN_13 2** | **47 112** |
| 1 | EAN_13 1 | 7 172 |
| 13 | UPC 1 | 126 |
| 3 | EAN_13 3 | 10 |
| 17 | ISBN | 9 |
| 5 | CODE_128 1 | 6 |
| 4 | EAN_13 4 | 1 |

**Das bestaetigt `EAN13_2` = `id 2` aus Teil B3 jetzt auch empirisch:** 47 112 von
54 436 vergebenen Barcodes haengen an dieser Konfiguration. **11 333 Varianten
(18,8 %) haben ueberhaupt keinen Barcode.** Von den 18 konfigurierten
Barcode-Arten sind nur 7 je benutzt worden, 11 sind tot.

### Pflegestand der Varianten (60 438)

| Merkmal | Anzahl | Anteil |
| --- | ---: | ---: |
| `number` gesetzt | 60 437 | 100,0 % |
| `model` gesetzt | 32 964 | 54,5 % |
| `externalId` gesetzt | 207 | 0,3 % |
| Einkaufspreis > 0 | **575** | **1,0 %** |
| Gewicht > 0 | 18 540 | 30,7 % |
| Maße vollstaendig (B×L×H) | **1 140** | **1,9 %** |

| Feld | Verteilung |
| --- | --- |
| `isActive` | true = 49 546, **false = 10 892** (18,0 %) |
| `isMain` | true = 58 653, false = 1 785 |
| `availability` | 1 = 47 274, 8 = 11 231, 5 = 1 365, 2 = 520, Rest < 50 |
| `mainWarehouseId` | **106 = 55 597**, 110 = 3 851, 111 = 379, 108 = 310, 109 = 240, 112 = 59, 113 = 2 |
| `unitCombinationId` | 1 = 54 309, dann 447 weitere Kombinationen mit je < 1 300 |
| `vatId` | 0 = 60 429, 3 = 4, 5 = 2, null = 2, 2 = 1 |
| `bundleType` | null = 60 177, `bundle` = 157, `bundle_item` = 104 |
| `stockLimitation` | 1 = 60 431, 0 = 4, 2 = 3 |
| `picking` | `no_single_picking` = 54 093, null = 6 254, `single_picking` = 90, `exclude_from_picklist` = 1 |
| `automaticClientVisibility` | 0 = 45 314, 1 = 15 124 |
| `automaticListVisibility` | 1 = 33 575, 3 = 18 032, 0 = 8 768, -2 = 63 |
| `isHiddenInCategoryList` | false = 60 319, true = 119 |

`availability = 8` heisst laut Teil J „Artikel nicht mehr Lieferbar" — das
betrifft **11 231 Varianten (18,6 %)**.

---

## Teil I — Automatisierungen: was laeuft, was nicht

### I1 — Plugin-Sets

`GET /rest/plugin_sets` → HTTP 200, Array mit **16 Sets**.
Die Plugin-Liste je Set kommt ueber `GET /rest/plugin_sets/{id}/plugins` (HTTP 200) —
**das umgeht den HTTP 500 von `/rest/plugins`.** Damit ist die Plugin-Frage aus
dem urspruenglichen Fragenkatalog doch beantwortbar.

| Set-ID | Name | `enabled` | Plugins | Git | zugeordnete Webshops | letzter Build |
| --- | --- | --- | ---: | --- | --- | --- |
| 1 | wwwbesttrade | **ja** | 12 | nein | — | 2026-08-24 |
| 2 | komplett-konzept | nein | 8 | nein | — | 2025-08-28 |
| 3 | scala-deutschland | **ja** | 2 | nein | 2 (Scala Deutschland) | 2024-12-18 |
| 5 | parlitz-partner | **ja** | 3 | nein | 4 (Parlitz Partner) | 2024-12-18 |
| 8 | CeresShop001 | nein | 9 | nein | — | 2024-12-18 |
| 9 | INC_Ceres_komplett-konzept | nein | 8 | nein | — | 2023-04-19 |
| 10 | INC_Gastrokoenig_Ceres5 | **ja** | 6 | nein | 3 (Gastrokönig) | 2026-06-17 |
| 17 | LTS 5.0.63 Komplett-Konzept C4 DEV | nein | 12 | ja | — | 2024-11-14 |
| 18 | LTS 5.0.63 Komplett-Konzept C4 DEV Backup | nein | 12 | ja | — | 2024-11-05 |
| 19 | LTS 5.0.71 Komplett-Konzept C4_Live | **ja** | 15 | ja | — | 2026-08-25 |
| 20 | LTS 5.0.71 Komplett-Konzept C4_DEV | nein | 12 | ja | — | 2025-01-16 |
| 28 | (Testset auf einen Vornamen benannt) | **ja** | 3 | ja | — | 2026-08-24 |
| 29 | Complete Concecpt Internation | **ja** | 15 | ja | — | 2026-07-27 |
| 30 | Complete Concecpt Internation Version 5.0.84 | **ja** | 15 | ja | 5 (Komplett Konzept int.) | 2026-09-15 |
| 31 | LTS 5.0.84 Komplett-Konzept _TEST | **ja** | 15 | ja | 1 (Komplett Konzept) | 2026-09-15 |
| 32 | wwwbesttrade_TEST_IO 5.0.84 | **ja** | 12 | nein | 0 (www.besttra.de) | 2026-09-15 |

**10 von 16 Sets sind aktiv, 6 abgeschaltet.** Nur **6 Sets sind einem Webshop
zugeordnet** — die uebrigen 10 sind aktiv oder inaktiv, aber ohne Shop dahinter.

### I2 — Die 24 Plugins und wo sie produktiv aktiv sind

In allen 16 Sets sind durchgaengig **alle** enthaltenen Plugins
`activeProductive = true`. Es gibt in diesem Mandanten **kein einziges installiertes,
aber deaktiviertes Plugin** — ein Plugin ist entweder im Set und aktiv oder gar nicht drin.

| Plugin | in Sets | produktiv aktiv in | Quelle |
| --- | ---: | --- | --- |
| CategoryTemplates | 16 | 1,2,3,5,8,9,10,17,18,19,20,28,29,30,31,32 | local |
| ElasticExport | 13 | 1,2,3,5,9,17,18,19,20,29,30,31,32 | marketplace |
| IO | 13 | 1,2,8,9,10,17,18,19,20,29,30,31,32 | marketplace |
| Ceres | 13 | 1,2,8,9,10,17,18,19,20,29,30,31,32 | marketplace |
| PrePayment | 12 | 1,8,9,10,17,18,19,20,29,30,31,32 | marketplace |
| FormatDesigner | 12 | 1,2,5,9,17,18,19,20,29,30,31,32 | marketplace |
| CfourCustomCssJs | 11 | 2,8,9,10,17,18,19,20,29,30,31 | marketplace |
| PayPal | 9 | 1,17,18,19,20,29,30,31,32 | marketplace |
| Gebraucht | 9 | 2,9,17,18,19,20,29,30,31 | marketplace |
| CfourHtmlWidget | 7 | 17,18,19,20,29,30,31 | marketplace |
| CfourOwlSliderWidget5 | 7 | 17,18,19,20,29,30,31 | marketplace |
| **KkExtraComponents** | 7 | 17,18,19,20,29,30,31 | **git** |
| DHLExpress | 5 | 1,19,28,31,32 | marketplace |
| GoogleAnalytics | 5 | 2,19,29,30,31 | marketplace |
| PayUponPickup | 4 | 1,8,10,32 | marketplace |
| ElasticExportGoogleShopping | 4 | 19,29,30,31 | marketplace |
| Invoice | 2 | 1,32 | marketplace |
| EbaySdk | 2 | 1,32 | marketplace |
| EbayAnalytics | 2 | 1,32 | marketplace |
| Findologic | 2 | 29,30 | marketplace |
| CookieBar | 1 | 8 | marketplace |
| CeresDark | 1 | 8 | marketplace |
| DPDShippingServices | 1 | 8 | marketplace |
| **VoiceTaskPluginClean** | 1 | 28 | **git** |

Zwei Plugins kommen aus einem Git-Repository statt aus dem Marketplace:
`KkExtraComponents` (in 7 Sets) und `VoiceTaskPluginClean` (nur im Testset 28).
Das sind die einzigen zwei Stellen mit eigenem Code.

### I3 — Elastic-Export-Formate: 45 Exporte

`GET /rest/exports?itemsPerPage=100` → HTTP 200, **45 Eintraege**.
Felder: `id, createdAt, updatedAt, name, type, limit, formatKey, outputType, generateCache`.

**Wichtig: es gibt kein Feld „aktiv/inaktiv".** Ob ein Export laeuft, ist ueber
die API **nicht** feststellbar — nur wann er zuletzt geaendert wurde. Die Spalte
„zuletzt geaendert" unten ist der einzige verfuegbare Anhaltspunkt.

Nach Datenart: `item` 22, `order` 5, `category` 4, `listingMarketHistory` 3,
`order_item` 2, `listing` 2, `stock` 2, `manufacturer` 2, `item_image` 1,
`contact` 1, `attribute` 1.
Nach Ausgabe: `download` 44, `admin` 1.

| id | Name | Typ | Limit | zuletzt geaendert |
| --- | --- | --- | ---: | --- |
| 1 | Restposten.de | item | 10 000 | 2018-06-19 |
| 2 | Restposten 2 | item | 1 000 000 | 2018-05-08 |
| 3 | trade_maschines | item | 50 000 | 2018-09-14 |
| 4 | Maschinensucher | item | 10 000 | 2025-09-22 |
| 5 | Spielwaren | item | 10 000 | 2018-09-19 |
| 6 | BilderExport | item_image | 1 000 | 2018-09-19 |
| 7 | Inventur_Item | item | 10 000 000 | 2025-11-04 |
| 8 | Export alle Mandanten | item | 1 000 000 000 | 2025-03-17 |
| 9 | gebrauchtDE | item | 1 000 000 | 2019-03-16 |
| 10 | TKT | order | 100 000 | 2019-04-17 |
| 15 | Verkauf_Desinfektionsmittel_Auftrag | order | 1 000 000 | 2020-04-27 |
| 16 | Auftragsexport Datum | order | 100 000 | 2020-05-11 |
| 17 | Gutscheine_Amazon | order_item | 10 000 000 | 2022-06-27 |
| 18 | Auftragsexport Kundendaten Datum | order | 1 000 000 000 | 2020-05-29 |
| 19 | Gigaset_Verkauf | order_item | 10 000 000 | 2020-12-09 |
| 21 | Inventur_aktive_Listing | listingMarketHistory | 1 000 000 000 | 2025-01-06 |
| 22 | Listing_Inventur | listing | 100 000 000 | 2020-12-29 |
| 23 | Warenbestand | stock | 100 000 000 | 2024-01-04 |
| 24 | Inventur Aktive Listing_Neu | listingMarketHistory | 100 000 000 | 2023-01-02 |
| 25 | Inventur Listing NEU | listingMarketHistory | 1 000 000 000 | 2025-01-06 |
| 26 | Hersteller_Export_Etiene | manufacturer | 10 000 | 2025-03-13 |
| 27 | Artikel_ohne_Hersteller_Export | item | 100 000 | 2025-03-14 |
| 28 | Kompletter Warenbestand | item | 200 000 | 2025-05-07 |
| 29 | Test | listing | 100 000 000 | 2025-03-21 |
| 30 | Bestandsexport | stock | 2 000 000 | 2025-05-07 |
| 31 | Test Indien | item | 1 000 000 | 2025-06-24 |
| 32 | Test PS | item | 100 000 | 2026-06-19 |
| 33 | Kategorie-Export | category | 100 000 | 2025-11-12 |
| 34 | Hersteller-Export | manufacturer | 100 000 | 2025-07-01 |
| 37 | Nettopreise | item | 100 000 | 2025-07-08 |
| 40 | TS Export Category | category | 10 000 | 2026-03-13 |
| 41 | Google Shopping | item | 100 | 2025-10-16 |
| 42 | Techno | item | 200 | 2025-11-12 |
| 43 | TS Categories | category | 200 | 2025-11-12 |
| 44 | Kontaktexport | contact | 50 | 2025-11-26 |
| 45 | Shopify Update.csv | item | 100 | 2026-02-04 |
| 46 | Hoppe Bestandsliste | item | 10 000 | 2026-04-24 |
| 47 | Hoppe Bestandsliste | item | 10 000 | 2026-04-24 |
| 48 | Techno Translate | category | 1 000 | 2026-06-30 |
| 49 | New Export | item | 50 000 | 2026-07-01 |
| 50 | Amazon Hoppe | item | 10 000 | 2026-07-24 |
| 51 | attribute export | attribute | 50 | 2026-08-12 |
| 52 | Lagerplatz vergabe | item | 99 999 | 2026-09-07 |
| 53 | Auftragsexport Test | order | 1 000 | 2026-09-15 |
| 54 | eBay Links entfernen | item | 99 999 | 2026-09-21 |

### I4 — Marktplatz-Zugaenge

`GET /rest/markets/credentials` → HTTP 200, **23 Eintraege**.
Felder: `id, environment, status, data, market, createdAt, updatedAt`.
Das Feld `data` enthaelt Zugangsdaten — **hier steht bewusst nur die Anzahl je
Markt, kein einziger Wert.**

| Markt | Zugaenge |
| --- | ---: |
| ebay | **12** |
| kaufland | 6 |
| rakuten.de | 2 |
| hood | 1 |
| ottoMarketplace | 1 |
| shopify | 1 |

`GET /rest/markets/settings` → HTTP 200, **leeres Array**.

### I5 — Tags

`GET /rest/tags` → HTTP 200, **22 Tags**. Felder: `id, tagName, color, createdAt, updatedAt`.

| id | Tag | id | Tag |
| --- | --- | --- | --- |
| 1 | gastronomiebedarf | 13 | Ebay |
| 2 | newsletter | 16 | Whatsapp |
| 3 | Verbundpartner | 17 | Webshop |
| 4 | plentyApp | 18 | Virtueller Mario |
| 5 | MRT | 19 | Dummy API Artikel |
| 6 | gpsr | 20 | OSS |
| 7 | (Vorname) | 21 | weitergeleitet |
| 9 | telefonisch | 22 | 1x nachgefasst |
| 10 | e-Mail | 23 | 2x nachgefasst |
| 11 | Maschienensucher | 24 | 3x nachgefasst |
| 12 | angeschrieben | 25 | in Arbeit |

Die Tags 22/23/24 („1x/2x/3x nachgefasst") und 25 („in Arbeit") sind offenbar
der manuelle Ersatz fuer eine Wiedervorlage; 9/10/16/12/21 bilden Kontaktwege ab.
Tag 19 heisst „Dummy API Artikel" — es gibt also eine bewusste Markierung fuer
per API angelegte Testartikel. Tag 11 ist als „Maschienensucher" geschrieben
(Tippfehler), waehrend der Export id=4 „Maschinensucher" heisst.

---

## Teil J — Weitere Bereiche aus der breiten Endpunkt-Suche

Ueber die 36 Proben aus Teil A hinaus wurden rund 150 weitere Pfade geprueft.
Was dabei zusaetzlich gefunden wurde:

| Bereich | Pfad | HTTP | Umfang |
| --- | --- | --- | --- |
| Artikel-Versandprofile | `/rest/items/item_shipping_profiles` | 200 | **95 338** |
| Cross-Selling | `/rest/items/item_cross_selling` | 200 | **40 372** |
| Adressen | `/rest/accounts/addresses` | 200 | **132 251** |
| Auftrags-Eigenschaftstypen | `/rest/orders/properties/types` | 200 | **149** |
| Zahlungs-Eigenschaftstypen | `/rest/payments/properties/types` | 200 | 36 |
| Eigenschaftsnamen | `/rest/properties/names` | 200 | 33 |
| Marktplatz-Zugaenge | `/rest/markets/credentials` | 200 | 23 |
| Tags | `/rest/tags` | 200 | 22 |
| Plugin-Sets | `/rest/plugin_sets` | 200 | 16 |
| Plugins je Set | `/rest/plugin_sets/{id}/plugins` | 200 | 2–15 je Set |
| Elastic-Exporte | `/rest/exports` | 200 | 45 |
| Haendlerkonten | `/rest/accounts` | 200 | Array, mind. 200 (kein `totalsCount`) |
| Kontakt-Typen | `/rest/accounts/contacts/types` | 200 | 6 |
| Kontakt-Klassen | `/rest/accounts/contacts/classes` | 200 | 2 |
| Einzelnes Lager | `/rest/stockmanagement/warehouses/106` | 200 | Objekt |
| Einzelne Kategorie | `/rest/categories/2632` | 200 | Objekt |
| Einzelne Eigenschaft | `/rest/properties/2` | 200 | Objekt |
| Einzelne Verfuegbarkeit | `/rest/availabilities/1` | 200 | Objekt |
| Tickets | `/rest/tickets` | 200 | **0** |
| Artikel-Sets | `/rest/item_sets` | 200 | **0** |
| Markt-Einstellungen | `/rest/markets/settings` | 200 | leeres Array |
| **Lager (neuer Pfad)** | **`/rest/warehouses`** | **403** | **Recht `stock.warehouse.show` fehlt** |
| Listings nach Markt | `/rest/listings/markets` | 422 | Pflichtparameter fehlt |
| Log-Eintraege | `/rest/logs/entries` | 400 | Pflichtparameter fehlt |

**Als nicht vorhanden bestaetigt (404):** `/rest/events`, `/rest/event_procedures`,
`/rest/orders/events`, `/rest/procedures`, `/rest/cronjobs`, `/rest/crons`,
`/rest/webhooks`, `/rest/countries`, `/rest/currencies`, `/rest/languages`,
`/rest/returns`, `/rest/bookings`, `/rest/characteristics`, `/rest/manufacturers`
(nur `/rest/items/manufacturers`), `/rest/units` (nur `/rest/items/units`),
`/rest/roles`, `/rest/user/roles`, `/rest/users/128/roles`, `/rest/category_trees`,
`/rest/items/images`, `/rest/items/attribute_values`, `/rest/parcel_service_presets`,
`/rest/webstores/configurations` und weitere.

**Das ist fuer die Ausgangsfrage entscheidend:** Ereignisaktionen
(„Event Procedures") und Cronjobs — also das, was man in PlentyONE ueblicherweise
„Automatisierungen" nennt — **sind ueber diese REST-API nicht abrufbar.** Kein
einziger der geprueften Pfade existiert. Was sich ueber die API feststellen
laesst, sind die Automatisierungen in Teil I: Plugin-Sets, Export-Formate und
Marktplatz-Anbindungen. Ob und welche Ereignisaktionen im Backend eingerichtet
sind, laesst sich **nur im Plenty-Backend selbst** nachsehen, nicht von hier aus.
Das ist ein Ergebnis, keine Luecke im Vorgehen — und es wird hier nicht geraten.

### J1 — Verfuegbarkeiten (10)

| id | Ø Tage | Bezeichnung |
| --- | ---: | --- |
| 1 | 2 | Auf Lager |
| 2 | 7 | Auf Lager, Lieferzeit 5-7 Werktage |
| 3 | 14 | Lieferzeit ca. 2 Wochen |
| 4 | 30 | Lieferzeit ca. 4 Wochen |
| 5 | 60 | Im Zulauf |
| 6 | 90 | Produkt vergriffen, Lieferzeit auf Anfrage |
| 7 | 360 | Artikel derzeit nicht Lieferbar |
| 8 | 1024 | Artikel nicht mehr Lieferbar |
| 9 | null | *(ohne Namen)* |
| 10 | 720 | Auf Anfrage |

Verfuegbarkeit **9 hat weder Namen noch `averageDays`** — eine leere Konfiguration
in einer sonst gepflegten Liste.

### J2 — Kontakt-Typen (6)

id 1–6: Kunde, Interessent (Lead), Handelsvertreter, Lieferant, Hersteller, Partner.
Alle mit `nonErasable = 1`, also Plenty-Standard.

### J3 — Auftrags-Eigenschaftstypen (149)

`GET /rest/orders/properties/types` → HTTP 200, 149 Typen mit `id, isErasable, position, cast, names`.
Das ist die Liste, ueber die an einem Auftrag alles Zusaetzliche haengt. Die
niedrigen ids sind Plenty-Standard (1 Lager, 2 Versandprofil, 3 Zahlungsart,
4 Zahlungsstatus, 7 Externe Auftrags-ID, 8 Kundenzeichen, 9 Mahnstufe,
11–14 Gewicht/Breite/Laenge/Hoehe, 30 Lagerort reserviert, 63 Bevorzugte
Lagerort-ID …). Die 990er und 1000er kommen von Plugins:
992 Handelsvertreter, 993–998 eBay, 1000–1005 DHL Shipping,
1006–1011 DPD Versand Services, 1012–1013 AmazonInboundShipment,
1014–1015 eBay Fulfillment, 1017 Shopify Bestelldatum,
1018–1026 GLS ShipIT, 1027 MRN-Nummer.

Fuer eine Lagerort-Automatisierung sind besonders **id 30 „Lagerort reserviert"**
und **id 63 „Bevorzugte Lagerort-ID"** interessant — ueber die haengt Plenty
Lagerorte an Auftragspositionen.

### J4 — Weitere Feldnamen (ohne Werte)

**Adresse** (`/rest/accounts/addresses`, 132 251 Eintraege — personenbezogen,
darum nur die Schluessel):
`id, gender, name1, name2, name3, name4, address1, address2, address3, address4,
postalCode, town, countryId, stateId, readOnly, checkedAt, createdAt, updatedAt,
title, contactPerson, taxIdNumber, options`

**Hersteller** (`/rest/items/manufacturers`, 4 170):
`id, name, legalName, logo, url, contactUrl, pixmaniaBrandId, neckermannBrandId,
externalName, neckermannAtEpBrandId, street, houseNo, postcode, town, countryId,
phoneNumber, faxNumber, email, laRedouteBrandId, comment, updatedAt, position,
responsibleName, responsibleStreet, responsibleHouseNo, responsiblePostCode,
responsibleTown, responsibleCountry, responsibleEmail, responsibleContactUrl,
responsiblePhoneNo` — die `responsible*`-Felder sind die GPSR-Pflichtangaben.

**Attribut** (`/rest/items/attributes`, 125):
`id, backendName, position, isSurchargePercental, isLinkableToImage,
amazonAttribute, fruugoAttribute, pixmaniaAttribute, ottoAttribute,
googleShoppingAttribute, neckermannAtEpAttribute, typeOfSelectionInOnlineStore,
laRedouteAttribute, isGroupable, updatedAt`

**Umsatzsteuer** (`/rest/vat`, 116):
`id, countryId, taxIdNumber, startedAt, locationId, marginScheme,
isRestrictedToDigitalItems, invalidFrom, createdAt, updatedAt, importThreshold,
economicIdNumber, vatRates`

**Cross-Selling** (`/rest/items/item_cross_selling`, 40 372):
`itemId, crossItemId, relationship, isDynamic, updatedAt, createdAt`

**Artikel-Versandprofil** (`/rest/items/item_shipping_profiles`, 95 338):
`itemId, profileId, id, updated_at`

**Haendlerkonto** (`/rest/accounts`):
`id, number, companyName, taxIdNumber, valuta, discountDays, discountPercent,
timeForPaymentAllowedDays, salesRepresentativeContactId, userId, deliveryTime,
dealerMinOrderValue, createdAt, updatedAt`

### J5 — Ratenlimit der API

Aus den Antwort-Headern jedes Aufrufs:

| Header | Wert |
| --- | --- |
| `x-plenty-global-short-period-limit` | **200** |
| `x-plenty-global-short-period-decay` | **20** (Sekunden) |
| `x-plenty-global-long-period-limit` | **166 000** |
| `x-plenty-global-long-period-decay` | ~29 770 (Sekunden, also gut 8 Stunden) |

**200 Aufrufe je 20-Sekunden-Fenster, 166 000 je 8-Stunden-Fenster.** Wird das
Kurzfenster gerissen, antwortet die API mit **HTTP 429** — und zwar ohne
Vorwarnung mitten in einer Paginierung. Beim ersten Anlauf dieser Inventur sind
genau daran zwei Vollabzuege bei Seite 122 bzw. 116 abgebrochen und haetten
stillschweigend Teilergebnisse geliefert. Nicht jeder Aufruf kostet gleich viel:
manche zaehlen 1, manche 2 vom Kurzfenster ab. Wer hier automatisiert, muss
`x-plenty-global-short-period-calls-left` lesen und pausieren, bevor das Fenster
leer ist.

---

## Teil K — Markierungen (Flags): Name ↔ ID

Gefunden ueber `GET /rest/markings?itemsPerPage=250` → HTTP 200, Array mit **76**
Eintraegen. Der Endpunkt taucht in keiner der bisherigen Proben auf und heisst
weder `/rest/items/flags` noch `/rest/flags` (beide 404).

Aufbau eines Eintrags: `id, markId, name, icon, text, type`.

- **`markId`** ist der Wert, der am Artikel in `flagOne` bzw. `flagTwo` steht.
- **`text`** ist die im Backend selbst vergebene Beschriftung.
- `name`/`icon` sind das Symbol (z. B. `flag_black.png`).
- `type` trennt die drei Kataloge: `item_one` (Markierung 1 am Artikel, 31 + „ohne"),
  `item_two` (Markierung 2 am Artikel, 11 + „ohne"), `order` (Markierung am Auftrag, 31 + „ohne").

**Achtung beim Verwechseln:** `id` und `markId` sind **nicht** dasselbe. Fuer
`item_one` laufen sie zufaellig gleich (id 27 ↔ markId 27), fuer `item_two`
und `order` nicht (id 33 ↔ markId 1, id 45 ↔ markId 1). Wer die Markierung
setzen oder filtern will, braucht **`markId`**, nicht `id`.

### K1 — Markierung 1 (`flagOne`, `type = item_one`)

Belegung aus dem Artikel-Vollabzug (58 667 Artikel) und gegengeprueft ueber den
Serverfilter `GET /rest/items?flagOne=<markId>`:

| markId | Beschriftung (`text`) | Symbol | Artikel |
| ---: | --- | --- | ---: |
| 18 | Import fertig | ledgrey | 16 116 |
| 0 | *(ohne Markierung)* | — | 13 790 |
| 24 | Offline Klempner | weather_rain | 8 475 |
| 2 | Preisrecherche IND | star | 6 439 |
| 26 | Inventur | weather_sun | 6 395 |
| 20 | Artikel vorhanden | ledblack | 3 575 |
| 16 | Import | ledgreen | 1 636 |
| **27** | **Maschinensucher** | **flag_black** | **670** |
| 6 | „Inv." + *(Vorname)* | bombred | 519 |
| 15 | *(Vorname)* + „Artikel vorhanden" | leddarkblue | 320 |
| 9 | SEG | ledyellow | 204 |
| 1 | Artikel kontrollieren | alarm | 120 |
| 12 | Im Zulauf | ledred | 101 |
| 25 | *(unbenannt, `text` = „25")* | weather_snow | 84 |
| 4 | „Check" + *(Vorname)* | help | 41 |
| 14 | *(Vorname)* | ledblue | 39 |
| 19 | Export | leddarkred | 35 |
| 22 | *(unbenannt, `text` = „22")* | weather_cloudy | 34 |
| 17 | MRT | leddarkgreen | 33 |
| 3 | *(unbenannt, `text` = „3")* | lock | 9 |
| 11 | M/S | ledpink | 9 |
| 13 | Ebay Kleinanzeigen | ledpurple | 8 |
| 31 | Abholschein gedruckt | flag_yellow | 7 |
| 7 | Demontage | bombgreen | 4 |
| 8 | Angebot Nachgefragt | bombblack | 4 |
| 5 | Selbstabholung | warning | 0 |
| 10 | BVA Ware | ledorange | 0 |
| 21 | Paketschein test | weather_clouds | 0 |
| 23 | Spedition | weather_lightning | 0 |
| 28 | Packliste gedruckt | flag_blue | 0 |
| 29 | Rechnung Gedruckt | flag_green | 0 |
| 30 | Lieferschein Gedruckt | flag_red | 0 |

> **Zu den Beschriftungen:** wo eine Markierung auf einen Mitarbeiternamen
> beschriftet ist, steht hier *(Vorname)* statt des Namens — dieselbe Regel wie
> bei Markierung 2 in K2. Alle sachlichen Beschriftungen stehen im Klartext.
> Die vollstaendigen Texte liefert `GET /rest/markings`.

### K2 — Markierung 2 (`flagTwo`, `type = item_two`)

11 Markierungen plus „ohne". **Jede einzelne ist auf einen Mitarbeiternamen
beschriftet** (Symbole `user_*`). Markierung 2 wird in diesem Mandanten also als
Zustaendigkeits-Kennzeichen benutzt, nicht als Sachmerkmal.

Die Namen selbst stehen hier bewusst **nicht** — es sind personenbezogene Daten.
Die Zuordnung markId → Person steht im Backend unter Einstellungen ▸ Artikel ▸
Markierungen und ist ueber `GET /rest/markings` mit `type = item_two` abrufbar.

Belegung aus dem Vollabzug: `flagTwo` 0 = 37 181, 6 = 5 040, 2 = 4 036,
3 = 3 053, 4 = 2 951, 1 = 2 434, 7 = 2 229, 11 = 705, dazu vier weitere < 700.
Also **21 486 Artikel (36,6 %) sind einer Person zugeordnet**, 37 181 nicht.

### K3 — Markierung am Auftrag (`type = order`)

31 Markierungen plus „ohne" — **alle unbenannt**: das Feld `text` enthaelt
lediglich die Zahl als Zeichenkette („1", „2", … „31"). Der Auftrags-Markierungs-
Katalog ist also unbenutzt, waehrend der Artikel-Katalog durchgepflegt ist.

### K4 — Was daran fuer die Automatisierung zaehlt

1. **`GET /rest/items?flagOne=<markId>` funktioniert als Serverfilter.**
   Gegenprobe: `flagOne=27` → `totalsCount` = 670, `flagOne=26` → 6 395,
   `flagOne=99` → 0. Man muss also nicht alle 58 667 Artikel ziehen, um eine
   Markierung auszuwerten.
2. **Die Beschriftungen sind Prozessmarker, keine Sachmerkmale.** „Import fertig"
   (16 116), „Inventur" (6 395), „Preisrecherche IND" (6 439), „Offline Klempner"
   (8 475), „Maschinensucher" (670) — das ist ein Workflow-Status, der im
   Artikelstamm abgelegt wird. Dasselbe Muster wie bei den Kategorien aus Teil H
   („trademaschines", „Machinio", „Neu eingetroffen") und bei den Tags aus Teil I5
   („1x/2x/3x nachgefasst", „in Arbeit"). **Drei getrennte Mechanismen tragen
   denselben Zweck**, und keiner davon ist dafuer gedacht.
3. **Vier Markierungen sind vergeben, aber unbenannt** (markId 3, 22, 25 und der
   Sonderfall 0): ihr `text` ist nur die eigene Nummer. Zusammen betreffen sie
   127 Artikel, deren Markierung niemand mehr deuten kann.
4. **Acht benannte Markierungen sind auf keinem einzigen Artikel gesetzt**
   (markId 5, 10, 21, 23, 28, 29, 30 — dazu 31 mit nur 7). Auffaellig darunter:
   „Packliste gedruckt", „Rechnung Gedruckt", „Lieferschein Gedruckt" — drei
   Druckstatus, die offenbar eingerichtet, aber nie benutzt wurden.
5. **`id` ≠ `markId`.** Fuer `item_two` und `order` weichen sie um 32 bzw. 44 ab.
   Wer `id` aus `/rest/markings` in `flagOne`/`flagTwo` schreibt, setzt die
   falsche Markierung.

---

## Zusammenfassung

- **Erreichbar:** 25 von 36 Bereichen in Teil A (HTTP 200). Mit den Nachtraegen
  aus Teil A kommen `/rest/orders/statuses` und `/rest/item_sets` hinzu: **27**.
  Ueber die breite Suche in Teil J kommen **rund 20 weitere** erreichbare
  Bereiche dazu, darunter Plugin-Sets, Exporte, Tags, Marktplatz-Zugaenge,
  Cross-Selling, Artikel-Versandprofile und die 149 Auftrags-Eigenschaftstypen.
- **Ohne Recht (403):** **genau einer** — `/rest/warehouses`, fehlendes Recht
  `stock.warehouse.show`. Derselbe Inhalt ist ueber
  `/rest/stockmanagement/warehouses` mit HTTP 200 erreichbar.
- **Nicht vorhanden (404):** 10 aus Teil A — `/rest/orders/status`,
  `/rest/orders/types`, `/rest/orders/shipping/serviceProviders`,
  `/rest/items/item_sets`, `/rest/redistributions`, `/rest/reorders`,
  `/rest/stockmanagement/buffer`, `/rest/stockmanagement/stock/movements`,
  `/rest/markets/orders/referrers`, `/rest/roles`. Zwei davon existieren unter
  anderem Namen (siehe Nachtrag), acht gar nicht.
- **Fehler (500):** 1 — `/rest/plugins` (`Too few arguments to function
  PluginController::listAllPlugins()`).

### Auffaelligkeiten

1. **`itemsPerPage` wird bei den Lagerort-Endpunkten ignoriert.**
   `/rest/warehouses/106/locations?itemsPerPage=250` liefert trotzdem 100 Zeilen
   je Seite und meldet `lastPageNumber = 135`. Wer `itemsPerPage` vertraut und
   bei Seite 54 aufhoert, bekommt 8 000 statt 13 409 Lagerorte und merkt nichts —
   `totalsCount` stimmt naemlich. Immer bis `lastPageNumber` durchlaufen und
   gegen `totalsCount` pruefen.

2. **Der `?type=`-Filter auf `/rest/orders/documents` ist wirkungslos.**
   Jeder Wert, auch ein erfundener, liefert `totalsCount = 141 220`. Eine
   Auszaehlung je Belegart ueber diesen Filter ist schlicht falsch. `?orderId=`
   funktioniert dagegen.

3. **`/rest/payments` liefert ein blankes Array ohne `totalsCount`** — anders als
   fast alle anderen Listen-Endpunkte. Code, der generisch `totalsCount` liest,
   bekommt `undefined`. Dasselbe gilt fuer `/rest/stockmanagement/warehouses`,
   `/rest/orders/referrers`, `/rest/payments/methods`, `/rest/orders/shipping/presets`
   und `/rest/webstores`: alle sechs sind Arrays, keine `entries`-Objekte.
   Ein `daten.entries ?? daten` greift hier ins Leere, weil `Array.prototype.entries`
   existiert — genau darueber ist der erste Lauf dieser Inventur gestolpert.

4. **`?with=names,groups` auf `/rest/properties` wirft HTTP 500.** Der Endpunkt
   liefert Namen, Gruppen und Optionen ohnehin von selbst mit. `with` also weglassen.

5. **`statusId` und `referrerId` sind Dezimal-Strings, keine Zahlen** (`"5.7"`,
   `"2.08"`, `"0.00"`). Wer sie durch `parseInt` schickt, macht aus Status 5.7
   („Wird kommissioniert") den Status 5 („Freigabe Versand") und aus eBay Germany
   („2.08") Ebay allgemein („2.00"). Als String vergleichen.

6. **Zwei genutzte Auftragsherkuenfte haben keinen Namen.** `referrerId` 15.00 und
   16.00 tragen in `/rest/orders/referrers` einen leeren `backendName`, haben in
   den letzten 30 Tagen aber 5 bzw. 1 Auftrag gebracht. Ein Bericht „Auftraege je
   Kanal" hat hier zwangslaeufig eine namenlose Zeile.

7. **Doppelte Wurzelkategorie.** „Elektronik & Elektrotechnik" existiert zweimal
   als Wurzel: `id = 81` und `id = 2476`, beide mit Unterkategorien. Daneben
   `895 Industriebedarf` und `2478 Industriebedarf Neu` — kein exaktes Duplikat,
   aber dieselbe Absicht. Insgesamt tragen **144 Kategorienamen mehrfach**
   denselben Namen, angefuehrt von „Sonstiges" (53×) und „Zubehör" (26×).
   Eine Kategorie ueber ihren Namen zu suchen, ist auf diesem System unsicher —
   nur „Projekte" (2632) ist eindeutig.

8. **Testkategorien stehen im Live-Baum.** Auf Wurzelebene liegen `2246 Dummy`,
   `2248 Import/Export-Test`, `2686` (Testkategorie auf einen Vornamen benannt),
   `1543 Suchergebnis` und
   `1558 Import (nicht löschen!)`.

9. **Die Halle-Ebene ist nicht durchgehend numerisch.** Neben H1–H9 gibt es
   `HWagen` (100 Lagerorte) und `HOF` (1). Ein Parser auf `H(\d+)` verliert 101
   Lagerorte. Umgekehrt ist die Namensqualitaet sonst tadellos: **kein** Lagerort
   ohne `label`, **keiner** ohne `fullLabel`, **kein** doppeltes `fullLabel`, und
   alle 13 409 passen auf das Muster `H…/R…/E… F…-…`.

10. **Die Lagerort-Struktur ist voellig unbalanciert.** H1 haelt 4 566 Lagerorte,
    H9 genau einen, HOF genau einen, H7 und H8 je fuenf. Wer ueber Hallen
    parallelisiert, bekommt einen Worker mit einem Drittel der Arbeit und zwei,
    die nach einer Zeile fertig sind.

11. **Alle 13 409 Lagerorte haben `statusKey = active`.** Es gibt keinen
    gesperrten oder inaktiven Lagerort. Code, der auf `statusKey` verzweigt,
    hat auf diesem System nur einen Zweig — und damit einen ungetesteten.

12. **Die Dimensions-`id` folgt nicht der Hierarchie.** Halle=9, Regal=10,
    Ebene=11, aber Feld=**7**. Nach `id` sortieren kehrt die unterste Stufe nach
    oben. Es gilt `level`.

13. **Der Mandant ist p14443/besttra.de, das Geschaeft laeuft aber woanders.**
    828 von 877 Auftraegen der letzten 30 Tage tragen `plentyId = 14616`
    („Komplett Konzept"), nur 41 die 14443. Jede Auswertung, die stillschweigend
    den Hauptmandanten annimmt, misst das Falsche.

14. **Ein Lager ohne Bestand, sechs ohne Struktur.** `107 FBA` hat 0 Bestandszeilen.
    Sechs der neun Lager haben weder Dimensionen noch Lagerorte — sie antworten
    auf die Lagerort-Endpunkte mit HTTP 200 und einer leeren Liste, nicht mit 404.
    `110 Borken I` und `111 Borken II` haben je 2 Dimensionen und genau **einen**
    Lagerort: angefangen und liegengelassen.

15. **39 von 58 Auftragsstatus sind tot**, darunter die komplette 19er-Reihe
    (Offen/Bestellt/Bestätigt/Teilweise geliefert/…) und Reparatur (12),
    Sammelauftrag (13), Sammelgutschrift (14). Wer eine Statusliste in eine
    Oberflaeche haengt, zeigt zu zwei Dritteln Auswahlmoeglichkeiten, die seit
    mindestens 30 Tagen niemand benutzt.

16. **334 von 340 Auftragsherkuenften sind ungenutzt.** Angebunden sind laut
    `origin` u. a. Shopify, Octopia, ABOUT YOU in 12 Laendern, Limango, Bauhaus
    und drei Apotheken-Plattformen — Auftraege kamen davon in 30 Tagen keine.

17. **`/rest/plugins` ist nicht abrufbar** (HTTP 500, fehlendes Argument). Ob
    Plugins abgelaufen sind, laesst sich ueber die API also nicht pruefen — die
    Frage aus dem Fragenkatalog bleibt offen.

18. **Der API-Zugang ist ein normaler Backend-Benutzer**, kein dedizierter
    REST-Benutzer: `userType = backend`, `loginType = legacy`, `plenty_api = 0`,
    `user_role_id = null`. Er sieht alles (kein einziger 403), auch
    `/rest/accounts/contacts` mit 60 380 Kontakten samt Klarnamen, E-Mail und
    Telefonnummer. Fuer eine Automatisierung, die nur Artikel und Lagerorte
    braucht, ist das deutlich mehr Zugriff als noetig.

19. **`/rest/items` hat 20 Freitextfelder** `free1`–`free20`. Ob und wofuer sie
    belegt sind, wurde hier nicht ausgezaehlt — erfahrungsgemaess haengt an
    solchen Feldern stillschweigend Logik.

20. **Die Zahlen bewegen sich waehrend der Messung.** Der Bestand kam in zwei
    Aufrufen weniger Minuten Abstand einmal als 67 242 und einmal als 67 240
    zurueck. Fuer Abgleiche heisst das: eine Differenz im Promillebereich ist
    kein Fehler, sondern Betrieb.

21. **Die Freitextfelder sind eine Attrappe.** `free14` und `free15` sind zu 92 %
    „belegt" — aber 53 976 bzw. 53 899 dieser Werte sind die Zeichenkette `"0"`.
    Sechs Felder (free8, free9, free12, free13, free19, free20) enthalten
    ausschliesslich `"0"`, zwei (free2, free6) sind komplett leer. Jede Auswertung,
    die „Feld nicht leer" als „gepflegt" liest, misst hier Luft.

22. **Der Lagerort steht zweimal im System.** `free1` (179 Artikel) und `free4`
    (4 Artikel) enthalten Lagerorte als Prosa — „Borken" (50×), „Halle 2 Regal 4
    Platz B 5-6", „H2R3B1", „a31012013_1_burlo" — parallel zur echten
    Lagerort-Struktur mit 13 409 gepflegten Lagerorten aus Teil B6. Zwei
    Wahrheiten ueber denselben Sachverhalt, in unterschiedlicher Schreibweise.

23. **`free7` fuehrt den Artikelzustand in 28 Schreibweisen:** „Neu", „neu",
    „Gebraucht", „gebraucht", „Gebraucht, sehr gut.", „Vom Verkäufer
    generalüberholt" … Dabei hat Plenty dafuer die Felder `condition` und
    `conditionApi`, die ebenfalls belegt sind. Drei konkurrierende Quellen fuer
    dieselbe Information.

24. **Nur 6 von 58 667 Artikeln haben eine Zolltarifnummer** (0,01 %) — bei einem
    Mandanten, der nach Teil D2 an ABOUT YOU in 12 Laendern und an drei
    Apotheken-Plattformen angebunden ist und Status „[6.7] Export" sowie
    „Gelangensbestätigung" pflegt.

25. **Der API-Benutzer ist bei 8 626 Artikeln als `ownerId` eingetragen.** Der
    Zugang, den wir hier nur lesend benutzen, hat in der Vergangenheit Artikel
    angelegt. Wer die Rechte einschraenken will, sollte das vorher wissen.

26. **605 von 1 242 Kategorien sind leer** (48,7 %), und **10 271 Varianten
    (17 %) haengen in gar keiner Kategorie.** Ein Kategoriebaum, der zur Haelfte
    aus Attrappen besteht.

27. **„Dummy" ist die drittgroesste Kategorie des Systems.** Kategorie 2246
    haelt **3 087 Varianten**, die Papierkorb-Kategorie 894 („Alte Artikel -
    Nicht mehr auf Lager") weitere 1 175. Zusammen 7 % des Sortiments in
    Kategorien, die sich selbst als Ablage bezeichnen. Dazu passt Tag 19
    „Dummy API Artikel".

28. **Kategorien werden als Prozessmarker missbraucht.** „trademaschines" (578),
    „Machinio" (473), „Neu eingetroffen" (452) sind keine Warengruppen, sondern
    Ausspiel- und Workflow-Kennzeichen im selben Baum wie der echte Katalog.

29. **Der Pflegestand der Varianten ist duenn, wo es zaehlt.** Von 60 438
    Varianten haben nur **575 einen Einkaufspreis > 0** (1,0 %) und nur
    **1 140 vollstaendige Masse** (1,9 %). Gewicht immerhin 18 540 (30,7 %).
    Jede Kalkulation oder Versandkostenberechnung ueber den Gesamtbestand
    laeuft auf fast leeren Feldern.

30. **18,8 % der Varianten haben keinen Barcode**, und von 18 konfigurierten
    Barcode-Arten sind nur 7 je benutzt worden. 47 112 der 54 436 vergebenen
    Barcodes haengen an `id 2` — was `EAN13_2` aus dem Projektcode jetzt auch
    empirisch bestaetigt.

31. **10 892 Varianten sind inaktiv** (18,0 %) und **11 231 stehen auf
    „Artikel nicht mehr Lieferbar"** (`availability = 8`, 18,6 %). Fast ein
    Fuenftel des Stamms ist totes Material, das in jeder Vollabfrage mitlaeuft.

32. **Ereignisaktionen und Cronjobs sind ueber diese API nicht abrufbar.**
    Weder `/rest/events` noch `/rest/event_procedures`, `/rest/procedures`,
    `/rest/cronjobs` oder `/rest/webhooks` existieren (alle 404). Was in
    PlentyONE ueblicherweise „Automatisierung" heisst, laesst sich von hier
    aus **nicht** inventarisieren — nur Plugin-Sets, Exporte und
    Marktplatz-Anbindungen (Teil I). Das ist ein Ergebnis, kein Versaeumnis.

33. **Kein Export-Format hat ein Aktiv-Kennzeichen.** Die 45 Elastic-Exporte
    liefern `id, name, type, limit, formatKey, outputType, generateCache` —
    aber kein „enabled". Ob ein Export laeuft, ist ueber die API nicht
    feststellbar. Die aeltesten wurden zuletzt **2018** geaendert (id 1, 2, 3,
    5, 6), der juengste gestern (id 54, 2026-09-21). Mindestens sechs tragen
    „Test" im Namen, und id 46 und 47 heissen beide „Hoppe Bestandsliste".

34. **6 von 16 Plugin-Sets sind abgeschaltet, und 10 der 16 haengen an keinem
    Webshop.** Es gibt kein installiertes, aber deaktiviertes Plugin — ein
    Plugin ist entweder im Set und produktiv aktiv oder gar nicht vorhanden.
    Zwei Sets („LTS 5.0.63 … DEV" und „… DEV Backup") sind seit November 2024
    unberuehrt, ein aktives Set ist ein Testset auf einen Vornamen benannt.

35. **Die API hat ein hartes Ratenlimit: 200 Aufrufe je 20 Sekunden.** Es
    antwortet mit HTTP 429 mitten in der Paginierung. Beim ersten Anlauf dieser
    Inventur sind daran zwei Vollabzuege bei Seite 122 bzw. 116 abgebrochen —
    sie haetten stillschweigend Teilergebnisse geliefert. Die Header
    `x-plenty-global-short-period-calls-left` und `-decay` muessen gelesen
    werden; nicht jeder Aufruf kostet gleich viel (mal 1, mal 2).

36. **Verfuegbarkeit id 9 hat weder Namen noch `averageDays`** — eine leere
    Zeile in einer sonst vollstaendig gepflegten Liste von 10.

37. **12 der 23 Marktplatz-Zugaenge sind eBay-Zugaenge**, dazu 6 Kaufland,
    2 Rakuten, je 1 Hood, Otto und Shopify. Das deckt sich mit Teil D2, wo eBay
    Germany 571 der 877 Auftraege der letzten 30 Tage bringt — aber nicht mit
    den 340 konfigurierten Herkuenften, von denen nur 6 Auftraege liefern.

38. **Markierungen, Kategorien und Tags tun dasselbe.** „Import fertig" (16 116
    Artikel), „Inventur" (6 395), „Maschinensucher" (670) stehen als Markierung 1
    im Artikelstamm; „trademaschines", „Machinio", „Neu eingetroffen" stehen als
    Kategorie im Warenbaum; „1x/2x/3x nachgefasst" und „in Arbeit" stehen als Tag.
    Drei Mechanismen fuer denselben Zweck — Workflow-Status — und keiner davon ist
    dafuer vorgesehen. Wer automatisiert, muss alle drei lesen.

39. **Markierung 2 ist eine Mitarbeiterliste.** Alle 11 Beschriftungen sind
    Personennamen; 21 486 Artikel (36,6 %) tragen eine. Das ist eine
    Zustaendigkeitszuordnung im Artikelstamm — und personenbezogen.

40. **Der Auftrags-Markierungskatalog ist unbenutzt.** Alle 31 Eintraege mit
    `type = order` tragen als Beschriftung nur ihre eigene Nummer, waehrend der
    Artikel-Katalog durchgepflegt ist.

41. **In `/rest/markings` ist `id` nicht `markId`.** Bei `item_one` stimmen sie
    zufaellig ueberein, bei `item_two` und `order` nicht (id 33 ↔ markId 1).
    In `flagOne`/`flagTwo` gehoert `markId`. Die zufaellige Uebereinstimmung bei
    `item_one` ist die gefaehrlichste Art von Falle: sie laesst falschen Code
    beim Testen funktionieren.

42. **Vier gesetzte Markierungen sind unbenannt** (markId 3, 22, 25 mit zusammen
    127 Artikeln) und **sieben benannte sind auf keinem Artikel gesetzt**,
    darunter „Packliste gedruckt", „Rechnung Gedruckt" und „Lieferschein
    Gedruckt".

---

*Erhoben am 2026-09-22, ausschliesslich mit GET-Aufrufen; der einzige
schreibende Aufruf war `POST /rest/login`. Vollabzuege: 587 Seiten Artikel
(58 667), 605 Seiten Varianten (60 438), 135 Seiten Lagerorte (13 409),
77 Seiten Struktur-Knoten (7 636), 25 Seiten Kategorien (1 242) — jeweils
vollstaendig, nicht gesampelt. Es wurden keine personenbezogenen Daten
uebernommen: bei Auftraegen, Kontakten, Adressen und Zahlungen stehen hier nur
Anzahlen, Feldnamen und Statuswerte, und bei den Marktplatz-Zugaengen nur die
Anzahl je Markt, kein einziger Wert aus dem Feld `data`.*
