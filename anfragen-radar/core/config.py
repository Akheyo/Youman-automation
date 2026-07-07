"""Einstellungen: lokal verschlüsselt gespeichert (Fernet, Key-Datei im App-Verzeichnis).

Keine Secrets im Repo, keine Klartext-Passwörter auf der Platte.
"""
from __future__ import annotations

import copy
import json
import logging
import os
import threading
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from core import paths

log = logging.getLogger("radar.config")

DEFAULTS: dict[str, Any] = {
    "imap": {
        "host": "",
        "port": 993,
        "user": "maschinensucher@komplett-konzept.de",
        "password": "",
        "ssl": True,
        "folder": "INBOX",
        # read-only Verhalten: Mails werden standardmäßig NICHT als gelesen markiert
        "mark_seen": False,
        "poll_interval_seconds": 120,
        "search_days_back": 14,
    },
    # Nur Mails dieses Absenders werden verarbeitet
    "sender_filter": "info@mail.machineseeker.com",
    "subject_filter": "Kategorie-Anfragen",
    "anthropic": {
        "api_key": "",
        "model": "claude-sonnet-4-6",
        # Optionale LLM-Nachbewertung der Treffer (kostet zusätzliche API-Calls)
        "llm_rerank": False,
    },
    "plenty": {
        "base_url": "https://p14443.my.plentysystems.com",
        "user": "",
        "password": "",
    },
    "maschinensucher": {
        "api_base": "https://api.maschinensucher.de",
        "api_key": "",
        "dealer_id": "",
    },
    "websearch": {
        # brave | serpapi | duckduckgo
        "provider": "duckduckgo",
        "api_key": "",
    },
    "search": {
        "per_source_timeout": 25,
        "max_terms_per_source": 4,
        "max_hits_per_source": 15,
    },
    "sources_enabled": {
        "own_plenty": True,
        "own_maschinensucher": True,
        "maschinensucher_markt": True,
        "ebay": True,
        "kleinanzeigen": True,
        "surplex": True,
        "trademachines": True,
        "resale": True,
        "exapro": True,
        "mascus": True,
        "machinio": True,
        "machineseeker_com": True,
        "gebrauchtmaschinen": True,
        "websearch": True,
    },
}

_lock = threading.RLock()
_cache: dict[str, Any] | None = None


def _deep_merge(base: dict, override: dict) -> dict:
    out = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def _fernet() -> Fernet:
    key_file = paths.key_path()
    if not key_file.exists():
        key = Fernet.generate_key()
        key_file.write_bytes(key)
        try:
            os.chmod(key_file, 0o600)
        except OSError:
            pass
    return Fernet(key_file.read_bytes())


def load() -> dict[str, Any]:
    global _cache
    with _lock:
        if _cache is not None:
            return copy.deepcopy(_cache)
        cfg_file = paths.config_path()
        data: dict[str, Any] = {}
        if cfg_file.exists():
            try:
                data = json.loads(_fernet().decrypt(cfg_file.read_bytes()))
            except (InvalidToken, ValueError) as exc:
                log.error("Konfiguration konnte nicht entschlüsselt werden: %s", exc)
        _cache = _deep_merge(DEFAULTS, data)
        return copy.deepcopy(_cache)


def save(cfg: dict[str, Any]) -> None:
    global _cache
    with _lock:
        merged = _deep_merge(DEFAULTS, cfg)
        token = _fernet().encrypt(json.dumps(merged, ensure_ascii=False).encode())
        paths.config_path().write_bytes(token)
        _cache = merged


def update(section_updates: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        cfg = load()
        cfg = _deep_merge(cfg, section_updates)
        save(cfg)
        return cfg


def reset_cache() -> None:
    """Nur für Tests."""
    global _cache
    with _lock:
        _cache = None
