"""Logging: rotierende Datei + SQLite (für die Log-Seite in der UI)."""
from __future__ import annotations

import logging
import logging.handlers

from core import paths


class DbLogHandler(logging.Handler):
    """Schreibt Log-Einträge zusätzlich in die Datenbank (Log-Seite der UI)."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            # Import hier, um Zirkularität beim Modul-Load zu vermeiden
            from db import database

            database.add_log(record.levelname, record.name, self.format(record))
        except Exception:
            # Logging darf niemals die App crashen
            pass


_configured = False


def setup() -> None:
    global _configured
    if _configured:
        return
    _configured = True

    root = logging.getLogger("radar")
    root.setLevel(logging.INFO)

    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")

    file_handler = logging.handlers.RotatingFileHandler(
        paths.log_dir() / "anfragen_radar.log",
        maxBytes=2_000_000,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(fmt)
    root.addHandler(file_handler)

    stream = logging.StreamHandler()
    stream.setFormatter(fmt)
    root.addHandler(stream)

    db_handler = DbLogHandler()
    db_handler.setFormatter(logging.Formatter("%(message)s"))
    db_handler.setLevel(logging.INFO)
    root.addHandler(db_handler)
