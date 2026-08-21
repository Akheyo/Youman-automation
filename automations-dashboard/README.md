# Automations-Dashboard

Internes Dashboard, mit dem Amanuel Kheyo und rund 25 Kolleginnen und Kollegen
alle Automationen des Unternehmens an einer Stelle im Blick haben. Zustand,
Durchläufe, Fehler und Steuerung, alles auf Deutsch.

Das Konzept dahinter steht in [CLAUDE.md](./CLAUDE.md).

## Was drin ist

1. **Anmeldung und Rechte.** Login über Supabase Auth, die Rolle kommt aus
   `profiles`. Drei Stufen: Zuschauen, Steuern, Alles. Steuerknöpfe sind für
   Zuschauer sichtbar, aber deaktiviert, mit einem Satz daneben, der erklärt warum.
2. **Übersicht.** Der Zustandsbalken ganz oben sagt in einem deutschen Satz, ob
   alles in Ordnung ist. Darunter die Kennzahlen der letzten 24 Stunden, was
   gerade läuft, der Verlauf der letzten 14 Tage, die dringendsten Fehler und
   die Automationen, die auffallen.
3. **Automationen.** Liste mit Suche und Bereichsfilter, jede Zeile aufklappbar:
   zuletzt gelaufen, das nächste Mal dran, Zeitplan im Klartext, Zuverlässigkeit,
   Zuständiger, die letzten 15 Durchläufe.
4. **Fehler.** Schlimmste zuerst. Ein Fehler lässt sich übernehmen
   („Kümmere ich mich drum") und abhaken („Erledigt"). Von jedem Fehler springt
   man direkt zu der Automation, in der er entstanden ist.
5. **Steuern.** Anhalten, wieder anschalten, jetzt sofort starten, einen
   fehlgeschlagenen Durchlauf nochmal versuchen, einen laufenden abbrechen.
6. **Protokoll.** Wer hat was gesteuert, und wer hat wem Zugang gegeben oder
   entzogen.
7. **Zugänge.** Nur für die Rolle „Alles": Rechte vergeben, Zugang geben und
   entziehen. Jede Änderung landet zusätzlich in `audit_log`.

## Artikelsuche

Ein eigener Bereich durchsucht die Artikeldaten aus PlentyONE, die in derselben
Datenbank liegen und alle zehn Minuten abgeglichen werden. Gesucht wird über
`v_artikel_komplett` mit **vier getrennten Feldern**: Artikelnummer, EAN, Titel
und Hersteller. Jedes Feld sucht in seiner eigenen Spalte, mehrere Felder
gelten zusammen. Ab zwei Zeichen je Feld geht es los, mit kurzer Verzögerung
beim Tippen.

Artikelnummer, EAN und Hersteller suchen **von vorne**. Das ist genau, deshalb
liefert eine Artikelnummer auch nur den einen Artikel und nicht jeden Treffer,
in dem dieselbe Zahlenfolge irgendwo im Titel steht. Der Titel sucht überall im
Text, weil man dort selten den Anfang kennt.

**Für das Tempo** sind zwei Dinge entscheidend. Die Trefferliste holt nur die
Spalten, die sie anzeigt, nicht Beschreibung und Meta-Texte. Die vollständige
Zeile kommt erst beim Aufklappen. Und in der Datenbank sollten die Indexe aus
`datenbank/tempo.sql` liegen, sonst durchsucht Postgres bei jedem Tastendruck
alle 40.000 Varianten. Unter der Trefferliste steht, wie lange die Suche
gedauert hat, damit man das nicht raten muss.

Jeder Treffer zeigt Vorschaubild, Titel, Artikelnummer und EAN sowie den
Bestand als Etikett: blau ab fünf Stück, gelb darunter, rot bei null.
Aufgeklappt kommen Bestände je Spalte, Preise, Lager, Gewicht, alle Bilder in
der richtigen Reihenfolge und darunter aufklappbar sämtliche Felder der
Datenbankzeile.

Antworten überholter Abfragen werden verworfen, damit beim schnellen Tippen
nicht ein älteres Ergebnis das neuere überschreibt.

**Die Spalten werden zur Laufzeit erkannt.** Beim ersten Aufruf holt die Suche
eine Zeile und ordnet die Spaltennamen zu, siehe `src/lib/artikel.ts`. Heißt
eine Spalte anders als erwartet, fällt sie nicht weg, sie erscheint nur im
Block „Alle Felder" statt an ihrem angestammten Platz. Findet die Suche in
einer Spalte keinen Text, weicht sie automatisch auf den Titel aus und sagt
das in der Oberfläche.

**Bilder** sind ein Array von Objekten mit `gross`, `mittel`, `vorschau` und
`position`, nicht einfach Adressen. Sortiert wird nach `position`, angezeigt
wird `vorschau`, verlinkt ist `gross`.

## Einrichten

```bash
cd automations-dashboard
npm install
cp .env.example .env.local   # Schlüssel eintragen
npm run dev                  # http://localhost:5173
```

In `.env.local` gehören zwei Zeilen:

