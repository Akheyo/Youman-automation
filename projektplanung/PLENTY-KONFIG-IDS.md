# Plenty-Konfigurations-IDs

Mandant: `https://p14443.my.plentysystems.com` · Benutzer: `kheyo` · 2026-09-22

Zweck: Konfigurationswerte fuer die Anwendung, die gebrauchte Industrieware als
**inaktiven** Artikel anlegt und danach auf eBay und im eigenen Webshop listet.

Erhebung: ausschliesslich lesend. Ein `POST /rest/login`, danach nur `GET`.
Es wurde nichts angelegt, geaendert oder geloescht.

Jede Zeile nennt den Pfad und das Feld, aus dem sie stammt. Wo die Daten eine
Zuordnung nicht hergeben, steht das ausdruecklich da — und der Wert bleibt im
Block am Ende leer.

---

## 1. Verkaufspreislisten

Pfad: `GET /rest/items/sales_prices?itemsPerPage=100` → HTTP 200, `totalsCount` 29.

Felder: `id`, `type`, `minimumOrderQuantity`, `isDisplayedByDefault`,
`names[].nameInternal` (lang `de`), `referrers[].referrerId`, `clients[].plentyId`.
Die Referrer-Namen sind aus `/rest/orders/referrers` (Feld `backendName`) nachgeschlagen.

### Alle 29 Preislisten

| id | Name (de, `nameInternal`) | `type` | `minOrderQty` | `isDisplayedByDefault` | `referrers[].referrerId` | `clients[].plentyId` |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Webshop | default | 1 | ja | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 148 (WEB-API), 162 (Shopify) | 14443, 14616, 15933, 24971, 36636 |
| 3 | Ebay | default | 1 | ja | 0 (Manuelle Eingabe), 2.03 (eBay UK), 2.05 (eBay Austria), 2.06 (eBay Belgium (French)), 2.07 (eBay France), 2.08 (eBay Germany), 2.1 (eBay Italy), 2.11 (eBay Belgium (Dutch)), 2.12 (eBay Netherlands), 2.13 (eBay Spain), 2.14 (eBay Switzerland), 9 (eBay Auction), 15 (Ebay_Kleinanzeigen) | -1 (alle) |
| 4 | Amazon | default | 1 | ja | 4.01 (Amazon Germany), 148 (WEB-API) | -1 (alle) |
| 12 | Mengenstaffelpreis: Menge ab 6 | default | 6 | nein | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 2 (Ebay), 2.08 (eBay Germany), 4.01 (Amazon Germany), 4.22 (Amazon UK B2B), 9 (eBay Auction), 10 (Google), 11 (Globalelektronik), 104 (Amazon FBA), 104.22 (Amazon FBA UK B2B), 125 (Hood), 142 (MyBestBrands), 148 (WEB-API) | -1 (alle) |
| 13 | Mengenstaffelpreis:  Menge ab 50 | default | 50 | nein | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 2 (Ebay), 2.08 (eBay Germany), 4.01 (Amazon Germany), 4.22 (Amazon UK B2B), 9 (eBay Auction), 10 (Google), 11 (Globalelektronik), 104 (Amazon FBA), 104.22 (Amazon FBA UK B2B), 125 (Hood), 142 (MyBestBrands), 148 (WEB-API) | -1 (alle) |
| 14 | Mengenstaffelpreis:  Menge ab 100 | default | 100 | nein | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 2 (Ebay), 2.08 (eBay Germany), 4.01 (Amazon Germany), 4.22 (Amazon UK B2B), 9 (eBay Auction), 10 (Google), 11 (Globalelektronik), 104 (Amazon FBA), 104.22 (Amazon FBA UK B2B), 125 (Hood), 142 (MyBestBrands), 148 (WEB-API) | -1 (alle) |
| 15 | Mengenstaffelpreis:  Menge ab 20 | default | 20 | nein | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 2 (Ebay), 2.08 (eBay Germany), 4.01 (Amazon Germany), 4.22 (Amazon UK B2B), 9 (eBay Auction), 10 (Google), 11 (Globalelektronik), 104 (Amazon FBA), 104.22 (Amazon FBA UK B2B), 125 (Hood), 142 (MyBestBrands), 148 (WEB-API) | -1 (alle) |
| 16 | Mengenstaffelpreis:  Menge ab 30 | default | 30 | nein | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 2 (Ebay), 2.08 (eBay Germany), 4.01 (Amazon Germany), 4.22 (Amazon UK B2B), 9 (eBay Auction), 10 (Google), 11 (Globalelektronik), 104 (Amazon FBA), 104.22 (Amazon FBA UK B2B), 125 (Hood), 142 (MyBestBrands), 148 (WEB-API) | -1 (alle) |
| 17 | Mengenstaffelpreis:  Menge ab 5 | default | 5 | nein | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 4.01 (Amazon Germany), 10 (Google), 11 (Globalelektronik), 104 (Amazon FBA), 104.22 (Amazon FBA UK B2B), 125 (Hood), 142 (MyBestBrands), 148 (WEB-API) | -1 (alle) |
| 18 | Mengenstaffelpreis:  Menge ab 2 | default | 2 | nein | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 4.01 (Amazon Germany), 4.22 (Amazon UK B2B), 10 (Google), 11 (Globalelektronik), 104 (Amazon FBA), 104.22 (Amazon FBA UK B2B), 125 (Hood), 142 (MyBestBrands), 148 (WEB-API) | -1 (alle) |
| 19 | Mengenstaffelpreis:  Menge 1 | default | 1 | nein | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 4.01 (Amazon Germany), 4.22 (Amazon UK B2B), 10 (Google), 11 (Globalelektronik), 104 (Amazon FBA), 104.22 (Amazon FBA UK B2B), 125 (Hood), 142 (MyBestBrands), 148 (WEB-API) | -1 (alle) |
| 20 | LKW Ladung 33 Stück TKT | default | 33 | nein | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 2 (Ebay), 2.08 (eBay Germany), 4.01 (Amazon Germany), 4.22 (Amazon UK B2B), 9 (eBay Auction), 10 (Google), 11 (Globalelektronik), 104 (Amazon FBA), 104.22 (Amazon FBA UK B2B), 125 (Hood), 142 (MyBestBrands), 148 (WEB-API) | -1 (alle) |
| 21 | Mengenstaffelpreis:  Menge ab 10 | default | 10 | nein | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 2 (Ebay), 2.08 (eBay Germany), 4.01 (Amazon Germany), 4.22 (Amazon UK B2B), 9 (eBay Auction), 10 (Google), 11 (Globalelektronik), 104 (Amazon FBA), 104.22 (Amazon FBA UK B2B), 125 (Hood), 142 (MyBestBrands), 148 (WEB-API) | -1 (alle) |
| 22 | UVP | rrp | 0 | ja | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 2 (Ebay), 2.08 (eBay Germany), 4.01 (Amazon Germany), 4.22 (Amazon UK B2B), 9 (eBay Auction), 10 (Google), 11 (Globalelektronik), 104 (Amazon FBA), 104.22 (Amazon FBA UK B2B), 125 (Hood), 142 (MyBestBrands), 148 (WEB-API) | -1 (alle) |
| 23 | Amazon Aktionspreis TEST | specialOffer | 1 | nein | 4.01 (Amazon Germany) | -1 (alle) |
| 24 | Restposten | default | 1 | nein | 115 (Restposten), 148 (WEB-API) | -1 (alle) |
| 25 | Maschinensucher | default | 1 | ja | 0 (Manuelle Eingabe), 14 (Maschinensucher) | -1 (alle) |
| 26 | Ebay Kleinanzeigen | default | 1 | ja | 1 (Mandant (Shop)) | -1 (alle) |
| 27 | Ebay Verkaufsaktion nur für uns | default | 1 | nein | 148 (WEB-API) | -1 (alle) |
| 28 | Idealo | default | 1 | nein | 148 (WEB-API) | 14443 |
| 29 | Firmenkunde-Shop | default | 1 | nein | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 148 (WEB-API) | 14443, 14616, 15933 |
| 30 | Gebraucht.de | default | 1 | nein | 19 (gebraucht.de), 148 (WEB-API) | 14443, 14616 |
| 31 | Mengenstaffelpreis:  Menge ab 3 | default | 3 | nein | -1 (alle) | -1 (alle) |
| 32 | Mengenstaffelpreis:  Menge ab 4 | default | 4 | nein | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 2 (Ebay), 2.08 (eBay Germany), 4.01 (Amazon Germany), 14 (Maschinensucher), 148 (WEB-API) | -1 (alle) |
| 33 | Mengenstaffelpreis:  Menge ab 12 | default | 12 | nein | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 2 (Ebay), 2.08 (eBay Germany), 4.01 (Amazon Germany), 148 (WEB-API) | -1 (alle) |
| 34 | Mengenstaffelpreis:  Menge ab 24 | default | 24 | nein | 0 (Manuelle Eingabe), 1 (Mandant (Shop)), 2 (Ebay), 2.08 (eBay Germany), 4.01 (Amazon Germany), 15 (Ebay_Kleinanzeigen), 104 (Amazon FBA), 148 (WEB-API) | -1 (alle) |
| 35 | Nettopreis | default | 0 | nein | 1 (Mandant (Shop)) | -1 (alle) |
| 38 | Preisindikator | default | 1 | ja | 186 (ABOUT YOU) | 14443, 24971, 36636 |
| 39 | Shopify | default | 1 | nein | 162 (Shopify) | 14616 |

