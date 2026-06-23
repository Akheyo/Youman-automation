# eBay-Auto-Listings aus einer SKU-Liste (Syntrox)

Stellt Artikel **vollautomatisch** bei eBay ein — ohne n8n. Ablauf:

```
SKU-Liste (Google-Sheet/CSV)
        │  pro SKU
        ▼
syntrox.de/search?qs=<SKU>     →  Produktseite scrapen (Titel, Preis, Bilder, Daten)
        │
        ▼
A-Ware & Verfügbarkeit prüfen  →  nicht A-Ware / vergriffen ⇒ überspringen
        │
        ▼
LLM-Anreicherung               →  passende eBay-Kategorie + Artikelmerkmale
   (eBay-Taxonomy-API geerdet)      (kein Halluzinieren ungültiger Werte)
        │
        ▼
eBay Sell-Inventory-API        →  inventory_item → offer → publish
```

Supabase merkt sich pro SKU den Stand (Diff-Mode): unveränderte, bereits
gelistete Artikel werden übersprungen — ohne erneuten LLM-/eBay-Aufruf.

## 1. Datenbank

`supabase/schema.sql` einmal im Supabase-SQL-Editor ausführen (legt
`ebay_tokens`, `ebay_config`, `ebay_listings` an bzw. ergänzt die neuen
Spalten — alles `if not exists`, also auch für bestehende Installs sicher).

## 2. eBay-Developer-Zugang

[developer.ebay.com](https://developer.ebay.com) → **Application Keys**:

| Env-Variable        | Wert im Portal            |
|---------------------|---------------------------|
| `EBAY_CLIENT_ID`    | App-ID (Client-ID)        |
| `EBAY_CLIENT_SECRET`| Cert-ID (Client-Secret)   |
| `EBAY_RU_NAME`      | RuName (User Tokens)      |
| `EBAY_ENV`          | `production` oder `sandbox` |

RuName → „Your auth accepted URL": `{APP_URL}/api/ebay/callback`

## 3. LLM (KI-Anreicherung)

Läuft über **OpenRouter** (gleicher Anbieter wie Felix):

```
OPENROUTER_API_KEY=...        # bereits für Felix vorhanden
EBAY_LLM_MODEL=               # optional, sonst FELIX_MODEL / openai/gpt-4o-mini
```

Die Kategorie wird **nicht frei vom LLM erfunden**: Die App holt zuerst
eBay-Kategorievorschläge (Taxonomy API), das LLM wählt den besten aus und
füllt anschließend die Artikelmerkmale — bei „nur-Auswahl"-Merkmalen
ausschließlich mit von eBay erlaubten Werten.

## 4. Cron-Schutz

```
CRON_SECRET=<openssl rand -hex 32>
```

Ohne `CRON_SECRET` ist `/api/ebay/sync` deaktiviert (503). Der Cron läuft
stündlich (`vercel.json` → `crons`).

## 5. SKU-Liste vorbereiten

Google Sheets mit **einer Spalte Artikelnummern** (Header `sku` oder
`artikelnummer` wird erkannt, sonst wird die erste Spalte genommen).
**Datei → Freigeben → Im Web veröffentlichen → Format „CSV"** → den Link in
der App unter **eBay → Quelle & Einstellungen** einfügen.

Alles andere (Titel, Preis, Bilder, Beschreibung, technische Daten) wird pro
SKU von syntrox.de gezogen.

## 6. In der App einstellen

1. **eBay-Konto verbinden**.
2. **Quelle & Einstellungen**:
   - SKU-Sheet-URL,
   - Syntrox-Such-URL (Standard `https://syntrox.de/search?qs=`),
   - **Preis-Aufschlag (%)** für deine Marge, **Menge je Listing**,
   - Marktplatz/Währung, **Business-Policy-IDs** (Versand/Zahlung/Rücknahme)
     und **Standort-Key** aus deinem eBay-Verkäuferkonto,
   - Standard-Kategorie-ID als Fallback (falls die KI nichts findet).
3. Schalter: **Nur A-Ware listen**, **KI-Anreicherung**, **Direkt
   veröffentlichen**, **Auto-Sync aktiv**.
4. **„Jetzt synchronisieren"** zum sofortigen Test; der stündliche Cron
   übernimmt danach automatisch neue/geänderte SKUs.

## 7. A-Ware-Erkennung

Standardlogik auf der Produktseite:
- **keine A-Ware** bei Hinweisen wie *B-Ware, C-Ware, Retoure, gebraucht,
  defekt, 2. Wahl* → Artikel wird übersprungen.
- **A-Ware** bei *A-Ware, Neuware, fabrikneu, originalverpackt* — oder wenn
  kein abweichender Hinweis vorhanden ist (normaler Lagerartikel).
- **nicht verfügbar** bei *ausverkauft, vergriffen, nicht lieferbar* bzw.
  schema.org `OutOfStock` → übersprungen.

> Hinweis: Diese Erkennung sitzt in `lib/ebay/syntrox.ts` (`detectAWare` /
> `detectStock`). Falls syntrox.de A-/B-Ware anders kennzeichnet, dort die
> Regex anpassen — am besten anhand einer echten Produktseite kalibrieren.

## 8. Scraping-Robustheit

Der Scraper liest zuerst **strukturierte Daten** (schema.org/Product-JSON-LD,
dann OpenGraph, dann Microdata) und fällt auf generische HTML-Tabellen zurück.
Das funktioniert über verschiedene Shop-Systeme hinweg. Die einzigen
shop-spezifischen Stellen sind die Suchergebnis-Verlinkung und die
A-Ware-Erkennung (siehe `lib/ebay/syntrox.ts`).
