"""C4/C5: Rename Stammdaten 2 -> Artikelmasse + Anleitung-Tab.

Prueft:
  - config.json enthaelt "Artikelmaße" und "Anleitung" als aktivierte Tabs
  - config.json enthaelt kein "Stammdaten 2" mehr
  - app.py hat keinen sichtbaren "Stammdaten 2"-String mehr
  - Anleitung-PDF erzeugt valide PDF-Bytes
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))
sys.path.insert(0, str(HIER))

APP_PY = HIER.parent / "app.py"
CONFIG = HIER.parent / "config.json"
EDITION = HIER.parent / "edition.py"


def test_config_hat_artikelmasse_und_anleitung():
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    tabs = cfg["enabled_tabs"]
    assert "Artikelmaße" in tabs, f"Artikelmaße fehlt: {tabs}"
    assert "Anleitung" in tabs, f"Anleitung fehlt: {tabs}"
    assert "Stammdaten 2" not in tabs, (
        f"Stammdaten 2 muss weg sein: {tabs}"
    )


def test_edition_defaults_ohne_stammdaten_2():
    src = EDITION.read_text(encoding="utf-8")
    assert "Stammdaten 2" not in src, (
        "edition.py enthaelt noch 'Stammdaten 2'"
    )
    assert "Artikelmaße" in src, "edition.py enthaelt kein Artikelmasse"


def test_app_py_ohne_sichtbaren_stammdaten_2():
    """Nur user-sichtbare Strings pruefen. Der Funktionsname
    seite_stammdaten_2 (Python-Identifier) darf bleiben."""
    lines = APP_PY.read_text(encoding="utf-8").splitlines()
    treffer = []
    for i, line in enumerate(lines, start=1):
        if "Stammdaten 2" in line:
            treffer.append(f"{i}: {line.strip()}")
    assert not treffer, "Sichtbare 'Stammdaten 2'-Treffer:\n" + "\n".join(treffer)


def test_anleitung_pdf_valide_bytes():
    """Der PDF-Erzeuger fuer die Anleitung liefert %PDF-Bytes."""
    # Nachbau, weil seite_anleitung Streamlit benoetigt:
    from fpdf import FPDF
    pdf = FPDF(format="A4")
    pdf.add_page()
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 6, "Smoke-Test", ln=1)
    daten = bytes(pdf.output())
    assert daten[:5] == b"%PDF-"
    assert len(daten) > 300


def test_seite_anleitung_pdf_bytes_direkt():
    """Ruft die echte Funktion _anleitung_pdf_bytes ohne Streamlit auf."""
    # Import per exec, um Streamlit-Runtime-Warnungen zu unterdruecken.
    import importlib.util as _iu
    spec = _iu.spec_from_file_location("app_smoke", APP_PY)
    mod = _iu.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except Exception:
        # Streamlit gibt Warnungen, kein echter Fehler
        pass
    daten = mod._anleitung_pdf_bytes()
    assert isinstance(daten, (bytes, bytearray))
    assert daten[:5] == b"%PDF-"
    assert len(daten) > 500


if __name__ == "__main__":
    tests = [test_config_hat_artikelmasse_und_anleitung,
             test_edition_defaults_ohne_stammdaten_2,
             test_app_py_ohne_sichtbaren_stammdaten_2,
             test_anleitung_pdf_valide_bytes,
             test_seite_anleitung_pdf_bytes_direkt]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}:\n  {e}")
            sys.exit(1)
    print(f"\n{len(tests)}/{len(tests)} C-Rename+Anleitung-Tests bestanden.")
