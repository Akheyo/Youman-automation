"""Update-Checker für PalettenMini.

Prüft gegen ein remote JSON-Manifest ob eine neuere Version verfügbar ist.
Netzwerkfehler werden still ignoriert — die App läuft auch offline.

Das Manifest liegt unter UPDATE_MANIFEST_URL. Du aktualisierst es bei
jedem neuen Release. Kein API-Key, kein GitHub-Rate-Limit.
"""
from __future__ import annotations

import json
import threading
import urllib.error
import urllib.request

UPDATE_MANIFEST_URL = (
    "https://raw.githubusercontent.com/akheyo/youman-automation/"
    "main/paletten-optimierer/mini/update_manifest.json"
)

_lock = threading.Lock()
_cache: dict = {}   # "checked": bool, "result": dict | None


# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------

def _version_tuple(v: str) -> tuple[int, ...]:
    """Konvertiert "1.2.3" → (1, 2, 3). Unbekannte Versionen → (0,)."""
    try:
        return tuple(int(x) for x in v.strip().lstrip("v").split("."))
    except Exception:
        return (0,)


def _current_version() -> str:
    try:
        from _build_info import BUILD_VERSION  # type: ignore
        return BUILD_VERSION or "dev"
    except Exception:
        return "dev"


# ---------------------------------------------------------------------------
# Öffentliche API
# ---------------------------------------------------------------------------

def pruefe_update(timeout: float = 5.0) -> dict | None:
    """Synchroner Update-Check (blockierend, max. ``timeout`` Sekunden).

    Returns:
        dict mit ``version``, ``release_date``, ``download_url``,
        ``changelog``, ``current_version`` wenn eine neuere Version
        verfügbar ist — sonst ``None``.
    """
    with _lock:
        if _cache.get("checked"):
            return _cache.get("result")

    current = _current_version()
    if current == "dev":
        # Entwicklungs-Build — kein Update-Check nötig
        with _lock:
            _cache["checked"] = True
            _cache["result"] = None
        return None

    try:
        req = urllib.request.Request(
            UPDATE_MANIFEST_URL,
            headers={"User-Agent": f"PalettenMini/{current}"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        latest = data.get("version", "").strip()
        if not latest:
            raise ValueError("Manifest enthält keine Version")

        if _version_tuple(latest) > _version_tuple(current):
            result: dict | None = {
                "version": latest,
                "release_date": data.get("release_date", ""),
                "download_url": data.get("download_url", ""),
                "changelog": data.get("changelog", ""),
                "current_version": current,
            }
        else:
            result = None

    except Exception:
        result = None

    with _lock:
        _cache["checked"] = True
        _cache["result"] = result

    return result


def pruefe_update_async(on_done=None) -> threading.Thread:
    """Startet den Update-Check im Hintergrund-Thread.

    ``on_done(result)`` wird nach dem Check aufgerufen (falls angegeben).
    Kein UI-Zugriff aus dem Callback erlaubt — nur Session-State setzen.
    """
    def _worker() -> None:
        result = pruefe_update()
        if on_done is not None:
            try:
                on_done(result)
            except Exception:
                pass

    t = threading.Thread(target=_worker, daemon=True)
    t.start()
    return t


def cache_leeren() -> None:
    """Erzwingt einen erneuten Check beim nächsten Aufruf."""
    with _lock:
        _cache.clear()
