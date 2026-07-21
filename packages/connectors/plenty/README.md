# @youman/connector-plenty

Plentymarkets-REST-Connector für die adept&-Plattform. Implementiert das
`IErpConnector`-Interface aus `@youman/connector-sap` und wird im Backend
über den Connector-Typ `PLENTY` registriert. Alle Plenty-Calls laufen
ausschließlich über das NestJS-Backend – Credentials erreichen niemals den
Electron-Client (das Backend redigiert das Passwort in der
`GET /tenants/connector`-Response; ein leeres Passwort-Feld beim Speichern
behält das gespeicherte Passwort bei).

## Plenty-API-Benutzer einrichten (Least Privilege)

1. In Plenty: **Einrichtung » Einstellungen » Benutzer » Konten** einen neuen
   Benutzer anlegen und als **Zugang: „API"** konfigurieren (kein
   Backend-/Frontend-Zugang).
2. Dem Benutzer über eine eigene Rolle nur die benötigten Rechte geben:
   - **Kontakte**: lesen + schreiben (Kundensuche, Kunden-/Adress-Anlage)
   - **Artikel**: lesen (Varianten-Suche, Preise, Bestände)
   - **Aufträge**: lesen + schreiben (Angebots-/Auftragsanlage)
3. Login-Endpunkt ist `POST /rest/login`; der `accessToken` ist 24 h gültig
   und wird vom Connector automatisch verwaltet (proaktiver Refresh bei
   < 30 min Restlaufzeit, reaktiver Refresh bei 401, Re-Login als Fallback).

## Config-Beispiel (Connector-Config des Tenants)

```json
{
  "connectorType": "PLENTY",
  "displayName": "Plentymarkets",
  "enabled": true,
  "config": {
    "baseUrl": "https://xy123.my.plentysystems.com/rest",
    "username": "api-user",
    "password": "•••",
    "plentyId": 1000,
    "defaultWarehouseId": 1,
    "defaultCurrency": "EUR",
    "defaultReferrerId": 1
  }
}
```

`baseUrl` darf mit oder ohne `/rest`-Suffix angegeben werden; der Connector
normalisiert die URL. `plentyId` ist die Mandanten-ID und für die
Auftragsanlage Pflicht.

## Mapping auf das IErpConnector-Interface

| Methode | Plenty-Endpoint |
|---|---|
| `searchCustomers` | `GET /rest/accounts/contacts` (Heuristik: `@` → `email`, nur Ziffern → `externalId`, sonst `name`) |
| `getCustomer` | `GET /rest/accounts/contacts/{id}?with=addresses` |
| `createCustomer` | `POST /rest/accounts/contacts` + `POST …/{id}/addresses` (typeId 1 = Rechnung, 2 = Lieferung) |
| `updateCustomer` | `PUT /rest/accounts/contacts/{id}` |
| `getCustomerAddresses` / `createCustomerAddress` | `GET`/`POST /rest/accounts/contacts/{id}/addresses` |
| `searchProducts` | `GET /rest/items/variations?with=item,variationSalesPrices,stock,variationBarcodes` (EAN-artige Query → `barcode`, kompakte Codes → `numberFuzzy` mit `itemName`-Fallback, sonst `itemName`) |
| `getProduct` / `getProductPrice` | Varianten-Abfrage; Preis = Verkaufspreis mit der niedrigsten `salesPriceId` (Plenty-Default-Preis) |
| `getProductStock` | aus `with=stock`; Fallback `GET /rest/stockmanagement/warehouses/{id}/stock/variations` |
| `createQuote` | `POST /rest/orders` mit `typeId 4` (Angebot) |
| `createSalesOrder` | `POST /rest/orders` mit `typeId 1` (Auftrag) |

**Wichtig:** Plenty trennt Items (Artikel) und Variations (Varianten);
bestellbar sind immer Variations. `Product.id` ist deshalb die
**Variations-ID** und wird bei der Auftragsanlage als `itemVariationId`
verwendet.

## Rate Limiting

Alle Requests laufen durch einen Wrapper, der die Plenty-Rate-Limit-Header
(`X-Plenty-Global-Long-Period-*`, `X-Plenty-Global-Short-Period-*` sowie
routen-spezifische Varianten) nach jedem Response auswertet:

- Fallen die verbleibenden Calls einer Periode unter **10 % des Limits**,
  werden folgende Requests bis zum Ablauf des `Decay`-Fensters gedrosselt.
- **HTTP 429**: Exponential Backoff mit Jitter, maximal 3 Wiederholungen,
  danach `RateLimitError`.
- **HTTP 5xx**: maximal 2 Wiederholungen mit Backoff.
- Alle Wartezeiten und Wiederholungen werden geloggt.

## Fehler-Typen

`AuthError`, `RateLimitError`, `NotFoundError`, `ValidationError` (übersetzt
Plentys feldweise Validation-Responses in lesbare Meldungen),
`NotSupportedError` – alle mit stabilem `code`-Feld.

## Nicht unterstützte Operationen (Interface-Gaps)

Folgende `IErpConnector`-Methoden werfen `NotSupportedError`, weil
Plentymarkets kein sinnvolles 1:1-Gegenstück bietet. Das Interface wurde
bewusst **nicht** erweitert:

- `createProduct` – Artikel-Anlage in Plenty ist ein mehrstufiger Prozess
  (Item + Variante + Texte + Preise) und gehört in die Plenty-Oberfläche.
- `reserveStock` – Plenty hat keine eigenständige Reservierungs-API;
  Bestände werden implizit über Aufträge reserviert.
- `createFollowUpTask`, `createAppointment`, `createNote` – die
  Plenty-REST-API kennt keine generischen CRM-Aufgaben-/Termin-/Notiz-Objekte.

## Bekannte Limitierungen

- **Preise/Steuern:** Verkaufspreise werden als Nettopreise interpretiert und
  mit pauschal 19 % deutscher USt. in `priceOriginalGross` umgerechnet.
  Artikel-individuelle Steuerklassen und Plentys VAT-Konfiguration werden
  nicht aufgelöst.
- **Kundenspezifische Preise** (Preislisten, Kundenklassen) werden nicht
  berücksichtigt; es gilt der Default-Verkaufspreis (niedrigste `salesPriceId`).
- **Währung** stammt aus der Config (`defaultCurrency`, Default EUR), nicht
  aus der Plenty-Währungskonfiguration.
- **Credentials at rest:** Wie bei den bestehenden SAP-/REST-Connectoren wird
  die Config (inkl. Passwort) unverschlüsselt in der `connectorConfig`-Tabelle
  gespeichert. At-Rest-Verschlüsselung ist ein offenes, plattformweites Thema.
- **Keine Tests gegen echte Plenty-Instanzen** – die Testsuite arbeitet
  ausschließlich mit Fixtures und dem `PlentyMockConnector`.

## Entwicklung

```bash
pnpm --filter @youman/connector-plenty test        # Vitest
pnpm --filter @youman/connector-plenty typecheck
pnpm --filter @youman/connector-plenty build       # tsup (ESM + CJS + dts)
```

Der `PlentyMockConnector` liefert realistische deutsche Beispieldaten
(Firmen, EANs, EUR-Preise, Lagerbestände) in denselben Datenstrukturen wie
der echte Connector und funktioniert komplett ohne Netzwerk
(`new PlentyMockConnector(tenantId, { simulateLatency: true })` für
UI-Demos mit Latenz).
