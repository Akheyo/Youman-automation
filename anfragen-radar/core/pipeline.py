"""Verarbeitungs-Pipeline: Mail -> Anfragen -> LLM-Analyse -> Suche -> DB."""
from __future__ import annotations

import json
import logging
from typing import Any

from core import llm, mail_parser, search
from db import database
from sources.base import SearchTerms

log = logging.getLogger("radar.pipeline")


def process_mail(raw: bytes) -> list[int]:
    """Verarbeitet eine Roh-Mail. Gibt die IDs der neu angelegten
    Anfragen zurück (leer, wenn Duplikat oder nichts geparst)."""
    msg, parsed = mail_parser.parse_message_bytes(raw)
    message_id = (msg.get("Message-ID") or "").strip()
    subject = str(msg.get("Subject") or "")
    sender = str(msg.get("From") or "")

    if message_id and database.is_mail_processed(message_id):
        log.info("Mail %s bereits verarbeitet – übersprungen.", message_id)
        return []

    if not parsed:
        log.warning("Keine Anfragen in Mail gefunden (Betreff: %s)", subject)

    text = mail_parser.extract_mail_text(msg)
    mail_id = database.save_processed_mail(
        message_id or f"<no-id-{hash(raw)}>",
        subject,
        sender,
        str(msg.get("Date") or ""),
        text,
    )

    request_ids = []
    for req in parsed:
        request_id = database.create_request(mail_id, req.as_db_fields())
        request_ids.append(request_id)
        public = database.get_request(request_id)["public_id"]
        log.info("Neue Anfrage %s angelegt (%s / %s)", public, req.firma, req.kategorie)

    for request_id in request_ids:
        try:
            analyze_and_search(request_id)
        except Exception as exc:
            log.error("Pipeline für Anfrage %s fehlgeschlagen: %s", request_id, exc)
    return request_ids


def analyze_and_search(request_id: int) -> None:
    """LLM-Analyse + Suche für eine Anfrage (auch für "Erneut suchen")."""
    req = database.get_request(request_id)
    if req is None:
        return

    if not req.get("suchbegriffe_json"):
        analysis = llm.analyze_request(
            req.get("kategorie"), req.get("anfrage_zu"), req.get("nachricht")
        )
        database.update_request(
            request_id,
            nachricht_de=analysis.get("uebersetzung_de"),
            sprache=analysis.get("sprache"),
            anforderungen_json=json.dumps(
                {
                    "maschinentyp": analysis.get("maschinentyp"),
                    "anforderungen": analysis.get("anforderungen"),
                    "referenz_hersteller": analysis.get("referenz_hersteller"),
                    "referenz_modell": analysis.get("referenz_modell"),
                    "budget": analysis.get("budget"),
                },
                ensure_ascii=False,
            ),
            suchbegriffe_json=json.dumps(analysis["suchbegriffe"], ensure_ascii=False),
        )
        req = database.get_request(request_id)

    run_search_for_request(request_id)


def run_search_for_request(request_id: int) -> None:
    """Führt (erneut) die Suche mit den gespeicherten Suchbegriffen aus."""
    req = database.get_request(request_id)
    if req is None:
        return
    terms = load_terms(req)
    anforderungen: list[str] = []
    try:
        anforderungen = (json.loads(req.get("anforderungen_json") or "{}")).get(
            "anforderungen", []
        ) or []
    except json.JSONDecodeError:
        pass

    context: dict[str, Any] = {"request": req, "anforderungen": anforderungen}
    log.info(
        "Starte Suche für %s mit Begriffen: %s",
        req["public_id"],
        ", ".join(terms.all_terms()),
    )
    hits, statuses = search.run_search(terms, context)
    database.replace_hits(request_id, hits)
    database.replace_source_status(request_id, statuses)

    if req["status"] == "Neu" and not hits:
        database.update_request(request_id, status="Kein Treffer")
    log.info("Suche für %s fertig: %d Treffer.", req["public_id"], len(hits))


def load_terms(req: dict[str, Any]) -> SearchTerms:
    exact: list[str] = []
    functional: list[str] = []
    try:
        data = json.loads(req.get("suchbegriffe_json") or "{}")
        exact = [t for t in data.get("exakt", []) if isinstance(t, str)]
        functional = [t for t in data.get("funktional", []) if isinstance(t, str)]
    except json.JSONDecodeError:
        pass
    if not exact and req.get("anfrage_zu"):
        exact = [req["anfrage_zu"]]
    return SearchTerms(exact=exact, functional=functional, kategorie=req.get("kategorie"))
