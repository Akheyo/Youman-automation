"""Tests fuer Bestellungs-Historie (Spec §7).

a) Schema-Felder werden persistiert
b) Status-Wechsel (offen → verbraucht → storniert)
c) Snapshot bleibt erhalten wenn Palette geloescht
d) Atomare Transaktion: Bestand + Verbrauch + Historie in einem Rutsch
e) Rollback bei Fehler (palette_id existiert nicht)
f) CSV-Export Roundtrip-ready
g) korrupte JSON → kein Crash
h) offene()/verbraucht()/aktive() filtern korrekt
"""
from __future__ import annotations

import io
import os
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

# Isolierte Test-Pfade VOR Modul-Import
_TMP_KAT = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
_TMP_KAT.close()
_TMP_BES = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
_TMP_BES.close()
os.environ["PALETTENMINI_KATALOG"] = _TMP_KAT.name
os.environ["PALETTENMINI_BESTELLUNGEN"] = _TMP_BES.name

import palettenkatalog as kat  # noqa: E402
import bestellungen as bes  # noqa: E402


def _reset():
    for p in (_TMP_KAT, _TMP_BES):
        path = Path(p.name)
        if path.exists():
            path.unlink()


def test_a_schema_persistiert():
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0, bestand=100,
                              name="Euro", hoehe_mm=144)
    bid = bes.neue_bestellung(
        palette_id=pid,
        palette_typ_snapshot={"name": "Euro", "L_mm": 1200,
                                "B_mm": 800, "hoehe_mm": 144},
        menge=5,
        kunde="Müller",
        artikelnummer="ART-001",
        auftragsnummer_aw="AW-2026-001",
        geplantes_verbrauchsdatum="2026-06-15",
    )
    e = next(x for x in bes.alle() if x["id"] == bid)
    assert e["menge"] == 5
    assert e["kunde"] == "Müller"
    assert e["auftragsnummer_aw"] == "AW-2026-001"
    assert e["status"] == "offen"
    assert e["palette_typ_snapshot"]["name"] == "Euro"
    print(f"  Schema OK: AW={e['auftragsnummer_aw']}, "
          f"Kunde={e['kunde']}, status={e['status']}")


def test_b_status_wechsel():
    _reset()
    bid = bes.neue_bestellung(
        palette_id=None,
        palette_typ_snapshot={"name": "X", "L_mm": 1200, "B_mm": 800,
                                "hoehe_mm": 0},
        menge=1,
        auftragsnummer_aw="AW-X",
        artikelnummer="X",
    )
    assert bes.update_status(bid, "verbraucht") is True
    assert next(x for x in bes.alle() if x["id"] == bid)["status"] == "verbraucht"
    assert bes.update_status(bid, "storniert") is True
    assert next(x for x in bes.alle() if x["id"] == bid)["status"] == "storniert"
    # ungueltiger Status
    assert bes.update_status(bid, "foo") is False
    print(f"  Status-Wechsel: offen → verbraucht → storniert")


def test_c_snapshot_bleibt_nach_palette_loesch():
    """Spec §14: Historie-Eintrag mit fehlender Palette zeigt Snapshot."""
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 0, 0, name="Snap-Test")
    bid = bes.neue_bestellung(
        palette_id=pid,
        palette_typ_snapshot={"name": "Snap-Test", "L_mm": 1200,
                                "B_mm": 800, "hoehe_mm": 0},
        menge=3, auftragsnummer_aw="AW", artikelnummer="A",
    )
    # Palette loeschen
    kat.loesche_eintrag(pid)
    # Snapshot bleibt
    e = next(x for x in bes.alle() if x["id"] == bid)
    assert e["palette_typ_snapshot"]["name"] == "Snap-Test"
    assert e["palette_typ_snapshot"]["L_mm"] == 1200
    print(f"  Snapshot bleibt nach Palette-Loesch erhalten.")


def test_d_atomare_transaktion():
    """Atomarer Klick auf 'Bestellung getätigt' = Bestand − Menge,
    Verbrauch += 1, Historie += 1."""
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0, bestand=50,
                              name="Atomic", verbrauchshaeufigkeit=2)
    erg = bes.bestellung_atomar(
        katalog_modul=kat, palette_id=pid, menge=10,
        kunde="K1", artikelnummer="A1", auftragsnummer_aw="AW-1",
    )
    assert erg["ok"] is True, erg["fehler"]
    e_kat = next(x for x in kat.alle() if x["id"] == pid)
    assert e_kat["bestand"] == 40
    assert e_kat["verbrauchshaeufigkeit"] == 3
    e_bes = next(x for x in bes.alle() if x["id"] == erg["bestellung_id"])
    assert e_bes["menge"] == 10
    print(f"  Atomar: Bestand 50→40, Verbrauch 2→3, Historie +1.")


