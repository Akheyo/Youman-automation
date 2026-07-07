"""Tests für die Mail-Deduplizierung (Message-ID) und ID-Vergabe."""
from __future__ import annotations

from email.message import EmailMessage
from pathlib import Path

from core import pipeline
from db import database

FIXTURES = Path(__file__).parent / "fixtures"


def _make_mail(message_id: str = "<dedup-test@machineseeker.com>") -> bytes:
    msg = EmailMessage()
    msg["Subject"] = "Kategorie-Anfragen (2 Nachrichten)"
    msg["From"] = "info@mail.machineseeker.com"
    msg["Message-ID"] = message_id
    msg.set_content("Bitte HTML-Ansicht verwenden.")
    msg.add_alternative(
        (FIXTURES / "kategorie_anfragen_2.html").read_text(encoding="utf-8"),
        subtype="html",
    )
    return bytes(msg)


def test_same_mail_is_processed_only_once(monkeypatch):
    # LLM + Suche in diesem Test nicht ausführen
    monkeypatch.setattr(pipeline, "analyze_and_search", lambda request_id: None)

    first = pipeline.process_mail(_make_mail())
    assert len(first) == 2

    second = pipeline.process_mail(_make_mail())
    assert second == []

    assert len(database.list_requests()) == 2


def test_different_message_ids_are_both_processed(monkeypatch):
    monkeypatch.setattr(pipeline, "analyze_and_search", lambda request_id: None)

    pipeline.process_mail(_make_mail("<a@machineseeker.com>"))
    pipeline.process_mail(_make_mail("<b@machineseeker.com>"))
    assert len(database.list_requests()) == 4


def test_is_mail_processed_roundtrip():
    assert not database.is_mail_processed("<x@y>")
    database.save_processed_mail("<x@y>", "Betreff", "a@b", None, "raw")
    assert database.is_mail_processed("<x@y>")
    # Leere Message-ID gilt nie als verarbeitet
    assert not database.is_mail_processed("")


def test_public_ids_are_sequential(monkeypatch):
    monkeypatch.setattr(pipeline, "analyze_and_search", lambda request_id: None)
    pipeline.process_mail(_make_mail())
    rows = database.list_requests()
    ids = sorted(r["public_id"] for r in rows)
    assert ids[0].endswith("-0001")
    assert ids[1].endswith("-0002")
    assert ids[0].startswith("AR-")
