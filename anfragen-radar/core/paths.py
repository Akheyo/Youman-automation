"""Pfade für App-Daten (Config, DB, Logs).

Unter Windows liegt alles in %APPDATA%/AnfragenRadar/, unter Linux/macOS
in ~/.anfragen-radar/ (für Entwicklung/Tests). Über die Umgebungsvariable
ANFRAGEN_RADAR_HOME lässt sich das Verzeichnis überschreiben (Tests!).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

APP_NAME = "AnfragenRadar"


def app_dir() -> Path:
    override = os.environ.get("ANFRAGEN_RADAR_HOME")
    if override:
        path = Path(override)
    elif sys.platform == "win32":
        base = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        path = Path(base) / APP_NAME
    else:
        path = Path.home() / ".anfragen-radar"
    path.mkdir(parents=True, exist_ok=True)
    return path


def db_path() -> Path:
    return app_dir() / "anfragen_radar.sqlite3"


def config_path() -> Path:
    return app_dir() / "config.enc"


def key_path() -> Path:
    return app_dir() / "config.key"


def log_dir() -> Path:
    path = app_dir() / "logs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def resource_path(relative: str) -> Path:
    """Pfad zu mitgelieferten Dateien – funktioniert auch im PyInstaller-Bundle."""
    if hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS) / relative  # type: ignore[attr-defined]
    return Path(__file__).resolve().parent.parent / relative