def test_e_rollback_bei_unbekannter_palette():
    """Falls palette_id nicht existiert: kein Bestand-Update,
    kein Historie-Eintrag, kein Crash."""
    _reset()
    n_vorher = len(bes.alle())
    erg = bes.bestellung_atomar(
        katalog_modul=kat, palette_id="non-existent", menge=5,
        kunde="K", artikelnummer="A", auftragsnummer_aw="AW",
    )
    assert erg["ok"] is False
    assert "nicht im Katalog" in erg["fehler"]
    n_nachher = len(bes.alle())
    assert n_nachher == n_vorher, "Kein Historie-Eintrag bei Fehler"
    print(f"  Rollback OK: {erg['fehler']}")


def test_f_csv_export():
    _reset()
    bes.neue_bestellung(
        palette_id=None,
        palette_typ_snapshot={"name": "P1", "L_mm": 1200, "B_mm": 800,
                                "hoehe_mm": 0},
        menge=7, kunde="Müller", artikelnummer="A-1",
        auftragsnummer_aw="AW-Q", geplantes_verbrauchsdatum="2026-07-01",
    )
    bes.neue_bestellung(
        palette_id=None,
        palette_typ_snapshot={"name": "P2", "L_mm": 1500, "B_mm": 1000,
                                "hoehe_mm": 0},
        menge=2, kunde="Schmidt", artikelnummer="A-2",
        auftragsnummer_aw="AW-R",
    )
    csv = bes.nach_csv()
    zeilen = csv.strip().splitlines()
    assert zeilen[0].startswith("id;bestelldatum;status;")
    assert len(zeilen) == 3  # Header + 2 Eintraege
    assert "Müller" in csv
    print(f"  CSV-Export OK: {len(zeilen)-1} Zeilen + Header.")


def test_g_korrupte_json_kein_crash():
    Path(_TMP_BES.name).write_text("{kaputt\nbroken", encoding="utf-8")
    assert bes.alle() == []
    # Neue Eintraege legen saubere Datei an
    bes.neue_bestellung(
        palette_id=None,
        palette_typ_snapshot={"name": "", "L_mm": 100, "B_mm": 100,
                                "hoehe_mm": 0},
        menge=1, auftragsnummer_aw="AW", artikelnummer="A",
    )
    assert len(bes.alle()) == 1
    print(f"  Korrupte JSON wird ueberschrieben — kein Crash.")


def test_h_filter_offene_aktive():
    _reset()
    snap = {"name": "P", "L_mm": 100, "B_mm": 100, "hoehe_mm": 0}
    b1 = bes.neue_bestellung(palette_id=None, palette_typ_snapshot=snap,
                              menge=1, auftragsnummer_aw="O",
                              artikelnummer="O", status="offen")
    b2 = bes.neue_bestellung(palette_id=None, palette_typ_snapshot=snap,
                              menge=1, auftragsnummer_aw="V",
                              artikelnummer="V", status="offen")
    bes.update_status(b2, "verbraucht")
    b3 = bes.neue_bestellung(palette_id=None, palette_typ_snapshot=snap,
                              menge=1, auftragsnummer_aw="S",
                              artikelnummer="S", status="offen")
    bes.update_status(b3, "storniert")
    assert {e["id"] for e in bes.offene()} == {b1}
    assert {e["id"] for e in bes.verbraucht()} == {b2}
    assert {e["id"] for e in bes.stornierte()} == {b3}
    assert {e["id"] for e in bes.aktive()} == {b1, b2}  # nicht storniert
    print(f"  Filter: offene=1, verbraucht=1, stornierte=1, aktive=2.")


def _run(fn):
    try:
        fn()
        print(f"OK  {fn.__name__}")
        return True
    except AssertionError as e:
        print(f"FAIL {fn.__name__}: {e}")
        return False
    except Exception as e:
        print(f"ERR  {fn.__name__}: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    tests = [
        test_a_schema_persistiert,
        test_b_status_wechsel,
        test_c_snapshot_bleibt_nach_palette_loesch,
        test_d_atomare_transaktion,
        test_e_rollback_bei_unbekannter_palette,
        test_f_csv_export,
        test_g_korrupte_json_kein_crash,
        test_h_filter_offene_aktive,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Bestellungen-Tests bestanden.")
    try:
        for p in (_TMP_KAT, _TMP_BES):
            Path(p.name).unlink(missing_ok=True)
    except Exception:
        pass
    sys.exit(0 if erfolge == len(tests) else 1)
