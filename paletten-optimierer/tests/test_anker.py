"""Verifikations-Anker aus der echten Draht-Müller-Datei.

Diese Tests sind so geschrieben, dass sie GENAU die vom User
abgelesenen Werte prüfen. Wenn einer dieser Tests rot wird, ist
die Import-Pipeline kaputt — egal wie schön die anderen Tests
sind.

Struktur der Excel:
- Zeile 1: Firmenname
- Zeile 3: Metadata
- Zeile 5: Header
- Daten ab Zeile 7 mit Leerzeile zwischen jeder Datenzeile

Erwartete Werte:
- 15 Datenzeilen (Leerzeilen dazwischen NICHT mitzählen)
- Menge-Werte: 2,2,1,5,48,1,1,2,9,8,2,2,10,1,2 = Summe 96
- Auftrag 109767 (GI-RO) hat Menge=48
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from excel_handler import importiere_excel  # noqa: E402


FIXTURE = Path(__file__).resolve().parent / "fixtures" / "draht_mueller_anker.xlsx"
ERWARTETE_MENGEN = [2, 2, 1, 5, 48, 1, 1, 2, 9, 8, 2, 2, 10, 1, 2]
ERWARTETE_SUMME = sum(ERWARTETE_MENGEN)  # 96


def test_fixture_existiert():
    assert FIXTURE.exists(), f"Fixture fehlt: {FIXTURE}"


def test_genau_15_datenzeilen_keine_leerzeilen_mitgezaehlt():
    """Leerzeilen 6, 8, 10, 12, ... dürfen NICHT als Aufträge gezählt
    werden. Die Datei hat 15 echte Datenzeilen."""
    ps = importiere_excel(FIXTURE)
    assert len(ps) == 15, (
        f"Erwartet 15 Datenzeilen, bekam {len(ps)}. "
        f"Leerzeilen werden falsch mitgezählt."
    )


def test_menge_werte_in_genau_dieser_reihenfolge():
    """Die ersten 15 Aufträge haben Menge 2,2,1,5,48,1,1,2,9,8,2,2,10,1,2."""
    ps = importiere_excel(FIXTURE)
    tatsaechlich = [p.anzahl for p in ps]
    assert tatsaechlich == ERWARTETE_MENGEN, (
        f"\nErwartet: {ERWARTETE_MENGEN}\nBekommen: {tatsaechlich}"
    )


def test_summe_menge_ist_96_nicht_15():
    """Mit der ALTEN 1-pro-Auftrag-Logik kommt 15 raus. Mit der
    korrekten Menge-Logik 96."""
    ps = importiere_excel(FIXTURE)
    summe = sum(p.anzahl for p in ps)
    assert summe == ERWARTETE_SUMME, (
        f"Summe Menge erwartet {ERWARTETE_SUMME}, bekam {summe}. "
        f"Wenn ~15, greift noch die alte 1-pro-Auftrag-Logik. "
        f"Wenn ~28-30, wird P-Anzahl statt Menge gelesen."
    )


def test_giro_auftrag_109767_hat_menge_48():
    """Auftrag 109767, Kunde 'GI-RO Technik GmbH &', muss als 48 Paletten
    erfasst werden — NICHT 1 (=Datenzeile gezählt), NICHT 2 (=P-Anzahl)."""
    ps = importiere_excel(FIXTURE)
    giro = [p for p in ps if p.auftrag == "109767"]
    assert len(giro) == 1, f"Erwartet 1 GI-RO-Auftrag, bekam {len(giro)}"
    assert giro[0].anzahl == 48, (
        f"GI-RO 109767 muss Menge=48 haben (nicht 1, nicht 2). "
        f"Bekam: {giro[0].anzahl}"
    )
    assert "GI-RO" in giro[0].kunde, f"Kunde falsch: {giro[0].kunde}"


def test_diagnose_zeigt_menge_als_anzahl_quelle():
    """Beim Import muss in den Warnungen stehen, aus welcher Spalte
    die Palettenanzahl gelesen wird."""
    log: list[str] = []
    importiere_excel(FIXTURE, warnungen=log)
    anzahl_hinweise = [w for w in log if "Palettenanzahl" in w and "Menge" in w]
    assert anzahl_hinweise, (
        f"Keine Diagnose-Meldung 'Palettenanzahl … Menge' im Log. "
        f"Tatsächliche Warnungen: {log}"
    )


def test_p_anzahl_spalte_wird_ignoriert():
    """Die Fixture hat in Spalte R 'P-Anzahl' meistens 1, manche 2.
    Das darf NICHT die Palettenanzahl sein."""
    ps = importiere_excel(FIXTURE)
    # Wenn P-Anzahl statt Menge gelesen würde, hätten wir Summe ~16
    # (14× 1 + 1× 2). 16 wäre der falsche Wert.
    summe = sum(p.anzahl for p in ps)
    assert summe != 16, "Summe = 16 deutet auf P-Anzahl statt Menge hin"


def test_header_in_zeile_5_wird_erkannt():
    """Auto-Header-Detektion muss Zeile 5 finden, nicht Zeile 1
    (Firmenname) oder Zeile 3 (Metadata)."""
    ps = importiere_excel(FIXTURE)
    # Wenn das funktioniert, kommen alle Maße korrekt durch:
    erste = ps[0]
    assert erste.laenge == 1220 and erste.breite == 950, (
        f"VDL Jansen Maße falsch: {erste.laenge}×{erste.breite}"
    )
    assert erste.kunde == "VDL Jansen bv", f"Kunde falsch: {erste.kunde}"


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}:\n  {e}")
            sys.exit(1)
    print(f"\n{len(tests)} Tests bestanden.")
