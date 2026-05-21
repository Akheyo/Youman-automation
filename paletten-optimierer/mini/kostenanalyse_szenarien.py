"""Kostenanalyse-Szenarien (Spec Kostenanalyse §4 + §8).

JSON-Store fuer benutzerdefinierte Toleranz-Szenarien, die im
Kostenanalyse-Tab nebeneinander verglichen werden.

Pfad:
  Windows:    %APPDATA%/PalettenMini/kostenanalyse_szenarien.json
  Linux/Mac:  ~/.palettenmini/kostenanalyse_szenarien.json
  ENV-Override: PALETTENMINI_KOSTENSZ

Schema:
  {
    "id": "uuid",
    "name": str,                       # z.B. "Szenario A"
    "basis_lauf_id": str | None,       # FK auf import_verlauf-Eintrag
    "params": dict,                    # vollständige Optimierungs-Parameter
    "ergebnis": {"standards": int, "sonder": int, "gesamt": int},
    "erstellt_am": ISO,
  }
"""
from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any


def _pfad() -> Path:
    env = os.environ.get("PALETTENMINI_KOSTENSZ")
    if env:
        return Path(env)
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "PalettenMini"
    else:
        base = Path.home() / ".palettenmini"
    base.mkdir(parents=True, exist_ok=True)
    return base / "kostenanalyse_szenarien.json"


def pfad_str() -> str:
    return str(_pfad())


def _read_raw() -> list[dict[str, Any]]:
    p = _pfad()
    if not p.exists():
        return []
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
        return d if isinstance(d, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def _write_raw(eintraege: list[dict[str, Any]]) -> None:
    p = _pfad()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(eintraege, ensure_ascii=False, indent=2),
                    encoding="utf-8")
    tmp.replace(p)


def neues_szenario(*, name: str, basis_lauf_id: str | None,
                     params: dict, ergebnis: dict) -> str:
    eid = uuid.uuid4().hex
    eintrag = {
        "id": eid,
        "name": str(name or f"Szenario {datetime.now():%H:%M}"),
        "basis_lauf_id": basis_lauf_id,
        "params": dict(params or {}),
        "ergebnis": dict(ergebnis or {}),
        "erstellt_am": datetime.now().isoformat(timespec="seconds"),
    }
    h = _read_raw()
    h.append(eintrag)
    _write_raw(h)
    return eid


def alle() -> list[dict[str, Any]]:
    return sorted(_read_raw(), key=lambda e: e.get("erstellt_am", ""),
                   reverse=True)


def loesche(eid: str) -> bool:
    h = _read_raw()
    neu = [e for e in h if e.get("id") != eid]
    if len(neu) == len(h):
        return False
    _write_raw(neu)
    return True


def leere_alle() -> int:
    h = _read_raw()
    n = len(h)
    _write_raw([])
    return n
