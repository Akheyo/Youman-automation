Dieses Verzeichnis enthält die JSON-Dateien für Bestand und Bestellungen.

Im Dev-Modus:
  ./storage/bestand.json
  ./storage/bestellungen.json

In der EXE-Version (Windows):
  %APPDATA%/PalettenOptimierer/storage/

Auf Linux/Mac in der gepackten Version:
  ~/.paletten-optimierer/storage/

Die Steuerung erfolgt über die Umgebungsvariable PALETTEN_STORAGE_DIR,
die der Launcher (run_app.py) setzt.

Die JSON-Dateien werden zur Laufzeit beim ersten Speichervorgang erzeugt.
