"""SQLite-Zugriff: Schema/Migrationen und alle CRUD-Funktionen.

Eine einzige Verbindung pro Prozess (WAL-Modus, threadsafe über RLock) –
für die Größenordnung dieser App völlig ausreichend.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Any

from core import paths

_lock = threading.RLock()
_conn: sqlite3.Connection | None = None

MIGRATIONS: list[str] = [
    # v1 – Grundschema
    """
    CREATE TABLE processed_mails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL UNIQUE,
        subject TEXT,
        sender TEXT,
        received_at TEXT,
        processed_at TEXT NOT NULL,
        raw_text TEXT
    );

    CREATE TABLE requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        public_id TEXT NOT NULL UNIQUE,
        mail_id INTEGER REFERENCES processed_mails(id),
        created_at TEXT NOT NULL,
        firma TEXT,
        name TEXT,
        ort TEXT,
        land TEXT,
        telefon TEXT,
        email_relay TEXT,
        kategorie TEXT,
        anfrage_zu TEXT,
        nachricht TEXT,
        nachricht_de TEXT,
        sprache TEXT,
        anforderungen_json TEXT,
        suchbegriffe_json TEXT,
        status TEXT NOT NULL DEFAULT 'Neu',
        notizen TEXT DEFAULT '',
        extra_json TEXT
    );

    CREATE TABLE hits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL REFERENCES requests(id),
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        price TEXT,
        location TEXT,
        url TEXT,
        image_url TEXT,
        match_reason TEXT,
        score REAL DEFAULT 0,
        own_stock INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    );

    CREATE TABLE source_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL REFERENCES requests(id),
        source TEXT NOT NULL,
        ok INTEGER NOT NULL,
        error TEXT,
        hit_count INTEGER DEFAULT 0,
        duration_ms INTEGER,
        created_at TEXT NOT NULL
    );

    CREATE TABLE logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        level TEXT NOT NULL,
        component TEXT,
        message TEXT
    );
    """,
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    global _conn
    with _lock:
        if _conn is None:
            _conn = sqlite3.connect(paths.db_path(), check_same_thread=False)
            _conn.row_factory = sqlite3.Row
            _conn.execute("PRAGMA journal_mode=WAL")
            _conn.execute("PRAGMA foreign_keys=ON")
            _migrate(_conn)
        return _conn


def close() -> None:
    """Nur für Tests."""
    global _conn
    with _lock:
        if _conn is not None:
            _conn.close()
            _conn = None


def _migrate(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)"
    )
    applied = {row[0] for row in conn.execute("SELECT version FROM schema_migrations")}
    for version, script in enumerate(MIGRATIONS, start=1):
        if version in applied:
            continue
        conn.executescript(script)
        conn.execute("INSERT INTO schema_migrations (version) VALUES (?)", (version,))
        conn.commit()


# ---------------------------------------------------------------- Mails / Dedup

def is_mail_processed(message_id: str) -> bool:
    if not message_id:
        return False
    conn = connect()
    with _lock:
        row = conn.execute(
            "SELECT 1 FROM processed_mails WHERE message_id = ?", (message_id,)
        ).fetchone()
    return row is not None


def save_processed_mail(
    message_id: str,
    subject: str,
    sender: str,
    received_at: str | None,
    raw_text: str,
) -> int:
    conn = connect()
    with _lock:
        cur = conn.execute(
            """INSERT INTO processed_mails
               (message_id, subject, sender, received_at, processed_at, raw_text)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (message_id, subject, sender, received_at, _now(), raw_text),
        )
        conn.commit()
        return int(cur.lastrowid)


# ---------------------------------------------------------------- Anfragen

def next_public_id() -> str:
    """Fortlaufende ID pro Jahr, z. B. AR-2026-0001."""
    year = datetime.now().year
    prefix = f"AR-{year}-"
    conn = connect()
    with _lock:
        row = conn.execute(
            "SELECT public_id FROM requests WHERE public_id LIKE ? "
            "ORDER BY public_id DESC LIMIT 1",
            (prefix + "%",),
        ).fetchone()
    if row is None:
        seq = 1
    else:
        try:
            seq = int(row["public_id"].rsplit("-", 1)[1]) + 1
        except (ValueError, IndexError):
            seq = 1
    return f"{prefix}{seq:04d}"


