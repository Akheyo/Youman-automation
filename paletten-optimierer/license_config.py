"""Lizenz-Konfiguration — wird vom Build-Workflow überschrieben.

``LICENSE_EXPIRES`` ist entweder ein ISO-Datum (``"2026-06-15"``) oder
``None`` für eine unbegrenzte Lizenz.

Im Dev-Modus (nicht eingefroren via PyInstaller) wird die Lizenz nicht
geprüft, sodass Entwickler ohne Ablaufdatum arbeiten können.
"""
from __future__ import annotations

from datetime import date


# Wird vom GitHub-Workflow zur Build-Zeit überschrieben.
# Format: ISO-Datum als String "YYYY-MM-DD", oder None für unbegrenzt.
LICENSE_EXPIRES: str | None = None

# Anzeigename des Lizenznehmers (Banner-Text).
LIZENZNEHMER: str = "Test-Version"

# Kontakt-Hinweis, der im Banner und in der Sperr-Meldung erscheint.
KONTAKT: str = ""


def expiry_date() -> date | None:
    if LICENSE_EXPIRES is None:
        return None
    try:
        return date.fromisoformat(LICENSE_EXPIRES)
    except (TypeError, ValueError):
        return None


def ist_abgelaufen(heute: date | None = None) -> bool:
    exp = expiry_date()
    if exp is None:
        return False
    heute = heute or date.today()
    return heute > exp


def tage_verbleibend(heute: date | None = None) -> int | None:
    exp = expiry_date()
    if exp is None:
        return None
    heute = heute or date.today()
    return (exp - heute).days
