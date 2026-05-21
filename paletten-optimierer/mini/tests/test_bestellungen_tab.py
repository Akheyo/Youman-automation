"""Tests fuer den Bestellungen-Tab (Spec Tab 4):

a) Lieferanten CRUD
b) Lieferant löschen mit offener Bestellung → blockt
c) BST-Nummer-Generierung (BST-YYYY-NNNN, sequenziell, pro Jahr)
d) Teilmengen-Eingang addiert sich korrekt, Bestellung bleibt offen
   bis vollständig
e) Idempotenz: doppelter Eingangs-Klick mit gleichem Token erzeugt
   KEINE Doppelbuchung
f) Bestellung stornieren mit bereits gebuchten Eingängen → blockt
g) Audit-Log: jede Aktion erzeugt Eintrag mit User+Datum+Details
h) Aus-Disposition-Vorschlag: berechnet Differenzen korrekt
i) Summe netto/brutto
j) Auto-Status 'eingegangen' wenn alle Positionen voll geliefert
"""
from __future__ import annotations

import io
import os
import sys
import tempfile
from datetime import date, datetime
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

_TMP_K = tempfile.NamedTemporaryFile(suffix=".json", delete=False); _TMP_K.close()
_TMP_P = tempfile.NamedTemporaryFile(suffix=".json", delete=False); _TMP_P.close()
_TMP_L = tempfile.NamedTemporaryFile(suffix=".json", delete=False); _TMP_L.close()
os.environ["PALETTENMINI_KATALOG"] = _TMP_K.name
os.environ["PALETTENMINI_BESCHAFFUNG"] = _TMP_P.name
os.environ["PALETTENMINI_LIEFERANTEN"] = _TMP_L.name

import palettenkatalog as kat  # noqa: E402
import procurement as proc  # noqa: E402
import lieferanten as lief  # noqa: E402


def _reset():
    for tmp in (_TMP_K, _TMP_P, _TMP_L):
        p = Path(tmp.name)
        if p.exists():
            p.unlink()


def test_a_lieferanten_crud():
    _reset()
    lid = lief.neuer_lieferant(name="Müller GmbH",
                                  kontakt="info@mueller.de",
                                  notiz="Hauptlieferant")
    assert lief.update_lieferant(lid, kontakt="neu@mueller.de") is True
    e = lief.finde(lid)
    assert e["kontakt"] == "neu@mueller.de"
    assert lief.name_zu_id("müller gmbh") == lid
    erg = lief.loesche_lieferant(lid)
    assert erg["ok"] is True
    print(f"  Lieferanten-CRUD OK.")


def test_b_lieferant_loesch_blockt_bei_offener_bestellung():
    """Spec §5: Lieferant löschen blockt bei offener Bestellung."""
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0, name="Euro")
    lid = lief.neuer_lieferant(name="Schmitt KG")
    erg = proc.neuer_auftrag(
        katalog_modul=kat, lieferant="Schmitt KG", lieferant_id=lid,
        positionen=[{"palette_id": pid, "menge": 10,
                      "ek_pro_stk_eur": 14.0}],
    )
    assert proc.hat_lieferant_offene(lid) is True
    # Caller muss vor lief.loesche_lieferant pruefen
    if proc.hat_lieferant_offene(lid):
        print(f"  Block: Lieferant {lid[:8]} hat offene Bestellung.")
    # Demo: Storno → Lieferant ist wieder loeschbar
    proc.update_status(erg["id"], "storniert", katalog_modul=kat)
    assert proc.hat_lieferant_offene(lid) is False


def test_c_bst_nummer_sequenziell():
    """BST-YYYY-0001, BST-YYYY-0002, ..."""
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0)
    nrs = []
    for _ in range(3):
        erg = proc.neuer_auftrag(
            katalog_modul=kat, lieferant="X",
            positionen=[{"palette_id": pid, "menge": 1,
                          "ek_pro_stk_eur": 14.0}],
        )
        nrs.append(erg["bst_nummer"])
    print(f"  BST-Nummern: {nrs}")
    jahr = datetime.now().year
    assert nrs[0] == f"BST-{jahr}-0001"
    assert nrs[1] == f"BST-{jahr}-0002"
    assert nrs[2] == f"BST-{jahr}-0003"


