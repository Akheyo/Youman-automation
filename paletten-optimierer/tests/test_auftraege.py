"""Tests fuer Auftragsverwaltung (Stammdaten 2).

a) CRUD + AW-Auto-Nummerierung
b) AW-Duplikat-Check
c) Status-Wechsel mit Pflicht-Grund (manuell)
d) Excel-Upsert: bestehender AW wird nicht überschrieben
e) Auto-Status-Sync: offen → in_arbeit bei verlinkter Beschaffung
f) Auto-Status-Sync: in_arbeit → abgeschlossen bei Wareneingang + VBD
g) Manuell gesetzter Status wird nicht überschrieben
h) Storniert wird nicht auto-überschrieben
i) Filter (status_in, kunde, suche, datum-range)
j) Stats (offen/in_arbeit/abgeschlossen30T/storniert30T)
k) Bulk-Loeschen via loesche_auftrag
"""
from __future__ import annotations

import io
import os
import sys
import tempfile
from datetime import date, datetime, timedelta
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

_TMP_A = tempfile.NamedTemporaryFile(suffix=".json", delete=False); _TMP_A.close()
_TMP_K = tempfile.NamedTemporaryFile(suffix=".json", delete=False); _TMP_K.close()
_TMP_P = tempfile.NamedTemporaryFile(suffix=".json", delete=False); _TMP_P.close()
os.environ["PALETTENMINI_AUFTRAEGE"] = _TMP_A.name
os.environ["PALETTENMINI_KATALOG"] = _TMP_K.name
os.environ["PALETTENMINI_BESCHAFFUNG"] = _TMP_P.name

import auftraege as auf  # noqa: E402
import palettenkatalog as kat  # noqa: E402
import procurement as proc  # noqa: E402


def _reset():
    for tmp in (_TMP_A, _TMP_K, _TMP_P):
        p = Path(tmp.name)
        if p.exists():
            p.unlink()


def test_a_crud_und_auto_aw_nummer():
    _reset()
    erg = auf.neuer_auftrag(kunde="Müller", menge=10)
    assert erg["ok"] is True
    assert erg["aw_nummer"].startswith(f"AW-{datetime.now().year}-")
    erg2 = auf.neuer_auftrag(kunde="Schmitt", menge=5)
    # Sequenziell
    nr1 = int(erg["aw_nummer"].split("-")[-1])
    nr2 = int(erg2["aw_nummer"].split("-")[-1])
    assert nr2 == nr1 + 1
    # Mit expliziter Nummer
    erg3 = auf.neuer_auftrag(aw_nummer="AW-CUSTOM-1", kunde="X")
    assert erg3["ok"] is True
    assert auf.finde_per_aw("AW-CUSTOM-1") is not None
    print(f"  Auto-AW: {erg['aw_nummer']}, {erg2['aw_nummer']}, "
          f"{erg3['aw_nummer']}")


def test_b_duplikat_check_aw():
    _reset()
    auf.neuer_auftrag(aw_nummer="AW-DUP-1", kunde="A")
    # Zweiter Versuch mit gleicher AW
    erg = auf.neuer_auftrag(aw_nummer="AW-DUP-1", kunde="B")
    assert erg["ok"] is False
    assert "existiert" in erg["fehler"]
    # Case-insensitive
    erg2 = auf.neuer_auftrag(aw_nummer="aw-dup-1", kunde="C")
    assert erg2["ok"] is False
    print(f"  Duplikat blockt korrekt: {erg['fehler']}")


def test_c_status_wechsel_pflicht_grund():
    _reset()
    erg = auf.neuer_auftrag(kunde="X")
    eid = erg["id"]
    # Manueller Wechsel OHNE Grund → blockt
    r1 = auf.setze_status(eid, "storniert", grund="", manuell=True)
    assert r1["ok"] is False
    assert "Grund" in r1["fehler"]
    # Mit Grund OK
    r2 = auf.setze_status(eid, "storniert",
                            grund="Kunde abgesagt", manuell=True)
    assert r2["ok"] is True
    e = auf.finde(eid)
    assert e["status"] == "storniert"
    assert e["status_manuell_gesetzt"] is True
    assert e["status_grund"] == "Kunde abgesagt"
    # Ungueltiger Status
    r3 = auf.setze_status(eid, "foo", grund="x", manuell=True)
    assert r3["ok"] is False
    print(f"  Status-Wechsel: Grund-Pflicht enforced, valid Status enforced.")


