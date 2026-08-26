# CLAUDE.md — Youman-automation

Projektweite Hinweise für Claude Code. Wird zu Beginn jeder Session automatisch geladen.

## PlentyONE REST API — immer verfügbare Endpoint-Referenz

> **Bei ALLEM, was mit Plenty / PlentyONE zu tun hat** (Artikel, Varianten, Kategorien,
> Barcodes/EAN, Bestellungen, Bestände, Kontakte, Kataloge, Versand, …) **zuerst hier
> nachschlagen** — diese Datei ist die chat-, zeit- und ortsunabhängige Quelle der Wahrheit
> für Route, Methode und Zweck aller ~1000 REST-Endpoints:
>
> **`projektplanung/docs/plentyone-rest-api-endpoints.md`**

Nutzung: nach der Ressource greppen, z. B.
`grep -i "barcode" projektplanung/docs/plentyone-rest-api-endpoints.md`.

### Kurz-Essenz (Details in der Referenzdatei)
- **Base-URL:** `https`, ohne `/rest` am Ende (z. B. `https://p14443.my.plentysystems.com`).
  Pfade werden angehängt: `<baseUrl>/rest/...`.
- **Login:** `POST /rest/login` (`{username,password}`) → `access_token` → als
  `Authorization: Bearer <token>` senden; Token cachen (`expires_in`). Refresh: `POST /rest/login/refresh`.
- **Vorhandener Client:** `projektplanung/lib/plenty/client.ts` (Login-Caching, Kategorie-/Artikel-/Barcode-Flow, EAN).
- **Fallstricke:** `POST /rest/categories` erwartet ein **Array**; Varianten-Barcode über
  `POST /rest/items/{id}/variations/{variationId}/variation_barcodes` (Recht `item.item.variation.barcode.create`);
  exakte Base-URL nutzen (Redirect verwirft POST-Body).
- **Env:** `PLENTY_BASE_URL`, `PLENTY_USER`, `PLENTY_PASSWORD`, `PLENTY_ID`,
  `PLENTY_PROJEKTE_CATEGORY_ID`, `PLENTY_EAN_BARCODE_ID`, `PLENTY_EAN_PREFIX`.

*Wenn sich die Plenty-API ändert: Referenzdatei aktualisieren (offizielle Doku:
developers.plentymarkets.com → PlentyONE REST API).*
