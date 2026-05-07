# Paletten Optimierer

Wirtschaftliche Standardisierung von Industrie-Drahtgitterpaletten.
Importiert hunderte/tausende individuelle Palettengrößen aus Excel,
gruppiert sie unter Toleranz-Constraints zu wenigen Standardpaletten und
rechnet die Wirtschaftlichkeit (Palettenkosten vs. zusätzliche
Logistikkosten) durch.

## Was die App leistet

- **Excel-Import** mit flexibler Spaltenerkennung (DE/EN-Schreibweisen).
- **Greedy-Gruppierung** mit Erweiterungs-Pass und Aufrundung auf 50-mm-Raster.
- **Toleranz** in Millimetern oder Prozent.
- **Optionale Palettenkombination** für Sonderfälle.
- **Wirtschaftlichkeitsrechnung** mit Hochrechnung auf 1 / 2 / 3 / 6 / 12 Monate.
- **Bestand & Bestellhistorie** als JSON, mit Status-Bewertung
  (`ok` / `unter` / `kritisch`) und Verhinderung von Doppelbestellungen.
- **PDF-Bestellung** per Knopfdruck (ReportLab).
- **Excel-Export** des Optimierungs-Ergebnisses.
- **Streamlit-Dashboard** mit Sidebar-Navigation, Step-Indikator,
  Plotly-Chart und Logistik-LKW-Visualisierung.

## Schnellstart

### Windows (mit Setup.exe)

Lade die aktuelle `PalettenOptimierer-Setup-X.Y.Z.exe` aus den
[Releases](../../releases/latest), führe sie aus, fertig. Beim Klick auf
das Desktop-Icon startet die App im Standardbrowser.

### Lokal aus dem Quellcode

```bash
cd paletten-optimierer
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python run_app.py
```

oder mit den Convenience-Startern:

```bash
./start_unix.sh                    # macOS/Linux
start_windows.bat                  # Windows
```

Die App öffnet automatisch `http://localhost:8501/`.

## Excel-Format

Mindestens drei Spalten (Reihenfolge und Schreibweise egal):

| Spalte (Aliase)                          | Pflicht | Beispiel |
| ---------------------------------------- | ------- | -------- |
| `Artikelnummer` / `Artikel-Nr` / `SKU`   | ja      | ART-1042 |
| `Laenge` / `Länge` / `Length`            | ja      | 1500     |
| `Breite` / `Width`                       | ja      | 700      |
| `Benoetigte_Paletten` / `Anzahl`         | nein    | 25       |
| `Stueckzahl_pro_Palette`                 | nein    | 30       |
| `Palettenkosten`                         | nein    | 14.50    |

Ungültige Zeilen (negative Maße, fehlende Werte) werden übersprungen.

## Datenspeicherung

Bestand und Bestellhistorie werden als JSON gespeichert:

| Modus       | Pfad                                           |
| ----------- | ---------------------------------------------- |
| Dev         | `./storage/bestand.json` und `bestellungen.json` |
| Windows EXE | `%APPDATA%/PalettenOptimierer/storage/`        |
| Unix EXE    | `~/.paletten-optimierer/storage/`              |

Die Steuerung läuft über die Umgebungsvariable `PALETTEN_STORAGE_DIR`,
die der Launcher (`run_app.py`) automatisch setzt.

## Setup.exe selbst bauen

Siehe [BUILD.md](BUILD.md). Kurzversion:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Die GitHub Action [`Build Windows Installer`](.github/workflows/build-installer.yml)
erzeugt nach 8–12 Minuten eine `PalettenOptimierer-Setup-1.0.0.exe`
unter [Releases](../../releases).

## Projektstruktur

```
paletten-optimierer/
├── app.py                  # Streamlit-Dashboard
├── run_app.py              # Launcher (EXE-kompatibel)
├── optimizer.py            # Greedy-Algorithmus + Wirtschaftlichkeit
├── excel_handler.py        # Excel-Import/Export, Beispieldaten
├── pdf_generator.py        # PDF-Bestellung (ReportLab)
├── storage_handler.py      # JSON-Bestand & Bestellungen
├── requirements.txt
├── data/
│   └── beispiel_palettenliste.xlsx
├── storage/                # JSON-Files (zur Laufzeit)
├── build/
│   ├── paletten-optimierer.spec
│   ├── installer.iss
│   ├── generate_icon.py
│   └── version_info.txt
└── .github/workflows/
    └── build-installer.yml
```

## Lizenz

MIT
