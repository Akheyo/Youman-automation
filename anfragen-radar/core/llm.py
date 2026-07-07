"""Anthropic-API: Anfrage verstehen (Übersetzung, Extraktion, Suchbegriffe)
und optionale Relevanz-Filterung von Websuche-Treffern.

Alle Funktionen sind so gebaut, dass sie in Tests einfach gemockt werden
können (zentrale ``_client``/``_call``-Funktionen).
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from core import config

log = logging.getLogger("radar.llm")

ANALYZE_SYSTEM = (
    "Du bist Assistent eines deutschen B2B-Gebrauchtmaschinen-Händlers. "
    "Du analysierst Kaufgesuche von Maschinensucher-Interessenten. "
    "Antworte ausschließlich mit einem einzigen JSON-Objekt, ohne Markdown."
)

ANALYZE_PROMPT = """Analysiere dieses Kaufgesuch eines Interessenten.

Kategorie: {kategorie}
Referenzmaschine ("Anfrage zu"): {anfrage_zu}
Nachricht des Interessenten (Originalsprache):
\"\"\"{nachricht}\"\"\"

Gib genau dieses JSON zurück:
{{
  "sprache": "<erkannte Sprache der Nachricht, deutsch benannt, z. B. 'Serbisch'>",
  "uebersetzung_de": "<deutsche Übersetzung der Nachricht; falls schon deutsch: Originaltext>",
  "maschinentyp": "<Maschinentyp auf Deutsch, z. B. 'Dosenverschließmaschine'>",
  "anforderungen": ["<technische Anforderung 1>", "..."],
  "referenz_hersteller": "<Hersteller der Referenzmaschine oder null>",
  "referenz_modell": "<Modellbezeichnung oder null>",
  "budget": "<Budget falls genannt, sonst null>",
  "suchbegriffe": {{
    "exakt": ["<Hersteller + Modell>", "..."],
    "funktional": ["<funktional äquivalente Suchbegriffe, deutsch UND englisch, Synonyme, Kategoriebegriffe>", "..."]
  }}
}}

Regeln:
- "exakt": 1-3 Begriffe, immer die Referenzmaschine (Hersteller + Modell), plus enge Varianten.
- "funktional": 4-8 Begriffe, Mischung aus Deutsch und Englisch.
- Keine Erklärungen, nur das JSON-Objekt."""


def _client():
    import anthropic

    cfg = config.load()
    api_key = cfg["anthropic"]["api_key"]
    if not api_key:
        raise RuntimeError("Kein Anthropic-API-Key konfiguriert (Einstellungen-Seite).")
    return anthropic.Anthropic(api_key=api_key)


def _call(system: str, prompt: str, max_tokens: int = 1500) -> str:
    cfg = config.load()
    client = _client()
    response = client.messages.create(
        model=cfg["anthropic"]["model"],
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(block.text for block in response.content if block.type == "text")


def _extract_json(text: str) -> dict[str, Any]:
    """Toleranter JSON-Extraktor (LLM-Antworten enthalten manchmal Rauschen)."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


def analyze_request(
    kategorie: str | None,
    anfrage_zu: str | None,
    nachricht: str | None,
) -> dict[str, Any]:
    """LLM-Analyse einer Anfrage. Liefert bei API-Fehlern einen Fallback,
    damit die Pipeline (Suche) trotzdem weiterlaufen kann."""
    prompt = ANALYZE_PROMPT.format(
        kategorie=kategorie or "-",
        anfrage_zu=anfrage_zu or "-",
        nachricht=nachricht or "-",
    )
    try:
        raw = _call(ANALYZE_SYSTEM, prompt)
        data = _extract_json(raw)
    except Exception as exc:
        log.error("LLM-Analyse fehlgeschlagen: %s", exc)
        data = {}
    return _normalize_analysis(data, kategorie, anfrage_zu, nachricht)


def _normalize_analysis(
    data: dict[str, Any],
    kategorie: str | None,
    anfrage_zu: str | None,
    nachricht: str | None,
) -> dict[str, Any]:
    """Stellt sicher, dass alle Felder existieren – notfalls per Heuristik."""
    terms = data.get("suchbegriffe") or {}
    exakt = [t for t in (terms.get("exakt") or []) if isinstance(t, str) and t.strip()]
    funktional = [
        t for t in (terms.get("funktional") or []) if isinstance(t, str) and t.strip()
    ]
    if not exakt and anfrage_zu:
        exakt = [anfrage_zu.strip()]
    if not funktional:
        fallback = []
        if data.get("maschinentyp"):
            fallback.append(str(data["maschinentyp"]))
        if kategorie:
            # "Verpackungsmaschinen - Verschliessmaschinen" -> letzter Teil
            fallback.append(kategorie.split("-")[-1].strip())
        funktional = [t for t in fallback if t]
    return {
        "sprache": data.get("sprache"),
        "uebersetzung_de": data.get("uebersetzung_de") or nachricht,
        "maschinentyp": data.get("maschinentyp"),
        "anforderungen": data.get("anforderungen") or [],
        "referenz_hersteller": data.get("referenz_hersteller"),
        "referenz_modell": data.get("referenz_modell"),
        "budget": data.get("budget"),
        "suchbegriffe": {"exakt": exakt, "funktional": funktional},
    }


RELEVANCE_SYSTEM = (
    "Du bewertest Suchtreffer für ein Maschinen-Kaufgesuch. "
    "Antworte nur mit einem JSON-Array."
)

RELEVANCE_PROMPT = """Gesucht wird: {gesucht}
Technische Anforderungen: {anforderungen}

Hier sind Suchtreffer (Index, Titel, URL):
{hits}

Gib ein JSON-Array zurück mit einem Objekt pro relevantem Treffer:
[{{"index": <int>, "relevant": true/false, "begruendung": "<kurz, deutsch>", "score": <0-100>}}]
Nur das Array, keine Erklärungen."""


def filter_hits_relevance(
    gesucht: str, anforderungen: list[str], hits: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Filtert Websuche-Treffer per LLM. Bei Fehlern werden alle Treffer
    unverändert zurückgegeben (Fail-Open)."""
    if not hits:
        return hits
    listing = "\n".join(
        f"{i}: {h.get('title', '')[:120]} | {h.get('url', '')[:120]}"
        for i, h in enumerate(hits)
    )
    prompt = RELEVANCE_PROMPT.format(
        gesucht=gesucht,
        anforderungen=", ".join(anforderungen) or "-",
        hits=listing,
    )
    try:
        raw = _call(RELEVANCE_SYSTEM, prompt, max_tokens=2000)
        text = raw.strip()
        if text.startswith("```"):
            text = re.sub(r"^```[a-z]*\n?", "", text)
            text = re.sub(r"\n?```$", "", text)
        match = re.search(r"\[.*\]", text, re.DOTALL)
        ratings = json.loads(match.group(0) if match else text)
    except Exception as exc:
        log.warning("LLM-Relevanzfilter fehlgeschlagen, behalte alle Treffer: %s", exc)
        return hits
    result = []
    for rating in ratings:
        try:
            idx = int(rating["index"])
        except (KeyError, ValueError, TypeError):
            continue
        if 0 <= idx < len(hits) and rating.get("relevant"):
            hit = dict(hits[idx])
            if rating.get("begruendung"):
                hit["match_reason"] = rating["begruendung"]
            if isinstance(rating.get("score"), (int, float)):
                hit["score"] = float(rating["score"])
            result.append(hit)
    return result
