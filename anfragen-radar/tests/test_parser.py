"""Tests für den Kategorie-Anfragen-Parser."""
from __future__ import annotations

from email.message import EmailMessage
from pathlib import Path

from core import mail_parser

FIXTURES = Path(__file__).parent / "fixtures"


def _html_fixture() -> str:
    return (FIXTURES / "kategorie_anfragen_2.html").read_text(encoding="utf-8")


def test_parse_html_mail_with_two_requests():
    text = mail_parser.html_to_text(_html_fixture())
    requests = mail_parser.parse_text(text)
    assert len(requests) == 2

    first, second = requests
    assert first.firma == "Caviteccc"
    assert first.name == "Bilić Slobodan"
    assert first.ort == "24300"
    assert first.land == "Serbien"
    assert first.telefon == "+381 65 3285898"
    assert first.email_relay == "buyer-jj2fl8i54s0s8@channel.machineseeker.com"
    assert first.kategorie == "Verpackungsmaschinen - Verschliessmaschinen"
    assert first.anfrage_zu == "Lanico UV 245"
    assert "0,5 kg do 5 kg" in first.nachricht

    assert second.firma == "Officina Meccanica Rossi"
    assert second.telefon == "+39 02 1234567"  # Festnetz -> telefon
    assert second.ort == "20121 Milano"
    assert second.land == "Italien"
    assert second.anfrage_zu == "DMG MORI CTX 310"


def test_parse_plaintext_with_missing_fields_and_multiline_message():
    text = (FIXTURES / "kategorie_anfrage_minimal.txt").read_text(encoding="utf-8")
    requests = mail_parser.parse_text(text)
    assert len(requests) == 1

    req = requests[0]
    assert req.firma is None  # fehlendes Feld toleriert
    assert req.name == "Jane Doe"
    assert req.kategorie == "Holzbearbeitungsmaschinen - Kreissägen"
    assert req.anfrage_zu is None
    assert "Formatkreissäge" in req.nachricht
    assert "gerne mit Vorritzer." in req.nachricht
    assert "Lieferung nach Österreich." in req.nachricht
    # Unbekanntes Feld landet in extra statt zu crashen
    assert req.extra.get("Sonderwunsch") == "schnelle Lieferung"


def test_parse_message_bytes_prefers_html():
    msg = EmailMessage()
    msg["Subject"] = "Kategorie-Anfragen (2 Nachrichten)"
    msg["From"] = "info@mail.machineseeker.com"
    msg["To"] = "maschinensucher@komplett-konzept.de"
    msg["Message-ID"] = "<test-123@machineseeker.com>"
    msg.set_content("Bitte HTML-Ansicht verwenden.")
    msg.add_alternative(_html_fixture(), subtype="html")

    parsed_msg, requests = mail_parser.parse_message_bytes(bytes(msg))
    assert parsed_msg["Message-ID"] == "<test-123@machineseeker.com>"
    assert len(requests) == 2
    assert requests[0].firma == "Caviteccc"


def test_parse_empty_text_returns_no_requests():
    assert mail_parser.parse_text("") == []
    assert mail_parser.parse_text("Hallo,\ndies ist keine Anfrage.\nGruß") == []


def test_split_ort():
    assert mail_parser._split_ort("24300, Serbien") == ("24300", "Serbien")
    assert mail_parser._split_ort("Berlin") == ("Berlin", None)
    assert mail_parser._split_ort("10115 Berlin, Mitte, Deutschland") == (
        "10115 Berlin, Mitte", "Deutschland",
    )
