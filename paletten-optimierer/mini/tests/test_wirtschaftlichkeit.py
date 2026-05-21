"""Tests fuer Wirtschaftlichkeits-Modul (Spec §11).

a) LKW-Bin-Packing inkl. 90°-Drehung
b) Palette zu groß fuer LKW → Fehler + Hinweis (§16)
c) Fahrten-Aggregat: ceil(menge / pro_lkw)
d) Leerflaeche-Anteil korrekt
e) Vergleich Status Quo vs. Standardisiert
f) Empfehlungstext (positiv / negativ / neutral)
g) Break-Even Kosten/Fahrt
h) Periode-Hochrechnung Jahr
i) Alle Logistik-Kosten = 0 → netto = 0 oder rein varianten-getrieben (§16)
j) Sensitivitaets-Szenarien speichern + laden
k) Persistenz robust gegen korrupte JSON
l) Kernel-Integration: w8/w9 erscheinen im Breakdown
"""
from __future__ import annotations

import io
import os
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

_TMP = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
_TMP.close()
os.environ["PALETTENMINI_WIRT"] = _TMP.name

import wirtschaftlichkeit as w  # noqa: E402
from optimierer_kern import optimiere  # noqa: E402


def _reset():
    p = Path(_TMP.name)
    if p.exists():
        p.unlink()


def test_a_bin_packing_grundflaeche():
    """Europalette 1200×800 auf LKW 13620×2480: 3 nebeneinander (2480/800)
    * 11 hintereinander (13620/1200) = 33 (mit 90°-Drehung evtl. mehr)."""
    g = w.paletten_pro_grundflaeche(13620, 2480, 1200, 800)
    print(f"  Europalette: {g}")
    assert g["passt"] is True
    # 13620//1200 = 11, 2480//800 = 3 → 33
    # 13620//800 = 17, 2480//1200 = 2 → 34 (90°-Drehung gewinnt knapp)
    assert g["anzahl"] >= 33
    # Industrie 1200×1000: 13620//1200 = 11, 2480//1000 = 2 = 22
    g2 = w.paletten_pro_grundflaeche(13620, 2480, 1200, 1000)
    assert g2["anzahl"] >= 22


def test_b_palette_zu_gross():
    """Spec §16: LKW-Berechnung mit Paletten groesser als LKW → Fehler."""
    g = w.paletten_pro_grundflaeche(13620, 2480, 15000, 3000)
    print(f"  Zu gross: {g}")
    assert g["passt"] is False
    assert g["anzahl"] == 0
    # Fahrten-Aggregat behandelt das gracefully
    f = w.fahrten_benoetigt({(3000, 15000): 10},
                              w.DEFAULT_COST_PARAMS)
    detail = f["detail"][0]
    assert detail["fehler"] != ""


def test_c_fahrten_ceil():
    """100 Paletten / 34 pro LKW → 3 Fahrten (ceil)."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["max_palettenstapel"] = 1
    f = w.fahrten_benoetigt({(800, 1200): 100}, cp)
    print(f"  100 Paletten 800×1200 stapel=1: {f['total_fahrten']} Fahrten "
          f"(pro LKW: {f['paletten_pro_lkw']})")
    # 100 / 34 = 2.94 → ceil = 3
    assert f["total_fahrten"] == 3
    # Edge: 200 → 200/34=5.88 → 6
    f2 = w.fahrten_benoetigt({(800, 1200): 200}, cp)
    assert f2["total_fahrten"] == 6


def test_d_leerflaeche():
    """Artikel 1000×700 auf Palette 1200×800: Leer = 56% lower bound."""
    leer = w.leerflaeche(1200, 800, 1000, 700)
    print(f"  Leer: {leer}")
    palette = 1200 * 800
    nutz = 1000 * 700
    erwartet_anteil = 1.0 - nutz / palette
    assert abs(leer["anteil"] - erwartet_anteil) < 1e-9


def test_e_vergleich_status_quo():
    """Alt: 12 Typen, Neu: 4 Typen — Σ-Mengen leicht hoeher (Leerraum)."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["kosten_pro_fahrt_eur"] = 350
    cp["handling_kosten_pro_palettentyp_eur"] = 50
    cp["variantenkosten_pro_typ_eur"] = 200
    alt = {
        "typen_count": 12,
        "paletten_count_per_typ": {(800, 1200): 280},  # vereinfacht
        "paletten_summe": 280,
        "leerflaeche_summe": 280 * 1000 * 800 * 0.05,
        "paletten_flaeche_summe": 280 * 1200 * 800,
        "ek_summe_eur": 280 * 30,
    }
    neu = {
        "typen_count": 4,
        "paletten_count_per_typ": {(1000, 1600): 295},
        "paletten_summe": 295,
        "leerflaeche_summe": 295 * 1600 * 1000 * 0.18,
        "paletten_flaeche_summe": 295 * 1600 * 1000,
        "ek_summe_eur": 295 * 25,
    }
    v = w.vergleich(zustand_alt=alt, zustand_neu=neu, cost_params=cp)
    print(f"  netto_periode={v['netto_periode']:.2f}, "
          f"netto_jahr={v['netto_jahr']:.2f}")
    print(f"  fahrten_alt={v['fahrten_alt']}, fahrten_neu={v['fahrten_neu']}")
    # Handling-Einsparung: (12-4)*50 = 400, Var-Einsparung (12-4)*200=1600
    assert v["handling_einsparung"] == 8 * 50
    assert v["var_einsparung"] == 8 * 200


