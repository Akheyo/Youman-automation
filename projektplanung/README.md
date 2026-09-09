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

Hinter dem Bindestrich steht, wie fein der Platz aufgelöst ist:

| Zusatz | Bedeutung | Häufigkeit |
| --- | --- | ---: |
| `-K71` | **Kiste** 71 | 13.955 |
| `-0` | weder Kiste noch Unterfach | 23.469 |
| `-1`, `-2`, `-3` | **Unterfach** — ein Fach kann mehrere haben | 11.450 |
| `-P16` | Palettenplatz | 8 |

Führende Nullen werden entfernt (`-01` und `-1` sind dasselbe Unterfach) und
Kisten zweistellig geschrieben (`K7` → `K07`), damit derselbe Platz nicht je
nach Schreibweise doppelt gezählt wird.

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

## Lagerplätze zuweisen (`/lagerplatz/zuweisen`)

Bucht den Bestand vom Standard-Lagerort auf den erkannten Lagerplatz um.
**Das bewegt echten Bestand.** In PlentyONE gibt es keine reine Zuordnung: Ein
Artikel liegt auf einem Platz, indem sein Bestand dorthin gebucht ist.

### Die verwendeten Endpunkte

Aus der offiziellen PlentyONE-REST-Spezifikation
(`developers.plentymarkets.com/rest-api/openApiV2WithExamples.min.json`),
nicht geraten:

| Zweck | Endpunkt |
| --- | --- |
| Lager auflisten | `GET /rest/stockmanagement/warehouses` |
| **Alle** Lagerorte eines Lagers, auch die leeren | `GET /rest/warehouses/{warehouseId}/locations` |
| Bestand je Lagerort | `GET /rest/stockmanagement/warehouses/{warehouseId}/stock/storageLocations` |
| Umbuchen | `PUT /rest/items/{itemId}/variations/{variationId}/stock/redistribute` |

Der Umbuchungs-Body: `reasonId: 401` (Umlagerung), `quantity`,
`currentWarehouseId`, `currentStorageLocationId` (0 = Standard-Lagerort),
`newWarehouseId`, `newStorageLocationId`.

Dass die Lagerort-Liste **auch leere Plätze** enthält, ist der Kern: Aus einem
Artikelexport lassen sich nur belegte Plätze ablesen. Daraus zu schließen, ein
Platz existiere nicht, ist falsch — dieser Fehlschluss hat bei der Vorbereitung
zweimal zu falschen Zahlen geführt.

### Die Sicherungen

- **Probelauf ist die Voreinstellung.** Geschrieben wird nur, wenn der Aufruf
  ausdrücklich `probelauf: false` setzt.
- In der Oberfläche muss zusätzlich das Wort **BUCHEN** eingetippt werden.
- Eine **Obergrenze je Lauf** (20 bis 500 Artikel) begrenzt den Schaden eines
  Irrtums.
- Kein Ziel-Lagerort, keine Artikel-ID oder nichts auf dem Quell-Lagerort →
  die Zeile wird übersprungen statt geraten.
- Ein Fehler stoppt nicht den Lauf, sondern wird je Zeile protokolliert.

### Warum das trotzdem geprüft gehört

Der Lagerplatz stammt aus Freitext. Wo er sich mit einem echten Lagerort
vergleichen ließ, stimmte er in 37–49 % der Fälle exakt. Als Suchhinweis ist
das gut, als Datenquelle nicht. Deshalb: erst 20 Artikel buchen, im Regal
nachsehen, dann größere Blöcke.

### Nächster Schritt

Die Auswertung der ersten echten Daten hat die Aufgabe verschoben: Die
Lagerorte **existieren größtenteils schon** (in der Stichprobe bei 71 % der
Artikel). Das Problem ist ein anderes — **42 % der Stückzahl liegt auf dem
Standard-Lagerort**, also ohne echten Platz, teils bei Artikeln, die auf einem
weiteren Platz sehr wohl verbucht sind.

Der nächste Ausbauschritt ist deshalb nicht „Lagerorte anlegen", sondern:
bestehende Lagerorte mitlesen, den Standard-Anteil je Artikel ausweisen und den
Texthinweis als Vorschlag danebenstellen, wohin umgebucht werden müsste.

## Einstellungen (`/einstellungen`)

