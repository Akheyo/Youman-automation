"""Shared State zwischen Tabs (Singleton)."""
from __future__ import annotations

from typing import Any


class AppState:
    """Hält Importdaten, letztes Optimierungsergebnis usw."""

    def __init__(self) -> None:
        self.import_dat: dict | None = None
        self.import_datei_name: str = ""
        self.ergebnis: dict | None = None
        # Parameter
        self.tol_kurz_mm: int = 200
        self.tol_lang_mm: int = 400
        self.kombinieren: bool = True
        self.sonder_erlaubt: bool = True
        self.sonder_min_artikel: int = 5
        self.sonder_aufschlag_mm: int = 0
        self.sonder_deckel: int | None = 5
        # Listener fuer Ereignisse
        self._listeners: dict[str, list] = {}

    def listen(self, event: str, callback) -> None:
        self._listeners.setdefault(event, []).append(callback)

    def fire(self, event: str, **kwargs) -> None:
        for cb in self._listeners.get(event, []):
            try:
                cb(**kwargs)
            except Exception:
                pass


# Singleton
_state = AppState()


def get_state() -> AppState:
    return _state
