"""Audit-Log fuer Stammdaten-Aenderungen (Spec §7 + §11).

Erfasst Edits an Paletten-/Lieferanten-Stammdaten mit Pflicht-Bemerkung,
altem und neuem Wert, User und Datum.

Pfad: %APPDATA%/PalettenMini/audit_log.json
ENV-Override: PALETTENMINI_AUDITLOG

Schema:
  {
    "id": "uuid",
    "datum": ISO,
    "user": str,
    "entitaet": "palette" | "lieferant" | "anderes",
    "entitaet_id": str,
    "feld": str,
    "alt": Any,
    "neu": Any,
    "bemerkung": str,
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
    env = os.environ.get("PALETTENMINI_AUDITLOG")
    if env:
        return Path(env)
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "PalettenMini"
    else:
        base = Path.home() / ".palettenmini"
    base.mkdir(parents=True, exist_ok=True)
    return base / "audit_log.json"


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
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(eintraege, ensure_ascii=False, indent=2,
                                default=str),
                    encoding="utf-8")
    tmp.replace(p)


def log_edit(*, entitaet: str, entitaet_id: str, feld: str,
              alt: Any, neu: Any, bemerkung: str = "",
              user: str = "user") -> str:
    eid = uuid.uuid4().hex
    eintrag = {
        "id": eid,
        "datum": datetime.now().isoformat(timespec="seconds"),
        "user": user,
        "entitaet": entitaet,
        "entitaet_id": entitaet_id,
        "feld": feld,
        "alt": alt,
        "neu": neu,
        "bemerkung": str(bemerkung or ""),
    }
    h = _read_raw()
    h.append(eintrag)
    _write_raw(h)
    return eid


def alle() -> list[dict[str, Any]]:
    return sorted(_read_raw(), key=lambda e: e.get("datum", ""),
                   reverse=True)


def fuer_entitaet(entitaet: str, entitaet_id: str) -> list[dict[str, Any]]:
    return [e for e in alle()
            if e.get("entitaet") == entitaet
            and e.get("entitaet_id") == entitaet_id]
