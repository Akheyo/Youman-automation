"""Eigener Bestand: PlentyONE REST-API und eigene Maschinensucher-Listings.

Beide Quellen haben höchste Priorität und markieren Treffer mit
own_stock=True ("EIGENER BESTAND"-Badge im Dashboard).
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Any

import requests

from core import config
from sources import http
from sources.base import Hit, SearchTerms, Source

log = logging.getLogger("radar.sources.own")


class PlentySource(Source):
    """Artikelsuche über die PlentyONE REST-API (Login mit User/Passwort,
    danach Bearer-Token)."""

    key = "own_plenty"
    label = "Eigener Bestand (Plenty)"
    own_stock = True
    priority = 0

    _token: str | None = None
    _token_expires: float = 0.0
    _token_lock = threading.Lock()

    def _login(self, base_url: str, user: str, password: str) -> str:
        with self._token_lock:
            if self._token and time.monotonic() < self._token_expires:
                return self._token
            response = requests.post(
                f"{base_url.rstrip('/')}/rest/login",
                json={"username": user, "password": password},
                timeout=15,
                headers={"User-Agent": http.USER_AGENT},
            )
            response.raise_for_status()
            data = response.json()
            token = data.get("access_token") or data.get("accessToken")
            if not token:
                raise RuntimeError(f"Plenty-Login ohne Token: {list(data.keys())}")
            PlentySource._token = token
            PlentySource._token_expires = (
                time.monotonic() + int(data.get("expires_in", 3600)) - 60
            )
            return token

    def test_connection(self) -> str:
        cfg = config.load()["plenty"]
        if not cfg["user"] or not cfg["password"]:
            raise RuntimeError("Plenty-Zugangsdaten fehlen.")
        self._login(cfg["base_url"], cfg["user"], cfg["password"])
        return "Login erfolgreich."

    def search(self, terms: SearchTerms, context: dict[str, Any]) -> list[Hit]:
        cfg = config.load()
        plenty = cfg["plenty"]
        if not plenty["user"] or not plenty["password"]:
            log.info("Plenty nicht konfiguriert – Quelle übersprungen.")
            return []
        base_url = plenty["base_url"].rstrip("/")
        token = self._login(base_url, plenty["user"], plenty["password"])
        headers = {
            "Authorization": f"Bearer {token}",
            "User-Agent": http.USER_AGENT,
        }
        hits: list[Hit] = []
        seen_ids: set[Any] = set()
        for term in terms.all_terms(limit=cfg["search"]["max_terms_per_source"]):
            try:
                response = requests.get(
                    f"{base_url}/rest/items",
                    params={"name": term, "with": "itemImages,variations", "itemsPerPage": 10},
                    headers=headers,
                    timeout=20,
                )
                response.raise_for_status()
                data = response.json()
            except Exception as exc:
                log.warning("Plenty-Suche '%s' fehlgeschlagen: %s", term, exc)
                continue
            entries = data.get("entries", data if isinstance(data, list) else [])
            for item in entries:
                item_id = item.get("id")
                if item_id in seen_ids:
                    continue
                seen_ids.add(item_id)
                texts = (item.get("texts") or [{}])[0]
                title = texts.get("name1") or texts.get("name") or f"Artikel {item_id}"
                image_url = None
                images = item.get("itemImages") or []
                if images:
                    image_url = images[0].get("url")
                hits.append(self.make_hit(
                    title=str(title),
                    url=f"{base_url}/plenty/terra/item/{item_id}" if item_id else base_url,
                    match_reason=f"Eigener Plenty-Artikel, gefunden über „{term}“",
                    image_url=image_url,
                ))
        return hits


class OwnMaschinensucherSource(Source):
    """Eigene Maschinensucher-Inserate über die MS-API (liefert Root-Level-JSON)."""

    key = "own_maschinensucher"
    label = "Eigener Bestand (Maschinensucher)"
    own_stock = True
    priority = 0

    def _api_get(self, path: str, params: dict) -> Any:
        cfg = config.load()["maschinensucher"]
        if not cfg["api_key"]:
            raise RuntimeError("Maschinensucher-API-Key fehlt.")
        headers = {
            "Authorization": f"Bearer {cfg['api_key']}",
            "Accept": "application/json",
        }
        return http.get_json(
            f"{cfg['api_base'].rstrip('/')}{path}", params=params, headers=headers
        )

    def test_connection(self) -> str:
        self._fetch_own_ads()
        return "MS-API erreichbar."

    def _fetch_own_ads(self) -> list[dict]:
        cfg = config.load()["maschinensucher"]
        params: dict[str, Any] = {}
        if cfg.get("dealer_id"):
            params["dealer_id"] = cfg["dealer_id"]
        data = self._api_get("/v1/ads", params)
        # Root-Level-JSON: entweder direkt eine Liste oder unter üblichen Keys
        if isinstance(data, list):
            return data
        for key in ("ads", "data", "items", "results", "entries"):
            if isinstance(data, dict) and isinstance(data.get(key), list):
                return data[key]
        return []

    def search(self, terms: SearchTerms, context: dict[str, Any]) -> list[Hit]:
        cfg = config.load()["maschinensucher"]
        if not cfg["api_key"]:
            log.info("MS-API nicht konfiguriert – eigene Listings übersprungen.")
            return []
        try:
            ads = self._fetch_own_ads()
        except Exception as exc:
            log.warning("MS-API eigene Inserate fehlgeschlagen: %s", exc)
            return []
        needles = [t.lower() for t in terms.all_terms()]
        hits: list[Hit] = []
        for ad in ads:
            if not isinstance(ad, dict):
                continue
            title = str(
                ad.get("title") or ad.get("name") or ad.get("headline") or ""
            ).strip()
            haystack = " ".join(
                str(ad.get(k, "")) for k in ("title", "name", "description", "category", "manufacturer", "model")
            ).lower()
            matched = [n for n in needles if n and all(w in haystack for w in n.split())]
            if not title or not matched:
                continue
            price = ad.get("price") or ad.get("price_amount")
            hits.append(self.make_hit(
                title=title,
                url=str(ad.get("url") or ad.get("link") or ""),
                price=str(price) if price not in (None, "") else None,
                location=ad.get("location") or ad.get("city"),
                image_url=ad.get("image") or ad.get("image_url"),
                match_reason=f"Eigenes MS-Inserat, passt auf „{matched[0]}“",
            ))
        return hits
