# PlentyONE — Landkarte

Was wir von PlentyONE benutzen, wo es im Code steht, welches Feld wohin geht —
und was Plenty darüber hinaus kann.

**Woher die Angaben stammen.** Alles unter „Was wir nutzen" (Abschnitte 1–7) ist
aus diesem Repository gelesen, Datei für Datei, mit Zeilenangaben. Das ist der
belastbare Teil. Abschnitt 8 („Was Plenty sonst noch kann") ist **nicht geprüft**:
Die Entwicklerdoku (`developers.plentymarkets.com`) und der Mandant selbst waren
beim Schreiben von der Netzwerk-Policy der Arbeitsumgebung gesperrt. Er dient der
Orientierung — welcher Bereich existiert und wofür er zuständig ist —, die genauen
Pfade gehören vor Gebrauch in der Doku nachgeschlagen.

Mandant: **plentyId 14443**, Shop `besttra.de`, REST-Basis
`https://p14443.my.plentysystems.com` (ohne `/rest`).

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
| Order | **nein** | — kein einziger Aufruf im Repo |
| Payment / Shipping / Document | **nein** | — |
| Contact / Adressen (CRM) | **nein** | — |
| Sales price | **nein** | Preisregeln existieren nur als Text (`lib/listing/markenregeln.ts`) |
| Listing / Markets / Webstore | **nein** | — |
| Plugin / Cron / Log / System | **nein** | — |
| User / Rechte | **nein** | wird im Backend von Hand gepflegt |
| Attribute, Hersteller, Einheiten, Item-Sets | **nein** | Einheit fest auf `unitId: 1` verdrahtet |

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

| Variable | Bedeutung | Ohne sie |
| --- | --- | --- |
| `PLENTY_BASE_URL` | REST-Basis, ein angehängtes `/rest` wird abgeschnitten | kein Sync, App läuft weiter |
| `PLENTY_USER`, `PLENTY_PASSWORD` | REST-Zugangsdaten | wie oben |
| `PLENTY_ID` | plentyId (Mandant), hier `14443`, Standard `0` | Kategorien landen unter Mandant 0 |
| `PLENTY_WAREHOUSE_ID` | Lager für die Lagerwerkzeuge | erstes gemeldetes Lager |
| `PLENTY_PROJEKTE_CATEGORY_ID` | Elternkategorie „Projekte" | Projekt-Sync bricht mit Fehler ab |
| `PLENTY_EAN_BARCODE_ID` | Barcode-Konfiguration (z. B. EAN13_2) | EAN wird erzeugt, aber nicht angehängt |
| `PLENTY_EAN_PREFIX` | 2-stelliger Präfix, Standard `20` | — |
| `PLENTY_INVOICE_PROPERTY_ID` | Eigenschaft vom Typ Datei („Dokument 1") | Rechnung wird nicht angehängt |
| `PLENTY_INVOICE_PROPERTY_NAME` | nur für Fehlermeldungen | — |
| `PLENTY_UI_UPLOAD` | `0` schaltet den `ui.php`-Upload ab | — |

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

## 8. Was Plenty sonst noch kann — und wir nicht nutzen

**Ungeprüft.** Die Doku war beim Schreiben nicht erreichbar; die folgenden Pfade
stammen aus Erfahrungswissen und gehören vor Gebrauch nachgeschlagen. Verlässlich
ist die Aussage, **dass** es den Bereich gibt und wofür er zuständig ist — nicht
die exakte Schreibweise.

### Aufträge (der Bereich, den du verlinkt hast)

Der komplette kaufmännische Kern ist bei uns unberührt. Was dort liegt:

| Thema | Grob | Wofür es bei uns taugen würde |
| --- | --- | --- |
| Aufträge lesen/anlegen | `/rest/orders`, `/rest/orders/{id}` | Auftragslage auswerten, Aufträge aus eigenen Quellen anlegen |
| Auftragspositionen | Unterressourcen des Auftrags | was wurde bestellt, in welcher Menge |
| Status ändern | Statuswechsel am Auftrag | „in Bearbeitung", „versandbereit" automatisch setzen |
| Auftragseigenschaften | Order properties | eigene Kennzeichen an den Auftrag hängen |
| Belege | Rechnung, Lieferschein als PDF | Belege ziehen, statt sie im Backend zu suchen |
| Versand | Pakete, Versandprofile, Labels | Versandabwicklung anstoßen |
| Retouren, Gutschriften | eigene Auftragstypen | Rückläufer erfassen — passt zu unserer Suche, die Rückläufer schon berücksichtigt |
| Zahlungen | Zahlungen und Zuordnung | Zahlungseingang prüfen |

Anschließen ließe sich das ohne neue Infrastruktur: `plentyGet`/`plentyPost` gibt
es, der Token auch, `scripts/plenty.mjs test` prüft den Zugang. Es fehlt nur das
Recht am API-Benutzer und ein Modul `lib/plenty/auftraege.ts` in derselben Form
wie die übrigen.

### Weitere Bereiche

| Bereich | Wofür zuständig | Für uns interessant? |
| --- | --- | --- |
| Verkaufspreise | Preise je Variante und Preisliste | **ja** — `lib/listing/markenregeln.ts` beschreibt Preisregeln, die heute niemand ausführt |
| Item-Sets / Bundles | Bundle-Artikel | **ja** — die Umbuchung stolpert heute über Bundles |
| Nachbestellung / Umlagerung als Beleg | Bestellungen beim Lieferanten, Umlagerungsaufträge **zwischen** Lagern | evtl. — unsere Umbuchung läuft innerhalb eines Lagers |
| Bestandspuffer, Verfügbarkeiten | Reservierungen, Lieferzeiten | evtl. |
| Kontakte / Adressen | Kunden und Lieferanten | bei Auftragsanlage nötig |
| Hersteller, Attribute, Einheiten, Merkmale allgemein | Artikelstammdaten | heute fest verdrahtet (`unitId: 1`) |
| Bilder schreiben | Artikelbilder hochladen | **ja** — die Erfassung fotografiert bereits, lädt aber nichts nach Plenty hoch |
| Listings / Marktplätze / Webshop | eBay, Amazon, Shop | passt zum Quellen-Wasserfall im Repo |
| Plugins, Ereignisaktionen | Automatisierung im Backend | Alternative zu eigenem Code — Plentys Automatik läuft überwiegend über Ereignisaktionen im Backend, nicht über REST-Webhooks (**bitte prüfen**) |
| Benutzer und Rechte | API-Benutzer verwalten | heute Handarbeit im Backend |
| Logs, Systeminfos | Fehlersuche | selten |
| PIM | neuere Artikel-API parallel zur alten | mittelfristig relevant, wenn Plenty die alte ablöst |

---

## 9. Lücken und nächste Schritte

Was mir beim Durchgehen aufgefallen ist, geordnet nach Nutzen:

1. **Preisregeln laufen nirgends.** `lib/listing/markenregeln.ts` hält Markensperren
   und Preislogik aus dem SOP fest — aber kein Code schreibt je einen Preis nach
   Plenty. Entweder anschließen oder als Dokument kenntlich machen.
2. **Erfasste Bilder bleiben liegen.** Die Erfassung fotografiert und erkennt,
   lädt aber nichts nach Plenty hoch; gelesen werden Bilder nur für die Suche.
3. **Bundles bei der Zuweisung.** Heute wird der Fehler erkannt und die Zeile
   übersprungen. Über die Item-Set-Ressource ließe sich auf die Bestandteile
   auflösen.
4. **`ui.php` ist eine Zeitbombe.** Ein interner, nicht dokumentierter Endpunkt,
   per Mitschnitt nachgebaut. Er kann mit jedem Plenty-Update brechen. Der
   Abschalter (`PLENTY_UI_UPLOAD=0`) ist da, ein REST-Ersatz nicht.
5. **Aufträge sind unerschlossen** — siehe oben.

### So kommt man an alles heran

```bash
cd projektplanung
node scripts/plenty.mjs test
node scripts/plenty.mjs get /rest/items/variations 'itemsPerPage=5&with=item'
node scripts/plenty.mjs get /rest/stockmanagement/warehouses
```

Für die ungeprüften Teile aus Abschnitt 8 ist das auch der schnellste Weg: Pfad
raten, aufrufen, Antwort ansehen. Ein `GET` kann nichts kaputt machen.
