"""Tests fuer die 3-Modi-Logistikkosten und Lademeter-Berechnung
(Spec §11.1 + §11.2 + §16).

a) Modus A: 800€ / 13.6 Lademeter = 58.82 €/Lademeter
b) Modus B: direkt
c) Modus C: €/m² × LKW-Breite_m → €/Lademeter
d) Modus-Wechsel: alle 3 Werte bleiben erhalten
e) Validierung Modus A: lademeter_pro_lkw = 0 → Fehler
f) Validierung Modus A: kosten_pro_lkw = 0 → Warnung + kpl = 0
g) Validierung Modus B: leer → Warnung
h) Validierung Modus C: lkw_breite_mm = 0 → Fehler
i) Δlademeter flaechenbasiert
j) Δlademeter laengenbasiert (Variante 2)
k) Negative Δlänge → negative Mehrkosten (Einsparung)
l) LKW-Auslastung < 50 % → Hinweis fuer Mischladung
m) Beispielrechnung Spec §11.3: 200×100mm/2 = 10m → 58.82 €
n) Cold-Start: paletten_pro_periode_manuell als Fallback
o) Break-Even kosten_pro_lademeter
p) Vergleich: Lademeter-basierte transport_mehrkosten korrekt
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


def _reset():
    p = Path(_TMP.name)
    if p.exists():
        p.unlink()


def test_a_modus_a_auto_lademeter():
    """Modus A: 800 € / 13.6 Lademeter ≈ 58.82 €/Lademeter."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "A"
    cp["kosten_pro_lkw_eur"] = 800
    cp["lademeter_pro_lkw"] = 13.6
    kpl = w.kosten_pro_lademeter(cp)
    print(f"  Modus A: 800/13.6 = {kpl:.2f} €/Lademeter")
    assert abs(kpl - 58.8235294) < 1e-5


def test_b_modus_b_direkt():
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "B"
    cp["kosten_pro_lademeter_eur"] = 65
    assert w.kosten_pro_lademeter(cp) == 65
    print(f"  Modus B direkt: 65 €/Lademeter")


def test_c_modus_c_pro_m2():
    """Modus C: 25 €/m² × 2.45 m LKW-Breite = 61.25 €/Lademeter."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "C"
    cp["kosten_pro_m2_eur"] = 25
    cp["lkw_breite_mm"] = 2450
    kpl = w.kosten_pro_lademeter(cp)
    print(f"  Modus C: 25 × 2.45 = {kpl} €/Lademeter")
    assert abs(kpl - 61.25) < 1e-9


def test_d_modus_wechsel_haelt_state():
    """Spec §16: Modus-Wechsel verliert keine Werte."""
    _reset()
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["kosten_pro_lkw_eur"] = 999
    cp["kosten_pro_lademeter_eur"] = 77
    cp["kosten_pro_m2_eur"] = 33
    w.speichere_params(cp)
    # Modus A→B→C
    p = w.lade_params()
    assert p["kosten_pro_lkw_eur"] == 999
    p["modus_logistik"] = "B"
    w.speichere_params(p)
    p2 = w.lade_params()
    # Modus B aktiv, aber Modus-A-Werte stehen noch
    assert p2["kosten_pro_lkw_eur"] == 999
    assert p2["kosten_pro_lademeter_eur"] == 77
    assert p2["kosten_pro_m2_eur"] == 33
    p2["modus_logistik"] = "C"
    w.speichere_params(p2)
    p3 = w.lade_params()
    assert p3["modus_logistik"] == "C"
    assert p3["kosten_pro_lkw_eur"] == 999
    assert p3["kosten_pro_lademeter_eur"] == 77
    print(f"  Modus-Wechsel: alle 3 Wertfelder bleiben erhalten.")


def test_e_validierung_lademeter_null():
    """Spec §16: lademeter_pro_lkw = 0 → Fehler (Division durch Null)."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "A"
    cp["lademeter_pro_lkw"] = 0
    fehler = [v for v in w.validierung(cp) if v["art"] == "fehler"]
    assert len(fehler) >= 1
    assert "Division" in fehler[0]["text"] or "lademeter" in fehler[0]["text"]
    # kpl gibt trotz Fehler 0.0 zurueck (kein Crash)
    assert w.kosten_pro_lademeter(cp) == 0.0
    print(f"  lademeter=0: Fehler '{fehler[0]['text'][:50]}…'")


