"""Verifikations-Test gegen die exakt nachgebaute Draht-Müller-Datei.

Datei: tests/fixtures/draht_mueller_real.xlsx
Struktur (strikt nach User-Spec):
- Z1 A: 'Draht Müller GmbH & Co. KG'
- Z2: leer
- Z3 A: 'verplante Maschinen', K: 'Datum ...'
- Z4: leer
- Z5: Header  (A=Maschine ... I=Artikelnummer ... M=Menge ... R=P-Anzahl)
- Z6: leer
- Z7,9,11,...,35: 15 Datenzeilen mit Leerzeilen dazwischen

Geprüft wird die App-Import-Funktion ``importiere_excel``:
- Header in Datei-Zeile 5 erkannt (NICHT Zeile 1)
- Leerzeilen NICHT als Aufträge gezählt → genau 15 Datenzeilen
- Palettenanzahl pro Auftrag aus Spalte M ('Menge')
- Summe Mengen == 96
- Auftrag 109767 (GI-RO) Menge == 48 (beweist: Spalte M, nicht Spalte R)
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from excel_handler import (  # noqa: E402
    _finde_header_zeile,
    importiere_excel,
)
import openpyxl  # noqa: E402


FIXTURE = Path(__file__).resolve().parent / "fixtures" / "draht_mueller_real.xlsx"


def _lade_rohzeilen():
    wb = openpyxl.load_workbook(FIXTURE, data_only=True, read_only=True)
    ws = wb.active
    return list(ws.iter_rows(values_only=True))


def test_fixture_existiert():
    assert FIXTURE.exists(), f"Fixture fehlt: {FIXTURE}"


def test_header_wird_in_datei_zeile_5_erkannt():
    """Header darf NICHT in Z1 erkannt werden — dort steht der Firmenname.
    Korrekt ist Z5."""
    rows = _lade_rohzeilen()
    header_idx, mapping, header = _finde_header_zeile(rows)
    # header_idx ist 0-basiert → Datei-Zeile = header_idx + 1
    assert header_idx == 4, (
        f"Header in Datei-Zeile {header_idx + 1} erkannt, erwartet Zeile 5. "
        f"Gefundener Header: {[h for h in header if h]}"
    )
    assert "Menge" in header, f"'Menge' fehlt im erkannten Header: {header}"
    assert "Artikelnummer" in header, f"'Artikelnummer' fehlt: {header}"


def test_menge_kommt_aus_spalte_M():
    """Die Palettenanzahl muss aus Spalte M (Index 12 0-basiert) kommen,
    NICHT aus Spalte R ('P-Anzahl')."""
    rows = _lade_rohzeilen()
    _, mapping, header = _finde_header_zeile(rows)
    assert "anzahl" in mapping, f"Kein Mapping für Palettenanzahl. Header: {header}"
    spalten_idx = mapping["anzahl"]
    # Spalte M = Index 12 (0-basiert)
    assert spalten_idx == 12, (
        f"Palettenanzahl wird aus Spalte-Index {spalten_idx} gelesen "
        f"(= '{header[spalten_idx]}'), erwartet Index 12 ('Menge')."
    )
    assert header[spalten_idx] == "Menge", (
        f"Spalte M heißt '{header[spalten_idx]}', erwartet 'Menge'."
    )


def test_leerzeilen_werden_nicht_als_auftraege_gezaehlt():
    """Datei hat 35 Excel-Zeilen, davon nur 15 echte Datenzeilen.
    Leerzeilen (Z6, Z8, Z10, ..., Z34) dürfen NICHT als Aufträge zählen."""
    paletten = importiere_excel(FIXTURE)
    assert len(paletten) == 15, (
        f"Erwartet 15 Datenzeilen, bekam {len(paletten)}. "
        f"Leerzeilen werden falsch mitgezählt."
    )


def test_summe_menge_ist_genau_96():
    """HARTER ANKER: Summe der 15 Mengen muss exakt 96 sein.
    Mengen: 2,2,1,5,48,1,1,2,9,8,2,2,10,1,2 = 96."""
    paletten = importiere_excel(FIXTURE)
    summe = sum(p.anzahl for p in paletten)
    erwartet = 96
    print(f"\n  → Summe Menge (alle 15): {summe} (erwartet {erwartet})")
    print(f"  → Mengen-Werte: {[p.anzahl for p in paletten]}")
    assert summe == erwartet, (
        f"Summe Menge = {summe}, erwartet {erwartet}. "
        f"Tatsächliche Mengen: {[p.anzahl for p in paletten]}"
    )


def test_giro_109767_hat_menge_48():
    """HARTER ANKER: Auftrag 109767 (GI-RO Technik) muss anzahl=48 haben.
    NICHT 1 (wäre P-Anzahl-Bug aus Spalte R), NICHT 2 (wäre P-Anzahl=2)."""
    paletten = importiere_excel(FIXTURE)
    giro = [p for p in paletten if p.auftrag == "109767"]
    assert len(giro) == 1, (
        f"GI-RO 109767 nicht eindeutig gefunden: {len(giro)} Treffer"
    )
    p = giro[0]
    print(f"\n  → GI-RO 109767: anzahl={p.anzahl}, artikel={p.artikelnummer!r}")
    assert p.anzahl == 48, (
        f"GI-RO 109767 anzahl = {p.anzahl}, erwartet 48. "
        f"(anzahl=1 hieße: Spalte R falsch gemappt; anzahl=2 hieße: P-Anzahl statt Menge)"
    )


def test_diagnose_meldet_menge_als_palettenanzahl_quelle():
    """Diagnose-Hinweis muss explizit 'Menge' als gemappte Spalte nennen."""
    warnungen: list[str] = []
    importiere_excel(FIXTURE, warnungen=warnungen)
    hits = [w for w in warnungen if "Menge" in w and "Palettenanzahl" in w]
    assert hits, (
        f"Kein Diagnose-Hinweis zu Menge als Palettenanzahl-Quelle. "
        f"Vorhandene Meldungen: {warnungen}"
    )


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
        return False


if __name__ == "__main__":
    tests = [
        test_fixture_existiert,
        test_header_wird_in_datei_zeile_5_erkannt,
        test_menge_kommt_aus_spalte_M,
        test_leerzeilen_werden_nicht_als_auftraege_gezaehlt,
        test_summe_menge_ist_genau_96,
        test_giro_109767_hat_menge_48,
        test_diagnose_meldet_menge_als_palettenanzahl_quelle,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print("="*60)
    print(f"{erfolge}/{len(tests)} Tests bestanden.")
    print("="*60)
    sys.exit(0 if erfolge == len(tests) else 1)
