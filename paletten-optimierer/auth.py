"""Einfacher Login-Gate für die Mini-App.

- Benutzer + Passwort sind hier hinterlegt (Passwort nur als SHA-256-Hash,
  niemals im Klartext).
- Jeder Zugang hat ein Ablaufdatum ("ablauf", letzter gültiger Tag,
  EINSCHLIESSLICH). Ab dem Folgetag ist ein Login gesperrt — bestehende
  Sitzungen werden beim nächsten Rerun ebenfalls beendet.

Hinweis: Das ist ein leichter Zugriffsschutz für eine lokal laufende
Desktop-App, keine kryptografisch harte Mehrbenutzer-Authentifizierung.
Das Ablaufdatum richtet sich nach der Systemuhr des Rechners.
"""
from __future__ import annotations

import hashlib
from datetime import date


# ---------------------------------------------------------------------------
# Zugangsdaten. Schlüssel = Benutzername (Vergleich case-insensitiv).
#   pw_sha256 : SHA-256-Hex des Passworts
#   ablauf    : letzter Tag, an dem der Login noch funktioniert (inklusive)
# ---------------------------------------------------------------------------
_USERS: dict[str, dict] = {
    # Benutzer: Mohsen  ·  Passwort: Youman#Juni2026
    "mohsen": {
        "pw_sha256":
            "be89732cf5bf8e682134e6247478f33f15f84912e8412106ff6c8dd43ea862c8",
        "ablauf": date(2026, 7, 5),
    },
}


def _norm(user: str | None) -> str:
    return (user or "").strip().casefold()


def _hash(pw: str | None) -> str:
    return hashlib.sha256((pw or "").encode("utf-8")).hexdigest()


def ablauf(user: str | None) -> date | None:
    """Ablaufdatum (inklusive) des Benutzers, oder None wenn unbekannt."""
    rec = _USERS.get(_norm(user))
    return rec["ablauf"] if rec else None


def ist_gueltig(user: str | None, heute: date | None = None) -> tuple[bool, str]:
    """Prüft nur, ob der Benutzer existiert und noch nicht abgelaufen ist
    (ohne Passwort) — für die Re-Prüfung laufender Sitzungen."""
    heute = heute or date.today()
    rec = _USERS.get(_norm(user))
    if not rec:
        return (False, "Sitzung ungültig — bitte erneut anmelden.")
    if heute > rec["ablauf"]:
        return (False, "Zugang abgelaufen "
                f"(gültig war bis {rec['ablauf'].strftime('%d.%m.%Y')}).")
    return (True, "")


def pruefe(user: str | None, pw: str | None,
           heute: date | None = None) -> tuple[bool, str]:
    """Login-Prüfung: Benutzer + Passwort + Ablaufdatum.
    Liefert (ok, fehlermeldung)."""
    heute = heute or date.today()
    rec = _USERS.get(_norm(user))
    # Konstante Fehlermeldung für falscher-User / falsches-PW (kein Leak,
    # ob der Benutzername existiert).
    if not rec or _hash(pw) != rec["pw_sha256"]:
        return (False, "Benutzername oder Passwort falsch.")
    if heute > rec["ablauf"]:
        return (False, "Zugang abgelaufen "
                f"(gültig war bis {rec['ablauf'].strftime('%d.%m.%Y')}).")
    return (True, "")