def create_request(mail_id: int | None, fields: dict[str, Any]) -> int:
    conn = connect()
    with _lock:
        public_id = next_public_id()
        cur = conn.execute(
            """INSERT INTO requests
               (public_id, mail_id, created_at, firma, name, ort, land, telefon,
                email_relay, kategorie, anfrage_zu, nachricht, extra_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                public_id,
                mail_id,
                _now(),
                fields.get("firma"),
                fields.get("name"),
                fields.get("ort"),
                fields.get("land"),
                fields.get("telefon"),
                fields.get("email_relay"),
                fields.get("kategorie"),
                fields.get("anfrage_zu"),
                fields.get("nachricht"),
                json.dumps(fields.get("extra", {}), ensure_ascii=False),
            ),
        )
        conn.commit()
        return int(cur.lastrowid)


def update_request(request_id: int, **columns: Any) -> None:
    if not columns:
        return
    allowed = {
        "nachricht_de", "sprache", "anforderungen_json", "suchbegriffe_json",
        "status", "notizen",
    }
    cols = {k: v for k, v in columns.items() if k in allowed}
    if not cols:
        return
    conn = connect()
    assignments = ", ".join(f"{col} = ?" for col in cols)
    with _lock:
        conn.execute(
            f"UPDATE requests SET {assignments} WHERE id = ?",
            (*cols.values(), request_id),
        )
        conn.commit()


def get_request(request_id: int) -> dict[str, Any] | None:
    conn = connect()
    with _lock:
        row = conn.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
    return dict(row) if row else None


def list_requests(
    status: str | None = None,
    kategorie: str | None = None,
    text: str | None = None,
) -> list[dict[str, Any]]:
    query = (
        "SELECT r.*, (SELECT COUNT(*) FROM hits h WHERE h.request_id = r.id) AS hit_count "
        "FROM requests r WHERE 1=1"
    )
    params: list[Any] = []
    if status:
        query += " AND r.status = ?"
        params.append(status)
    if kategorie:
        query += " AND r.kategorie = ?"
        params.append(kategorie)
    if text:
        like = f"%{text}%"
        query += (
            " AND (r.firma LIKE ? OR r.name LIKE ? OR r.kategorie LIKE ?"
            " OR r.anfrage_zu LIKE ? OR r.nachricht LIKE ? OR r.public_id LIKE ?)"
        )
        params += [like] * 6
    query += " ORDER BY r.id DESC"
    conn = connect()
    with _lock:
        rows = conn.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def list_categories() -> list[str]:
    conn = connect()
    with _lock:
        rows = conn.execute(
            "SELECT DISTINCT kategorie FROM requests WHERE kategorie IS NOT NULL "
            "ORDER BY kategorie"
        ).fetchall()
    return [row[0] for row in rows]


# ---------------------------------------------------------------- Treffer

def replace_hits(request_id: int, hits: list[dict[str, Any]]) -> None:
    conn = connect()
    with _lock:
        conn.execute("DELETE FROM hits WHERE request_id = ?", (request_id,))
        for hit in hits:
            conn.execute(
                """INSERT INTO hits
                   (request_id, source, title, price, location, url, image_url,
                    match_reason, score, own_stock, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    request_id,
                    hit.get("source"),
                    hit.get("title"),
                    hit.get("price"),
                    hit.get("location"),
                    hit.get("url"),
                    hit.get("image_url"),
                    hit.get("match_reason"),
                    hit.get("score", 0),
                    1 if hit.get("own_stock") else 0,
                    _now(),
                ),
            )
        conn.commit()


def list_hits(request_id: int) -> list[dict[str, Any]]:
    conn = connect()
    with _lock:
        rows = conn.execute(
            "SELECT * FROM hits WHERE request_id = ? "
            "ORDER BY own_stock DESC, score DESC, id ASC",
            (request_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def replace_source_status(request_id: int, statuses: list[dict[str, Any]]) -> None:
    conn = connect()
    with _lock:
        conn.execute("DELETE FROM source_status WHERE request_id = ?", (request_id,))
        for st in statuses:
            conn.execute(
                """INSERT INTO source_status
                   (request_id, source, ok, error, hit_count, duration_ms, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    request_id,
                    st.get("source"),
                    1 if st.get("ok") else 0,
                    st.get("error"),
                    st.get("hit_count", 0),
                    st.get("duration_ms"),
                    _now(),
                ),
            )
        conn.commit()


def list_source_status(request_id: int | None = None, limit: int = 200) -> list[dict[str, Any]]:
    conn = connect()
    with _lock:
        if request_id is not None:
            rows = conn.execute(
                "SELECT * FROM source_status WHERE request_id = ? ORDER BY id",
                (request_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM source_status ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
    return [dict(row) for row in rows]


# ---------------------------------------------------------------- Logs

def add_log(level: str, component: str, message: str) -> None:
    conn = connect()
    with _lock:
        conn.execute(
            "INSERT INTO logs (ts, level, component, message) VALUES (?, ?, ?, ?)",
            (_now(), level, component, message),
        )
        conn.commit()


def list_logs(limit: int = 300) -> list[dict[str, Any]]:
    conn = connect()
    with _lock:
        rows = conn.execute(
            "SELECT * FROM logs ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(row) for row in rows]
