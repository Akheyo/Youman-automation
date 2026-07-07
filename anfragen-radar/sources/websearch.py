"""Freies Netz: Websuche über Brave Search API, SerpAPI oder
DuckDuckGo-HTML (Fallback ohne Key). Ergebnisse werden per LLM auf
Relevanz gefiltert (Fail-Open bei LLM-Fehlern)."""
from __future__ import annotations

import logging
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from bs4 import BeautifulSoup

from core import config, llm
from sources import http
from sources.base import Hit, SearchTerms, Source

log = logging.getLogger("radar.sources.web")

# Domains, die eigene Plugins abdecken – im Websuche-Ergebnis überspringen
SKIP_DOMAINS = (
    "maschinensucher.de", "machineseeker.com", "ebay.de", "kleinanzeigen.de",
    "surplex.com", "trademachines", "resale.", "exapro", "mascus", "machinio",
    "gebrauchtmaschinen.de", "google.", "duckduckgo.",
)


class WebSearchSource(Source):
    key = "websearch"
    label = "Websuche"
    priority = 3

    def search(self, terms: SearchTerms, context: dict[str, Any]) -> list[Hit]:
        cfg = config.load()
        provider = cfg["websearch"]["provider"]
        api_key = cfg["websearch"]["api_key"]
        raw_results: list[dict[str, str]] = []
        for term in terms.all_terms(limit=3):
            query = f"{term} gebraucht kaufen"
            try:
                if provider == "brave" and api_key:
                    raw_results += self._brave(query, api_key)
                elif provider == "serpapi" and api_key:
                    raw_results += self._serpapi(query, api_key)
                else:
                    raw_results += self._duckduckgo(query)
            except Exception as exc:
                log.warning("Websuche (%s) '%s' fehlgeschlagen: %s", provider, query, exc)

        # Deduplizieren und Marktplatz-Domains (eigene Plugins) aussortieren
        seen: set[str] = set()
        candidates: list[dict[str, Any]] = []
        for res in raw_results:
            url = res.get("url", "")
            domain = urlparse(url).netloc.lower()
            if not url or url in seen or any(skip in domain for skip in SKIP_DOMAINS):
                continue
            seen.add(url)
            candidates.append(res)
        candidates = candidates[:20]

        # LLM-Relevanzfilter
        request = context.get("request", {})
        gesucht = request.get("anfrage_zu") or (terms.exact[0] if terms.exact else "")
        anforderungen = context.get("anforderungen", [])
        filtered = llm.filter_hits_relevance(gesucht, anforderungen, candidates)

        hits = []
        for res in filtered[:15]:
            hits.append(self.make_hit(
                title=res.get("title", res["url"])[:200],
                url=res["url"],
                match_reason=res.get("match_reason")
                or f"Webtreffer: {res.get('snippet', '')[:120]}",
            ))
        return hits

    # ------------------------------------------------------------- Provider

    def _brave(self, query: str, api_key: str) -> list[dict[str, str]]:
        data = http.get_json(
            "https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": 10, "country": "de"},
            headers={"X-Subscription-Token": api_key},
        )
        results = (data.get("web") or {}).get("results", [])
        return [
            {"title": r.get("title", ""), "url": r.get("url", ""),
             "snippet": r.get("description", "")}
            for r in results
        ]

    def _serpapi(self, query: str, api_key: str) -> list[dict[str, str]]:
        data = http.get_json(
            "https://serpapi.com/search.json",
            params={"q": query, "api_key": api_key, "hl": "de", "gl": "de", "num": 10},
        )
        return [
            {"title": r.get("title", ""), "url": r.get("link", ""),
             "snippet": r.get("snippet", "")}
            for r in data.get("organic_results", [])
        ]

    def _duckduckgo(self, query: str) -> list[dict[str, str]]:
        response = http.get(
            "https://html.duckduckgo.com/html/", params={"q": query}
        )
        soup = BeautifulSoup(response.text, "lxml")
        results = []
        for anchor in soup.select("a.result__a")[:10]:
            href = anchor.get("href", "")
            # DDG-Redirect-Links (/l/?uddg=...) auflösen
            if "uddg=" in href:
                qs = parse_qs(urlparse(href).query)
                href = unquote(qs.get("uddg", [href])[0])
            snippet_el = anchor.find_parent(class_="result")
            snippet = ""
            if snippet_el:
                sn = snippet_el.select_one(".result__snippet")
                snippet = sn.get_text(" ", strip=True) if sn else ""
            results.append({
                "title": anchor.get_text(" ", strip=True),
                "url": href,
                "snippet": snippet,
            })
        return results
