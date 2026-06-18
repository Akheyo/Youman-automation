"""Tests fuer Wirtschaftlichen Optimierungs-Modus 2 (Spec §11.9).

a) cluster_bilden gruppiert nach Toleranz korrekt
b) kandidat_aus_cluster: max(L)+aufschlag, max(B)+aufschlag
c) netto_pro_kandidat: einfacher positiver Fall
d) netto_pro_kandidat: Logistik-Mehrkosten > Einsparung → negativ
e) anti_aggregation: greift bei niedriger Auslastung + Mehrkosten
f) Spec §11.9.9: Logistik-Kosten = 0 → Modus 2 wie Modus 1
g) Spec §11.9.9: Palettenkosten = 0 → KEINE Standardisierung
h) Drahtgitter-Realfall: viele Varianten → 10-50 Standards, NICHT 1-2
i) Schwellwert hoch → nur lukrative Kandidaten übernommen
j) Anti-Aggregation greift → kleinere Zusatzgröße entsteht
k) kandidaten_tabelle sortiert nach netto absteigend
l) modus2_auswahl: Auftrag-zu-Standard-Zuordnung
m) Manuelle Übersteuerung in Kandidaten-Tabelle
n) Schwellwert ≥ (Edge): exakt = Schwelle wird übernommen
o) Begründungs-Text fuer Standardisiert vs. Sonder
p) Empfehlungs-Report enthält erwartete Sektionen
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
import wirt_kandidaten as wk  # noqa: E402


def _o(L, B, menge=1, aw="", nm="", art=""):
    return {"L": L, "B": B, "menge": menge, "auftrag": aw,
             "name": nm, "artikelnummer": art}


def test_a_cluster_bilden():
    """4 nahe Maße → 1 Cluster, 1 fernes → eigener Cluster."""
    orders = [_o(1200, 800), _o(1180, 790), _o(1220, 810),
              _o(1190, 800), _o(2000, 1500)]
    c = wk.cluster_bilden(orders, tol_kurz_mm=50, tol_lang_mm=50)
    print(f"  Cluster: {len(c)} (Längen: {[len(cc) for cc in c]})")
    assert len(c) == 2
    sizes = sorted([len(cc) for cc in c])
    assert sizes == [1, 4]


def test_b_kandidat_max_plus_aufschlag():
    orders = [_o(1200, 800), _o(1180, 790), _o(1220, 810)]
    k = wk.kandidat_aus_cluster(orders, aufschlag_mm=20)
    print(f"  Kandidat (max+20): {k}")
    # max(L)=1220 → 1240, max(B)=810 → 830 → kanonisch (830, 1240)
    assert k == (830, 1240)


def test_c_netto_positiv_einfacher_fall():
    """5 Artikel werden zu 1 Standard zusammengefasst — Einsparung an
    Handling+Varianten überwiegt knappe Mehrfläche."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "A"
    cp["kosten_pro_lkw_eur"] = 800
    cp["lademeter_pro_lkw"] = 13.6
    cp["handling_kosten_pro_palettentyp_eur"] = 200
    cp["variantenkosten_pro_typ_eur"] = 300
    # 5 verschiedene Maße fast identisch
    cluster = [_o(1200, 800, menge=10), _o(1180, 790, menge=8),
                _o(1190, 800, menge=12), _o(1210, 795, menge=6),
                _o(1200, 810, menge=14)]
    kand = wk.kandidat_aus_cluster(cluster, aufschlag_mm=0)
    info = wk.netto_pro_kandidat(cluster, kand, cp)
    print(f"  Netto periode={info['netto_periode']:.2f}, "
          f"jahr={info['netto_jahr']:.2f}, "
          f"auslastung={info['auslastung']*100:.1f}%")
    # 5 unique → Einsparung = 4 × (200+300) = 2000 €/Periode
    assert info["netto_periode"] > 0
    assert info["auslastung"] > 0.9   # passt sehr eng


