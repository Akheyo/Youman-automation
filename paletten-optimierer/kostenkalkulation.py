"""Kostenkalkulation Standardisierung IST vs SOLL.

Modell:
  Ist-Zustand (ohne Standardisierung):
    - Alles wird als Sonderpalette in Eigenfertigung produziert.
    - Größere Palettengröße → mehr Ladefläche → mehr LKWs.
    Gesamt-Ist = LKW_kosten_ist + eigenfertigung_ist

  Soll-Zustand (mit Standardisierung):
    - Standard-Paletten werden eingekauft (günstiger).
    - Kombinierbar → weniger Fläche → weniger LKWs.
    - Verbleibende Sonder werden weiter eigengefertigt.
    Gesamt-Soll = LKW_kosten_soll + palettenkauf_soll + eigenfertigung_soll

  Einsparung = Gesamt-Ist - Gesamt-Soll
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class KostenParameter:
    lkw_kosten_pro_stueck: float = 800.0          # €/LKW-Fahrt
    ladeflaeche_lkw_qm: float = 33.0              # m² (13.6 m × 2.44 m)
    eigenfertigung_kosten_pro_palette: float = 45.0
    palettenkauf_kosten_pro_palette: float = 12.0
    ladefaktor_ist: float = 0.75                  # Auslastung LKW (0..1)
    ladefaktor_soll: float = 0.90


def _flaeche_soll_qm(z: dict) -> float:
    """Beanspruchte Grundflaeche in m² fuer ein Zuordnungs-Item im Soll-
    Zustand: Standard-Ziel + evtl. Kombi-Belegung; sonst Rohmass."""
    typ = z.get("typ", "Sonder")
    ziel = z.get("ziel", "") or ""
    # Einzel-Standard: 'LxB'
    if typ == "Standard" and "x" in ziel and "+" not in ziel:
        try:
            a, b = ziel.split("x")
            return int(a) * int(b) / 1_000_000.0
        except ValueError:
            pass
    # Kombi-Stapel: 'kx (LxB)'
    if typ == "Kombi-Stapel" and "(" in ziel:
        try:
            k_teil, rest = ziel.split("x ", 1)
            k = int(k_teil.strip())
            a, b = rest.strip("()").split("x")
            # k Stapel nebeneinander in LAENGE
            return int(a) * k * int(b) / 1_000_000.0
        except (ValueError, IndexError):
            pass
    # Kombi-Heterogen: 'AxB + CxD'  -> Bounding-Box in LAENGE addiert
    if typ == "Kombi-Heterogen" and "+" in ziel:
        try:
            gesamt = 0.0
            groesste_b = 0.0
            for teil in ziel.split("+"):
                a, b = teil.strip().split("x")
                gesamt += int(a) * int(b)
                if int(b) > groesste_b:
                    groesste_b = int(b)
            return gesamt / 1_000_000.0
        except ValueError:
            pass
    # Sonder + Fallback: Rohmass aus Zuordnung
    L = z.get("L", 0)
    B = z.get("B", 0)
    return (int(L or 0) * int(B or 0)) / 1_000_000.0


def _flaeche_ist_qm(z: dict) -> float:
    """Im IST-Zustand wird jedes Item auf sein Original-Mass gerechnet."""
    L = z.get("L", 0)
    B = z.get("B", 0)
    return (int(L or 0) * int(B or 0)) / 1_000_000.0


def berechne_einsparung(zuordnungen: list[dict],
                         parameter: KostenParameter) -> dict[str, Any]:
    """Berechnet die vollstaendige IST/SOLL/Einsparung-Bilanz.

    Rueckgabe: dict mit allen Zwischenwerten fuer die UI-Aufschluesselung.
    """
    p = parameter
    lf_ist = max(0.01, min(1.0, float(p.ladefaktor_ist)))
    lf_soll = max(0.01, min(1.0, float(p.ladefaktor_soll)))
    lkw_qm = max(0.01, float(p.ladeflaeche_lkw_qm))

    paletten_gesamt = 0
    paletten_standard = 0
    paletten_sonder = 0
    flaeche_ist_kum = 0.0
    flaeche_soll_kum = 0.0

    for z in zuordnungen:
        menge = int(z.get("menge", 0) or 0)
        if menge <= 0:
            continue
        paletten_gesamt += menge
        typ = z.get("typ", "Sonder")
        if typ == "Sonder":
            paletten_sonder += menge
        else:
            paletten_standard += menge
        flaeche_ist_kum += _flaeche_ist_qm(z) * menge / lf_ist
        flaeche_soll_kum += _flaeche_soll_qm(z) * menge / lf_soll

    anzahl_lkws_ist = math.ceil(flaeche_ist_kum / lkw_qm) if flaeche_ist_kum > 0 else 0
    anzahl_lkws_soll = math.ceil(flaeche_soll_kum / lkw_qm) if flaeche_soll_kum > 0 else 0

    lkw_kosten_ist = anzahl_lkws_ist * p.lkw_kosten_pro_stueck
    lkw_kosten_soll = anzahl_lkws_soll * p.lkw_kosten_pro_stueck
    eigenfertigung_ist = paletten_gesamt * p.eigenfertigung_kosten_pro_palette
    palettenkauf_soll = paletten_standard * p.palettenkauf_kosten_pro_palette
    eigenfertigung_soll = paletten_sonder * p.eigenfertigung_kosten_pro_palette

    gesamt_ist = lkw_kosten_ist + eigenfertigung_ist
    gesamt_soll = lkw_kosten_soll + palettenkauf_soll + eigenfertigung_soll
    einsparung = gesamt_ist - gesamt_soll

    return {
        "parameter": asdict(p),
        "paletten_gesamt": paletten_gesamt,
        "paletten_standard": paletten_standard,
        "paletten_sonder": paletten_sonder,
        "flaeche_ist_qm": flaeche_ist_kum,
        "flaeche_soll_qm": flaeche_soll_kum,
        "anzahl_lkws_ist": anzahl_lkws_ist,
        "anzahl_lkws_soll": anzahl_lkws_soll,
        "lkw_kosten_ist": lkw_kosten_ist,
        "lkw_kosten_soll": lkw_kosten_soll,
        "eigenfertigung_ist": eigenfertigung_ist,
        "palettenkauf_soll": palettenkauf_soll,
        "eigenfertigung_soll": eigenfertigung_soll,
        "gesamt_ist": gesamt_ist,
        "gesamt_soll": gesamt_soll,
        "einsparung": einsparung,
    }
