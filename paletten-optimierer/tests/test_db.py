"""Tests für die SQLite-Persistenz-Schicht."""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def _setup_temp_db() -> Path:
    """Setzt YOUMAN_DB_PATH auf eine frische temp-Datei und resettet Module."""
    tmp = tempfile.mkdtemp(prefix="youman_test_")
    db_path = Path(tmp) / "youman.db"
    os.environ["YOUMAN_DB_PATH"] = str(db_path)
    # Module reset damit _MIGRATED-Flag und Connection-Cache neu sind
    for m in list(sys.modules):
        if m == "db" or m.startswith("db."):
            del sys.modules[m]
    return db_path


def test_db_pfad_existiert_nach_erststart():
    db_path = _setup_temp_db()
    import db
    db.reset_migration_flag()
    assert not db_path.exists()
    con = db.get_connection()
    assert db_path.exists(), "DB-Datei muss nach get_connection existieren"
    con.close()


def test_schema_idempotent():
    _setup_temp_db()
    import db
    db.reset_migration_flag()
    con = db.get_connection()
    # Zweiter Aufruf darf nicht crashen
    db.reset_migration_flag()
    con2 = db.get_connection()
    # Beide Connections funktionieren
    con.execute("SELECT COUNT(*) FROM auftraege")
    con2.execute("SELECT COUNT(*) FROM auftraege")


def test_speichere_und_lade_auftraege():
    _setup_temp_db()
    import db
    db.reset_migration_flag()
    from optimizer import Palette

    paletten = [
        Palette("ART-1", 1200, 800, anzahl=2, auftrag="110001"),
        Palette("ART-2", 1500, 900, anzahl=1, auftrag="110002"),
    ]
    batch_id = db.neuer_import_batch("test.xlsx", len(paletten))
    ergebnis = db.speichere_auftraege(paletten, batch_id)
    assert ergebnis["neu"] == 2
    assert ergebnis["aktualisiert"] == 0
    assert db.anzahl_auftraege() == 2

    geladen = db.lade_alle_auftraege()
    assert len(geladen) == 2
    assert geladen[0]["artikelnummer"] == "ART-1"
    assert geladen[0]["anzahl"] == 2


def test_re_import_aktualisiert_alte_werte():
    """Re-Import derselben AW+Artikel-Kombination MUSS die alten Werte
    überschreiben — sonst behält die DB veraltete Stände aus früheren
    EXE-Builds und der User sieht trotz Fix die alten Zahlen."""
    _setup_temp_db()
    import db
    db.reset_migration_flag()
    from optimizer import Palette

    # Erster Import: alte (falsche) anzahl=2
    p1 = Palette("ART-1", 1200, 800, anzahl=2, auftrag="110001")
    batch1 = db.neuer_import_batch("a.xlsx", 1)
    erg1 = db.speichere_auftraege([p1], batch1)
    assert erg1["neu"] == 1 and erg1["aktualisiert"] == 0

    # Zweiter Import: gleicher AW+Artikel, aber jetzt anzahl=48
    p2 = Palette("ART-1", 1200, 800, anzahl=48, auftrag="110001")
    batch2 = db.neuer_import_batch("b.xlsx", 1)
    erg2 = db.speichere_auftraege([p2], batch2)
    assert erg2["aktualisiert"] == 1, (
        f"Re-Import muss als 'aktualisiert' zählen, war {erg2}"
    )

    assert db.anzahl_auftraege() == 1, "Es darf weiter genau 1 Auftrag sein"
    geladen = db.lade_alle_auftraege()
    assert geladen[0]["anzahl"] == 48, (
        f"DB hat anzahl={geladen[0]['anzahl']}, erwartet 48 (neuer Wert). "
        f"INSERT OR IGNORE würde hier weiter den alten Wert 2 liefern."
    )


