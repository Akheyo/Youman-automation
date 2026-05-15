"""Tests für orientierungs-unabhängige Palettenmaße.

Bug-Fix: 800×1200 und 1200×800 sind physisch dieselbe Palette und
müssen unter einem Standard landen — nicht in zwei getrennten.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Repo-Root in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from optimizer import Palette, optimiere  # noqa: E402


def test_palette_normalisiert_orientierung():
    """Beim Konstruieren wird die lange Seite immer laenge."""
    p1 = Palette("A", 800, 1200, 1)
    p2 = Palette("B", 1200, 800, 1)
    assert p1.laenge == 1200 and p1.breite == 800
    assert p2.laenge == 1200 and p2.breite == 800
    # Original-Schreibweise bleibt erhalten
    assert p1.laenge_original == 800 and p1.breite_original == 1200
    assert p2.laenge_original == 1200 and p2.breite_original == 800


def test_zwei_orientierungen_landen_in_einem_standard():
    """Kern-Bug: 800×1200 und 1200×800 → ein Cluster."""
    paletten = [
        Palette("A", 800, 1200, 5),
        Palette("B", 1200, 800, 7),
    ]
    erg = optimiere(paletten, 0, 0, "mm", raster=0)
    assert erg.anzahl_standards == 1, (
        f"Erwartet 1 Standard, bekam {erg.anzahl_standards}: "
        f"{[s.label for s in erg.standards]}"
    )
    std = erg.standards[0]
    assert len(std.members) == 2
    assert std.laenge == 1200 and std.breite == 800


def test_orientierungen_mit_unterschiedlicher_hoehe_bleiben_getrennt():
    """Wenn Höhe aktiv ist und unterschiedlich → zwei Standards."""
    paletten = [
        Palette("A", 800, 1200, 5, hoehe=900),
        Palette("B", 1200, 900, 7, hoehe=1500),
    ]
    erg = optimiere(
        paletten, 0, 0, "mm", raster=0,
        hoehe_aktiv=True, toleranz_h=0,
    )
    assert erg.anzahl_standards == 2


def test_anzeige_zeigt_original_masse():
    """Die normalisierten Maße sind im Algorithmus, Original-Maße bleiben
    für die UI verfügbar."""
    p = Palette("X", 800, 1200, 1)
    assert p.laenge == 1200  # kanonisch
    assert p.laenge_original == 800  # für UI
    assert p.breite == 800
    assert p.breite_original == 1200


def test_deterministisches_ergebnis_bei_unterschiedlicher_reihenfolge():
    """Set Cover muss bei gleicher Eingabe das gleiche Ergebnis liefern,
    egal in welcher Reihenfolge die Paletten reinkommen."""
    basis = [
        Palette("A", 1200, 800, 3),
        Palette("B", 800, 1200, 3),
        Palette("C", 1500, 900, 3),
        Palette("D", 900, 1500, 3),
        Palette("E", 600, 1000, 3),
    ]
    erg1 = optimiere(basis, 50, 50, "mm", raster=0)
    erg2 = optimiere(list(reversed(basis)), 50, 50, "mm", raster=0)
    sig1 = sorted((s.laenge, s.breite, len(s.members)) for s in erg1.standards)
    sig2 = sorted((s.laenge, s.breite, len(s.members)) for s in erg2.standards)
    assert sig1 == sig2, f"Nicht-deterministisch: {sig1} vs {sig2}"


if __name__ == "__main__":
    tests = [
        test_palette_normalisiert_orientierung,
        test_zwei_orientierungen_landen_in_einem_standard,
        test_orientierungen_mit_unterschiedlicher_hoehe_bleiben_getrennt,
        test_anzeige_zeigt_original_masse,
        test_deterministisches_ergebnis_bei_unterschiedlicher_reihenfolge,
    ]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
            sys.exit(1)
    print(f"\n{len(tests)} Tests bestanden.")