```
VITE_SUPABASE_URL=https://cmijgibhncndxipfrtxl.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable Key aus Supabase>
```

Nur der publishable Key (anon) gehört ins Frontend. Der secret Key darf niemals
in dieses Verzeichnis und niemals in den Browser. Ohne die beiden Werte startet
die App trotzdem und sagt auf einer eigenen Seite, was fehlt.

Weitere Befehle:

```bash
npm run typecheck   # TypeScript prüfen
npm run build       # Typecheck und Bündel nach dist/
npm run preview     # das gebaute Bündel ansehen
```

## Auf Vercel veröffentlichen

Das Dashboard ist ein eigenes Projekt im selben Repository. In Vercel:

- **Root Directory:** `automations-dashboard`
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Umgebungsvariablen:** `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`

Die Datei `vercel.json` leitet alle Pfade auf `index.html` um, damit die
Navigation auch nach dem Neuladen funktioniert.

## Als Windows-Programm (Setup.exe)

Für den Rechner gibt es dieselbe Oberfläche als eigenes Fenster mit Eintrag im
Startmenü. Gebaut wird sie bei GitHub auf einem Windows-Rechner, nicht von Hand.

**Bauen anstoßen:** im Repository auf **Actions**, links
**Automations-Dashboard – Setup.exe bauen**, rechts **Run workflow**. Nach etwa
fünf Minuten liegt unten im Lauf unter **Artifacts** die Datei
`Automationen-Setup-1.0.0.exe` zum Herunterladen.

**Feste Fassung veröffentlichen:** einen Tag setzen, dann hängt die Setup-Datei
direkt an der Veröffentlichung:

```bash
git tag dashboard-v1.0.0
git push origin dashboard-v1.0.0
```

**Zugangsschlüssel.** Zwei Wege, beide funktionieren:

1. Im Repository unter **Settings, Secrets and variables, Actions** die Werte
   `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` hinterlegen. Dann steckt der
   Schlüssel fest im Programm und es läuft nach der Installation sofort.
2. Ohne Secrets bauen. Beim ersten Start legt das Programm die Datei
   `konfiguration.json` an und sagt, wo sie liegt (bei Windows unter
   `%APPDATA%\Automationen`). Dort Adresse und Schlüssel eintragen, Programm neu
   starten. Über **Hilfe, Einstellungsordner öffnen** kommt man direkt hin. So
   braucht ein neuer Schlüssel kein neues Setup.

**Windows warnt beim ersten Start**, weil die Datei nicht signiert ist:
„Der Computer wurde durch Windows geschützt". Über **Weitere Informationen**,
dann **Trotzdem ausführen** startet die Installation. Das verschwindet erst mit
einem gekauften Signaturzertifikat.

**Selbst bauen** geht auch, aber nur auf einem Windows-Rechner:

```bash
npm install
npm run app:setup     # Ergebnis liegt in setup/
npm run app:start     # zum Ausprobieren ohne Installation
```

## Wenn das Dashboard ein eigenes Repository bekommt

Der Ordner lässt sich mit seiner ganzen Geschichte als eigenständiges
Repository herauslösen:

```bash
git clone https://github.com/Akheyo/Youman-automation
cd Youman-automation
git checkout claude/new-session-b5riox
git subtree split --prefix automations-dashboard -b nur-dashboard
git push https://github.com/NEUER-ACCOUNT/automations-dashboard.git nur-dashboard:main
```

Im neuen Repository liegt das Dashboard dann direkt im Wurzelverzeichnis. Der
passende Bauplan für die Setup-Datei liegt schon bereit unter
`.github/workflows/setup-exe.yml` und greift dort automatisch. Getaggt wird in
diesem Fall mit `v1.0.2` statt mit `dashboard-v1.0.2`.

## Woher die Daten kommen

Gelesen wird ausschließlich aus den fertigen Views, nicht selbst zusammengerechnet:

| Ansicht | wofür |
|---|---|
| `v_dashboard_summary_24h` | Kennzahlen der letzten 24 Stunden |
| `v_reliability_trend_14d` | Erfolgsquote pro Tag, letzte 14 Tage |
| `v_automation_overview` | Zuverlässigkeit, offene Fehler, Zuständiger je Automation |
| `v_open_errors_ranked` | offene Fehler, schlimmste zuerst |
| `v_artikel_komplett` | Artikelsuche: Varianten und Texte zusammengeführt |

Dazu direkt aus den Tabellen: `automation_runs` (Durchläufe je Automation),
`automation_errors` (übernehmen und abhaken), `control_commands` (Steuerung),
`profiles` und `audit_log` (Zugänge).

**Spaltennamen der Views:** Die Oberfläche holt sich jeden Wert über eine Liste
möglicher Spaltennamen, siehe `src/lib/fields.ts` und `src/lib/queries.ts`.
Heißt eine Spalte anders als erwartet, bleibt der Wert leer und die Oberfläche
sagt „noch keine Angabe", statt eine falsche Zahl zu zeigen. Wenn irgendwo
dauerhaft nichts steht, gehört der echte Spaltenname in die passende Liste in
`queries.ts`.

