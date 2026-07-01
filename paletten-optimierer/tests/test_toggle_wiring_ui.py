"""UI-Wiring Sonder-Deckel — Toggle + Wert -> optimiere(sonder_deckel=…).

Testet die drei UI-Kombinationen, die der Toggle im Ergebnis-Tab erzeugt:
  - OFF                -> None
  - ON, Default (5)    -> 5
  - ON, Wert 12        -> 12

Statt die Streamlit-App zu starten, wird das Mapping direkt aus
app.py 1:1 nachgezogen (session_state simuliert) und der Wert an
optimierer_kern.optimiere() übergeben, dann result['parameter']
verifiziert.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))
sys.path.insert(0, str(HIER))

from optimierer_kern import optimiere  # noqa: E402


def _mapping(deckel_toggle: bool, deckel_wert: int) -> int | None:
    """Exakt derselbe Ausdruck wie in app.py in der Ergebnisse-Seite."""
    return int(deckel_wert) if bool(deckel_toggle) else None


def _basis_orders() -> list[dict]:
    """Kleiner Cluster, damit das ILP schnell fertig wird."""
    return [
        {"auftrag": f"A{i}", "name": f"K{i}",
         "L": 1200, "B": 800, "menge": 3}
        for i in range(6)
    ] + [
        {"auftrag": f"S{i}", "name": f"S{i}",
         "L": 1700, "B": 1100, "menge": 1}
        for i in range(2)
    ]


def test_deckel_ui_off():
    """Toggle OFF -> sonder_deckel=None."""
    deckel = _mapping(deckel_toggle=False, deckel_wert=5)
    assert deckel is None
    r = optimiere(_basis_orders(),
                  tol_kurz_mm=100, tol_lang_mm=100,
                  max_kombi_teile=3, heterogen_fallback=True,
                  sonder_deckel=deckel)
    assert r["parameter"]["sonder_deckel"] is None, (
        f"Erwartet None, bekam {r['parameter']['sonder_deckel']!r}"
    )


def test_deckel_ui_on_default():
    """Toggle ON, Wert 5 -> sonder_deckel=5."""
    deckel = _mapping(deckel_toggle=True, deckel_wert=5)
    assert deckel == 5
    r = optimiere(_basis_orders(),
                  tol_kurz_mm=100, tol_lang_mm=100,
                  max_kombi_teile=3, heterogen_fallback=True,
                  sonder_deckel=deckel)
    assert r["parameter"]["sonder_deckel"] == 5


def test_deckel_ui_on_wert_12():
    """Toggle ON, Wert 12 -> sonder_deckel=12."""
    deckel = _mapping(deckel_toggle=True, deckel_wert=12)
    assert deckel == 12
    r = optimiere(_basis_orders(),
                  tol_kurz_mm=100, tol_lang_mm=100,
                  max_kombi_teile=3, heterogen_fallback=True,
                  sonder_deckel=deckel)
    assert r["parameter"]["sonder_deckel"] == 12


if __name__ == "__main__":
    tests = [test_deckel_ui_off, test_deckel_ui_on_default,
             test_deckel_ui_on_wert_12]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
            sys.exit(1)
    print(f"\n{len(tests)}/{len(tests)} Sonder-Deckel-UI-Tests bestanden.")
