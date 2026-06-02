"""Tests fuer zentrale Artikel-Stammdaten + Maße-Pruef-Gate.

Deckt ab:
  a) Maß zentral aendern -> alle Auftraege gleicher ArtikelNr neuer Wert
  b) Re-Import: manuell gepinnt bleibt (🔒), kein Gate noetig
  c) Re-Import abweichend: NICHT ueberschrieben, Gate-Status 'abweichend'
  d) 'Zurueck auf Excel' -> Flag zurueck, danach abweichend->Gate
  e) Migration aus auftraege.json -> nur einmal, leere Maße uebersprungen
  f) Status 'neu' + ohne ArtNr nicht gate-pflichtig, nichts vorzeitig gespeichert
  g) bekannt & identisch -> Status 'ok', keine offene Pruefung
"""
from __future__ import annotations

import io
import os
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8",
                                   errors="replace")

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

_TMP = tempfile.mkdtemp(prefix="artikel_test_")
os.environ["PALETTENMINI_ARTIKEL"] = os.path.join(_TMP, "artikel.json")
os.environ["PALETTENMINI_AUFTRAEGE"] = os.path.join(_TMP, "auftraege.json")

import artikel_stammdaten as ar  # noqa: E402
import auftraege as auf  # noqa: E402


def _reset():
    for f in ("artikel.json", "auftraege.json"):
        p = Path(_TMP) / f
        if p.exists():
            p.unlink()


def test_a_zentrale_aenderung_propagiert():
    _reset()
    for i in range(3):
        auf.neuer_auftrag(aw_nummer=f"AW-{i}", kunde="K", artikel_nummer="PSV900",
                           menge=10, angeforderte_l=900, angeforderte_b=900,
                           angeforderte_h=144)
    ar.upsert("PSV900", 920, 880, 150, manuell=True, quelle="stammdaten_2")
    for a in auf.alle():
        if a["artikel_nummer"] == "PSV900":
            auf.update_auftrag(a["id"],
                                angeforderte_palette={"l": 920, "b": 880,
                                                        "h": 150})
    assert ar.betroffene_auftraege("PSV900", auf) == 3
    for a in auf.alle():
        assert a["angeforderte_palette"]["l"] == 920
    print("  a) Zentrale Aenderung propagiert auf alle 3 Auftraege OK")


def test_b_reimport_manuell_bleibt():
    _reset()
    ar.upsert("PSV900", 920, 880, 150, manuell=True, quelle="stammdaten_2")
    zeilen = [{"artikelnummer": "PSV900", "laenge": 900, "breite": 900,
               "hoehe": 144}]
    info = ar.analysiere_import(zeilen)
    assert zeilen[0]["laenge"] == 920 and zeilen[0]["breite"] == 880
    assert info["PSV900"]["status"] == ar.STATUS_MANUELL
    assert ar.offene_pruefungen(info) == []
    print("  b) Manuell gepinnt: Excel ignoriert, kein Gate OK")


def test_c_reimport_abweichend_nicht_ueberschrieben():
    _reset()
    ar.upsert("ART1", 800, 600, 0, manuell=False, quelle="excel_import")
    zeilen = [{"artikelnummer": "ART1", "laenge": 820, "breite": 610,
               "hoehe": 0}]
    info = ar.analysiere_import(zeilen)
    assert info["ART1"]["status"] == ar.STATUS_ABWEICHEND
    assert ar.lookup("ART1")["laenge_mm"] == 800, "darf NICHT ueberschrieben sein"
    assert zeilen[0]["laenge"] == 820, "Zeile behaelt Excel bis Bestaetigung"
    assert ar.offene_pruefungen(info) == ["ART1"]
    # Gate-Bestaetigung (Excel uebernehmen) = upsert
    ar.upsert("ART1", 820, 610, 0, manuell=False, quelle="masse_gate")
    info2 = ar.analysiere_import([{"artikelnummer": "ART1", "laenge": 820,
                                    "breite": 610, "hoehe": 0}])
    assert info2["ART1"]["status"] == ar.STATUS_OK
    print("  c) Abweichend: nicht ueberschrieben, nach Bestaetigung ok OK")


