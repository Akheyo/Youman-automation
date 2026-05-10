# DAEV Margin Tool

Lokales Web-Tool für DAEV Autoservice. Erfasst pro Fahrzeug Einkauf, Kosten,
Arbeitsstunden und Verkauf — und berechnet **Gewinnanteil und Marge unter
Berücksichtigung der Differenzbesteuerung (§25a UStG)**.

## Features

- **Fahrzeug-Verwaltung**: Stammdaten + Notizen
- **Differenzbesteuerung-Logik**: MwSt fällt nur auf den Bruttogewinn an, nicht
  auf den vollen Verkaufspreis
- **Alle Werte aus dem Original-Sheet sichtbar**: EK, VK, Bruttogewinn,
  Steuer-Faktor 119 %, MwSt-Anteil in €, Nettogewinn, jede Kostenkategorie
  einzeln (Transport, Reparatur, Service, Ersatzteil, Aufbereitung, Anzeige,
  Gebühren, Sonstiges), Arbeitsstunden, Gewinnanteil in € und Marge in %
- **Kostenpositionen** in 8 Kategorien
- **Arbeitsstunden** mit konfigurierbarem Stundensatz
- **Live-Berechnung** in Anlegen/Bearbeiten — Gewinnanteil und Marge
  aktualisieren sich beim Tippen
- **Übersicht** mit Filter (Alle / Im Bestand / Verkauft), Suche und
  Portfolio-Summen
- **Marge-Ampel**: grün ≥ 20 %, gelb 10–20 %, rot < 10 %
- **Deutsches Format**: 1.533,00 € — alle Eingaben akzeptieren beides
  (`1533`, `1533,50`, `1.533,50`)
- **Mobile-tauglich** für die Werkstatt
- **Datenhaltung**: LocalStorage des Browsers — nichts verlässt den Rechner.

## Setup

```bash
npm install
npm run dev
```

Dann <http://localhost:5173> im Browser öffnen. Beim ersten Start fragt die App,
ob der Beispieldatensatz "VW Polo" geladen werden soll.

### Production-Build

```bash
npm run build
npm run preview     # zum lokalen Test des Builds
```

Der Build landet als statische Dateien in `dist/` und kann auf jedem
beliebigen Webserver gehostet werden — kein Backend nötig.

## Tests

```bash
npm test            # einmalig
npm run test:watch  # während der Entwicklung
```

Die Berechnung ist durch Unit-Tests abgesichert. Insbesondere wird der
**VW-Polo-Referenzdatensatz** aus dem Original-Sheet exakt verifiziert:

| Größe                | Wert            |
| -------------------- | --------------- |
| Einkaufspreis (EK)   | 4.750 €         |
| Verkaufspreis (VK)   | 7.500 €         |
| Bruttogewinn         | 2.750 €         |
| Steuer-Faktor        | 119 %           |
| MwSt (19 %)          | 439,08 €        |
| Nettogewinn          | 2.310,92 €      |
| Kostensumme          | 778 €           |
| **Gewinnanteil**     | **1.533 €**     |
| **Marge auf EK**     | **32,27 %**     |

## Berechnungslogik

Aus `src/lib/calculations.ts`:

```ts
const MWST_SATZ = 0.19;

bruttogewinn = verkaufspreis - ankaufspreis;
nettogewinn  = bruttogewinn / (1 + MWST_SATZ);     // §25a UStG
mwstBetrag   = bruttogewinn - nettogewinn;

kostenSumme        = summe(kosten);
arbeitskostenSumme = summe(arbeitsstunden) * stundensatz;

gewinnanteil = nettogewinn - kostenSumme - arbeitskostenSumme;
margePct     = (gewinnanteil / ankaufspreis) * 100;
```

**Achtung**: Diese Logik gilt für Händler, die nach §25a UStG abrechnen. Falls
ein Fahrzeug regelbesteuert verkauft wird, würde sich die Berechnung ändern.

## Projektstruktur

```
src/
├── App.tsx                    # Routing/Shell mit Header und Modals
├── main.tsx                   # React-Entry
├── store.tsx                  # Context-Store + LocalStorage-Sync
├── styles.css                 # Tailwind + Komponenten-Klassen
├── types/index.ts             # Datenmodell (Vehicle, KostenPosition etc.)
├── lib/
│   ├── calculations.ts        # Differenzbesteuerung, Margen, Portfolio-Aggregation
│   ├── calculations.test.ts   # Verifikation inkl. VW-Polo-Beispiel
│   ├── format.ts              # Deutsches Zahlen-/Datumsformat, parseGermanNumber
│   ├── format.test.ts
│   ├── db.ts                  # LocalStorage-Persistenz
│   └── seed.ts                # VW-Polo-Demo-Datensatz
└── components/
    ├── VehicleList.tsx        # Übersichts-Tabelle mit Filtern
    ├── VehicleForm.tsx        # Anlegen/Bearbeiten mit Live-Berechnung
    ├── VehicleDetail.tsx      # Detail-Ansicht
    ├── VerkaufModal.tsx       # "Verkauf erfassen"-Dialog
    ├── KennzahlenPanel.tsx    # Komplette Kalkulation wie im Excel-Sheet
    ├── MoneyInput.tsx         # €-Eingabefeld mit deutscher Formatierung
    └── Dialog.tsx             # Modal-Wrapper
```

