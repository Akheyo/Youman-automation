"""Tests fuer zentrale Artikel-Stammdaten (Feature: Maße zentral pflegen).

Deckt §9 des Feature-Briefs ab:
  a) Maß zentral aendern -> alle Auftraege gleicher ArtikelNr zeigen neuen Wert
  b) Re-Import: manuell gepinnte Artikel bleiben unveraendert
  c) Re-Import: nicht gepinnte Artikel werden mit Excel-Werten aktualisiert
  d) 'Zurueck auf Excel-Werte' -> Flag zurueckgesetzt
  e) Migration aus auftraege.json -> keine Daten verloren, nur einmal
  f) Konsistenz: anwenden_auf_zeilen setzt korrekte mass_quelle
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
    # 3 Auftraege gleicher ArtikelNr
    for i in range(3):
        auf.neuer_auftrag(aw_nummer=f"AW-{i}", kunde="K", artikel_nummer="PSV900",
                           menge=10, angeforderte_l=900, angeforderte_b=900,
                           angeforderte_h=144)
    # Zentral aendern (manueller Pin) + auf alle propagieren
    ar.upsert("PSV900", 920, 880, 150, manuell=True, quelle="stammdaten_2")
    for a in auf.alle():
        if a["artikel_nummer"] == "PSV900":
            auf.update_auftrag(a["id"],
                                angeforderte_palette={"l": 920, "b": 880,
                                                        "h": 150})
    betroffen = ar.betroffene_auftraege("PSV900", auf)
    assert betroffen == 3, f"betroffen={betroffen}"
    for a in auf.alle():
        assert a["angeforderte_palette"]["l"] == 920
        assert a["angeforderte_palette"]["b"] == 880
    print("  a) Zentrale Aenderung propagiert auf alle 3 Auftraege OK")


def test_b_reimport_manuell_bleibt():
    _reset()
    ar.upsert("PSV900", 920, 880, 150, manuell=True, quelle="stammdaten_2")
    zeilen = [{"artikelnummer": "PSV900", "laenge": 900, "breite": 900,
               "hoehe": 144}]
    stats = ar.anwenden_auf_zeilen(zeilen)
    assert zeilen[0]["laenge"] == 920, "manuell gepinnte Masse muessen gewinnen"
    assert zeilen[0]["breite"] == 880
    assert zeilen[0]["mass_quelle"] == "manuell_gepflegt"
    assert stats["manuell"] == 1 and stats["abweichung"] == 1
    print("  b) Re-Import laesst manuell gepinnte Masse unveraendert OK")


def test_c_reimport_nicht_gepinnt_aktualisiert():
    _reset()
    ar.upsert("ART1", 800, 600, 0, manuell=False, quelle="excel_import")
    zeilen = [{"artikelnummer": "ART1", "laenge": 820, "breite": 610,
               "hoehe": 0}]
    ar.anwenden_auf_zeilen(zeilen)
    st = ar.lookup("ART1")
    assert st["laenge_mm"] == 820 and st["breite_mm"] == 610, \
        "nicht gepinnt -> Excel-Werte uebernehmen"
    assert zeilen[0]["laenge"] == 820  # Zeile unveraendert (Excel-Wert)
    print("  c) Re-Import aktualisiert nicht gepinnte Artikel OK")


def test_d_reset_auf_excel():
    _reset()
    ar.upsert("PSV900", 920, 880, 150, manuell=True, quelle="stammdaten_2")
    assert ar.lookup("PSV900")["manuell_ueberschrieben"] is True
    assert ar.setze_manuell("PSV900", False) is True
    assert ar.lookup("PSV900")["manuell_ueberschrieben"] is False
    # Nach Reset gewinnt beim Import wieder Excel
    zeilen = [{"artikelnummer": "PSV900", "laenge": 905, "breite": 905,
               "hoehe": 144}]
    ar.anwenden_auf_zeilen(zeilen)
    assert ar.lookup("PSV900")["laenge_mm"] == 905
    print("  d) 'Zurueck auf Excel' setzt Flag + Excel gewinnt wieder OK")


def test_e_migration_einmalig():
    _reset()
    for i in range(2):
        auf.neuer_auftrag(aw_nummer=f"M-{i}", kunde="K", artikel_nummer=f"A{i}",
                           menge=5, angeforderte_l=1000 + i, angeforderte_b=800,
                           angeforderte_h=0)
    # zusaetzlich ein Auftrag OHNE gueltige Masse -> wird uebersprungen
    auf.neuer_auftrag(aw_nummer="M-x", kunde="K", artikel_nummer="LEER",
                       menge=1, angeforderte_l=0, angeforderte_b=0)
    erg = ar.migration_aus_auftraege(auf)
    assert erg["migriert"] is True
    assert erg["angelegt"] == 2, f"angelegt={erg['angelegt']}"
    assert ar.lookup("A0")["laenge_mm"] == 1000
    assert ar.lookup("LEER") is None
    # Zweiter Aufruf darf NICHT erneut migrieren
    erg2 = ar.migration_aus_auftraege(auf)
    assert erg2["migriert"] is False
    print("  e) Migration laeuft genau einmal, ueberspringt leere Masse OK")


def test_f_mass_quelle_ohne_nr():
    _reset()
    zeilen = [{"artikelnummer": "", "laenge": 800, "breite": 600, "hoehe": 0},
              {"artikelnummer": "NEU1", "laenge": 700, "breite": 500,
               "hoehe": 0}]
    stats = ar.anwenden_auf_zeilen(zeilen)
    assert zeilen[0]["mass_quelle"] == "ohne_artikelnr"
    assert zeilen[1]["mass_quelle"] == "neu"
    assert stats["ohne_nr"] == 1 and stats["neu"] == 1
    print("  f) mass_quelle korrekt (ohne_artikelnr / neu) OK")


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
        test_c_reimport_nicht_gepinnt_aktualisiert,
        test_d_reset_auf_excel,
        test_e_migration_einmalig,
        test_f_mass_quelle_ohne_nr,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Artikel-Stammdaten-Tests bestanden.")
    import shutil
    shutil.rmtree(_TMP, ignore_errors=True)
    sys.exit(0 if erfolge == len(tests) else 1)
