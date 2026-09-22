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

**Kein einziger Bereich antwortet mit 403.** Die Liste der fehlenden Rechte ist
leer — alles, was in diesem Mandanten existiert, ist fuer den Benutzer `kheyo`
(Benutzer-ID 128) auch lesbar. Jeder Fehlschlag in Teil A ist ein 404
(Endpunkt existiert nicht) oder der eine 500 bei `/rest/plugins`.

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

## Zusammenfassung

- **Erreichbar:** 25 von 36 Bereichen in Teil A (HTTP 200). Mit den Nachtraegen
  aus Teil A kommen `/rest/orders/statuses` und `/rest/item_sets` hinzu: **27**.
- **Ohne Recht (403):** **keine.** Die Liste ist leer.
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

---

*Erhoben am 2026-09-22, ausschliesslich mit GET-Aufrufen; der einzige
schreibende Aufruf war `POST /rest/login`. Es wurden keine personenbezogenen
Daten uebernommen — bei Auftraegen, Kontakten und Zahlungen stehen hier nur
Anzahlen, Feldnamen und Statuswerte.*
