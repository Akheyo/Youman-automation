"""Endnutzer-Einstieg (PyInstaller-Entry-Point).

Startet den lokalen Streamlit-Server unsichtbar im Hintergrund und öffnet
den Browser mit dem Dashboard. Der Mail-Listener läuft als Thread im
Server-Prozess weiter, auch wenn der Browser-Tab geschlossen wird.

Zweiter Doppelklick auf die App öffnet nur ein neues Browser-Fenster zur
bereits laufenden Instanz (kein doppelter Server).
"""
from __future__ import annotations

import os
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path

if hasattr(sys, "_MEIPASS"):
    BASE = Path(sys._MEIPASS)  # type: ignore[attr-defined]
else:
    BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE))

PORT = int(os.environ.get("ANFRAGEN_RADAR_PORT", "8531"))
URL = f"http://127.0.0.1:{PORT}"


def _port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _ensure_streamlit_credentials() -> None:
    """Verhindert Streamlits interaktive E-Mail-Abfrage beim ersten Start
    (die würde im Fenster-losen Build hängen bleiben)."""
    cred = Path.home() / ".streamlit" / "credentials.toml"
    if not cred.exists():
        cred.parent.mkdir(parents=True, exist_ok=True)
        cred.write_text('[general]\nemail = ""\n', encoding="utf-8")


def _open_browser_when_ready() -> None:
    def wait_and_open() -> None:
        for _ in range(120):  # max. ~60 s auf den Server warten
            if _port_in_use(PORT):
                break
            time.sleep(0.5)
        webbrowser.open(URL)

    threading.Thread(target=wait_and_open, daemon=True).start()


def main() -> None:
    # Im Fenster-losen Build (console=False) gibt es kein stdout/stderr –
    # Streamlit/Logging würden sonst crashen. In Logdatei umleiten.
    if sys.stdout is None or sys.stderr is None:
        from core import paths

        console_log = open(  # noqa: SIM115 – lebt für die Prozess-Laufzeit
            paths.log_dir() / "server-console.log",
            "a",
            encoding="utf-8",
            buffering=1,
            errors="replace",
        )
        sys.stdout = sys.stdout or console_log
        sys.stderr = sys.stderr or console_log

    if _port_in_use(PORT):
        # App läuft bereits -> nur das Dashboard (erneut) öffnen
        webbrowser.open(URL)
        return

    _ensure_streamlit_credentials()

    os.environ.setdefault("STREAMLIT_GLOBAL_DEVELOPMENT_MODE", "false")
    os.environ.setdefault("STREAMLIT_SERVER_FILE_WATCHER_TYPE", "none")
    os.environ.setdefault("STREAMLIT_BROWSER_GATHER_USAGE_STATS", "false")

    _open_browser_when_ready()

    from streamlit.web import cli as stcli

    sys.argv = [
        "streamlit", "run", str(BASE / "app.py"),
        "--server.port", str(PORT),
        "--server.address", "127.0.0.1",
        # headless: Streamlit selbst öffnet keinen Browser und stellt keine
        # interaktiven Fragen – wir öffnen den Browser oben selbst.
        "--server.headless", "true",
        "--theme.base", "light",
    ]
    sys.exit(stcli.main())


if __name__ == "__main__":
    main()