def test_f_empfehlungstext():
    v_pos = {"netto_periode": 5570, "netto_jahr": 67000}
    v_neg = {"netto_periode": -1200, "netto_jahr": -14400}
    v_zero = {"netto_periode": 0, "netto_jahr": 0}
    assert "lohnt sich" in w.empfehlungstext(v_pos)
    assert "Mehrkosten" in w.empfehlungstext(v_neg)
    assert "neutral" in w.empfehlungstext(v_zero)
    print(f"  Pos: {w.empfehlungstext(v_pos)[:60]}…")
    print(f"  Neg: {w.empfehlungstext(v_neg)[:60]}…")


def test_g_break_even():
    """Break-Even Kosten/Fahrt: berechnet bei welchem Wert Netto = 0.
    Legacy-Pfad: alle Lademeter-Modi auf 0 setzen, damit
    vergleich() den fahrten-Pfad nimmt."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["kosten_pro_fahrt_eur"] = 350
    cp["kosten_pro_lkw_eur"] = 0
    cp["kosten_pro_lademeter_eur"] = 0
    cp["kosten_pro_m2_eur"] = 0
    alt = {
        "typen_count": 12,
        "paletten_count_per_typ": {(800, 1200): 280},
        "paletten_summe": 280,
        "leerflaeche_summe": 0, "paletten_flaeche_summe": 1,
        "ek_summe_eur": 8400,
    }
    neu = {
        "typen_count": 4,
        "paletten_count_per_typ": {(1000, 1600): 295},
        "paletten_summe": 295,
        "leerflaeche_summe": 0, "paletten_flaeche_summe": 1,
        "ek_summe_eur": 5900,
    }
    be = w.break_even_kosten_pro_fahrt(alt, neu, cp)
    print(f"  Break-even Kosten/Fahrt: {be}")
    assert be is not None  # Fahrten unterscheiden sich → kf-Effekt existiert
    # Verifikation: bei kf = be sollte Netto ≈ 0 sein
    cp_be = dict(cp)
    cp_be["kosten_pro_fahrt_eur"] = be
    v_be = w.vergleich(zustand_alt=alt, zustand_neu=neu, cost_params=cp_be)
    assert abs(v_be["netto_periode"]) < 0.01, (
        f"Bei kf={be} sollte Netto≈0 sein, ist {v_be['netto_periode']}"
    )


def test_h_periode_hochrechnung():
    """30-Tage-Periode → ×12.166 für 365 Tage."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["periode_tage"] = 30
    alt = {"typen_count": 5, "paletten_count_per_typ": {(800, 1200): 100},
           "paletten_summe": 100, "leerflaeche_summe": 0,
           "paletten_flaeche_summe": 1, "ek_summe_eur": 1000}
    neu = {"typen_count": 3, "paletten_count_per_typ": {(800, 1200): 100},
           "paletten_summe": 100, "leerflaeche_summe": 0,
           "paletten_flaeche_summe": 1, "ek_summe_eur": 1000}
    v = w.vergleich(zustand_alt=alt, zustand_neu=neu, cost_params=cp)
    erw_jahr = v["netto_periode"] * 365.0 / 30
    assert abs(v["netto_jahr"] - erw_jahr) < 0.01
    print(f"  Periode 30d → Jahr ×{365/30:.3f}, Netto/Jahr={v['netto_jahr']:.2f}")


