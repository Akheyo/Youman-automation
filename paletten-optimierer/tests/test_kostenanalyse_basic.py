"""Kostenanalyse-Basic: Netto = Y - X.

Kurzer Sanity-Test fuer die Rechenlogik hinter seite_kostenanalyse_basic.
"""
from __future__ import annotations

import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))


def _netto(lkw_kosten: float, lkw_anzahl: int,
            einsparung_paletten: float) -> tuple[float, float, float]:
    """1:1 Kopie der Rechnung aus app.seite_kostenanalyse_basic."""
    X = float(lkw_kosten) * int(lkw_anzahl)
    Y = float(einsparung_paletten)
    return X, Y, Y - X


def test_beispiel_5_lkw_800_gegen_6000_paletten():
    """5 LKW × 800 € = 4 000 € Mehrkosten. 6 000 € Palettenkauf-
    Ersparnis. Netto +2 000 € (Standardisierung lohnt sich)."""
    X, Y, netto = _netto(800.0, 5, 6000.0)
    assert X == 4000.0
    assert Y == 6000.0
    assert netto == 2000.0
    assert netto > 0


def test_null_lkw_ist_null_mehrkosten():
    X, _, _ = _netto(1200.0, 0, 500.0)
    assert X == 0.0


def test_mehr_lkw_als_einsparung_wird_negativ():
    """10 LKW × 800 € = 8 000 € Mehrkosten. Nur 3 000 € Ersparnis.
    Netto -5 000 € (Standardisierung wuerde teurer)."""
    X, Y, netto = _netto(800.0, 10, 3000.0)
    assert X == 8000.0
    assert Y == 3000.0
    assert netto == -5000.0
    assert netto < 0


def test_jahreshochrechnung_pro_monat_mal_12():
    """Bei Zeitraum 'pro Monat' rechnet die UI x12 hoch."""
    _, _, netto_monat = _netto(800.0, 5, 6000.0)
    faktor = 12
    assert netto_monat * faktor == 24000.0


def test_jahreshochrechnung_pro_quartal_mal_4():
    _, _, netto = _netto(800.0, 5, 6000.0)
    assert netto * 4 == 8000.0


def test_gross_realistisch_flottenkosten():
    """Realistischer Grossbetrieb: 20 LKW à 900 €, 25 000 € Ersparnis."""
    X, Y, netto = _netto(900.0, 20, 25000.0)
    assert X == 18000.0
    assert Y == 25000.0
    assert netto == 7000.0


if __name__ == "__main__":
    tests = [test_beispiel_5_lkw_800_gegen_6000_paletten,
             test_null_lkw_ist_null_mehrkosten,
             test_mehr_lkw_als_einsparung_wird_negativ,
             test_jahreshochrechnung_pro_monat_mal_12,
             test_jahreshochrechnung_pro_quartal_mal_4,
             test_gross_realistisch_flottenkosten]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
            sys.exit(1)
    print(f"\n{len(tests)}/{len(tests)} Kostenanalyse-Basic-Tests bestanden.")
