"""SQLite-Persistenz für Youman.

Eine einzige DB-Datei hält alle Anwendungsdaten:

- ``import_batches``   — jeder Excel-Upload bekommt eine Batch-ID
- ``auftraege``        — die Roh-Daten pro Auftragsposition
- ``palettenpreise``   — Stückkosten pro Palettentyp (Override des
                         globalen Defaults aus ``settings``)
- ``settings``         — Key-Value-Store für Toleranz, Modus, LKW-Kosten,
                         Sonder-Budget etc.
- ``bestand``          — Lagerbestand je Palettentyp
- ``bestellungen``     — Bestellhistorie
- ``bearbeitete_auftraege`` — AW-Tracking für Doppelimport-Schutz

Pfad:
- Windows-EXE:   ``%APPDATA%/Youman/data/youman.db``
- Linux/Mac:     ``~/.youman/youman.db``
- Override:      Umgebungsvariable ``YOUMAN_DB_PATH``

Die Schema-Migration läuft idempotent beim ersten ``get_connection()``-
Aufruf und ist sicher mehrfach aufrufbar.
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


_MIGRATED = False


def _db_pfad() -> Path:
    """Liefert den Pfad zur SQLite-Datei."""
    env = os.environ.get("YOUMAN_DB_PATH")
    if env:
        return Path(env)
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "Youman" / "data"
    else:
        base = Path.home() / ".youman"
    base.mkdir(parents=True, exist_ok=True)
    return base / "youman.db"


def get_connection() -> sqlite3.Connection:
    """Liefert eine Connection. Migration läuft beim ersten Aufruf einer
    Streamlit-Session."""
    pfad = _db_pfad()
    pfad.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(pfad), detect_types=sqlite3.PARSE_DECLTYPES)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA journal_mode = WAL")
    global _MIGRATED
    if not _MIGRATED:
        _migrate(con)
        _MIGRATED = True
    return con


def reset_migration_flag() -> None:
    """Nur für Tests: erlaubt erneute Migration in derselben Prozess-Instanz."""
    global _MIGRATED
    _MIGRATED = False


def _migrate(con: sqlite3.Connection) -> None:
    """Schema anlegen (idempotent)."""
    cur = con.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS import_batches (
            batch_id INTEGER PRIMARY KEY AUTOINCREMENT,
            datei_name TEXT NOT NULL,
            importiert_am TEXT NOT NULL,
            anzahl_zeilen INTEGER NOT NULL DEFAULT 0,
            quelle TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS auftraege (
            auftrag_id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER REFERENCES import_batches(batch_id),
            artikelnummer TEXT NOT NULL,
            laenge REAL NOT NULL,
            breite REAL NOT NULL,
            hoehe REAL NOT NULL DEFAULT 0,
            laenge_original REAL NOT NULL,
            breite_original REAL NOT NULL,
            anzahl INTEGER NOT NULL DEFAULT 1,
            menge INTEGER NOT NULL DEFAULT 0,
            stueck_pro_palette INTEGER NOT NULL DEFAULT 0,
            kosten_alt REAL NOT NULL DEFAULT 0,
            kunde TEXT NOT NULL DEFAULT '',
            auftrag_nr TEXT NOT NULL DEFAULT '',
            kw_lieferung TEXT NOT NULL DEFAULT '',
            importiert_am TEXT NOT NULL
        );

        -- Verhindert doppelte Aufträge (gleiche AW + Artikel + Datei wird
        -- nur einmal eingetragen). NULL/leere AW erlauben Duplikate weil
        -- dann keine eindeutige Kennzeichnung möglich ist.
        CREATE UNIQUE INDEX IF NOT EXISTS idx_auftraege_unique
            ON auftraege (auftrag_nr, artikelnummer)
            WHERE auftrag_nr != '';

        CREATE INDEX IF NOT EXISTS idx_auftraege_batch ON auftraege (batch_id);
        CREATE INDEX IF NOT EXISTS idx_auftraege_aw ON auftraege (auftrag_nr);

        CREATE TABLE IF NOT EXISTS palettenpreise (
            typ_label TEXT PRIMARY KEY,
            kosten_neu REAL,
            kosten_alt REAL,
            aktualisiert_am TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            aktualisiert_am TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bestand (
            palettentyp TEXT PRIMARY KEY,
            menge INTEGER NOT NULL DEFAULT 0,
            sicherheitsbestand INTEGER NOT NULL DEFAULT 100,
            aktualisiert_am TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bestellungen (
            bestell_id TEXT PRIMARY KEY,
            datum TEXT NOT NULL,
            palettentyp TEXT NOT NULL,
            menge INTEGER NOT NULL,
            geplantes_verbrauchsdatum TEXT NOT NULL,
            auftragsnummer TEXT DEFAULT '',
            kunde TEXT DEFAULT '',
            artikelnummern TEXT DEFAULT '[]',  -- JSON list
            status TEXT NOT NULL DEFAULT 'offen'
        );

        CREATE TABLE IF NOT EXISTS bearbeitete_auftraege (
            auftrag_nr TEXT PRIMARY KEY,
            datum TEXT NOT NULL,
            quelle TEXT DEFAULT ''
        );
    """)
    con.commit()


