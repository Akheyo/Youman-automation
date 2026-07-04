"""E1: Kostenkalkulation IST vs SOLL (Modul kostenkalkulation.py)."""
from __future__ import annotations

import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

from kostenkalkulation import (  # noqa: E402
    KostenParameter, berechne_einsparung,
)


def _100_paletten_1200_800_standard() -> list[dict]:
    return [
        {"auftrag": "A1", "L": 1200, "B": 800, "menge": 100,
         "typ": "Standard", "ziel": "800x1200"},
    ]


def _100_paletten_alle_sonder() -> list[dict]:
    return [
        {"auftrag": "S1", "L": 1450, "B": 950, "menge": 100,
         "typ": "Sonder", "ziel": "950x1450"},
    ]


def test_100_paletten_standard_einsparung_positiv():
    r = berechne_einsparung(
        _100_paletten_1200_800_standard(), KostenParameter())
    assert r["paletten_gesamt"] == 100
    assert r["paletten_standard"] == 100
    assert r["paletten_sonder"] == 0
    # Fläche pro Palette = 1.2 × 0.8 = 0.96 m²
    # IST: 100 × 0.96 / 0.75 = 128 m² → ceil(128 / 33) = 4 LKWs
    # SOLL: 100 × 0.96 / 0.90 = 106.67 m² → ceil(106.67 / 33) = 4 LKWs
    assert r["anzahl_lkws_ist"] == 4
    assert r["anzahl_lkws_soll"] == 4
    # Kein Unterschied bei LKWs, aber Palettenkosten senken sich:
    #   Eigenfertigung IST: 100 × 45 = 4500 €
    #   Palettenkauf SOLL: 100 × 12 = 1200 €
    # Einsparung durch Palettenkauf ≈ 3300 €
    assert r["einsparung"] > 3000, f"Erwartet > 3000 €, bekam {r['einsparung']}"


def test_alle_sonder_kaum_einsparung():
    """Bei ausschliesslich Sonder greift die Palettenkauf-Ersparnis
    nicht — nur die Ladeflaeche-Optimierung ueber den Ladefaktor."""
    r = berechne_einsparung(
        _100_paletten_alle_sonder(), KostenParameter())
    assert r["paletten_standard"] == 0
    assert r["paletten_sonder"] == 100
    # Palettenkosten IST == SOLL, weil beides Eigenfertigung
    assert r["eigenfertigung_ist"] == r["eigenfertigung_soll"]
    # Einsparung kommt allein aus LKW-Ersparnis (Ladefaktor 0.75 → 0.90)
    assert r["einsparung"] >= 0


def test_ladefaktor_soll_von_090_auf_060_reduziert_einsparung():
    zuord = _100_paletten_1200_800_standard()
    r_hoch = berechne_einsparung(zuord, KostenParameter(ladefaktor_soll=0.90))
    r_niedrig = berechne_einsparung(zuord, KostenParameter(ladefaktor_soll=0.60))
    assert r_niedrig["einsparung"] < r_hoch["einsparung"], (
        f"Erwartet niedrigere Einsparung bei ladefaktor_soll=0.6, "
        f"bekam {r_niedrig['einsparung']} vs {r_hoch['einsparung']}"
    )


def test_leere_zuordnung_null_werte():
    r = berechne_einsparung([], KostenParameter())
    assert r["paletten_gesamt"] == 0
    assert r["anzahl_lkws_ist"] == 0
    assert r["anzahl_lkws_soll"] == 0
    assert r["einsparung"] == 0.0


def test_parameter_werden_im_ergebnis_gespiegelt():
    p = KostenParameter(lkw_kosten_pro_stueck=1000.0)
    r = berechne_einsparung(_100_paletten_1200_800_standard(), p)
    assert r["parameter"]["lkw_kosten_pro_stueck"] == 1000.0


def test_kombi_stapel_flaeche_ist_k_mal_ziel():
    zuord = [
        {"auftrag": "K1", "L": 900, "B": 400, "menge": 50,
         "typ": "Kombi-Stapel", "ziel": "3x (400x900)"},
    ]
    r = berechne_einsparung(zuord, KostenParameter())
    # Fläche SOLL für 1 Item Kombi-Stapel: 3 × (400*900) / 1e6 = 1.08 m²
    # 50 Items × 1.08 m² / 0.90 = 60.0 m²
    assert abs(r["flaeche_soll_qm"] - 60.0) < 0.01


def test_kombi_heterogen_bounding_addiert_flaeche():
    zuord = [
        {"auftrag": "H1", "L": 800, "B": 400, "menge": 10,
         "typ": "Kombi-Heterogen", "ziel": "400x800 + 500x1000"},
    ]
    r = berechne_einsparung(zuord, KostenParameter())
    # SOLL-Fläche pro Item: (800*400 + 1000*500) / 1e6 = 0.82 m²
    # 10 × 0.82 / 0.90 = 9.111...
    assert abs(r["flaeche_soll_qm"] - (10 * 0.82 / 0.90)) < 0.01


if __name__ == "__main__":
    tests = [test_100_paletten_standard_einsparung_positiv,
             test_alle_sonder_kaum_einsparung,
             test_ladefaktor_soll_von_090_auf_060_reduziert_einsparung,
             test_leere_zuordnung_null_werte,
             test_parameter_werden_im_ergebnis_gespiegelt,
             test_kombi_stapel_flaeche_ist_k_mal_ziel,
             test_kombi_heterogen_bounding_addiert_flaeche]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
            sys.exit(1)
    print(f"\n{len(tests)}/{len(tests)} Kostenkalkulation-Tests bestanden.")
