"""Pflicht-Tests fuer den persistenten Import-Verlauf.

Vier Tests laut User-Spec, alle hart:
  a) Nach Import von Paletten_DM.xlsx: genau 1 Eintrag mit
     den verifizierten Spec-Kennzahlen
  b) Zweiter Import derselben Datei -> 2 Eintraege, identischer
     Hash, finde_per_hash gibt beide zurueck
  c) update_optimierung setzt das Feld korrekt; alle() sortiert
     neueste zuerst
  d) Korrupte JSON-Datei -> alle() = [], kein Crash; neuer_eintrag
     legt saubere Datei an

Build rot wenn einer fehlschlaegt.
"""
from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import time
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

# WICHTIG: Verlauf-Pfad VOR dem Import des Moduls setzen, damit der
# Test seine eigene isolierte Datei nutzt — nicht den echten User-Pfad.
_TMP = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
_TMP.close()
os.environ["PALETTENMINI_VERLAUF"] = _TMP.name

import import_verlauf as v  # noqa: E402
from import_excel import importiere  # noqa: E402


# Spec-Soll-Werte aus User-Doku
SOLL = {
    "datenzeilen": 508,
    "auftraege_mit_mass": 469,
    "auftraege_ohne_mass": 39,
    "paletten_gesamt": 2724,
    "normalisierte_masse": 158,
}

ECHTE_DATEI = HIER / "fixtures" / "Paletten_DM.xlsx"


def _reset_verlauf() -> None:
    """Loesche die Test-Verlauf-Datei, damit jeder Test sauber startet."""
    p = Path(_TMP.name)
    if p.exists():
        p.unlink()


def _pseudo_excel_bytes(seed: bytes = b"PALETTEN_DM_TESTBYTES") -> bytes:
    """Wenn die echte Datei nicht vorhanden ist: stabile Pseudo-Bytes
    (gleiche Bytes -> gleicher SHA)."""
    return seed


def _record_with(real_path: Path | None, ergebnis_override: dict | None = None) -> str:
    """Schreibt einen Verlaufseintrag. Wenn die echte Datei da ist,
    nimm sie samt Bytes. Sonst Pseudo-Bytes + Spec-Soll-Werte als
    Ergebnis-Override (damit a-Test trotzdem die Soll-Werte sieht)."""
    if real_path and real_path.exists():
        dat = importiere(real_path)
        return v.neuer_eintrag(
            datei_pfad=str(real_path),
            ergebnis=dat,
            datei_bytes=real_path.read_bytes(),
        )
    erg = ergebnis_override or {
        "datenzeilen": SOLL["datenzeilen"],
        "auftraege_mit_mass": SOLL["auftraege_mit_mass"],
        "auftraege_ohne_mass": SOLL["auftraege_ohne_mass"],
        "paletten_gesamt": SOLL["paletten_gesamt"],
        "normalisierte_masse": SOLL["normalisierte_masse"],
    }
    return v.neuer_eintrag(
        datei_pfad="Paletten_DM.xlsx",
        ergebnis=erg,
        datei_bytes=_pseudo_excel_bytes(),
    )


# ---------------------------------------------------------------------
# a) 1 Eintrag mit Spec-Soll-Werten
# ---------------------------------------------------------------------
def test_a_einzel_import_paletten_dm():
    _reset_verlauf()
    _record_with(ECHTE_DATEI if ECHTE_DATEI.exists() else None)
    eintraege = v.alle()
    assert len(eintraege) == 1, f"erwartet 1 Eintrag, bekam {len(eintraege)}"
    e = eintraege[0]
    assert e["datei_name"] == "Paletten_DM.xlsx", (
        f"datei_name {e['datei_name']!r} != 'Paletten_DM.xlsx'"
    )
    erg = e["ergebnis"]
    for feld, soll in SOLL.items():
        assert erg[feld] == soll, (
            f"ergebnis.{feld} = {erg[feld]} != Soll {soll}"
        )
    print(f"  OK — 1 Eintrag, alle Spec-Kennzahlen stimmen "
          f"({erg['auftraege_mit_mass']} mit Maß, "
          f"{erg['paletten_gesamt']} Paletten gesamt).")