Der PlentyONE-Zugang wird **in der Oberfläche** gepflegt, nicht mehr nur über
Umgebungsvariablen. Alle Werkzeuge — Projekte anlegen, Lagerorte anlegen,
Zuweisen, Lagerplatz-Scan und die Artikelsuche — holen ihren Zugang von dort.
Eine Änderung wirkt **sofort, ohne neuen Deploy**.

### Rangfolge

```
Einstellungsseite (Datenbank)   schlägt   Umgebungsvariablen (Vercel)
```

Wer in der Oberfläche etwas einträgt, will damit etwas ändern. Die
Umgebungsvariablen bleiben als Grundeinstellung liegen: Eine leere Datenbank
macht nichts kaputt, und „Zugang löschen" fällt auf sie zurück.

**Ein halb ausgefüllter Datensatz greift nicht.** Nur wenn Basis-URL, Benutzer
und Passwort zusammen vorliegen, verdrängt die Datenbank die
Umgebungsvariablen — sonst legte ein abgebrochenes Speichern alle Werkzeuge
für alle Kollegen lahm.

### Was mit dem Passwort passiert

- Es wird mit **AES-256-GCM** verschlüsselt in Supabase abgelegt, nie im
  Klartext (`lib/einstellungen/tresor.ts`).
- Es wird **nie an den Browser ausgeliefert**. Die Seite zeigt nur, ob eines
  hinterlegt ist und wie es endet (`••••••ab12`).
- Das Feld leer lassen heißt „unverändert" — man kann die URL ändern, ohne das
  Passwort erneut einzutippen.
- Die Tabelle `einstellungen` hat RLS an und **absichtlich keine Policy**: Über
  den normalen Anon-Key kommt niemand heran, auch nicht lesend. Der Zugriff
  läuft ausschließlich serverseitig über den Service-Role-Key.

**Was das nicht leistet:** Der Schlüssel liegt als Umgebungsvariable auf
demselben Server, der auch entschlüsselt. Wer den Server übernimmt, kommt an
beides. Die Verschlüsselung schützt gegen abhandengekommene Datenbank-Inhalte
(Backups, geteilte Snapshots), nicht gegen einen übernommenen Server. Bewusste
Abwägung, keine Lücke aus Versehen.

### Voraussetzungen

| Variable | Nötig wofür |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | **Pflicht** — ohne ihn lässt sich nichts speichern |
| `EINSTELLUNGEN_SCHLUESSEL` | Optional. Fehlt er, wird der Service-Role-Key als Schlüsselmaterial verwendet |

