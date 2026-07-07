"""Gemeinsamer HTTP-Client für Scraper: User-Agent, Timeout und
respektvolles Rate-Limiting pro Domain."""
from __future__ import annotations

import logging
import threading
import time
from urllib.parse import urlparse

import requests

log = logging.getLogger("radar.http")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

MIN_INTERVAL_SECONDS = 2.0
DEFAULT_TIMEOUT = 15

_session = requests.Session()
_session.headers.update({
    "User-Agent": USER_AGENT,
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
})

_domain_lock = threading.Lock()
_last_request: dict[str, float] = {}


def _rate_limit(url: str) -> None:
    domain = urlparse(url).netloc
    while True:
        with _domain_lock:
            last = _last_request.get(domain, 0.0)
            wait = MIN_INTERVAL_SECONDS - (time.monotonic() - last)
            if wait <= 0:
                _last_request[domain] = time.monotonic()
                return
        time.sleep(min(wait, MIN_INTERVAL_SECONDS))


def get(url: str, params: dict | None = None, timeout: int = DEFAULT_TIMEOUT,
        headers: dict | None = None) -> requests.Response:
    _rate_limit(url)
    response = _session.get(url, params=params, timeout=timeout, headers=headers)
    response.raise_for_status()
    return response


def get_json(url: str, params: dict | None = None, timeout: int = DEFAULT_TIMEOUT,
             headers: dict | None = None):
    return get(url, params=params, timeout=timeout, headers=headers).json()
