"""Pflicht-Test gegen Paletten_DM.xlsx.

Soll-Werte laut User-Spec:
- tol_mm=100, kombi_max=3  →  standards=15, sonder=1, gesamt=16  (Optimal)
- tol_mm=100, kombi_max=1  →  deutlich mehr Standards (Gegenprobe)
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from import_excel import importiere  # noqa: E402
from optimierer_kern import optimiere  # noqa: E402


FIXTURE = Path(__file__).resolve().parent / "fixtures" / "paletten_dm.xlsx"


def test_kombi_3_liefert_15_1_16():
    """HARTER ANKER: tol=100, kombi=3 ⇒ 15/1/16 Optimal."""
    dat = importiere(FIXTURE)
    print(f"\n  Import: Header Z.{dat['header_zeile']}, "
          f"mit_mass={len(dat['mit_mass'])}, ohne_mass={len(dat['ohne_mass'])}")
    res = optimiere(dat["mit_mass"], tol_mm=100, kombi_max=3,
                    coverage="einseitig", sonder_deckel=None)
    print(f"  Resultat: status={res['status']}, kandidaten={res['kandidaten']}, "
          f"standards={len(res['standards'])}, sonder={len(res['sonder'])}, "
          f"gesamt={res['gesamt']}")
    print(f"  Standards: {res['standards']}")
    print(f"  Sonder: {res['sonder']}")
    assert res["status"] == "Optimal", f"ILP-Status: {res['status']}"
    assert len(res["standards"]) == 15, (
        f"Standards = {len(res['standards'])}, erwartet 15"
    )
    assert len(res["sonder"]) == 1, (
        f"Sonder = {len(res['sonder'])}, erwartet 1"
    )
    assert res["gesamt"] == 16, (
        f"Gesamt = {res['gesamt']}, erwartet 16"
    )


def test_kombi_1_gegenprobe_deutlich_mehr():
    """Ohne Kombi (kombi_max=1) müssen DEUTLICH mehr Standards
    entstehen — weil viele Aufträge nur via Kombi auflösbar waren."""
    dat = importiere(FIXTURE)
    res = optimiere(dat["mit_mass"], tol_mm=100, kombi_max=1,
                    coverage="einseitig", sonder_deckel=None)
    print(f"\n  Tol=100, Kombi=1 → status={res['status']}, "
          f"standards={len(res['standards'])}, sonder={len(res['sonder'])}, "
          f"gesamt={res['gesamt']}")
    assert res["status"] == "Optimal"
    assert res["gesamt"] >= 25, (
        f"kombi=1 sollte deutlich mehr als 16 Maße liefern, "
        f"bekam gesamt={res['gesamt']}"
    )


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
        import traceback; traceback.print_exc()
        return False


if __name__ == "__main__":
    tests = [test_kombi_3_liefert_15_1_16, test_kombi_1_gegenprobe_deutlich_mehr]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print("="*60)
    print(f"{erfolge}/{len(tests)} Tests bestanden.")
    print("="*60)
    sys.exit(0 if erfolge == len(tests) else 1)
