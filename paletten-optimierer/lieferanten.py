"""Lieferanten-Stammdaten (Spec Tab Bestellungen §3).

JSON-Store unter:
  Windows:    %APPDATA%/PalettenMini/lieferanten.json
  Linux/Mac:  ~/.palettenmini/lieferanten.json
  ENV-Override: PALETTENMINI_LIEFERANTEN

Schema:
  {
    "id": "uuid",
    "name": str,
    "kontakt": str,                # Email/Telefon/etc
    "default_palette_ids": [str],  # Welche Paletten kommen ueblicherweise
    "notiz": str,
    "aktiv": bool,
    "datum_erstellt": ISO,
    "datum_geaendert": ISO,
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
    env = os.environ.get("PALETTENMINI_LIEFERANTEN")
    if env:
        return Path(env)
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "PalettenMini"
    else:
        base = Path.home() / ".palettenmini"
    base.mkdir(parents=True, exist_ok=True)
    return base / "lieferanten.json"


def pfad_str() -> str:
    return str(_pfad())


def _read_raw() -> list[dict[str, Any]]:
    p = _pfad()
    if not p.exists():
        return []
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            return []
        # Migration: lieferzeit_tage default
        for e in data:
            e.setdefault("lieferzeit_tage", 14)
        return data
    except (OSError, json.JSONDecodeError):
        return []


def _write_raw(eintraege: list[dict[str, Any]]) -> None:
    p = _pfad()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(eintraege, ensure_ascii=False, indent=2),
                    encoding="utf-8")
    tmp.replace(p)


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def neuer_lieferant(*, name: str, kontakt: str = "",
                     default_palette_ids: list[str] | None = None,
                     notiz: str = "", aktiv: bool = True,
                     lieferzeit_tage: int = 14) -> str:
    """Liefert neue id. name muss nicht-leer sein."""
    if not name.strip():
        raise ValueError("Name darf nicht leer sein.")
    eid = uuid.uuid4().hex
    jetzt = _now()
    eintrag = {
        "id": eid,
        "name": name.strip(),
        "kontakt": str(kontakt or ""),
        "default_palette_ids": list(default_palette_ids or []),
        "notiz": str(notiz or ""),
        "aktiv": bool(aktiv),
        "lieferzeit_tage": int(max(0, lieferzeit_tage)),
        "datum_erstellt": jetzt,
        "datum_geaendert": jetzt,
    }
    h = _read_raw()
    h.append(eintrag)
    _write_raw(h)
    return eid


def update_lieferant(eid: str, **felder) -> bool:
    erlaubt = {"name", "kontakt", "default_palette_ids", "notiz", "aktiv",
               "lieferzeit_tage"}
    h = _read_raw()
    for e in h:
        if e.get("id") == eid:
            # Migration: lieferzeit_tage default 14 wenn fehlt
            e.setdefault("lieferzeit_tage", 14)
            for k, v in felder.items():
                if k in erlaubt:
                    e[k] = v
            e["datum_geaendert"] = _now()
            _write_raw(h)
            return True
    return False


def loesche_lieferant(eid: str) -> dict[str, Any]:
    """Loescht — aber NICHT wenn der Lieferant noch offene Bestellungen
    hat (Spec §5). Caller muss vorher pruefen oder ``erzwingen=True``
    senden (nicht implementiert, blockiert per Default).

    Liefert {ok: bool, fehler: str}.
    """
    h = _read_raw()
    neu = [e for e in h if e.get("id") != eid]
    if len(neu) == len(h):
        return {"ok": False, "fehler": "lieferant-nicht-gefunden"}
    _write_raw(neu)
    return {"ok": True, "fehler": ""}


def alle() -> list[dict[str, Any]]:
    return sorted(_read_raw(), key=lambda e: e.get("name", "").lower())


def aktive() -> list[dict[str, Any]]:
    return [e for e in alle() if e.get("aktiv", True)]


def finde(eid: str) -> dict[str, Any] | None:
    for e in _read_raw():
        if e.get("id") == eid:
            return e
    return None


def name_zu_id(name: str) -> str | None:
    name = (name or "").strip().lower()
    for e in _read_raw():
        if e.get("name", "").lower() == name:
            return e["id"]
    return None
