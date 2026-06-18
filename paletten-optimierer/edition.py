"""Edition-Konfiguration (Spec §1 + §10).

Liest config.json fuer Feature-Flags. Default 'basic' Edition hat 6
Tabs aktiv; 'full' zeigt alles.

Pfad:
  1. ENV-Override: PALETTENMINI_CONFIG
  2. Neben app.py: config.json
  3. User-Profile: ~/.palettenmini/config.json
  4. Fallback: 'basic'-Default

Schema:
  {
    "edition": "basic" | "full",
    "enabled_tabs": ["dashboard","import",...]
  }
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any


# Default-Editionen (Spec §1)
EDITIONS = {
    "basic": {
        "label": "Basic",
        "tabs": [
            "Dashboard", "Datenimport", "Maße prüfen", "Optimierung",
            "Ergebnisse", "Katalog", "Stammdaten 2",
        ],
    },
    "full": {
        "label": "Full",
        "tabs": [
            "Dashboard", "Datenimport", "Maße prüfen", "Einstellungen",
            "Optimierung",
            "Ergebnisse", "Verlauf", "Katalog", "Bestand & Disposition",
            "Bestellungen", "Beschaffung", "Historie",
            "Wirtschaftlichkeit", "Kostenanalyse", "Stammdaten",
            "Stammdaten 2", "Berichte", "App-Einstellungen",
        ],
    },
}

DEFAULT_EDITION = "basic"


def _config_pfad() -> Path | None:
    env = os.environ.get("PALETTENMINI_CONFIG")
    if env:
        p = Path(env)
        if p.exists():
            return p
    # neben app.py
    hier = Path(__file__).resolve().parent
    p_lokal = hier / "config.json"
    if p_lokal.exists():
        return p_lokal
    # User-Profil
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "PalettenMini"
    else:
        base = Path.home() / ".palettenmini"
    p_user = base / "config.json"
    if p_user.exists():
        return p_user
    return None


def lade_config() -> dict[str, Any]:
    """Liest config.json oder liefert Defaults."""
    p = _config_pfad()
    if p is None:
        return {"edition": DEFAULT_EDITION,
                 "enabled_tabs": EDITIONS[DEFAULT_EDITION]["tabs"]}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("config muss dict sein")
    except (OSError, json.JSONDecodeError, ValueError):
        return {"edition": DEFAULT_EDITION,
                 "enabled_tabs": EDITIONS[DEFAULT_EDITION]["tabs"]}
    edition = data.get("edition", DEFAULT_EDITION)
    if edition not in EDITIONS:
        edition = DEFAULT_EDITION
    # enabled_tabs aus config, sonst Edition-Default
    enabled = data.get("enabled_tabs")
    if not isinstance(enabled, list) or not enabled:
        enabled = EDITIONS[edition]["tabs"]
    return {"edition": edition, "enabled_tabs": list(enabled),
             "config_pfad": str(p)}


def enabled_tabs() -> list[str]:
    return lade_config()["enabled_tabs"]


def edition_label() -> str:
    cfg = lade_config()
    return EDITIONS.get(cfg["edition"], EDITIONS[DEFAULT_EDITION])["label"]
