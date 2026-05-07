"""Launcher für die gepackte EXE.

Findet einen freien Port, setzt einen schreibbaren Storage-Pfad, startet das
Streamlit-Backend über den Bootstrap und öffnet anschließend einen Browser.
Funktioniert sowohl im Dev-Modus als auch in der PyInstaller-Distribution.
"""
from __future__ import annotations

import os
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path


def get_base_path() -> Path:
    """Liefert das Verzeichnis mit den App-Modulen.

    In der PyInstaller-Distribution ist das ``sys._MEIPASS``, sonst der
    Ordner dieser Datei.
    """
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS"))
    return Path(__file__).resolve().parent


def get_writable_path() -> Path:
    """Liefert ein vom Nutzer beschreibbares Verzeichnis für JSON-Storage."""
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "PalettenOptimierer"
    else:
        base = Path.home() / ".paletten-optimierer"
    (base / "storage").mkdir(parents=True, exist_ok=True)
    return base


def freier_port(start: int = 8501, ende: int = 8520) -> int:
    """Sucht einen freien TCP-Port im angegebenen Bereich."""
    for p in range(start, ende + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    raise RuntimeError(f"Kein freier Port im Bereich {start}-{ende} gefunden.")


def warte_auf_port(port: int, timeout: float = 30.0) -> bool:
    """Pollt einen TCP-Port, bis er erreichbar ist (oder timeout)."""
    start = time.monotonic()
    while time.monotonic() - start < timeout:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            try:
                s.connect(("127.0.0.1", port))
                return True
            except OSError:
                time.sleep(0.3)
    return False


def oeffne_browser_async(port: int) -> None:
    def _run():
        if warte_auf_port(port, timeout=30.0):
            try:
                webbrowser.open(f"http://localhost:{port}/")
            except Exception:
                pass

    threading.Thread(target=_run, daemon=True).start()


def main() -> int:
    base = get_base_path()
    writable = get_writable_path()

    storage_dir = writable / "storage"
    os.environ["PALETTEN_STORAGE_DIR"] = str(storage_dir)

    app_py = base / "app.py"
    if not app_py.exists():
        sys.stderr.write(f"app.py nicht gefunden: {app_py}\n")
        return 2

    port = freier_port()
    oeffne_browser_async(port)

    sys.argv = [
        "streamlit",
        "run",
        str(app_py),
        "--server.port",
        str(port),
        "--server.headless",
        "true",
        "--server.address",
        "127.0.0.1",
        "--browser.gatherUsageStats",
        "false",
        "--global.developmentMode",
        "false",
    ]

    try:
        from streamlit.web import bootstrap

        bootstrap.run(
            str(app_py),
            is_hello=False,
            args=[],
            flag_options={
                "server.port": port,
                "server.headless": True,
                "server.address": "127.0.0.1",
                "browser.gatherUsageStats": False,
                "global.developmentMode": False,
            },
        )
    except Exception as exc:
        sys.stderr.write(f"Streamlit-Start fehlgeschlagen: {exc}\n")
        if sys.platform == "win32" and getattr(sys, "frozen", False):
            try:
                input("Drücke Enter, um das Fenster zu schließen ...")
            except EOFError:
                pass
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
