# PlentyONE — Landkarte

Was wir von PlentyONE benutzen, wo es im Code steht, welches Feld wohin geht —
und was Plenty darüber hinaus kann.

**Woher die Angaben stammen.** Abschnitte 1–7 sind aus diesem Repository gelesen,
Datei für Datei, mit Zeilenangaben. Abschnitt 8 stand zunächst nur als
Erfahrungswissen da — inzwischen ist im System selbst nachgesehen worden. Das
Ergebnis steht vollständig in [`PLENTY-INVENTUR.md`](PLENTY-INVENTUR.md)
(erhoben am 22.09.2026, 36 Bereiche, ausschließlich lesend); hier stehen nur die
Schlüsse daraus.

Mandant: **plentyId 14443**, Shop `besttra.de`, REST-Basis
`https://p14443.my.plentysystems.com` (ohne `/rest`).

**Achtung bei der plentyId:** Der Mandant heißt zwar 14443, aber **94 % der
Aufträge laufen unter plentyId 14616 („Komplett Konzept")** — in den letzten 30
Tagen 828 von 877, gegenüber 41 auf 14443. Jede Auswertung, die stillschweigend
den Hauptmandanten annimmt, misst ein Zwanzigstel des Geschäfts.

---

## 1. Auf einen Blick

| Plenty-Bereich | Nutzen wir? | Wofür |
| --- | --- | --- |
| Authentication (`/rest/login`) | **ja** | jeder Aufruf, Token modulweit gecached |
| Item / Variation | **ja** | Artikel anlegen, suchen, Texte lesen und schreiben |
| Category | **ja** | Projekt-Kategoriebaum „Projekte → Firma Ort → Firma Ort Datum" |
| Barcode (variation_barcodes) | **ja** | intern erzeugte EAN-13 an die Hauptvariante |
| Property (relations + values) | **ja** | nur für eine Sache: Rechnung als Datei an „Dokument 1" |
| Item images | **ja** | nur lesend, als Wiedererkennungshilfe in der Suche |
| Stock management (stock, movements, storageLocations) | **ja** | Bestands-Scan, Suche, Mengenermittlung |
| Warehouse / Locations / Levels / Dimensions | **ja, intensiv** | Lagerorte lesen, anlegen, aufräumen, Laufweg ordnen |
| Stock redistribute | **ja** | Artikel auf einen Lagerplatz umbuchen |
| Plentys interne `ui.php` (kein REST) | **ja** | Datei-Upload, weil REST dafür keinen Weg bietet |
| Order | **nein** | — kein einziger Aufruf im Repo, dabei liegen dort **63.038 Aufträge** |
| Payment / Shipping / Document | **nein** | — |
| Contact / Adressen (CRM) | **nein** | 60.380 Kontakte — der Zugang darf sie lesen, obwohl er es nicht müsste |
| Sales price | **nein** | 29 Preislisten vorhanden; Preisregeln existieren nur als Text (`lib/listing/markenregeln.ts`) |
| Listing / Markets / Webstore | **nein** | — |
| Plugin / Cron / Log / System | **nein** | — |
| User / Rechte | **nein** | wird im Backend von Hand gepflegt |
| Attribute, Hersteller, Einheiten, Item-Sets | **nein** | `unitId: 1` = Stück, bestätigt. Item-Sets: **0 im Mandanten** |

Kurz: Wir benutzen Plenty heute als **Artikel- und Lagerortverwaltung**. Die
gesamte kaufmännische Seite — Aufträge, Zahlungen, Versand, Belege, Kunden —
ist unberührt.

---

## 2. Zugang und Konfiguration

### Anmeldung

`POST /rest/login` mit `{ username, password }` → `access_token`, `expires_in`,
`user_id`. Der Token wird modulweit gecached und 60 Sekunden vor Ablauf erneuert
(`lib/plenty/client.ts:118`). Die `user_id` wird mitgemerkt, weil der Datei-Upload
über `ui.php` sie als `meta.id` verlangt.

Bei fehlenden Rechten wird der Token einmal verworfen und frisch angemeldet — ein
gecachter Token trägt bis zu einer Stunde noch die alten Rechte, frisch vergebene
Rechte griffen sonst erst verzögert (`client.ts:725`, `client.ts:789`).

### Woher die Zugangsdaten kommen

Rangfolge, absichtlich so herum (`lib/einstellungen/plenty.ts`):

```
Datenbank (Tabelle einstellungen, Oberfläche /einstellungen)   schlägt
Umgebungsvariablen (Vercel/.env)
```

Wer in der Oberfläche etwas einträgt, will etwas ändern — sonst hätte er es
gelassen. Ein **halb** ausgefüllter Datensatz verdrängt die Umgebung nicht, damit
ein funktionierender Zugang nicht durch eine unvollständige Eingabe ausfällt. Das
Passwort liegt AES-256-GCM-verschlüsselt (`lib/einstellungen/tresor.ts`,
Schlüssel `EINSTELLUNGEN_SCHLUESSEL`, ersatzweise `SUPABASE_SERVICE_ROLE_KEY`).
Zwischenspeicher: 10 Sekunden, damit ein Lauf über hunderte Artikel nicht
hunderte Datenbankabfragen kostet.

### Umgebungsvariablen

Die Spalte „Wert" ist im System nachgesehen (22.09.2026) — sie muss nicht mehr
gesucht werden.

| Variable | Bedeutung | Wert in diesem Mandanten | Ohne sie |
| --- | --- | --- | --- |
| `PLENTY_BASE_URL` | REST-Basis, ein angehängtes `/rest` wird abgeschnitten | `https://p14443.my.plentysystems.com` | kein Sync, App läuft weiter |
| `PLENTY_USER`, `PLENTY_PASSWORD` | REST-Zugangsdaten | — | wie oben |
| `PLENTY_ID` | plentyId (Mandant) | `14443` (aber siehe Hinweis oben: das Geschäft läuft auf 14616) | Kategorien landen unter Mandant 0 |
| `PLENTY_WAREHOUSE_ID` | Lager für die Lagerwerkzeuge | **`106`** (Burlo — 61.114 der 67.240 Bestandszeilen, einziges Lager mit Lagerort-Struktur) | erstes gemeldetes Lager |
| `PLENTY_PROJEKTE_CATEGORY_ID` | Elternkategorie „Projekte" | **`2632`** (eindeutig, 8 Unterkategorien, 95 Varianten) | Projekt-Sync bricht mit Fehler ab |
| `PLENTY_EAN_BARCODE_ID` | Barcode-Konfiguration | **`2`** („EAN_13 2", Typ `GTIN_13`) | EAN wird erzeugt, aber nicht angehängt |
| `PLENTY_EAN_PREFIX` | 2-stelliger Präfix, Standard `20` | `20` | — |
| `PLENTY_INVOICE_PROPERTY_ID` | Eigenschaft vom Typ Datei | **`9`** („Dokument 1", `cast: file`; 10–12 sind „Dokument 2–4") | Rechnung wird nicht angehängt |
| `PLENTY_INVOICE_PROPERTY_NAME` | nur für Fehlermeldungen | `Dokument 1` | — |
| `PLENTY_UI_UPLOAD` | `0` schaltet den `ui.php`-Upload ab | — | — |

Ebenfalls bestätigt: Die im Code fest verdrahtete **`unitId: 1`** ist „Stück"
(`C62`) — korrekt, keine Korrektur nötig.

### Werkzeuge im Code

| Funktion | Datei | Zweck |
| --- | --- | --- |
| `plentyGet` / `plentyPost` / `plentyPut` / `plentyDelete` | `client.ts:891–972` | Bearer-Token, JSON, Fehlertexte |
| `plentyToken` | `client.ts:974` | roher Token für Sonderfälle (multipart, Query-Tricks) |
| `aktuelleConfig` | `client.ts:92` | Einstellungen über Umgebung gelegt |
| `testPlentyConnection` | `client.ts:827` | Verbindungstest, auch für ungespeicherte Eingaben |
| `scripts/plenty.mjs` | — | derselbe Zugang von der Kommandozeile |

---

## 3. Alle genutzten Endpunkte

Vollständig, aus dem Code erhoben. „Schreibt" bedeutet: verändert Daten in Plenty.

### Anmeldung

| Methode | Pfad | Wo | Zweck | Schreibt |
| --- | --- | --- | --- | --- |
| POST | `/rest/login` | `client.ts:122`, `client.ts:848`, `scripts/plenty.mjs` | Token holen | nein |

### Kategorien

| Methode | Pfad | Wo | Zweck | Schreibt |
| --- | --- | --- | --- | --- |
| GET | `/rest/categories?type=item&parentCategoryId={id}&itemsPerPage=50&page=n` | `client.ts:222` | vorhandene Unterkategorie finden (seitenweise, Eltern-Guard) | nein |
| POST | `/rest/categories` | `client.ts:264` | Unterkategorie anlegen — **Body ist ein Array** | **ja** |

### Artikel und Varianten

| Methode | Pfad | Wo | Zweck | Schreibt |
| --- | --- | --- | --- | --- |
| POST | `/rest/items` | `client.ts:316/325` | Artikel mit Hauptvariante anlegen | **ja** |
| POST | `/rest/items/{itemId}/variations/{variationId}/descriptions` | `client.ts:343` | Name + Beschreibung setzen (`lang: de`) | **ja** |
| POST | `/rest/items/{itemId}/variations/{variationId}/variation_barcodes` | `client.ts:600` | EAN-13 anhängen | **ja** |
| GET | `/rest/items/{itemId}/variations/{variationId}?with=properties` | `client.ts:369` | Property-Relations der Variante lesen | nein |
| GET | `/rest/items/variations?...` | `suche.ts`, `lagerplatz-scan.ts`, `zuweisung.ts`, `erfassung/treffer.ts` | **der meistgenutzte Endpunkt** — Filter: `id`, `itemId`, `numberExact`, `barcode`, `name`, `itemName`; `with=item,variationDescription` | nein |
| GET | `/rest/items/{itemId}/variations/{variationId}/descriptions` | `suche.ts:503`, `lagerplatz-scan.ts:297` | Texte einzeln nachladen | nein |
| GET | `/rest/items/{itemId}/images` | `suche.ts:488` | Bild für die Trefferkarte | nein |
| GET | `/rest/items/{itemId}/variations/{variationId}/images` | `suche.ts:492` | Ersatz, falls der Artikel keins hat | nein |
| GET | `/rest/items?name=...` | `suche.ts:572` | letzter Rückfallfilter bei der Namenssuche | nein |

### Eigenschaften (nur für die Rechnungsdatei)

| Methode | Pfad | Wo | Zweck | Schreibt |
| --- | --- | --- | --- | --- |
| POST | `/rest/properties/relations` | `client.ts:492` | Eigenschaft mit der Variante verknüpfen | **ja** |
| POST | `/rest/properties/relations/values` | `client.ts:428` | Dateiwert `"<relationId>/<datei>"` setzen | **ja** |
| DELETE | `/rest/properties/relations/values/{id}` | `client.ts:455` | falsche Werte (volle S3-URLs) wegräumen | **ja** |

### Bestand

| Methode | Pfad | Wo | Zweck | Schreibt |
| --- | --- | --- | --- | --- |
| GET | `/rest/stockmanagement/stock?itemsPerPage&page` | `lagerplatz-scan.ts:415` | **Treiber des Lagerplatz-Scans** — nur was im Lager liegt | nein |
| GET | `/rest/stockmanagement/warehouses?itemsPerPage=250` | `lagerorte.ts:49`, `lagerplatz-scan.ts:319` | Lagerliste und -namen | nein |
| GET | `/rest/stockmanagement/warehouses/{id}/stock/storageLocations?variationId=` | `suche.ts:434`, `zuweisung.ts:135` | wo liegt die Variante, mit welcher Menge | nein |
| GET | `/rest/stockmanagement/warehouses/{id}/stock/movements` bzw. `/rest/stockmanagement/stock/movements?warehouseId=` | `suche.ts:529` | Warenbewegungen (zwei Schreibweisen, je nach Ausbaustufe) | nein |
| PUT | `/rest/items/{itemId}/variations/{variationId}/stock/redistribute?itemId=` | `zuweisung.ts:155` | **die einzige Bestandsbuchung, die wir machen** | **ja** |

### Lager, Lagerorte, Struktur

| Methode | Pfad | Wo | Zweck | Schreibt |
| --- | --- | --- | --- | --- |
| GET | `/rest/warehouses/{warehouseId}/locations` | `lagerorte.ts:78` | alle Lagerorte — **auch die leeren** | nein |
| GET | `/rest/warehouses/{warehouseId}/locations/dimensions` | `lagerort-anlegen.ts:242`, `api/lagerplatz/lagerorte/route.ts:41` | die Spalten (Halle, Regal, Ebene, Feld) | nein |
| GET | `/rest/warehouses/{warehouseId}/locations/levels` | `lagerort-anlegen.ts:273`, `laufweg.ts` | die Knoten des Strukturbaums | nein |
| GET | `/rest/warehouses/locations/{id}` | `lagerort-anlegen.ts:331` | einzelnen Lagerort prüfen | nein |
| GET | `/rest/warehouses/locations/levels/{id}` | `lagerort-anlegen.ts:337` | einzelnen Knoten prüfen | nein |
| GET | `/rest/warehouses/locations/stock/{lagerortId}` | `suche.ts:600`, `lagerort-aufraeumen.ts:202` | was liegt auf diesem Platz | nein |
| POST | `/rest/warehouses/locations/levels` | `lagerort-anlegen.ts:564` | Strukturknoten anlegen | **ja** |
| POST | `/rest/warehouses/locations` | `lagerort-anlegen.ts:649` | Lagerort anlegen | **ja** |
| PUT | `/rest/warehouses/locations/levels/{id}` | `laufweg.ts:371` | **nur `position`** — Laufweg ordnen | **ja** |
| DELETE | `/rest/warehouses/locations/{id}` | `lagerort-aufraeumen.ts:226` | falschen Lagerort entfernen | **ja** |
| DELETE | `/rest/warehouses/locations/levels/{id}` | `lagerort-aufraeumen.ts:244` | falschen Knoten entfernen | **ja** |

### Außerhalb der REST-API

| Methode | Pfad | Wo | Zweck |
| --- | --- | --- | --- |
| POST | `/plenty/api/ui.php` (multipart) | `client.ts:557` | Datei-Upload. Plentys **interne Oberflächen-Schnittstelle**, per Netzwerk-Mitschnitt nachgebaut, weil REST für Datei-Eigenschaften keinen Weg anbietet. Abschaltbar über `PLENTY_UI_UPLOAD=0`. |

---

## 4. Von der Oberfläche bis zum Endpunkt

### Projekt anlegen → `/projekte`

`app/api/projekte/route.ts` (POST) und `app/api/projekte/[id]/sync/route.ts`
→ `syncProjektToPlenty` (`client.ts:636`)

Ablauf, in dieser Reihenfolge:

1. Kategorie „Firma Ort" unter `PLENTY_PROJEKTE_CATEGORY_ID` suchen oder anlegen
2. Kategorie „Firma Ort Datum" darunter suchen oder anlegen
3. Artikel + Hauptvariante in der Datums-Kategorie anlegen, EAN nach Möglichkeit
   gleich eingebettet
4. Name und Beschreibung der Variante setzen (nicht blockierend)
5. EAN separat anhängen, falls Schritt 3 sie nicht mitgenommen hat
6. Rechnung als Datei an die Eigenschaft „Dokument 1" hängen

Fehlschläge blockieren nichts: Das Projekt wird in der eigenen Historie
gespeichert, Warnungen landen im Ergebnis. Ist Plenty gar nicht eingerichtet,
wird nur die EAN lokal erzeugt (`skipped: true`) — die App bleibt ohne
Live-System benutzbar.

### Erfassung → `/erfassung`

`app/api/erfassung/artikel/[id]/erkennen/route.ts` → `lib/erfassung/treffer.ts`

Nach der Bilderkennung wird in Plenty gefragt, ob es dasselbe Teil schon gab:
`/rest/items/variations` mit `numberExact`, dann `name`, dann `itemName`, jeweils
`with=item`. Liefert ein Filter die **volle** Seite zurück, hat er vermutlich gar
nicht gefiltert — solche Antworten werden verworfen, statt eine Zufallsliste als
Treffer auszugeben (`treffer.ts:39`). Rein lesend.

### Lagerplatz-Scan → `/lagerplatz`

`app/api/lagerplatz/scan/route.ts` → `lagerplatz-scan.ts`

Liest `/rest/stockmanagement/stock` seitenweise, fasst je Variante zusammen, lädt
dazu die Texte und sucht darin Lagerplatz-Codes wie `H6R5A7`. Rein lesend; das
Ergebnis ist die Vorschau, aus der später Lagerorte angelegt werden. Läuft in
Häppchen mit Zeitbudget und meldet über `naechsteSeite`, wo es weitergeht — sonst
läuft er in eine Serverless-Zeitgrenze.

### Lagerorte lesen → `/lagerplatz/*`

`app/api/lagerplatz/lagerorte/route.ts` → `lagerorte.ts`

`/rest/warehouses/{id}/locations`, gepuffert für 10 Minuten
(`PUFFER_DAUER_MS`). Der Punkt dieser Liste: **sie enthält auch leere Lagerorte.**
Aus einem Artikelexport lassen sich nur belegte Plätze ablesen — daraus zu
schließen, ein Platz existiere nicht, war zweimal die Ursache falscher Zahlen.

### Lagerorte anlegen → `/lagerplatz/anlegen`

`app/api/lagerplatz/anlegen/route.ts` → `lagerort-anlegen.ts`

Drei Ebenen, wie Plenty sie führt:

```
Dimension   die Spalte an sich (Halle, Regal, Ebene, Feld), je Lager fest,
            mit Kürzel ("H") und Trennzeichen ("/")
Level       ein Knoten darin: Halle "1", Feld "07" — hat parentId,
            dimensionId, position
Location    der Lagerort selbst, hängt an einem Level, hat label,
            purposeKey, statusKey
```

Aus dem Code `H1/R6/EA F05-K12` wird also: Knoten suchen oder anlegen (von oben
nach unten), dann die Location darunter. `probelauf` ist Voreinstellung.

### Lagerorte aufräumen → `/lagerplatz/anlegen`

`app/api/lagerplatz/aufraeumen/route.ts` → `lagerort-aufraeumen.ts`

Erkennt falsche Zweige an der Regel, an der man es auch von Hand sieht: Ein
oberster Knoten, dessen Name nicht mit dem Kürzel seiner Spalte beginnt, gehört
nicht in den Baum (Halle heißt `H1`, nicht `1`). Gelöscht wird von unten nach
oben, Lagerorte mit Bestand nie — der Lauf bricht dann ab.

### Laufweg ordnen → `/lagerplatz/anlegen`

`app/api/lagerplatz/laufweg/route.ts` → `laufweg.ts`

Plenty berechnet den Kommissionier-Laufweg aus der **Position der
Dimensions-Knoten**, nicht aus der Position am einzelnen Lagerort. Neue Knoten
werden von Plenty hinten angehängt statt einsortiert — in Burlo stand deshalb
F16, F17, F18, F01, F02. Geschrieben wird ausschließlich das Feld `position`;
kein Bestand bewegt sich, ein zweiter Lauf ändert nichts mehr.

### Lagerplätze zuweisen → `/lagerplatz/zuweisen`

`app/api/lagerplatz/zuweisen/route.ts` → `zuweisung.ts`

Die **einzige Stelle im ganzen Projekt, die Bestand bewegt.**

### Suche „Wo könnte er sonst liegen?" → `/lagerplatz/suche`

`app/api/lagerplatz/suche/route.ts` → `suche.ts`

Rein lesend, neun Signale in der Reihenfolge, in der auch ein Mensch sucht:
eigener Bestand → eigener Text → Warenbewegungen → Namensdublette → ID-Nachbarn
→ Einlagerungsfenster → Anlagedatum → Platztausch → Regal-Nachbarn. Zu jedem
Nachbarn werden Bild, Gewicht (`weightG`, `weightNetG`) und Maße (`widthMM`,
`lengthMM`, `heightMM`) geladen: das Bild für den Menschen, Gewicht und Maße für
die Bewertung — Plätze, die nicht zur Größe passen, werden abgewertet.

### Einstellungen → `/einstellungen`

`app/api/einstellungen/plenty/route.ts` (GET/PUT/POST/DELETE) und
`app/api/plenty/test/route.ts` → `testPlentyConnection`, `speichereZugang`.
`app/api/einstellungen/lager/route.ts` → Lagerliste für die Auswahl.

---

## 5. Feld-Mappings

### 5.1 Projekt → Plenty

| Bei uns | Wird zu | Endpunkt |
| --- | --- | --- |
| `company` + `location` | Kategoriename „Firma Ort", `details[0].name`, `nameUrl` = slug | `POST /rest/categories` |
| + Datum | Kategoriename „Firma Ort Datum" (zweite Ebene) | dito |
| — | `variations[0].variationCategories[0].categoryId` = Datums-Kategorie | `POST /rest/items` |
| — | `variations[0].unit = { unitId: 1, content: 1 }` — fest verdrahtet | dito |
| `buildItemName(input, date)` | `name` (lang `de`) | `POST .../descriptions` |
| `buildItemDescription(input, date)` | `description` (lang `de`) | dito |
| erzeugte EAN-13 | `variationBarcodes[0] = { barcodeId, code }` bzw. eigener Aufruf | `POST .../variation_barcodes` |
| Rechnungs-PDF | Wert `"<relationId>/<dateiname>"` an der Property-Relation | `ui.php` + `POST /rest/properties/relations/values` |

Kategorie-Payload vollständig:

```json
[{ "parentCategoryId": 123, "type": "item", "right": "all",
   "details": [{ "plentyId": 14443, "lang": "de", "name": "…", "nameUrl": "…" }],
   "clients": [{ "plentyId": 14443 }] }]
```

### 5.2 Bestandszeile → Artikelkarte (Scan)

`rohdatenAus` (`lagerplatz-scan.ts:188`):

| Plenty | Bei uns |
| --- | --- |
| `variation.id` | `variationId` |
| `variation.itemId` | `itemId` |
| `variation.number` | `nummer` |
| `variation.model` | `modell` |
| `variation.externalId` | `externeId` |
| `item.texts` + `variationDescription` | `beschreibung` (beides zusammengeführt) |
| `stock.netStock` (summiert je Variante) | `bestand` |
| `stock.physicalStock` | `bestandPhysisch` |
| `stock.warehouseId` → Lagername | `lager` |

Zeilen ohne Netto- **und** ohne Physisch-Bestand werden übersprungen. Der
Lagerplatz-Code wird anschließend aus `nummer`, `modell`, `externeId`, `name` und
`beschreibung` herausgelesen.

### 5.3 Lagerort-Code → Struktur

| Codeteil | Plenty-Objekt | Feld |
| --- | --- | --- |
| `H1` | Level in Dimension „Halle" | `name` (**mit** Kürzel), `parentId`, `dimensionId`, `position` |
| `R6` | Level „Regal" | dito, `parentId` = Halle |
| `EA` | Level „Ebene" | dito |
| `F05` | Level „Feld" | dito |
| `K12` | Location | `label`, `levelId` = Feld-Knoten, `purposeKey`, `statusKey`, `position: 1` |

`purposeKey` und `statusKey` werden nicht geraten, sondern aus dem **häufigsten
Wert der bestehenden Lagerorte** übernommen (`lagerort-anlegen.ts:480`).

### 5.4 Umbuchung

`PUT /rest/items/{itemId}/variations/{variationId}/stock/redistribute?itemId={itemId}`

```json
{ "reasonId": 401,                    // 401 = Umlagerung
  "quantity": 3,
  "currentWarehouseId": 1,
  "currentStorageLocationId": 15901,  // Quellplatz
  "newWarehouseId": 1,
  "newStorageLocationId": 15902 }     // Zielplatz
```

Die Menge wird vorher am Quellplatz ermittelt
(`/rest/stockmanagement/warehouses/{id}/stock/storageLocations?variationId=`), es
wird also nie mehr gebucht, als dort liegt. Quell- und Ziel-Lager sind dasselbe.

### 5.5 EAN-13

13 Stellen: `[Präfix 2] + [Nutzlast 10] + [Prüfziffer 1]`. Standardpräfix `20`
aus dem GS1-Bereich 20–29 („restricted distribution / in-store"), der für die
hausinterne Vergabe reserviert ist und nie mit echten Hersteller-GTINs
kollidiert. Beim Wiederholen eines Syncs wird eine bereits vergebene EAN behalten.

---

## 6. Fallen, die im Code schon bezahlt sind

Das hier ist die teuerste Spalte des Dokuments — jede Zeile war einmal ein Fehler.

| Falle | Was passiert | Wo gelöst |
| --- | --- | --- |
| `POST /rest/categories` mit einem Objekt | HTTP 500 „$data must be array" | `client.ts:246` |
| Barcode separat anhängen | eigenes Recht `item.item.variation.barcode.create`; fehlt es, 403 | inline im Artikel-POST versucht, sonst Einzelaufruf mit frischem Login |
| Datei-Eigenschaften | liegen **nicht** unter `variation_properties` (altes Merkmal-System), sondern als Property-**Relation** an der Variante | `client.ts:355 ff.` |
| Dateiwert löschen | wird der letzte Wert gelöscht, entfernt Plenty die Relation gleich mit → danach 404 | erst den richtigen Wert anlegen, **dann** die falschen löschen |
| `ui.php`-Upload schreibt volle S3-URL | Oberfläche stellt ihren CDN-Vorspann davor → Adresse doppelt → AccessDenied | auf `"<relationId>/<datei>"` normalisiert |
| Upload und Wertschreiben melden auch im Fehlerfall HTTP 200 | „hat geklappt", war aber nicht so | am Artikel selbst nachgeprüft (`verify`) |
| `with=`-Parameter | je Ausbaustufe unterschiedlich unterstützt | Kandidaten der Reihe nach probiert: `item,variationDescription` → `variationDescription` → `item` → ohne |
| Mehrere IDs auf einmal filtern | manche Instanzen ignorieren `?id=1,2,3` still | einmal geprüft und gemerkt, sonst einzeln |
| Namensfilter ohne Wirkung | volle Seite zurück = gar nicht gefiltert | solche Antworten werden verworfen |
| Kürzel im Knotennamen | Halle heißt `H1`, nicht `1` — Suche ohne Kürzel fand nichts und legte einen **zweiten kompletten Baum** an | `lagerort-aufraeumen.ts` räumt genau das auf |
| Laufweg | hängt an `level.position`, nicht an `location.position` | `laufweg.ts` |
| Plentys Schreibbremse | Massenläufe laufen in ein Limit | `schreibeMitGeduld`, Zeitbudget, Rundenbetrieb; betroffene Zeilen gelten als offen, nicht als Fehler |
| Bundles | haben keinen eigenen Bestand, der steckt in den Bestandteilen | Umbuchung erkennt „is bundle" und wiederholt nicht |
| Token-Cache | trägt bis zu 1 h alte Rechte | bei 403 einmal frisch anmelden |
| `PLENTY_BASE_URL` mit `/rest` | POST wird weitergeleitet und verliert dabei den Body | URL wird überall normalisiert |

---

## 7. Rechte des API-Benutzers

Nach Aufgabe getrennt — so lässt sich ein Benutzer anlegen, der nur das darf, was
er soll.

| Aufgabe | Braucht |
| --- | --- |
| Verbindungstest | nur gültige Zugangsdaten |
| Lagerplatz-Scan, Suche | lesend: Bestand, Lager, Artikel, Varianten. Ohne Lagernamen-Recht läuft er trotzdem und zeigt IDs |
| Lagerorte lesen | lesend: Lager, Lagerorte, Struktur |
| Lagerorte anlegen/aufräumen | schreibend + löschend: Lagerorte und Struktur-Knoten |
| Laufweg ordnen | schreibend: Struktur-Knoten (`position`) |
| Zuweisen | schreibend: Bestand umbuchen (redistribute) |
| Projekt-Sync | schreibend: Kategorien, Artikel, Varianten, **Barcode** (`item.item.variation.barcode.create`), Eigenschaften/Relations; für die Rechnung zusätzlich Zugriff auf `ui.php` |

---

## 8. Was Plenty sonst noch kann — nachgesehen

Nicht mehr geraten: Am 22.09.2026 wurden 36 Bereiche im Mandanten abgefragt, nur
lesend. Vollständig in [`PLENTY-INVENTUR.md`](PLENTY-INVENTUR.md), hier das
Wesentliche.

**Der API-Benutzer hat kein einziges Recht zu wenig** — kein einziger 403 in der
gesamten Inventur. Was fehlt, fehlt im Mandanten, nicht an der Berechtigung.

### Das Mengengerüst

| Was | Anzahl |
| --- | --- |
| Artikel | 58.660 |
| Varianten | 60.430 |
| Bestandszeilen | 67.240 |
| Lagerorte (Burlo) | 13.409 |
| Struktur-Knoten (Burlo) | 7.636 |
| Kategorien | 1.242 |
| **Aufträge** | **63.038** (877 in den letzten 30 Tagen) |
| Belege | 141.220 |
| Kontakte | 60.380 |
| Listings | 55.104 |

### Aufträge — der Bereich, nach dem du gefragt hast

Vorhanden und vollständig lesbar. 63.038 Aufträge, 877 in den letzten 30 Tagen.

| Thema | Pfad | Befund |
| --- | --- | --- |
| Aufträge | `/rest/orders` | 63.038, mit `?with=orderItems` |
| Status | `/rest/orders/statuses` | 58 konfiguriert, **19 in Gebrauch** — `/rest/orders/status` (ohne „es") ist 404 |
| Herkünfte | `/rest/orders/referrers` | 340 konfiguriert, **6 in Gebrauch**: eBay Germany (571), manuelle Eingabe (192), Shop (84), Amazon (24), zwei namenlose |
| Belege | `/rest/orders/documents` | 141.220 — aber der `?type=`-Filter wirkt **nicht** |
| Zahlungen | `/rest/payments` | vorhanden, Array **ohne** `totalsCount` |
| Zahlungsarten | `/rest/payments/methods` | 282 |
| Versandprofile | `/rest/orders/shipping/presets` | 32 |
| Kontakte | `/rest/accounts/contacts` | 60.380 — **gibt Klarnamen, E-Mail und Telefon direkt in der Liste aus** |
| Auftragstypen | — | **gibt es nicht** (404). Aus den Aufträgen ausgezählt: typeId 1 = Auftrag (707), 7 = Gutschrift (99), 4 = Angebot (71) |
| Versanddienstleister | — | **gibt es nicht** (404) |

Kundendaten hängen **nicht** direkt am Auftrag, sondern nur als `addressId` in
`addressRelations[]`. Wer Aufträge auswertet, ohne das aufzulösen, sieht keine
personenbezogenen Daten — das macht eine Auftragsauswertung deutlich unkritischer,
als man erwarten würde.

### Was es in diesem Mandanten NICHT gibt

Alles 404, nicht 403 — es fehlt also nicht am Recht:

| Bereich | Pfad |
| --- | --- |
| Umlagerungsaufträge | `/rest/redistributions` |
| Nachbestellungen | `/rest/reorders` |
| Bestandspuffer | `/rest/stockmanagement/buffer` |
| **Warenbewegungen** | `/rest/stockmanagement/stock/movements` — **das benutzt unser Code** (siehe Abschnitt 9) |
| Auftragstypen, Versanddienstleister, Belegarten | siehe oben |
| Rollen | `/rest/roles` — Rechte sind über die API nicht auflösbar |
| Marktplatz-Referrer | `/rest/markets/orders/referrers` (die Herkünfte stehen in `/rest/orders/referrers`) |

Zwei Pfade hießen nur anders: `/rest/orders/statuses` statt `…/status`, und
`/rest/item_sets` statt `/rest/items/item_sets` (dort: **0 Einträge**, Bundles gibt
es in diesem Mandanten also gar nicht).

`/rest/plugins` antwortet mit **HTTP 500** (`Too few arguments to function
PluginController::listAllPlugins()`) — die Plugin-Liste ist über die API nicht
abrufbar.

### Vorhanden und ungenutzt

| Bereich | Umfang | Für uns interessant |
| --- | --- | --- |
| Verkaufspreise | 29 Preislisten | **ja** — `lib/listing/markenregeln.ts` beschreibt Preisregeln, die niemand ausführt |
| Hersteller | 4.170 | evtl. |
| Einheiten | 52 | `unitId: 1` = Stück bestätigt |
| Attribute | 125 | — |
| Verfügbarkeiten | 10 | — |
| Webshops | 6 | **ja** — das Geschäft läuft auf 14616, nicht auf 14443 |
| Listings | 55.104 | fast jede Variante ist in Kanäle ausgespielt |
| USt-Sätze | 116 | — |
| Logs | 32.644 | Fehlersuche |
| Benutzer | 68 | — |

### Fallen, die die Inventur zusätzlich gefunden hat

| Falle | Folge |
| --- | --- |
| **`itemsPerPage` wird bei den Lagerort-Endpunkten ignoriert** | `?itemsPerPage=250` liefert trotzdem 100 Zeilen je Seite. Wer der Seitengröße vertraut, holt 8.000 statt 13.409 Lagerorte und merkt nichts, weil `totalsCount` stimmt |
| **`statusId` und `referrerId` sind Dezimal-Strings** (`"5.7"`, `"2.08"`) | `parseInt` macht aus „Wird kommissioniert" (5.7) den Status „Freigabe Versand" (5) und aus eBay Germany (2.08) eBay allgemein |
| **Sechs Listen-Endpunkte liefern blanke Arrays ohne `entries`/`totalsCount`** | `warehouses`, `orders/referrers`, `payments`, `payments/methods`, `shipping/presets`, `webstores`. `daten.entries ?? daten` greift ins Leere, weil `Array.prototype.entries` existiert |
| **`?type=` auf `/rest/orders/documents` wirkt nicht** | jeder Wert, auch ein erfundener, liefert dieselbe Zahl |
| **`?with=names,groups` auf `/rest/properties` wirft 500** | `with` weglassen, die Daten kommen ohnehin mit |
| **144 Kategorienamen sind mehrfach vergeben** | „Sonstiges" 53×, „Zubehör" 26×, „Elektronik & Elektrotechnik" zweimal als Wurzel. Eine Kategorie über den Namen zu suchen, ist unsicher — nur „Projekte" ist eindeutig |
| **Die Halle-Ebene ist nicht durchgehend numerisch** | neben H1–H9 gibt es `HWagen` (100 Lagerorte) und `HOF` (1). Ein Parser auf `H(\d+)` verliert 101 Lagerorte |
| **Alle 13.409 Lagerorte haben `statusKey = active`** | Code, der auf `statusKey` verzweigt, hat hier nur einen Zweig — und damit einen ungetesteten |
| **Die Dimensions-`id` folgt nicht der Hierarchie** | Halle=9, Regal=10, Ebene=11, Feld=**7**. Nach `id` sortieren kehrt die unterste Stufe nach oben; es gilt `level` |

Positiv, und das ist bemerkenswert bei 13.409 Lagerorten: **kein einziger ohne
`label`, keiner ohne `fullLabel`, kein doppeltes `fullLabel`**, und alle passen auf
das Muster `H…/R…/E… F…-…`. Die Aufräumarbeit aus `lagerort-aufraeumen.ts` hat
gehalten.

---

## 9. Lücken und nächste Schritte

Geordnet nach Nutzen. Die ersten beiden sind neu aus der Inventur.

1. **Fünf Auswertungen laufen ins Leere, ohne dass der Code es merkt.** Alle
   antworten mit HTTP 200 — es gibt weder Ausnahme noch Diagnosemeldung.
   Nachgewiesen in [`PLENTY-ENDPUNKTE-GEPRUEFT.md`](PLENTY-ENDPUNKTE-GEPRUEFT.md):

   | Stelle | Was passiert |
   | --- | --- |
   | `suche.ts:828`, `suche.ts:977` | Warenbewegungen führen **`storageLocationName`** (Klartext `"H5/R10/EC F19-0"`), nicht `storageLocationId`. Beide Bewegungs-Signale liefern garantiert null Treffer, obwohl 35.779 Bewegungen bereitstehen |
   | `suche.ts:ladePlatzbelegung` | `/rest/warehouses/locations/stock/{id}` antwortet in **snake_case** (`variation_id`, `item_id`, `warehouse_id`). Der Code liest `variationId` → alles weggefiltert. Das Signal „Platztausch" ist tot |
   | `lagerplatz-scan.ts:handleWithAus` | `with=variationDescription` wird von Plenty **stillschweigend verworfen** (unbekannte `with`-Werte liefern 200 ohne Feld). Die Diagnose meldet trotzdem, es werde damit gelesen. `with=item` liefert den Artikel **ohne `texts`** — die Textbewertung arbeitet für die meisten Varianten auf `null` |
   | `client.ts:222` | `/rest/categories?parentCategoryId=` wird **ignoriert**, jeder Wert liefert alle 1.242. Der Eltern-Guard im Code fängt das ab, aber jede Kategoriesuche blättert 25 Seiten. Ab ~2.000 Kategorien greift die Obergrenze `page > 40`, dann werden Kategorien **doppelt angelegt** |
   | `suche.ts:572` | `/rest/items?name=` liefert **Artikel**-IDs, die der Code als Varianten-IDs weiterreicht — IDs aus der falschen Nummernreihe |

   Dazu zwei Kleinigkeiten: `/rest/items/variations?name=` gibt es nicht (HTTP 422,
   der Filter heißt `itemName`), und `/rest/warehouses/{id}/locations/levels`
   ignoriert `itemsPerPage`/`page` und liefert immer alle 7.636 Knoten.

   Gut zu wissen für Massenläufe: Der Mandant drosselt mit **HTTP 429
   `short period read limit reached`**.
2. **Der API-Zugang ist ein normaler Backend-Benutzer**, kein dedizierter
   REST-Benutzer (`userType: backend`, `loginType: legacy`, `plenty_api: 0`,
   `user_role_id: null`). Er sieht **alles** — auch 60.380 Kontakte mit Klarnamen,
   E-Mail und Telefonnummer. Für eine Automatisierung, die Artikel und Lagerorte
   braucht, ist das erheblich mehr Zugriff als nötig. Ein eigener API-Benutzer mit
   den Rechten aus Abschnitt 7 wäre die saubere Lösung.
3. **Preisregeln laufen nirgends.** `lib/listing/markenregeln.ts` hält Markensperren
   und Preislogik aus dem SOP fest — aber kein Code schreibt je einen Preis nach
   Plenty. 29 Preislisten liegen bereit. Entweder anschließen oder als Dokument
   kenntlich machen.
4. **Erfasste Bilder bleiben liegen.** Die Erfassung fotografiert und erkennt,
   lädt aber nichts nach Plenty hoch; gelesen werden Bilder nur für die Suche.
5. **Bundles sind kein Thema mehr.** `/rest/item_sets` meldet **0 Einträge** — in
   diesem Mandanten gibt es keine Bundles. Die Sonderbehandlung in `zuweisung.ts`
   schadet nicht, greift aber ins Leere.
6. **`ui.php` ist eine Zeitbombe.** Ein interner, nicht dokumentierter Endpunkt,
   per Mitschnitt nachgebaut. Er kann mit jedem Plenty-Update brechen. Der
   Abschalter (`PLENTY_UI_UPLOAD=0`) ist da, ein REST-Ersatz nicht.
7. **Aufträge sind unerschlossen** — 63.038 Stück, vollständig lesbar, und die
   personenbezogenen Daten hängen nicht am Auftrag selbst. Der Einstieg ist
   billiger als gedacht.
8. **Sechs der neun Lager sind leere Hüllen.** Nur Burlo (106) hat eine
   Lagerort-Struktur; Borken I und II haben je zwei Dimensionen und genau einen
   Lagerort — angefangen und liegengelassen. `107 FBA` hat gar keinen Bestand.

### So kommt man an alles heran

```bash
cd projektplanung
node scripts/plenty.mjs test                       # Verbindung prüfen
node scripts/plenty-inventur.mjs --md              # die ganze Inventur neu erheben
node scripts/plenty.mjs get /rest/orders 'itemsPerPage=1'
```

Voraussetzung ist eine Umgebung, deren Netzwerk-Policy `*.plentysystems.com`
durchlässt — in der Umgebung „Voll-Netz" ist das der Fall, in „Default" nicht.
Ein `GET` kann nichts kaputt machen.