## Wie die Steuerung heute funktioniert

Die Automationen selbst sind noch nicht angebunden. Jeder Klick auf einen
Steuerknopf schreibt nur eine Zeile in `control_commands` mit dem Zustand
`pending`. Die Oberfläche zeigt danach sofort, dass der Auftrag eingetragen ist,
und der Knopf bleibt gesperrt, solange der Auftrag offen ist. Ein späterer
Worker arbeitet die Zeilen ab, dann muss an der Oberfläche nichts mehr geändert
werden.

## Aufbau des Quelltexts

```
desktop/          Fenster für Windows (Electron), Menü und Zugangsdatei
src/
  lib/
    supabase.ts   Verbindung, nur mit dem publishable Key
    auth.tsx      Anmeldung, Profil und Rolle
    data.tsx      gemeinsame Daten, Nachladen im Minutentakt, Realtime
    queries.ts    alle Datenbankzugriffe an einer Stelle
    fields.ts     tolerantes Lesen der View-Spalten
    format.ts     deutsche Zeit-, Dauer- und Zahlenformate
    labels.ts     deutsche Wörter für alle Zustände
    types.ts      das Datenmodell
  components/
    Zustandsbalken.tsx  das Kernstück ganz oben
    Steuerung.tsx       die Knöpfe, die nach control_commands schreiben
    Durchlaeufe.tsx     ein Durchlauf mit Klartext und technischer Meldung
    Trend.tsx           14 Tage als Säulen
    Bausteine.tsx       Etiketten, Punkte, leere Zustände
    Hinweise.tsx        kurze Rückmeldungen nach einer Aktion
  pages/
    Anmeldung.tsx  Uebersicht.tsx  Automationen.tsx
    Fehler.tsx     Protokoll.tsx   Zugaenge.tsx
```

## Gestaltung

Die Oberfläche folgt einem festen System, damit sie überall gleich aussieht und
sich gleich verhält. Alle Werte stehen als Variablen in `src/styles/global.css`.

**Farben.** Blau heißt „in Ordnung", Gelb heißt „hinschauen", Rot heißt „kaputt",
bewusst ohne Grün. Für Flächen und Zeichen gelten die Logofarben, für Text
etwas hellere Töne (`--text-blau`, `--text-gelb`, `--text-rot`), damit jede
Schrift auf ihrem Untergrund mindestens 4,5 zu 1 Kontrast hat.

**Zustand nie allein über Farbe.** Jedes Etikett zeigt Farbe, Zeichen und
deutsches Wort zusammen. Wer Farben schlecht unterscheidet, liest trotzdem
sofort, was los ist.

**Schrift.** Fira Sans für Texte, Fira Code für alle Zahlen. Zahlen laufen mit
fester Zeichenbreite, damit in Listen und Tabellen nichts springt. Fällt die
Schrift aus, greifen die Systemschriften.

**Abstände und Radien** kommen aus einer dichten Skala (4, 8, 12, 16, 24, 32,
48 Pixel), passend zu einem Werkzeug, in dem viel auf einen Blick sichtbar
sein soll.

**Verlauf.** Die Erfolgsquote der letzten 14 Tage ist eine Linie mit
gestricheltem Ziel bei 95 Prozent. Die Achse beginnt nicht immer bei null,
sonst sähen alle Tage gleich aus. Wo sie beginnt, steht unter dem Bild. Jeder
Tag ist mit der Tastatur erreichbar, und dieselben Zahlen stehen zusätzlich als
Tabelle für Vorleseprogramme im Quelltext.

**Auf dem Handy** wandert die Navigation als feste Leiste nach unten in
Daumenreichweite, Tabellen werden zu Karten, und der Kopf zeigt nur noch das
Nötigste. Getestet bei 360, 390, 768 und 1280 Pixel Breite.

**Geprüft wurde** mit einem Skript im Browser: jedes Bedienelement hat einen
lesbaren Namen, keine Fläche ist kleiner als 34 Pixel hoch, kein Text liegt
unter 4,5 zu 1 Kontrast, und keine Seite scrollt seitlich. Wer weniger Bewegung
eingestellt hat, bekommt keine Animationen.

## Was bewusst so ist

- **Kein Grün.** Blau heißt „in Ordnung", Gelb heißt „hinschauen", Rot heißt
  „kaputt". So bleibt die Oberfläche in den Firmenfarben.
- **Rechte doppelt geprüft.** Row Level Security in Supabase entscheidet, die
  Oberfläche erklärt zusätzlich, warum ein Knopf gesperrt ist.
- **Realtime ist die Kür.** Die Daten laden sich ohnehin jede Minute nach. Fällt
  die Live-Verbindung aus, merkt man davon nichts.
- **Leere Zustände laden zum Handeln ein**, statt nur zu melden, dass nichts da ist.
- **Beim Laden bleibt die Form stehen.** Statt eines Textes erscheinen graue
  Platzhalter in der Größe des späteren Inhalts, damit nichts springt.
