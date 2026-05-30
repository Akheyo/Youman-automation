"""Youman Desktop-App — Entry-Point.

Echte native App auf Basis von CustomTkinter (Tkinter). KEIN Server,
KEIN Browser. Doppelklick auf .exe → eigenes Fenster.
"""
from __future__ import annotations

import sys
import traceback
from pathlib import Path


def _setup_pfade() -> None:
    """Erlaubt Imports sowohl im Dev-Layout als auch im PyInstaller-
    Bundle. Bundle: alle Module flat in _MEIPASS; Dev: in
    paletten-optimierer/{mini,desktop}/."""
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        # Bundle: mini-Engines + desktop-Module liegen flat
        if meipass not in sys.path:
            sys.path.insert(0, meipass)
    else:
        hier = Path(__file__).resolve().parent
        for p in (hier, hier.parent / "mini"):
            if str(p) not in sys.path:
                sys.path.insert(0, str(p))


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
        import os
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
        # Bundle: Module liegen flat, also direkt importieren
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            from app_window import starte  # type: ignore
        else:
            from desktop.app_window import starte
        return starte()
    except Exception as exc:
        _zeige_fehler(exc, traceback.format_exc())
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
