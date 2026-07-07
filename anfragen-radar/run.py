"""Endnutzer-Einstieg (PyInstaller-Entry-Point).

Startet den lokalen Streamlit-Server und öffnet den Browser. Der
Mail-Listener läuft als Thread im Server-Prozess weiter, auch wenn der
Browser-Tab geschlossen wird.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def main() -> None:
    if hasattr(sys, "_MEIPASS"):
        base = Path(sys._MEIPASS)  # type: ignore[attr-defined]
    else:
        base = Path(__file__).resolve().parent
    app_path = base / "app.py"

    os.environ.setdefault("STREAMLIT_GLOBAL_DEVELOPMENT_MODE", "false")
    os.environ.setdefault("STREAMLIT_SERVER_FILE_WATCHER_TYPE", "none")
    os.environ.setdefault("STREAMLIT_BROWSER_GATHER_USAGE_STATS", "false")

    from streamlit.web import cli as stcli

    sys.argv = [
        "streamlit", "run", str(app_path),
        "--server.port", os.environ.get("ANFRAGEN_RADAR_PORT", "8531"),
        "--server.address", "127.0.0.1",
        "--server.headless", "false",  # öffnet den Browser automatisch
        "--theme.base", "light",
    ]
    sys.exit(stcli.main())


if __name__ == "__main__":
    main()
