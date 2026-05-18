"""Pflicht-Test für die Mini-App.

Testet gegen eine selbst-erzeugte, im Code definierte Fixture
(``fixtures/pflicht_fixture.xlsx``, generiert durch
``fixtures/build_fixture.py``). KEINE externe oder hochgeladene
Datei — die Asserts sind deterministisch und reproduzierbar.

Die Fixture hat die SCHWIERIGE Struktur (Firmenname Z.1, Header Z.5,
Leerzeilen, P-Anzahl-Ablenkung, Drehung, doppelte AW, fehlendes Maß).

Reihenfolge der Asserts ist absichtlich:
  STRUKTUR (Import/Diagnose)  →  OPTIMIERUNG  →  CODE-INTEGRITÄT
Jeder Fehlschlag = Build rot.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

# stdout/stderr auf UTF-8 zwingen (Windows-Default cp1252 verschluckt
# sonst Unicode in assert-Meldungen).
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

from import_excel import importiere  # noqa: E402
from optimierer_kern import optimiere  # noqa: E402

# Erwartete Werte aus dem Fixture-Generator (Quelle der Wahrheit)
sys.path.insert(0, str(HIER / "fixtures"))
from build_fixture import (  # noqa: E402
    ERWARTET_HEADER_ZEILE,
    ERWARTET_MIT_MASS,
    ERWARTET_OHNE_MASS,
    ERWARTET_PALETTEN_SUMME,
    ERWARTET_UNIQUE_KANON,
    ERWARTET_KANDIDATEN,
    ERWARTET_GESAMT,
    baue_fixture,
)


FIXTURE = HIER / "fixtures" / "pflicht_fixture.xlsx"


def _setup() -> None:
    """Fixture im Test selbst neu erzeugen — garantiert Aktualität,
    falls jemand am Generator schraubt."""
    baue_fixture(FIXTURE)


# ---------------------------------------------------------------------
# A) STRUKTUR: Import erkennt die schwierige Datei korrekt
# ---------------------------------------------------------------------
def test_a_header_in_zeile_5_erkannt():
    _setup()
    dat = importiere(FIXTURE)
    print(f"\n  Header in Datei-Zeile: {dat['header_zeile']}")
    assert dat["header_zeile"] == ERWARTET_HEADER_ZEILE, (
        f"Header in Zeile {dat['header_zeile']} erkannt, "
        f"erwartet {ERWARTET_HEADER_ZEILE}. Datei hat Firmenname in Z.1, "
        f"Meta in Z.3 — Header muss dynamisch in Z.5 gefunden werden."
    )


def test_b_anzahl_mit_mass_korrekt():
    _setup()
    dat = importiere(FIXTURE)
    print(f"  mit_mass = {len(dat['mit_mass'])}")
    assert len(dat["mit_mass"]) == ERWARTET_MIT_MASS, (
        f"mit_mass = {len(dat['mit_mass'])}, erwartet {ERWARTET_MIT_MASS}. "
        f"Leerzeilen oder ungültige Zeilen werden falsch gezählt."
    )


def test_c_anzahl_ohne_mass_korrekt():
    _setup()
    dat = importiere(FIXTURE)
    print(f"  ohne_mass = {len(dat['ohne_mass'])}")
    assert len(dat["ohne_mass"]) == ERWARTET_OHNE_MASS, (
        f"ohne_mass = {len(dat['ohne_mass'])}, erwartet {ERWARTET_OHNE_MASS}. "
        f"Bucket 'Maß fehlt' fängt falsch."
    )


def test_d_paletten_gesamt_aus_spalte_menge():
    """Summe der Palettenanzahl MUSS aus Spalte 'Menge' kommen,
    NICHT aus 'P-Anzahl'. P-Anzahl ist als Ablenkung in der Fixture (1)."""
    _setup()
    dat = importiere(FIXTURE)
    summe = sum(int(p["anzahl"]) for p in dat["mit_mass"])
    print(f"  Σ Menge = {summe} (erwartet {ERWARTET_PALETTEN_SUMME})")
    assert summe == ERWARTET_PALETTEN_SUMME, (
        f"Σ Menge = {summe}, erwartet {ERWARTET_PALETTEN_SUMME}. "
        f"Wahrscheinlich greift P-Anzahl statt Menge — das war der "
        f"erste grosse Bug der Hauptapp."
    )


def test_e_unique_kanonische_masse():
    """Die Drehung (800×1200 + 1200×800) MUSS zu einer kanonischen
    Variante verschmelzen."""
    _setup()
    dat = importiere(FIXTURE)
    canon = {(max(p["laenge"], p["breite"]), min(p["laenge"], p["breite"]))
             for p in dat["mit_mass"]}
    print(f"  Unique kanonische Maße = {len(canon)} (erwartet {ERWARTET_UNIQUE_KANON})")
    assert len(canon) == ERWARTET_UNIQUE_KANON, (
        f"Unique kanon. Maße = {len(canon)}, erwartet {ERWARTET_UNIQUE_KANON}. "
        f"Drehung 800×1200 ↔ 1200×800 verschmilzt NICHT zu einem Maß."
    )


# ---------------------------------------------------------------------
# F) KANDIDATEN: volles Gitter, NICHT auf unique Maße reduziert
# ---------------------------------------------------------------------
def test_f_kandidaten_sind_volles_gitter():
    _setup()
    dat = importiere(FIXTURE)
    res = optimiere(dat["mit_mass"], tol_mm=100, kombi_max=3,
                    coverage="zweiseitig", zeit_limit_s=20)
    print(f"  Kandidaten = {res['kandidaten']} (erwartet {ERWARTET_KANDIDATEN}, "
          f">> Unique-Maße {ERWARTET_UNIQUE_KANON})")
    assert res["kandidaten"] == ERWARTET_KANDIDATEN, (
        f"Kandidaten = {res['kandidaten']}, erwartet exakt {ERWARTET_KANDIDATEN} "
        f"(volles Gitter S_vals × L_vals mit cs <= cl). Wenn Wert == "
        f"{ERWARTET_UNIQUE_KANON}: Kandidaten wurden faelschlich auf "
        f"vorkommende Maße reduziert — DAS war der zweite grosse Bug."
    )
    assert res["kandidaten"] > 2 * ERWARTET_UNIQUE_KANON, (
        f"Kandidaten ({res['kandidaten']}) sollten deutlich grösser sein "
        f"als die unique Maße ({ERWARTET_UNIQUE_KANON}) — volles Gitter."
    )


# ---------------------------------------------------------------------
# G) OPTIMIERUNG: Soll-Werte gegen die Fixture
# ---------------------------------------------------------------------
def test_g_optimum_bei_tol100_kombi3_zweiseitig():
    """tol=100 / kombi=3 / zweiseitig: per Hand nachvollziehbar
    5 Maße gesamt (4 echte Cluster + 1 isolierter Auftrag, der
    Standard oder Sonder werden darf; Summe ist gleich)."""
    _setup()
    dat = importiere(FIXTURE)
    res = optimiere(dat["mit_mass"], tol_mm=100, kombi_max=3,
                    coverage="zweiseitig", sonder_deckel=None,
                    zeit_limit_s=20)
    n_std = len(res["standards"])
    n_son = len(res["sonder"])
    print(f"  tol=100/kombi=3/zweiseitig: status={res['status']}, "
          f"std={n_std}, sonder={n_son}, gesamt={res['gesamt']}")
    assert res["status"] == "Optimal", f"ILP-Status: {res['status']}"
    assert res["gesamt"] == ERWARTET_GESAMT, (
        f"gesamt = {res['gesamt']}, erwartet {ERWARTET_GESAMT}. "
        f"Falsche Zielfunktion (Standards + Sonder muss minimiert werden) "
        f"oder Coverage/Kombi falsch."
    )
    assert n_std + n_son == ERWARTET_GESAMT, "Konsistenz"
    assert n_std >= 2, f"Standards = {n_std}, erwartet ≥ 2 (mind. 2 echte Cluster)"
    assert n_son <= 2, f"Sonder = {n_son}, erwartet ≤ 2 (max. 2 isolierte Aufträge)"


def test_h_gegenprobe_tol0_liefert_mehr():
    """Mit tol=0 darf nichts geclustert werden → mehr Maße als bei tol=100."""
    _setup()
    dat = importiere(FIXTURE)
    res = optimiere(dat["mit_mass"], tol_mm=0, kombi_max=3,
                    coverage="zweiseitig", zeit_limit_s=20)
    print(f"  Gegenprobe tol=0: status={res['status']}, gesamt={res['gesamt']}")
    assert res["status"] == "Optimal"
    assert res["gesamt"] >= ERWARTET_UNIQUE_KANON, (
        f"Bei tol=0 muss gesamt mindestens = unique Maße sein "
        f"({ERWARTET_UNIQUE_KANON}), bekam {res['gesamt']}"
    )
    assert res["gesamt"] > ERWARTET_GESAMT, (
        f"tol=0 ({res['gesamt']}) sollte deutlich mehr Maße liefern als "
        f"tol=100 ({ERWARTET_GESAMT})"
    )


# ---------------------------------------------------------------------
# I) ORIENTIERUNG: Drehung 800×1200 ↔ 1200×800 fällt unter denselben Standard
# ---------------------------------------------------------------------
def test_i_orientierung_drehung_landet_unter_einem_standard():
    _setup()
    dat = importiere(FIXTURE)
    res = optimiere(dat["mit_mass"], tol_mm=100, kombi_max=3,
                    coverage="zweiseitig", zeit_limit_s=20)
    a1 = next((z for z in res["zuordnung"] if z["auftrag"] == "110001"), None)
    a3 = next((z for z in res["zuordnung"] if z["auftrag"] == "110003"), None)
    assert a1 and a3, "Aufträge 110001 und 110003 fehlen in der Zuordnung"
    print(f"  110001 (1200×800) → ziel {a1['ziel']}")
    print(f"  110003 (800×1200 gedreht) → ziel {a3['ziel']}")
    assert a1["ziel"] == a3["ziel"], (
        f"Drehung wird NICHT erkannt: 110001 → {a1['ziel']}, "
        f"110003 → {a3['ziel']}. Beide sollten auf denselben Standard."
    )


# ---------------------------------------------------------------------
# J) DOPPELTE AW: beide Positionen im Ergebnis vorhanden
# ---------------------------------------------------------------------
def test_j_doppelte_aw_beide_positionen_im_ergebnis():
    _setup()
    dat = importiere(FIXTURE)
    res = optimiere(dat["mit_mass"], tol_mm=100, kombi_max=3,
                    coverage="zweiseitig", zeit_limit_s=20)
    treffer = [z for z in res["zuordnung"] if z["auftrag"] == "110008"]
    print(f"  Auftrag 110008: {len(treffer)} Treffer (erwartet 2)")
    assert len(treffer) == 2, (
        f"AW 110008 hat zwei Positionen — beide MÜSSEN durchkommen, "
        f"bekam {len(treffer)}"
    )


# ---------------------------------------------------------------------
# K) MAß FEHLT: Bucket separat, nicht in der Optimierung
# ---------------------------------------------------------------------
def test_k_mass_fehlt_bucket_separat():
    _setup()
    dat = importiere(FIXTURE)
    aw009_optimiert = next(
        (p for p in dat["mit_mass"] if p["auftrag"] == "110009"), None
    )
    aw009_ohne = next(
        (p for p in dat["ohne_mass"] if p["auftrag"] == "110009"), None
    )
    assert aw009_optimiert is None, "AW 110009 darf NICHT in mit_mass landen"
    assert aw009_ohne is not None, "AW 110009 MUSS im Bucket 'ohne_mass' sein"
    print(f"  AW 110009 korrekt in ohne_mass (nicht in Optimierung)")


# ---------------------------------------------------------------------
# L) CODE-INTEGRITÄT: keine Mengen-Schwelle, keine P-Anzahl-Mappings
# ---------------------------------------------------------------------
def test_l_kein_mengen_schwelle_in_app_modulen():
    """Suche in den App-Modulen der Mini-App nach 'mengen_schwelle' —
    darf NIRGENDS auftauchen. Tests selber duerfen den Begriff in
    Strings/Kommentaren enthalten (Suchbegriff)."""
    mini_root = HIER.parent  # paletten-optimierer/mini
    app_module = [
        mini_root / "app_mini.py",
        mini_root / "optimierer_kern.py",
        mini_root / "import_excel.py",
        mini_root / "_ui_chrome.py",
        mini_root / "run_mini.py",
    ]
    treffer = []
    for py in app_module:
        if not py.exists():
            continue
        text = py.read_text(encoding="utf-8", errors="ignore")
        if "mengen_schwelle" in text.lower():
            treffer.append(str(py.relative_to(mini_root)))
    print(f"  App-Module mit 'mengen_schwelle': {len(treffer)}")
    assert not treffer, (
        f"'mengen_schwelle' darf in der Mini-App nicht vorkommen, "
        f"gefunden in: {treffer}"
    )


def test_m_p_anzahl_wird_nicht_als_palettenanzahl_gemappt():
    """Wenn 'P-Anzahl' gemappt wäre, käme bei dieser Fixture Σ=8
    raus (alle P-Anzahl=1, 8 mit-Maß-Zeilen) statt 41."""
    _setup()
    dat = importiere(FIXTURE)
    summe = sum(int(p["anzahl"]) for p in dat["mit_mass"])
    assert summe != 9 and summe != 8, (
        f"Σ = {summe} sieht aus wie P-Anzahl-Mapping (alle 1) — "
        f"Spalte 'Menge' wird nicht korrekt gelesen"
    )


# ---------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------
def _run(fn):
    name = fn.__name__
    try:
        fn()
        print(f"OK  {name}")
        return True
    except AssertionError as e:
        print(f"FAIL {name}: {e}")
        return False
    except Exception as e:
        print(f"ERR  {name}: {type(e).__name__}: {e}")
        import traceback; traceback.print_exc()
        return False


if __name__ == "__main__":
    tests = [
        test_a_header_in_zeile_5_erkannt,
        test_b_anzahl_mit_mass_korrekt,
        test_c_anzahl_ohne_mass_korrekt,
        test_d_paletten_gesamt_aus_spalte_menge,
        test_e_unique_kanonische_masse,
        test_f_kandidaten_sind_volles_gitter,
        test_g_optimum_bei_tol100_kombi3_zweiseitig,
        test_h_gegenprobe_tol0_liefert_mehr,
        test_i_orientierung_drehung_landet_unter_einem_standard,
        test_j_doppelte_aw_beide_positionen_im_ergebnis,
        test_k_mass_fehlt_bucket_separat,
        test_l_kein_mengen_schwelle_in_app_modulen,
        test_m_p_anzahl_wird_nicht_als_palettenanzahl_gemappt,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print("=" * 60)
    print(f"{erfolge}/{len(tests)} Tests bestanden.")
    print("=" * 60)
    sys.exit(0 if erfolge == len(tests) else 1)
