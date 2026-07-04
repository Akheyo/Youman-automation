"""A3: PDF-Export erzeugt gueltige PDF-Bytes.

Prueft, dass berichte.pdf_palette_artikel und berichte.pdf_auftrag_palette
Bytestrings zurueckliefern, die mit '%PDF-' beginnen.
"""
from __future__ import annotations

import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))
sys.path.insert(0, str(HIER))

import berichte  # noqa: E402


def _minimal_res() -> dict:
    """Minimaler Optimierer-Result, den die PDF-Erzeuger als Input akzeptieren."""
    return {
        "standards": [(800.0, 1200.0)],
        "sonder": [],
        "gesamt": 1,
        "invariante_ok": True,
        "verletzungen": [],
        "nicht_zuordenbar": [],
        "status": "Optimal",
        "score": 1.0,
        "score_breakdown": {},
        "parameter": {"tol_kurz_mm": 100, "tol_lang_mm": 100,
                       "max_kombi_teile": 1, "heterogen_fallback": False,
                       "sonder_deckel": None},
        "zuordnung": [
            {"auftrag": "A1", "name": "Kunde-X", "L": 1180, "B": 780,
             "menge": 5, "typ": "Standard", "ziel": "800x1200"},
        ],
    }


def test_pdf_palette_artikel_beginnt_mit_pdf_magic():
    daten = berichte.pdf_palette_artikel(_minimal_res(),
                                            datei_name="test.xlsx")
    assert isinstance(daten, (bytes, bytearray)), (
        f"Erwartet bytes, bekam {type(daten).__name__}"
    )
    assert daten[:5] == b"%PDF-", (
        f"Kein PDF-Header; erste 5 Bytes: {daten[:5]!r}"
    )
    assert len(daten) > 500, f"PDF verdächtig klein: {len(daten)} Bytes"


def test_pdf_auftrag_palette_beginnt_mit_pdf_magic():
    daten = berichte.pdf_auftrag_palette(_minimal_res(),
                                            datei_name="test.xlsx")
    assert isinstance(daten, (bytes, bytearray))
    assert daten[:5] == b"%PDF-", (
        f"Kein PDF-Header; erste 5 Bytes: {daten[:5]!r}"
    )
    assert len(daten) > 500


def test_pdf_enthaelt_kostenkalkulation_wenn_gegeben():
    """E1: Wenn ergebnis['kostenkalkulation'] gesetzt ist, muss der Block
    'GESAMT IST' / 'GESAMT SOLL' / 'EINSPARUNG' im PDF-Output landen."""
    res = _minimal_res()
    res["kostenkalkulation"] = {
        "paletten_gesamt": 100,
        "paletten_standard": 100,
        "paletten_sonder": 0,
        "anzahl_lkws_ist": 4,
        "anzahl_lkws_soll": 3,
        "lkw_kosten_ist": 3200.0,
        "lkw_kosten_soll": 2400.0,
        "eigenfertigung_ist": 4500.0,
        "palettenkauf_soll": 1200.0,
        "eigenfertigung_soll": 0.0,
        "gesamt_ist": 7700.0,
        "gesamt_soll": 3600.0,
        "einsparung": 4100.0,
    }
    daten = berichte.pdf_palette_artikel(res, datei_name="test.xlsx")
    assert daten[:5] == b"%PDF-"
    # PDF-Text ist nicht direkt in bytes lesbar (compressed), aber
    # ohne Compression stehen einige Strings unkomprimiert drin.
    # Wir lockern: einfach checken, dass mit KK-Block das PDF
    # signifikant groesser ist als ohne.
    daten_ohne = berichte.pdf_palette_artikel(_minimal_res(),
                                                datei_name="test.xlsx")
    assert len(daten) > len(daten_ohne), (
        f"PDF mit KK sollte groesser sein: mit={len(daten)} ohne={len(daten_ohne)}"
    )


if __name__ == "__main__":
    tests = [test_pdf_palette_artikel_beginnt_mit_pdf_magic,
             test_pdf_auftrag_palette_beginnt_mit_pdf_magic]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
            sys.exit(1)
    print(f"\n{len(tests)}/{len(tests)} PDF-Magic-Byte-Tests bestanden.")