# ---------------------------------------------------------------------
# b) Zweiter Import derselben Datei -> 2 Eintraege, gleicher Hash
# ---------------------------------------------------------------------
def test_b_zweiter_import_gleicher_hash():
    _reset_verlauf()
    id1 = _record_with(ECHTE_DATEI if ECHTE_DATEI.exists() else None)
    time.sleep(1)  # damit Datum sicher unterschiedlich ist
    id2 = _record_with(ECHTE_DATEI if ECHTE_DATEI.exists() else None)
    eintraege = v.alle()
    assert len(eintraege) == 2, f"erwartet 2 Eintraege, bekam {len(eintraege)}"
    sha1 = eintraege[0]["datei_hash_sha256"]
    sha2 = eintraege[1]["datei_hash_sha256"]
    assert sha1 == sha2 and sha1, (
        f"Hashes muessen identisch sein, sind: {sha1[:12]} vs {sha2[:12]}"
    )
    treffer = v.finde_per_hash(sha1)
    assert len(treffer) == 2, f"finde_per_hash erwartet 2, bekam {len(treffer)}"
    assert {t["id"] for t in treffer} == {id1, id2}, "IDs stimmen nicht"
    print(f"  OK — 2 Eintraege gleicher Hash, finde_per_hash liefert beide.")


# ---------------------------------------------------------------------
# c) update_optimierung + alle()-Sortierung
# ---------------------------------------------------------------------
def test_c_update_optimierung_und_sortierung():
    _reset_verlauf()
    id1 = _record_with(ECHTE_DATEI if ECHTE_DATEI.exists() else None)
    time.sleep(1)
    id2 = _record_with(ECHTE_DATEI if ECHTE_DATEI.exists() else None)

    opt = {
        "zeitstempel": "2026-05-19T12:00:00",
        "parameter": {"tol_mm": 200, "kombinieren": True},
        "ergebnis": {"standards": 15, "sonder": 1, "gesamt": 16,
                     "invariante_ok": True},
    }
    ok = v.update_optimierung(id1, opt)
    assert ok is True, "update_optimierung lieferte False"

    # alle() sortiert neueste oben → id2 (juenger) zuerst
    sortiert = v.alle()
    assert sortiert[0]["id"] == id2, "neueste sollte oben sein"
    assert sortiert[1]["id"] == id1

    # Optimierung des aktualisierten Eintrags ist gesetzt, andere bleibt None
    e1 = next(e for e in sortiert if e["id"] == id1)
    e2 = next(e for e in sortiert if e["id"] == id2)
    assert e1["optimierung"] == opt, f"optimierung nicht gespeichert: {e1['optimierung']}"
    assert e2["optimierung"] is None, "anderer Eintrag muss unbeeinflusst sein"

    # update mit unbekannter ID gibt False
    assert v.update_optimierung("does-not-exist", opt) is False
    print(f"  OK — update korrekt, Sortierung neueste-zuerst, "
          f"unbekannte ID liefert False.")


# ---------------------------------------------------------------------
# d) Korrupte JSON -> alle() = [], kein Crash; Neuanlage funktioniert
# ---------------------------------------------------------------------
def test_d_korrupte_json_kein_crash():
    _reset_verlauf()
    # Schreibe absichtlich kaputtes JSON
    p = Path(_TMP.name)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("{kaputt\n{unbalanced", encoding="utf-8")

    # alle() muss [] liefern (kein Crash)
    eintraege = v.alle()
    assert eintraege == [], f"korrupte Datei muss [] liefern, bekam {eintraege}"

    # finde_per_hash auch
    assert v.finde_per_hash("dummy") == []

    # Neuer Eintrag legt saubere Datei an
    new_id = _record_with(ECHTE_DATEI if ECHTE_DATEI.exists() else None)
    assert new_id

    # Jetzt sollte alle() genau 1 Eintrag liefern
    eintraege = v.alle()
    assert len(eintraege) == 1, f"nach Neuanlage erwartet 1 Eintrag, bekam {len(eintraege)}"
    assert eintraege[0]["id"] == new_id

    # Und die Datei ist valides JSON
    parsed = json.loads(p.read_text(encoding="utf-8"))
    assert isinstance(parsed, list) and len(parsed) == 1
    print(f"  OK — korrupte JSON wird sauber ueberschrieben, kein Crash.")


# ---------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------
if __name__ == "__main__":
    tests = [
        test_a_einzel_import_paletten_dm,
        test_b_zweiter_import_gleicher_hash,
        test_c_update_optimierung_und_sortierung,
        test_d_korrupte_json_kein_crash,
    ]
    erfolge = 0
    for fn in tests:
        try:
            fn()
            print(f"OK  {fn.__name__}")
            erfolge += 1
        except AssertionError as e:
            print(f"FAIL {fn.__name__}: {e}")
        except Exception as e:
            print(f"ERR  {fn.__name__}: {type(e).__name__}: {e}")
            import traceback; traceback.print_exc()
    print()
    print("=" * 60)
    print(f"{erfolge}/{len(tests)} Verlauf-Tests bestanden.")
    print("=" * 60)
    # Cleanup
    try:
        Path(_TMP.name).unlink(missing_ok=True)
    except Exception:
        pass
    sys.exit(0 if erfolge == len(tests) else 1)
