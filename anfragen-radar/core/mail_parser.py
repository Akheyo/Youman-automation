"""Parser für Maschinensucher-"Kategorie-Anfragen"-Mails.

Eine Mail kann mehrere Anfragen enthalten. Jede Anfrage folgt dem Muster:

    Firma: Caviteccc
    Name: Bilić Slobodan
    Ort: 24300, Serbien
    Mobil: +381 65 3285898
    E-Mail: buyer-...@channel.machineseeker.com

    Kategorie: Verpackungsmaschinen - Verschliessmaschinen
    Anfrage zu: Lanico UV 245
    Nachricht an Sie: ...

Der Parser arbeitet auf dem Text (HTML wird vorher zu Text konvertiert),
toleriert fehlende Felder und loggt unbekannte Feldnamen, statt zu crashen.
"""
from __future__ import annotations

import email
import email.policy
import logging
import re
from dataclasses import dataclass, field
from email.message import EmailMessage

from bs4 import BeautifulSoup

log = logging.getLogger("radar.parser")

# Bekannte Feld-Labels -> interne Feldnamen
FIELD_MAP = {
    "firma": "firma",
    "name": "name",
    "ort": "ort_raw",
    "mobil": "telefon",
    "festnetz": "telefon",
    "telefon": "telefon",
    "e-mail": "email_relay",
    "email": "email_relay",
    "kategorie": "kategorie",
    "anfrage zu": "anfrage_zu",
    "nachricht an sie": "nachricht",
    "nachricht": "nachricht",
}

# Felder, die eine neue Anfrage einleiten, wenn sie erneut auftauchen
BLOCK_START_FIELDS = {"firma"}

_LABEL_RE = re.compile(r"^\s*([A-Za-zÄÖÜäöüß \-]{2,30}?)\s*:\s*(.*)$")


@dataclass
class ParsedRequest:
    firma: str | None = None
    name: str | None = None
    ort: str | None = None
    land: str | None = None
    telefon: str | None = None
    email_relay: str | None = None
    kategorie: str | None = None
    anfrage_zu: str | None = None
    nachricht: str | None = None
    extra: dict = field(default_factory=dict)

    def is_valid(self) -> bool:
        """Mindestanforderung: irgendein Inhalt, der eine Anfrage ausmacht."""
        return bool(self.kategorie or self.anfrage_zu or self.email_relay or self.nachricht)

    def as_db_fields(self) -> dict:
        return {
            "firma": self.firma,
            "name": self.name,
            "ort": self.ort,
            "land": self.land,
            "telefon": self.telefon,
            "email_relay": self.email_relay,
            "kategorie": self.kategorie,
            "anfrage_zu": self.anfrage_zu,
            "nachricht": self.nachricht,
            "extra": self.extra,
        }


_BLOCK_TAGS = ["p", "div", "tr", "li", "table", "h1", "h2", "h3", "h4", "hr", "section"]


def html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style"]):
        tag.decompose()
    # Nur <br> und Block-Elemente erzeugen Zeilenumbrüche – Inline-Tags wie
    # <b>Firma:</b> Wert müssen auf EINER Zeile bleiben.
    for br in soup.find_all("br"):
        br.replace_with("\n")
    for tag in soup.find_all(_BLOCK_TAGS):
        tag.insert_before("\n")
        tag.append("\n")
    text = soup.get_text()
    lines = [line.strip() for line in text.split("\n")]
    return "\n".join(lines)


def extract_mail_text(msg: EmailMessage) -> str:
    """Bevorzugt HTML (dort sind die Felder sauber), Plaintext als Fallback."""
    html_part = msg.get_body(preferencelist=("html",))
    if html_part is not None:
        try:
            return html_to_text(html_part.get_content())
        except Exception as exc:  # defekte Teile nicht crashen lassen
            log.warning("HTML-Teil unlesbar, Plaintext-Fallback: %s", exc)
    text_part = msg.get_body(preferencelist=("plain",))
    if text_part is not None:
        return str(text_part.get_content())
    payload = msg.get_payload(decode=True)
    if isinstance(payload, bytes):
        return payload.decode("utf-8", errors="replace")
    return str(payload or "")


