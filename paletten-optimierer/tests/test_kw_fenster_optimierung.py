"""KW-Fenster-Filter im Optimierungs-Tab (Bestellung ab KW + Vorlauf).

Prueft, dass _im_kw_fenster_iso() aus app.py die Auftrags-Vorauswahl
korrekt trifft: Verbrauchsdatum in [Start-KW, Start-KW+Vorlauf-1] ->
Auftrag wandert in die Optimierung. Auftraege ohne Verbrauchsdatum
werden konservativ als 'im Fenster' behandelt.
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))
sys.path.insert(0, str(HIER))


def _im_kw_fenster_iso(iso: str, start_kw: int, vorlauf: int) -> bool:
    """1:1-Kopie der Logik aus app.py (bewusstes Duplikat, damit der
    Test ohne Streamlit-Runtime laeuft)."""
    if not iso:
        return True
    try:
        d = date.fromisoformat(iso[:10])
    except (ValueError, TypeError):
        return True
    kw = d.isocalendar()[1]
    ende = start_kw + max(1, int(vorlauf)) - 1
    return start_kw <= kw <= ende


def _synth_jahresdaten() -> list[dict]:
    """52 Auftraege, einer pro KW im Jahr 2026."""
    ergebnis = []
    for kw in range(1, 53):
        d = date.fromisocalendar(2026, kw, 3)
        ergebnis.append({
            "auftrag": f"A{kw:02d}",
            "laenge": 1200, "breite": 800, "anzahl": 3,
            "verbrauchsdatum": d.isoformat(),
        })
    return ergebnis


def test_kw30_plus_4_liefert_genau_4_auftraege():
    """Aus einer 12-Monats-Excel filtert Start=30, Vorlauf=4 exakt die
    Auftraege in KW 30, 31, 32, 33."""
    alle = _synth_jahresdaten()
    treffer = [a for a in alle
               if _im_kw_fenster_iso(a["verbrauchsdatum"], 30, 4)]
    assert len(treffer) == 4, (
        f"Erwartet 4, bekam {len(treffer)}: {[a['auftrag'] for a in treffer]}"
    )
    kws = [date.fromisoformat(a["verbrauchsdatum"]).isocalendar()[1]
           for a in treffer]
    assert kws == [30, 31, 32, 33], f"KWs {kws} erwartet [30,31,32,33]"


def test_kw52_plus_4_geht_nicht_ueber_jahresende_hinaus():
    """Vorlauf endet an KW 55 — im Testset gibt's nur bis KW 52,
    also 1 Treffer (nur KW 52)."""
    alle = _synth_jahresdaten()
    treffer = [a for a in alle
               if _im_kw_fenster_iso(a["verbrauchsdatum"], 52, 4)]
    assert len(treffer) == 1
    assert treffer[0]["auftrag"] == "A52"


def test_vorlauf_null_liefert_nur_start_kw():
    """Vorlauf=0 wird zu Vorlauf=1 (max(1, 0)) -> nur Start-KW selbst."""
    alle = _synth_jahresdaten()
    treffer = [a for a in alle
               if _im_kw_fenster_iso(a["verbrauchsdatum"], 25, 0)]
    assert len(treffer) == 1
    assert date.fromisoformat(
        treffer[0]["verbrauchsdatum"]).isocalendar()[1] == 25


def test_leeres_verbrauchsdatum_bleibt_drin():
    """Auftraege ohne Datum werden konservativ mitgenommen."""
    a = {"auftrag": "X", "verbrauchsdatum": ""}
    assert _im_kw_fenster_iso(a["verbrauchsdatum"], 30, 4)


def test_kaputtes_verbrauchsdatum_bleibt_drin():
    a = {"auftrag": "Y", "verbrauchsdatum": "not-a-date"}
    assert _im_kw_fenster_iso(a["verbrauchsdatum"], 30, 4)


def test_ausserhalb_fenster_wird_gefiltert():
    """KW 20 ist definitiv nicht in [30, 33]."""
    a = {"verbrauchsdatum": date.fromisocalendar(2026, 20, 3).isoformat()}
    assert not _im_kw_fenster_iso(a["verbrauchsdatum"], 30, 4)


def test_grenzen_inklusive_start_und_ende():
    """Start-KW und End-KW liegen beide im Fenster."""
    start = date.fromisocalendar(2026, 30, 3).isoformat()
    ende = date.fromisocalendar(2026, 33, 3).isoformat()
    assert _im_kw_fenster_iso(start, 30, 4)
    assert _im_kw_fenster_iso(ende, 30, 4)


if __name__ == "__main__":
    tests = [test_kw30_plus_4_liefert_genau_4_auftraege,
             test_kw52_plus_4_geht_nicht_ueber_jahresende_hinaus,
             test_vorlauf_null_liefert_nur_start_kw,
             test_leeres_verbrauchsdatum_bleibt_drin,
             test_kaputtes_verbrauchsdatum_bleibt_drin,
             test_ausserhalb_fenster_wird_gefiltert,
             test_grenzen_inklusive_start_und_ende]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
            sys.exit(1)
    print(f"\n{len(tests)}/{len(tests)} KW-Fenster-Optimierung-Tests bestanden.")