def test_d_upsert_excel_aw_dedup_und_ersetzen():
    """Import auf AW-Ebene: unveraenderte AW ueberspringen, geaenderte AW
    ersetzen, exakte Dubletten kollabieren. Eine AW darf mehrere Positionen
    haben."""
    _reset()
    zeilen = [
        {"auftrag": "AW-X1", "name": "Müller", "artikelnummer": "A1",
         "anzahl": 5, "laenge": 1200, "breite": 800, "hoehe": 144},
        {"auftrag": "AW-X1", "name": "Müller", "artikelnummer": "A2",
         "anzahl": 3, "laenge": 1000, "breite": 600, "hoehe": 144},
        {"auftrag": "AW-X2", "name": "Schmitt", "artikelnummer": "B1",
         "anzahl": 1, "laenge": 800, "breite": 600, "hoehe": 0},
    ]
    erg = auf.upsert_aus_excel(zeilen)
    assert erg["neu"] == 2, erg              # 2 Auftraege (AW-X1 mit 2 Pos, AW-X2)
    assert len(auf.alle()) == 3              # 3 Positionen
    # Re-Import unveraendert -> nichts passiert
    erg2 = auf.upsert_aus_excel(zeilen)
    assert (erg2["neu"], erg2["ersetzt"], erg2["unveraendert"]) == (0, 0, 2), erg2
    assert len(auf.alle()) == 3
    # Exakte Dublette im selben Import wird kollabiert
    erg3 = auf.upsert_aus_excel([zeilen[2], zeilen[2]])
    assert erg3["unveraendert"] == 1 and len(auf.alle()) == 3, erg3
    # AW-X1 aendert sich (Menge 5->99) -> alter Auftrag wird ersetzt
    geaendert = [
        {"auftrag": "AW-X1", "name": "Müller", "artikelnummer": "A1",
         "anzahl": 99, "laenge": 1200, "breite": 800, "hoehe": 144},
        {"auftrag": "AW-X1", "name": "Müller", "artikelnummer": "A2",
         "anzahl": 3, "laenge": 1000, "breite": 600, "hoehe": 144},
    ]
    erg4 = auf.upsert_aus_excel(geaendert)
    assert erg4["ersetzt"] == 1, erg4
    x1 = [a for a in auf.alle() if a["aw_nummer"] == "AW-X1"]
    assert len(x1) == 2 and sorted(a["menge"] for a in x1) == [3, 99], x1
    assert len(auf.alle()) == 3              # AW-X2 unberuehrt
    print("  Upsert AW-Ebene: dedup + unveraendert skip + ersetzen OK")


def test_e_auto_sync_offen_zu_in_arbeit():
    _reset()
    # Auftrag anlegen
    erg = auf.neuer_auftrag(aw_nummer="AW-S-1", kunde="K",
                              bestelldatum="2026-05-01",
                              verbrauchsdatum="2099-12-31")
    aid = erg["id"]
    assert auf.finde(aid)["status"] == "offen"
    # Beschaffung mit verlinkter AW → status='offen' (procurement)
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0)
    proc.neuer_auftrag(
        katalog_modul=kat, lieferant="X",
        positionen=[{"palette_id": pid, "menge": 5,
                      "ek_pro_stk_eur": 14.0,
                      "verlinkte_aws": ["AW-S-1"]}],
    )
    erg_sync = auf.sync_status_aus_beschaffung(proc)
    print(f"  Sync: {erg_sync['wechsel']} Wechsel")
    assert erg_sync["wechsel"] >= 1
    e = auf.finde(aid)
    assert e["status"] == "in_arbeit"
    assert e["status_manuell_gesetzt"] is False