### Ableitung eBay (Referrer 2.08)

Referrer `2.08` steht in **12** Preislisten: 3, 12, 13, 14, 15, 16, 20, 21, 22,
32, 33, 34. Die Zuordnung allein reicht also nicht. Zwei Felder engen sie ein:

* `type` — Liste 22 ist `rrp` (UVP), keine Verkaufspreisliste.
* `minimumOrderQuantity` — 12 (6), 13 (50), 14 (100), 15 (20), 16 (30), 20 (33),
  21 (10), 32 (4), 33 (12), 34 (24) sind Mengenstaffeln und greifen erst ab
  Menge > 1.

Damit bleibt als Grundpreisliste (`type=default`, `minimumOrderQuantity=1`) mit
Referrer 2.08 **genau eine**: **id 3 „Ebay"**.

Bestaetigt wird das durch die uebrige Referrer-Zuordnung derselben Liste: sie
traegt zusaetzlich 2.03, 2.05, 2.06, 2.07, 2.10, 2.11, 2.12, 2.13, 2.14
(eBay-Laenderplaetze), 9 (eBay Auction) und 15 (Ebay_Kleinanzeigen) — und keinen
einzigen Nicht-eBay-Referrer ausser 0 (Manuelle Eingabe). `clients` ist `-1`,
gilt also fuer alle Mandanten.

**Befund: belegt. `PLENTY_SALES_PRICE_EBAY_ID=3`.**

### Ableitung Webshop (Referrer 1.00 „Mandant (Shop)")

Referrer `1` steht in 18 Preislisten. Nach denselben zwei Feldern
(`type=default`, `minimumOrderQuantity=1`) bleiben vier:

| id | Name | `isDisplayedByDefault` | `clients` | `customerClasses` |
| --- | --- | --- | --- | --- |
| 1 | Webshop | **ja** | 14443, 14616, 15933, 24971, 36636 | 1, 2 |
| 19 | Mengenstaffelpreis: Menge 1 | nein | -1 (alle) | -1 (alle) |
| 26 | Ebay Kleinanzeigen | **ja** | -1 (alle) | -1 (alle) |
| 29 | Firmenkunde-Shop | nein | 14443, 14616, 15933 | 2 (nur Firmenkunden) |

