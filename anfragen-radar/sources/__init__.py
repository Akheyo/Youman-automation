"""Registry aller Suchquellen-Plugins.

Neue Quelle ergänzen: Klasse von ``sources.base.Source`` ableiten und hier
in ``ALL_SOURCES`` eintragen (plus Schalter in ``config.DEFAULTS``).
"""
from __future__ import annotations

from sources.base import Source
from sources.marketplaces import (
    Ebay,
    Exapro,
    Gebrauchtmaschinen,
    Kleinanzeigen,
    Machinio,
    MachineseekerCom,
    MaschinensucherScrape,
    Mascus,
    Resale,
    Surplex,
    TradeMachines,
)
from sources.own_stock import OwnMaschinensucherSource, PlentySource
from sources.websearch import WebSearchSource

ALL_SOURCES: list[Source] = [
    # Priorität 0: eigener Bestand
    PlentySource(),
    OwnMaschinensucherSource(),
    # Priorität 1: Maschinensucher-Marktplatz
    MaschinensucherScrape(),
    # Priorität 2: externe Marktplätze
    Ebay(),
    Kleinanzeigen(),
    Surplex(),
    TradeMachines(),
    Resale(),
    Exapro(),
    Mascus(),
    Machinio(),
    MachineseekerCom(),
    Gebrauchtmaschinen(),
    # Priorität 3: freies Netz
    WebSearchSource(),
]


def enabled_sources(cfg: dict) -> list[Source]:
    switches = cfg.get("sources_enabled", {})
    return [s for s in ALL_SOURCES if switches.get(s.key, True)]
