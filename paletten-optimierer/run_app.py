"""Launcher für die gepackte EXE.

Findet einen freien Port, setzt einen schreibbaren Storage-Pfad, startet das
Streamlit-Backend über den Bootstrap und öffnet die App in Edge oder Chrome
im App-Modus (windowed, ohne Tab- und Adressleiste). Funktioniert sowohl im
Dev-Modus als auch in der PyInstaller-Distribution.
"""
from __future__ import annotations

import logging
import os
import socket
import subprocess
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
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "Youman"
    else:
        base = Path.home() / ".youman"
    (base / "storage").mkdir(parents=True, exist_ok=True)
    (base / "logs").mkdir(parents=True, exist_ok=True)
    return base


def setup_logging(log_dir: Path) -> Path:
    """Schreibt Streamlit + Launcher-Logs in eine Datei für Diagnose."""
    log_file = log_dir / "youman.log"
    handlers: list[logging.Handler] = [logging.FileHandler(log_file, encoding="utf-8")]
    if not getattr(sys, "frozen", False):
        handlers.append(logging.StreamHandler(sys.stderr))
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=handlers,
        force=True,
    )
    return log_file


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


def warte_auf_port(port: int, timeout: float = 60.0) -> bool:
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


def _finde_app_browser() -> str | None:
    """Findet Edge oder Chrome für ``--app=``-Modus (Windows)."""
    if sys.platform != "win32":
        return None
    kandidaten = [
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Microsoft\Edge\Application\msedge.exe"),
    ]
    for k in kandidaten:
        if k and Path(k).is_file():
            return k
    return None


def oeffne_browser_async(port: int, profil_dir: Path) -> None:
    """Öffnet die App in einem eigenen Browser-Fenster (App-Modus).

    Edge/Chrome ``--app=URL`` blendet Tabs, Adressleiste und Lesezeichen
    aus, sodass die App wie eine native Desktop-Anwendung wirkt. Fallback
    ist der System-Standardbrowser.
    """
    log = logging.getLogger("launcher.browser")

    def _run():
        if not warte_auf_port(port, timeout=60.0):
            log.error("Streamlit-Server nicht erreichbar auf Port %s", port)
            return
        url = f"http://localhost:{port}/"
        browser = _finde_app_browser()
        if browser:
            try:
                profil_dir.mkdir(parents=True, exist_ok=True)
                cmd = [
                    browser,
                    f"--app={url}",
                    f"--user-data-dir={profil_dir}",
                    "--new-window",
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--disable-features=TranslateUI",
                ]
                log.info("Öffne App-Fenster: %s", browser)
                creationflags = 0
                if sys.platform == "win32":
                    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
                subprocess.Popen(cmd, creationflags=creationflags, close_fds=True)
                return
            except Exception as exc:
                log.warning("App-Modus-Browser fehlgeschlagen (%s), Fallback zum Default-Browser", exc)

        try:
            log.info("Öffne Default-Browser: %s", url)
            webbrowser.open(url)
        except Exception as exc:
            log.error("Konnte Browser nicht öffnen: %s", exc)

    threading.Thread(target=_run, daemon=True).start()


def main() -> int:
    base = get_base_path()
    writable = get_writable_path()

    storage_dir = writable / "storage"
    log_dir = writable / "logs"
    profil_dir = writable / "browser-profile"
    os.environ["PALETTEN_STORAGE_DIR"] = str(storage_dir)

    log_file = setup_logging(log_dir)
    log = logging.getLogger("launcher")
    log.info("Youman startet")
    log.info("base=%s writable=%s frozen=%s", base, writable, getattr(sys, "frozen", False))

    if str(base) not in sys.path:
        sys.path.insert(0, str(base))
    os.chdir(base)

    app_py = base / "app.py"
    if not app_py.exists():
        msg = f"app.py nicht gefunden: {app_py}"
        log.error(msg)
        sys.stderr.write(msg + "\n")
        return 2

    try:
        port = freier_port()
        log.info("Verwende Port %s", port)
    except RuntimeError as exc:
        log.error("Kein freier Port: %s", exc)
        return 3

    oeffne_browser_async(port, profil_dir)

    try:
        from streamlit.web import bootstrap

        flag_options = {
            "server.port": port,
            "server.headless": True,
            "server.address": "127.0.0.1",
            "server.fileWatcherType": "none",
            "browser.gatherUsageStats": False,
            "global.developmentMode": False,
        }
        log.info("Starte Streamlit auf %s mit Skript %s", port, app_py)
        bootstrap.load_config_options(flag_options=flag_options)
        bootstrap.run(
            str(app_py),
            is_hello=False,
            args=[],
            flag_options=flag_options,
        )
    except Exception:
        log.exception("Streamlit-Start fehlgeschlagen")
        sys.stderr.write(
            "\nStreamlit konnte nicht gestartet werden.\n"
            f"Log-Datei: {log_file}\n\n"
        )
        if sys.platform == "win32" and getattr(sys, "frozen", False):
            try:
                input("Drücke Enter, um das Fenster zu schließen ...")
            except EOFError:
                pass
        return 1
    log.info("Streamlit beendet")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
