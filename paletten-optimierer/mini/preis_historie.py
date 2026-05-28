"""Preis-Historie-Helper (Spec §8).

Vergleicht EK-Werte zwischen aktuellem Excel-Import und vergangenen
Importen aus import_verlauf.json. Liefert pro Artikel/Maß:
  - aktuell_ek
  - letzter_ek (aus vorheriger Periode)
  - delta_eur, delta_pct, trend ('+'|'-'|'=')

Speichert pro Verlauf-Eintrag einen ek_snapshot {(L,B): ek} fuer den
Vergleich beim naechsten Import.
"""
from __future__ import annotations

from typing import Any


def _kanon(L: int, B: int) -> tuple[int, int]:
    return (min(int(L), int(B)), max(int(L), int(B)))


def baue_ek_snapshot(katalog_eintraege: list[dict]) -> dict[str, float]:
    """Liefert {(L,B): ek_lieferant} als string-keyed dict
    (JSON-serialisierbar)."""
    out = {}
    for e in katalog_eintraege:
        if not e.get("aktiv", True):
            continue
        cs, cl = _kanon(e.get("L_mm", 0), e.get("B_mm", 0))
        ek = float(e.get("ek_lieferant_eur",
                            e.get("einkaufspreis_eur", 0)) or 0)
        out[f"{cl}x{cs}"] = ek
    return out


def vergleiche_ek(aktuelle_ek: dict[str, float],
                   verlauf_eintraege: list[dict]) -> dict[str, dict]:
    """Vergleicht aktuell vs. den letzten Snapshot aus dem Verlauf.

    aktuelle_ek: dict 'LxB' -> float
    verlauf_eintraege: aus import_verlauf.alle() (neueste zuerst)

    Liefert dict 'LxB' -> {
        aktuell, letzter, delta_eur, delta_pct, trend, datum
    }. Nur Maße mit Treffer in Verlauf werden aufgenommen.
    """
    out = {}
    if not aktuelle_ek:
        return out
    # Den ältesten Snapshot, der vom AKTUELLEN abweicht, brauchen wir nicht
    # — wir nehmen den NEUESTEN vorherigen Snapshot pro Maß
    letzte_pro_mass: dict[str, tuple[float, str]] = {}
    for e in verlauf_eintraege:
        snap = (e.get("optimierung") or {}).get("ek_snapshot") or {}
        if not snap:
            # Fallback: auch direkt im Eintrag wenn vorhanden
            snap = e.get("ek_snapshot") or {}
        datum = (e.get("datum") or "")[:10]
        for k, v in snap.items():
            if k not in letzte_pro_mass:
                letzte_pro_mass[k] = (float(v), datum)
    for k, ek_neu in aktuelle_ek.items():
        if k not in letzte_pro_mass:
            continue
        ek_alt, datum = letzte_pro_mass[k]
        if ek_alt <= 0:
            continue
        delta = ek_neu - ek_alt
        pct = (delta / ek_alt) * 100.0
        trend = "+" if delta > 0.001 else ("-" if delta < -0.001 else "=")
        out[k] = {
            "aktuell": ek_neu,
            "letzter": ek_alt,
            "delta_eur": delta,
            "delta_pct": pct,
            "trend": trend,
            "datum_alt": datum,
        }
    return out


def auffaellige_aenderungen(vergleich: dict[str, dict],
                              schwelle_pct: float = 10.0) -> list[str]:
    """Liefert Liste 'LxB' der Maße mit |delta_pct| > schwelle."""
    return [k for k, v in vergleich.items()
            if abs(v.get("delta_pct", 0)) > schwelle_pct]


def preis_zeitreihe(verlauf_eintraege: list[dict]) -> dict[str, list[dict]]:
    """Liefert pro Maß eine zeitlich sortierte Liste von Preis-Punkten
    (aelteste zuerst) — fuer den Preis-Verlauf-Bericht."""
    reihe: dict[str, list[dict]] = {}
    for e in reversed(verlauf_eintraege):  # chronologisch
        snap = (e.get("optimierung") or {}).get("ek_snapshot") or {}
        if not snap:
            snap = e.get("ek_snapshot") or {}
        datum = (e.get("datum") or "")[:10]
        for k, v in snap.items():
            reihe.setdefault(k, []).append({
                "datum": datum, "ek": float(v),
            })
    return reihe
