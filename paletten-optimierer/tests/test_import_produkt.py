"""Domain-Fix-Tests: P-Laenge/P-Breite sind Paletten-Maße,
Produkt = Palette − PALETTEN_AUFSCHLAG_MM (50 mm).
"""
from __future__ import annotations

import io
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))
sys.path.insert(0, str(HIER))

from _fixture_builder import erzeuge_fixture  # noqa: E402
from import_excel import importiere, PALETTEN_AUFSCHLAG_MM  # noqa: E402
from optimierer_kern import optimiere  # noqa: E402


def _tmp(n): return Path(tempfile.gettempdir()) / f"paletten_prod_{n}.xlsx"
def _clean(p):
    try:
        if p.exists():
            p.unlink()
    except (PermissionError, OSError):
        pass


def test_konstante_ist_50():
    assert PALETTEN_AUFSCHLAG_MM == 50


def test_p_l_1450_p_b_850_ergibt_produkt_1400_800():
    tmp = _tmp("a")
    try:
        erzeuge_fixture([
            {"auftrag": "A", "name": "K", "artikelnr": "ART",
             "menge": 1, "L": 1450, "B": 850}
        ], tmp, header_zeile=5)
        dat = importiere(tmp)
        e = dat["mit_mass"][0]
        print(f"  Produkt L/B = {e['laenge']}/{e['breite']} | "
              f"Roh = {e['palette_L_excel']}/{e['palette_B_excel']}")
        assert e["laenge"] == 1400
        assert e["breite"] == 800
        assert e["palette_L_excel"] == 1450
        assert e["palette_B_excel"] == 850
    finally:
        _clean(tmp)


def test_p_l_40_landet_in_mass_fehlt():
    tmp = _tmp("b")
    try:
        erzeuge_fixture([
            {"auftrag": "OHNE", "L": 40,   "B": 850, "menge": 1},
            {"auftrag": "MIT",  "L": 1200, "B": 800, "menge": 2},
        ], tmp, header_zeile=5)
        dat = importiere(tmp)
        ohne = {p["auftrag"] for p in dat["ohne_mass"]}
        mit  = {p["auftrag"] for p in dat["mit_mass"]}
        print(f"  ohne_mass={ohne}, mit_mass={mit}")
        assert "OHNE" in ohne
        assert "MIT" in mit
        # Kein Crash beim Optimieren
        orders = [{"L": p["laenge"], "B": p["breite"], "menge": p["anzahl"],
                   "auftrag": p["auftrag"], "name": p["name"]}
                  for p in dat["mit_mass"]]
        r = optimiere(orders, tol_kurz_mm=200, tol_lang_mm=200)
        assert r["invariante_ok"]
    finally:
        _clean(tmp)


def _run(fn):
    try:
        fn()
        print(f"OK  {fn.__name__}")
        return True
    except AssertionError as e:
        print(f"FAIL {fn.__name__}: {e}")
        return False


if __name__ == "__main__":
    tests = [test_konstante_ist_50,
             test_p_l_1450_p_b_850_ergibt_produkt_1400_800,
             test_p_l_40_landet_in_mass_fehlt]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Import-Produkt-Tests bestanden.")
    sys.exit(0 if erfolge == len(tests) else 1)
