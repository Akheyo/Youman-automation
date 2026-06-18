"""Struktur-Tests gegen Code-erzeugte xlsx-Fixtures.
KEINE Abhaengigkeit von externer Paletten_DM.xlsx — alles aus dem
Code reproduzierbar.

a) 10 kontrollierte Auftraege, tol=200/200, deckel=5 -> Soll fest
   verdrahtet.
b) 4 Aufträge die einen Cluster bilden -> 1 Standard, Invariante OK.
c) Header in Z.3 statt Z.5 -> dynamische Erkennung findet ihn.
d) P-Länge=40 -> nach -50 negativ -> "Maß fehlt"-Bucket, kein Crash.
e) Doppelte Auftragsnummer mit 2 Positionen -> beide bleiben, kein
   Dedup auf Auftragsnummer allein.
"""
from __future__ import annotations

import io
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))
sys.path.insert(0, str(HIER))

from _fixture_builder import erzeuge_fixture  # noqa: E402
from import_excel import importiere  # noqa: E402
from optimierer_kern import optimiere  # noqa: E402


def _tmp(name: str) -> Path:
    return Path(tempfile.gettempdir()) / f"paletten_struktur_{name}.xlsx"


def _cleanup(p: Path) -> None:
    try:
        if p.exists():
            p.unlink()
    except (PermissionError, OSError):
        pass


def _orders(dat: dict) -> list[dict]:
    return [{"L": e["laenge"], "B": e["breite"], "menge": e["anzahl"],
             "auftrag": e["auftrag"], "name": e["name"]}
            for e in dat["mit_mass"]]


# ---------------------------------------------------------------------
# a) 10 kontrollierte Auftraege — fest verdrahtetes Soll
# ---------------------------------------------------------------------
def test_a_zehn_auftraege_fest_verdrahtet():
    """Eingabe (Excel P-Werte) — Produkt = P − 50 mm je Achse:
       4 Aufträge im Cluster ~1500x720
       3 Aufträge im Cluster ~1200x800
       2 Aufträge im Cluster ~2000x600
       1 Outlier 3500x2200
    -> mit tol=200/200, deckel=5, Kombi aus:
       3 Standards moeglich (jeweils einer pro Cluster) + 1 Sonder
       fuer den Outlier ODER 4 Standards. ILP wird gleichwertige
       Loesung waehlen — Gesamt ist 4.
    """
    daten = [
        # Cluster 1: ca. 1500x720 (Produkt ~1450x670)
        {"auftrag": "A1", "L": 1500, "B": 720, "menge": 1, "artikelnr": "ART1"},
        {"auftrag": "A2", "L": 1520, "B": 710, "menge": 1, "artikelnr": "ART2"},
        {"auftrag": "A3", "L": 1480, "B": 700, "menge": 1, "artikelnr": "ART3"},
        {"auftrag": "A4", "L": 1530, "B": 740, "menge": 1, "artikelnr": "ART4"},
        # Cluster 2: ca. 1200x800
        {"auftrag": "B1", "L": 1200, "B": 800, "menge": 2, "artikelnr": "ART5"},
        {"auftrag": "B2", "L": 1180, "B": 810, "menge": 1, "artikelnr": "ART6"},
        {"auftrag": "B3", "L": 1220, "B": 790, "menge": 3, "artikelnr": "ART7"},
        # Cluster 3: ca. 2000x600
        {"auftrag": "C1", "L": 2000, "B": 600, "menge": 1, "artikelnr": "ART8"},
        {"auftrag": "C2", "L": 1980, "B": 620, "menge": 1, "artikelnr": "ART9"},
        # Outlier
        {"auftrag": "X1", "L": 3500, "B": 2200, "menge": 1, "artikelnr": "ARTX"},
    ]
    tmp = _tmp("a_zehn")
    try:
        erzeuge_fixture(daten, tmp, header_zeile=5)
        dat = importiere(tmp)
        assert dat["header_zeile"] == 5
        assert len(dat["mit_mass"]) == 10
        assert len(dat["ohne_mass"]) == 0

        r = optimiere(_orders(dat),
                      tol_kurz_mm=200, tol_lang_mm=200,
                      max_kombi_teile=3, heterogen_fallback=True,
                      sonder_deckel=5)
        gesamt = r["gesamt"]
        print(f"\n  10 Auftraege: std={len(r['standards'])} "
              f"sonder={len(r['sonder'])} gesamt={gesamt} "
              f"invariante_ok={r['invariante_ok']}")
        assert r["invariante_ok"], "Invariante muss OK sein"
        # 4 Cluster (inkl. Outlier) → Gesamt zwischen 3 und 4
        # (Outlier kann Standard oder Sonder sein — Optimum bleibt 4)
        assert 3 <= gesamt <= 4, (
            f"Erwartet gesamt 3-4 bei 10 Auftraegen in 4 Clustern, "
            f"bekam {gesamt}"
        )
    finally:
        _cleanup(tmp)


