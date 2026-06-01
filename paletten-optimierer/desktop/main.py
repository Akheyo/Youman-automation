"""Youman Desktop-App — Entry-Point.

Echte native App auf Basis von CustomTkinter (Tkinter). KEIN Server,
KEIN Browser. Doppelklick auf .exe → eigenes Fenster.
"""
from __future__ import annotations

import os
import sys
import traceback
from pathlib import Path


def _setup_pfade() -> None:
    """Macht alle Module per absolutem Import erreichbar.
    Dev-Modus: desktop/, desktop/tabs, desktop/widgets + mini/ auf PATH.
    Bundle-Modus: _MEIPASS + Subdirs auf PATH."""
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        for p in (meipass,
                   os.path.join(meipass, "tabs"),
                   os.path.join(meipass, "widgets")):
            if p not in sys.path:
                sys.path.insert(0, p)
    else:
        hier = Path(__file__).resolve().parent
        for p in (hier, hier / "tabs", hier / "widgets",
                   hier.parent / "mini"):
            sp = str(p)
            if sp not in sys.path:
                sys.path.insert(0, sp)


def _zeige_fehler(exc: Exception, tb_text: str) -> None:
    """Notfall-Fehler-Anzeige wenn die App nicht startet."""
    try:
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror(
            "Youman — Startfehler",
            f"App konnte nicht gestartet werden.\n\n"
            f"{type(exc).__name__}: {exc}\n\n"
            f"Details:\n{tb_text[-1500:]}"
        )
        root.destroy()
    except Exception:
        # Letzte Hoffnung: in Log-Datei schreiben
        if sys.platform == "win32":
            base = Path(os.environ.get("APPDATA",
                                          str(Path.home()))) / "PalettenMini"
        else:
            base = Path.home() / ".palettenmini"
        try:
            base.mkdir(parents=True, exist_ok=True)
            (base / "desktop_crash.log").write_text(
                f"{type(exc).__name__}: {exc}\n\n{tb_text}",
                encoding="utf-8",
            )
        except OSError:
            pass


def main() -> int:
    _setup_pfade()
    try:
        from app_window import starte  # type: ignore
        return starte()
    except Exception as exc:
        _zeige_fehler(exc, traceback.format_exc())
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