# ---------------------------------------------------------------------------
# Import-Batches
# ---------------------------------------------------------------------------

def neuer_import_batch(datei_name: str, anzahl_zeilen: int, quelle: str = "") -> int:
    """Legt einen neuen Import-Batch an und liefert die Batch-ID."""
    con = get_connection()
    cur = con.cursor()
    cur.execute(
        "INSERT INTO import_batches (datei_name, importiert_am, anzahl_zeilen, quelle)"
        " VALUES (?, ?, ?, ?)",
        (datei_name, datetime.now().isoformat(timespec="seconds"), anzahl_zeilen, quelle),
    )
    con.commit()
    return int(cur.lastrowid)


def lade_letzten_batch() -> dict | None:
    con = get_connection()
    row = con.execute(
        "SELECT * FROM import_batches ORDER BY batch_id DESC LIMIT 1"
    ).fetchone()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Aufträge (Roh-Daten)
# ---------------------------------------------------------------------------

def speichere_auftraege(paletten: list, batch_id: int) -> dict:
    """Schreibt eine Liste ``Palette`` in die DB. Bei Konflikt mit
    bestehender Zeile (gleiche AW + Artikelnummer) wird die alte
    Zeile **überschrieben**, NICHT ignoriert.

    Damit gewinnt beim Re-Import einer Datei immer der jüngere Wert —
    sonst behält die DB veraltete Stände aus früheren EXE-Versionen
    und der User sieht die alten Zahlen trotz Fix.

    Returns: dict mit ``{"neu": int, "aktualisiert": int}``.
    """
    con = get_connection()
    cur = con.cursor()
    jetzt = datetime.now().isoformat(timespec="seconds")
    neu = 0
    aktualisiert = 0
    for p in paletten:
        try:
            # Bestehende Zeile mit gleicher AW + Artikel löschen (nur wenn
            # AW vorhanden — bei leerer AW gibt es keine Identität, mehrfach-
            # Inserts sind dann erlaubt).
            geloescht = 0
            if p.auftrag:
                cur.execute(
                    "DELETE FROM auftraege WHERE auftrag_nr = ? AND artikelnummer = ?",
                    (p.auftrag, p.artikelnummer),
                )
                geloescht = cur.rowcount or 0
            cur.execute(
                """INSERT INTO auftraege (
                    batch_id, artikelnummer, laenge, breite, hoehe,
                    laenge_original, breite_original, anzahl, menge,
                    stueck_pro_palette, kosten_alt, kunde, auftrag_nr,
                    kw_lieferung, importiert_am
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    batch_id, p.artikelnummer, p.laenge, p.breite, p.hoehe,
                    p.laenge_original or p.laenge,
                    p.breite_original or p.breite,
                    p.anzahl, p.menge, p.stueck_pro_palette, p.kosten_alt,
                    p.kunde, p.auftrag, p.kw_lieferung, jetzt,
                ),
            )
            if geloescht > 0:
                aktualisiert += 1
            else:
                neu += 1
        except sqlite3.IntegrityError:
            continue
    con.commit()
    return {"neu": neu, "aktualisiert": aktualisiert}


def lade_alle_auftraege() -> list[dict]:
    """Alle Aufträge als Dictionaries, ältester zuerst."""
    con = get_connection()
    rows = con.execute("SELECT * FROM auftraege ORDER BY auftrag_id").fetchall()
    return [dict(r) for r in rows]


def loesche_alle_auftraege() -> int:
    con = get_connection()
    cur = con.cursor()
    cur.execute("DELETE FROM auftraege")
    cur.execute("DELETE FROM import_batches")
    cur.execute("DELETE FROM bearbeitete_auftraege")
    con.commit()
    return cur.rowcount


def anzahl_auftraege() -> int:
    con = get_connection()
    return int(con.execute("SELECT COUNT(*) FROM auftraege").fetchone()[0])


# ---------------------------------------------------------------------------
# Settings (Key-Value)
# ---------------------------------------------------------------------------

def setze_setting(key: str, value: Any) -> None:
    con = get_connection()
    con.execute(
        "INSERT INTO settings (key, value, aktualisiert_am) VALUES (?, ?, ?)"
        " ON CONFLICT(key) DO UPDATE SET value=excluded.value,"
        "   aktualisiert_am=excluded.aktualisiert_am",
        (key, json.dumps(value), datetime.now().isoformat(timespec="seconds")),
    )
    con.commit()


def lade_setting(key: str, default: Any = None) -> Any:
    con = get_connection()
    row = con.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    if row is None:
        return default
    try:
        return json.loads(row["value"])
    except (json.JSONDecodeError, TypeError):
        return default


def lade_alle_settings() -> dict[str, Any]:
    con = get_connection()
    rows = con.execute("SELECT key, value FROM settings").fetchall()
    out: dict[str, Any] = {}
    for r in rows:
        try:
            out[r["key"]] = json.loads(r["value"])
        except (json.JSONDecodeError, TypeError):
            out[r["key"]] = r["value"]
    return out


# ---------------------------------------------------------------------------
# Palettenpreise (pro Typ)
# ---------------------------------------------------------------------------

def setze_palettenpreis(
    typ_label: str,
    kosten_neu: float | None = None,
    kosten_alt: float | None = None,
) -> None:
    con = get_connection()
    bestehend = lade_palettenpreis(typ_label)
    con.execute(
        "INSERT INTO palettenpreise (typ_label, kosten_neu, kosten_alt, aktualisiert_am)"
        " VALUES (?, ?, ?, ?)"
        " ON CONFLICT(typ_label) DO UPDATE SET"
        "   kosten_neu = COALESCE(excluded.kosten_neu, palettenpreise.kosten_neu),"
        "   kosten_alt = COALESCE(excluded.kosten_alt, palettenpreise.kosten_alt),"
        "   aktualisiert_am = excluded.aktualisiert_am",
        (typ_label, kosten_neu, kosten_alt, datetime.now().isoformat(timespec="seconds")),
    )
    con.commit()


def lade_palettenpreis(typ_label: str) -> dict | None:
    con = get_connection()
    row = con.execute(
        "SELECT * FROM palettenpreise WHERE typ_label = ?", (typ_label,)
    ).fetchone()
    return dict(row) if row else None


def lade_alle_palettenpreise() -> dict[str, dict]:
    con = get_connection()
    rows = con.execute("SELECT * FROM palettenpreise").fetchall()
    return {r["typ_label"]: dict(r) for r in rows}


def loesche_palettenpreis(typ_label: str) -> None:
    con = get_connection()
    con.execute("DELETE FROM palettenpreise WHERE typ_label = ?", (typ_label,))
    con.commit()


# ---------------------------------------------------------------------------
# Bestand (migriert von JSON)
# ---------------------------------------------------------------------------

def lade_bestand_db() -> dict[str, dict]:
    con = get_connection()
    rows = con.execute("SELECT * FROM bestand").fetchall()
    return {
        r["palettentyp"]: {
            "menge": r["menge"],
            "sicherheitsbestand": r["sicherheitsbestand"],
        }
        for r in rows
    }


def setze_bestand_db(
    palettentyp: str,
    menge: int | None = None,
    sicherheitsbestand: int | None = None,
) -> None:
    con = get_connection()
    jetzt = datetime.now().isoformat(timespec="seconds")
    bestehend = con.execute(
        "SELECT * FROM bestand WHERE palettentyp = ?", (palettentyp,)
    ).fetchone()
    if bestehend is None:
        con.execute(
            "INSERT INTO bestand (palettentyp, menge, sicherheitsbestand, aktualisiert_am)"
            " VALUES (?, ?, ?, ?)",
            (palettentyp, menge or 0, sicherheitsbestand or 100, jetzt),
        )
    else:
        neu_menge = menge if menge is not None else bestehend["menge"]
        neu_sb = (sicherheitsbestand if sicherheitsbestand is not None
                  else bestehend["sicherheitsbestand"])
        con.execute(
            "UPDATE bestand SET menge=?, sicherheitsbestand=?, aktualisiert_am=?"
            " WHERE palettentyp=?",
            (neu_menge, neu_sb, jetzt, palettentyp),
        )
    con.commit()


def setze_sicherheitsbestand_global_db(wert: int) -> None:
    con = get_connection()
    con.execute(
        "UPDATE bestand SET sicherheitsbestand=?, aktualisiert_am=?",
        (wert, datetime.now().isoformat(timespec="seconds")),
    )
    con.commit()


# ---------------------------------------------------------------------------
# Bestellungen
# ---------------------------------------------------------------------------

def speichere_bestellung_db(b: dict) -> None:
    con = get_connection()
    con.execute(
        """INSERT OR REPLACE INTO bestellungen (
            bestell_id, datum, palettentyp, menge, geplantes_verbrauchsdatum,
            auftragsnummer, kunde, artikelnummern, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            b["bestell_id"], b["datum"], b["palettentyp"], b["menge"],
            b["geplantes_verbrauchsdatum"], b.get("auftragsnummer", ""),
            b.get("kunde", ""), json.dumps(b.get("artikelnummern", [])),
            b.get("status", "offen"),
        ),
    )
    con.commit()


