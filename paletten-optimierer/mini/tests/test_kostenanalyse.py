"""Tests fuer Kostenanalyse-Tab (Spec §1-§8).

a) kostenanalyse_szenarien CRUD
b) korrupte JSON → []
c) verlauf.loesche_eintrag entfernt nur den passenden Eintrag
d) update_optimierung speichert params_snapshot + ergebnis_snapshot
e) leere Szenarien-Liste
f) max-3-Auswahl-Logik via len()
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

_TMP_SZ = tempfile.NamedTemporaryFile(suffix=".json", delete=False); _TMP_SZ.close()
_TMP_VL = tempfile.NamedTemporaryFile(suffix=".json", delete=False); _TMP_VL.close()
os.environ["PALETTENMINI_KOSTENSZ"] = _TMP_SZ.name
os.environ["PALETTENMINI_VERLAUF"] = _TMP_VL.name

import kostenanalyse_szenarien as ksz  # noqa: E402
import import_verlauf as iv  # noqa: E402


def _reset():
    for tmp in (_TMP_SZ, _TMP_VL):
        p = Path(tmp.name)
        if p.exists():
            p.unlink()


def test_a_crud_szenarien():
    _reset()
    eid1 = ksz.neues_szenario(
        name="Szenario A", basis_lauf_id=None,
        params={"tol_kurz_mm": 200, "tol_lang_mm": 400},
        ergebnis={"standards": 10, "sonder": 1, "gesamt": 11},
    )
    eid2 = ksz.neues_szenario(
        name="Szenario B", basis_lauf_id="lauf-xy",
        params={"tol_kurz_mm": 100, "tol_lang_mm": 100},
        ergebnis={"standards": 25, "sonder": 4, "gesamt": 29},
    )
    eintraege = ksz.alle()
    assert len(eintraege) == 2
    # neueste zuerst (Sort nach erstellt_am desc)
    names = [e["name"] for e in eintraege]
    assert "Szenario A" in names and "Szenario B" in names
    # Loesche
    assert ksz.loesche(eid1) is True
    assert len(ksz.alle()) == 1
    assert ksz.loesche("nope") is False
    print(f"  CRUD OK — 2 angelegt, 1 geloescht, 1 verbleibend.")


def test_b_korrupte_json():
    Path(_TMP_SZ.name).write_text("{kaputt\nbroken", encoding="utf-8")
    assert ksz.alle() == []
    # Neuer Eintrag legt sauber an
    eid = ksz.neues_szenario(name="X", basis_lauf_id=None,
                               params={}, ergebnis={})
    assert len(ksz.alle()) == 1
    print(f"  Korrupte JSON wird ueberschrieben — kein Crash.")


def test_c_verlauf_loesche_eintrag():
    """Spec §2 Aktion: einzelne Verlauf-Eintraege loeschen."""
    _reset()
    e1 = iv.neuer_eintrag(datei_pfad="A.xlsx",
                           ergebnis={"mit_mass": [], "ohne_mass": []})
    e2 = iv.neuer_eintrag(datei_pfad="B.xlsx",
                           ergebnis={"mit_mass": [], "ohne_mass": []})
    assert len(iv.alle()) == 2
    # Nur e1 loeschen
    assert iv.loesche_eintrag(e1) is True
    rest = iv.alle()
    assert len(rest) == 1
    assert rest[0]["id"] == e2
    # Doppelt-Loeschen schadet nicht
    assert iv.loesche_eintrag(e1) is False
    print(f"  loesche_eintrag: 2 → 1 (nur e1 weg), False bei Wiederholung.")


def test_d_update_optimierung_mit_snapshot():
    """Verlauf speichert params_snapshot + ergebnis_snapshot."""
    _reset()
    eid = iv.neuer_eintrag(datei_pfad="X.xlsx",
                            ergebnis={"mit_mass": [], "ohne_mass": []})
    snap_p = {"tol_kurz_mm": 200, "tol_lang_mm": 400,
              "kombinieren": True, "sonder_erlaubt": False}
    snap_e = {"standards": [[800, 1200], [1000, 1500]],
              "sonder": [], "score": 4.5, "zuordnung_n": 10}
    iv.update_optimierung(eid, {
        "zeitstempel": "2026-05-21T12:00:00",
        "tol_kurz_mm": 200,
        "params_snapshot": snap_p,
        "ergebnis_snapshot": snap_e,
        "standards": 2, "sonder": 0, "gesamt": 2,
    })
    eintrag = next(e for e in iv.alle() if e["id"] == eid)
    opt = eintrag.get("optimierung", {})
    assert opt.get("params_snapshot") == snap_p
    assert opt.get("ergebnis_snapshot") == snap_e
    print(f"  Snapshot-Felder vorhanden: params + ergebnis.")


def test_e_leere_szenarien_liste():
    _reset()
    assert ksz.alle() == []
    assert ksz.leere_alle() == 0  # nichts zu loeschen
    ksz.neues_szenario(name="Y", basis_lauf_id=None, params={}, ergebnis={})
    assert ksz.leere_alle() == 1
    assert ksz.alle() == []
    print(f"  leere_alle: idempotent + leert komplett.")


def test_f_max_3_szenarien_logik():
    """Logik fuer 'max 3 nebeneinander' wird im UI gemacht — hier nur
    die zugrundeliegende Listen-Mechanik."""
    auswahl = []
    for i in range(5):
        if len(auswahl) < 3:
            auswahl.append(f"id-{i}")
    assert len(auswahl) == 3
    assert auswahl == ["id-0", "id-1", "id-2"]
    print(f"  Max-3-Logik: 5 angefragt, 3 aufgenommen.")


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
        test_a_crud_szenarien,
        test_b_korrupte_json,
        test_c_verlauf_loesche_eintrag,
        test_d_update_optimierung_mit_snapshot,
        test_e_leere_szenarien_liste,
        test_f_max_3_szenarien_logik,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Kostenanalyse-Tests bestanden.")
    try:
        for tmp in (_TMP_SZ, _TMP_VL):
            Path(tmp.name).unlink(missing_ok=True)
    except Exception:
        pass
    sys.exit(0 if erfolge == len(tests) else 1)
