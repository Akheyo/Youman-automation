# ShoppingSync – Plenty → Google Merchant Center

plentymarkets-Plugin, das freigegebene Artikel automatisch ins **Google Merchant
Center** überträgt und dort aktuell hält. Die dauerhaft laufende
Shopping-Kampagne (z. B. „Shopping | Klimakammern | Deutschland“) bewirbt dann
automatisch alles, was verfügbar und freigegeben ist. Pro neuer Klimakammer
muss in Google Ads nichts angelegt werden.

```
Plenty (Datenquelle)  →  ShoppingSync  →  Merchant API v1  →  Merchant Center  →  bestehende Kampagne
```

Eine Google-Ads-API wird nicht gebraucht. Angebunden ist die **Merchant API
v1**, nicht die alte Content API for Shopping, die Google 2026 abgeschaltet hat.

---

## Was das Plugin entscheidet

Alle 15 Minuten prüft das Plugin jede Variante mit dem Tag `shopping_ads` und
jede Variante, die gerade bei Google liegt, einzeln pro Land:

| Situation in Plenty | Aktion bei Google |
| --- | --- |
| `shopping_ads` + aktiv + Bestand > 0, noch nicht bei Google | **hinzufügen** |
| Preis, Titel, Beschreibung, Bilder, Zustand, Marke … geändert | **aktualisieren** |
| nichts geändert | nichts (kein Aufruf) |
| Bestand fällt auf 0 | **„nicht vorrätig“** (wird nicht beworben), wahlweise sofort löschen |
| seit 30 Tagen nicht vorrätig (einstellbar) | **löschen** |
| Bestand wieder > 0 | **wieder aktiv** |
| `shopping_ads` entfernt oder Variante inaktiv | **löschen** |
| Variante in Plenty gelöscht | **löschen** |
| `shopping_ads` gesetzt, aber Daten unvollständig | **nicht übertragen** + Fehler im Protokoll; lag sie schon bei Google, wird sie dort gelöscht (kein Werben mit veraltetem Preis) |
| `shopping_ads` gesetzt, aber Bestand 0 und noch nie übertragen | nichts (wartet auf Bestand) |

Gesendet wird nur, wenn sich am übertragenen Datensatz etwas geändert hat
(Fingerabdruck je Variante und Land). Einmal täglich läuft ein **vollständiger
Abgleich**:

- Alle Produkte werden neu gesendet. Google löscht Produkte, die 30 Tage lang
  nicht aktualisiert wurden.
- Der Prüfstatus wird geholt (freigegeben / in Prüfung / abgelehnt, mit
  Google-Begründung).
- Produkte, die in unserer API-Datenquelle liegen, aber in Plenty nicht mehr
  freigegeben sind, werden gelöscht.
- Produkte, die bei uns als übertragen gelten, bei Google aber fehlen, werden
  neu gesendet.

Manuell im Merchant Center angelegte Produkte (z. B. der aktuelle Test mit
Artikel 25433) liegen in einer anderen Datenquelle. Das Plugin fasst sie
**nie** an.

## Freigabe und Produktgruppe

Zwei Arten von Plenty-Tags, bewusst getrennt:

- **Freigabe:** `shopping_ads`. Erst wenn Bilder, Beschreibung und Preis fertig
  sind, wird der Tag gesetzt. Ohne ihn landet nichts bei Google.
- **Produktgruppe:** genau einer von `type_klimakammer`, `type_laborgeraet`,
  `type_sonstiges` (erweiterbar). Daraus entstehen `product_type` und
  `custom_label_0`:

```
shopping_ads + type_klimakammer
  → product_type    = Klimakammern > Klimaprüfschränke
  → custom_label_0  = klimakammer
  → shipping_label  = klimakammer   (je Land konfigurierbar)
```

Die Klimakammer-Kampagne in Google Ads filtert auf `custom_label_0 = klimakammer`.
Fehlt der Gruppen-Tag oder sind zwei gesetzt, wird nichts übertragen und das
Protokoll sagt warum.

## Übertragene Felder