def test_d_reset_auf_excel():
    _reset()
    ar.upsert("PSV900", 920, 880, 150, manuell=True, quelle="stammdaten_2")
    assert ar.lookup("PSV900")["manuell_ueberschrieben"] is True
    assert ar.setze_manuell("PSV900", False) is True
    assert ar.lookup("PSV900")["manuell_ueberschrieben"] is False
    info = ar.analysiere_import([{"artikelnummer": "PSV900", "laenge": 905,
                                   "breite": 905, "hoehe": 144}])
    assert info["PSV900"]["status"] == ar.STATUS_ABWEICHEND
    print("  d) Reset entfernt Pin -> Excel wird wieder gate-pflichtig OK")


def test_e_migration_einmalig():
    _reset()
    for i in range(2):
        auf.neuer_auftrag(aw_nummer=f"M-{i}", kunde="K", artikel_nummer=f"A{i}",
                           menge=5, angeforderte_l=1000 + i, angeforderte_b=800,
                           angeforderte_h=0)
    auf.neuer_auftrag(aw_nummer="M-x", kunde="K", artikel_nummer="LEER",
                       menge=1, angeforderte_l=0, angeforderte_b=0)
    erg = ar.migration_aus_auftraege(auf)
    assert erg["migriert"] is True and erg["angelegt"] == 2
    assert ar.lookup("A0")["laenge_mm"] == 1000
    assert ar.lookup("LEER") is None
    assert ar.migration_aus_auftraege(auf)["migriert"] is False
    print("  e) Migration einmalig, leere Maße uebersprungen OK")


def test_f_status_neu_und_ohne_nr():
    _reset()
    zeilen = [{"artikelnummer": "", "laenge": 800, "breite": 600, "hoehe": 0},
              {"artikelnummer": "NEU1", "laenge": 700, "breite": 500,
               "hoehe": 0}]
    info = ar.analysiere_import(zeilen)
    assert zeilen[0]["mass_status"] == ar.STATUS_OK
    assert info["NEU1"]["status"] == ar.STATUS_NEU
    assert ar.lookup("NEU1") is None, "neu darf NICHT vorzeitig gespeichert sein"
    assert ar.offene_pruefungen(info) == ["NEU1"]
    print("  f) Status 'neu' + ohne ArtNr nicht gate-pflichtig OK")


def test_g_identisch_ok():
    _reset()
    ar.upsert("ART2", 1200, 800, 0, manuell=False, quelle="excel_import")
    info = ar.analysiere_import([{"artikelnummer": "ART2", "laenge": 1200,
                                   "breite": 800, "hoehe": 0}])
    assert info["ART2"]["status"] == ar.STATUS_OK
    assert ar.offene_pruefungen(info) == []
    print("  g) Bekannt & identisch -> ok, keine Pruefung OK")


def _run(fn):
    try:
        fn()
        print(f"OK  {fn.__name__}")
        return True
    except AssertionError as e:
        print(f"FAIL {fn.__name__}: {e}")
        return False
    except Exception as e:  # noqa: BLE001
        print(f"ERR  {fn.__name__}: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    tests = [
        test_a_zentrale_aenderung_propagiert,
        test_b_reimport_manuell_bleibt,
        test_c_reimport_abweichend_nicht_ueberschrieben,
        test_d_reset_auf_excel,
        test_e_migration_einmalig,
        test_f_status_neu_und_ohne_nr,
        test_g_identisch_ok,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Artikel-Stammdaten-Tests bestanden.")
    import shutil
    shutil.rmtree(_TMP, ignore_errors=True)
    sys.exit(0 if erfolge == len(tests) else 1)