Nimmt man `isDisplayedByDefault` dazu, bleiben **zwei** Kandidaten: **1** und **26**.

Beide sind damit gleich gut belegbar. Die Namen unterscheiden sie deutlich —
aber genau nach dem Namen soll hier nicht entschieden werden, und die
Zuordnung von id 26 ist auffaellig: Die Liste heisst „Ebay Kleinanzeigen",
traegt aber **nicht** Referrer 15.00 (`Ebay_Kleinanzeigen`), sondern 1.00
(`Mandant (Shop)`). Entweder ist das im Mandanten falsch gepflegt, oder die
Liste wird tatsaechlich fuer den Shop benutzt. Aus der API ist das nicht zu
unterscheiden.

**Befund: unsicher. `PLENTY_SALES_PRICE_WEBSHOP_ID` bleibt leer.**
Kandidaten in dieser Reihenfolge: **1** (Name, `clients` nennen die Mandanten
ausdruecklich, `customerClasses` 1+2 also Privat- und Firmenkunden) und **26**.
Zu klaeren ist das nicht in der API, sondern in der Oberflaeche: welche Liste im
Webshop als Preis angezeigt wird. Zusatzhinweis: Liste **39 „Shopify"**
(Referrer 162, `clients` nur 14616) gehoert zu einem zweiten Shop-Kanal —
siehe Punkt 5.

---

## 2. Auftragsherkuenfte

Pfad: `GET /rest/orders/referrers` → HTTP 200, Antwort ist ein **Array** mit
**340** Eintraegen. Felder: `id`, `backendName`, `name`, `origin`, `isEditable`.

Die `id` ist ein **String mit zwei Nachkommastellen** (`"2.08"`, `"1.00"`), in
`sales_prices.referrers[].referrerId` steht dieselbe Herkunft dagegen als
**Zahl** (`2.08`, `1`). Beim Vergleich muss also numerisch normalisiert werden.

### Bestaetigung der Inventur

| Erwartet | `id` | `backendName` | `name` | `origin` | Befund |
| --- | --- | --- | --- | --- | --- |
| eBay Germany | `2.08` | eBay Germany | eBay [DE] | plenty | **bestaetigt** |
| Mandant (Shop) | `1.00` | **Mandant (Shop)** | **Webseite** | plenty | **bestaetigt** |
| Amazon | `4.01` | Amazon Germany | Amazon [DE] | plenty | **bestaetigt** |
| Manuelle Eingabe | `0.00` | Manuelle Eingabe | Manuell | plenty | **bestaetigt** |

Der Shop-Referrer heisst im Backend genau **„Mandant (Shop)"**, nach aussen
**„Webseite"**.

### Weitere eBay-Herkuenfte

Ja, es gibt sie — 23 Stueck in der Familie `2.x`:

| `id` | `backendName` |
| --- | --- |
| 2.00 | Ebay |
| 2.01 | eBay United States |
| 2.02 | eBay Canada (English) |
| 2.03 | eBay UK |
| 2.04 | eBay Australia |
| 2.05 | eBay Austria |
| 2.06 | eBay Belgium (French) |
| 2.07 | eBay France |
| **2.08** | **eBay Germany** |
| 2.09 | eBay Motors |
| 2.10 | eBay Italy |
| 2.11 | eBay Belgium (Dutch) |
| 2.12 | eBay Netherlands |
| 2.13 | eBay Spain |
| 2.14 | eBay Switzerland |
| 2.15 | eBay Hong Kong |
| 2.16 | eBay India |
| 2.17 | eBay Ireland |
| 2.18 | eBay Malaysia |
| 2.19 | eBay Canada (French) |
| 2.20 | eBay Philippines |
| 2.21 | eBay Poland |
| 2.22 | eBay Singapore |

