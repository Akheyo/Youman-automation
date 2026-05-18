"""Build-Identität.

Wird vom CI-Workflow vor dem PyInstaller-Build mit den echten Werten
überschrieben (Git-SHA + Build-Zeitstempel). Im Dev-Modus (lokales
``streamlit run app.py``) bleibt der ``dev``-Default sichtbar.

So sieht der Nutzer in der UI sofort, welcher Stand in der installierten
EXE wirklich läuft — dadurch wird unterscheidbar:

- Alter Installer (alter SHA) — User hat noch nicht aktualisiert
- Neuer Installer mit dem aktuellen Fix
"""
from __future__ import annotations

BUILD_SHA: str = "dev"
BUILD_DATE: str = "lokal"
BUILD_VERSION: str = "dev"
