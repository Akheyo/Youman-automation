# CLAUDE.md — projektplanung (Plenty-Anbindung)

## PlentyONE REST API — Endpoint-Referenz (immer zuerst nachschlagen)

Vollständige, greppbare Liste aller ~1000 REST-Endpoints inkl. Auth-/Base-URL-Konventionen:

**`docs/plentyone-rest-api-endpoints.md`**  (Root-Verweis: `../CLAUDE.md`)

Beispiel: `grep -i "variation_barcodes" docs/plentyone-rest-api-endpoints.md`

Vorhandener REST-Client: `lib/plenty/client.ts` — Login-Caching (`POST /rest/login` → Bearer),
Kategorie-/Artikel-/Barcode-Flow, EAN-13 (`lib/plenty/ean.ts`).
