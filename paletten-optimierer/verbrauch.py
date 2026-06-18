"""Verbrauchslogik (Spec §9).

Rechnet aus offenen Bestellungen + aktuellem Bestand:
- avg_verbrauch_pro_tag (gleitend, letzte N Tage aus Historie)
- reichweite_tage = bestand / avg_verbrauch_pro_tag
- ampel-Stufe: 🟢 / 🟡 / 🔴 / ⚫ (Spec §9)

Cron-Abtragung (Spec §9): geplantes_verbrauchsdatum < heute UND
status=='offen'  → automatisch 'verbraucht'. Wird in
``cron_abtragen()`` ausgefuehrt — UI ruft es bei jedem Page-Load auf.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any


AMPEL_GRUEN_TAGE = 30        # Reichweite > 30 → grün
AMPEL_GELB_TAGE = 14         # 14-30 → gelb, < 14 → rot, == 0 oder unbekannt → grau
AMPEL_ROT_TAGE = 0


def _parse_iso(d) -> date | None:
    if not d:
        return None
    if isinstance(d, date):
        return d
    try:
        return datetime.fromisoformat(str(d)[:10]).date()
    except ValueError:
        return None


def avg_verbrauch_pro_tag(*, bestellungen_modul, palette_id: str,
                            tage_zurueck: int = 90) -> float:
    """Mittlerer taeglicher Verbrauch der letzten N Tage fuer eine
    Palette. Liefert 0.0 wenn keine Daten."""
    heute = date.today()
    grenze = heute - timedelta(days=tage_zurueck)
    aktive = bestellungen_modul.aktive()  # offen + verbraucht
    summe = 0
    for b in aktive:
        if b.get("palette_id") != palette_id:
            continue
        d = _parse_iso(b.get("bestelldatum", ""))
        if d and d >= grenze:
            summe += int(b.get("menge", 0))
    return summe / tage_zurueck if tage_zurueck > 0 else 0.0


def reichweite_tage(bestand: int, avg_pro_tag: float) -> float | None:
    """Liefert None wenn avg=0 (unendliche Reichweite oder unbekannt)."""
    if avg_pro_tag <= 0:
        return None
    return max(0, bestand) / avg_pro_tag


def ampel(reichweite_t: float | None, *,
          gruen: int = AMPEL_GRUEN_TAGE,
          gelb: int = AMPEL_GELB_TAGE) -> str:
    """Liefert '🟢' / '🟡' / '🔴' / '⚫' nach Reichweite-Schwellwerten."""
    if reichweite_t is None:
        return "⚫"
    if reichweite_t <= AMPEL_ROT_TAGE + 0.0001:
        return "🔴"
    if reichweite_t < gelb:
        return "🔴"
    if reichweite_t < gruen:
        return "🟡"
    return "🟢"


def kritische_paletten(*, katalog_modul, bestellungen_modul,
                        tage_zurueck: int = 90) -> list[dict]:
    """Liefert Liste mit Status der aktiven Katalog-Paletten.
    Sortiert nach Reichweite aufsteigend (kritischste zuerst)."""
    out = []
    for e in katalog_modul.alle():
        if not e.get("aktiv", True):
            continue
        bestand = int(e.get("bestand", 0) or 0)
        bestand_bestellt = int(e.get("bestand_bestellt", 0) or 0)
        verfuegbar = bestand + bestand_bestellt
        avg = avg_verbrauch_pro_tag(bestellungen_modul=bestellungen_modul,
                                     palette_id=e["id"],
                                     tage_zurueck=tage_zurueck)
        r_jetzt = reichweite_tage(bestand, avg)
        r_inkl = reichweite_tage(verfuegbar, avg)
        a = ampel(r_jetzt)
        out.append({
            "id": e["id"],
            "name": e.get("name", ""),
            "L_mm": e.get("L_mm", 0),
            "B_mm": e.get("B_mm", 0),
            "bestand": bestand,
            "bestand_bestellt": bestand_bestellt,
            "avg_pro_tag": round(avg, 3),
            "reichweite_tage": r_jetzt,
            "reichweite_inkl_anlieferung_tage": r_inkl,
            "ampel": a,
            "kritisch": a in ("🔴", "🟡"),
        })
    # Sortierung: unbekannte ans Ende, sonst aufsteigend
    out.sort(key=lambda x: (x["reichweite_tage"] is None,
                              x["reichweite_tage"] or 0))
    return out


def cron_abtragen(*, bestellungen_modul) -> dict[str, Any]:
    """Spec §9: alle 'offen'-Bestellungen mit
    geplantes_verbrauchsdatum < heute werden automatisch auf
    'verbraucht' gesetzt. Liefert Statistik."""
    heute = date.today()
    geaendert = 0
    ids = []
    for b in bestellungen_modul.offene():
        d = _parse_iso(b.get("geplantes_verbrauchsdatum", ""))
        if d and d < heute:
            if bestellungen_modul.update_status(b["id"], "verbraucht"):
                geaendert += 1
                ids.append(b["id"])
    return {"geaendert": geaendert, "ids": ids, "datum": heute.isoformat()}
