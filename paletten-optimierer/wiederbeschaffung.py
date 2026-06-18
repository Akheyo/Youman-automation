"""Wiederbeschaffungs-Helper (Spec §5).

Pro Palette: Lieferzeit aus Lieferant ODER aus Override im Katalog-
Eintrag (lieferzeit_tage_override). Vergleich gegen aktuelle
Reichweite (aus verbrauch.py).

Ampel-Schema:
  🟢 Reichweite > Lieferzeit + Sicherheitspuffer
  🟡 Reichweite ≈ Lieferzeit (innerhalb Puffer)
  🔴 Reichweite < Lieferzeit  (Engpass)
"""
from __future__ import annotations

from typing import Any


def lieferzeit_fuer_palette(palette: dict, lieferanten: list[dict],
                              default_tage: int = 14) -> int:
    """Override > Default-Lieferant > default_tage."""
    override = int(palette.get("lieferzeit_tage_override", 0) or 0)
    if override > 0:
        return override
    lid = palette.get("default_lieferant_id", "")
    if lid:
        for l in lieferanten:
            if l.get("id") == lid:
                return int(l.get("lieferzeit_tage", default_tage) or default_tage)
    return default_tage


def ampel_status(reichweite_tage: float | None,
                  lieferzeit_tage: int,
                  sicherheitspuffer_tage: int = 7) -> str:
    """Liefert '🟢' | '🟡' | '🔴' | '⚫'."""
    if reichweite_tage is None:
        return "⚫"
    if reichweite_tage < lieferzeit_tage:
        return "🔴"
    if reichweite_tage <= lieferzeit_tage + sicherheitspuffer_tage:
        return "🟡"
    return "🟢"


def baue_zeilen(*, katalog_modul, lieferanten_modul, bestellungen_modul,
                  verbrauch_modul, sicherheitspuffer_tage: int = 7,
                  default_lieferzeit: int = 14) -> list[dict]:
    """Liefert pro aktiver Palette eine Zeile fuer den Wiederbeschaffungs-
    Bericht. Sortiert nach Ampel (rot zuerst), dann nach Reichweite asc."""
    lieferanten = lieferanten_modul.alle()
    krit_pro_pal = {k["id"]: k for k in verbrauch_modul.kritische_paletten(
        katalog_modul=katalog_modul,
        bestellungen_modul=bestellungen_modul,
    )}
    rows: list[dict] = []
    for e in katalog_modul.alle():
        if not e.get("aktiv", True):
            continue
        lz = lieferzeit_fuer_palette(e, lieferanten, default_lieferzeit)
        lid = e.get("default_lieferant_id", "")
        lname = next((l.get("name", "—") for l in lieferanten
                       if l.get("id") == lid),
                      "Eigenfertigung" if e.get("bezug_modus")
                                          == "selbstfertigung"
                      else "—")
        krit = krit_pro_pal.get(e["id"], {})
        reichweite = krit.get("reichweite_tage")
        ampel = ampel_status(reichweite, lz, sicherheitspuffer_tage)
        rows.append({
            "id": e["id"],
            "name": e.get("name", "") or "—",
            "L_mm": e.get("L_mm", 0),
            "B_mm": e.get("B_mm", 0),
            "lieferant": lname,
            "lieferzeit_tage": lz,
            "bestand": int(e.get("bestand", 0) or 0),
            "bestand_bestellt": int(e.get("bestand_bestellt", 0) or 0),
            "reichweite_tage": reichweite,
            "ampel": ampel,
            "kritisch": ampel in ("🔴", "🟡"),
        })
    rang = {"🔴": 0, "🟡": 1, "⚫": 2, "🟢": 3}
    rows.sort(key=lambda r: (rang.get(r["ampel"], 4),
                              r["reichweite_tage"] if r["reichweite_tage"]
                              is not None else 99999))
    return rows
