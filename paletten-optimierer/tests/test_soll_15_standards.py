"""Soll-Test 15 Standards — der Abnahme-Anker gegen Paletten_Test_450.xlsx.

Der Test faehrt den vollen Pfad:
  Excel-Fixture -> import_excel.importiere (mit Produkt-Mass-Subtraktion)
  -> optimiere(tol_kurz=100, tol_lang=100, kombi=3, hetero=True, deckel=5)
  -> Asserts auf r['status'], r['invariante_ok'], r['standards'],
     r['sonder'], r['gesamt'], r['zuordnung'].

Zusatztest: Sonder-Deckel-Obergrenze bei tol=100/100 ergibt immer 15,
egal welcher Deckel-Wert -> der Deckel ist Obergrenze, kein Zwang.
"""
from __future__ import annotations

import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))
sys.path.insert(0, str(HIER))

from import_excel import importiere  # noqa: E402
from optimierer_kern import optimiere  # noqa: E402


FIXTURE = HIER / "fixtures" / "Paletten_Test_450.xlsx"


def _load_orders() -> list[dict]:
    """Lädt die Fixture und mappt mit_mass auf orders (wie app.py)."""
    imp = importiere(FIXTURE)
    mit_mass = imp["mit_mass"]
    assert len(mit_mass) == 450, (
        f"Fixture verletzt Konvention: {len(mit_mass)}/450 mit Maß"
    )
    return [
        {"L": p["laenge"], "B": p["breite"], "menge": p["anzahl"],
         "auftrag": p["auftrag"], "name": p["name"]}
        for p in mit_mass
    ]


def _optimiere(orders, deckel=5):
    return optimiere(
        orders,
        tol_kurz_mm=100, tol_lang_mm=100,
        max_kombi_teile=3, heterogen_fallback=True,
        sonder_deckel=deckel,
    )


def test_soll_15_standards_bei_tol_100_100():
    """Der Kunden-Sollwert: tol_kurz=100, tol_lang=100, Kombi an,
    Deckel=5 -> genau 15 Standards, 0 Sonder, invariante_ok."""
    orders = _load_orders()
    r = _optimiere(orders, deckel=5)

    assert r["status"] == "Optimal", (
        f"Solver-Status != Optimal: {r['status']}"
    )
    assert r["invariante_ok"] is True, (
        f"Invariante verletzt: {len(r['verletzungen'])} Verletzungen"
    )
    assert len(r["verletzungen"]) == 0
    assert len(r["standards"]) == 15, (
        f"Erwartet 15 Standards, bekam {len(r['standards'])}: "
        f"{r['standards']}"
    )
    assert len(r["sonder"]) == 0, (
        f"Erwartet 0 Sonder, bekam {len(r['sonder'])}: {r['sonder']}"
    )
    assert r["gesamt"] == 15

    # Zaehl-Asserts ueber r['zuordnung']
    typ_zaehler = {"Standard": 0, "Kombi-Stapel": 0,
                    "Kombi-Heterogen": 0, "Sonder": 0}
    for z in r["zuordnung"]:
        typ_zaehler[z.get("typ", "?")] = typ_zaehler.get(z.get("typ", "?"), 0) + 1

    assert 60 <= typ_zaehler["Standard"] <= 130, (
        f"Standard-Zeilen 60..130 erwartet, bekam {typ_zaehler['Standard']}"
    )
    assert typ_zaehler["Kombi-Stapel"] > 300, (
        f">300 Kombi-Stapel-Zeilen erwartet, bekam {typ_zaehler['Kombi-Stapel']}"
    )
    assert typ_zaehler["Sonder"] == 0, (
        f"0 Sonder-Zeilen erwartet, bekam {typ_zaehler['Sonder']}"
    )


def test_sonder_deckel_ist_obergrenze_kein_zwang():
    """Bei tol=100/100 loesen alle Deckel-Werte dieselben 15 Standards.
    Beweist: Der Deckel begrenzt nach oben, zwingt aber nichts."""
    orders = _load_orders()
    for deckel in [0, 5, 10, None]:
        r = _optimiere(orders, deckel=deckel)
        assert r["gesamt"] == 15, (
            f"Deckel={deckel}: erwartet gesamt=15, bekam {r['gesamt']} "
            f"(Standards={len(r['standards'])}, Sonder={len(r['sonder'])})"
        )


if __name__ == "__main__":
    tests = [
        test_soll_15_standards_bei_tol_100_100,
        test_sonder_deckel_ist_obergrenze_kein_zwang,
    ]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}:\n  {e}")
            sys.exit(1)
    print(f"\n{len(tests)}/{len(tests)} Soll-15-Standards-Tests bestanden.")