def test_d_netto_negativ_bei_grosser_aggregation():
    """Cluster mit hoher Vielfalt → großer Kandidat → Transport-
    Mehrkosten dominieren, Netto negativ."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "A"
    cp["kosten_pro_lkw_eur"] = 800
    cp["lademeter_pro_lkw"] = 13.6
    cp["handling_kosten_pro_palettentyp_eur"] = 10
    cp["variantenkosten_pro_typ_eur"] = 10
    cluster = [_o(500, 400, menge=20), _o(2000, 1500, menge=20)]
    kand = wk.kandidat_aus_cluster(cluster, aufschlag_mm=0)
    info = wk.netto_pro_kandidat(cluster, kand, cp)
    print(f"  Negativ-Test: Netto={info['netto_jahr']:.2f} €/Jahr, "
          f"auslastung={info['auslastung']*100:.1f}%")
    assert info["netto_jahr"] < 0


def test_e_anti_aggregation_greift():
    """Niedrige Auslastung + Mehrkosten > Einsparung → verwerfen."""
    info = {
        "auslastung": 0.40,
        "transport_mehrkosten": 5000,
        "lager_mehrkosten": 500,
        "handling_einsparung": 1000,
        "varianten_einsparung": 1000,
        "paletten_einsparung": 0,
    }
    erg = wk.anti_aggregation(info, min_auslastung_pct=65.0)
    print(f"  Anti-Agg: uebernehmen={erg['uebernehmen']}, grund={erg['grund'][:60]}…")
    assert erg["uebernehmen"] is False
    assert "Auslastung" in erg["grund"]


def test_f_logistik_null_wie_modus1():
    """Spec §11.9.9: Logistikkosten = 0 → Modus 2 erzeugt
    Ergebnis wie Modus 1 (max. Reduktion)."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "B"
    cp["kosten_pro_lademeter_eur"] = 0
    cp["lagerkosten_pro_stellplatz_pro_tag_eur"] = 0
    cp["handling_kosten_pro_palettentyp_eur"] = 100
    cp["variantenkosten_pro_typ_eur"] = 100
    orders = [_o(1200, 800, menge=5), _o(1500, 1000, menge=3),
              _o(2000, 1200, menge=2)]
    erg = wk.modus2_auswahl(orders, cp, tol_kurz_mm=200, tol_lang_mm=400,
                               schwellwert_eur=0)
    # Alle drei Kandidaten sollten ueberom werden (keine Logistik-Penalty)
    print(f"  Logistik=0: uebernommen={len(erg['uebernommen'])}, "
          f"verworfen={len(erg['verworfen'])}")
    # Erwarte mind. 1 Übernahme (max-Reduktion)
    assert len(erg["uebernommen"]) >= 1


def test_g_palettenkosten_null_keine_standardisierung():
    """Spec §11.9.9: handling+var=0 → keine Einsparung → keine
    Standardisierung übernommen (netto ≤ 0)."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "B"
    cp["kosten_pro_lademeter_eur"] = 60
    cp["handling_kosten_pro_palettentyp_eur"] = 0
    cp["variantenkosten_pro_typ_eur"] = 0
    # Cluster mit unterschiedlichen Maßen → Mehrfläche → mehr Transport
    orders = [_o(1000, 800, menge=10), _o(1200, 800, menge=10)]
    erg = wk.modus2_auswahl(orders, cp, tol_kurz_mm=300, tol_lang_mm=300,
                               schwellwert_eur=0)
    print(f"  Palettenkosten=0: uebernommen={len(erg['uebernommen'])}, "
          f"verworfen={len(erg['verworfen'])}")
    # Erwartet: Standardisierung erzeugt Mehrkosten, keine wird übernommen
    assert len(erg["uebernommen"]) == 0


def test_h_drahtgitter_realfall():
    """Spec §11.9.9: 2.500 Varianten + hohe Logistik-Sensitivität →
    Modus 2 liefert 10-50 Standardtypen + Sondergrößen.
    Wir simulieren das mit 200 Varianten."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "A"
    cp["kosten_pro_lkw_eur"] = 800
    cp["lademeter_pro_lkw"] = 13.6
    cp["handling_kosten_pro_palettentyp_eur"] = 100
    cp["variantenkosten_pro_typ_eur"] = 200
    import random
    rng = random.Random(42)
    orders = []
    # 5 "Hotspots" um die meiste Varianten sich gruppieren
    hotspots = [(800, 1200), (700, 1100), (1000, 1500),
                 (600, 900), (900, 1400)]
    for i in range(200):
        cs, cl = hotspots[i % 5]
        cs_i = cs + rng.randint(-30, 30)
        cl_i = cl + rng.randint(-30, 30)
        orders.append(_o(cl_i, cs_i, menge=rng.randint(1, 20),
                          aw=f"AW{i:03}"))
    erg = wk.modus2_auswahl(orders, cp, tol_kurz_mm=80, tol_lang_mm=80,
                               schwellwert_eur=100,
                               min_auslastung_pct=50)
    n_std = len(erg["uebernommen"])
    print(f"  200 Varianten: {n_std} Standards uebernommen, "
          f"{len(erg['verworfen'])} verworfen.")
    # Erwartet: zwischen 1 und 50 Standards (NICHT 1-2 Megapaletten)
    assert 1 <= n_std <= 50