def parse_message_bytes(raw: bytes) -> tuple[EmailMessage, list[ParsedRequest]]:
    msg = email.message_from_bytes(raw, policy=email.policy.default)
    text = extract_mail_text(msg)
    return msg, parse_text(text)


def _split_ort(ort_raw: str) -> tuple[str | None, str | None]:
    """"24300, Serbien" -> (Ort/PLZ, Land). Letztes Komma-Segment = Land."""
    if not ort_raw:
        return None, None
    parts = [p.strip() for p in ort_raw.split(",") if p.strip()]
    if len(parts) >= 2:
        return ", ".join(parts[:-1]), parts[-1]
    return ort_raw.strip(), None


def parse_text(text: str) -> list[ParsedRequest]:
    """Extrahiert alle Anfragen aus dem Mail-Text."""
    requests: list[ParsedRequest] = []
    current: ParsedRequest | None = None
    current_field: str | None = None  # für mehrzeilige Werte (Nachricht)
    pending_field: str | None = None  # Label ohne Wert -> Wert in Folgezeile
    seen_fields: set[str] = set()

    def commit() -> None:
        nonlocal current, seen_fields
        if current is not None:
            _finalize(current)
            if current.is_valid():
                requests.append(current)
        current = None
        seen_fields = set()

    for line in text.split("\n"):
        stripped = line.strip()
        match = _LABEL_RE.match(stripped)
        label_key = None
        if match:
            label_key = match.group(1).strip().lower()

        if label_key in FIELD_MAP:
            field_name = FIELD_MAP[label_key]
            value = match.group(2).strip()
            # Neue Anfrage beginnt, wenn ein Startfeld erneut auftaucht
            # oder ein bereits gesetztes Feld wiederkommt.
            if current is not None and (
                (label_key in BLOCK_START_FIELDS and field_name in seen_fields)
                or (field_name in seen_fields and field_name != "telefon")
            ):
                commit()
            if current is None:
                current = ParsedRequest()
            if value:
                _set_field(current, field_name, value)
                pending_field = None
            else:
                # Wert steht (je nach HTML-Layout) in der nächsten Zeile
                pending_field = field_name
            seen_fields.add(field_name)
            current_field = field_name if field_name == "nachricht" else None
        elif pending_field is not None and current is not None and stripped:
            _set_field(current, pending_field, stripped)
            current_field = pending_field if pending_field == "nachricht" else None
            pending_field = None
        elif match and stripped and current is not None:
            # Sieht aus wie "Label: Wert", ist aber unbekannt -> loggen, nicht crashen
            unknown = match.group(1).strip()
            if len(unknown.split()) <= 3:
                log.info("Unbekanntes Feld in Anfrage-Mail: %r", unknown)
                current.extra[unknown] = match.group(2).strip()
                current_field = None
            elif current_field == "nachricht" and stripped:
                current.nachricht = f"{current.nachricht}\n{stripped}".strip()
        elif current_field == "nachricht" and current is not None and stripped:
            # Fortsetzung einer mehrzeiligen Nachricht
            current.nachricht = f"{current.nachricht}\n{stripped}".strip()
        elif not stripped:
            # Leerzeile beendet mehrzeilige Nachrichten-/Wert-Erfassung
            current_field = None
            pending_field = None

    commit()
    return requests


def _set_field(req: ParsedRequest, field_name: str, value: str) -> None:
    if field_name == "ort_raw":
        req.ort, req.land = _split_ort(value)
    elif getattr(req, field_name, None):
        # Feld schon belegt (z. B. Mobil + Festnetz) -> anhängen
        setattr(req, field_name, f"{getattr(req, field_name)} / {value}")
    else:
        setattr(req, field_name, value)


def _finalize(req: ParsedRequest) -> None:
    for attr in ("firma", "name", "telefon", "email_relay", "kategorie", "anfrage_zu"):
        value = getattr(req, attr)
        if isinstance(value, str):
            setattr(req, attr, value.strip() or None)
    if req.nachricht:
        req.nachricht = req.nachricht.strip() or None
