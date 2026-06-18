"""Persistente Größen-Historie für die kumulative Standard-Regel.

Hält fest, welche Artikelnummern eine bestimmte Palettengröße (Zielmaß
"BxL") im Laufe der Zeit (über mehrere Importe/Optimierungen) genutzt
haben. Sobald eine Größe kumulativ von genügend verschiedenen Artikeln
genutzt wurde, gilt sie als Standard — auch wenn sie in einem einzelnen
Lauf nur 1–2 Artikel hatte.

Speicherort:
  Windows:   %APPDATA%/PalettenMini/groessen_historie.json
  Linux/Mac: ~/.palettenmini/groessen_historie.json

Format: { "1200x800": ["ART-1", "ART-2", ...], ... }
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any


def _pfad() -> Path:
    env = os.environ.get("PALETTENMINI_GROESSEN_HISTORIE")
    if env:
        return Path(env)
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "PalettenMini"
    else:
        base = Path.home() / ".palettenmini"
    try:
        base.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass
    return base / "groessen_historie.json"


def pfad_str() -> str:
    return str(_pfad())


def lade() -> dict[str, list[str]]:
    """Liefert {ziel: [artikelnummern]} (leeres dict wenn nichts da)."""
    p = _pfad()
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(data, dict):
        return {}
    out: dict[str, list[str]] = {}
    for k, v in data.items():
        if isinstance(v, list):
            out[str(k)] = [str(x) for x in v]
    return out


def _speichere(daten: dict[str, list[str]]) -> None:
    p = _pfad()
    try:
        p.write_text(json.dumps(daten, ensure_ascii=False, indent=2),
                     encoding="utf-8")
    except OSError:
        pass


def artikel_anzahl(ziel: str, daten: dict[str, list[str]] | None = None) -> int:
    """Kumulative Anzahl verschiedener Artikel, die diese Größe je genutzt
    haben."""
    daten = lade() if daten is None else daten
    return len(set(daten.get(str(ziel), [])))


def aktualisiere(zuordnung: list[dict[str, Any]]) -> dict[str, list[str]]:
    """Ergänzt die Historie um die Artikel der aktuellen Zuordnung
    (pro Einzelgröße-Zielmaß "BxL"). Idempotent: erneutes Eintragen
    derselben Artikel ändert nichts (Mengen-Union). Liefert die
    aktualisierte Historie.

    Nur echte Einzelgrößen (Format "ZAHLxZAHL") werden berücksichtigt;
    Kombi-/Nicht-zuordenbar-Einträge werden ignoriert.
    """
    import re
    daten = lade()
    for z in zuordnung or []:
        if z.get("typ") == "Nicht zuordenbar":
            continue
        ziel = str(z.get("ziel") or "")
        if not re.fullmatch(r"\d+x\d+", ziel):
            continue
        art = str(z.get("artikelnummer") or "").strip()
        if not art:
            continue
        bestehend = set(daten.get(ziel, []))
        if art not in bestehend:
            bestehend.add(art)
            daten[ziel] = sorted(bestehend)
    _speichere(daten)
    return daten


def zuruecksetzen() -> None:
    """Löscht die gesamte Historie (z. B. für einen Neustart der Zählung)."""
    _speichere({})
