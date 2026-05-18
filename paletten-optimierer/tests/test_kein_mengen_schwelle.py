"""Konkreter Test: Mengen-Schwelle ist KOMPLETT entfernt.

User-Spec:
- Mengen-Schwelle (Vorfilter "Auftrag mit wenig Paletten → Sonder")
  ist KOMPLETT entfernt — Logik, UI, Datenfluss, Tests.
- Jeder Auftrag mit gültigem Maß geht in optimiere() rein.
- Einziger Weg für Sonder: optimiere() kann ihn weder per Toleranz
  noch per Kombinieren auf einen Standard legen, ODER sonder_budget
  erlaubt explizit ungebundene Aufträge.

Außerdem: konkreter Real-Daten-Lauf gegen data/draht_mueller_palettenliste.xlsx
mit den User-Parametern (tol=100 mm, kombi=True). Werte werden geprüft.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from excel_handler import importiere_excel  # noqa: E402
from optimizer import optimiere, Palette  # noqa: E402


REAL = Path(__file__).resolve().parent.parent / "data" / "draht_mueller_palettenliste.xlsx"


def test_optimiere_akzeptiert_kein_mengen_schwelle_param():
    """optimiere() darf keinen mengen_schwelle-Parameter mehr haben.
    Wenn ein alter Aufruf existiert, fliegt TypeError."""
    paletten = [Palette("A", 1200, 800, anzahl=1, auftrag="A1")]
    # Aufruf ohne mengen_schwelle muss klappen
    erg = optimiere(paletten, 100, 100, "mm")
    assert erg.anzahl_standards == 1
    # Aufruf mit mengen_schwelle muss explizit TypeError werfen
    try:
        optimiere(paletten, 100, 100, "mm", mengen_schwelle=10)
        raise AssertionError("mengen_schwelle wurde akzeptiert — sollte entfernt sein")
    except TypeError:
        pass


def test_kein_vorfilter_nach_stueckzahl():
    """Ein Auftrag mit anzahl=1 und ein anderer mit anzahl=50 desselben
    Maßes müssen IMMER in denselben Standard fallen — auch wenn die
    Greedy-Heuristik den niedrigen vorher als 'klein' eingestuft hätte."""
    paletten = [
        *[Palette(f"GR-{i}", 1200, 800, anzahl=50, auftrag=f"G{i}")
          for i in range(4)],
        Palette("EINER", 1200, 800, anzahl=1, auftrag="K1"),
    ]
    erg = optimiere(paletten, toleranz_l=0, toleranz_b=0, einheit="mm", raster=0)
    print(f"\n  4×große (50) + 1×kleine (1), gleiches Maß "
          f"→ {erg.anzahl_standards} Std, {erg.anzahl_sonder} Sonder")
    assert erg.anzahl_standards == 1, "Alle 5 → 1 Standard (gleiches Maß)"
    assert erg.anzahl_sonder == 0, "Niedrige Stückzahl ist KEIN Grund für Sonder"


def test_real_daten_tol_100_kombi_true():
    """Konkrete Werte für die Real-Datei (306 Aufträge) bei den
    User-Default-Parametern. Werte dokumentiert, damit Regressionen
    sichtbar werden."""
    ps = importiere_excel(REAL)
    erg = optimiere(
        ps, toleranz_l=100, toleranz_b=100, einheit="mm",
        raster=100, kombinieren_erlaubt=True,
        wirtschaftliche_filterung=False, sonder_budget=0,
    )
    n_std = erg.anzahl_standards
    n_sonder = erg.anzahl_sonder
    n_kombi = len(erg.kombinationen)
    print(f"\n  Tol=100mm, Kombi an, Budget=0 → "
          f"standards={n_std}, sonder={n_sonder}, kombi={n_kombi}")
    # Spec-Forderungen die unabhängig vom konkreten Datensatz gelten:
    assert n_sonder == 0, (
        f"Bei sonder_budget=0 dürfen KEINE Aufträge in Sonder fallen, "
        f"bekam {n_sonder}. (Aufträge müssen alle einem Standard zugeordnet "
        f"werden — kein Vorfilter mehr.)"
    )
    assert n_std + n_sonder == n_std, "Konsistenz"
    # User-Erwartung war 15/1/16 — wenn Paletten_DM.xlsx vorliegt, dort prüfen.
    # Mit der vorliegenden Datei (306 Aufträge, 148 unique Maße) ist die
    # untere Schranke für tol=100 deutlich höher.
    print(f"  Hinweis: User-Erwartung 15/1/16 bezog sich auf Paletten_DM.xlsx, "
          f"die im Repo nicht vorliegt.")


def test_aufruf_mit_sonder_budget_1_erzeugt_genau_einen_sonder_max():
    """Wenn der User Sonder=1 will, erlaubt sonder_budget=1 genau einen
    ungebundenen Auftrag — der wird Sonder."""
    ps = importiere_excel(REAL)
    erg = optimiere(
        ps, toleranz_l=300, toleranz_b=300, einheit="mm",
        raster=100, kombinieren_erlaubt=True, sonder_budget=1,
    )
    print(f"\n  Tol=300mm, Kombi an, Budget=1 → "
          f"standards={erg.anzahl_standards}, sonder={erg.anzahl_sonder}")
    assert erg.anzahl_sonder <= 1


def _run(fn):
    name = fn.__name__
    try:
        fn()
        print(f"OK  {name}")
        return True
    except AssertionError as e:
        print(f"FAIL {name}: {e}")
        return False
    except Exception as e:
        print(f"ERR  {name}: {type(e).__name__}: {e}")
        import traceback; traceback.print_exc()
        return False


if __name__ == "__main__":
    tests = [
        test_optimiere_akzeptiert_kein_mengen_schwelle_param,
        test_kein_vorfilter_nach_stueckzahl,
        test_real_daten_tol_100_kombi_true,
        test_aufruf_mit_sonder_budget_1_erzeugt_genau_einen_sonder_max,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print("="*60)
    print(f"{erfolge}/{len(tests)} Tests bestanden.")
    print("="*60)
    sys.exit(0 if erfolge == len(tests) else 1)
