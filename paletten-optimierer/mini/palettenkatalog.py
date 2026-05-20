"""Palettenkatalog — vom Nutzer gepflegte bekannte Paletten-Maße
mit Einkaufs-/Verkaufspreis. Persistent im User-Profil.

Pfad:
  Windows:    %APPDATA%/PalettenMini/palettenkatalog.json
  Linux/Mac:  ~/.palettenmini/palettenkatalog.json
  ENV-Override: PALETTENMINI_KATALOG

Schema pro Eintrag:
  {
    "id": "uuid-hex",
    "datum_erstellt": "ISO8601",
    "L_mm": int,            # Lange Seite (kanonisch: lang >= kurz)
    "B_mm": int,            # Kurze Seite
    "einkaufspreis_eur": float,
    "verkaufspreis_eur": float,
    "bestand": int,         # aktueller Lagerbestand (Stueck)
    "meldebestand": int,    # ab diesem Bestand wird gewarnt
    "notiz": str,           # optional
    "aktiv": bool           # nicht-aktive werden NICHT als Bonus benutzt
  }

Rueckwaerts-kompatibel: alte JSON-Eintraege ohne bestand/meldebestand
werden als 0 interpretiert.

Robust: korrupte/fehlende Datei -> [] (kein Crash).
"""
from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any


def _katalog_pfad() -> Path:
    env = os.environ.get("PALETTENMINI_KATALOG")
    if env:
        return Path(env)
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "PalettenMini"
    else:
        base = Path.home() / ".palettenmini"
    base.mkdir(parents=True, exist_ok=True)
    return base / "palettenkatalog.json"


def katalog_pfad_str() -> str:
    return str(_katalog_pfad())


def _read_raw() -> list[dict[str, Any]]:
    p = _katalog_pfad()
    if not p.exists():
        return []
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def _write_raw(eintraege: list[dict[str, Any]]) -> None:
    p = _katalog_pfad()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(eintraege, ensure_ascii=False, indent=2),
                 encoding="utf-8")


def _kanon(L: float, B: float) -> tuple[int, int]:
    """Kanonische Form (lang, kurz). Eingaben sind int oder float."""
    a, b = int(round(L)), int(round(B))
    return (max(a, b), min(a, b))


def neuer_eintrag(L: int, B: int,
                   einkaufspreis: float = 0.0,
                   verkaufspreis: float = 0.0,
                   bestand: int = 0,
                   meldebestand: int = 0,
                   notiz: str = "",
                   aktiv: bool = True) -> str:
    """Fuegt einen neuen Katalog-Eintrag hinzu. Maß wird kanonisiert.
    Liefert die id."""
    L_k, B_k = _kanon(L, B)
    eid = uuid.uuid4().hex
    eintrag = {
        "id": eid,
        "datum_erstellt": datetime.now().isoformat(timespec="seconds"),
        "L_mm": L_k,
        "B_mm": B_k,
        "einkaufspreis_eur": float(einkaufspreis),
        "verkaufspreis_eur": float(verkaufspreis),
        "bestand": int(bestand),
        "meldebestand": int(meldebestand),
        "notiz": str(notiz),
        "aktiv": bool(aktiv),
    }
    h = _read_raw()
    h.append(eintrag)
    _write_raw(h)
    return eid


def update_eintrag(eintrag_id: str, **felder) -> bool:
    """Aktualisiert ein paar Felder. Erlaubte Felder:
    L_mm, B_mm, einkaufspreis_eur, verkaufspreis_eur,
    bestand, meldebestand, notiz, aktiv."""
    erlaubt = {"L_mm", "B_mm", "einkaufspreis_eur",
               "verkaufspreis_eur", "bestand", "meldebestand",
               "notiz", "aktiv"}
    h = _read_raw()
    for e in h:
        if e.get("id") == eintrag_id:
            for k, v in felder.items():
                if k in erlaubt:
                    e[k] = v
            # Wenn L/B aktualisiert: kanonisieren
            if "L_mm" in felder or "B_mm" in felder:
                L_k, B_k = _kanon(e.get("L_mm", 0), e.get("B_mm", 0))
                e["L_mm"], e["B_mm"] = L_k, B_k
            _write_raw(h)
            return True
    return False


def loesche_eintrag(eintrag_id: str) -> bool:
    h = _read_raw()
    neu = [e for e in h if e.get("id") != eintrag_id]
    if len(neu) == len(h):
        return False
    _write_raw(neu)
    return True


def alle() -> list[dict[str, Any]]:
    """Alle Eintraege, neueste zuerst."""
    h = _read_raw()
    return sorted(h, key=lambda e: e.get("datum_erstellt", ""), reverse=True)


def aktive_masse() -> list[tuple[int, int]]:
    """Liefert die aktiven Katalog-Maße als kanonische (kurz, lang)-Tupel.
    Format passt zum Kern-Parameter ``katalog``."""
    # WICHTIG: Kern v4 verwendet (cs, cl) = (kurze, lange) Seite.
    return [(min(e["L_mm"], e["B_mm"]), max(e["L_mm"], e["B_mm"]))
            for e in _read_raw() if e.get("aktiv", True)]


def lookup_preise(L: int, B: int) -> dict | None:
    """Liefert Einkaufs- und Verkaufspreis fuer ein Maß (kanonisch
    matchend) — None wenn nicht im Katalog oder inaktiv."""
    cs_q, cl_q = min(L, B), max(L, B)
    for e in _read_raw():
        if not e.get("aktiv", True):
            continue
        cs, cl = min(e["L_mm"], e["B_mm"]), max(e["L_mm"], e["B_mm"])
        if cs == cs_q and cl == cl_q:
            return {
                "einkaufspreis_eur": float(e.get("einkaufspreis_eur", 0.0)),
                "verkaufspreis_eur": float(e.get("verkaufspreis_eur", 0.0)),
                "notiz": e.get("notiz", ""),
                "id": e.get("id", ""),
            }
    return None


def set_bestand(eintrag_id: str, neu_bestand: int) -> bool:
    """Spezialisierter Helper — setzt nur den Bestand eines Eintrags."""
    return update_eintrag(eintrag_id, bestand=int(max(0, neu_bestand)))


def kritische_bestaende() -> list[dict[str, Any]]:
    """Liefert alle aktiven Eintraege, bei denen bestand <= meldebestand."""
    out = []
    for e in _read_raw():
        if not e.get("aktiv", True):
            continue
        m = int(e.get("meldebestand", 0) or 0)
        b = int(e.get("bestand", 0) or 0)
        if m > 0 and b <= m:
            out.append(e)
    return out


def leere_katalog() -> int:
    h = _read_raw()
    n = len(h)
    _write_raw([])
    return n
