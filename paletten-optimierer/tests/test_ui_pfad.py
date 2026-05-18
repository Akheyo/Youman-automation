"""Roundtrip-Test: der ECHTE UI-Codepfad inklusive DB.

Die UI nimmt nicht direkt das Ergebnis von ``importiere_excel`` —
sie schreibt es in die SQLite-DB und lädt es sofort wieder.
Falls speichere_auftraege/lade_alle_auftraege irgendwo
``anzahl`` verlieren oder INSERT OR IGNORE die neuen Werte
verwirft, sieht der User andere Zahlen als der reine Parser.

Dieser Test bildet den UI-Pfad exakt ab:
1. importiere_excel(draht_mueller_real.xlsx)  → 15 Paletten, Summe 96
2. db.neuer_import_batch(...)
3. db.speichere_auftraege(paletten, batch_id)
4. db.lade_alle_auftraege()                   → wieder Palette-Objekte
5. assert summe == 96 nach DB-Roundtrip
6. zweiter Import derselben Datei: Werte dürfen NICHT verloren gehen
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Test-DB in temp-Verzeichnis, isoliert vom User
_TMP = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_TMP.close()
os.environ["YOUMAN_DB_PATH"] = _TMP.name

import db  # noqa: E402
from excel_handler import importiere_excel  # noqa: E402
from optimizer import Palette  # noqa: E402


FIXTURE = Path(__file__).resolve().parent / "fixtures" / "draht_mueller_real.xlsx"


def _reset_db():
    """Vor jedem Test sauberen DB-Stand herstellen."""
    db.reset_migration_flag()
    if Path(_TMP.name).exists():
        Path(_TMP.name).unlink()
    db.get_connection()  # legt Schema neu an


def _paletten_aus_db() -> list[Palette]:
    """Wie app.py es nach jedem Import macht: aus der DB rekonstruieren."""
    rows = db.lade_alle_auftraege()
    return [
        Palette(
            artikelnummer=r["artikelnummer"],
            laenge=r["laenge"], breite=r["breite"],
            laenge_original=r["laenge_original"],
            breite_original=r["breite_original"],
            hoehe=r["hoehe"], anzahl=r["anzahl"], menge=r["menge"],
            stueck_pro_palette=r["stueck_pro_palette"],
            kosten_alt=r["kosten_alt"], kunde=r["kunde"],
            auftrag=r["auftrag_nr"], kw_lieferung=r["kw_lieferung"],
        )
        for r in rows
    ]


def test_parser_alleine_liefert_96():
    """Sanity-Check: importiere_excel an sich ist korrekt."""
    _reset_db()
    paletten = importiere_excel(FIXTURE)
    summe = sum(p.anzahl for p in paletten)
    print(f"\n  → Parser direkt: {len(paletten)} Aufträge, Summe Menge = {summe}")
    assert summe == 96, f"Parser-Summe = {summe}, erwartet 96"


def test_db_roundtrip_erhaelt_summe_96():
    """KERN-TEST: nach dem DB-Roundtrip muss die Summe weiterhin 96 sein.
    Wenn das fehlschlägt, ist db.speichere_auftraege oder
    db.lade_alle_auftraege der Bug — NICHT der Parser."""
    _reset_db()
    paletten_parser = importiere_excel(FIXTURE)
    batch_id = db.neuer_import_batch("real.xlsx", len(paletten_parser))
    eingefuegt = db.speichere_auftraege(paletten_parser, batch_id)
    print(f"\n  → DB-INSERT: {eingefuegt} Zeilen neu eingefügt")

    aus_db = _paletten_aus_db()
    summe_db = sum(p.anzahl for p in aus_db)
    print(f"  → DB lädt zurück: {len(aus_db)} Aufträge, Summe Menge = {summe_db}")
    print(f"  → anzahl-Werte aus DB: {[p.anzahl for p in aus_db]}")

    assert len(aus_db) == 15, (
        f"DB liefert {len(aus_db)} Aufträge zurück, erwartet 15"
    )
    assert summe_db == 96, (
        f"Summe nach DB-Roundtrip = {summe_db}, erwartet 96. "
        f"→ Bug in speichere_auftraege oder lade_alle_auftraege!"
    )


def test_giro_109767_ueberlebt_db_roundtrip():
    """Der harte GI-RO-Anker muss auch nach dem DB-Roundtrip stimmen."""
    _reset_db()
    paletten = importiere_excel(FIXTURE)
    batch_id = db.neuer_import_batch("real.xlsx", len(paletten))
    db.speichere_auftraege(paletten, batch_id)

    aus_db = _paletten_aus_db()
    giro = [p for p in aus_db if p.auftrag == "109767"]
    assert len(giro) == 1, f"GI-RO nach DB-Roundtrip nicht eindeutig: {len(giro)}"
    print(f"\n  → GI-RO 109767 nach DB-Roundtrip: anzahl={giro[0].anzahl}")
    assert giro[0].anzahl == 48, (
        f"GI-RO 109767 anzahl nach DB-Roundtrip = {giro[0].anzahl}, erwartet 48"
    )


def test_re_import_aktualisiert_alte_werte_nicht_nur_ignore():
    """SIMULIERT DEN USER-FALL: erst alter Build importiert mit
    anzahl=1 in die DB, dann neuer Build importiert mit korrekter
    Menge=48. Die DB MUSS den neuen Wert enthalten, NICHT mehr 1.

    Wenn dieser Test rot ist, hat der User auch nach Update keinen
    Erfolg, weil INSERT OR IGNORE die korrekten Werte verwirft."""
    _reset_db()

    # 1. Alter Build (Simulation): alle anzahl=1 (P-Anzahl-Bug)
    alter_import = [
        Palette(
            artikelnummer="EWM822x880/001",
            laenge=910, breite=850, hoehe=1300,
            laenge_original=910, breite_original=850,
            anzahl=1,  # ← Bug: P-Anzahl statt Menge
            menge=1,
            stueck_pro_palette=38,
            kunde="GI-RO Technik GmbH",
            auftrag="109767",
            kw_lieferung="2622",
        )
    ]
    batch_alt = db.neuer_import_batch("alt.xlsx", 1)
    db.speichere_auftraege(alter_import, batch_alt)

    # Prüfung Zwischenstand
    nach_alt = _paletten_aus_db()
    print(f"\n  → Nach altem Import: GI-RO anzahl = {nach_alt[0].anzahl}")
    assert nach_alt[0].anzahl == 1, "Setup-Fehler im Test"

    # 2. Neuer Build (Fix): importiert echte Excel mit anzahl=48
    paletten_neu = importiere_excel(FIXTURE)
    batch_neu = db.neuer_import_batch("real.xlsx", len(paletten_neu))
    db.speichere_auftraege(paletten_neu, batch_neu)

    # Prüfung: GI-RO muss jetzt 48 sein, NICHT mehr 1
    nach_neu = _paletten_aus_db()
    giro = [p for p in nach_neu if p.auftrag == "109767"]
    print(f"  → Nach neuem Re-Import: GI-RO Treffer = {len(giro)}, "
          f"anzahl-Werte = {[p.anzahl for p in giro]}")
    assert len(giro) >= 1, "GI-RO nach Re-Import fehlt"
    assert any(p.anzahl == 48 for p in giro), (
        f"GI-RO anzahl nach Re-Import: {[p.anzahl for p in giro]}. "
        f"Erwartet mindestens einen Eintrag mit anzahl=48. "
        f"→ INSERT OR IGNORE verwirft die korrigierten Werte. "
        f"→ DAS ist die Lücke zwischen Test-Pfad und EXE-Pfad."
    )


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
        test_parser_alleine_liefert_96,
        test_db_roundtrip_erhaelt_summe_96,
        test_giro_109767_ueberlebt_db_roundtrip,
        test_re_import_aktualisiert_alte_werte_nicht_nur_ignore,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print("="*60)
    print(f"{erfolge}/{len(tests)} Tests bestanden.")
    print("="*60)
    sys.exit(0 if erfolge == len(tests) else 1)
