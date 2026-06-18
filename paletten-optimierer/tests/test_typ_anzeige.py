"""UI-Anzeige-Test fuer die 4 Typen aus Kern v4:
'Standard', 'Kombi-Stapel', 'Kombi-Heterogen', 'Sonder'.

Importiert _render direkt (kein Streamlit-Side-Effect).
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

from _render import render_zuord_table  # noqa: E402


def test_render_alle_vier_typen():
    """Konstruiertes res-Objekt mit allen 4 Typen — Render-HTML muss
    alle Badge-Strings und Farbcodes enthalten."""
    res = {
        "zuordnung": [
            {"typ": "Standard", "ziel": "1200x800", "L": 1100, "B": 750,
             "menge": 5, "auftrag": "A1", "name": "Kunde1",
             "artikelnummer": "ART1",
             "palette_L_excel": 1150, "palette_B_excel": 800},
            {"typ": "Kombi-Stapel", "ziel": "2x (800x1200)",
             "L": 1500, "B": 800, "menge": 1, "auftrag": "B1",
             "name": "Kunde2", "artikelnummer": "ART2",
             "palette_L_excel": 1550, "palette_B_excel": 850},
            {"typ": "Kombi-Heterogen", "ziel": "800x1200 + 400x800",
             "L": 1500, "B": 700, "menge": 1, "auftrag": "C1",
             "name": "Kunde3", "artikelnummer": "ART3",
             "palette_L_excel": 1550, "palette_B_excel": 750},
            {"typ": "Sonder", "ziel": "2200x3500", "L": 3500, "B": 2200,
             "menge": 1, "auftrag": "D1", "name": "Kunde4",
             "artikelnummer": "ART4",
             "palette_L_excel": 3550, "palette_B_excel": 2250},
        ],
        "standards": [],
        "sonder": [],
        "gesamt": 4,
    }
    html = render_zuord_table(res)

    assert "✓ Standard" in html, "Standard-Badge fehlt"
    assert "🔗 Stapel" in html, "Kombi-Stapel-Badge fehlt"
    assert "🔗 Kombination" in html, "Kombi-Heterogen-Badge fehlt"
    assert ">Sonder<" in html, "Sonder-Badge fehlt"

    # Farben pro Zeile
    assert "background:#dcfce7" in html, "Standard-Zeile gruen fehlt"
    assert "background:#eff6ff" in html, "Kombi-Zeile hellblau fehlt"
    assert "background:#fee2e2" in html, "Sonder-Zeile rot fehlt"

    # Roh-P-L/P-B muessen auftauchen
    assert "1150" in html and "800" in html, "Excel P-L/P-B fehlt"

    print(f"  OK — alle 4 Typen + Farben + Roh-Werte im HTML.")


def _run(fn):
    try:
        fn()
        print(f"OK  {fn.__name__}")
        return True
    except AssertionError as e:
        print(f"FAIL {fn.__name__}: {e}")
        return False


if __name__ == "__main__":
    tests = [test_render_alle_vier_typen]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Typ-Anzeige-Tests bestanden.")
    sys.exit(0 if erfolge == len(tests) else 1)
