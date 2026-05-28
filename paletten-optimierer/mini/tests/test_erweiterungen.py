"""Tests fuer die 9 Erweiterungs-Features.

§1 Auto-Standard-Erkennung
§3 Katalog Duplikat-Check
§4 EK-Vergleich Lieferant ↔ Selbstfertigung
§5 Wiederbeschaffung + Ampel
§6 Import: AW + Wareneingang-Status 'angekommen'
§7 Audit-Log Stammdaten
§8 Preisvergleich + Preis-Zeitreihe
§9 Bestellungen: Suche + verlinkte_aws
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

_TMP = {k: tempfile.NamedTemporaryFile(suffix=".json", delete=False).name
         for k in ("KATALOG", "BESTELLUNGEN", "BESCHAFFUNG", "WIRT",
                    "LIEFERANTEN", "KOSTENSZ", "VERLAUF", "AUDITLOG")}
for k, p in _TMP.items():
    os.environ[f"PALETTENMINI_{k}"] = p

import palettenkatalog as kat  # noqa: E402
import lieferanten as lief  # noqa: E402
import bestellungen as bes  # noqa: E402
import procurement as proc  # noqa: E402
import import_verlauf as iv  # noqa: E402
import audit_log as audit  # noqa: E402
import preis_historie as ph  # noqa: E402
import wiederbeschaffung as wb  # noqa: E402
import verbrauch as vbr  # noqa: E402
from import_doppelschutz import pruefe_import  # noqa: E402


def _reset():
    for p in _TMP.values():
        path = Path(p)
        if path.exists():
            path.unlink()


# ---------------------------------------------------------------------------
# §1 Auto-Standard-Erkennung
# ---------------------------------------------------------------------------
def test_1_auto_standard_4_consecutive():
    _reset()
    # 5 Paletten im Katalog
    pid_a = kat.neuer_eintrag(1200, 800, 14.0, 22.0, name="A")
    pid_b = kat.neuer_eintrag(1500, 1000, 18.0, 28.0, name="B")
    pid_c = kat.neuer_eintrag(2000, 600, 16.0, 24.0, name="C")
    # Verlauf simulieren: A & B in den letzten 4 Läufen, C nur einmal
    def lauf(standards):
        eid = iv.neuer_eintrag(datei_pfad="X.xlsx",
                                ergebnis={"mit_mass": [], "ohne_mass": []})
        iv.update_optimierung(eid, {
            "standards": len(standards), "sonder": 0, "gesamt": len(standards),
            "ergebnis_snapshot": {"standards": [list(s) for s in standards]},
        })
        return eid
    lauf([(800, 1200), (1000, 1500)])
    lauf([(800, 1200), (1000, 1500)])
    lauf([(800, 1200), (1000, 1500), (600, 2000)])
    lauf([(800, 1200), (1000, 1500)])
    letzte = iv.alle()[:4]  # neueste zuerst
    geaendert = kat.auto_standard_pruefen(letzte, schwelle=4)
    # A und B sollten auto_standard sein, C nicht
    ids_auto = {e["id"] for e in geaendert}
    assert pid_a in ids_auto, "A sollte Auto-Standard sein"
    assert pid_b in ids_auto, "B sollte Auto-Standard sein"
    assert pid_c not in ids_auto, "C nicht — nur 1 Lauf"
    e_a = next(x for x in kat.alle() if x["id"] == pid_a)
    assert e_a["auto_standard"] is True
    assert e_a["auto_standard_seit"]
    assert len(e_a["verwendet_in_laeufen"]) >= 4
    print(f"  Auto-Standard: A+B markiert nach 4 konsekutiven Läufen.")


def test_1_auto_standard_aufheben():
    pid = kat.neuer_eintrag(1100, 700, 0, 0, auto_standard=True,
                              auto_standard_seit="2026-01-01")
    assert kat.auto_standard_aufheben(pid) is True
    e = next(x for x in kat.alle() if x["id"] == pid)
    assert e["auto_standard"] is False
    assert e["auto_standard_seit"] == ""
    print(f"  Auto-Standard manuell aufgehoben.")


# ---------------------------------------------------------------------------
# §3 Katalog Duplikat-Check
# ---------------------------------------------------------------------------
def test_3_duplikat_check():
    _reset()
    kat.neuer_eintrag(1200, 800, 14.0, 22.0, name="Euro", hoehe_mm=144)
    # Exakt gleiches Maß + Höhe
    dup = kat.finde_duplikat(1200, 800, 144)
    assert dup is not None
    assert dup["name"] == "Euro"
    # Gleiches Maß aber andere Höhe → kein Duplikat
    dup2 = kat.finde_duplikat(1200, 800, 100)
    assert dup2 is None
    # Gedreht ist ebenfalls Duplikat (Match kanonisch)
    dup3 = kat.finde_duplikat(800, 1200, 144)
    assert dup3 is not None
    print(f"  Duplikat-Check: gedreht=Treffer, andere Höhe=kein Treffer.")


# ---------------------------------------------------------------------------
# §4 EK-Vergleich Lieferant ↔ Selbstfertigung
# ---------------------------------------------------------------------------
def test_4_bezugsempfehlung_auto_guenstiger():
    e = {
        "ek_lieferant_eur": 18.0,
        "selbstfertigung_material_eur": 8.0,
        "selbstfertigung_lohn_eur": 6.0,
        "bezug_modus": "auto_guenstiger",
    }
    erg = kat.empfohlene_bezugskosten(e)
    print(f"  {erg}")
    assert erg["bezug"] == "selbstfertigung"
    assert erg["ek"] == 14.0
    assert e["selbstfertigung_gesamt_eur"] == 14.0  # auto-cache

    # Andersrum: Lieferant günstiger
    e2 = {
        "ek_lieferant_eur": 14.0,
        "selbstfertigung_material_eur": 10.0,
        "selbstfertigung_lohn_eur": 8.0,
        "bezug_modus": "auto_guenstiger",
    }
    erg2 = kat.empfohlene_bezugskosten(e2)
    assert erg2["bezug"] == "lieferant"
    assert erg2["ek"] == 14.0
    # Fix-Modus 'lieferant' überschreibt nicht
    e3 = dict(e); e3["bezug_modus"] = "lieferant"
    assert kat.empfohlene_bezugskosten(e3)["bezug"] == "lieferant"


# ---------------------------------------------------------------------------
# §5 Wiederbeschaffung + Ampel
# ---------------------------------------------------------------------------
def test_5_ampel_status_schwellen():
    # Reichweite > LZ + Puffer → grün
    assert wb.ampel_status(40, lieferzeit_tage=14,
                              sicherheitspuffer_tage=7) == "🟢"
    # Reichweite zwischen LZ und LZ+Puffer → gelb
    assert wb.ampel_status(18, lieferzeit_tage=14,
                              sicherheitspuffer_tage=7) == "🟡"
    # Reichweite < LZ → rot
    assert wb.ampel_status(10, lieferzeit_tage=14,
                              sicherheitspuffer_tage=7) == "🔴"
    # None → grau
    assert wb.ampel_status(None, lieferzeit_tage=14) == "⚫"
    print(f"  Ampel-Schwellen: 40→🟢, 18→🟡, 10→🔴, None→⚫")


def test_5_lieferzeit_fuer_palette_override():
    lieferanten = [{"id": "l1", "name": "L1", "lieferzeit_tage": 14}]
    # Override > Default
    p_override = {"lieferzeit_tage_override": 21, "default_lieferant_id": "l1"}
    assert wb.lieferzeit_fuer_palette(p_override, lieferanten) == 21
    # Ohne Override → Lieferant
    p_default = {"lieferzeit_tage_override": 0, "default_lieferant_id": "l1"}
    assert wb.lieferzeit_fuer_palette(p_default, lieferanten) == 14
    # Ohne Lieferant → default_tage
    assert wb.lieferzeit_fuer_palette({}, lieferanten,
                                          default_tage=10) == 10
    print(f"  Lieferzeit: override>default-lief>fallback.")


# ---------------------------------------------------------------------------
# §6 Import: AW + Wareneingang-Status 'angekommen'
# ---------------------------------------------------------------------------
def test_6_angekommen_status():
    """AW in Beschaffungs-Auftrag mit Status 'eingegangen' → 'angekommen'."""
    zeilen = [
        {"auftrag": "AW-001", "artikelnummer": "ART-1",
         "name": "Müller", "anzahl": 10},
        {"auftrag": "AW-002", "artikelnummer": "ART-2",
         "name": "Müller", "anzahl": 5},
    ]
    aws_da = {"AW-001"}  # AW-001 ist bereits angekommen
    erg = pruefe_import(zeilen, [], aws_mit_wareneingang=aws_da)
    assert len(erg["angekommen"]) == 1
    assert erg["angekommen"][0][0]["auftrag"] == "AW-001"
    assert len(erg["neu"]) == 1
    assert erg["neu"][0][0]["auftrag"] == "AW-002"
    print(f"  Spec §6: AW-001 → angekommen (übersprungen), AW-002 → neu.")


def test_6_aws_mit_wareneingang_aus_procurement():
    """procurement.aws_mit_wareneingang() liefert Set."""
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0)
    # Auftrag mit verlinkter AW anlegen
    erg = proc.neuer_auftrag(
        katalog_modul=kat, lieferant="X",
        positionen=[{"palette_id": pid, "menge": 10,
                      "ek_pro_stk_eur": 14.0,
                      "verlinkte_aws": ["AW-007", "AW-008"]}],
    )
    aid = erg["id"]
    # Vor Wareneingang: leer
    assert proc.aws_mit_wareneingang() == set()
    # Wareneingang buchen
    proc.update_status(aid, "wareneingang", katalog_modul=kat)
    aws = proc.aws_mit_wareneingang()
    assert aws == {"AW-007", "AW-008"}
    print(f"  aws_mit_wareneingang: {aws}")


# ---------------------------------------------------------------------------
# §7 Audit-Log Stammdaten
# ---------------------------------------------------------------------------
def test_7_audit_log_edit():
    _reset()
    eid = audit.log_edit(
        entitaet="palette", entitaet_id="pal-1",
        feld="laenge_mm", alt=1200, neu=1250,
        bemerkung="Lieferant hat Maß angepasst", user="alice",
    )
    eintrag = next(e for e in audit.alle() if e["id"] == eid)
    assert eintrag["alt"] == 1200
    assert eintrag["neu"] == 1250
    assert eintrag["bemerkung"]
    assert eintrag["user"] == "alice"
    # Pro Entitaet filterbar
    fp = audit.fuer_entitaet("palette", "pal-1")
    assert len(fp) == 1
    print(f"  Audit-Log: 1 Eintrag, alt=1200 neu=1250, user=alice.")


# ---------------------------------------------------------------------------
# §8 Preisvergleich + Zeitreihe
# ---------------------------------------------------------------------------
def test_8_preis_vergleich():
    aktuell = {"1200x800": 18.50, "1500x1000": 21.00,
                "2000x600": 24.00}
    verlauf = [
        {"datum": "2026-05-01", "optimierung": {
            "ek_snapshot": {"1200x800": 17.80, "1500x1000": 21.50}}},
        {"datum": "2026-04-01", "optimierung": {
            "ek_snapshot": {"1200x800": 17.00}}},
    ]
    erg = ph.vergleiche_ek(aktuell, verlauf)
    print(f"  {erg}")
    # 1200x800: 18.50 vs neuester Snapshot 17.80 → +0.70 / +3.93%
    assert "1200x800" in erg
    assert abs(erg["1200x800"]["delta_eur"] - 0.70) < 0.01
    assert erg["1200x800"]["trend"] == "+"
    # 1500x1000: 21.00 vs 21.50 → −0.50
    assert erg["1500x1000"]["trend"] == "-"
    # 2000x600: KEIN Snapshot → nicht im Result
    assert "2000x600" not in erg


def test_8_auffaellige_aenderungen():
    vgl = {
        "1200x800": {"delta_pct": 3.5, "delta_eur": 0.5,
                      "aktuell": 1, "letzter": 1, "trend": "+",
                      "datum_alt": ""},
        "1500x1000": {"delta_pct": 15.0, "delta_eur": 1, "aktuell": 1,
                       "letzter": 1, "trend": "+", "datum_alt": ""},
        "2000x600": {"delta_pct": -12.0, "delta_eur": -1,
                      "aktuell": 1, "letzter": 1, "trend": "-",
                      "datum_alt": ""},
    }
    auf = ph.auffaellige_aenderungen(vgl, schwelle_pct=10)
    assert "1500x1000" in auf
    assert "2000x600" in auf
    assert "1200x800" not in auf
    print(f"  Auffaellige (>10%): {auf}")


def test_8_preis_zeitreihe():
    verlauf = [
        {"datum": "2026-05-01", "optimierung": {
            "ek_snapshot": {"1200x800": 18.0}}},
        {"datum": "2026-04-01", "optimierung": {
            "ek_snapshot": {"1200x800": 17.5}}},
    ]
    reihe = ph.preis_zeitreihe(verlauf)
    print(f"  Zeitreihe: {reihe}")
    assert "1200x800" in reihe
    pts = reihe["1200x800"]
    # Chronologisch (älteste zuerst)
    assert pts[0]["datum"] == "2026-04-01"
    assert pts[-1]["datum"] == "2026-05-01"


def test_8_baue_ek_snapshot():
    kat_eintraege = [
        {"L_mm": 1200, "B_mm": 800,
         "ek_lieferant_eur": 18.50, "aktiv": True},
        {"L_mm": 1500, "B_mm": 1000,
         "einkaufspreis_eur": 21.0, "aktiv": True},
        {"L_mm": 800, "B_mm": 600,
         "ek_lieferant_eur": 12.0, "aktiv": False},  # inaktiv → raus
    ]
    snap = ph.baue_ek_snapshot(kat_eintraege)
    print(f"  Snapshot: {snap}")
    assert snap["1200x800"] == 18.50
    assert snap["1500x1000"] == 21.0
    assert "800x600" not in snap


# ---------------------------------------------------------------------------
# §9 Bestellungen: Suche + verlinkte_aws
# ---------------------------------------------------------------------------
def test_9_suche_nach_aw():
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0, name="Euro")
    erg = proc.neuer_auftrag(
        katalog_modul=kat, lieferant="Müller GmbH",
        positionen=[{"palette_id": pid, "menge": 10,
                      "ek_pro_stk_eur": 14.0,
                      "verlinkte_aws": ["AW-2026-005", "AW-2026-006"]}],
    )
    # Suche nach AW
    treffer_aw = proc.suche("AW-2026-005")
    assert len(treffer_aw) == 1
    assert treffer_aw[0]["id"] == erg["id"]
    # Suche nach Lieferant
    treffer_lief = proc.suche("müller")
    assert len(treffer_lief) == 1
    # Suche nach BST-Nr
    treffer_bst = proc.suche(erg["bst_nummer"])
    assert len(treffer_bst) == 1
    # Leere Suche = alle
    treffer_leer = proc.suche("")
    assert len(treffer_leer) == 1
    # Kein Treffer
    treffer_x = proc.suche("nope-12345")
    assert treffer_x == []
    print(f"  Suche: AW + Lieferant + BST-Nr + leer + nope.")


def test_9_aw_ist_in_beschaffung():
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0)
    erg = proc.neuer_auftrag(
        katalog_modul=kat, lieferant="X",
        positionen=[{"palette_id": pid, "menge": 5,
                      "ek_pro_stk_eur": 14.0,
                      "verlinkte_aws": ["AW-Q1"]}],
    )
    info = proc.aw_ist_in_beschaffung("AW-Q1")
    assert info is not None
    assert info["auftrag"]["id"] == erg["id"]
    assert info["status"] == "offen"
    assert proc.aw_ist_in_beschaffung("AW-DOESNT-EXIST") is None
    print(f"  aw_ist_in_beschaffung: gefunden mit Status 'offen'.")


# ---------------------------------------------------------------------------
# Lieferzeit-Erweiterung
# ---------------------------------------------------------------------------
def test_lieferzeit_in_lieferanten():
    _reset()
    lid = lief.neuer_lieferant(name="LZ-Test", lieferzeit_tage=21)
    e = next(x for x in lief.alle() if x["id"] == lid)
    assert e["lieferzeit_tage"] == 21
    lief.update_lieferant(lid, lieferzeit_tage=14)
    e2 = next(x for x in lief.alle() if x["id"] == lid)
    assert e2["lieferzeit_tage"] == 14
    print(f"  lieferzeit_tage persistiert + änderbar.")


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
        test_1_auto_standard_4_consecutive,
        test_1_auto_standard_aufheben,
        test_3_duplikat_check,
        test_4_bezugsempfehlung_auto_guenstiger,
        test_5_ampel_status_schwellen,
        test_5_lieferzeit_fuer_palette_override,
        test_6_angekommen_status,
        test_6_aws_mit_wareneingang_aus_procurement,
        test_7_audit_log_edit,
        test_8_preis_vergleich,
        test_8_auffaellige_aenderungen,
        test_8_preis_zeitreihe,
        test_8_baue_ek_snapshot,
        test_9_suche_nach_aw,
        test_9_aw_ist_in_beschaffung,
        test_lieferzeit_in_lieferanten,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Erweiterungs-Tests bestanden.")
    for p in _TMP.values():
        try:
            Path(p).unlink(missing_ok=True)
        except Exception:
            pass
    sys.exit(0 if erfolge == len(tests) else 1)
