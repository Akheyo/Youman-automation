"""Persistenter Import-Verlauf der Mini-App.

Pfad:
  Windows:    %APPDATA%/PalettenMini/import_verlauf.json
  Linux/Mac:  ~/.palettenmini/import_verlauf.json
  ENV:        PALETTENMINI_VERLAUF überschreibt beides.

Schema pro Eintrag (User-Spec):
  {
    "id": "uuid-hex",
    "datum": "ISO8601",
    "datei_name": "Paletten_DM.xlsx",
    "datei_pfad_original": "C:\\Users\\...\\Paletten_DM.xlsx",
    "datei_hash_sha256": "abc...",
    "datei_groesse_bytes": 12345,
    "ergebnis": {
      "datenzeilen": 508,
      "auftraege_mit_mass": 469,
      "auftraege_ohne_mass": 39,
      "paletten_gesamt": 2724,
      "normalisierte_masse": 158
    },
    "optimierung": null  | dict
  }

Robust: korrupte / fehlende JSON-Datei -> alle() liefert [],
neuer_eintrag() legt eine neue saubere Datei an. Niemals Crash.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------
# Pfad
# ---------------------------------------------------------------------
def _verlauf_pfad() -> Path:
    env = os.environ.get("PALETTENMINI_VERLAUF")
    if env:
        return Path(env)
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "PalettenMini"
    else:
        base = Path.home() / ".palettenmini"
    base.mkdir(parents=True, exist_ok=True)
    return base / "import_verlauf.json"


def verlauf_pfad_str() -> str:
    return str(_verlauf_pfad())


# ---------------------------------------------------------------------
# Read / Write robust
# ---------------------------------------------------------------------
def _read_raw() -> list[dict[str, Any]]:
    pfad = _verlauf_pfad()
    if not pfad.exists():
        return []
    try:
        text = pfad.read_text(encoding="utf-8")
    except OSError:
        return []
    try:
        data = json.loads(text)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, ValueError):
        return []


def _write_raw(eintraege: list[dict[str, Any]]) -> None:
    pfad = _verlauf_pfad()
    pfad.parent.mkdir(parents=True, exist_ok=True)
    pfad.write_text(
        json.dumps(eintraege, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


# ---------------------------------------------------------------------
# API
# ---------------------------------------------------------------------
def neuer_eintrag(
    datei_pfad: str | Path,
    ergebnis: dict[str, Any],
    datei_bytes: bytes | None = None,
) -> str:
    """Legt einen neuen Verlaufs-Eintrag an und liefert die id.

    ``datei_pfad`` ist der ursprüngliche Pfad/Name der Excel-Datei.
    Wenn ``datei_bytes`` angegeben ist (z.B. aus einem Streamlit-
    Upload), werden Hash + Größe daraus berechnet — sonst aus der
    Datei auf dem Pfad gelesen.

    ``ergebnis`` darf entweder der direkte Output von
    ``importiere()`` sein oder bereits das verdichtete Spec-Schema.
    """
    p = Path(str(datei_pfad)) if datei_pfad else None

    if datei_bytes is None and p is not None and p.is_file():
        try:
            datei_bytes = p.read_bytes()
        except OSError:
            datei_bytes = b""
    if datei_bytes is None:
        datei_bytes = b""

    sha = hashlib.sha256(datei_bytes).hexdigest()
    groesse = len(datei_bytes)

    # Ergebnis-Block: akzeptiere beide Formate
    if "datenzeilen" in ergebnis and "auftraege_mit_mass" in ergebnis:
        erg_block = {
            "datenzeilen": int(ergebnis.get("datenzeilen", 0)),
            "auftraege_mit_mass": int(ergebnis.get("auftraege_mit_mass", 0)),
            "auftraege_ohne_mass": int(ergebnis.get("auftraege_ohne_mass", 0)),
            "paletten_gesamt": int(ergebnis.get("paletten_gesamt", 0)),
            "normalisierte_masse": int(ergebnis.get("normalisierte_masse", 0)),
        }
    else:
        erg_block = {
            "datenzeilen": int(ergebnis.get("datenzeilen_gesamt", 0)),
            "auftraege_mit_mass": int(len(ergebnis.get("mit_mass", []))),
            "auftraege_ohne_mass": int(len(ergebnis.get("ohne_mass", []))),
            "paletten_gesamt": int(ergebnis.get("paletten_gesamt", 0)),
            "normalisierte_masse": int(ergebnis.get("unique_normalisierte_masse", 0)),
        }

    eintrag = {
        "id": uuid.uuid4().hex,
        "datum": datetime.now().isoformat(timespec="seconds"),
        "datei_name": p.name if p else "",
        "datei_pfad_original": str(p) if p else "",
        "datei_hash_sha256": sha,
        "datei_groesse_bytes": groesse,
        "ergebnis": erg_block,
        "optimierung": None,
    }

    h = _read_raw()
    h.append(eintrag)
    _write_raw(h)
    return eintrag["id"]


def update_optimierung(eintrag_id: str, optimierung: dict[str, Any]) -> bool:
    """Setzt das Feld 'optimierung' des Eintrags mit ``eintrag_id``.
    Liefert True wenn aktualisiert, False wenn Eintrag nicht da."""
    h = _read_raw()
    treffer = False
    for e in h:
        if e.get("id") == eintrag_id:
            e["optimierung"] = optimierung
            treffer = True
            break
    if treffer:
        _write_raw(h)
    return treffer


def alle() -> list[dict[str, Any]]:
    """Alle Eintraege, neueste zuerst."""
    h = _read_raw()
    return sorted(h, key=lambda e: e.get("datum", ""), reverse=True)


def finde_per_hash(sha256: str) -> list[dict[str, Any]]:
    """Alle Eintraege mit passendem datei_hash_sha256, neueste zuerst."""
    h = _read_raw()
    treffer = [e for e in h if e.get("datei_hash_sha256") == sha256]
    return sorted(treffer, key=lambda e: e.get("datum", ""), reverse=True)


def leere_verlauf() -> int:
    """Loescht alle Eintraege. Liefert die Anzahl geloeschter Eintraege."""
    h = _read_raw()
    n = len(h)
    _write_raw([])
    return n


def hash_bytes(b: bytes) -> str:
    """Hilfsfunktion: SHA256 fuer beliebige Bytes (z.B. Streamlit-Upload)."""
    return hashlib.sha256(b).hexdigest()
