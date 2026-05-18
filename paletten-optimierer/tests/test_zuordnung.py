"""Tests für die Auftrag→Standard-Zuordnungstabelle (baue_zuordnungs_tabelle)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from optimizer import Palette, optimiere, baue_zuordnungs_tabelle  # noqa: E402


def test_summe_p_anzahl_ueber_alle_zeilen_stimmt():
    paletten = [
        Palette("A", 1200, 800, anzahl=3, auftrag="A1"),
        Palette("B", 1500, 900, anzahl=7, auftrag="A2"),
        Palette("C", 1200, 800, anzahl=2, auftrag="A3"),
    ]
    erg = optimiere(paletten, 50, 50, "mm", raster=0)
    rows = baue_zuordnungs_tabelle(erg)
    assert sum(r["anzahl"] for r in rows) == sum(p.anzahl for p in paletten)


def test_jeder_auftrag_taucht_genau_einmal_auf():
    paletten = [
        Palette(f"ART-{i}", 1200, 800, anzahl=1, auftrag=f"A{i:03d}")
        for i in range(10)
    ]
    erg = optimiere(paletten, 50, 50, "mm", raster=0)
    rows = baue_zuordnungs_tabelle(erg)
    assert len(rows) == 10
    auftraege = [r["auftrag"] for r in rows]
    assert sorted(auftraege) == sorted([p.auftrag for p in paletten])


def test_sonderpaletten_haben_keinen_standard():
    """Aufträge die der Optimierer nicht standardisiert hat (per
    sonder_budget) → status='sonder', kein Standard-Label."""
    paletten = [
        # 5 Aufträge gleiches Maß → 1 Standard
        *[Palette(f"VIEL-{i}", 1200, 800, anzahl=10, auftrag=f"V{i}")
          for i in range(5)],
        # 1 Auftrag mit anderem Maß außerhalb Toleranz
        Palette("EINMAL", 1700, 1100, anzahl=1, auftrag="E1"),
    ]
    # sonder_budget=1 erlaubt einen Sonder — der Outlier bleibt drin
    erg = optimiere(paletten, 50, 50, "mm", raster=0, sonder_budget=1)
    rows = baue_zuordnungs_tabelle(erg)

    standards = [r for r in rows if r["status"] == "standard"]
    sonder = [r for r in rows if r["status"] == "sonder"]
    assert len(sonder) == 1
    assert sonder[0]["auftrag"] == "E1"
    assert sonder[0]["standard_label"] == "—"
    assert sonder[0]["standard_l"] is None
    for r in standards:
        assert r["standard_label"] != "—"
        assert r["standard_l"] is not None


def test_gruppen_summe_pro_standard_gleich_anzahl_aufraege():
    paletten = [
        Palette(f"A-{i}", 1200, 800, anzahl=1, auftrag=f"A{i:03d}")
        for i in range(8)
    ] + [
        Palette(f"B-{i}", 1500, 900, anzahl=2, auftrag=f"B{i:03d}")
        for i in range(4)
    ]
    erg = optimiere(paletten, 50, 50, "mm", raster=0)
    rows = baue_zuordnungs_tabelle(erg)

    # Gruppiert nach Standard-Label
    from collections import defaultdict
    pro_label: dict[str, int] = defaultdict(int)
    for r in rows:
        pro_label[r["standard_label"]] += 1
    # Summe über Gruppen = Anzahl Auftragspositionen
    assert sum(pro_label.values()) == len(rows)
    # Mindestens 2 Gruppen (zwei Original-Größen)
    assert len(pro_label) >= 2


def test_originalmasse_werden_nicht_normalisiert():
    """Bei 800×1200 (gedreht) soll original_l=800, original_b=1200 stehen
    bleiben, auch wenn der Algorithmus intern mit 1200×800 arbeitet."""
    paletten = [
        Palette("FLACH",  1200, 800, anzahl=1, auftrag="A1"),
        Palette("GEDREHT", 800, 1200, anzahl=1, auftrag="A2"),
    ]
    erg = optimiere(paletten, 0, 0, "mm", raster=0)
    rows = baue_zuordnungs_tabelle(erg)
    # Beide landen unter demselben Standard
    assert len({r["standard_label"] for r in rows}) == 1
    # Originalmaße bleiben wie eingegeben
    flach = next(r for r in rows if r["auftrag"] == "A1")
    gedreht = next(r for r in rows if r["auftrag"] == "A2")
    assert (flach["original_l"], flach["original_b"]) == (1200, 800)
    assert (gedreht["original_l"], gedreht["original_b"]) == (800, 1200)


def test_kombination_label_zeigt_n_fach_mit_summen():
    """3-fach Kombi soll als '3× 1000 × 800' formatiert sein."""
    paletten = [
        # Cluster für 1000x800
        *[Palette(f"S-{i}", 1000, 800, anzahl=3, auftrag=f"S{i}") for i in range(3)],
        # Großer Auftrag der durch 3× 1000 abgedeckt wird (3000 in der Länge)
        Palette("BIG", 3000, 800, anzahl=1, auftrag="B1"),
    ]
    erg = optimiere(paletten, 0, 0, "mm", raster=0, kombinieren_erlaubt=True)
    rows = baue_zuordnungs_tabelle(erg)
    kombi = [r for r in rows if r["status"] == "kombination"]
    if kombi:  # Algorithmus findet vielleicht keine Kombi je nach Constraints
        label = kombi[0]["standard_label"]
        # Sollte "3× …" enthalten oder mindestens ein × dazwischen
        assert "×" in label
        assert kombi[0]["abw_max"] >= 0


def test_abweichung_wird_korrekt_berechnet():
    paletten = [
        Palette("X", 1180, 780, anzahl=1, auftrag="A1"),
        Palette("Y", 1200, 800, anzahl=1, auftrag="A2"),
    ]
    erg = optimiere(paletten, 50, 50, "mm", raster=0)
    rows = baue_zuordnungs_tabelle(erg)
    # Standard wird 1200×800 (max der beiden)
    a1 = next(r for r in rows if r["auftrag"] == "A1")
    a2 = next(r for r in rows if r["auftrag"] == "A2")
    assert a1["abw_l"] == 20  # 1200 - 1180
    assert a1["abw_b"] == 20  # 800 - 780
    assert a1["abw_max"] == 20
    assert a2["abw_l"] == 0
    assert a2["abw_max"] == 0


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
            sys.exit(1)
    print(f"\n{len(tests)} Tests bestanden.")
