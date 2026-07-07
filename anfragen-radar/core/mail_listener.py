"""IMAP-Listener: verarbeitet neue Maschinensucher-Mails sofort (IDLE),
mit Polling-Fallback und automatischem Reconnect (Backoff).

Read-only-Verhalten: Mails werden mit BODY.PEEK gelesen und nur dann als
gelesen markiert, wenn das in den Einstellungen aktiviert ist. Es wird
niemals gelöscht oder verschoben.
"""
from __future__ import annotations

import email.utils
import imaplib
import logging
import re
import socket
import ssl
import threading
import time
from datetime import date, timedelta

from core import config, pipeline
from db import database

log = logging.getLogger("radar.mail")

IDLE_TIMEOUT_SECONDS = 13 * 60  # Server trennen IDLE oft nach ~30 min; früher erneuern
MAX_BACKOFF_SECONDS = 300


class MailListener(threading.Thread):
    """Hintergrund-Thread, läuft unabhängig vom offenen Browser-Tab."""

    def __init__(self) -> None:
        super().__init__(name="mail-listener", daemon=True)
        self._stop_event = threading.Event()
        self._check_now_event = threading.Event()
        self.status = "gestartet"
        self.last_check: float | None = None
        self.last_error: str | None = None

    # ------------------------------------------------------------- Steuerung

    def stop(self) -> None:
        self._stop_event.set()

    def check_now(self) -> None:
        """Manueller Trigger ("Postfach jetzt prüfen")."""
        self._check_now_event.set()

    # ------------------------------------------------------------------ Loop

    def run(self) -> None:
        backoff = 2
        while not self._stop_event.is_set():
            cfg = config.load()["imap"]
            if not cfg["host"] or not cfg["user"] or not cfg["password"]:
                self.status = "nicht konfiguriert"
                self._stop_event.wait(10)
                continue
            try:
                self._session_loop()
                backoff = 2
            except Exception as exc:
                self.last_error = str(exc)
                self.status = f"Verbindungsfehler (Retry in {backoff}s)"
                log.warning("IMAP-Verbindung verloren: %s – Reconnect in %ds", exc, backoff)
                self._stop_event.wait(backoff)
                backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)

    def _session_loop(self) -> None:
        conn = _connect()
        try:
            self.status = "verbunden"
            self.last_error = None
            self._check_new(conn)
            supports_idle = b"IDLE" in (conn.capabilities or ())
            poll_interval = config.load()["imap"]["poll_interval_seconds"]
            while not self._stop_event.is_set():
                if supports_idle:
                    self.status = "wartet (IDLE)"
                    changed = _idle_wait(
                        conn, IDLE_TIMEOUT_SECONDS,
                        self._stop_event, self._check_now_event,
                    )
                else:
                    self.status = f"Polling alle {poll_interval}s"
                    changed = self._wait_polling(poll_interval)
                if self._stop_event.is_set():
                    return
                if changed or not supports_idle:
                    self._check_new(conn)
                conn.noop()
        finally:
            try:
                conn.logout()
            except Exception:
                pass

    def _wait_polling(self, interval: int) -> bool:
        waited = 0.0
        while waited < interval and not self._stop_event.is_set():
            if self._check_now_event.is_set():
                self._check_now_event.clear()
                return True
            time.sleep(1)
            waited += 1
        return True

    # ------------------------------------------------------------ Mail-Check

    def _check_new(self, conn: imaplib.IMAP4) -> None:
        self.last_check = time.time()
        self.status = "prüft Postfach"
        cfg = config.load()
        imap_cfg = cfg["imap"]
        sender = cfg["sender_filter"]

        conn.select(imap_cfg.get("folder", "INBOX"), readonly=not imap_cfg["mark_seen"])
        since = (date.today() - timedelta(days=imap_cfg["search_days_back"])).strftime(
            "%d-%b-%Y"
        )
        criteria = f'(FROM "{sender}" SINCE {since})' if sender else f"(SINCE {since})"
        typ, data = conn.uid("SEARCH", None, criteria)
        if typ != "OK":
            raise RuntimeError(f"IMAP SEARCH fehlgeschlagen: {typ}")
        uids = data[0].split() if data and data[0] else []

        new_count = 0
        for uid in uids:
            if self._stop_event.is_set():
                break
            if self._process_uid(conn, uid, cfg):
                new_count += 1
        if new_count:
            log.info("%d neue Mail(s) verarbeitet.", new_count)
        self.status = "wartet"

    def _process_uid(self, conn: imaplib.IMAP4, uid: bytes, cfg: dict) -> bool:
        # Erst nur Header holen (PEEK = setzt kein \Seen-Flag)
        typ, data = conn.uid(
            "FETCH", uid, "(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID SUBJECT FROM)])"
        )
        if typ != "OK" or not data or data[0] is None:
            return False
        header_blob = b""
        for part in data:
            if isinstance(part, tuple):
                header_blob += part[1]
        headers = header_blob.decode("utf-8", errors="replace")
        message_id = _header_value(headers, "Message-ID")
        subject = _decoded_header(headers, "Subject")

        if message_id and database.is_mail_processed(message_id):
            return False
        subject_filter = cfg.get("subject_filter") or ""
        if subject_filter and subject_filter.lower() not in subject.lower():
            log.info("Mail übersprungen (Betreff passt nicht): %s", subject[:80])
            return False

        typ, data = conn.uid("FETCH", uid, "(BODY.PEEK[])")
        if typ != "OK" or not data:
            return False
        raw = b""
        for part in data:
            if isinstance(part, tuple):
                raw += part[1]
        if not raw:
            return False

        request_ids = pipeline.process_mail(raw)

        if cfg["imap"]["mark_seen"]:
            try:
                conn.uid("STORE", uid, "+FLAGS", "(\\Seen)")
            except Exception as exc:
                log.warning("Konnte Mail nicht als gelesen markieren: %s", exc)
        return bool(request_ids)