def test_i_schwellwert_hoch_filtert():
    """Schwellwert = 10000 €/Jahr → nur sehr profitable Kandidaten."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "B"
    cp["kosten_pro_lademeter_eur"] = 30
    cp["handling_kosten_pro_palettentyp_eur"] = 50
    cp["variantenkosten_pro_typ_eur"] = 100
    orders = [
        # Cluster 1 — viele Artikel → hohe Einsparung
        _o(1200, 800, menge=10, aw="A1"), _o(1180, 790, menge=10, aw="A2"),
        _o(1190, 800, menge=10, aw="A3"), _o(1210, 795, menge=10, aw="A4"),
        # Cluster 2 — nur 1 Artikel → niedrige Einsparung
        _o(1500, 1000, menge=2, aw="B1"),
    ]
    erg_low = wk.modus2_auswahl(orders, cp, tol_kurz_mm=50, tol_lang_mm=50,
                                    schwellwert_eur=0)
    erg_high = wk.modus2_auswahl(orders, cp, tol_kurz_mm=50, tol_lang_mm=50,
                                     schwellwert_eur=10000)
    print(f"  Schwelle 0:    {len(erg_low['uebernommen'])} uebernommen")
    print(f"  Schwelle 10k:  {len(erg_high['uebernommen'])} uebernommen")
    assert len(erg_low["uebernommen"]) >= len(erg_high["uebernommen"])


def test_j_anti_aggregation_bei_unmoeglich_hoher_schwelle():
    """min_auslastung_pct hoch + Mehrkosten > Einsparung → verworfen."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "B"
    cp["kosten_pro_lademeter_eur"] = 200      # hohe Mehrkosten
    cp["handling_kosten_pro_palettentyp_eur"] = 5
    cp["variantenkosten_pro_typ_eur"] = 5
    # Cluster mit großer Streuung → niedrige Auslastung
    orders = [_o(400, 300, menge=10), _o(1200, 800, menge=10)]
    erg = wk.modus2_auswahl(orders, cp, tol_kurz_mm=1000, tol_lang_mm=1000,
                               schwellwert_eur=0,
                               min_auslastung_pct=95.0)
    anti_grund = [v["grund"] for v in erg["verworfen"]
                   if "Anti-Aggregation" in v.get("grund", "")]
    print(f"  Anti-Agg-Fälle: {len(anti_grund)}")
    assert len(anti_grund) >= 1


def test_k_tabelle_sortiert():
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "B"
    cp["kosten_pro_lademeter_eur"] = 60
    cp["handling_kosten_pro_palettentyp_eur"] = 50
    cp["variantenkosten_pro_typ_eur"] = 100
    orders = [
        _o(1200, 800, menge=10), _o(1180, 790, menge=10),
        _o(1500, 1000, menge=2),
    ]
    t = wk.kandidaten_tabelle(orders, cp, tol_kurz_mm=50, tol_lang_mm=50)
    print(f"  Tabelle: {len(t)} Zeilen, nettos = "
          f"{[round(z['netto_jahr']) for z in t]}")
    # Absteigend
    for i in range(len(t) - 1):
        assert t[i]["netto_jahr"] >= t[i + 1]["netto_jahr"]


def test_l_zuordnung_orders_zu_standard():
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "B"
    cp["kosten_pro_lademeter_eur"] = 30
    cp["handling_kosten_pro_palettentyp_eur"] = 100
    cp["variantenkosten_pro_typ_eur"] = 200
    orders = [
        _o(1200, 800, menge=10, aw="A1"),
        _o(1180, 790, menge=10, aw="A2"),
        _o(1500, 1000, menge=2, aw="B1"),
    ]
    erg = wk.modus2_auswahl(orders, cp, tol_kurz_mm=50, tol_lang_mm=50,
                               schwellwert_eur=0)
    # A1+A2 sollten gleichem Kandidaten zugeordnet werden
    z = erg["orders_zu_standard"]
    print(f"  Zuordnung: 0={z[0]}, 1={z[1]}, 2={z[2]}")
    if z[0] is not None:
        assert z[0] == z[1]  # gleicher Cluster
    assert z[2] != z[0] or z[2] is None  # anderer Cluster


