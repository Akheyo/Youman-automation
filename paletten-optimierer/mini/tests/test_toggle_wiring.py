"""Verifiziert dass die UI-Toggles korrekt an den Kern verdrahtet sind.

Kern-v4-Aufruf-Signatur aus FINAL-LOCK-Spec:
  Kombi-Toggle ON  -> max_kombi_teile=3, heterogen_fallback=True
  Kombi-Toggle OFF -> max_kombi_teile=1, heterogen_fallback=False
  Deckel-Toggle ON, Wert=7 -> sonder_deckel=7
  Deckel-Toggle OFF        -> sonder_deckel=None

result['parameter'] spiegelt die TATSAECHLICHE Aufruf-Konfiguration.
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

from optimierer_kern import optimiere  # noqa: E402


ORDS = [
    {"L": 1200, "B": 800, "menge": 9, "auftrag": "S1", "name": ""},
    {"L":  400, "B": 800, "menge": 9, "auftrag": "S2", "name": ""},
    {"L": 1500, "B": 700, "menge": 1, "auftrag": "X",  "name": ""},
]


def test_kombi_off():
    r = optimiere(ORDS, tol_kurz_mm=200, tol_lang_mm=200,
                  max_kombi_teile=1, heterogen_fallback=False)
    p = r["parameter"]
    print(f"\n  Kombi OFF: max_kombi_teile={p['max_kombi_teile']} "
          f"heterogen_fallback={p['heterogen_fallback']}")
    assert p["max_kombi_teile"] == 1, p
    assert p["heterogen_fallback"] is False, p


def test_kombi_on():
    r = optimiere(ORDS, tol_kurz_mm=200, tol_lang_mm=200,
                  max_kombi_teile=3, heterogen_fallback=True)
    p = r["parameter"]
    print(f"  Kombi ON:  max_kombi_teile={p['max_kombi_teile']} "
          f"heterogen_fallback={p['heterogen_fallback']}")
    assert p["max_kombi_teile"] == 3, p
    assert p["heterogen_fallback"] is True, p


def test_deckel_off_ist_none():
    r = optimiere(ORDS, tol_kurz_mm=200, tol_lang_mm=200,
                  max_kombi_teile=3, heterogen_fallback=True,
                  sonder_deckel=None)
    p = r["parameter"]
    print(f"  Deckel OFF: sonder_deckel={p['sonder_deckel']}")
    assert p["sonder_deckel"] is None, p


def test_deckel_on_wert_7():
    r = optimiere(ORDS, tol_kurz_mm=200, tol_lang_mm=200,
                  max_kombi_teile=3, heterogen_fallback=True,
                  sonder_deckel=7)
    p = r["parameter"]
    print(f"  Deckel ON=7: sonder_deckel={p['sonder_deckel']}")
    assert p["sonder_deckel"] == 7, p


def test_toleranzen_getrennt():
    r = optimiere(ORDS, tol_kurz_mm=200, tol_lang_mm=400)
    p = r["parameter"]
    print(f"  Toleranzen: kurz={p['tol_kurz_mm']} lang={p['tol_lang_mm']}")
    assert p["tol_kurz_mm"] == 200
    assert p["tol_lang_mm"] == 400


def _run(fn):
    try:
        fn()
        print(f"OK  {fn.__name__}")
        return True
    except AssertionError as e:
        print(f"FAIL {fn.__name__}: {e}")
        return False


if __name__ == "__main__":
    tests = [test_kombi_off, test_kombi_on, test_deckel_off_ist_none,
             test_deckel_on_wert_7, test_toleranzen_getrennt]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Toggle-Wiring-Tests bestanden.")
    sys.exit(0 if erfolge == len(tests) else 1)