def test_f_auto_sync_zu_abgeschlossen():
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0)
    # VBD bereits in der Vergangenheit
    gestern = (date.today() - timedelta(days=1)).isoformat()
    erg = auf.neuer_auftrag(aw_nummer="AW-DONE",
                              verbrauchsdatum=gestern)
    bauf = proc.neuer_auftrag(
        katalog_modul=kat, lieferant="X",
        positionen=[{"palette_id": pid, "menge": 10,
                      "ek_pro_stk_eur": 14.0,
                      "verlinkte_aws": ["AW-DONE"]}],
    )
    # Wareneingang buchen
    proc.update_status(bauf["id"], "wareneingang", katalog_modul=kat)
    erg_sync = auf.sync_status_aus_beschaffung(proc)
    e = auf.finde(erg["id"])
    print(f"  Auto-abgeschlossen: status={e['status']}")
    assert e["status"] == "abgeschlossen"


def test_g_manuell_gesetzt_bleibt():
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0)
    erg = auf.neuer_auftrag(aw_nummer="AW-MAN", verbrauchsdatum="2099-12-31")
    aid = erg["id"]
    # Manuell auf storniert
    auf.setze_status(aid, "storniert", grund="Test", manuell=True)
    # Beschaffung anlegen (würde normalerweise → in_arbeit)
    proc.neuer_auftrag(
        katalog_modul=kat, lieferant="X",
        positionen=[{"palette_id": pid, "menge": 5,
                      "ek_pro_stk_eur": 14.0,
                      "verlinkte_aws": ["AW-MAN"]}],
    )
    auf.sync_status_aus_beschaffung(proc)
    # Status bleibt 'storniert' (sowohl manuell als auch storniert blocken Sync)
    e = auf.finde(aid)
    assert e["status"] == "storniert"
    print(f"  Manuell gesetzter Status wird respektiert.")


def test_h_storniert_bleibt_storniert():
    """Spec §3: jederzeit → storniert nur manuell, Sync laesst storniert in
    Ruhe."""
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0)
    erg = auf.neuer_auftrag(aw_nummer="AW-STORNO",
                              verbrauchsdatum="2099-12-31")
    aid = erg["id"]
    auf.setze_status(aid, "storniert", grund="weg",  manuell=True)
    # Sync laeuft, AW hat keine Beschaffung — bleibt storniert
    auf.sync_status_aus_beschaffung(proc)
    e = auf.finde(aid)
    assert e["status"] == "storniert"
    print(f"  Storniert + kein-Beschaffung → bleibt storniert.")


def test_i_filter():
    _reset()
    auf.neuer_auftrag(aw_nummer="AW-F-1", kunde="Müller",
                       artikel_nummer="A-100", menge=5,
                       bestelldatum="2026-05-10")
    auf.neuer_auftrag(aw_nummer="AW-F-2", kunde="Schmitt",
                       artikel_nummer="B-200", menge=10,
                       bestelldatum="2026-05-15")
    auf.neuer_auftrag(aw_nummer="AW-F-3", kunde="Müller",
                       artikel_nummer="C-300", menge=15,
                       bestelldatum="2026-05-20")
    # Filter nach Kunde
    r1 = auf.filter_aufträge(kunde="Müller")
    assert len(r1) == 2
    # Suche
    r2 = auf.filter_aufträge(suche="A-100")
    assert len(r2) == 1
    # Datum
    r3 = auf.filter_aufträge(bestelldatum_von="2026-05-12",
                                 bestelldatum_bis="2026-05-18")
    assert len(r3) == 1
    print(f"  Filter: kunde=2, suche=1, datum=1.")