| Google | Quelle in Plenty | Regel |
| --- | --- | --- |
| `offerId` | Varianten-ID (optional mit Präfix) | |
| `title` | Name 1 (einstellbar: Name 2/3) | max. 150 Zeichen, an Wortgrenze gekürzt |
| `description` | Beschreibung, sonst Vorschautext | HTML → Klartext, max. 5000 Zeichen |
| `link` | Vorlage `{shopUrl}/{urlPath}_{itemId}_{variationId}` | je Land |
| `imageLink`, `additionalImageLinks` | Artikelbilder in Plenty-Reihenfolge | bis zu 10 weitere |
| `availability` | Netto-Warenbestand (alle oder ausgewählte Lager) | `IN_STOCK` / `OUT_OF_STOCK` |
| `price` | Verkaufspreis-ID je Land, Währung je Land | |
| `condition` | Artikelzustand | 0 Neu → NEW, **1 Gebraucht → USED**, 2/3 → NEW, 4 B-Ware → USED; anpassbar |
| `brand` | Hersteller (externer Name, sonst Name) | fehlt → wird weggelassen |
| `mpn` | Modell der Variante | nur wenn gepflegt |
| `gtins` | Barcodes der Variante | **nur echte Hersteller-GTINs**, siehe unten |
| `identifierExists` | | `false`, wenn weder GTIN noch Marke + MPN |
| `productTypes`, `customLabel0` | Produktgruppen-Tag | |
| `shippingLabel` / `shipping` | je Land und Produktgruppe | |

**Nichts wird erfunden.** Fehlen Preis, Bild, Titel, Beschreibung, URL-Pfad
oder ist der Zustand nicht zugeordnet, gibt es einen Fehler statt eines
Ratewerts.

**Interne EANs werden nie als GTIN gesendet.** Die Erfassung
(`projektplanung`) vergibt jedem Artikel eine hausinterne EAN-13 mit Präfix 20.
Die ist korrekt gebildet, gehört aber keinem Hersteller. Das Plugin verwirft
alle GS1-Bereiche für interne Nummern (020–029, 040–049, 200–299, RCN-8),
Gutscheine (050–059, 980–999) und Codes mit falscher Prüfziffer. Bleibt keine
echte GTIN übrig, gehen Marke + MPN raus, oder `identifierExists = false`.
Das ist für Gebrauchtgeräte zulässig.

## Länder

Kein Land ist fest programmiert. Ein Markt ist ein Eintrag in der
Konfiguration. Österreich oder Frankreich brauchen also keinen neuen Code:

```json
[
  {
    "country": "DE", "active": true,
    "feedLabel": "DE", "contentLanguage": "de", "textLanguage": "de",
    "currency": "EUR", "salesPriceId": 1,
    "shopUrl": "https://www.ihr-shop.de",
    "linkTemplate": "{shopUrl}/{urlPath}_{itemId}_{variationId}",
    "shipping": { "type_klimakammer": { "shippingLabel": "klimakammer" } }
  },
  {
    "country": "AT", "active": false,
    "contentLanguage": "de", "currency": "EUR", "salesPriceId": 1,
    "shopUrl": "https://www.ihr-shop.de",
    "shipping": { "default": { "shippingLabel": "spedition_at" } }
  },
  {
    "country": "BE", "active": false, "feedLabel": "BE",
    "contentLanguage": "fr", "textLanguage": "fr",
    "currency": "EUR", "salesPriceId": 1,
    "shopUrl": "https://www.ihr-shop.de",
    "linkTemplate": "{shopUrl}/{lang}/{urlPath}_{itemId}_{variationId}",
    "shipping": { "default": { "rates": [
      { "price": "149.00", "service": "Spedition", "minHandlingTime": 1, "maxHandlingTime": 3, "minTransitTime": 3, "maxTransitTime": 6 }
    ] } }
  }
]
```

- `textLanguage`: aus welcher Plenty-Sprache Titel, Beschreibung und URL-Pfad
  kommen. Fehlen die Texte in dieser Sprache, wird für dieses Land nicht
  übertragen (Fehler im Protokoll).
- Ein Land mit zwei Sprachen (BE: nl + fr) sind zwei Einträge mit gleichem
  `country`/`feedLabel` und unterschiedlicher `contentLanguage`.