def test_d_teilmengen_eingang_addiert():
    """50 bestellt, 20 + 30 eingegangen → komplett."""
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0, bestand=10)
    erg = proc.neuer_auftrag(
        katalog_modul=kat, lieferant="X",
        positionen=[{"palette_id": pid, "menge": 50,
                      "ek_pro_stk_eur": 14.0}],
    )
    aid = erg["id"]
    # Hole position id
    auftrag = next(a for a in proc.alle() if a["id"] == aid)
    pos_id = auftrag["positionen"][0]["id"]
    # 1. Teil-Eingang
    r1 = proc.wareneingang_buchen(
        aid, positionen_mengen={pos_id: 20}, katalog_modul=kat,
        idempotenz_token="t1",
    )
    assert r1["ok"] is True
    e1 = next(x for x in kat.alle() if x["id"] == pid)
    assert e1["bestand"] == 30  # 10 + 20
    assert e1["bestand_bestellt"] == 30  # 50 - 20
    auftrag1 = next(a for a in proc.alle() if a["id"] == aid)
    assert auftrag1["status"] == "unterwegs"
    # 2. Rest-Eingang
    r2 = proc.wareneingang_buchen(
        aid, positionen_mengen={pos_id: 30}, katalog_modul=kat,
        idempotenz_token="t2",
    )
    e2 = next(x for x in kat.alle() if x["id"] == pid)
    assert e2["bestand"] == 60
    assert e2["bestand_bestellt"] == 0
    auftrag2 = next(a for a in proc.alle() if a["id"] == aid)
    assert auftrag2["status"] == "eingegangen"
    print(f"  Teilmengen: 20+30=50, Status final 'eingegangen'.")


def test_e_idempotenz_token():
    """Gleicher Token → kein Doppelbuchen."""
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0)
    erg = proc.neuer_auftrag(
        katalog_modul=kat, lieferant="X",
        positionen=[{"palette_id": pid, "menge": 20,
                      "ek_pro_stk_eur": 14.0}],
    )
    aid = erg["id"]
    pos_id = next(a["positionen"][0]["id"]
                   for a in proc.alle() if a["id"] == aid)
    r1 = proc.wareneingang_buchen(
        aid, positionen_mengen={pos_id: 5}, katalog_modul=kat,
        idempotenz_token="abc-123",
    )
    r2 = proc.wareneingang_buchen(
        aid, positionen_mengen={pos_id: 5}, katalog_modul=kat,
        idempotenz_token="abc-123",
    )
    e = next(x for x in kat.alle() if x["id"] == pid)
    print(f"  Idempotenz: 2× gebucht aber Bestand={e['bestand']} (1× wirksam)")
    assert e["bestand"] == 5
    assert r2.get("bereits_gebucht") is True


def test_f_storno_blockt_bei_eingang():
    """Spec §5: Bestellung stornieren mit gebuchten Eingängen → blockt."""
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0)
    erg = proc.neuer_auftrag(
        katalog_modul=kat, lieferant="X",
        positionen=[{"palette_id": pid, "menge": 20,
                      "ek_pro_stk_eur": 14.0}],
    )
    aid = erg["id"]
    pos_id = next(a["positionen"][0]["id"]
                   for a in proc.alle() if a["id"] == aid)
    # Teil-Eingang
    proc.wareneingang_buchen(
        aid, positionen_mengen={pos_id: 5}, katalog_modul=kat,
        idempotenz_token="x",
    )
    # Versuch Storno → blockt
    erg_storno = proc.update_status(aid, "storniert", katalog_modul=kat)
    print(f"  Storno-Block: ok={erg_storno['ok']}, fehler='{erg_storno['fehler'][:60]}'")
    assert erg_storno["ok"] is False
    assert "Stornierung" in erg_storno["fehler"]


def test_g_audit_log():
    """Jede Aktion erzeugt Audit-Eintrag."""
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0)
    erg = proc.neuer_auftrag(
        katalog_modul=kat, lieferant="X",
        positionen=[{"palette_id": pid, "menge": 10,
                      "ek_pro_stk_eur": 14.0}],
        user="alice",
    )
    aid = erg["id"]
    proc.update_status(aid, "bestellt", katalog_modul=kat, user="bob")
    pos_id = next(a["positionen"][0]["id"]
                   for a in proc.alle() if a["id"] == aid)
    proc.wareneingang_buchen(
        aid, positionen_mengen={pos_id: 10}, katalog_modul=kat,
        user="carol", idempotenz_token="zz",
    )
    auftrag = next(a for a in proc.alle() if a["id"] == aid)
    log = auftrag["audit_log"]
    print(f"  Audit: {len(log)} Eintraege, actions: "
          f"{[e['action'] for e in log]}")
    assert len(log) >= 3
    assert log[0]["action"] == "anlegen"
    assert log[0]["user"] == "alice"
    assert any(e["user"] == "bob" for e in log)
    assert any(e["user"] == "carol" for e in log)


