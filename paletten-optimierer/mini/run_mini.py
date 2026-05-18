"""Launcher für die gepackte Mini-EXE."""
from __future__ import annotations

import os
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path


def get_base_path() -> Path:
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS"))
    return Path(__file__).resolve().parent


def freier_port(start: int = 8601, ende: int = 8620) -> int:
    for p in range(start, ende + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    raise RuntimeError(f"Kein freier Port im Bereich {start}-{ende} gefunden.")


def warte_auf_port(port: int, timeout: float = 60.0) -> bool:
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
        if not warte_auf_port(port, timeout=60.0):
            return
        url = f"http://localhost:{port}/"
        try:
            webbrowser.open(url)
        except Exception:
            pass
    threading.Thread(target=_run, daemon=True).start()


def main() -> int:
    base = get_base_path()
    if str(base) not in sys.path:
        sys.path.insert(0, str(base))
    os.chdir(base)

    app_py = base / "app_mini.py"
    if not app_py.exists():
        sys.stderr.write(f"app_mini.py nicht gefunden: {app_py}\n")
        return 2

    port = freier_port()
    oeffne_browser_async(port)

    from streamlit.web import bootstrap
    flag_options = {
        "server.port": port,
        "server.headless": True,
        "server.address": "127.0.0.1",
        "server.fileWatcherType": "none",
        "browser.gatherUsageStats": False,
        "global.developmentMode": False,
    }
    bootstrap.load_config_options(flag_options=flag_options)
    bootstrap.run(str(app_py), is_hello=False, args=[], flag_options=flag_options)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