- **Versand** je Land und Produktgruppe (`default` als Rückfall):
  - `shippingLabel` verweist auf eine Versandrichtlinie im Merchant Center
    (empfohlen, z. B. die bestehende Klimakammer-Richtlinie für DE).
  - `rates` überträgt feste Versandkosten und Lieferzeiten direkt am Produkt.
  - Ohne Angabe gilt, was im Merchant Center für das Land eingestellt ist.
- `"active": false` bereitet ein Land vor, ohne zu senden. Wird ein Land
  deaktiviert, werden seine Produkte bei Google gelöscht. Die anderen Länder
  bleiben unberührt.

Ein Fehler im Eintrag eines Landes (z. B. Tippfehler bei FR) legt nur dieses
Land still, nicht die übrigen.

---

## Einrichtung

### 1. Google-Seite (einmalig)

1. **Google-Cloud-Projekt** anlegen und darin die **Merchant API** aktivieren.
2. **Service-Account** anlegen → Schlüssel als JSON herunterladen.
3. Im **Merchant Center** → Einstellungen → Personen und Zugriff: die E-Mail
   des Service-Accounts als Nutzer mit Standardzugriff hinzufügen.
4. Im Merchant Center → Datenquellen → **Produktquelle hinzufügen → „API“**.
   Die ID der neuen Datenquelle notieren (steht in der URL bzw. den Details).
5. Plugin-Konfiguration ausfüllen (siehe unten). Dann das Cloud-Projekt
   **einmalig als Entwickler registrieren** (Pflicht bei der Merchant API):

   ```
   POST /rest/shopping-sync/register-gcp
   { "developerEmail": "ihr.name@firma.de" }
   ```

   Die E-Mail muss ein normales Google-Konto sein, kein Service-Account. Dorthin
   schickt Google API-Hinweise.

### 2. Plenty-Seite

1. **Plugin einbinden:** Plenty erwartet `plugin.json` im Wurzelverzeichnis
   eines Git-Repositorys. Den Ordner deshalb als eigenes Repository
   bereitstellen, z. B. per
   `git subtree split --prefix plenty-google-shopping -b plenty-shopping-sync`
   und diesen Branch in ein eigenes (privates) Repo pushen. Dann: Plugins →
   Plugin-Set → Git-Plugin hinzufügen, dem Plugin-Set des Mandanten zuordnen,
   Plugin-Set bereitstellen.
2. **Tags anlegen** (Einrichtung → Einstellungen → Tags, Verfügbarkeit
   „Artikel“): `shopping_ads`, `type_klimakammer`, `type_laborgeraet`,
   `type_sonstiges`.
3. **Plugin-Konfiguration** (Plugin-Set → ShoppingSync → Konfiguration):

| Feld | Wert für den Start |
| --- | --- |
| Synchronisierung aktiv | an |
| Testmodus | **an** (für die erste Prüfung) |
| Pilot: nur diese Artikel-IDs | `25433` |
| Merchant-Center-ID | Konto-ID aus dem Merchant Center |
| ID der API-Datenquelle | aus Schritt 1.4 |
| Service-Account-Schlüssel | kompletter Inhalt der JSON-Datei |
| Märkte | DE-Eintrag: `salesPriceId` und `shopUrl` eintragen |
| Produktgruppen | vorbelegt, ggf. anpassen |

Die JSON-Felder (Märkte, Produktgruppen, Zustände) sind einzeilige Textfelder.
Längeres JSON am besten im Editor bauen und einfügen.

### 3. Prüfen

Alle Endpunkte brauchen einen Backend-Login (REST-Token):

| Endpunkt | Zweck |
| --- | --- |
| `GET /rest/shopping-sync/check` | Konfiguration prüfen, Verbindung zu Google testen |
| `GET /rest/shopping-sync/preview/{variationId}` | genau das zeigen, was an Google ginge, ohne zu senden |
| `POST /rest/shopping-sync/run` | Lauf sofort starten, `{"full": true}` für Vollabgleich, `{"variationIds": [123]}` für einzelne |
| `GET /rest/shopping-sync/states` | alle übertragenen Produkte mit Google-Status und Fehlern |
| `GET /rest/shopping-sync/log?onlyErrors=1` | Protokoll: Produkt, Zeitpunkt, Aktion, Ergebnis, Meldung |
| `POST /rest/shopping-sync/register-gcp` | einmalige Entwickler-Registrierung (siehe oben) |

