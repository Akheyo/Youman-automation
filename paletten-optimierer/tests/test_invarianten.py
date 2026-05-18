"""Invarianten-Tests für die Optimierung — gemäss User-Vorgabe.

Diese Tests sind die EINZIGE Wahrheit für "ist die Optimierung
korrekt". Wenn einer hier rot ist, ist die Optimierung kaputt,
egal wie schön sie aussieht.

Geprüfte Invarianten:
- Toleranz größer  ⇒ Standard-Anzahl darf NIE steigen
- Budget größer    ⇒ Standard-Anzahl darf NIE steigen
- 800×1200 + Standard 1200×800, Tol=0 ⇒ COVERED (kein extra Standard)
- 1200×800 und 800×1200 ⇒ genau EIN Standard, geprüft im Set-Cover-Pfad
- Determinismus: Zeilen mischen ⇒ identische Standards
- Gegen Default-Tol für die Real-Datei: dokumentierter Wert
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from excel_handler import importiere_excel  # noqa: E402
from optimizer import Palette, optimiere  # noqa: E402


REAL_FIXTURE = Path(__file__).resolve().parent.parent / "data" / "draht_mueller_palettenliste.xlsx"


def _opt(ps, tol, **kw):
    return optimiere(
        ps, toleranz_l=tol, toleranz_b=tol, einheit="mm",
        raster=kw.get("raster", 100),
        kombinieren_erlaubt=kw.get("kombi", False),
        wirtschaftliche_filterung=False,
        mengen_schwelle=kw.get("schwelle", 0),
        hoehe_aktiv=False,
    )


def _label(s):
    return (int(round(s.laenge)), int(round(s.breite)))


# ---------------------------------------------------------------------
# Invariante 1: Toleranz monoton — größere Toleranz ⇒ nicht mehr Standards
# ---------------------------------------------------------------------
def test_toleranz_groesser_niemals_mehr_standards():
    ps = importiere_excel(REAL_FIXTURE)
    werte = [(t, _opt(ps, t).anzahl_standards) for t in [0, 50, 100, 200, 300, 500, 1000]]
    print(f"\n  Toleranz → Standards: {werte}")
    for (t1, n1), (t2, n2) in zip(werte, werte[1:]):
        assert n2 <= n1, (
            f"Monotonie verletzt: tol={t1} → {n1} Standards, "
            f"tol={t2} → {n2} Standards. Toleranz größer darf NIE mehr "
            f"Standards erzeugen."
        )


# ---------------------------------------------------------------------
# Invariante 2: Orientierung wird IM Set-Cover behandelt, nicht nur im Import
# ---------------------------------------------------------------------
def test_orientierung_800x1200_und_1200x800_genau_ein_standard_tol_null():
    """Zwei Aufträge mit gerichteten Maßen 1200×800 und 800×1200 müssen
    EINEN Standard ergeben — auch bei Toleranz 0. Das ist der harte
    Orientierungs-Test im Set-Cover-Pfad."""
    p1 = Palette("A1", laenge=1200, breite=800, anzahl=10, auftrag="O1")
    p2 = Palette("A2", laenge=800,  breite=1200, anzahl=10, auftrag="O2")
    erg = _opt([p1, p2], tol=0)
    labels = [_label(s) for s in erg.standards]
    print(f"\n  Standards bei tol=0 für (1200×800, 800×1200): {labels}")
    assert erg.anzahl_standards == 1, (
        f"Erwartet 1 Standard für (1200×800, 800×1200), "
        f"bekam {erg.anzahl_standards} ({labels})"
    )


def test_einzelner_auftrag_800x1200_wird_durch_standard_1200x800_gedeckt():
    """User-Test 3: Auftrag-Rohmaß 800×1200, Standard 1200×800 ist
    derselbe physische Standard. Bei Toleranz=0 darf KEIN separater
    Standard entstehen, weil der vorhandene 1200×800 schon abdeckt."""
    p_anker = Palette("ANKER", laenge=1200, breite=800, anzahl=50, auftrag="A1")
    p_drehung = Palette("DREH", laenge=800, breite=1200, anzahl=1, auftrag="A2")
    erg = _opt([p_anker, p_drehung], tol=0)
    labels = [_label(s) for s in erg.standards]
    print(f"  Standards: {labels}")
    assert erg.anzahl_standards == 1, (
        f"Standard 1200×800 müsste 800×1200 abdecken (Drehung um 90°). "
        f"Bekam {erg.anzahl_standards} ({labels})"
    )


# ---------------------------------------------------------------------
# Invariante 3: Determinismus — Zeilenreihenfolge irrelevant
# ---------------------------------------------------------------------
def test_determinismus_zeilen_mischen_liefert_identische_standards():
    ps = importiere_excel(REAL_FIXTURE)
    erg_a = _opt(ps, tol=200)
    standards_a = sorted(_label(s) for s in erg_a.standards)

    rnd = random.Random(42)
    ps_mix = list(ps); rnd.shuffle(ps_mix)
    erg_b = _opt(ps_mix, tol=200)
    standards_b = sorted(_label(s) for s in erg_b.standards)

    print(f"\n  Original-Reihenfolge: {len(standards_a)} Standards")
    print(f"  Gemischte Reihenfolge: {len(standards_b)} Standards")
    assert standards_a == standards_b, (
        f"Ergebnis hängt von Reihenfolge ab. "
        f"A−B: {set(standards_a) - set(standards_b)} "
        f"B−A: {set(standards_b) - set(standards_a)}"
    )


# ---------------------------------------------------------------------
# Invariante 4: Sonder-Budget monoton — größeres Budget ⇒ nicht mehr Standards
# ---------------------------------------------------------------------
def test_sonder_budget_groesser_niemals_mehr_standards():
    """User-Spec: ``sonder_budget=K`` erlaubt höchstens K ungebundene
    Aufträge. Wenn K wächst, dürfen NIE mehr Standards entstehen."""
    ps = importiere_excel(REAL_FIXTURE)
    werte = []
    for k in [0, 5, 10, 20, 50, 100]:
        erg = optimiere(
            ps, toleranz_l=200, toleranz_b=200, einheit="mm",
            raster=100, kombinieren_erlaubt=False,
            wirtschaftliche_filterung=False, mengen_schwelle=0,
            hoehe_aktiv=False, sonder_budget=k,
        )
        werte.append((k, erg.anzahl_standards, erg.anzahl_sonder))
    print(f"\n  Sonder-Budget → (Standards, Sonder): {werte}")
    for (k1, s1, _), (k2, s2, _) in zip(werte, werte[1:]):
        assert s2 <= s1, (
            f"Monotonie verletzt: budget={k1} → {s1} Std, budget={k2} → {s2} Std. "
            f"Größeres Budget darf NIE mehr Standards erzeugen."
        )


def test_sonder_budget_respektiert_max_anzahl_sonder():
    """Wenn Budget=10, dürfen höchstens 10 Aufträge in Sonder landen."""
    ps = importiere_excel(REAL_FIXTURE)
    erg = optimiere(
        ps, toleranz_l=200, toleranz_b=200, einheit="mm",
        raster=100, kombinieren_erlaubt=False,
        wirtschaftliche_filterung=False, mengen_schwelle=0,
        hoehe_aktiv=False, sonder_budget=10,
    )
    print(f"\n  Budget=10 → Standards: {erg.anzahl_standards}, Sonder: {erg.anzahl_sonder}")
    assert erg.anzahl_sonder <= 10, (
        f"Budget=10 erlaubt höchstens 10 Sonder, bekam {erg.anzahl_sonder}"
    )


# ---------------------------------------------------------------------
# Invariante 5: Keine doppelten Standards mit gleichen kanonischen Maßen
# ---------------------------------------------------------------------
def test_keine_zwei_standards_mit_gleichen_kanonischen_massen():
    ps = importiere_excel(REAL_FIXTURE)
    erg = _opt(ps, tol=200)
    labels = [_label(s) for s in erg.standards]
    # kanonisieren: (lange, kurze)
    kanon = [(max(L, B), min(L, B)) for L, B in labels]
    assert len(kanon) == len(set(kanon)), (
        f"Duplikate in Standards nach Kanonisierung. "
        f"Labels: {labels}"
    )


# ---------------------------------------------------------------------
# Invariante 6: Coverage-Konsistenz — jeder Auftrag liegt unter genau einem
# Standard, dessen Maße im Toleranz-Fenster liegen
# ---------------------------------------------------------------------
def test_jeder_auftrag_passt_in_seinen_zugewiesenen_standard():
    ps = importiere_excel(REAL_FIXTURE)
    tol = 200
    erg = _opt(ps, tol=tol)
    verletzungen = []
    for s in erg.standards:
        for m in s.members:
            # Standard MUSS in beiden Dimensionen >= Original-Member sein
            # (sonst passt die Last nicht physisch drauf)
            if s.laenge < m.laenge - 0.01 or s.breite < m.breite - 0.01:
                verletzungen.append(
                    f"Standard {_label(s)} < Member {m.artikelnummer}={m.laenge}×{m.breite}"
                )
            # Standard darf nicht mehr als tol über Original sein
            if s.laenge > m.laenge + tol + 0.01 or s.breite > m.breite + tol + 0.01:
                verletzungen.append(
                    f"Standard {_label(s)} > Member {m.artikelnummer}+tol "
                    f"({m.laenge + tol}×{m.breite + tol})"
                )
    assert not verletzungen, "Coverage verletzt:\n  " + "\n  ".join(verletzungen[:10])


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
        test_toleranz_groesser_niemals_mehr_standards,
        test_orientierung_800x1200_und_1200x800_genau_ein_standard_tol_null,
        test_einzelner_auftrag_800x1200_wird_durch_standard_1200x800_gedeckt,
        test_determinismus_zeilen_mischen_liefert_identische_standards,
        test_sonder_budget_groesser_niemals_mehr_standards,
        test_sonder_budget_respektiert_max_anzahl_sonder,
        test_keine_zwei_standards_mit_gleichen_kanonischen_massen,
        test_jeder_auftrag_passt_in_seinen_zugewiesenen_standard,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print("="*60)
    print(f"{erfolge}/{len(tests)} Invarianten-Tests bestanden.")
    print("="*60)
    sys.exit(0 if erfolge == len(tests) else 1)
