"""Tests: 'Menge' (Spalte M) ist die Palettenanzahl pro Auftrag.

Frühere Versionen nutzten 'P-Anzahl' (Spalte R) plus
ceil(Menge/Stk_Pal)-Fallback — beides ist obsolet. Nur Spalte 'Menge'
zählt. Bei leerer Menge wird 0 verwendet (mit Warnung) und der
Auftrag zählt 0 Paletten, das Maß bleibt aber als Variante.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import openpyxl  # noqa: E402

from excel_handler import importiere_excel  # noqa: E402
from optimizer import Palette, optimiere  # noqa: E402


def _build_excel(rows: list[dict]) -> io.BytesIO:
    """Excel mit Draht-Müller-Layout (Menge in Spalte 'Menge')."""
    wb = openpyxl.Workbook()
    ws = wb.active
    header = ["Artikelnummer", "P-Länge", "P-Breite", "P-Höhe",
              "Menge", "Stck Pal", "Name", "Auftrag"]
    ws.append(header)
    for r in rows:
        ws.append([
            r.get("artikel", ""),
            r.get("laenge", 0),
            r.get("breite", 0),
            r.get("hoehe", ""),
            r.get("menge", ""),
            r.get("stk_pal", ""),
            r.get("kunde", ""),
            r.get("auftrag", ""),
        ])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def test_menge_ist_direkt_palettenanzahl():
    """Spalte 'Menge' = Anzahl Paletten, ohne Berechnung."""
    paletten = importiere_excel(_build_excel([
        {"artikel": "A1", "laenge": 1200, "breite": 800, "menge": 1, "stk_pal": 350},
        {"artikel": "A2", "laenge": 1200, "breite": 800, "menge": 2, "stk_pal": 350},
        {"artikel": "A3", "laenge": 1200, "breite": 800, "menge": 5, "stk_pal": 350},
        {"artikel": "A4", "laenge": 1500, "breite": 900, "menge": 2, "stk_pal": 100},
    ]))
    assert len(paletten) == 4
    assert sum(p.anzahl for p in paletten) == 10


def test_giro_beispiel_menge_48():
    """Auftrag GI-RO: Menge=48 → 48 Paletten (auch wenn Stk_Pal=38)."""
    paletten = importiere_excel(_build_excel([
        {"artikel": "EWM822x880", "laenge": 910, "breite": 850,
         "menge": 48, "stk_pal": 38},
    ]))
    assert paletten[0].anzahl == 48


def test_menge_2_ist_2_nicht_1():
    """Menge=2 muss als 2 Paletten zählen, nicht als 1."""
    paletten = importiere_excel(_build_excel([
        {"artikel": "X", "laenge": 1200, "breite": 800, "menge": 2, "stk_pal": 350},
    ]))
    assert paletten[0].anzahl == 2


def test_leere_menge_wird_0_mit_warnung():
    """Wenn Spalte 'Menge' leer → 0 Paletten + Warnung im Log."""
    log: list[str] = []
    paletten = importiere_excel(_build_excel([
        {"artikel": "X", "laenge": 1200, "breite": 800, "stk_pal": 350,
         "auftrag": "110999"},
    ]), warnungen=log)
    assert paletten[0].anzahl == 0
    assert any("110999" in w and "Menge" in w for w in log), (
        f"Warnung mit Auftragsnummer und 'Menge' erwartet: {log}"
    )


def test_kein_ceil_fallback_kein_plausibilitaets_check():
    """Wenn Stk_Pal vorhanden ist, aber Menge=0 → trotzdem 0
    (nicht ceil(0/stk) und nicht ceil(menge_anderer_spalte/stk))."""
    log: list[str] = []
    paletten = importiere_excel(_build_excel([
        {"artikel": "X", "laenge": 1200, "breite": 800,
         "menge": 0, "stk_pal": 350, "auftrag": "ZERO"},
    ]), warnungen=log)
    assert paletten[0].anzahl == 0
    # Keine "Plausibilitäts"-Warnung mehr — die Logik existiert nicht
    assert all("Plausibilität" not in w for w in log)


def test_p_anzahl_spalte_wird_ignoriert():
    """Selbst wenn jemand 'P-Anzahl' als Spalte schickt, wird sie nicht
    als Palettenanzahl verwendet (Menge gewinnt)."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Artikelnummer", "P-Länge", "P-Breite", "Menge", "P-Anzahl"])
    ws.append(["X", 1200, 800, 5, 99])  # Menge=5, P-Anzahl=99
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    paletten = importiere_excel(buf)
    assert paletten[0].anzahl == 5, (
        f"P-Anzahl=99 darf nicht durchschlagen, Menge=5 muss gewinnen. "
        f"Bekam: {paletten[0].anzahl}"
    )


def test_set_cover_gewichtet_nach_menge():
    """Volumengewichtung: 1 Auftrag mit Menge=500 schlägt 5 mit je Menge=1."""
    paletten = [
        Palette("BIG", 800, 1200, anzahl=500),
        *[Palette(f"S{i}", 1000, 800, anzahl=1) for i in range(5)],
    ]
    erg = optimiere(paletten, 0, 0, "mm", raster=0)
    top = sorted(erg.standards, key=lambda s: -s.gesamt_anzahl)[0]
    assert top.gesamt_anzahl == 500
    assert top.members[0].artikelnummer == "BIG"


def test_summe_menge_gleich_paletten_gesamt_property():
    """erg.paletten_gesamt summiert die anzahl (=Menge) korrekt."""
    paletten = [
        Palette("A", 1200, 800, anzahl=3, auftrag="A1"),
        Palette("B", 1500, 900, anzahl=7, auftrag="B1"),
        Palette("C", 1200, 800, anzahl=2, auftrag="C1"),
    ]
    erg = optimiere(paletten, 50, 50, "mm", raster=0)
    assert erg.paletten_gesamt == 12


def test_kein_p_anzahl_in_optimizer_modul():
    """Smoke test: optimizer.py enthält keine 'P-Anzahl'-Begriffe in
    der Logik mehr (nur evtl. in Kommentaren erlaubt)."""
    import optimizer
    src = Path(optimizer.__file__).read_text()
    # Erlaubt nur in Kommentaren — heuristisch: kein "p_anzahl" als
    # Variable/Feldname
    code = "\n".join(
        line for line in src.splitlines() if not line.strip().startswith("#")
    )
    assert "p_anzahl" not in code.lower(), (
        "Kein 'p_anzahl' in der Optimizer-Logik erlaubt"
    )


def test_kein_ceil_in_excel_handler():
    """ceil-Fallback wurde entfernt."""
    from pathlib import Path
    src = Path(__file__).resolve().parent.parent / "excel_handler.py"
    text = src.read_text()
    # Nur in Kommentaren oder gar nicht
    code = "\n".join(
        line for line in text.splitlines() if not line.strip().startswith("#")
    )
    assert "math.ceil" not in code, (
        "ceil-Fallback muss entfernt sein"
    )


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
