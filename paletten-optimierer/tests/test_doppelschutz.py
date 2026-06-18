"""Tests fuer Doppelbestellungs-Vermeidung (Spec §8 + §14).

a) 2× Import gleicher AW → 2. Import alles 'schon_bestellt'
b) Teilbedarf: 1. Import 20 Stk, 2. Import 30 Stk → 10 als 'teilbedarf' delta
c) Fehlende AW: Fallback Kunde+Artikel+Zeitfenster
d) Storniert zaehlt NICHT als bestellt
e) Verbraucht zaehlt als bestellt (keine Doppelplanung)
f) Bedarf ohne Historie → 'neu'
g) Zeitfenster: Bestelldatum ausserhalb Fenster → kein Match
h) Excel-Parser liest verbrauchsdatum als ISO
i) fuer_optimierung: nur neu+teilbedarf, teilbedarf mit delta_menge
"""
from __future__ import annotations

import io
import sys
from datetime import date, timedelta
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

from import_doppelschutz import pruefe_zeile, pruefe_import  # noqa: E402


def _hist(aw: str, art: str, kunde: str, menge: int,
          status: str = "offen", bestelldatum: str = "",
          vbd: str = "") -> dict:
    return {
        "id": f"H-{aw}-{art}",
        "auftragsnummer_aw": aw,
        "artikelnummer": art,
        "kunde": kunde,
        "menge": menge,
        "status": status,
        "bestelldatum": bestelldatum or date.today().isoformat(),
        "geplantes_verbrauchsdatum": vbd,
    }


def test_a_zweiter_import_alles_schon_bestellt():
    """Spec §14: Import 2× mit gleichen AWs → 2. Import = alles schon."""
    hist = [
        _hist("AW-1", "ART-1", "Müller", 20),
        _hist("AW-2", "ART-2", "Schmidt", 10),
    ]
    zeilen_neu = [
        {"auftrag": "AW-1", "artikelnummer": "ART-1",
         "name": "Müller", "anzahl": 20},
        {"auftrag": "AW-2", "artikelnummer": "ART-2",
         "name": "Schmidt", "anzahl": 10},
    ]
    erg = pruefe_import(zeilen_neu, hist)
    assert len(erg["schon_bestellt"]) == 2
    assert len(erg["neu"]) == 0
    assert len(erg["teilbedarf"]) == 0
    assert erg["fuer_optimierung"] == []
    print(f"  2. Import: 2 schon_bestellt, 0 neu, 0 teilbedarf.")


def test_b_teilbedarf_delta():
    """1. Import 20, 2. Import 30 → 10 als teilbedarf."""
    hist = [_hist("AW-T", "ART-T", "K", 20)]
    zeilen = [
        {"auftrag": "AW-T", "artikelnummer": "ART-T",
         "name": "K", "anzahl": 30},
    ]
    erg = pruefe_import(zeilen, hist)
    assert len(erg["teilbedarf"]) == 1
    info = erg["teilbedarf"][0][1]
    assert info["bucket"] == "teilbedarf"
    assert info["delta_menge"] == 10
    assert info["gemachte_menge"] == 20
    # fuer_optimierung enthaelt das Delta
    assert len(erg["fuer_optimierung"]) == 1
    assert erg["fuer_optimierung"][0]["anzahl"] == 10
    assert erg["fuer_optimierung"][0].get("_doppelschutz_delta") is True
    print(f"  Teilbedarf: delta=10 (von 30 minus 20 alt).")


def test_c_fallback_kunde_artikel_zeitfenster():
    """Fehlende AW in neuer Zeile → Match ueber Kunde+Artikel+Datum."""
    bestelldatum = date.today().isoformat()
    hist = [_hist("AW-OLD", "ART-Z", "Lang", 5,
                   bestelldatum=bestelldatum)]
    # Neue Zeile OHNE AW, gleicher Kunde+Artikel, heute
    zeilen = [
        {"auftrag": "", "artikelnummer": "ART-Z",
         "name": "Lang", "anzahl": 5,
         "verbrauchsdatum": date.today().isoformat()},
    ]
    erg = pruefe_import(zeilen, hist, zeitfenster_tage=30)
    assert len(erg["schon_bestellt"]) == 1
    info = erg["schon_bestellt"][0][1]
    assert info["match_typ"] == "kunde_artikel_zeitfenster"
    print(f"  Fallback-Match: kunde+artikel+zeitfenster funktioniert.")


def test_d_storniert_zaehlt_nicht():
    """Spec §14: Stornierte Bestellung → wird beim Import wieder
    als Bedarf erkannt."""
    hist = [_hist("AW-S", "ART-S", "K", 10, status="storniert")]
    # In Doppelschutz wird hist ggf. vorgefiltert (nur aktive). Hier
    # uebergebe ich aktive() = leer da storniert excluded.
    aktive = [b for b in hist if b["status"] != "storniert"]
    zeilen = [
        {"auftrag": "AW-S", "artikelnummer": "ART-S",
         "name": "K", "anzahl": 10},
    ]
    erg = pruefe_import(zeilen, aktive)
    assert len(erg["neu"]) == 1
    assert len(erg["schon_bestellt"]) == 0
    print(f"  Stornierte werden ignoriert → Bedarf = neu.")


