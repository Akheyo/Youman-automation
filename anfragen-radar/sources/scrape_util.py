"""Hilfsfunktionen für Marktplatz-Scraper.

Die Portale ändern ihr Markup regelmäßig. Statt fragiler, seitenspezifischer
Selektoren nutzen die Plugins eine generische Heuristik: Links auf
Angebots-Detailseiten (per URL-Muster erkannt) einsammeln, Titel aus dem
Linktext/Umfeld ziehen, Preis/Ort per Regex aus dem umgebenden Block.
Plugins können zusätzlich eigene CSS-Selektoren vorschalten.
"""
from __future__ import annotations

import logging
import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from sources.base import Hit

log = logging.getLogger("radar.scrape")

PRICE_RE = re.compile(
    r"(?:€|EUR)\s*[\d.,]+|[\d.][\d.,]*\s*(?:€|EUR)|auf Anfrage|Preis auf Anfrage|VB",
    re.IGNORECASE,
)


def extract_price(text: str) -> str | None:
    match = PRICE_RE.search(text or "")
    return match.group(0).strip() if match else None


def parse_listing_links(
    html: str,
    base_url: str,
    href_pattern: str,
    source_label: str,
    max_hits: int = 15,
    min_title_len: int = 8,
) -> list[Hit]:
    """Generische Extraktion: alle Links, deren href auf ``href_pattern``
    (Regex) passt, werden als Angebots-Treffer interpretiert."""
    soup = BeautifulSoup(html, "lxml")
    pattern = re.compile(href_pattern)
    hits: list[Hit] = []
    seen_urls: set[str] = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not pattern.search(href):
            continue
        url = urljoin(base_url, href)
        # URL-Fragmente/Duplikate (mehrere Links pro Karte) zusammenfassen
        url_key = url.split("#")[0]
        if url_key in seen_urls:
            continue

        title = a.get_text(" ", strip=True)
        container = a.find_parent(["article", "li", "div"]) or a
        if len(title) < min_title_len:
            # Bild-Link o. ä. – Titel aus dem Container versuchen
            heading = container.find(["h2", "h3", "h4"])
            title = heading.get_text(" ", strip=True) if heading else title
        if len(title) < min_title_len:
            continue

        context_text = container.get_text(" ", strip=True)[:600]
        img = container.find("img")
        image_url = None
        if img is not None:
            src = img.get("src") or img.get("data-src")
            if src and not src.startswith("data:"):
                image_url = urljoin(base_url, src)

        seen_urls.add(url_key)
        hits.append(
            Hit(
                title=title[:200],
                url=url,
                source=source_label,
                price=extract_price(context_text),
                image_url=image_url,
            )
        )
        if len(hits) >= max_hits:
            break
    return hits
