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

Das Schema stammt aus den echten Daten (Stichprobe: 1.000 Artikel mit Bestand,
735 hinterlegte Lagerorte) — nicht aus Annahmen. Es gibt zwei Schreibweisen:

**Lang** — so führt Plenty die echten Lagerorte:

```
H2/R7/EA F08-K71      Halle 2 · Regal 7 · Ebene A · Fach 8 · Kiste 71
H1/R1/EB F12-0        "-0" heißt: keine Kiste
H6/R2KTL/ED F01-0     Regale können "KTL" tragen
H1/R11/EAZ F02-1      Ebenen können ein "Z" tragen
H1/R13/EC FM1-2       Fächer vereinzelt mit Buchstaben
```

**Kurz** — so steht es in Variantennummern, Beschreibungen und Kommentaren:

| im Text | wird zu |
| --- | --- |
| `NEW-14158-H3R6B10_CK` | `H3/R6/EB F10-0` |
| `wh25092014_7_h1r6a10` | `H1/R6/EA F10-0` |
| `H2R7A15K30-1_CK` | `H2/R7/EA F15-K30` |
| `H1R5A12K2+3` | `H1/R5/EA F12-K02` **und** `…-K03` (zwei Kisten) |
| `Halle 2 Regal 4 B 1` | `H2/R4/EB F01-0` |

Beide Formen werden auf die **lange** normiert, weil das die Form ist, mit der
Plenty arbeitet — so lassen sich Texthinweis und echter Lagerort direkt
vergleichen (`gleicherOrt()` vergleicht dabei bis auf die Kiste).

Ein `K` bezeichnet immer die **Kiste**. Steht hinter dem Bindestrich eine bloße
Zahl (`-1`, `-2`), ist deren Bedeutung ungeklärt — sie bleibt unverändert
stehen, statt interpretiert zu werden.

**Jeder Artikel bekommt einen von vier Status:**

- **gefunden** — Lagerplatz eindeutig erkannt.
- **unsicher** — z. B. eine Ebene außerhalb A–J.
- **Konflikt** — zwei Felder nennen verschiedene Plätze. Das ist nicht
  zwangsläufig ein Fehler: Liegt der Artikel mehrfach im Lager, kann der Text
  einen *zusätzlichen* Platz nennen. Bei Bestand 1 dagegen ist eine der beiden
  Angaben veraltet.
- **ohne Lagerplatz** — nichts gefunden.

Was der Scan (noch) **nicht** liest: die in Plenty bereits hinterlegten
Lagerorte und die Frage, wie viel Bestand davon auf dem Standard-Lagerort
liegt. Genau dort steckt die eigentliche Arbeit — siehe „Nächster Schritt".

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

Die Auswertung der ersten echten Daten hat die Aufgabe verschoben: Die
Lagerorte **existieren größtenteils schon** (in der Stichprobe bei 71 % der
Artikel). Das Problem ist ein anderes — **42 % der Stückzahl liegt auf dem
Standard-Lagerort**, also ohne echten Platz, teils bei Artikeln, die auf einem
weiteren Platz sehr wohl verbucht sind.

Der nächste Ausbauschritt ist deshalb nicht „Lagerorte anlegen", sondern:
bestehende Lagerorte mitlesen, den Standard-Anteil je Artikel ausweisen und den
Texthinweis als Vorschlag danebenstellen, wohin umgebucht werden müsste.

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
