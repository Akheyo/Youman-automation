"""Launcher für die gepackte Mini-EXE.

Startet Streamlit als Subprocess + öffnet ein natives Desktop-Fenster
via pywebview (WebView2 auf Windows). Kein Browser-Tab.

Bei Problemen: Log unter %APPDATA%/PalettenMini/launcher.log
"""
from __future__ import annotations

import os
import socket
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path


APP_TITEL = "Youman – Industriepaletten"
FENSTER_BREITE = 1400
FENSTER_HOEHE = 900
FENSTER_MIN_BREITE = 1024
FENSTER_MIN_HOEHE = 700


# ---------------------------------------------------------------------------
# Sicheres Logging — funktioniert auch wenn sys.stderr/stdout None ist
# (PyInstaller-Bundle ohne Konsole) und schreibt zusätzlich in eine Datei
# ---------------------------------------------------------------------------
def _log_pfad() -> Path:
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "PalettenMini"
    else:
        base = Path.home() / ".palettenmini"
    try:
        base.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass
    return base / "launcher.log"


def log(msg: str) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}\n"
    # 1. Stdout/stderr — nur wenn sie existieren (PyInstaller-Bundle ohne
    #    Konsole hat sys.stderr/stdout == None)
    try:
        stream = sys.stderr if sys.stderr is not None else sys.stdout
        if stream is not None and hasattr(stream, "write"):
            stream.write(line)
            stream.flush()
    except Exception:
        pass
    # 2. Datei
    try:
        with open(_log_pfad(), "a", encoding="utf-8") as f:
            f.write(line)
    except OSError:
        pass


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


def warte_auf_port(port: int, timeout: float = 90.0) -> bool:
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


def _streamlit_subprocess(app_py: Path, port: int,
                            base: Path) -> subprocess.Popen:
    """Startet 'python -m streamlit run app_mini.py'. Liefert das Popen-
    Objekt. Im PyInstaller-Bundle ist sys.executable die EXE selbst —
    wir wollen Streamlit aber NICHT rekursiv starten. Stattdessen rufen
    wir bootstrap.run() im Thread auf (wenn frozen)."""
    log_file = open(_log_pfad().parent / "streamlit_server.log",
                      "a", encoding="utf-8")
    cmd = [
        sys.executable, "-m", "streamlit", "run", str(app_py),
        f"--server.port={port}",
        "--server.headless=true",
        "--server.address=127.0.0.1",
        "--server.fileWatcherType=none",
        "--browser.gatherUsageStats=false",
    ]
    return subprocess.Popen(
        cmd,
        cwd=str(base),
        stdout=log_file,
        stderr=log_file,
        stdin=subprocess.DEVNULL,
        creationflags=(subprocess.CREATE_NO_WINDOW
                        if sys.platform == "win32" else 0),
    )


def _streamlit_inline(app_py: Path, port: int, base: Path) -> None:
    """Bootstrap-Pfad fuer PyInstaller-Bundles (sys.executable ist die EXE,
    Subprocess wuerde rekursiv die EXE starten). Blockiert — daher im
    Thread aufzurufen."""
    try:
        sys.path.insert(0, str(base))
        os.chdir(str(base))
        from streamlit.web import bootstrap
        # Streamlit registriert beim Start via signal.signal() einen
        # SIGTERM-Handler — das funktioniert NUR im Haupt-Thread. Da der
        # Bootstrap hier im Hintergrund-Thread laeuft, wuerde das mit
        # "signal only works in main thread of the main interpreter"
        # abstuerzen. Der Handler dient nur dem sauberen Herunterfahren
        # und ist im eingebetteten Betrieb verzichtbar -> neutralisieren.
        try:
            bootstrap._set_up_signal_handler = lambda *a, **k: None  # type: ignore[attr-defined]
        except Exception:
            pass
        flag_options = {
            "server.port": port,
            "server.headless": True,
            "server.address": "127.0.0.1",
            "server.fileWatcherType": "none",
            "browser.gatherUsageStats": False,
            "global.developmentMode": False,
            # Festes helles Theme — nicht dem OS-Dark-Mode folgen
            "theme.base": "light",
            "theme.primaryColor": "#2563eb",
            "theme.backgroundColor": "#f5f6f8",
            "theme.secondaryBackgroundColor": "#ffffff",
            "theme.textColor": "#1f2937",
        }
        bootstrap.load_config_options(flag_options=flag_options)
        bootstrap.run(str(app_py), is_hello=False, args=[],
                       flag_options=flag_options)
    except Exception as exc:
        log(f"Streamlit-Bootstrap-Fehler: {exc}")
        import traceback
        log(traceback.format_exc())


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


def _fehler_html(titel: str, msg: str) -> str:
    """HTML-Inhalt fuer Fehler-Fenster."""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>{titel}</title>