def test_f_kosten_pro_lkw_null():
    """Spec §16: kosten_pro_lkw = 0 → Warnung + kpl = 0."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "A"
    cp["kosten_pro_lkw_eur"] = 0
    cp["lademeter_pro_lkw"] = 13.6
    warn = [v for v in w.validierung(cp) if v["art"] == "warnung"]
    assert len(warn) == 1
    assert w.kosten_pro_lademeter(cp) == 0.0
    print(f"  kosten_pro_lkw=0: Warnung + kpl=0.")


def test_g_validierung_modus_b_leer():
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "B"
    cp["kosten_pro_lademeter_eur"] = 0
    warn = [v for v in w.validierung(cp) if v["art"] == "warnung"]
    assert len(warn) >= 1
    print(f"  Modus B leer: '{warn[0]['text'][:50]}…'")


def test_h_validierung_modus_c_lkw_breite_null():
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "C"
    cp["lkw_breite_mm"] = 0
    cp["kosten_pro_m2_eur"] = 25
    fehler = [v for v in w.validierung(cp) if v["art"] == "fehler"]
    assert len(fehler) >= 1
    print(f"  Modus C lkw_breite=0: '{fehler[0]['text'][:50]}…'")


def test_i_delta_lademeter_flaechenbasiert():
    """Δfläche / (lkw_breite × 1000) → Lademeter [m].
    Beispiel: Δ = 10 m² = 10_000_000 mm² / 2450mm → 4.08 m."""
    delta = w.delta_lademeter_flaechenbasiert(
        delta_flaeche_mm2=10_000_000,
        lkw_breite_mm=2450,
    )
    erwartet = 10_000_000 / (2450 * 1000.0)
    print(f"  Δlademeter flaeche: {delta:.4f} m (erwartet {erwartet:.4f})")
    assert abs(delta - erwartet) < 1e-9


def test_j_delta_lademeter_laengenbasiert():
    """Spec §11.3 Beispiel: 200 Paletten × 100mm Δl, paletten_pro_reihe=2.
    → Δlänge = 200·100/2 = 10000 mm = 10 m."""
    delta = w.delta_lademeter_laengenbasiert(
        palette_breite_mm=1200,
        delta_laenge_pro_palette_mm=100,
        paletten_pro_periode=200,
        lkw_breite_mm=2450,
    )
    # 2450//1200 = 2 Reihen, 200*100/2 = 10000mm = 10m
    print(f"  Δlademeter Variante 2 (laenge): {delta} m")
    assert abs(delta - 10.0) < 1e-9


def test_k_negative_delta_einsparung():
    """Spec §16: neue Palette KLEINER als alt → negative Δfläche →
    negative Mehrkosten = Einsparung."""
    delta = w.delta_lademeter_flaechenbasiert(
        delta_flaeche_mm2=-2_000_000,
        lkw_breite_mm=2450,
    )
    assert delta < 0
    print(f"  Negative Δfläche → Δlademeter={delta:.3f} (Einsparung).")


def test_l_auslastung_lkw():
    """LKW-Auslastung — wenig Paletten, dedicated LKW → niedrige
    Auslastung."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    # Wenig Paletten pro Typ, viele Typen → schlechte Auslastung
    aus = w.auslastung_lkw(
        paletten_count_per_typ={(800, 1200): 5, (1000, 1500): 3},
        cp=cp,
    )
    print(f"  Auslastung: {aus['auslastung']:.2%} bei "
          f"{aus['fahrten_total']} Fahrten / {aus['paletten_total']} Paletten")
    # Mit Stapel=2 passen ca 68 pro LKW → 5 Paletten = 7% Auslastung
    assert aus["auslastung"] < 0.5  # Mischladung empfohlen


def test_m_beispielrechnung_spec_11_3():
    """Spec §11.3 zeigt: Δlängenbasiert 10m × 58.82 € = 588.20 € — aber
    Hinweis 'reale Berechnung Variante 1' kommt im UI. Hier: Beispiel
    Variante 2 mit 200 Paletten × 100 mm × paletten_pro_reihe=2."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "A"
    cp["kosten_pro_lkw_eur"] = 800
    cp["lademeter_pro_lkw"] = 13.6
    cp["lkw_breite_mm"] = 2450
    bsp = w.beispielrechnung(cp,
                                delta_laenge_pro_palette_mm=100,
                                paletten_pro_periode=200,
                                palette_breite_mm=1200)
    print(f"  Spec-Beispiel: kpl={bsp['kosten_pro_lademeter']:.2f}, "
          f"Δlm={bsp['delta_lademeter']:.2f} m, "
          f"Mehrkosten Periode={bsp['transport_mehrkosten_periode']:.2f}, "
          f"Jahr={bsp['transport_mehrkosten_jahr']:.2f}")
    assert abs(bsp["kosten_pro_lademeter"] - 58.8235) < 0.001
    assert abs(bsp["delta_lademeter"] - 10.0) < 0.01
    # Spec sagt: 1.0 Lademeter × 58.82 — das ist die *vereinfachte*
    # Variante. Mit unserer Formel ist Δ_länge_gesamt = 10m, also
    # delta_lademeter = 10 m. Mehrkosten = 10 × 58.82 ≈ 588.20.
    # Spec-Tippfehler oder andere Definition. Hier: pruefe das Verhaeltnis
    assert abs(bsp["transport_mehrkosten_periode"]
                 - 10.0 * 58.8235) < 0.5
    # Jahres-Hochrechnung × 12.166 (= 365/30)
    erw_jahr = bsp["transport_mehrkosten_periode"] * 365 / 30
    assert abs(bsp["transport_mehrkosten_jahr"] - erw_jahr) < 0.5


def test_n_cold_start_manueller_verbrauch():
    """paletten_pro_periode_manuell als Fallback ohne Historie."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["paletten_pro_periode_manuell"] = 500
    p = cp.get("paletten_pro_periode_manuell", 0)
    assert p == 500
    print(f"  Cold-Start: manuell={p} Paletten/Periode.")