## Datenspeicherung & Auto-Sync zwischen 2 PCs

Die installierte Windows-App speichert die Daten als **JSON-Datei** unter

```
%USERPROFILE%\Documents\DAEV Margin Tool\daten.json
```

Wenn der Documents-Ordner via OneDrive synchronisiert wird (Standard auf
Windows 11 mit Microsoft-Konto), arbeiten **zwei PCs automatisch auf
demselben Datenbestand**:

1. App auf PC 1 installieren → Daten erfassen → schließen.
2. OneDrive synchronisiert die JSON im Hintergrund.
3. App auf PC 2 öffnen → liest dieselben Daten beim Start ein.
4. Beim Wechsel zwischen den PCs ggf. einmal auf das Refresh-Symbol oben
   rechts klicken, um die neueste Version zu laden.

**Voraussetzungen für den Auto-Sync**:

- Microsoft-Konto auf beiden PCs des Kunden
- OneDrive-Sync für den Documents-Ordner aktiv (in Windows 11 Standard,
  in OneDrive-Einstellungen unter "Backup")

Falls OneDrive nicht eingerichtet ist, bleibt die Datei lokal — jeder PC
hat dann seinen eigenen Datenbestand.

**Hinweis zu Konflikten**: Sollten beide PCs gleichzeitig die App offen
haben und beide etwas erfassen, gewinnt der zuletzt gespeicherte Stand
("last write wins"). In der Praxis (Werkstatt vs. Büro) ist das kaum
relevant.

Im Web-Vorschau-Modus (`npm run dev` ohne Tauri) fällt die Persistenz auf
LocalStorage des Browsers zurück — kein File-Sync möglich.

## Windows-Installer (.exe) bauen

Die App wird via **Tauri v2** zu einer Windows-`.exe` paketiert. Der Build
läuft in der Cloud auf GitHub Actions — du brauchst auf deinem Rechner kein
Rust und keine Visual-Studio-Build-Tools.

### Build manuell auslösen

1. GitHub-Repo öffnen
2. Tab **Actions** → links **Build Windows Installer** auswählen
3. Rechts **Run workflow** klicken, Branch wählen (`claude/auto-dealer-margin-tool-jggg2`),
   nochmal **Run workflow** bestätigen
4. Nach ca. 5–8 Minuten ist der Build fertig
5. Auf den fertigen Run klicken → unten unter **Artifacts** den Download
   `DAEV-Margin-Tool-Windows` finden, das ZIP enthält die `.exe`

### Versionierten Release erzeugen

```powershell
git tag v1.0.0
git push origin v1.0.0
```

Damit baut der Workflow zusätzlich einen GitHub-Release und hängt die
`.exe` an die Release-Seite an. Der Kunde kann sie dort direkt
runterladen.

### An den Kunden weitergeben

- Datei: `DAEV Margin Tool_1.0.0_x64-setup.exe` (NSIS-Installer)
- Per Mail / USB / Cloud-Link an den Kunden geben
- Doppelklick installiert das Tool. Erscheint dann als **DAEV Margin Tool**
  im Startmenü mit eigenem Icon.
- Daten landen in `%APPDATA%\com.daev.margin-tool` (vom WebView2-Storage
  verwaltet).

### Hinweis zu Windows SmartScreen

Da die `.exe` (noch) nicht code-signiert ist, zeigt Windows beim ersten
Start eine SmartScreen-Warnung ("Der Computer wurde durch Windows
geschützt"). Klick auf **Weitere Informationen → Trotzdem ausführen**.
Für eine signierte Version wäre ein Code-Signing-Zertifikat (~250 €/Jahr)
nötig — die Workflow-Konfiguration unterstützt das bereits, fehlen nur
die Secrets.

### Lokal bauen (optional)

Falls du selbst auf Windows bauen willst (statt via GitHub):

```powershell
# Einmalig: Rust + Visual-Studio-Build-Tools
winget install Rustlang.Rustup
rustup default stable
winget install Microsoft.VisualStudio.2022.BuildTools

# Dann
npm install
npm run tauri:build
# .exe liegt in src-tauri/target/release/bundle/nsis/
```

## Lizenz

Privat.
