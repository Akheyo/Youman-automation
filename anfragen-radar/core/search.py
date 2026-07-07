"""Such-Pipeline: alle aktivierten Quellen parallel abfragen, Treffer
scoren/ranken, Fehler pro Quelle einsammeln (nie die Pipeline stoppen)."""
from __future__ import annotations

import concurrent.futures
import logging
import time
from typing import Any

import sources as source_registry
from core import config
from sources.base import Hit, SearchTerms, Source

log = logging.getLogger("radar.search")


def run_search(
    terms: SearchTerms, context: dict[str, Any]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Führt die Suche über alle Quellen aus.

    Returns:
        (hits, source_statuses) – beide als DB-fertige Dicts,
        hits bereits gescored und sortiert (eigener Bestand zuerst).
    """
    cfg = config.load()
    active = source_registry.enabled_sources(cfg)
    timeout = cfg["search"]["per_source_timeout"]

    all_hits: list[Hit] = []
    statuses: list[dict[str, Any]] = []

    def run_one(source: Source) -> tuple[Source, list[Hit], str | None, int]:
        start = time.monotonic()
        try:
            hits = source.search(terms, context) or []
            error = None
        except Exception as exc:  # Fehler einer Quelle stoppen nie die Pipeline
            log.warning("Quelle %s fehlgeschlagen: %s", source.key, exc)
            hits, error = [], f"{type(exc).__name__}: {exc}"
        duration_ms = int((time.monotonic() - start) * 1000)
        return source, hits, error, duration_ms

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(run_one, source): source for source in active}
        deadline = time.monotonic() + timeout * 2
        for future in concurrent.futures.as_completed(
            futures, timeout=max(30, deadline - time.monotonic())
        ):
            source = futures[future]
            try:
                source_obj, hits, error, duration_ms = future.result(timeout=timeout)
            except Exception as exc:
                statuses.append({
                    "source": source.label, "ok": False,
                    "error": f"Timeout/Fehler: {exc}", "hit_count": 0,
                    "duration_ms": None,
                })
                continue
            statuses.append({
                "source": source_obj.label,
                "ok": error is None,
                "error": error,
                "hit_count": len(hits),
                "duration_ms": duration_ms,
            })
            all_hits.extend(hits)

    ranked = rank_hits(all_hits, terms)
    return [h.as_dict() for h in ranked], statuses


# ------------------------------------------------------------------ Ranking

def _source_priority(hit: Hit) -> int:
    for source in source_registry.ALL_SOURCES:
        if source.label == hit.source:
            return source.priority
    return 2


def score_hit(hit: Hit, terms: SearchTerms) -> float:
    """Heuristik: exaktes Modell > Typ/Specs > Kategorie; eigener Bestand
    wird über die Sortierung (own_stock zuerst) priorisiert."""
    title = (hit.title or "").lower()
    score = float(hit.score or 0)

    for term in terms.exact:
        words = [w for w in term.lower().split() if len(w) > 1]
        if words and all(w in title for w in words):
            score = max(score, 100.0)
            hit.match_reason = hit.match_reason or f"Exakter Treffer für „{term}“"
            break
        if words and any(w in title for w in words):
            score = max(score, 55.0)

    for term in terms.functional:
        words = [w for w in term.lower().split() if len(w) > 2]
        if not words:
            continue
        matched = sum(1 for w in words if w in title)
        if matched == len(words):
            score = max(score, 60.0)
        elif matched:
            score = max(score, 25.0 + 10.0 * matched)

    if terms.kategorie:
        kat_words = [w for w in terms.kategorie.lower().replace("-", " ").split() if len(w) > 3]
        if any(w in title for w in kat_words):
            score = max(score, 20.0)

    # Quellen-Priorität leicht einrechnen (0-3 -> +6..0)
    score += (3 - _source_priority(hit)) * 2
    return round(score, 1)


def rank_hits(hits: list[Hit], terms: SearchTerms) -> list[Hit]:
    for hit in hits:
        hit.score = score_hit(hit, terms)
    return sorted(hits, key=lambda h: (not h.own_stock, -h.score, h.title or ""))