# ---------------------------------------------------------------- Verbindung

def _connect() -> imaplib.IMAP4:
    cfg = config.load()["imap"]
    if cfg["ssl"]:
        conn: imaplib.IMAP4 = imaplib.IMAP4_SSL(
            cfg["host"], int(cfg["port"]), ssl_context=ssl.create_default_context(),
            timeout=30,
        )
    else:
        conn = imaplib.IMAP4(cfg["host"], int(cfg["port"]), timeout=30)
    conn.login(cfg["user"], cfg["password"])
    return conn


def test_connection() -> str:
    """Für den "IMAP-Verbindung testen"-Button."""
    conn = _connect()
    try:
        typ, data = conn.select(config.load()["imap"].get("folder", "INBOX"), readonly=True)
        count = data[0].decode() if typ == "OK" and data and data[0] else "?"
        idle = "ja" if b"IDLE" in (conn.capabilities or ()) else "nein (Polling)"
        return f"Verbunden. {count} Mails im Ordner, IDLE-Support: {idle}."
    finally:
        try:
            conn.logout()
        except Exception:
            pass


def _idle_wait(
    conn: imaplib.IMAP4,
    timeout: float,
    stop_event: threading.Event,
    check_now_event: threading.Event,
) -> bool:
    """Sendet IDLE und wartet auf neue Mails (EXISTS). imaplib kann kein
    IDLE, daher direkt auf dem Socket. Gibt True zurück, wenn sich etwas
    getan hat."""
    tag = conn._new_tag().decode()  # noqa: SLF001 – imaplib hat keine IDLE-API
    conn.send(f"{tag} IDLE\r\n".encode())
    sock = conn.socket()
    changed = False
    try:
        # Erste Antwort ("+ idling") abwarten
        sock.settimeout(10)
        try:
            conn.readline()
        except (socket.timeout, TimeoutError):
            pass

        deadline = time.monotonic() + timeout
        sock.settimeout(2)
        while time.monotonic() < deadline:
            if stop_event.is_set():
                break
            if check_now_event.is_set():
                check_now_event.clear()
                changed = True
                break
            try:
                line = conn.readline()
            except (socket.timeout, TimeoutError):
                continue
            if not line:
                raise ConnectionError("IMAP-Verbindung während IDLE geschlossen")
            if re.search(rb"\b(EXISTS|RECENT)\b", line):
                changed = True
                break
    finally:
        try:
            conn.send(b"DONE\r\n")
            sock.settimeout(10)
            # Antworten bis zur Tag-Bestätigung lesen
            for _ in range(20):
                line = conn.readline()
                if not line or line.startswith(tag.encode()):
                    break
        except Exception:
            raise ConnectionError("IMAP IDLE konnte nicht sauber beendet werden")
        finally:
            sock.settimeout(None)
    return changed


# ------------------------------------------------------------------- Helfer

def _header_value(headers: str, name: str) -> str:
    match = re.search(rf"^{name}:\s*(.+)$", headers, re.IGNORECASE | re.MULTILINE)
    return match.group(1).strip() if match else ""


def _decoded_header(headers: str, name: str) -> str:
    raw = _header_value(headers, name)
    if not raw:
        return ""
    try:
        from email.header import decode_header, make_header

        return str(make_header(decode_header(raw)))
    except Exception:
        return raw


# --------------------------------------------------- Singleton für Streamlit

_listener: MailListener | None = None
_listener_lock = threading.Lock()


def get_listener() -> MailListener:
    global _listener
    with _listener_lock:
        if _listener is None or not _listener.is_alive():
            _listener = MailListener()
            _listener.start()
        return _listener