Ausserhalb der `2.x`-Familie tragen drei weitere Herkuenfte eBay im Namen:
**9.00** (`name` „eBay Auction", `backendName` leer), **15.00**
(`name` „Ebay_Kleinanzeigen", `backendName` leer) und **20.00**
(`backendName` „EbayFulfillment", `origin` `EbayFulfillment`).

Fuer Deutschland ist **2.08** die richtige und einzige Herkunft.

### Tatsaechlicher Auftragsanteil, letzte 30 Tage

Pfad: `GET /rest/orders?itemsPerPage=50&createdAtFrom=<W3C>`, alle 870 Auftraege
ausgezaehlt ueber Feld `referrerId`. (Hinweis: `createdAtFrom` verlangt volles
W3C-Format, ein reines Datum wird mit HTTP 422 abgelehnt.)

| `referrerId` | Name | Auftraege |
| --- | --- | --- |
| 2.08 | eBay Germany | **565** |
| 0 | Manuelle Eingabe | 192 |
| 1 | Mandant (Shop) | 84 |
| 4.01 | Amazon Germany | 23 |
| 15 | Ebay_Kleinanzeigen | 5 |
| 16 | (ohne backendName) | 1 |
| 162 | Shopify | **0** |

Der eigene Shop laeuft also ueber Referrer **1.00**, nicht ueber 162 (Shopify) —
ueber 162 kam in 30 Tagen kein einziger Auftrag.

---

## 3. Versandprofile

Pfad: `GET /rest/orders/shipping/presets?itemsPerPage=250` → HTTP 200, Antwort
ist ein **Array** mit **32** Eintraegen. Felder: `id`, `backendName`,
`parcelServiceId`.

### Alle 32 Profile

| `id` | `parcelServiceId` | `backendName` |
| --- | --- | --- |
| 10 | 107 | DPD Versandkostenfrei |
| 11 | 103 | Spedition 85€ |
| 12 | 105 | Selbstabholung/Nach Absprache (Z) |
| 14 | 101 | DHL |
| 16 | 108 | ter Hürne GmbH (Z) |
| 20 | 109 | FSK 18 - 7,90 € (Z) |
| 31 | 113 | UPS Paket (Z) |
| 37 | 101 | DHL Express (Z) |
| 40 | 118 | Selbstauslieferung (Z) |
| 41 | 120 | Hövelmann (Z) |
| 42 | 121 | FedEx (Z) |
| 43 | 107 | Paket bis 5kg 7,90 € (Z) |
| 44 | 107 | Paket bis 10kg 9,90 € (Z) |
| 45 | 107 | Paket bis 30kg 14,90 € (Z) |
| 46 | 107 | Paket bis 30kg 19,90 € (Z) |
| 47 | 107 | Paket bis 30kg 29,90 € (Z) |
| 48 | 103 | Spedition 85 + 85 (Z) |
| 49 | 103 | Spedition 119 + 119 (Z) |
| 50 | 103 | Spedition 179 + 179 (Z) |
| 51 | 103 | Spedition 219 + 219 (Z) |
| 52 | 103 | Spedition 299 + 299 (Z) |
| 53 | 103 | Spedition 450 + 450 (Z) |
| 54 | 103 | Spedition 500 + 500 (Z) |
| 55 | 103 | Spedition 690 + 690 (Z) |
| 56 | 103 | Spedition 850 + 850 (Z) |
| 57 | 104 | GLS (Sperrgut) bis 40kg 49 + 49 (Z) |
| 58 | 122 | Rottbeck (Z) |
| 59 | 123 | Fremdspedition (Z) |
| 60 | 103 | Spedition 349 + 349 (Z) |
| 61 | 107 | DPD 7,90 (nur Deutschland) |
| 62 | 107 | Paket 7,90 + 0 € (Z) |
| 63 | 125 | DHL Paket Inland |

Hinweis: Die `backendName` sind hier auf lesbaren Abstand normalisiert. Im
Mandanten tragen einige zusaetzliche Leerzeichen — id 14 lautet `"DHL "`,
id 43 `"Paket bis 5kg 7,90 € (Z) "`, id 62 `"Paket  7,90 + 0 € (Z) "` (zwei
Leerzeichen nach „Paket", je ein Leerzeichen am Ende). Wer per Textvergleich
zuordnet, muss vorher trimmen.

### Zuordnung je Betrag

Gesucht wurde im Feld `backendName` nach dem Betrag mit Ziffern-Grenze, damit
„9,90" nicht auf „19,90" und „29,90" anschlaegt.

| Gesucht | Treffer im `backendName` | eindeutig? |
| --- | --- | --- |
| **7,90 (bis 5 kg)** | **20** „FSK 18 - 7,90 € (Z)" · **43** „Paket bis 5kg 7,90 € (Z)" · **61** „DPD 7,90 (nur Deutschland)" · **62** „Paket 7,90 + 0 € (Z)" | **vier** Treffer auf den Betrag — aber nur bei **43** nennt der `backendName` auch die Gewichtsklasse „bis 5kg". |
| **9,90 (bis 10 kg)** | **44** „Paket bis 10kg 9,90 € (Z)" | **ja, eindeutig** |
| **14,90 (bis 30 kg)** | **45** „Paket bis 30kg 14,90 € (Z)" | **ja, eindeutig** |
| **19,90 (bis 30 kg)** | **46** „Paket bis 30kg 19,90 € (Z)" | **ja, eindeutig** |
| **29,90 (bis 30 kg)** | **47** „Paket bis 30kg 29,90 € (Z)" | **ja, eindeutig** |
| **Spedition (über 30 kg)** | **12** Treffer: 11, 48, 49, 50, 51, 52, 53, 54, 55, 56, 60 („Spedition …") und 59 („Fremdspedition") | **nein — kein eindeutiger** |

Anmerkungen, die vor dem Uebernehmen zu lesen sind:

* Die Inventur nennt **drei** 7,90er-Profile (43, 61, 62). Es sind **vier** —
  **id 20 „FSK 18 - 7,90 € (Z)"** fehlt dort. Es faellt ueber den `backendName`
  raus (Altersfreigabe FSK 18, `parcelServiceId` 109 statt 107), aber es traegt
  denselben Betrag und gehoert in die Liste.
* **43 gegen 61 gegen 62**: alle drei haben `parcelServiceId` 107 (dieselbe
  DPD-Kennung). Getrennt werden sie nur durch den `backendName`: 43 nennt die
  Gewichtsklasse „bis 5kg", 61 schraenkt auf „nur Deutschland" ein, 62 ist die
  Variante „+ 0 €" ohne Gewichtsangabe. Weil die gesuchte Zeile ausdruecklich
  „7,90 bis 5 kg" lautet und nur 43 beides im Namen fuehrt, ist **43** gesetzt.
  Passt die Gewichtsklasse nicht zur Absicht, ist der Wert zu pruefen.
* **45, 46, 47** heissen alle drei „Paket bis 30kg" und unterscheiden sich im
  `backendName` **nur** im Betrag. Die Zusaetze „normal", „sperrig",
  „sperrig+schwer" stehen **nirgends in den Daten**. Die Zuordnung stuetzt sich
  also allein auf den Betrag — der aber ist je Profil eindeutig.
* **Spedition**: elf Profile „Spedition <Betrag> + <Betrag>" plus
  „Fremdspedition". Ohne einen Zielbetrag ist keines auszuzeichnen. Auch
  **57 „GLS (Sperrgut) bis 40kg 49 + 49 (Z)"** waere fuer „ueber 30 kg" ein
  Kandidat, heisst aber nicht „Spedition". **Bleibt leer.**

---

## 4. Lager

Pfad: `GET /rest/stockmanagement/warehouses?itemsPerPage=50` → HTTP 200, Antwort
ist ein **Array** mit **9** Eintraegen. Felder: `id`, `name`, `typeId`,
`logisticsType`.

Die Bestandszeilen sind je Lager einzeln nachgezaehlt ueber
`GET /rest/stockmanagement/stock?warehouseId=<id>&itemsPerPage=1`, Feld
`totalsCount`.

| `id` | `name` | `typeId` | `logisticsType` | Bestandszeilen |
| --- | --- | --- | --- | --- |
| **106** | **Burlo** | 0 | own | **61 118** |
| 107 | FBA | 1 | amazon | 0 |
| 108 | Drop Shipping | 0 | own | 478 |
| 109 | Hildesheim | 0 | own | 445 |
| 110 | Borken I | 0 | own | 4 340 |
| 111 | Borken II | 0 | own | 583 |
| 112 | Oeding | 0 | own | 225 |
| 113 | Transfer | 5 | own | 54 |
| 115 | Rostock | 7 | own | 1 |

**Befund: bestaetigt.** Burlo = **106** haelt 61 118 von 67 244 Bestandszeilen
(90,9 %) und ist mit weitem Abstand das Hauptlager. Die Inventur nannte 61 114 —
die vier Zeilen Unterschied sind laufender Betrieb, nicht Widerspruch.

**`PLENTY_WAREHOUSE_ID=106`.**

---

## 5. Webshops

Pfad: `GET /rest/webstores` → HTTP 200, Antwort ist ein **Array** mit **6**
Eintraegen. Felder: `id`, `type`, `storeIdentifier`, `name`, `pluginSetId`,
`configuration`.

Die Liste selbst enthaelt **keine** Domain. Sie steht im mitgelieferten Objekt
`configuration`, Felder **`configuration.domain`** und
**`configuration.domainSsl`**. Ein Nachschlagen unter `/rest/webstores/{id}`
war dafuer nicht noetig.

| `id` | `storeIdentifier` (= plentyId) | `name` | `configuration.domainSsl` | `configuration.domain` | `pluginSetId` |
| --- | --- | --- | --- | --- | --- |
| 0 | **14443** | www.besttra.de | `https://www.besttra.de` | `http://www.besttra.de` | 32 |
| 1 | **14616** | Komplett Konzept | `https://www.komplett-konzept.de` | `http://www.komplett-konzept.de` | 31 |
| 2 | 15218 | Scala Deutschland | `http://www.scaladeutschland.de` (kein https) | `http://www.scaladeutschland.de` | 3 |
| 3 | 15933 | Gastrokönig | `https://www.gastro-koenig.de` | `http://www.gastro-koenig.de` | 10 |
| 4 | 36636 | Parlitz Partner | *(leer)* | *(leer)* | 5 |
| 5 | 24971 | Komplett Konzept int. | `https://www.komplett-konzept.com` | `http://www.komplett-konzept.com` | 30 |

### Zur Einordnung

Die Zugangsdaten zeigen auf Mandant **14443** (`PLENTY_BASE_URL` =
`https://p14443.my.plentysystems.com`), das ist `besttra.de`.

Die Auftraege sagen etwas anderes. Alle 870 Auftraege der letzten 30 Tage
ausgezaehlt ueber das Feld `plentyId` (`GET /rest/orders?itemsPerPage=50&createdAtFrom=<W3C>`):

| `plentyId` | Webshop | Auftraege (30 Tage) |
| --- | --- | --- |
| **14616** | Komplett Konzept | **822** |
| 14443 | www.besttra.de | 40 |
| 15933 | Gastrokönig | 4 |
| 36636 | Parlitz Partner | 4 |

Das deckt sich mit der Inventur (dort 828 zu 41 von 877). Der Query-Parameter
`plentyId` wird von `/rest/orders` uebrigens **ignoriert** — gefiltert mit
`plentyId=<x>` kommen unveraendert 870 zurueck. Ausgezaehlt wurde deshalb ueber
das Feld der einzelnen Auftraege, nicht ueber den Filter.

**Es wird hier nicht entschieden, welcher Shop „unserer" ist.** Der technische
Zugang (14443 / besttra.de) und das Auftragsaufkommen (14616 /
komplett-konzept.de) zeigen auf zwei verschiedene Shops. Dazu passt, dass die
Preisliste 39 „Shopify" ausschliesslich `clients` 14616 traegt — 14616 haengt
an einem zweiten Kanal. **`SHOP_BASIS_URL` bleibt leer**, die beiden
realistischen Werte sind `https://www.besttra.de` und
`https://www.komplett-konzept.de`.

---

## 6. Barcode-Konfiguration

Pfad: `GET /rest/items/barcodes?itemsPerPage=50` → HTTP 200, Antwort ist ein
**Array** mit **18** Eintraegen. Felder: `id`, `name`, `type`, `referrers`.

### Alle GTIN_13-Konfigurationen

| `id` | `name` | `type` | `referrers` |
| --- | --- | --- | --- |
| 1 | EAN_13 1 | GTIN_13 | -1 (alle) |
| **2** | **EAN_13 2** | **GTIN_13** | -1 (alle) |
| 3 | EAN_13 3 | GTIN_13 | -1 (alle) |
| 4 | EAN_13 4 | GTIN_13 | -1 (alle) |
| 23 | Fotostudio | GTIN_13 | 190 einzeln aufgezaehlte Referrer |

Die uebrigen 13 sind CODE_128 (5–8), GTIN_128 (9–12), UPC (13–16) und ISBN (17).

**Es gibt also fuenf GTIN_13-Konfigurationen, nicht eine.** id 2 ist als
„EAN_13 2" vom Typ GTIN_13 **bestaetigt** — aber die Eintraege 1 bis 4 sind
ueber `name`, `type` und `referrers` **nicht voneinander zu unterscheiden**.
Der Name allein traegt die Entscheidung nicht.

### Was den Ausschlag gibt

Nachgesehen, welche `barcodeId` an den Varianten tatsaechlich haengt:
`GET /rest/items/variations?itemsPerPage=250&page=1..8&with=variationBarcodes`,
Feld `variationBarcodes[].barcodeId`.

Stichprobe **2 000 Varianten**, darin 1 588 Barcode-Eintraege:

| `barcodeId` | Eintraege | Anteil |
| --- | --- | --- |
| **2** | **1 432** | **90,2 %** |
| 1 | 146 | 9,2 % |
| 13 (UPC 1) | 6 | 0,4 % |
| 5 (CODE_128 1) | 4 | 0,3 % |

**Befund: belegt — nicht ueber den Namen, sondern ueber die Nutzung.**
`PLENTY_EAN_BARCODE_ID=2`. Dass id 1 mit 146 Eintraegen ebenfalls gepflegt ist,
gehoert zur Wahrheit dazu; fuer neue Artikel ist 2 die produktiv genutzte.

---

## 7. Auffangkategorie

Pfad: `GET /rest/categories?type=item&itemsPerPage=250` → der Parameter wird auf
**50 pro Seite gedeckelt**, also 25 Seiten. Alle **1 242** Kategorien geladen.
Felder: `id`, `parentCategoryId`, `level`, `details[].name` (lang `de`).
Der Kategorieweg ist ueber `parentCategoryId` bis zur Wurzel aufgeloest.

Gesucht wurde nach exakten Namen `Sonstiges`, `Sonstige`, `Sonstiger`,
`Diverses`, `Diverse`, `Verschiedenes`, `Verschiedene`, `Restposten`.

**60 Treffer** — davon 53× **„Sonstiges"** und 7× **„Sonstige"**.
**„Diverses", „Verschiedenes" und „Restposten" gibt es als Kategorie gar nicht.**

Verteilung nach `level`: 1× level 2, 7× level 3, 20× level 4, 30× level 5, 2× level 6.
**Auf Wurzelebene (level 1) gibt es keinen einzigen Treffer.**

### Alle 60 Treffer

| `id` | Name | `parentCategoryId` | `level` | Voller Kategorieweg |
| --- | --- | --- | --- | --- |
| 1702 | „Sonstiges" | 361 | 2 | Möbel & Wohnen > Sonstiges |
| 183 | „Sonstige" | 182 | 3 | Industriebedarf > Betriebsausstattung & Logistik > Sonstige |
| 243 | „Sonstiges" | 242 | 3 | Industriebedarf > Pumpen & Rohrleitungsbau > Sonstiges |
| 304 | „Sonstige" | 294 | 3 | Industriebedarf > Baugewerbe > Sonstige |
| 1073 | „Sonstiges" | 1072 | 3 | Haus Heimwerken und Freizeit > Sport & Freizeit > Sonstiges |
| 1080 | „Sonstiges" | 1079 | 3 | Haus Heimwerken und Freizeit > Möbel & Wohnen > Sonstiges |
| 1427 | „Sonstige" | 392 | 3 | Heimwerker, Haus & Garten > Spielwaren > Sonstige |
| 2398 | „Sonstiges" | 159 | 3 | Industriebedarf > Ladenausstattung > Sonstiges |
| 63 | „Sonstiges" | 62 | 4 | Haus Heimwerken und Freizeit > Heimwerker, Haus & Garten > Garten > Sonstiges |
| 101 | „Sonstiges" | 100 | 4 | Industriebedarf > Sonstige Branchen & Produkte > Druckerei & Copyshop > Sonstiges |
| 503 | „Sonstiges" | 83 | 4 | Elektronik & Elektrotechnik > Elektromaterial > Schalterprogramm > Sonstiges |
| 893 | „Sonstige" | 324 | 4 | Haus Heimwerken und Freizeit > Heimwerker, Haus & Garten > Elektrowerkzeuge > Sonstige |
| 1184 | „Sonstiges" | 1170 | 4 | Filter & Sortierungen > Neu im Shop einsortiern > Klempner-König > Sonstiges |
| 1434 | „Sonstige" | 1352 | 4 | Heimwerker, Haus & Garten > Spielwaren > Elektronisches Spielzeug > Sonstige |
| 1567 | „Sonstige" | 1560 | 4 | Filter & Sortierungen > Neu im Shop einsortiern > Automation, Antrieb, Steuerung > Sonstige |
| 1682 | „Sonstiges" | 1639 | 4 | Filter & Sortierungen > Neu im Shop einsortiern > Business & Industrie > Sonstiges |
| 2376 | „Sonstiges" | 163 | 4 | Industriebedarf > Ladenausstattung > Kassen & Abrechnungssysteme > Sonstiges |
| 2389 | „Sonstiges" | 2385 | 4 | Industriebedarf > Ladenausstattung > Präsentation & Verkauf > Sonstiges |
| 2393 | „Sonstiges" | 2390 | 4 | Industriebedarf > Ladenausstattung > Beleuchtung & Werbung > Sonstiges |
| 2397 | „Sonstiges" | 2394 | 4 | Industriebedarf > Ladenausstattung > Geräte & Technik > Sonstiges |
| 2403 | „Sonstiges" | 1545 | 4 | Industriebedarf > Betriebsausstattung & Logistik > Leitern und Arbeitsplattformen > Sonstiges |
| 2406 | „Sonstiges" | 260 | 4 | Industriebedarf > Betriebsausstattung & Logistik > Kran & Hebetechnik > Sonstiges |
| 2409 | „Sonstiges" | 199 | 4 | Industriebedarf > Betriebsausstattung & Logistik > Erste Hilfe > Sonstiges |
| 2413 | „Sonstiges" | 248 | 4 | Industriebedarf > Betriebsausstattung & Logistik > Lampen & Leuchtmittel > Sonstiges |
| 2421 | „Sonstiges" | 196 | 4 | Industriebedarf > Betriebsausstattung & Logistik > Abfallbehälter & Zubehör > Sonstiges |
| 2424 | „Sonstiges" | 189 | 4 | Industriebedarf > Betriebsausstattung & Logistik > Arbeitskleidung & Schutz > Sonstiges |
| 2429 | „Sonstiges" | 184 | 4 | Industriebedarf > Betriebsausstattung & Logistik > Reinigung & Hygiene > Sonstiges |
| 2440 | „Sonstiges" | 2431 | 4 | Industriebedarf > Betriebsausstattung & Logistik > Betriebseinrichtung > Sonstiges |
| 477 | „Sonstige" | 474 | 5 | Industriebedarf > Sonstige Branchen & Produkte > Audio, Foto & Video > Foto & Camcorder > Sonstige |
| 967 | „Sonstiges" | 962 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Auto, LKW, Zubehör > Sonstiges |
| 980 | „Sonstiges" | 975 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Baugewerbe > Sonstiges |
| 981 | „Sonstiges" | 968 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Automation, Antrieb, Steuerung > Sonstiges |
| 992 | „Sonstiges" | 982 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Betriebsausstattung > Sonstiges |
| 998 | „Sonstiges" | 994 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Bürobedarf > Sonstiges |
| 1009 | „Sonstiges" | 1000 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Computer & Zubehör > Sonstiges |
| 1023 | „Sonstiges" | 1011 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Elektronik & Messtechnik > Sonstiges |
| 1027 | „Sonstiges" | 1024 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Garten & Terrasse > Sonstiges |
| 1034 | „Sonstiges" | 1033 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Gastronomie > Sonstiges |
| 1050 | „Sonstiges" | 1046 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Werkzeuge & Werkstattbedarf > Sonstiges |
| 1055 | „Sonstiges" | 1053 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Sonstige Branchen & Produkte > Sonstiges |
| 1064 | „Sonstiges" | 1057 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Produktions & Industriebedarf > Sonstiges |
| 1087 | „Sonstiges" | 1078 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Metallbearbeitung -Schlosserei > Sonstiges |
| 1093 | „Sonstiges" | 1077 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Medizin & Labor > Sonstiges |
| 1100 | „Sonstiges" | 1099 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Ladenausstattung & Einrichtung > Sonstiges |
| 1108 | „Sonstiges" | 1104 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Kabel, Stecker & Zubehör > Sonstiges |
| 1116 | „Sonstiges" | 1114 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Holzbearbeitung & Tischlerei > Sonstiges |
| 1128 | „Sonstiges" | 1113 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Heizung & Sanitär > Sonstiges |
| 1129 | „Sonstiges" | 1112 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Haustierbedarf > Sonstiges |
| 1132 | „Sonstiges" | 1111 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Haushaltsgeräte > Sonstiges |
| 1152 | „Sonstiges" | 1110 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Handwerker & Heimwerken > Sonstiges |
| 1642 | „Sonstiges" | 1640 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Business & Industrie > Produktion & Industriebedarf > Sonstiges |
| 1662 | „Sonstiges" | 1657 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Business & Industrie > Baugewerbe > Sonstiges |
| 1671 | „Sonstiges" | 1667 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Business & Industrie > Ladeneinrichtung > Sonstiges |
| 1679 | „Sonstiges" | 1672 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Business & Industrie > Medizin & Labor > Sonstiges |
| 1692 | „Sonstiges" | 1688 | 5 | Filter & Sortierungen > Neu im Shop einsortiern > Business & Industrie > Arbeitsschutz PSA > Sonstiges |
| 2419 | „Sonstiges" | 2415 | 5 | Industriebedarf > Betriebsausstattung & Logistik > Abfallbehälter & Zubehör > Wertstoffsysteme > Sonstiges |
| 2441 | „Sonstiges" | 2432 | 5 | Industriebedarf > Betriebsausstattung & Logistik > Betriebseinrichtung > Werkstattausstattung > Sonstiges |
| 2461 | „Sonstiges" | 2443 | 5 | Industriebedarf > Betriebsausstattung & Logistik > Betriebseinrichtung > Büromöbel > Sonstiges |
| 1159 | „Sonstiges" | 1148 | 6 | Filter & Sortierungen > Neu im Shop einsortiern > Industrie-und-Handwerk > Handwerker & Heimwerken > Handwerkzeuge > Sonstiges |
| 2300 | „Sonstiges" | 2286 | 6 | Haus Heimwerken und Freizeit > Heimwerker, Haus & Garten > Fenster & Türen > Türbeschläge & Drückergarnituren > Einzelteile & Zubehör > Sonstiges |

### Taugt eine davon als allgemeine Auffangkategorie?

**Nein.**

* **Auf Wurzelebene gibt es keine.** Von den 28 Wurzelkategorien (`level` 1)
  heisst keine „Sonstiges", „Diverses", „Verschiedenes" oder „Restposten".
  Die 28 lauten: Elektronik & Elektrotechnik (81), Autom.,Antrieb,Steuerung
  (208), Labor & Medizintechnik (217), Gastronomie (323), IMPORT AUFTRÄGE (351),
  Möbel & Wohnen (361), Küchenbedarf (452), Kaffee/Bartechnik (453), Geräte
  (456), Kühlen (463), Gastro-Möbel (464), Spülen (469), Fleischerei (470),
  Lagertechnik (490), Industriebedarf (895), Heimwerker, Haus & Garten (1204),
  Haus Heimwerken und Freizeit (1505), Bekleidung (1526), Suchergebnis (1543),
  Dienstleistungen (1552), Import (nicht löschen!) (1558), Filter &
  Sortierungen (2240), Dummy (2246), Import/Export-Test (2248), Elektronik &
  Elektrotechnik (2476), Industriebedarf Neu (2478), Projekte (2632),
  Amanuel Test (2686).
* **Der einzige Treffer auf oberster nutzbarer Ebene** ist
  **id 1702 „Sonstiges"** (`level` 2, `parentCategoryId` 361), Weg:
  *Möbel & Wohnen > Sonstiges*. Das ist die Restekategorie **eines einzelnen
  Warenbereichs**, nicht des Sortiments. Gebrauchte Industrieware dort
  einzuhaengen waere sachlich falsch.
* **Alle uebrigen 59** liegen auf `level` 3 bis 6 und haengen jeweils unter
  einem fachlichen Ast (*Industriebedarf > Pumpen & Rohrleitungsbau >
  Sonstiges*, *Elektronik & Elektrotechnik > Elektromaterial >
  Schalterprogramm > Sonstiges* und so weiter). Keine davon ist allgemein.
* Der Name **„Sonstiges" ist 53-fach vergeben**. Eine Zuordnung ueber den Namen
  ist damit von vornherein nicht eindeutig.

**Befund: es gibt keine allgemeine Auffangkategorie.
`PLENTY_SAMMEL_CATEGORY_ID` bleibt leer.** Es wurde **keine angelegt**.

Wer den Wert fuellen will, hat zwei Wege, und beide gehoeren dem Anwender:
eine neue Wurzelkategorie anlegen, oder bewusst eine bestehende bestimmen.

### Randnotiz zur Vollstaendigkeit

Eine Kategorie verweist auf `parentCategoryId` **1457**, die in
`?type=item` nicht enthalten ist (vermutlich eine Kategorie anderen Typs).
Deren Weg bricht im Tabellenfeld mit `[#1457 fehlt]` ab. Keiner der 60 Treffer
ist davon betroffen.

---

## Ergebnis

```
PLENTY_SALES_PRICE_EBAY_ID=3
PLENTY_SALES_PRICE_WEBSHOP_ID=
PLENTY_SAMMEL_CATEGORY_ID=
PLENTY_MARKET_IDS=2.08,1.00
PLENTY_VERSANDPROFILE=7.90=43,9.90=44,14.90=45,19.90=46,29.90=47,spedition=
PLENTY_WAREHOUSE_ID=106
PLENTY_EAN_BARCODE_ID=2
SHOP_BASIS_URL=
```

### Was gefuellt ist und woraus

| Wert | Beleg |
| --- | --- |
| `PLENTY_SALES_PRICE_EBAY_ID=3` | `/rest/items/sales_prices`, `referrers[].referrerId` enthaelt 2.08; einzige Liste mit `type=default` **und** `minimumOrderQuantity=1` |
| `PLENTY_MARKET_IDS=2.08,1.00` | `/rest/orders/referrers`, Feld `id` + `backendName` („eBay Germany", „Mandant (Shop)") |
| `PLENTY_VERSANDPROFILE` 9.90/14.90/19.90/29.90 | `/rest/orders/shipping/presets`, Feld `backendName`, je Betrag genau ein Treffer |
| `PLENTY_VERSANDPROFILE` 7.90=43 | `backendName` „Paket bis 5kg 7,90 € (Z)" — einziger der **vier** 7,90er-Treffer mit der Gewichtsklasse „bis 5kg" |
| `PLENTY_WAREHOUSE_ID=106` | `/rest/stockmanagement/warehouses`, Feld `name` „Burlo"; 61 118 von 67 244 Bestandszeilen |
| `PLENTY_EAN_BARCODE_ID=2` | `/rest/items/barcodes` Feld `type` GTIN_13 **plus** Nutzung: 1 432 von 1 588 `variationBarcodes[].barcodeId` in 2 000 Varianten |

### Was leer bleibt und warum

| Wert | Grund |
| --- | --- |
| `PLENTY_SALES_PRICE_WEBSHOP_ID` | Zwei Preislisten sind gleich gut belegbar: **1** („Webshop") und **26** („Ebay Kleinanzeigen", traegt aber Referrer 1.00). Beide `type=default`, `minimumOrderQuantity=1`, `isDisplayedByDefault=true`. Aus der API nicht zu trennen. |
| `PLENTY_SAMMEL_CATEGORY_ID` | Es existiert keine allgemeine Auffangkategorie. 60 Treffer, alle fachlich gebunden, keiner auf Wurzelebene, „Sonstiges" 53-fach vergeben. |
| `PLENTY_VERSANDPROFILE` → `spedition` | 12 Kandidaten (11× „Spedition <Betrag> + <Betrag>", 1× „Fremdspedition"). Ohne Zielbetrag keiner auszuzeichnen. |
| `SHOP_BASIS_URL` | Zwei Shops kommen in Frage: `https://www.besttra.de` (Mandant der Zugangsdaten, 14443) und `https://www.komplett-konzept.de` (822 von 870 Auftraege, 14616). Die Entscheidung liegt beim Anwender. |

---

## Erhebungsweg

Alle Aufrufe lesend. Ein `POST /rest/login` je Skriptlauf, danach ausschliesslich `GET`.

| Punkt | Pfad |
| --- | --- |
| 1 | `GET /rest/items/sales_prices?itemsPerPage=100` |
| 2 | `GET /rest/orders/referrers` · `GET /rest/orders?itemsPerPage=50&page=1..18&createdAtFrom=<W3C>` |
| 3 | `GET /rest/orders/shipping/presets?itemsPerPage=250` |
| 4 | `GET /rest/stockmanagement/warehouses?itemsPerPage=50` · `GET /rest/stockmanagement/stock?warehouseId=<id>&itemsPerPage=1` |
| 5 | `GET /rest/webstores` (Domain steht in `configuration.domainSsl`) |
| 6 | `GET /rest/items/barcodes?itemsPerPage=50` · `GET /rest/items/variations?itemsPerPage=250&page=1..8&with=variationBarcodes` |
| 7 | `GET /rest/categories?type=item&itemsPerPage=50&page=1..25` |

Zwei Stolpersteine, die beim Nachvollziehen Zeit sparen:

* `/rest/categories` deckelt `itemsPerPage` bei **50**, egal was angefragt wird.
* `/rest/orders` verlangt fuer `createdAtFrom` volles **W3C-Format**
  (`2026-08-23T13:48:23Z`); ein reines Datum quittiert es mit HTTP 422. Der
  Parameter `plentyId` wird dort **ignoriert**.