Fehler stehen zusätzlich im Plenty-Log (Daten → Log, Filter „ShoppingSync“).
Das Plugin-Protokoll wird 90 Tage aufbewahrt.

---

## Einführung (wie besprochen: klein anfangen)

1. **Manuellen Test abwarten.** Die Kampagne läuft 1–2 Wochen mit dem manuell
   angelegten Artikel 25433. Erst wenn das positiv aussieht, geht es weiter.
2. **Testmodus mit Artikel 25433.** Testmodus an, Pilot = `25433`, Tags
   `shopping_ads` + `type_klimakammer` setzen.
   `GET /rest/shopping-sync/preview/{variationId}` aufrufen und Feld für Feld
   mit dem manuellen Produkt im Merchant Center vergleichen: Titel, Preis,
   Bilder, Zustand (`USED`), Verfügbarkeit, Labels. Die Läufe im Testmodus
   stehen im Protokoll mit `dryRun = true`, gesendet wird nichts.
3. **Duplikat vermeiden.** Bevor das Plugin live sendet, das **manuell
   angelegte** Produkt im Merchant Center löschen. Sonst gibt es Artikel 25433
   doppelt (zwei Datenquellen).
4. **Live mit 1–3 Klimakammern.** Testmodus aus, Pilot = 1–3 Artikel-IDs.
   Nach Googles Prüfung (`/states` zeigt `approved` oder die Ablehnungsgründe)
   prüfen, ob alles richtig ankommt und die Kampagne die Produkte bewirbt.
5. **Schrittweise öffnen.** Weitere Artikel-IDs in die Pilot-Liste. Wenn alles
   stimmt, die Pilot-Liste leeren: Dann gilt jeder Artikel mit `shopping_ads`.
6. **Weitere Länder:** Markt-Eintrag mit `"active": false` vorbereiten, Texte
   und Preise in Plenty pflegen, per Vorschau prüfen, dann aktivieren. In
   Google Ads braucht das Land eine eigene Kampagne bzw. Länder-Ausrichtung.

## Ablauf im Alltag (Zielbild)

1. Neue Klimakammer in Plenty normal anlegen und pflegen.
2. Wenn sie fertig ist: `type_klimakammer` + `shopping_ads` setzen.
3. Höchstens 15 Minuten später liegt sie im Merchant Center. Nach Googles
   Prüfung bewirbt die bestehende Kampagne sie.
4. Verkauft (Bestand 0): höchstens 15 Minuten später bei Google „nicht
   vorrätig“, keine Werbung mehr. Nach 30 Tagen ohne Bestand wird sie gelöscht.

---

## Technik

```
src/Domain/        Reine Logik ohne Plenty, vollständig getestet
  Settings           Konfiguration lesen und prüfen
  MarketConfig       ein Land
  ProductTypeConfig  eine Produktgruppe (type_*-Tag)
  ProductMapper      Plenty-Daten → Merchant-API-ProductInput
  SyncDecider        die Regeln aus der Tabelle oben
  Gtin               GTIN-Prüfung, interne EANs verwerfen
  GoogleStatus       Prüfstatus je Land, Produktnamen
src/Services/
  PlentyCatalog      liest Tags, Texte, Preise, Bilder, Barcodes, Bestand, Zustand, Hersteller
  SyncService        ein Lauf: lesen → entscheiden → senden → Stand/Protokoll schreiben
  MerchantClient     ruft die Bibliothek auf
resources/lib/merchant_api.php   Google-Anmeldung (Service-Account-JWT) + HTTP, läuft in Plenty als externe Bibliothek
src/Crons/         alle 15 Min. Änderungen, täglich Vollabgleich
src/Models/        SyncState (Stand je Variante und Land), SyncLog (Protokoll)
```

Tests (ohne Plenty, mit simuliertem Google):

```bash
cd plenty-google-shopping
composer install
vendor/bin/phpunit
```

Die Plenty-Schnittstellen sind gegen die offiziellen Stubs
(`plentymarkets/plugin-interface`, Branch `stable7`) geschrieben. Den echten
Plenty-Build prüft erst das Bereitstellen des Plugin-Sets. Meldet der Build
einen Fehler, steht er unter Plugins → Plugin-Set → Build-Protokoll.
