# Youman Projektplanung

Internes Dashboard für die **Projektplanung** mit direkter **PlentyONE**-Anbindung.

Der Ablauf:

1. Im Dashboard ein Projekt erfassen: **Firmenname**, **Ort**, **Ansprechpartner
   intern** und **extern**.
2. Beim Abschicken wird in der Plenty-Kategorie **„Projekte“** automatisch eine
   **Unterkategorie „Firma Ort“** angelegt (z. B. `Bosch GmbH Esslingen`) – oder
   wiederverwendet, falls sie schon existiert.
3. In dieser Unterkategorie wird ein **Artikel** angelegt, der Firma, Ort, Datum
   und die Ansprechpartner trägt.
4. Für den Artikel wird automatisch eine gültige **EAN-13** erzeugt und als
   Barcode hinterlegt.
5. Alle Projekte landen im **Suchverlauf**, um frühere Projekte schnell
   wiederzufinden (Suche über Firma, Ort, Ansprechpartner oder EAN).

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Supabase** (Login + Suchverlauf-Datenbank)
- **PlentyONE REST-API** (Kategorie- & Artikelanlage, Barcode)
- Vanilla CSS Modules (Flat Design, Plus Jakarta Sans, Markenblau `#0D73FC`)

## Schnellstart

```bash
npm install
cp .env.example .env.local   # Werte eintragen (siehe unten)
npm run dev                  # http://localhost:3001
```

Ohne Supabase-/Plenty-Konfiguration startet die App im „offenen Modus“: das
Dashboard ist sichtbar, und beim Anlegen wird eine EAN erzeugt – der Plenty-Sync
und der Login/Verlauf werden übersprungen (mit deutlichem Hinweis in der UI).

## Konfiguration

Alle Variablen sind in [`.env.example`](.env.example) dokumentiert.

| Variable | Zweck |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Login + Suchverlauf |
| `PLENTY_BASE_URL`, `PLENTY_USER`, `PLENTY_PASSWORD` | PlentyONE REST-Zugang |
| `PLENTY_ID` | plentyId (Mandant), meist `0` |
| `PLENTY_PROJEKTE_CATEGORY_ID` | ID der Eltern-Kategorie „Projekte“ |
| `PLENTY_EAN_BARCODE_ID` | ID der Barcode-Konfiguration (z. B. `EAN13_2`) |
| `PLENTY_EAN_PREFIX` | 2-stelliger EAN-Präfix, Standard `20` (interner Bereich) |

### Datenbank einrichten

Einmalig im Supabase-Dashboard **SQL Editor** den Inhalt von
[`supabase/schema.sql`](supabase/schema.sql) ausführen. Das legt die Tabelle
`projekte` mit Row-Level-Security (jeder sieht nur die eigenen Projekte) und den
passenden Indizes an.

## EAN-13

Die Codes werden aus dem GS1-Präfixbereich **20–29** erzeugt („restricted
distribution / in-store“), der für die hausinterne Vergabe reserviert ist und
nie mit echten Hersteller-GTINs kollidiert. Aufbau: `[Präfix 2][Nutzlast 10]
[Prüfziffer 1]`. Die Prüfziffer wird korrekt nach dem EAN-13-Standard berechnet
(siehe [`lib/plenty/ean.ts`](lib/plenty/ean.ts)).

## Tests

```bash
npm test        # Vitest: EAN-Erzeugung + Kern-Logik
npm run typecheck
```

## Projektstruktur

```
projektplanung/
├── app/
│   ├── (app)/projekte/        # Dashboard (Formular + Suchverlauf)
│   ├── api/projekte/          # GET Suche / POST Anlegen / [id] löschen
│   ├── api/plenty/test/       # Verbindungstest
│   ├── auth/                  # Supabase Login-Callback + Logout
│   └── login/                 # Anmeldung
├── components/                # App-Shell (Header)
├── lib/
│   ├── plenty/                # PlentyONE-Client + EAN-Erzeugung
│   ├── projekte/              # Reine Geschäftslogik (getestet)
│   └── supabase/              # Supabase-Helfer (server/client/admin)
└── supabase/schema.sql        # DB-Schema
```

## Hinweise zur Plenty-Anbindung

Der Client bildet den dokumentierten PlentyONE-REST-Ablauf ab
(`/rest/login` → `/rest/categories` → `/rest/items` → Variation-Barcode). Je
nach Plenty-Version/Setup können einzelne Feldnamen abweichen; die relevanten
Stellen sind in [`lib/plenty/client.ts`](lib/plenty/client.ts) klar gekapselt
und leicht anzupassen. Fehler beim Sync sind **nicht blockierend** – das Projekt
inkl. EAN wird immer im Verlauf gespeichert, der Plenty-Status wird pro Eintrag
angezeigt (`Plenty ✓`, `nur EAN`, `Fehler`).
