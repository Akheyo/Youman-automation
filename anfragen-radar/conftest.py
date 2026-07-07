"""Pytest-Konfiguration: isoliertes App-Verzeichnis pro Test."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))


@pytest.fixture(autouse=True)
def isolated_app_dir(tmp_path, monkeypatch):
    """Jeder Test bekommt ein eigenes App-Verzeichnis (DB, Config, Key)."""
    monkeypatch.setenv("ANFRAGEN_RADAR_HOME", str(tmp_path / "appdata"))
    from core import config
    from db import database

    config.reset_cache()
    database.close()
    yield
    database.close()
    config.reset_cache()
