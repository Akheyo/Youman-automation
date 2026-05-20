"""OPTIONAL: Regressions-Test gegen die echte Paletten_DM.xlsx.

Wird sauber geskippt wenn die Datei nicht im Repo unter
mini/tests/fixtures/Paletten_DM.xlsx liegt. Build bleibt gruen.

Soll-Werte (aus FINAL-LOCK-Spec):
  tol_kurz=tol_lang=200, deckel=5 -> 16 Std, 0 Sonder, invariante_ok
  tol_kurz=200, tol_lang=400, deckel=5 -> 12 Std, 0 Sonder, invariante_ok
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

from import_excel import importiere  # noqa: E402
from optimierer_kern import optimiere  # noqa: E402

ECHTE_DATEI = HIER / "fixtures" / "Paletten_DM.xlsx"


def test_echt_200_200_deckel5():
    if not ECHTE_DATEI.exists():
        print(f"\n  Skipped — {ECHTE_DATEI.name} nicht in fixtures/")
        return
    dat = importiere(ECHTE_DATEI)
    orders = [{"L": p["laenge"], "B": p["breite"], "menge": p["anzahl"],
               "auftrag": p["auftrag"], "name": p["name"]}
              for p in dat["mit_mass"]]
    r = optimiere(orders, tol_kurz_mm=200, tol_lang_mm=200,
                  max_kombi_teile=3, heterogen_fallback=True,
                  sonder_deckel=5)
    print(f"\n  tol=200/200 deckel=5 -> std={len(r['standards'])} "
          f"sonder={len(r['sonder'])} gesamt={r['gesamt']} "
          f"invariante_ok={r['invariante_ok']}")
    assert r["invariante_ok"]
    assert len(r["standards"]) == 16
    assert len(r["sonder"]) == 0


def test_echt_200_400_deckel5():
    if not ECHTE_DATEI.exists():
        print(f"\n  Skipped — {ECHTE_DATEI.name} nicht in fixtures/")
        return
    dat = importiere(ECHTE_DATEI)
    orders = [{"L": p["laenge"], "B": p["breite"], "menge": p["anzahl"],
               "auftrag": p["auftrag"], "name": p["name"]}
              for p in dat["mit_mass"]]
    r = optimiere(orders, tol_kurz_mm=200, tol_lang_mm=400,
                  max_kombi_teile=3, heterogen_fallback=True,
                  sonder_deckel=5)
    print(f"\n  tol=200/400 deckel=5 -> std={len(r['standards'])} "
          f"sonder={len(r['sonder'])} gesamt={r['gesamt']} "
          f"invariante_ok={r['invariante_ok']}")
    assert r["invariante_ok"]
    assert len(r["standards"]) == 12
    assert len(r["sonder"]) == 0


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
        return False


if __name__ == "__main__":
    tests = [test_echt_200_200_deckel5, test_echt_200_400_deckel5]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Echtdatei-Tests bestanden.")
    sys.exit(0 if erfolge == len(tests) else 1)