def test_i2_aw_suche_exakt_und_robust():
    """Bug-Fix: AW-Suche exakt + ohne Cross-Field-Rauschen + Whitespace."""
    _reset()
    auf.neuer_auftrag(aw_nummer="AW-2026-005", kunde="Müller",
                       artikel_nummer="X1", menge=1)
    auf.neuer_auftrag(aw_nummer="AW-2026-0050", kunde="Meyer",
                       artikel_nummer="AW-2026-005-T", menge=1)
    auf.neuer_auftrag(aw_nummer="AW-2026-099", kunde="Schmidt",
                       artikel_nummer="12345", menge=1)
    # Exakte volle AW -> genau eine, NICHT AW-2026-0050
    r = auf.filter_aufträge(suche="AW-2026-005")
    assert [e["aw_nummer"] for e in r] == ["AW-2026-005"], r
    # Whitespace/Case robust
    assert len(auf.filter_aufträge(suche="  aw-2026-099 ")) == 1
    # Teil-AW -> Praefix/Teilstring (beide 005 + 0050)
    assert len(auf.filter_aufträge(suche="AW-2026-00")) == 2
    # Leer -> alle
    assert len(auf.filter_aufträge(suche="")) == 3
    # Nicht-AW-Begriff sucht Multi-Field (artikel_nummer)
    assert [e["aw_nummer"] for e in auf.filter_aufträge(suche="12345")] \
        == ["AW-2026-099"]
    print("  AW-Suche: exakt, robust, kein Cross-Field-Rauschen OK")


def test_j_stats():
    _reset()
    auf.neuer_auftrag(aw_nummer="AW-J-1")  # offen
    auf.neuer_auftrag(aw_nummer="AW-J-2")  # offen
    e3 = auf.neuer_auftrag(aw_nummer="AW-J-3")
    auf.setze_status(e3["id"], "in_arbeit", grund="weg", manuell=True)
    e4 = auf.neuer_auftrag(aw_nummer="AW-J-4")
    auf.setze_status(e4["id"], "abgeschlossen", grund="ok", manuell=True)
    e5 = auf.neuer_auftrag(aw_nummer="AW-J-5")
    auf.setze_status(e5["id"], "storniert", grund="x", manuell=True)
    s = auf.stats()
    print(f"  Stats: {s}")
    assert s["offen"] == 2
    assert s["in_arbeit"] == 1
    assert s["abgeschlossen_30T"] == 1
    assert s["storniert_30T"] == 1


def test_k_loesche_auftrag():
    _reset()
    erg = auf.neuer_auftrag(aw_nummer="AW-DEL")
    eid = erg["id"]
    assert auf.loesche_auftrag(eid) is True
    assert auf.finde(eid) is None
    assert auf.loesche_auftrag(eid) is False
    print(f"  Loesche: ok.")


def test_l_aw_auto_nummer_kein_konflikt():
    """naechste_aw_nummer() liefert immer eine freie Nummer."""
    _reset()
    n1 = auf.naechste_aw_nummer()
    auf.neuer_auftrag(aw_nummer=n1)
    n2 = auf.naechste_aw_nummer()
    assert n1 != n2
    auf.neuer_auftrag(aw_nummer=n2)
    n3 = auf.naechste_aw_nummer()
    assert n3 != n1 and n3 != n2
    print(f"  Auto-Nr sequenziell: {n1} → {n2} → {n3}")


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
        test_a_crud_und_auto_aw_nummer,
        test_b_duplikat_check_aw,
        test_c_status_wechsel_pflicht_grund,
        test_d_upsert_excel_aw_dedup_und_ersetzen,
        test_e_auto_sync_offen_zu_in_arbeit,
        test_f_auto_sync_zu_abgeschlossen,
        test_g_manuell_gesetzt_bleibt,
        test_h_storniert_bleibt_storniert,
        test_i_filter,
        test_i2_aw_suche_exakt_und_robust,
        test_j_stats,
        test_k_loesche_auftrag,
        test_l_aw_auto_nummer_kein_konflikt,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Auftragsverwaltungs-Tests bestanden.")
    for tmp in (_TMP_A, _TMP_K, _TMP_P):
        try:
            Path(tmp.name).unlink(missing_ok=True)
        except Exception:
            pass
    sys.exit(0 if erfolge == len(tests) else 1)