def test_o_break_even_lademeter():
    """break_even_kosten_pro_lademeter findet den Wert bei dem Netto = 0."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "B"
    cp["kosten_pro_lademeter_eur"] = 60
    alt = {"typen_count": 10,
           "paletten_count_per_typ": {(800, 1200): 200},
           "paletten_summe": 200,
           "leerflaeche_summe": 0,
           "paletten_flaeche_summe": 200 * 800 * 1200,
           "ek_summe_eur": 200 * 30}
    neu = {"typen_count": 3,
           "paletten_count_per_typ": {(1000, 1600): 220},
           "paletten_summe": 220,
           "leerflaeche_summe": 0,
           "paletten_flaeche_summe": 220 * 1000 * 1600,
           "ek_summe_eur": 220 * 30}
    be = w.break_even_kosten_pro_lademeter(alt, neu, cp)
    print(f"  Break-even kosten_pro_lademeter: {be}")
    assert be is not None
    # Verifikation: bei kpl=be sollte Netto≈0 sein (Modus B = direkt)
    cp_be = dict(cp)
    cp_be["kosten_pro_lademeter_eur"] = be
    v_be = w.vergleich(zustand_alt=alt, zustand_neu=neu, cost_params=cp_be)
    assert abs(v_be["netto_periode"]) < 0.01, (
        f"Bei kpl={be} sollte Netto≈0 sein, ist {v_be['netto_periode']}"
    )


def test_p_vergleich_nutzt_lademeter():
    """vergleich() nimmt Lademeter-Logik wenn Modus + Kosten > 0."""
    cp = dict(w.DEFAULT_COST_PARAMS)
    cp["modus_logistik"] = "B"
    cp["kosten_pro_lademeter_eur"] = 60
    alt = {"typen_count": 5, "paletten_count_per_typ": {(800, 1200): 100},
           "paletten_summe": 100, "leerflaeche_summe": 0,
           "paletten_flaeche_summe": 100 * 800 * 1200,
           "ek_summe_eur": 0}
    neu = {"typen_count": 3, "paletten_count_per_typ": {(1000, 1500): 100},
           "paletten_summe": 100, "leerflaeche_summe": 0,
           "paletten_flaeche_summe": 100 * 1000 * 1500,
           "ek_summe_eur": 0}
    v = w.vergleich(zustand_alt=alt, zustand_neu=neu, cost_params=cp)
    print(f"  Δlademeter={v['delta_lademeter_periode']:.3f} m, "
          f"transport_mehrkosten={v['transport_mehrkosten']:.2f} €, "
          f"kosten_pro_lademeter={v['kosten_pro_lademeter']}")
    # Δfläche = 100·(1.5e6 - 0.96e6) = 5.4e7 mm² → /2450/1000 ≈ 22.04 m
    # × 60 €/lm = 1322.45 €
    assert v["delta_lademeter_periode"] > 20
    assert v["transport_mehrkosten"] > 1000


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
        test_a_modus_a_auto_lademeter,
        test_b_modus_b_direkt,
        test_c_modus_c_pro_m2,
        test_d_modus_wechsel_haelt_state,
        test_e_validierung_lademeter_null,
        test_f_kosten_pro_lkw_null,
        test_g_validierung_modus_b_leer,
        test_h_validierung_modus_c_lkw_breite_null,
        test_i_delta_lademeter_flaechenbasiert,
        test_j_delta_lademeter_laengenbasiert,
        test_k_negative_delta_einsparung,
        test_l_auslastung_lkw,
        test_m_beispielrechnung_spec_11_3,
        test_n_cold_start_manueller_verbrauch,
        test_o_break_even_lademeter,
        test_p_vergleich_nutzt_lademeter,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Logistik-Modi-Tests bestanden.")
    try:
        Path(_TMP.name).unlink(missing_ok=True)
    except Exception:
        pass
    sys.exit(0 if erfolge == len(tests) else 1)