Wird der Service-Role-Key gedreht und war kein eigener Schlüssel gesetzt, sind
die gespeicherten Passwörter nicht mehr lesbar. Die Seite **sagt das** („bitte
einmal neu eintragen") statt still auf einen falschen Zugang zu laufen.

### Verbindung testen

„Verbindung testen" prüft die **eingetippten** Werte, ohne sie zu speichern —
und bewusst am Token-Cache vorbei, sonst meldete der Test „erfolgreich", weil
vorhin schon einmal jemand angemeldet war. Beim Speichern läuft derselbe Test
automatisch mit; schlägt er fehl, wird trotzdem gespeichert, aber deutlich
gewarnt.

### Welches Supabase-Projekt?

Die Seite zeigt oben unter **Datenbank** die Projekt-Referenz, an der diese
Installation hängt — das Stück vor `.supabase.co` aus `NEXT_PUBLIC_SUPABASE_URL`.

Das ist kein Beiwerk: Läuft dieselbe Anwendung mehrfach (mehrere Vercel-Projekte
aus einem Repo), hat jede Instanz eigene Umgebungsvariablen und kann auf ein
anderes Supabase-Projekt zeigen. Wer das Schema dann ins falsche einspielt,
wundert sich, warum die Tabelle „fehlt". Die Referenz auf der Seite sagt, in
welchem Projekt im Supabase-Dashboard das SQL laufen muss.

Einmalig muss `supabase/schema.sql` dort im SQL-Editor laufen (legt die Tabelle
`einstellungen` an). Fehlt sie, sagt die Seite genau das.

## Artikel nicht gefunden (`/lagerplatz/suche`)

Ein Artikel ist am eingetragenen Platz nicht auffindbar. Diese Seite sammelt aus
PlentyONE alles, was auf einen anderen Platz hindeutet, und macht daraus eine
begründete Rangliste. **Nur lesend** — es wird nichts umgebucht.

### Der erste Blick: Wie steht der Artikel im Bestand?

Bevor irgendjemand losläuft, beantwortet die Seite die Frage, die den Suchweg
bestimmt:

| Lage | Bedeutung | Wo suchen |
|---|---|---|
| **verbucht** | Liegt laut Plenty auf einem echten Lagerplatz | Im Regal — und dann in der Umgebung |
| **nur Standard-Lagerplatz** | Bestand da, aber nie einem Regal zugewiesen | **Nicht im Regal** — im Wareneingang |
| **kein Bestand** | Verkauft, umgebucht oder nie eingebucht | Erst die Buchungen klären, dann suchen |

Diese Unterscheidung war der Grund, die Seite überhaupt zu bauen: Ein Artikel auf
dem Standard-Lagerplatz wurde nie eingeräumt. Ihn im Regal zu suchen ist verlorene
Zeit.

### Die Signale

Sie bilden den Suchweg nach, der sich im Lager bewährt hat:

| Signal | Gewicht | Was geprüft wird |
|---|---|---|
| Bestand | 100 | Wohin ist der Artikel selbst verbucht? |
| Artikeltext | 80 | Variantennummer, Modell, Beschreibung — dort steht oft der frühere Platz |
| Warenbewegung | 70 | Wo lag er schon einmal? Rückläufer wandern an ihren alten Platz |
| Gleicher Artikel | 65 | Haben wir das Teil nochmal? Bei Gebrauchtware steht Exemplar 2 beim ersten |
| Nachbar-ID | 55 | ±5 IDs (einstellbar bis ±15) — zusammen angelegt heißt zusammen eingeräumt |
| Einlagerung | 50 | Was im selben Zeitfenster gebucht wurde, kam mit derselben Palette |
| Anlagetag | 45 | Grober Ersatz, wenn keine Bewegungsdaten vorliegen |
| Vertauscht? | 40 | Wer liegt auf dem Soll-Platz — und wo gehört der eigentlich hin? |
| Regal nebenan | 30 | Fach ±2, Kiste ±2, Ebene ±1 — der häufigste Einräumfehler |

Mehrere Signale auf denselben Platz verstärken sich, aber gedämpft: Das stärkste
zählt voll, jedes weitere zur Hälfte. Sonst überholen fünf schwache Hinweise
einen starken.

### Die Größenprobe ersetzt den Blick aufs Bild

Aus Gewicht und Maßen wird eine Größenklasse abgeleitet (Kleinteil, mittel,
Großteil). Plätze, die dazu nicht passen, werden **abgewertet und begründet**:

- Großteil in einer Kleinteilkiste (`-K71`, KTL-Regal)
- Kleinteil auf einem Palettenplatz (`-P16`)
- Großteil in Ebene D–J — dort wird nichts Schweres eingelagert

Fehlen Gewicht und Maße, ist die Klasse `unbekannt` und es wird **nichts**
abgewertet. Lieber keine Aussage als eine falsche.

Die Artikelbilder werden trotzdem geladen, und zwar überall: in der
Kandidatenliste direkt neben jedem Beleg (mit Größenklasse dahinter) und in den
Abschnitten zu Nachbarn, Dubletten, Einlagerung und Soll-Platz. Die Rechnung
ersetzt nicht den Blick, sie sortiert nur vor.

Führt ein Artikel seine Bilder an der Variante statt am Artikel, wird auch dort
nachgesehen — sonst bliebe die Kachel grundlos leer.

### Tempo

Die Suche fasst je Durchgang leicht hundert Plenty-Aufrufe an. Drei Dinge
halten sie trotzdem kurz:

| Maßnahme | Was sie spart |
| --- | --- |
| Lagerortliste zwischengespeichert (5 min) | Sie zu lesen kostet je nach Lagergröße 20+ Seitenabrufe — bei **jeder** Suche. Der größte Posten. |
| Unabhängige Signale laufen gleichzeitig | Warenbewegungen, Dubletten, ID-Nachbarn und Platztausch warteten vorher grundlos aufeinander. |
| Beschreibungstexte nur, wo sie ausgewertet werden | Für die ID-Nachbarn kostete der Abruf je einen Aufruf ohne Wirkung auf das Ergebnis. |
| Bilder zwischengespeichert | Dieselben Nachbarn tauchen immer wieder auf; auch „hat kein Bild" wird gemerkt. |

Alle vier sind durch Tests abgesichert (`lib/plenty/suche.test.ts`) — sonst
verschwänden sie beim nächsten Umbau unbemerkt.

### Zeitleiste der Einlagerung

Alle Buchungen im Zeitfenster, chronologisch mit **Uhrzeit**, Ziel-Lagerort und
Minutenabstand zum gesuchten Artikel — der selbst hervorgehoben ist.

Beim Einlagern ist die Uhrzeit das eigentliche Argument: Was in derselben
Minute gebucht wurde, kam mit derselben Palette. „Etwa zeitgleich" allein sagt
nicht, ob das um 9 Uhr früh war oder mitten in der Spätschicht. Eine Pause von
mehr als 15 Minuten wird als gestrichelte Linie gezeigt — dahinter beginnt
vermutlich eine andere Lieferung.

Das Vorzeichen des Versatzes bleibt erhalten („12 min vorher" ≠ „12 min
später"), weil es beim Rekonstruieren zählt, wer was zuerst abgestellt hat.
Dargestellt wird in der Zeitzone des Betrachters; weitergereicht wird ISO.

### Laufzettel

Dieselben Plätze ein zweites Mal, aber nach Laufweg sortiert (Halle → Regal →
Ebene → Fach → Kiste) statt nach Punkten, mit Druckknopf. Wer suchen geht, läuft
die Halle einmal ab, statt zwischen bestbewerteten Plätzen hin- und herzuspringen.

### Verwendete Endpunkte (alle GET)

```
/rest/items/variations                                        Artikel auflösen, Nachbarn, Namenssuche
/rest/items/{itemId}/variations/{variationId}/descriptions    Texte nach Lagerplatz-Codes
/rest/items/{itemId}/images                                   Bild für die Sichtprüfung
/rest/stockmanagement/warehouses/{id}/stock/storageLocations  Wo liegt was
/rest/stockmanagement/warehouses/{id}/stock/movements         Historie und Einlagerungsfenster
/rest/warehouses/locations/stock/{lagerortId}                 Wer liegt auf dem Soll-Platz
```

Nicht jede Plenty-Ausbaustufe kennt alle davon. Bewegungen und Namenssuche
werden über mehrere bekannte Pfade probiert; greift keiner, fällt die Suche auf
das Anlagedatum zurück und **schreibt in die Diagnose, was gefehlt hat** — statt
stillschweigend ein schwächeres Ergebnis zu liefern.

### Noch offen

- **Rückmeldung „hier war er"**: Ein Klick beim Fund würde über die Zeit zeigen,
  welches Signal wirklich trifft und welche Regale die meisten Suchfälle
  erzeugen. Braucht eine Tabelle in Supabase.
- **eBay-Abgleich**: Die Titelsuche läuft heute nur gegen Plenty. Ob dasselbe
  Teil noch als eBay-Angebot liegt, ist ein zusätzlicher Hinweis.
- **Einlagerungs-Sessions**: Buchungen nach Nutzer gruppieren (Lücke > 30 min =
  neue Session) statt über ein festes Zeitfenster. Genauer, sobald die
  Bewegungsdaten `userId` verlässlich mitliefern.

## Tests

```bash
npm test        # Vitest: EAN-Erzeugung, Kern-Logik, Lagerplatz-Erkennung, Platzsuche
npm run typecheck
```

## Projektstruktur

```
projektplanung/
├── app/
│   ├── (app)/projekte/        # Dashboard (Formular + Suchverlauf)
│   ├── (app)/lagerplatz/      # Lagerplatz-Scan (Vorschau, nur lesend)
│   ├── api/projekte/          # GET Suche / POST Anlegen / [id] löschen
│   ├── (app)/lagerplatz/suche/ # Artikel nicht gefunden — alternative Plätze
│   ├── (app)/einstellungen/   # Plenty-Zugang pflegen + Prozessübersicht
│   ├── api/einstellungen/     # GET/PUT/POST/DELETE Plenty-Zugang
│   ├── api/lagerplatz/scan/   # POST Lagerplatz-Scan (häppchenweise)
│   ├── api/lagerplatz/suche/  # POST Suche nach alternativen Lagerplätzen
│   ├── api/plenty/test/       # Verbindungstest
│   ├── auth/                  # Supabase Login-Callback + Logout
│   └── login/                 # Anmeldung
├── components/                # App-Shell (Header)
├── lib/
│   ├── einstellungen/         # Zugang laden/speichern + Verschlüsselung (getestet)
│   ├── lagerplatz/            # Erkennung, Befunde, Nachbarschaftslogik (getestet)
│   ├── plenty/                # PlentyONE-Client, EAN, Bestands-Scan, Platzsuche
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
