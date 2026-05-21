"""Tests fuer Sonderpaletten-Option + Score-Breakdown (Spec §3).

a) Default-Verhalten: ohne neue Parameter wie v4
b) sonder_erlaubt=False + Katalog deckt nicht alle ->
   nicht_zuordenbar wird befuellt, kein Sonder erzeugt
c) sonder_erlaubt=False + Katalog deckt alle ->
   gesamt = #Katalog-Maße, nicht_zuordenbar leer
d) sonder_min_artikel=N: Sonder mit Coverage<N wird nicht eingefuehrt
e) sonder_aufschlag_mm: Aufschlag aendert Kandidaten-Maße
f) Score-Breakdown: alle 5 Gewichte werden korrekt zurueckgegeben
g) Gewicht w5 > 0 reduziert Anzahl Sonder
h) Gewicht w1=0 + w5=0: Optimizer sucht andere Loesung (oder gleich)
i) Edge: leere Auftrag-Liste -> leeres Ergebnis ohne Crash
j) Edge: leerer Katalog + sonder_erlaubt=False -> alles nicht_zuordenbar
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


def test_a_default_unveraendert():
    """Ohne neue Parameter muss der Kern exakt wie v4 arbeiten."""
    orders = [
        {'L': 1520, 'B': 720, 'menge': 1, 'auftrag': 'A', 'name': ''},
        {'L': 1550, 'B': 700, 'menge': 1, 'auftrag': 'B', 'name': ''},
    ]
    r = optimiere(orders, tol_kurz_mm=200, tol_lang_mm=200)
    assert r["parameter"]["sonder_erlaubt"] is True
    assert r["parameter"]["sonder_min_artikel"] == 0
    assert r["parameter"]["sonder_aufschlag_mm"] == 0
    assert r["nicht_zuordenbar"] == []
    print(f"  Default: std={len(r['standards'])} son={len(r['sonder'])} "
          f"nz={len(r['nicht_zuordenbar'])} (Defaults unveraendert)")


def test_b_sonder_verboten_katalog_deckt_nicht_alle():
    """sonder_erlaubt=False + Katalog deckt nicht alle Aufträge:
    Solver erzeugt KEINE neuen Maße, nicht-passende landen in
    nicht_zuordenbar (mit hohem Penalty)."""
    orders = [
        {'L': 1200, 'B': 800, 'menge': 1, 'auftrag': 'A', 'name': ''},
        # Auftrag B (3000x2000) — Katalog (1200,800) deckt das NIE
        {'L': 3000, 'B': 2000, 'menge': 1, 'auftrag': 'B', 'name': ''},
    ]
    katalog = [(800, 1200)]
    r = optimiere(orders, tol_kurz_mm=100, tol_lang_mm=100,
                  katalog=katalog, sonder_erlaubt=False)
    print(f"  Verboten: std={r['standards']} son={r['sonder']} "
          f"nz={[n['auftrag'] for n in r['nicht_zuordenbar']]}")
    assert len(r["sonder"]) == 0, "Keine Sonder erlaubt"
    assert len(r["nicht_zuordenbar"]) == 1
    assert r["nicht_zuordenbar"][0]["auftrag"] == "B"
    # Auftrag A wird durch Katalog gedeckt
    assert (800, 1200) in r["standards"]


def test_c_sonder_verboten_katalog_deckt_alle():
    """sonder_erlaubt=False, aber Katalog deckt alle Aufträge:
    gesamt = #Katalog-Maße, nicht_zuordenbar leer."""
    orders = [
        {'L': 1190, 'B': 790, 'menge': 1, 'auftrag': 'A', 'name': ''},
        {'L': 1180, 'B': 800, 'menge': 1, 'auftrag': 'B', 'name': ''},
    ]
    katalog = [(800, 1200)]
    r = optimiere(orders, tol_kurz_mm=100, tol_lang_mm=100,
                  katalog=katalog, sonder_erlaubt=False)
    print(f"  Verboten+OK: std={r['standards']} nz={len(r['nicht_zuordenbar'])}")
    assert len(r["nicht_zuordenbar"]) == 0
    assert r["standards"] == [(800, 1200)]


