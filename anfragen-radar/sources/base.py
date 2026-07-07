"""Basis für alle Suchquellen-Plugins.

Jede Quelle implementiert ``search(terms, context) -> list[Hit]``.
Fehler einer Quelle dürfen die Pipeline nie stoppen – das stellt der
Aufrufer (core/search.py) sicher, hier wird nur das Interface definiert.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class SearchTerms:
    exact: list[str] = field(default_factory=list)
    functional: list[str] = field(default_factory=list)
    kategorie: str | None = None

    def all_terms(self, limit: int | None = None) -> list[str]:
        terms = [*self.exact, *self.functional]
        # Duplikate entfernen, Reihenfolge erhalten
        seen: set[str] = set()
        unique = []
        for term in terms:
            key = term.lower().strip()
            if key and key not in seen:
                seen.add(key)
                unique.append(term.strip())
        return unique[:limit] if limit else unique


@dataclass
class Hit:
    title: str
    url: str
    source: str
    price: str | None = None
    location: str | None = None
    image_url: str | None = None
    match_reason: str = ""
    score: float = 0.0
    own_stock: bool = False

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class Source(ABC):
    """Basisklasse für Suchquellen. ``key`` muss zum Eintrag in
    ``config.sources_enabled`` passen."""

    key: str = ""
    label: str = ""
    own_stock: bool = False
    # Priorität fürs Ranking: 0 = eigener Bestand, 1 = Maschinensucher,
    # 2 = externe Marktplätze, 3 = freies Netz
    priority: int = 2

    @abstractmethod
    def search(self, terms: SearchTerms, context: dict[str, Any]) -> list[Hit]:
        """context enthält z. B. die Original-Anfrage (dict) für Quellen,
        die mehr als die reinen Suchbegriffe brauchen (LLM-Filter etc.)."""

    def make_hit(self, **kwargs: Any) -> Hit:
        kwargs.setdefault("source", self.label or self.key)
        kwargs.setdefault("own_stock", self.own_stock)
        return Hit(**kwargs)
