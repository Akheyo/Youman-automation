"""Tests fuer Edition-Feature-Flag (Spec §1)."""
from __future__ import annotations

import io
import json
import os
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8",
                                     errors="replace")

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

import edition  # noqa: E402


def _set_config(d: dict | None) -> str:
    tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
    tmp.close()
    if d is not None:
        Path(tmp.name).write_text(json.dumps(d), encoding="utf-8")
    os.environ["PALETTENMINI_CONFIG"] = tmp.name
    return tmp.name


def test_a_basic_default():
    """Ohne config.json → basic mit 7 Tabs (inkl. 'Maße prüfen').
    Nach C4-Rename heisst 'Stammdaten 2' jetzt 'Artikelmaße'."""
    _set_config(None)
    cfg = edition.lade_config()
    assert cfg["edition"] == "basic"
    tabs = edition.enabled_tabs()
    assert len(tabs) == 10  # +Kostenanalyse +Kostenkalkulation +Anleitung
    for t in ["Dashboard", "Datenimport", "Maße prüfen", "Optimierung",
                "Ergebnisse", "Katalog", "Artikelmaße"]:
        assert t in tabs
    print(f"  basic-Default: {len(tabs)} Tabs.")


def test_b_full_edition():
    """full hat alle 17 Tabs."""
    path = _set_config({"edition": "full"})
    cfg = edition.lade_config()
    assert cfg["edition"] == "full"
    tabs = edition.enabled_tabs()
    assert len(tabs) >= 15
    assert "Einstellungen" in tabs
    assert "Berichte" in tabs
    Path(path).unlink(missing_ok=True)
    print(f"  full-Edition: {len(tabs)} Tabs.")


def test_c_korrupte_json():
    """Korrupte config.json → Fallback auf basic."""
    tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
    tmp.close()
    Path(tmp.name).write_text("{kaputt", encoding="utf-8")
    os.environ["PALETTENMINI_CONFIG"] = tmp.name
    cfg = edition.lade_config()
    assert cfg["edition"] == "basic"
    Path(tmp.name).unlink(missing_ok=True)
    print(f"  Korrupte JSON → Fallback basic.")


def test_d_custom_enabled_tabs():
    """Eigene enabled_tabs-Liste überschreibt Edition-Default."""
    path = _set_config({
        "edition": "basic",
        "enabled_tabs": ["Dashboard", "Optimierung"],
    })
    tabs = edition.enabled_tabs()
    assert tabs == ["Dashboard", "Optimierung"]
    Path(path).unlink(missing_ok=True)
    print(f"  Custom enabled_tabs: 2 Tabs (manuell konfiguriert).")


def test_e_ungueltige_edition():
    """Unbekannte Edition fällt auf basic zurück."""
    path = _set_config({"edition": "ultra-pro"})
    cfg = edition.lade_config()
    assert cfg["edition"] == "basic"
    Path(path).unlink(missing_ok=True)
    print(f"  Unbekannte Edition → basic.")


def test_f_label():
    """edition_label() liefert lesbares Label."""
    _set_config({"edition": "full"})
    assert edition.edition_label() == "Full"
    _set_config(None)
    assert edition.edition_label() == "Basic"
    print(f"  edition_label: Basic/Full.")


def _run(fn):
    try:
        fn()
        print(f"OK  {fn.__name__}")
        return True
    except AssertionError as e:
        print(f"FAIL {fn.__name__}: {e}")
        return False
    except Exception as e:
        print(f"ERR  {fn.__name__}: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    tests = [
        test_a_basic_default,
        test_b_full_edition,
        test_c_korrupte_json,
        test_d_custom_enabled_tabs,
        test_e_ungueltige_edition,
        test_f_label,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Edition-Tests bestanden.")
    sys.exit(0 if erfolge == len(tests) else 1)
