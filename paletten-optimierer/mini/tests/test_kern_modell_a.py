"""Pflicht-Test fuer Kern v4 Modell A.

Test 9a aus FINAL-LOCK-Spec: Cluster 4 Auftraege eng beieinander,
tol_kurz=tol_lang=200, max_kombi_teile=1 -> genau 1 Standard,
deckt alle, Invariante OK.
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


def test_a_cluster_ein_standard_deckt_alle():
    cluster = [
        {'L': 1520, 'B': 720, 'menge': 1, 'auftrag': 'A', 'name': ''},
        {'L': 1550, 'B': 700, 'menge': 1, 'auftrag': 'B', 'name': ''},
        {'L': 1500, 'B': 750, 'menge': 1, 'auftrag': 'C', 'name': ''},
        {'L': 1530, 'B': 710, 'menge': 1, 'auftrag': 'D', 'name': ''},
    ]
    r = optimiere(cluster, tol_kurz_mm=200, tol_lang_mm=200,
                  max_kombi_teile=1, heterogen_fallback=False)
    print(f"\n  Standards: {r['standards']} | Sonder: {r['sonder']} "
          f"| invariante_ok: {r['invariante_ok']}")
    assert len(r['standards']) == 1, (
        f"erwartet genau 1 Standard, bekam {r['standards']}"
    )
    assert len(r['sonder']) == 0
    assert r['invariante_ok']
    s = r['standards'][0]
    for o in cluster:
        assert min(s) >= min(o['L'], o['B']) and max(s) >= max(o['L'], o['B']), (
            f"Standard {s} deckt Last {(o['L'], o['B'])} NICHT physisch ab"
        )


def test_c_sonder_deckel_obergrenze_im_cluster():
    """Sonder-Deckel ist eine OBERGRENZE — wenn das Optimum ohne
    Sonder erreichbar ist, hat der Deckel keinen Effekt."""
    cluster = [
        {'L': 1520, 'B': 720, 'menge': 1, 'auftrag': 'A', 'name': ''},
        {'L': 1550, 'B': 700, 'menge': 1, 'auftrag': 'B', 'name': ''},
        {'L': 1500, 'B': 750, 'menge': 1, 'auftrag': 'C', 'name': ''},
        {'L': 1530, 'B': 710, 'menge': 1, 'auftrag': 'D', 'name': ''},
    ]
    for deckel in [None, 0, 5, 10]:
        r = optimiere(cluster, tol_kurz_mm=200, tol_lang_mm=200,
                      max_kombi_teile=1, heterogen_fallback=False,
                      sonder_deckel=deckel)
        std, son = len(r['standards']), len(r['sonder'])
        print(f"  Deckel={deckel}: std={std} sonder={son}")
        assert std == 1 and son == 0, (
            f"Cluster sollte 1 Standard + 0 Sonder ergeben "
            f"unabhaengig vom Deckel — bei Deckel={deckel} bekam {std}+{son}"
        )
    print(f"  OK — Sonder-Deckel ist Obergrenze, kein Druck.")


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
    tests = [
        test_a_cluster_ein_standard_deckt_alle,
        test_c_sonder_deckel_obergrenze_im_cluster,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print("=" * 60)
    print(f"{erfolge}/{len(tests)} Modell-A-Tests bestanden.")
    print("=" * 60)
    sys.exit(0 if erfolge == len(tests) else 1)