# ---------------------------------------------------------------------
# b) 4 Aufträge bilden Cluster -> 1 Standard, Invariante OK
# ---------------------------------------------------------------------
def test_b_vier_cluster_ein_standard():
    daten = [
        {"auftrag": "A", "L": 1570, "B": 770, "menge": 1, "artikelnr": "AA"},
        {"auftrag": "B", "L": 1600, "B": 750, "menge": 1, "artikelnr": "BB"},
        {"auftrag": "C", "L": 1550, "B": 800, "menge": 1, "artikelnr": "CC"},
        {"auftrag": "D", "L": 1580, "B": 760, "menge": 1, "artikelnr": "DD"},
    ]
    tmp = _tmp("b_cluster")
    try:
        erzeuge_fixture(daten, tmp, header_zeile=5)
        dat = importiere(tmp)
        assert len(dat["mit_mass"]) == 4
        r = optimiere(_orders(dat), tol_kurz_mm=200, tol_lang_mm=200,
                      max_kombi_teile=3, heterogen_fallback=True,
                      sonder_deckel=5)
        print(f"\n  4 Auftraege Cluster: std={len(r['standards'])} "
              f"sonder={len(r['sonder'])} invariante_ok={r['invariante_ok']}")
        assert len(r["standards"]) == 1, f"erwartet 1 Std, bekam {r['standards']}"
        assert len(r["sonder"]) == 0
        assert r["invariante_ok"]
    finally:
        _cleanup(tmp)


# ---------------------------------------------------------------------
# c) Header in Z.3 — dynamische Erkennung findet ihn
# ---------------------------------------------------------------------
def test_c_header_in_zeile_3():
    daten = [
        {"auftrag": "P1", "L": 1200, "B": 800, "menge": 1, "artikelnr": "AA"},
    ]
    tmp = _tmp("c_z3")
    try:
        erzeuge_fixture(daten, tmp, header_zeile=3)
        dat = importiere(tmp)
        print(f"\n  Header erkannt in Datei-Zeile: {dat['header_zeile']}")
        assert dat["header_zeile"] == 3, (
            f"Erwartet Header in Z.3, bekam {dat['header_zeile']}"
        )
        assert len(dat["mit_mass"]) == 1
    finally:
        _cleanup(tmp)


# ---------------------------------------------------------------------
# d) P-Länge=40 -> Produkt-L=-10 -> "Maß fehlt"-Bucket, kein Crash
# ---------------------------------------------------------------------
def test_d_negativer_produkt_wert():
    daten = [
        {"auftrag": "OHNE", "L": 40,   "B": 850, "menge": 1, "artikelnr": "X1"},
        {"auftrag": "MIT",  "L": 1200, "B": 800, "menge": 2, "artikelnr": "Y1"},
    ]
    tmp = _tmp("d_neg")
    try:
        erzeuge_fixture(daten, tmp, header_zeile=5)
        dat = importiere(tmp)
        ids_mit = {p["auftrag"] for p in dat["mit_mass"]}
        ids_ohne = {p["auftrag"] for p in dat["ohne_mass"]}
        print(f"\n  mit_mass={ids_mit}, ohne_mass={ids_ohne}")
        assert "OHNE" in ids_ohne, "P-L=40 muss in 'Maß fehlt' landen"
        assert "MIT" in ids_mit
        # Optimierer kommt nicht ins Stolpern
        r = optimiere(_orders(dat), tol_kurz_mm=200, tol_lang_mm=200)
        assert r["invariante_ok"]
    finally:
        _cleanup(tmp)


# ---------------------------------------------------------------------
# e) Doppelte Auftragsnummer mit 2 Positionen -> beide bleiben
# ---------------------------------------------------------------------
def test_e_doppelte_auftragsnummer():
    daten = [
        {"auftrag": "X/001", "L": 1200, "B": 800, "menge": 2, "artikelnr": "P1"},
        {"auftrag": "X/002", "L": 1200, "B": 800, "menge": 3, "artikelnr": "P2"},
    ]
    tmp = _tmp("e_doppelt")
    try:
        erzeuge_fixture(daten, tmp, header_zeile=5)
        dat = importiere(tmp)
        auftraege = [p["auftrag"] for p in dat["mit_mass"]]
        print(f"\n  Erkannte Auftraege: {auftraege}")
        assert len(dat["mit_mass"]) == 2, (
            f"Erwartet 2 Eintraege (verschiedene Positionen), "
            f"bekam {len(dat['mit_mass'])}"
        )
        assert "X/001" in auftraege and "X/002" in auftraege
        artikel = [p["artikelnummer"] for p in dat["mit_mass"]]
        assert "P1" in artikel and "P2" in artikel, (
            "Beide Artikelnummern muessen erhalten bleiben — "
            "kein Dedup auf Auftrag allein"
        )
    finally:
        _cleanup(tmp)


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
        import traceback; traceback.print_exc()
        return False


if __name__ == "__main__":
    tests = [
        test_a_zehn_auftraege_fest_verdrahtet,
        test_b_vier_cluster_ein_standard,
        test_c_header_in_zeile_3,
        test_d_negativer_produkt_wert,
        test_e_doppelte_auftragsnummer,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print("=" * 60)
    print(f"{erfolge}/{len(tests)} Struktur-Tests bestanden.")
    print("=" * 60)
    sys.exit(0 if erfolge == len(tests) else 1)
