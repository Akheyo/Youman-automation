"""Launcher für die gepackte Mini-EXE.

Startet Streamlit im Hintergrund-Thread und öffnet ein natives Desktop-
Fenster via pywebview (WebView2 auf Windows). Kein Browser-Tab.

Fallback: falls pywebview-Backend nicht verfügbar → öffnet System-
Standard-Browser (Verhalten wie vorher), damit die App in jedem Fall
nutzbar bleibt.
"""
from __future__ import annotations

import os
import socket
import sys
import threading
import time
from pathlib import Path


APP_TITEL = "Youman – Industriepaletten"
FENSTER_BREITE = 1400
FENSTER_HOEHE = 900
FENSTER_MIN_BREITE = 1024
FENSTER_MIN_HOEHE = 700


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


def _streamlit_starten(app_py: Path, port: int) -> None:
    """Startet Streamlit headless. Blockiert (wird im Thread aufgerufen)."""
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


def _icon_pfad(base: Path) -> str | None:
    """Sucht das Youman-Logo für das Fenster-Icon."""
    kandidaten = [
        base / "assets" / "youman_logo.png",
        base.parent / "assets" / "youman_logo.png",
        Path(__file__).resolve().parent / "assets" / "youman_logo.png",
        Path(__file__).resolve().parent.parent / "assets" / "youman_logo.png",
    ]
    for p in kandidaten:
        if p.exists():
            return str(p)
    return None


def _starte_native_fenster(url: str, base: Path) -> bool:
    """Öffnet ein natives Desktop-Fenster mit pywebview.
    Liefert True bei Erfolg, False wenn pywebview/Backend fehlt."""
    try:
        import webview  # pywebview
    except ImportError:
        return False
    try:
        icon = _icon_pfad(base)
        kwargs = {}
        if icon:
            # pywebview unterstützt 'icon' (Windows), fallback ignoriert es
            kwargs["icon"] = icon
        win = webview.create_window(
            title=APP_TITEL,
            url=url,
            width=FENSTER_BREITE,
            height=FENSTER_HOEHE,
            min_size=(FENSTER_MIN_BREITE, FENSTER_MIN_HOEHE),
            resizable=True,
            confirm_close=False,
            **kwargs,
        )
        # Auf Windows: native EdgeChromium (WebView2). Auf Linux: GTK/QT.
        # Auf macOS: cocoa.
        webview.start(gui=None, debug=False)
        return True
    except Exception as exc:
        sys.stderr.write(f"pywebview-Fenster konnte nicht geöffnet werden: "
                          f"{exc}\n")
        return False


def _fallback_browser(url: str) -> None:
    """Öffnet System-Standard-Browser (Notfall-Fallback)."""
    import webbrowser
    try:
        webbrowser.open(url)
    except Exception:
        sys.stderr.write(f"Bitte manuell öffnen: {url}\n")


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
    url = f"http://127.0.0.1:{port}/"

    # Streamlit im Hintergrund-Thread starten
    streamlit_thread = threading.Thread(
        target=_streamlit_starten, args=(app_py, port), daemon=True,
    )
    streamlit_thread.start()

    # Auf Server-Bereitschaft warten (max 60 s)
    if not warte_auf_port(port, timeout=60.0):
        sys.stderr.write("Streamlit ist nicht in 60 s gestartet.\n")
        return 3

    # Natives Fenster — wenn pywebview nicht klappt, Browser als Fallback
    if not _starte_native_fenster(url, base):
        sys.stderr.write("pywebview nicht verfügbar — Browser-Fallback.\n")
        _fallback_browser(url)
        # Hauptthread am Leben halten damit Streamlit weiter laufen kann
        try:
            streamlit_thread.join()
        except KeyboardInterrupt:
            pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
