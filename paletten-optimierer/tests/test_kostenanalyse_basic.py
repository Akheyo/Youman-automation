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
    """1:1 Kopie der Rechnung aus app.seite_kostenanalyse_basic
    (Pauschal-Modus)."""
    X = float(lkw_kosten) * int(lkw_anzahl)
    Y = float(einsparung_paletten)
    return X, Y, Y - X


def _x_lademeter(kosten_pro_lm: float, delta_lm: int) -> float:
    """Transport-Kosten pro Lademeter × Δ Lademeter."""
    return float(kosten_pro_lm) * int(delta_lm)


def _y_paletten(anzahl: int, einkauf_eur: float,
                 selbst_eur: float) -> tuple[float, float, float, str]:
    """Palettenkauf-Rechnung: Gesamt Einkauf, Gesamt Selbstfertigung,
    Ersparnis Y (Betrag der Differenz), günstigere Option."""
    ekauf = float(einkauf_eur) * int(anzahl)
    eigen = float(selbst_eur) * int(anzahl)
    Y = abs(ekauf - eigen)
    guenstig = "Selbstfertigung" if eigen < ekauf else "Einkauf"
    return ekauf, eigen, Y, guenstig


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


def test_lademeter_transport_40_lm_x_25_eur():
    """40 Lademeter × 25 €/lm = 1 000 € Transport-Mehrkosten."""
    X = _x_lademeter(25.0, 40)
    assert X == 1000.0


def test_lademeter_null_ist_null():
    assert _x_lademeter(50.0, 0) == 0.0


def test_paletten_einkauf_teurer_als_selbstfertigung():
    """500 Paletten, Einkauf 12.50, Selbstfertigung 9.00 →
    Selbstfertigung günstiger, Ersparnis 3.50 × 500 = 1750."""
    ekauf, eigen, Y, guenstig = _y_paletten(500, 12.5, 9.0)
    assert ekauf == 6250.0
    assert eigen == 4500.0
    assert Y == 1750.0
    assert guenstig == "Selbstfertigung"


def test_paletten_selbstfertigung_teurer_als_einkauf():
    """Wenn Selbstfertigung teurer ist als Einkauf, gewinnt Einkauf."""
    ekauf, eigen, Y, guenstig = _y_paletten(1000, 10.0, 15.0)
    assert ekauf == 10000.0
    assert eigen == 15000.0
    assert Y == 5000.0
    assert guenstig == "Einkauf"


def test_paletten_gleicher_preis_ersparnis_null():
    ekauf, eigen, Y, guenstig = _y_paletten(200, 12.0, 12.0)
    assert ekauf == eigen == 2400.0
    assert Y == 0.0
    # Bei Gleichstand geht der Default auf "Einkauf" (eigen < ekauf ist False)
    assert guenstig == "Einkauf"


def test_kombiniert_lademeter_und_paletten_netto_positiv():
    """Vollständige Rechnung: Transport per Lademeter (40 × 25 = 1 000 €)
    + Palettenkauf-Ersparnis (500 × |12.5-9| = 1 750 €).
    Netto = 1 750 − 1 000 = +750 €."""
    X = _x_lademeter(25.0, 40)
    _, _, Y, _ = _y_paletten(500, 12.5, 9.0)
    netto = Y - X
    assert X == 1000.0
    assert Y == 1750.0
    assert netto == 750.0


if __name__ == "__main__":
    tests = [test_beispiel_5_lkw_800_gegen_6000_paletten,
             test_null_lkw_ist_null_mehrkosten,
             test_mehr_lkw_als_einsparung_wird_negativ,
             test_jahreshochrechnung_pro_monat_mal_12,
             test_jahreshochrechnung_pro_quartal_mal_4,
             test_gross_realistisch_flottenkosten,
             test_lademeter_transport_40_lm_x_25_eur,
             test_lademeter_null_ist_null,
             test_paletten_einkauf_teurer_als_selbstfertigung,
             test_paletten_selbstfertigung_teurer_als_einkauf,
             test_paletten_gleicher_preis_ersparnis_null,
             test_kombiniert_lademeter_und_paletten_netto_positiv]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
            sys.exit(1)
    print(f"\n{len(tests)}/{len(tests)} Kostenanalyse-Basic-Tests bestanden.")
