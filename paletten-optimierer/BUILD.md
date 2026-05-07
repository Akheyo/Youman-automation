# Build-Anleitung — Setup.exe

Die `Setup.exe` wird in zwei Schritten erzeugt:

1. **PyInstaller** packt App + Python-Runtime + alle Dependencies in einen
   One-Folder-Build unter `build/dist/PalettenOptimierer/`.
2. **Inno Setup** verpackt diesen Ordner zu einem Windows-Installer.

## Automatisch via GitHub Actions

Empfohlen — kein lokaler Windows-Build nötig.

```bash
git tag v1.0.0
git push origin v1.0.0
```

Der Workflow `.github/workflows/build-installer.yml` läuft auf
`windows-latest`, baut die `Setup.exe` und veröffentlicht sie als Release.
Auch manuell auslösbar über *Actions → Build Windows Installer →
Run workflow*.

## Manuell auf Windows

### Voraussetzungen

- Python 3.12 (64-bit)
- Inno Setup 6.x (`choco install innosetup` oder von
  [jrsoftware.org](https://jrsoftware.org/isinfo.php))
- Git

### Schritte

```pwsh
git clone https://github.com/akheyo/youman-automation.git
cd youman-automation\paletten-optimierer

python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install pyinstaller pillow

# Beispieldaten erzeugen, falls nicht vorhanden:
python -c "from excel_handler import erstelle_beispiel_excel; erstelle_beispiel_excel('data/beispiel_palettenliste.xlsx', 80)"

# Icon und PyInstaller-Build
cd build
python generate_icon.py icon.ico
pyinstaller paletten-optimierer.spec --noconfirm --clean

# Inno Setup → Setup.exe
$env:APP_VERSION = "1.0.0"
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer.iss
```

Resultat: `build\..\dist\installer\PalettenOptimierer-Setup-1.0.0.exe`.

## Hinweise zum Spec

- `console=False` — keine Konsole für den Endnutzer.
- `upx=False` — UPX kann Streamlit-Binaries beschädigen.
- One-Folder statt One-File — startet schneller, ist robuster.
- `collect_all(...)` für Streamlit, Plotly, Altair, Pandas, Openpyxl,
  ReportLab, PyArrow, NumPy: alle datas, binaries und hidden imports.
- `copy_metadata(...)` zusätzlich, weil Streamlit zur Laufzeit
  `importlib.metadata` benutzt.
- Eigene App-Module (`app.py`, `optimizer.py`, ...) werden als Daten in
  den Build kopiert — der Launcher liest `app.py` über `sys._MEIPASS`.

## Troubleshooting

**PyInstaller findet ein Modul nicht**
→ Im Spec unter `extra_hidden` ergänzen, dann `--clean` neu bauen.

**App startet, aber Browser bleibt leer**
→ `run_app.py` setzt `--server.headless true`. Liegt vermutlich an
  fehlenden Streamlit-Statics — `collect_all('streamlit')` prüfen.

**Inno Setup meldet „App läuft noch"**
→ Erwünschtes Verhalten. Beende `PalettenOptimierer.exe` manuell.

**Setup.exe wird vom Virus-Scanner blockiert**
→ Unsigned PyInstaller-Builds werden manchmal als verdächtig eingestuft.
  Für produktive Verteilung Code Signing einrichten.