<style>
body{{font-family:Segoe UI,system-ui,sans-serif;background:#0f1f3d;
     color:#fff;margin:0;padding:40px;}}
h1{{color:#fbbf24;font-size:22px;}}
pre{{background:#1a2944;color:#e2e8f0;padding:14px;border-radius:8px;
     white-space:pre-wrap;word-wrap:break-word;font-size:12px;}}
.box{{max-width:760px;margin:auto;}}
a{{color:#60a5fa;}}
</style></head><body><div class="box">
<h1>{titel}</h1>
<pre>{msg}</pre>
<p style="color:#94a3b8;font-size:12px;">
Log-Datei: <code>%APPDATA%\\PalettenMini\\launcher.log</code><br>
Server-Log: <code>%APPDATA%\\PalettenMini\\streamlit_server.log</code>
</p></div></body></html>"""


def _starte_native_fenster(url: str | None, base: Path,
                              html_inhalt: str | None = None) -> bool:
    """Öffnet ein natives Desktop-Fenster mit pywebview."""
    try:
        import webview
    except Exception as exc:
        log(f"pywebview-Import fehlgeschlagen: {exc}")
        return False
    try:
        # Hinweis: 'icon=' wird erst von neueren pywebview-Versionen
        # unterstuetzt; die gebundelte Version kennt es nicht -> weglassen.
        # Das Fenster-/Taskbar-Icon liefert ohnehin die EXE selbst.
        if url:
            webview.create_window(
                title=APP_TITEL, url=url,
                width=FENSTER_BREITE, height=FENSTER_HOEHE,
                min_size=(FENSTER_MIN_BREITE, FENSTER_MIN_HOEHE),
                resizable=True, confirm_close=False,
            )
        else:
            webview.create_window(
                title=APP_TITEL, html=html_inhalt or "Kein Inhalt.",
                width=900, height=600,
                resizable=True,
            )
        webview.start(gui=None, debug=False)
        return True
    except Exception as exc:
        log(f"pywebview-Start fehlgeschlagen: {exc}")
        import traceback
        log(traceback.format_exc())
        return False


def _fallback_browser(url: str) -> None:
    import webbrowser
    try:
        webbrowser.open(url)
    except Exception as exc:
        log(f"Browser-Fallback fehlgeschlagen: {exc}")


def main() -> int:
    log("=" * 60)
    log("Youman Launcher startet")
    base = get_base_path()
    log(f"base path: {base}")

    if str(base) not in sys.path:
        sys.path.insert(0, str(base))
    try:
        os.chdir(base)
    except OSError as exc:
        log(f"chdir fehlgeschlagen: {exc}")

    app_py = base / "app_mini.py"
    if not app_py.exists():
        msg = f"app_mini.py nicht gefunden in {base}"
        log(msg)
        _starte_native_fenster(None, base,
                                  html_inhalt=_fehler_html(
                                      "App-Datei fehlt", msg))
        return 2

    try:
        port = freier_port()
    except Exception as exc:
        log(f"Kein freier Port: {exc}")
        _starte_native_fenster(None, base,
                                  html_inhalt=_fehler_html(
                                      "Port-Fehler", str(exc)))
        return 4

    url = f"http://127.0.0.1:{port}/"
    log(f"Streamlit-Port: {port}")

    # Im PyInstaller-Bundle ist sys.executable die EXE selbst → Subprocess
    # wuerde rekursiv die EXE starten. Daher inline im Thread.
    is_frozen = getattr(sys, "frozen", False)
    if is_frozen:
        log("frozen=True → Streamlit im Thread (inline bootstrap)")
        streamlit_thread = threading.Thread(
            target=_streamlit_inline, args=(app_py, port, base),
            daemon=True,
        )
        streamlit_thread.start()
        proc = None
    else:
        log("frozen=False → Streamlit als Subprocess")
        try:
            proc = _streamlit_subprocess(app_py, port, base)
        except Exception as exc:
            log(f"Subprocess-Start fehlgeschlagen: {exc}")
            return 5

    # Auf Server-Bereitschaft warten (90 s, sehr großzuegig im EXE-Bundle)
    log("warte auf Port…")
    if not warte_auf_port(port, timeout=90.0):
        log("Streamlit nicht in 90 s gestartet.")
        # Versuche, das Server-Log einzulesen für die Fehlermeldung
        server_log = ""
        try:
            log_p = _log_pfad().parent / "streamlit_server.log"
            if log_p.exists():
                server_log = log_p.read_text(encoding="utf-8",
                                                errors="replace")[-3000:]
        except OSError:
            pass
        _starte_native_fenster(None, base,
                                  html_inhalt=_fehler_html(
                                      "Streamlit-Server startet nicht",
                                      "Der interne Server konnte in 90 s "
                                      "nicht starten.\n\n"
                                      "Letzte Server-Ausgabe:\n\n"
                                      + (server_log or "(keine Log-Datei)")))
        return 3

    log("Port offen — öffne natives Fenster.")
    if not _starte_native_fenster(url, base):
        log("pywebview nicht verfügbar — Browser-Fallback.")
        _fallback_browser(url)
        # Thread/Subprocess am Leben halten
        if proc is not None:
            try:
                proc.wait()
            except KeyboardInterrupt:
                proc.terminate()
        else:
            try:
                streamlit_thread.join()
            except KeyboardInterrupt:
                pass

    log("Fenster geschlossen — Beende.")
    if proc is not None:
        try:
            proc.terminate()
        except OSError:
            pass
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as exc:
        log(f"FATAL: {exc}")
        import traceback
        log(traceback.format_exc())
        # Notfall: Fehler-Fenster anzeigen
        try:
            import webview
            webview.create_window(
                title="Youman — Startfehler",
                html=_fehler_html("Fataler Fehler beim Start",
                                     str(exc) + "\n\n"
                                     + traceback.format_exc()),
                width=900, height=600,
            )
            webview.start(gui=None, debug=False)
        except Exception:
            pass
        raise SystemExit(1)
