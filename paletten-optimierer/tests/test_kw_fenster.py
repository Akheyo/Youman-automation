"""A4: KW-Fenster-Filter fuer Bestellungen.

Die Filterlogik aus app.py::_im_kw_fenster wird 1:1 nachgebaut und
mit synthetischen Bestellungen ueber 52 KW getestet.

Erwartung: Bei Start-KW 30 + Vorlauf 4 landen nur Bestellungen mit
datum_erstellt in KW 30..33 in der Liste.
"""
from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))
sys.path.insert(0, str(HIER))


def _im_kw_fenster(a: dict, kw_filter_aktiv: bool,
                    start_kw: int, vorlauf: int) -> bool:
    """Kopie der Logik aus app.py; falls die App-Version geaendert
    wird, muss dieser Test angepasst werden."""
    if not kw_filter_aktiv:
        return True
    d = a.get("datum_erstellt", "")
    if not d:
        return True
    try:
        iso = date.fromisoformat(d[:10])
    except ValueError:
        return True
    kw = iso.isocalendar()[1]
    ende = start_kw + max(1, int(vorlauf)) - 1
    return start_kw <= kw <= ende


def _synth_bestellungen() -> list[dict]:
    """52 Bestellungen, eine je KW im Jahr 2026."""
    ergebnis: list[dict] = []
    for kw in range(1, 53):
        # ISO-KW: Woche 1 = die mit dem ersten Donnerstag des Jahres
        d = date.fromisocalendar(2026, kw, 3)  # Mittwoch der KW
        ergebnis.append({"id": f"BST-{kw:02d}",
                          "datum_erstellt": d.isoformat()})
    return ergebnis


def test_filter_kw30_plus4_liefert_kw30_bis_33():
    """Start-KW 30 + Vorlauf 4 -> KW 30, 31, 32, 33 (inklusive Ende)."""
    alle = _synth_bestellungen()
    treffer = [a for a in alle if _im_kw_fenster(a, True, 30, 4)]
    kws = [date.fromisoformat(a["datum_erstellt"]).isocalendar()[1]
           for a in treffer]
    assert kws == [30, 31, 32, 33], (
        f"Erwartet [30,31,32,33], bekam {kws}"
    )


def test_filter_ausgeschaltet_liefert_alle():
    alle = _synth_bestellungen()
    treffer = [a for a in alle if _im_kw_fenster(a, False, 30, 4)]
    assert len(treffer) == 52


def test_vorlauf_null_liefert_nur_start_kw():
    """Vorlauf 0 wird zu 1 (max(1, 0)) -> nur die Start-KW."""
    alle = _synth_bestellungen()
    treffer = [a for a in alle if _im_kw_fenster(a, True, 40, 0)]
    kws = [date.fromisoformat(a["datum_erstellt"]).isocalendar()[1]
           for a in treffer]
    assert kws == [40], f"Erwartet [40], bekam {kws}"


def test_kaputtes_datum_wird_defensiv_durchgelassen():
    """Ein unlesbares datum_erstellt fuehrt NICHT zu Crash — der Eintrag
    bleibt drin (bewusst konservativ, damit Alt-Daten sichtbar bleiben)."""
    bestellung = {"id": "BST-BAD", "datum_erstellt": "kein-datum"}
    assert _im_kw_fenster(bestellung, True, 10, 4)


def test_leeres_datum_wird_defensiv_durchgelassen():
    bestellung = {"id": "BST-EMPTY", "datum_erstellt": ""}
    assert _im_kw_fenster(bestellung, True, 10, 4)


if __name__ == "__main__":
    tests = [test_filter_kw30_plus4_liefert_kw30_bis_33,
             test_filter_ausgeschaltet_liefert_alle,
             test_vorlauf_null_liefert_nur_start_kw,
             test_kaputtes_datum_wird_defensiv_durchgelassen,
             test_leeres_datum_wird_defensiv_durchgelassen]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
            sys.exit(1)
    print(f"\n{len(tests)}/{len(tests)} KW-Fenster-Tests bestanden.")