def test_leere_aw_erlaubt_mehrfach_import():
    """Aufträge ohne AW-Nummer dürfen mehrfach eingetragen werden, weil
    sie nicht eindeutig identifizierbar sind."""
    _setup_temp_db()
    import db
    db.reset_migration_flag()
    from optimizer import Palette

    p1 = Palette("X", 1000, 800, anzahl=1, auftrag="")
    p2 = Palette("X", 1000, 800, anzahl=1, auftrag="")
    batch = db.neuer_import_batch("a.xlsx", 2)
    db.speichere_auftraege([p1, p2], batch)
    assert db.anzahl_auftraege() == 2


def test_settings_roundtrip():
    _setup_temp_db()
    import db
    db.reset_migration_flag()
    db.setze_setting("tol_l", 250.0)
    db.setze_setting("modus", "manuell")
    db.setze_setting("liste", [1, 2, 3])
    assert db.lade_setting("tol_l") == 250.0
    assert db.lade_setting("modus") == "manuell"
    assert db.lade_setting("liste") == [1, 2, 3]
    assert db.lade_setting("unbekannt", "fallback") == "fallback"


def test_palettenpreise():
    _setup_temp_db()
    import db
    db.reset_migration_flag()
    db.setze_palettenpreis("1200 × 800 mm", kosten_neu=14.0, kosten_alt=22.0)
    eintrag = db.lade_palettenpreis("1200 × 800 mm")
    assert eintrag is not None
    assert eintrag["kosten_neu"] == 14.0 and eintrag["kosten_alt"] == 22.0

    # Update einzeln (kosten_alt unverändert)
    db.setze_palettenpreis("1200 × 800 mm", kosten_neu=16.0)
    eintrag = db.lade_palettenpreis("1200 × 800 mm")
    assert eintrag["kosten_neu"] == 16.0
    assert eintrag["kosten_alt"] == 22.0


def test_aw_tracking():
    _setup_temp_db()
    import db
    db.reset_migration_flag()
    n = db.markiere_aw_bearbeitet(["A", "B", "C"], "datei1.xlsx")
    assert n == 3
    n2 = db.markiere_aw_bearbeitet(["B", "C", "D"], "datei2.xlsx")
    assert n2 == 1, f"Nur D ist neu, bekam {n2}"
    neu, schon = db.filtere_neue_aws(["A", "B", "E"])
    assert sorted(neu) == ["E"]
    assert sorted(schon) == ["A", "B"]


def test_bestand_db():
    _setup_temp_db()
    import db
    db.reset_migration_flag()
    db.setze_bestand_db("1200 × 800 mm", menge=250, sicherheitsbestand=100)
    bestand = db.lade_bestand_db()
    assert bestand["1200 × 800 mm"]["menge"] == 250
    # Update nur Menge
    db.setze_bestand_db("1200 × 800 mm", menge=200)
    bestand = db.lade_bestand_db()
    assert bestand["1200 × 800 mm"]["menge"] == 200
    assert bestand["1200 × 800 mm"]["sicherheitsbestand"] == 100


def test_persistenz_ueber_connection_close():
    """Daten überleben das Schließen der Connection — wichtig für
    Streamlit, wo jeder Page-Render eine neue Connection bekommt."""
    db_path = _setup_temp_db()
    import db
    db.reset_migration_flag()
    from optimizer import Palette
    batch = db.neuer_import_batch("a.xlsx", 1)
    db.speichere_auftraege([Palette("X", 1000, 800, anzahl=5, auftrag="A1")], batch)
    db.setze_setting("tol_l", 333.0)

    # Simuliere App-Restart: Migration-Flag zurücksetzen
    db.reset_migration_flag()
    # Neue Connection
    con2 = db.get_connection()
    assert db.lade_setting("tol_l") == 333.0
    assert db.anzahl_auftraege() == 1


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except Exception as e:
            print(f"FAIL {t.__name__}: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
    print(f"\n{len(tests)} Tests bestanden.")
