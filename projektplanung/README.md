# Komplett Konzept — Projektplanung

Internes Dashboard der **Komplett Konzept Verwertungs GmbH** für die
**Projektplanung** mit direkter **PlentyONE**-Anbindung.

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

## Lagerplatz-Scan (`/lagerplatz`)

Viele Artikel tragen ihren Lagerplatz bis heute nur im Text — in der
**Variantennummer** (`KK-2024-0815-H6R5A7`) oder mitten in der
**Artikelbeschreibung** („Lagerplatz: Halle 6 Regal 5 Ablage 7"). Bevor daraus
in Plenty echte Lagerorte werden können, muss erst auf dem Tisch liegen, welche
Lagerplätze es gibt und bei welchen Artikeln gar keiner hinterlegt ist.

Genau das macht die Seite **Lagerplätze**. Sie **liest nur** — in Plenty wird
nichts angelegt und nichts verändert.

### Treiber ist der Bestand, nicht der Artikelstamm

Der Scan geht **jeden Artikel mit Bestand** durch: Ausgangsliste ist
`/rest/stockmanagement/stock`, nicht der Artikelstamm. Nur was tatsächlich im
Lager liegt, braucht einen Lagerplatz — Karteileichen ohne Bestand bleiben außen
vor. Bestandszeilen mit 0 Stück werden übersprungen und separat gezählt.

Liegt derselbe Artikel in mehreren Lagern, werden seine Bestandszeilen zu einer
Zeile zusammengefasst (Bestand summiert, Lager kommagetrennt). Zu jeder Variante
mit Bestand lädt der Scan anschließend die Texte nach und wertet sie aus.

Über die Auswahl **„Gesamter Artikelstamm"** lässt sich stattdessen alles
durchsuchen — auch Artikel ohne Bestand.

### Was als Lagerplatz erkannt wird

Geprüft wird in dieser Reihenfolge, das erste belastbare Ergebnis gewinnt:
**Variantennummer → Modell → Externe ID → Name → Beschreibung**.

Bewusst tolerant, weil die Codes über die Jahre unterschiedlich geschrieben
wurden:

| Schreibweise im Artikel | erkannt als |
| --- | --- |
| `H6R5A7` | `H6R5A7` — Halle 6 · Regal 5 · Ablage 7 |
| `h6-r5-a7`, `H 6 / R 5 / A 7`, `H06R05A07` | `H6R5A7` |
| `Lagerplatz: Halle 6 Regal 5 Ablage 7` | `H6R5A7` |
| `H2R11F3` mitten im Beschreibungstext | `H2R11F3` |

Bekannte Ebenen sind `H` Halle, `L` Lager, `G` Gang, `Z` Zeile, `R` Regal,
`E` Ebene, `F` Fach, `A` Ablage, `B` Boden, `P` Platz, `C` Container,
`K` Kiste, `S` Stellplatz — jeweils auch ausgeschrieben.

**Jeder Artikel bekommt einen von vier Status:**

- **gefunden** — mindestens drei bekannte Ebenen, eindeutig. Kann übernommen werden.
- **unsicher** — nur zwei Ebenen (`R5A7`) oder eine unbekannte Ebene (`X1Y2Z3`).
  Wird angezeigt, aber nicht als gesichert gezählt.
- **Konflikt** — Variantennummer und Beschreibung nennen verschiedene Plätze.
  Muss ein Mensch entscheiden.
- **ohne Lagerplatz** — nichts gefunden. Bei einem Artikel mit Bestand ist das
  die Arbeitsliste: Der Platz muss aufgenommen werden. Reine Maßangaben wie
  `L120B60H90` landen bewusst hier und nicht bei den Lagerplätzen.

**Ergebnis:** Kennzahlen, die Liste aller verschiedenen Lagerplätze mit
Artikelzahl (das ist die Anlage-Liste für Plenty) und eine durchsuchbare
Einzelansicht inkl. Bestand und Lager. Beides als CSV exportierbar (Semikolon +
BOM, öffnet direkt in Excel).

### Bedienung

Der Scan läuft in Häppchen: Jeder Aufruf liest einige Seiten und meldet, wo es
weitergeht — die Oberfläche hängt selbstständig an, bis alles durch ist. So
läuft er auch unter dem Serverless-Timeout von Vercel durch. „Anhalten" stoppt
nach dem laufenden Häppchen; die bis dahin gefundenen Treffer bleiben stehen.

**„Beschreibungen einzeln nachladen"**: Die Plenty-Variantenliste liefert je
nach Version keine Beschreibungstexte mit. Ist die Option aus und steht der
Lagerplatz nur in der Beschreibung, wird er nicht gefunden — die Seite weist
darauf hin. Mit der Option wird die Beschreibung pro Variante nachgeladen
(ein zusätzlicher API-Aufruf je Artikel, entsprechend langsamer, gedeckelt auf
150 Nachladungen je Häppchen).

### Was der Scan zur Laufzeit über die API lernt

PlentyONE-Instanzen unterscheiden sich; statt Feldnamen zu raten, probiert der
Scan einmal aus und schreibt das Ergebnis in die Diagnose-Zeile:

- welcher `with`-Parameter der Variantenliste funktioniert
  (`item,variationDescription` → `variationDescription` → `item` → ohne),
- ob `?id=1,2,3` mehrere Varianten auf einmal liefert — wird der Filter
  ignoriert, lädt der Scan ab dann einzeln,
- ob die Lagernamen lesbar sind (sonst werden die Lager-IDs angezeigt).

### Benötigte Rechte des Plenty-API-Benutzers

Lesend: Bestand (`/rest/stockmanagement/stock`), Lager, Artikel und Varianten.
Fehlen die Lagernamen-Rechte, läuft der Scan trotzdem — er zeigt dann IDs.

### Nächster Schritt

Aus der Vorschau lassen sich später die echten Lagerorte in Plenty anlegen
(Lager → Regal → Fach → Lagerort) und den Varianten zuordnen. Der Scan liefert
dafür die Grundlage; das Schreiben ist bewusst noch nicht gebaut, damit die
Liste erst geprüft werden kann.

## Tests

```bash
npm test        # Vitest: EAN-Erzeugung, Kern-Logik, Lagerplatz-Erkennung
npm run typecheck
```

## Projektstruktur

```
projektplanung/
├── app/
│   ├── (app)/projekte/        # Dashboard (Formular + Suchverlauf)
│   ├── (app)/lagerplatz/      # Lagerplatz-Scan (Vorschau, nur lesend)
│   ├── api/projekte/          # GET Suche / POST Anlegen / [id] löschen
│   ├── api/lagerplatz/scan/   # POST Lagerplatz-Scan (häppchenweise)
│   ├── api/plenty/test/       # Verbindungstest
│   ├── auth/                  # Supabase Login-Callback + Logout
│   └── login/                 # Anmeldung
├── components/                # App-Shell (Header)
├── lib/
│   ├── lagerplatz/            # Lagerplatz-Erkennung + Befunde (getestet)
│   ├── plenty/                # PlentyONE-Client, EAN-Erzeugung, Bestands-Scan
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
