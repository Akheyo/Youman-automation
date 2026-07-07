"""Externe Marktplätze als Scraping-Plugins (öffentliche Suche).

Jedes Plugin definiert nur URL-Template + Erkennungsmuster für
Angebots-Links; die eigentliche Extraktion macht scrape_util generisch.
Fehler (Netz, Markup-Änderung, Blockierung) werden vom Aufrufer pro Quelle
abgefangen und im Dashboard angezeigt.
"""
from __future__ import annotations

import logging
from typing import Any
from urllib.parse import quote_plus

from core import config
from sources import http, scrape_util
from sources.base import Hit, SearchTerms, Source

log = logging.getLogger("radar.sources")


class ScrapedMarketplace(Source):
    """Basis: Suche pro Begriff, generische Link-Extraktion."""

    search_url_template: str = ""  # {q} wird ersetzt (URL-encoded)
    href_pattern: str = ""
    base_url: str = ""
    priority = 2

    def search(self, terms: SearchTerms, context: dict[str, Any]) -> list[Hit]:
        cfg = config.load()["search"]
        hits: list[Hit] = []
        seen: set[str] = set()
        for term in terms.all_terms(limit=cfg["max_terms_per_source"]):
            url = self.search_url_template.format(q=quote_plus(term))
            try:
                response = http.get(url)
            except Exception as exc:
                log.warning("%s: Suche '%s' fehlgeschlagen: %s", self.key, term, exc)
                continue
            for hit in scrape_util.parse_listing_links(
                response.text,
                self.base_url or url,
                self.href_pattern,
                self.label,
                max_hits=cfg["max_hits_per_source"],
            ):
                if hit.url in seen:
                    continue
                seen.add(hit.url)
                hit.match_reason = f"Gefunden über Suchbegriff „{term}“"
                hit.own_stock = self.own_stock
                hits.append(hit)
            if len(hits) >= cfg["max_hits_per_source"]:
                break
        return hits


class MaschinensucherScrape(ScrapedMarketplace):
    key = "maschinensucher_markt"
    label = "Maschinensucher"
    priority = 1
    base_url = "https://www.maschinensucher.de"
    search_url_template = "https://www.maschinensucher.de/suchen?q={q}"
    href_pattern = r"/(?:a|angebot|anzeige|machine)[-/]\d+|/li-\d+"


class Ebay(ScrapedMarketplace):
    key = "ebay"
    label = "eBay.de"
    base_url = "https://www.ebay.de"
    search_url_template = "https://www.ebay.de/sch/i.html?_nkw={q}"
    href_pattern = r"ebay\.de/itm/|/itm/\d+"


class Kleinanzeigen(ScrapedMarketplace):
    key = "kleinanzeigen"
    label = "Kleinanzeigen.de"
    base_url = "https://www.kleinanzeigen.de"
    search_url_template = "https://www.kleinanzeigen.de/s-{q}/k0"
    href_pattern = r"/s-anzeige/"


class Surplex(ScrapedMarketplace):
    key = "surplex"
    label = "Surplex"
    base_url = "https://www.surplex.com"
    search_url_template = "https://www.surplex.com/de/maschinen.html?q={q}"
    href_pattern = r"/de/m/|/machine/|/maschine/"


class TradeMachines(ScrapedMarketplace):
    key = "trademachines"
    label = "TradeMachines"
    base_url = "https://trademachines.de"
    search_url_template = "https://trademachines.de/suche/?q={q}"
    href_pattern = r"trademachines\.(?:de|com)/.*\d|/redirect|/lot/"


class Resale(ScrapedMarketplace):
    key = "resale"
    label = "RESALE"
    base_url = "https://www.resale.de"
    search_url_template = "https://www.resale.de/suche/{q}"
    href_pattern = r"/angebot[-/]|/maschine[-/]|/machine[-/]"


class Exapro(ScrapedMarketplace):
    key = "exapro"
    label = "Exapro"
    base_url = "https://www.exapro.de"
    search_url_template = "https://www.exapro.de/suche/?q={q}"
    href_pattern = r"/p\d+|/gebrauchte?[-/]"


class Mascus(ScrapedMarketplace):
    key = "mascus"
    label = "Mascus"
    base_url = "https://www.mascus.de"
    search_url_template = "https://www.mascus.de/suche?query={q}"
    href_pattern = r"/[a-z-]+/[a-z0-9-]+/[a-z0-9-]+/\d+|details"


class Machinio(ScrapedMarketplace):
    key = "machinio"
    label = "Machinio"
    base_url = "https://www.machinio.de"
    search_url_template = "https://www.machinio.de/search?q={q}"
    href_pattern = r"/listings?/|/detail/"


class MachineseekerCom(ScrapedMarketplace):
    key = "machineseeker_com"
    label = "Machineseeker.com"
    base_url = "https://www.machineseeker.com"
    search_url_template = "https://www.machineseeker.com/search?q={q}"
    href_pattern = r"/(?:a|machine)[-/]\d+|/li-\d+"


class Gebrauchtmaschinen(ScrapedMarketplace):
    key = "gebrauchtmaschinen"
    label = "gebrauchtmaschinen.de"
    base_url = "https://www.gebrauchtmaschinen.de"
    search_url_template = "https://www.gebrauchtmaschinen.de/suche?q={q}"
    href_pattern = r"/maschine[-/]|/angebot[-/]|/inserat"