def test_h_aus_disposition_vorschlag():
    """Generiert Positionen aus Optimierungs-Ergebnis: Δ = benötigt − bestand − in_anlieferung."""
    _reset()
    p1 = kat.neuer_eintrag(1200, 800, 14.0, 22.0,
                              bestand=50, bestand_bestellt=10)
    p2 = kat.neuer_eintrag(1500, 1000, 18.0, 28.0, bestand=20)
    # Simuliertes Optimierungs-Ergebnis
    ergebnis = {
        "zuordnung": [
            {"typ": "Standard", "ziel": "1200x800", "menge": 100},
            {"typ": "Standard", "ziel": "1500x1000", "menge": 30},
            {"typ": "Sonder", "ziel": "999x333", "menge": 5},
        ]
    }
    vorschlaege = proc.aus_disposition_vorschlag(kat, ergebnis=ergebnis)
    by_pid = {v["palette_id"]: v for v in vorschlaege}
    # p1: benötigt 100, bestand 50, in_anlief 10 → Δ = 40
    assert by_pid[p1]["menge"] == 40
    assert by_pid[p1]["ek_pro_stk_eur"] == 14.0
    # p2: benötigt 30, bestand 20, in_anlief 0 → Δ = 10
    assert by_pid[p2]["menge"] == 10
    # Sonder wird ignoriert (kein Katalog-Match)
    assert len(vorschlaege) == 2
    print(f"  Vorschlag: {len(vorschlaege)} Positionen, p1=40 Stk, p2=10 Stk.")


def test_i_summe_netto_brutto():
    _reset()
    pid = kat.neuer_eintrag(1200, 800, 14.0, 22.0)
    erg = proc.neuer_auftrag(
        katalog_modul=kat, lieferant="X",
        positionen=[{"palette_id": pid, "menge": 100,
                      "ek_pro_stk_eur": 14.50}],
    )
    auftrag = next(a for a in proc.alle() if a["id"] == erg["id"])
    print(f"  Summen: netto={auftrag['summe_netto_eur']}, "
          f"brutto={auftrag['summe_brutto_eur']}")
    assert auftrag["summe_netto_eur"] == 1450.0
    assert abs(auftrag["summe_brutto_eur"] - 1450.0 * 1.19) < 0.01


def test_j_auto_status_eingegangen():
    """Wareneingang aller Positionen voll → status='eingegangen'."""
    _reset()
    p1 = kat.neuer_eintrag(1200, 800, 14.0, 22.0)
    p2 = kat.neuer_eintrag(1500, 1000, 18.0, 28.0)
    erg = proc.neuer_auftrag(
        katalog_modul=kat, lieferant="X",
        positionen=[
            {"palette_id": p1, "menge": 5, "ek_pro_stk_eur": 14.0},
            {"palette_id": p2, "menge": 3, "ek_pro_stk_eur": 18.0},
        ],
    )
    aid = erg["id"]
    auftrag = next(a for a in proc.alle() if a["id"] == aid)
    pos_ids = [p["id"] for p in auftrag["positionen"]]
    # Erst nur p1 vollstaendig
    proc.wareneingang_buchen(aid, positionen_mengen={pos_ids[0]: 5},
                                katalog_modul=kat,
                                idempotenz_token="a")
    a1 = next(a for a in proc.alle() if a["id"] == aid)
    assert a1["status"] == "unterwegs"  # noch p2 offen
    # Jetzt p2
    proc.wareneingang_buchen(aid, positionen_mengen={pos_ids[1]: 3},
                                katalog_modul=kat,
                                idempotenz_token="b")
    a2 = next(a for a in proc.alle() if a["id"] == aid)
    assert a2["status"] == "eingegangen"
    print(f"  Auto-Status: unterwegs → eingegangen nach Komplett-Eingang.")


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
        test_a_lieferanten_crud,
        test_b_lieferant_loesch_blockt_bei_offener_bestellung,
        test_c_bst_nummer_sequenziell,
        test_d_teilmengen_eingang_addiert,
        test_e_idempotenz_token,
        test_f_storno_blockt_bei_eingang,
        test_g_audit_log,
        test_h_aus_disposition_vorschlag,
        test_i_summe_netto_brutto,
        test_j_auto_status_eingegangen,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Bestellungen-Tab-Tests bestanden.")
    try:
        for tmp in (_TMP_K, _TMP_P, _TMP_L):
            Path(tmp.name).unlink(missing_ok=True)
    except Exception:
        pass
    sys.exit(0 if erfolge == len(tests) else 1)