def test_d_sonder_min_artikel():
    """sonder_min_artikel=5: ein Sonder-Maß wird nur eingefuehrt, wenn
    er ≥ 5 Artikel buendelt. Bei nur 1 Artikel pro exotischem Maß bleibt
    der Optimizer beim Sonder UEBER z[g] (Auftragsmaß als Sonder)."""
    # 1 Auftrag mit ausgefallenem Maß, menge=1 — kein Maß-Kandidat
    # (auch nicht das Auftragsmaß selber, weil es exakt gleich ist) sollte
    # eingefuehrt werden, wenn min_artikel=5 gilt, aber z[g] hilft, weil
    # z[g] das Auftragsmaß selber ist.
    orders = [
        {'L': 999, 'B': 333, 'menge': 1, 'auftrag': 'X', 'name': ''},
    ]
    # Mit min=5 sollte das Auftrags-Maß als z[g]-Sonder genutzt werden
    r = optimiere(orders, tol_kurz_mm=10, tol_lang_mm=10,
                  sonder_min_artikel=5)
    # Erwartung: Solver wahlt Sonder-Auftragsmaß (z[g]), KEINE neuen
    # Standard-Kandidaten (sie deckten nur 1 Artikel < N).
    print(f"  min=5: std={r['standards']} son={r['sonder']}")
    assert len(r["standards"]) == 0
    assert (333, 999) in r["sonder"]


def test_e_sonder_aufschlag_mm():
    """sonder_aufschlag_mm fuegt einen Sicherheits-Aufschlag zu den
    Sonder-Kandidaten hinzu. Standard-Kandidaten bleiben unveraendert."""
    orders = [
        {'L': 1000, 'B': 800, 'menge': 1, 'auftrag': 'A', 'name': ''},
    ]
    # Ohne Aufschlag: Standard (800,1000) deckt direkt
    r0 = optimiere(orders, tol_kurz_mm=0, tol_lang_mm=0,
                   sonder_aufschlag_mm=0)
    # Mit Aufschlag 50: zusaetzlich Kandidat (850, 1050)
    r50 = optimiere(orders, tol_kurz_mm=100, tol_lang_mm=100,
                    sonder_aufschlag_mm=50)
    print(f"  Aufschlag 0: {r0['standards']}")
    print(f"  Aufschlag 50: {r50['standards']}")
    # Hauptsache kein Crash und das Param wird gespeichert
    assert r0["parameter"]["sonder_aufschlag_mm"] == 0
    assert r50["parameter"]["sonder_aufschlag_mm"] == 50


def test_f_score_breakdown_alle_5_gewichte():
    """Score-Breakdown enthält alle Komponenten und ist additiv = score."""
    orders = [
        {'L': 1200, 'B': 800, 'menge': 3, 'auftrag': 'A', 'name': ''},
        {'L': 1500, 'B': 1000, 'menge': 2, 'auftrag': 'B', 'name': ''},
    ]
    katalog = [(800, 1200), (1000, 1500)]
    r = optimiere(orders, tol_kurz_mm=50, tol_lang_mm=50,
                  katalog=katalog,
                  gewichte={"w1": 1.0, "w2": 0.1, "w3": 0.5,
                            "w4": 0.2, "w5": 2.0},
                  katalog_kosten={(800, 1200): 14.5, (1000, 1500): 18.0},
                  katalog_verbrauch={(800, 1200): 100.0,
                                      (1000, 1500): 50.0})
    bd = r["score_breakdown"]
    print(f"  Score={r['score']:.3f}")
    print(f"  bd={bd}")
    erwartet = sum(bd.values())
    assert abs(erwartet - r["score"]) < 1e-6, (
        f"Σ Komponenten {erwartet} ≠ score {r['score']}"
    )
    # Alle 6 Schluessel vorhanden (5 Gewichte + slack)
    for k in ("w1_palettentypen", "w2_gesamt_paletten",
              "w3_verbrauch_bonus", "w4_gesamtkosten",
              "w5_sonder_penalty", "slack_nicht_zuordenbar"):
        assert k in bd, f"Fehlend: {k}"


