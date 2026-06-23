# eBay-Auto-Listings — Einrichtung

Stellt Produkte aus einer **Google-Sheet (CSV)** vollautomatisch bei eBay ein —
ohne n8n. Quelle → Vercel-Cron → eBay Sell-Inventory-API. Supabase merkt sich,
was schon eingestellt wurde (Diff-Mode), damit nichts doppelt hochgeht.

## 1. Datenbank

Das Schema in `supabase/schema.sql` einmal im Supabase-SQL-Editor ausführen
(legt `ebay_tokens`, `ebay_config`, `ebay_listings` an). Bestehende Installs:
einfach erneut ausführen, die Statements sind `if not exists`-sicher.

## 2. eBay-Developer-Zugang

Im [eBay-Developer-Portal](https://developer.ebay.com) → **Application Keys**:

| Env-Variable        | Wert im Portal            |
|---------------------|---------------------------|
| `EBAY_CLIENT_ID`    | App-ID (Client-ID)        |
| `EBAY_CLIENT_SECRET`| Cert-ID (Client-Secret)   |
| `EBAY_RU_NAME`      | RuName (User Tokens → „Get a Token from eBay via Your Application") |
| `EBAY_ENV`          | `production` (oder `sandbox` zum Testen) |

Beim RuName als **„Your auth accepted URL"** eintragen:

```
{APP_URL}/api/ebay/callback
```

## 3. Cron-Schutz

```
CRON_SECRET=<lange Zufallszeichenkette, z. B. openssl rand -hex 32>
```

Vercel schickt dieses Secret automatisch als `Authorization: Bearer …` an den
Cron-Endpoint. Ohne `CRON_SECRET` ist `/api/ebay/sync` deaktiviert (503).
Der Cron läuft stündlich (`vercel.json` → `crons`).

## 4. Produkt-Sheet vorbereiten

In Google Sheets: **Datei → Freigeben → Im Web veröffentlichen → Format „CSV"**.
Den Link in der App unter **eBay → Quelle & Einstellungen** einfügen.

Erkannte Spalten (Groß-/Kleinschreibung egal, DE + EN):

| Spalte (Beispiele)                     | Pflicht | eBay-Feld |
|----------------------------------------|---------|-----------|
| `sku`, `artikelnummer`, `id`           | ✓       | SKU       |
| `titel`, `title`, `name`               | ✓       | Titel (max 80 Zeichen) |
| `preis`, `price`, `vk`                 | ✓       | Preis     |
| `menge`, `quantity`, `bestand`         | –       | Menge (Default 1) |
| `beschreibung`, `description`          | –       | Beschreibung |
| `zustand`, `condition`                 | –       | NEW / USED_… (auch „neu"/„gebraucht") |
| `kategorie`, `category`                | –       | eBay-Kategorie-ID |
| `marke`, `brand` / `mpn` / `ean`       | –       | Artikel-Details |
| `bilder`, `images`, `foto`             | –       | Bild-URLs (mehrere durch Leerzeichen/Komma/`|`) |
| `merkmale`, `aspects`                  | –       | `Farbe:Rot;Größe:M` |

Zeilen ohne SKU, Titel oder gültigen Preis werden übersprungen.

## 5. In der App verbinden & einstellen

1. **eBay → eBay-Konto verbinden** → eBay-Login & Freigabe.
2. **Quelle & Einstellungen**: Sheet-URL, Marktplatz (`EBAY_DE`), Währung,
   Standard-Zustand/-Kategorie und die **Business-Policy-IDs** (Versand,
   Zahlung, Rücknahme) + **Standort-Key** eintragen. Diese IDs kommen aus
   deinem eBay-Verkäuferkonto (Business Policies).
3. **Auto-Sync aktiv** anhaken → der stündliche Cron stellt neue/geänderte
   Zeilen automatisch ein. Mit **„Jetzt synchronisieren"** sofort testen.

## 6. Wie der Diff-Mode arbeitet

Pro Sheet-Zeile wird ein Hash gebildet. Unveränderte, bereits gelistete SKUs
werden übersprungen; neue Zeilen werden eingestellt, geänderte aktualisiert
(Preis/Menge/Beschreibung). Jede SKU bekommt in `ebay_listings` einen Status
(`listed` / `pending` / `error`) plus Fehlertext — sichtbar in der Listings-
Tabelle im Dashboard.

## 7. Sandbox-Test

`EBAY_ENV=sandbox` setzen, mit einem eBay-**Sandbox**-Verkäuferaccount
verbinden und eine Test-Sheet einstellen. Es entstehen keine echten Angebote.