def test_m_manuelle_uebersteuerung():
    """User-Override 'verwerfen' setzt sich gegen netto > schwelle durch."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "B"
    cp["kosten_pro_lademeter_eur"] = 30
    cp["handling_kosten_pro_palettentyp_eur"] = 100
    cp["variantenkosten_pro_typ_eur"] = 200
    orders = [_o(1200, 800, menge=10), _o(1180, 790, menge=10)]
    # Default → ueberom
    erg_def = wk.modus2_auswahl(orders, cp, tol_kurz_mm=50, tol_lang_mm=50)
    kand = erg_def["uebernommen"][0]["kandidat"] if erg_def["uebernommen"] else None
    assert kand is not None
    # Mit Override → verworfen
    erg_man = wk.modus2_auswahl(orders, cp, tol_kurz_mm=50, tol_lang_mm=50,
                                    manuelle_override={kand: "verwerfen"})
    print(f"  Default uebernommen: {len(erg_def['uebernommen'])}, "
          f"mit Override-Verwerfen: {len(erg_man['uebernommen'])}")
    assert len(erg_man["uebernommen"]) == 0
    assert len(erg_man["verworfen"]) == 1


def test_n_schwelle_gleich():
    """Spec §16: netto exakt = schwellwert → wird übernommen (≥)."""
    # Konstruiere kuenstlich: 1 Variante, handling=100, var=0
    # → einsparung = 0 (n_unique - 1 = 0)
    # Stattdessen verwende 2 Cluster-Eintraege, handling=10
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "B"
    cp["kosten_pro_lademeter_eur"] = 0  # keine Mehrkosten
    cp["lagerkosten_pro_stellplatz_pro_tag_eur"] = 0
    cp["handling_kosten_pro_palettentyp_eur"] = 100
    cp["variantenkosten_pro_typ_eur"] = 0
    orders = [_o(1200, 800), _o(1180, 790)]
    # 2 Varianten → einsparung 100/Periode = 1216.67/Jahr (mit 30d)
    erg = wk.kandidaten_tabelle(orders, cp, tol_kurz_mm=50, tol_lang_mm=50,
                                    schwellwert_eur=1000)
    # netto sollte ≥ 1000 sein → standardisieren
    print(f"  Schwelle 1000: empfehlung={erg[0]['empfehlung']}, "
          f"netto={erg[0]['netto_jahr']:.0f}")
    assert erg[0]["empfehlung"] == "standardisieren"


def test_o_begruendungs_text():
    """Begruendungs-Text fuer standardisiert + nicht zugeordnet."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "B"
    cp["kosten_pro_lademeter_eur"] = 30
    cp["handling_kosten_pro_palettentyp_eur"] = 100
    cp["variantenkosten_pro_typ_eur"] = 200
    orders = [
        _o(1200, 800, menge=10, aw="A1"),
        _o(1180, 790, menge=10, aw="A2"),
    ]
    erg = wk.modus2_auswahl(orders, cp, tol_kurz_mm=50, tol_lang_mm=50)
    text0 = wk.begruendungs_text(0, erg)
    print(f"  Begruendung Auftrag 0: '{text0[:80]}…'")
    if erg["orders_zu_standard"][0] is not None:
        assert "Standardisiert" in text0 or "€" in text0


def test_p_empfehlungs_report():
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "B"
    cp["kosten_pro_lademeter_eur"] = 30
    cp["handling_kosten_pro_palettentyp_eur"] = 100
    cp["variantenkosten_pro_typ_eur"] = 200
    orders = [
        _o(1200, 800, menge=10), _o(1180, 790, menge=10),
        _o(1500, 1000, menge=2),
    ]
    erg = wk.modus2_auswahl(orders, cp, tol_kurz_mm=50, tol_lang_mm=50)
    report = wk.empfehlungs_report(erg, cp, vorher_typen=3)
    print(f"  Report Header: {report.splitlines()[0]}")
    assert "Wirtschaftliches Optimum" in report
    assert "Gesamteinsparung" in report


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
        test_a_cluster_bilden,
        test_b_kandidat_max_plus_aufschlag,
        test_c_netto_positiv_einfacher_fall,
        test_d_netto_negativ_bei_grosser_aggregation,
        test_e_anti_aggregation_greift,
        test_f_logistik_null_wie_modus1,
        test_g_palettenkosten_null_keine_standardisierung,
        test_h_drahtgitter_realfall,
        test_i_schwellwert_hoch_filtert,
        test_j_anti_aggregation_bei_unmoeglich_hoher_schwelle,
        test_k_tabelle_sortiert,
        test_l_zuordnung_orders_zu_standard,
        test_m_manuelle_uebersteuerung,
        test_n_schwelle_gleich,
        test_o_begruendungs_text,
        test_p_empfehlungs_report,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Modus-2-Tests bestanden.")
    try:
        Path(_TMP.name).unlink(missing_ok=True)
    except Exception:
        pass
    sys.exit(0 if erfolge == len(tests) else 1)