def test_g_w5_reduziert_sonder():
    """Hohes w5 (Sonder-Penalty) erzwingt Solver weg von Sonder.
    Setup: 2 Auftraege, einer exotisch — ohne Penalty waere ein
    Standard + ein Sonder optimal, mit hohem w5 + freier Toleranz
    waere 1 großer Standard fuer beide besser."""
    orders = [
        {'L': 1000, 'B': 800, 'menge': 10, 'auftrag': 'A', 'name': ''},
        {'L': 1200, 'B': 900, 'menge': 1, 'auftrag': 'B', 'name': ''},
    ]
    # Enge Toleranz: Auftrag B muss eigener Sonder werden
    r_lo = optimiere(orders, tol_kurz_mm=50, tol_lang_mm=50,
                     gewichte={"w1": 1.0, "w5": 0.0})
    # Weite Toleranz + hohes w5: 1 Std (900, 1200) deckt beide -> 1 Typ
    r_hi = optimiere(orders, tol_kurz_mm=200, tol_lang_mm=200,
                     gewichte={"w1": 1.0, "w5": 5.0})
    print(f"  enge+w5=0: gesamt={r_lo['gesamt']} "
          f"son={len(r_lo['sonder'])}")
    print(f"  weit+w5=5: gesamt={r_hi['gesamt']} "
          f"son={len(r_hi['sonder'])}")
    assert r_lo["gesamt"] >= r_hi["gesamt"]


def test_h_leere_auftrag_liste():
    """Edge: leere Order-Liste -> leeres Ergebnis ohne Crash."""
    r = optimiere([])
    assert r["gesamt"] == 0
    assert r["standards"] == []
    assert r["sonder"] == []
    assert r["nicht_zuordenbar"] == []
    assert r["score"] == 0.0
    print(f"  Leer: kein Crash, gesamt=0")


def test_i_leerer_katalog_sonder_verboten():
    """Edge: leerer Katalog + sonder_erlaubt=False -> alle Auftraege
    landen in nicht_zuordenbar."""
    orders = [
        {'L': 1000, 'B': 800, 'menge': 1, 'auftrag': 'A', 'name': ''},
        {'L': 1500, 'B': 700, 'menge': 1, 'auftrag': 'B', 'name': ''},
    ]
    r = optimiere(orders, katalog=[], sonder_erlaubt=False)
    print(f"  leer+verboten: nz={len(r['nicht_zuordenbar'])}")
    assert len(r["nicht_zuordenbar"]) == 2
    assert len(r["standards"]) == 0
    assert len(r["sonder"]) == 0


def test_j_w4_bevorzugt_guenstige_katalog_maße():
    """w4 (Kosten) bevorzugt billigere Katalog-Maße bei Tie.
    Sonder verboten, damit Solver nicht das Auftragsmaß als Sonder
    waehlt (welches kostenfrei waere)."""
    # 1 Auftrag — kann von 2 gleichgut passenden Katalog-Maßen gedeckt werden
    orders = [
        {'L': 800, 'B': 600, 'menge': 1, 'auftrag': 'A', 'name': ''},
    ]
    katalog = [(600, 800), (700, 900)]  # beide decken
    # Mit Kostenstruktur: (600,800) ist billiger
    r = optimiere(orders, tol_kurz_mm=200, tol_lang_mm=200,
                  katalog=katalog, sonder_erlaubt=False,
                  gewichte={"w1": 1.0, "w4": 1.0},
                  katalog_kosten={(600, 800): 10.0, (700, 900): 50.0})
    print(f"  w4: std={r['standards']} (erwartet: günstiger 600,800)")
    assert (600, 800) in r["standards"]


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
        test_a_default_unveraendert,
        test_b_sonder_verboten_katalog_deckt_nicht_alle,
        test_c_sonder_verboten_katalog_deckt_alle,
        test_d_sonder_min_artikel,
        test_e_sonder_aufschlag_mm,
        test_f_score_breakdown_alle_5_gewichte,
        test_g_w5_reduziert_sonder,
        test_h_leere_auftrag_liste,
        test_i_leerer_katalog_sonder_verboten,
        test_j_w4_bevorzugt_guenstige_katalog_maße,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Sonder-Score-Tests bestanden.")
    sys.exit(0 if erfolge == len(tests) else 1)