def lade_bestellungen_db() -> list[dict]:
    con = get_connection()
    rows = con.execute("SELECT * FROM bestellungen ORDER BY datum DESC").fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["artikelnummern"] = json.loads(d["artikelnummern"] or "[]")
        except (json.JSONDecodeError, TypeError):
            d["artikelnummern"] = []
        out.append(d)
    return out


def aktualisiere_bestellstatus_db(bestell_id: str, status: str) -> None:
    con = get_connection()
    con.execute(
        "UPDATE bestellungen SET status=? WHERE bestell_id=?",
        (status, bestell_id),
    )
    con.commit()


# ---------------------------------------------------------------------------
# AW-Tracking (Doppelimport-Schutz)
# ---------------------------------------------------------------------------

def markiere_aw_bearbeitet(awnrn: list[str], quelle: str = "") -> int:
    """Markiert AWs als bearbeitet. Returns Anzahl neu hinzugefügter.

    TODO (bekanntes Problem): Die Auftragsnummer ist NICHT eindeutig.
    In den echten Draht-Müller-Daten taucht z.B. AW 110055 mehrfach
    mit unterschiedlichen Positions-Suffixen auf (Artikelnummer
    .../006 und .../004 — beides separate Auftragspositionen unter
    derselben AW). Aktueller Schlüssel ist nur die AW-Nummer, daher
    wird die zweite Position als 'schon bekannt' geflaggt obwohl es
    eine andere Position ist.

    Lösung wenn nötig: Schlüssel auf (auftrag_nr, artikelnummer) oder
    (auftrag_nr, position) umstellen, sowohl im Schema (UNIQUE-Index)
    als auch in filtere_neue_aws/markiere_aw_bearbeitet.
    """
    con = get_connection()
    cur = con.cursor()
    jetzt = datetime.now().isoformat(timespec="seconds")
    neu = 0
    for nr in awnrn:
        nr = (nr or "").strip()
        if not nr:
            continue
        cur.execute(
            "INSERT OR IGNORE INTO bearbeitete_auftraege (auftrag_nr, datum, quelle)"
            " VALUES (?, ?, ?)",
            (nr, jetzt, quelle),
        )
        if cur.rowcount > 0:
            neu += 1
    con.commit()
    return neu


def filtere_neue_aws(awnrn: list[str]) -> tuple[list[str], list[str]]:
    """Trennt (neu, schon_bekannt) — case-sensitive."""
    if not awnrn:
        return [], []
    con = get_connection()
    placeholders = ",".join("?" for _ in awnrn)
    rows = con.execute(
        f"SELECT auftrag_nr FROM bearbeitete_auftraege WHERE auftrag_nr IN ({placeholders})",
        awnrn,
    ).fetchall()
    bekannt = {r["auftrag_nr"] for r in rows}
    neu: list[str] = []
    schon: list[str] = []
    for nr in awnrn:
        nr_clean = (nr or "").strip()
        if not nr_clean:
            continue
        if nr_clean in bekannt:
            schon.append(nr_clean)
        else:
            neu.append(nr_clean)
    return neu, schon


def lade_aw_historie() -> dict[str, dict]:
    con = get_connection()
    rows = con.execute("SELECT * FROM bearbeitete_auftraege").fetchall()
    return {r["auftrag_nr"]: {"datum": r["datum"], "quelle": r["quelle"]} for r in rows}


def loesche_aw_historie() -> None:
    con = get_connection()
    con.execute("DELETE FROM bearbeitete_auftraege")
    con.commit()
