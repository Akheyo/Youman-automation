"""Tests für die korrekte Behandlung der P-Anzahl-Spalte beim Import
und in der Optimierung.

Bug: P-Anzahl (Anzahl Paletten pro Auftrag) wurde nicht summiert,
sondern jede Auftragsposition als 1 gezählt.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import openpyxl  # noqa: E402

from excel_handler import importiere_excel  # noqa: E402
from optimizer import Palette, optimiere  # noqa: E402


def _build_excel(rows: list[dict]) -> io.BytesIO:
    """Helfer: baut eine Excel-Datei mit dem Draht-Müller-Layout (1 Sheet,
    Header in Zeile 1) im Speicher."""
    wb = openpyxl.Workbook()
    ws = wb.active
    header = ["Artikelnummer", "P-Länge", "P-Breite", "P-Höhe",
              "Menge", "Stck Pal", "P-Anzahl", "Name", "Auftrag"]
    ws.append(header)
    for r in rows:
        ws.append([
            r.get("artikel", ""),
            r.get("laenge", 0),
            r.get("breite", 0),
            r.get("hoehe", ""),
            r.get("menge", ""),
            r.get("stk_pal", ""),
            r.get("p_anzahl", ""),
            r.get("kunde", ""),
            r.get("auftrag", ""),
        ])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def test_p_anzahl_wird_korrekt_gelesen():
    """Summe P-Anzahl in der gelesenen Liste = Summe der Excel-Werte."""
    rows = [
        {"artikel": "A1", "laenge": 1200, "breite": 800, "menge": 350, "stk_pal": 350, "p_anzahl": 1},
        {"artikel": "A2", "laenge": 1200, "breite": 800, "menge": 700, "stk_pal": 350, "p_anzahl": 2},
        {"artikel": "A3", "laenge": 1200, "breite": 800, "menge": 1750, "stk_pal": 350, "p_anzahl": 5},
        {"artikel": "A4", "laenge": 1500, "breite": 900, "menge": 200, "stk_pal": 100, "p_anzahl": 2},
    ]
    paletten = importiere_excel(_build_excel(rows))
    assert len(paletten) == 4
    assert sum(p.anzahl for p in paletten) == 10, (
        f"Erwartet Summe 10, bekam {sum(p.anzahl for p in paletten)}"
    )


def test_spec_beispiel_menge_48_stk_38_p_anzahl_2():
    """Auftrag aus der Spec: Menge=48, Stck Pal=38, P-Anzahl=2 → 2."""
    paletten = importiere_excel(_build_excel([
        {"artikel": "EWM822x880", "laenge": 910, "breite": 850,
         "menge": 48, "stk_pal": 38, "p_anzahl": 2},
    ]))
    assert paletten[0].anzahl == 2


def test_leere_p_anzahl_fallback_auf_menge_durch_stk_pal():
    """Leere P-Anzahl → ceil(menge/stk_pal) + Warnung im Log."""
    log: list[str] = []
    paletten = importiere_excel(_build_excel([
        {"artikel": "X", "laenge": 1200, "breite": 800,
         "menge": 700, "stk_pal": 350},  # p_anzahl leer
    ]), warnungen=log)
    assert paletten[0].anzahl == 2, f"Erwartet 2, bekam {paletten[0].anzahl}"
    assert any("Fallback" in w for w in log), f"Keine Fallback-Warnung im Log: {log}"


def test_leere_p_anzahl_mit_aufrundung():
    """Menge=750, Stk_Pal=350 → ceil = 3 (nicht 2.14)."""
    paletten = importiere_excel(_build_excel([
        {"artikel": "X", "laenge": 1200, "breite": 800,
         "menge": 750, "stk_pal": 350},
    ]))
    assert paletten[0].anzahl == 3


def test_unplausible_p_anzahl_warnung_aber_excel_wird_verwendet():
    """Menge=2, Stk Pal=350, P-Anzahl=10 → 10 wird verwendet + Warnung."""
    log: list[str] = []
    paletten = importiere_excel(_build_excel([
        {"artikel": "X", "laenge": 1200, "breite": 800,
         "menge": 2, "stk_pal": 350, "p_anzahl": 10, "auftrag": "110999"},
    ]), warnungen=log)
    assert paletten[0].anzahl == 10, (
        f"Excel-Wert muss vorrangig sein, bekam {paletten[0].anzahl}"
    )
    assert any("Plausibilität" in w and "110999" in w for w in log), (
        f"Keine Plausibilitäts-Warnung mit Auftragsnummer: {log}"
    )


def test_set_cover_gewichtet_nach_p_anzahl():
    """Ein Auftrag mit P-Anzahl=500 schlägt 5 Aufträge mit je P-Anzahl=1."""
    paletten = [
        Palette("BIG",  800, 1200, anzahl=500),
        Palette("S1", 1000,  800, anzahl=1),
        Palette("S2", 1000,  800, anzahl=1),
        Palette("S3", 1000,  800, anzahl=1),
        Palette("S4", 1000,  800, anzahl=1),
        Palette("S5", 1000,  800, anzahl=1),
    ]
    # Bei 0 Toleranz bleiben zwei Cluster (1200x800 und 1000x800)
    erg = optimiere(paletten, 0, 0, "mm", raster=0)
    assert erg.anzahl_standards == 2
    sortiert = sorted(erg.standards, key=lambda s: -s.gesamt_anzahl)
    top = sortiert[0]
    assert top.gesamt_anzahl == 500
    assert top.members[0].artikelnummer == "BIG"


def test_mengen_schwelle_nutzt_gesamt_anzahl():
    """Schwelle bezieht sich auf Summe P-Anzahl, nicht Anzahl Aufträge."""
    paletten = [
        # 3 Aufträge mit gleichem Maß, gesamt P-Anzahl = 6
        Palette("A1", 1200, 800, anzahl=2),
        Palette("A2", 1200, 800, anzahl=2),
        Palette("A3", 1200, 800, anzahl=2),
        # 1 Auftrag mit eigenem Maß, P-Anzahl = 1
        Palette("B1", 1500, 900, anzahl=1),
    ]
    # Schwelle 3: 1200×800 hat gesamt 6 → bleibt Standard
    #             1500×900 hat gesamt 1 → wird Sonderpalette
    erg = optimiere(paletten, 0, 0, "mm", raster=0, mengen_schwelle=3)
    assert erg.anzahl_standards == 1
    assert erg.anzahl_sonder == 1
    assert erg.standards[0].gesamt_anzahl == 6


if __name__ == "__main__":
    tests = [
        test_p_anzahl_wird_korrekt_gelesen,
        test_spec_beispiel_menge_48_stk_38_p_anzahl_2,
        test_leere_p_anzahl_fallback_auf_menge_durch_stk_pal,
        test_leere_p_anzahl_mit_aufrundung,
        test_unplausible_p_anzahl_warnung_aber_excel_wird_verwendet,
        test_set_cover_gewichtet_nach_p_anzahl,
        test_mengen_schwelle_nutzt_gesamt_anzahl,
    ]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
            sys.exit(1)
    print(f"\n{len(tests)} Tests bestanden.")