def test_i_alle_kosten_null():
    """Spec §16: Alle Logistik-Kosten = 0 → reine Variantenoptimierung."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    for k in ("kosten_pro_fahrt_eur", "lagerkosten_pro_stellplatz_pro_tag_eur",
              "handling_kosten_pro_palettentyp_eur",
              "variantenkosten_pro_typ_eur", "distanz_km",
              "kosten_pro_km_eur"):
        cp[k] = 0
    alt = {"typen_count": 5, "paletten_count_per_typ": {(800, 1200): 100},
           "paletten_summe": 100, "leerflaeche_summe": 0,
           "paletten_flaeche_summe": 1, "ek_summe_eur": 1000}
    neu = {"typen_count": 3, "paletten_count_per_typ": {(800, 1200): 100},
           "paletten_summe": 100, "leerflaeche_summe": 0,
           "paletten_flaeche_summe": 1, "ek_summe_eur": 1000}
    v = w.vergleich(zustand_alt=alt, zustand_neu=neu, cost_params=cp)
    # Alles Null außer ek_summe_eur (= 0 hier) → netto = 0
    assert abs(v["netto_periode"]) < 0.01
    print(f"  Kosten=0: netto={v['netto_periode']} (erwartet 0)")


def test_j_szenarien_persistenz():
    _reset()
    cp = {"kosten_pro_fahrt_eur": 450}
    erg = {"netto_periode": 3500}
    w.speichere_szenario("test-szenario-A", cp, erg)
    sz = w.alle_szenarien()
    assert "test-szenario-A" in sz
    assert sz["test-szenario-A"]["ergebnis"]["netto_periode"] == 3500
    assert w.loesche_szenario("test-szenario-A") is True
    assert "test-szenario-A" not in w.alle_szenarien()
    print(f"  Szenarien: speichern/laden/loeschen OK.")


def test_k_korrupte_json():
    Path(_TMP.name).write_text("{kaputt", encoding="utf-8")
    cp = w.lade_params()
    # Default zurueck
    assert cp["lkw_laenge_mm"] == 13620
    assert cp["aktiv"] is False
    print(f"  Korrupte JSON: Defaults zurueck.")


def test_l_kernel_w8_w9():
    """Kernel akzeptiert w8/w9 und gibt die Komponenten im Breakdown."""
    orders = [{'L': 1000, 'B': 800, 'menge': 3, 'auftrag': 'A',
                'name': ''}]
    r = optimiere(orders, katalog=[(800, 1200)],
                   gewichte={"w1": 1.0, "w8": 0.5, "w9": 0.3},
                   logistik_mehrkosten_per_typ={(800, 1200): 100.0},
                   logistik_einsparung_per_typ={(800, 1200): 200.0},
                   sonder_erlaubt=False)
    bd = r["score_breakdown"]
    print(f"  w8_logistik_mehrkosten={bd['w8_logistik_mehrkosten']}")
    print(f"  w9_logistik_einsparung_bonus={bd['w9_logistik_einsparung_bonus']}")
    assert "w8_logistik_mehrkosten" in bd
    assert "w9_logistik_einsparung_bonus" in bd
    # Ein Standard (800,1200) gewaehlt → w8 = 0.5*100 = 50, w9 = -0.3*200 = -60
    assert abs(bd["w8_logistik_mehrkosten"] - 50.0) < 1e-9
    assert abs(bd["w9_logistik_einsparung_bonus"] - (-60.0)) < 1e-9


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
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    tests = [
        test_a_bin_packing_grundflaeche,
        test_b_palette_zu_gross,
        test_c_fahrten_ceil,
        test_d_leerflaeche,
        test_e_vergleich_status_quo,
        test_f_empfehlungstext,
        test_g_break_even,
        test_h_periode_hochrechnung,
        test_i_alle_kosten_null,
        test_j_szenarien_persistenz,
        test_k_korrupte_json,
        test_l_kernel_w8_w9,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Wirtschaftlichkeits-Tests bestanden.")
    try:
        Path(_TMP.name).unlink(missing_ok=True)
    except Exception:
        pass
    sys.exit(0 if erfolge == len(tests) else 1)