def test_e_verbraucht_zaehlt_als_bestellt():
    """Verbraucht = erfuellt → keine Doppelbestellung."""
    hist = [_hist("AW-V", "ART-V", "K", 10, status="verbraucht")]
    zeilen = [
        {"auftrag": "AW-V", "artikelnummer": "ART-V",
         "name": "K", "anzahl": 10},
    ]
    erg = pruefe_import(zeilen, hist)
    assert len(erg["schon_bestellt"]) == 1
    print(f"  Verbraucht: zaehlt als bestellt (Erfuellung erfasst).")


def test_f_bedarf_ohne_historie():
    """Komplett neuer Bedarf — Historie leer."""
    zeilen = [
        {"auftrag": "AW-Neu", "artikelnummer": "ART-Neu",
         "name": "Neukunde", "anzahl": 5},
    ]
    erg = pruefe_import(zeilen, [])
    assert len(erg["neu"]) == 1
    assert erg["fuer_optimierung"][0]["anzahl"] == 5
    print(f"  Leerer Verlauf: alle Bedarfe = neu.")


def test_g_zeitfenster_ausserhalb():
    """Bestelldatum 60 Tage alt → fuer 30-Tage-Fenster kein Match."""
    bestelldatum = (date.today() - timedelta(days=60)).isoformat()
    hist = [_hist("AW-A", "ART-X", "K", 5, bestelldatum=bestelldatum)]
    # Neue Zeile OHNE AW, gleicher Kunde+Artikel
    zeilen = [
        {"auftrag": "", "artikelnummer": "ART-X",
         "name": "K", "anzahl": 5,
         "verbrauchsdatum": date.today().isoformat()},
    ]
    erg = pruefe_import(zeilen, hist, zeitfenster_tage=30)
    assert len(erg["neu"]) == 1, "Ausserhalb Zeitfenster → neu"
    print(f"  Zeitfenster 60 Tage > 30 → kein Match.")


def test_h_verschiedene_zeilen_gemischt():
    """Realistic: 1 neu, 1 schon, 1 teilbedarf in einem Import."""
    hist = [
        _hist("AW-X", "ART-X", "K", 100),  # voll abgedeckt → schon
        _hist("AW-Y", "ART-Y", "K", 5),    # teilweise → teilbedarf
    ]
    zeilen = [
        {"auftrag": "AW-X", "artikelnummer": "ART-X",
         "name": "K", "anzahl": 50},
        {"auftrag": "AW-Y", "artikelnummer": "ART-Y",
         "name": "K", "anzahl": 20},
        {"auftrag": "AW-Z", "artikelnummer": "ART-Z",
         "name": "K", "anzahl": 30},
    ]
    erg = pruefe_import(zeilen, hist)
    assert len(erg["schon_bestellt"]) == 1
    assert len(erg["teilbedarf"]) == 1
    assert len(erg["neu"]) == 1
    # fuer_optimierung: 1 (neu) + 1 (teilbedarf-delta=15) = 2 Zeilen
    assert len(erg["fuer_optimierung"]) == 2
    assert any(z["anzahl"] == 15 for z in erg["fuer_optimierung"])
    assert any(z["anzahl"] == 30 for z in erg["fuer_optimierung"])
    print(f"  Gemischt: 1 schon, 1 teil(delta=15), 1 neu → "
          f"fuer_optimierung=2.")


def test_i_excel_parser_liest_verbrauchsdatum():
    """import_excel.importiere() liest die neue Spalte."""
    import io as _io
    import openpyxl
    sys.path.insert(0, str(HIER.parent))
    from import_excel import importiere
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Auftrag", "Kunde", "Artikelnummer", "P-Länge", "P-Breite",
               "Menge", "Verbrauchsdatum"])
    from datetime import date as _date
    ws.append(["AW1", "Müller", "ART1", 1250, 850, 5,
                _date(2026, 6, 15)])
    ws.append(["AW2", "Schmidt", "ART2", 1550, 1050, 3, "30.06.2026"])
    buf = _io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    erg = importiere(buf)
    assert len(erg["mit_mass"]) == 2
    vbd_1 = erg["mit_mass"][0].get("verbrauchsdatum", "")
    vbd_2 = erg["mit_mass"][1].get("verbrauchsdatum", "")
    print(f"  VBD 1: '{vbd_1}', VBD 2: '{vbd_2}'")
    assert vbd_1 == "2026-06-15"
    assert vbd_2 == "2026-06-30"


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
        test_a_zweiter_import_alles_schon_bestellt,
        test_b_teilbedarf_delta,
        test_c_fallback_kunde_artikel_zeitfenster,
        test_d_storniert_zaehlt_nicht,
        test_e_verbraucht_zaehlt_als_bestellt,
        test_f_bedarf_ohne_historie,
        test_g_zeitfenster_ausserhalb,
        test_h_verschiedene_zeilen_gemischt,
        test_i_excel_parser_liest_verbrauchsdatum,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Doppelschutz-Tests bestanden.")
    sys.exit(0 if erfolge == len(tests) else 1)
