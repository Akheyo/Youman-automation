"""Wirtschaftlichkeits- und Logistikkosten-Modul (Spec §11).

Rechnet die Kosten der Standardisierung gegen die Einsparung der
Variantenreduktion:

  netto = handling_einsparung
        + variantenkosten_einsparung
        − palettenkauf_diff
        − transport_mehrkosten
        − lager_mehrkosten

Persistente Cost-Parameter im User-Profil:
  Windows: %APPDATA%/PalettenMini/wirtschaftlichkeit.json
  Linux/Mac: ~/.palettenmini/wirtschaftlichkeit.json
  ENV-Override: PALETTENMINI_WIRT

Datenstrukturen:
  CostParameters (dict): alle Eingaben aus Spec §11.1
  szenarien (dict per name): gespeicherte Sensitivitaets-Szenarien

LKW-Layout (2D-Bin-Packing inkl. 90°-Drehung):
  Pro Palettentyp: max(floor(lkw_l/p_l)·floor(lkw_b/p_b),
                       floor(lkw_l/p_b)·floor(lkw_b/p_l))
  Plus max_palettenstapel, Gewichts-Cap.
  Mischladung wird approximiert ueber Flaechen-Anteil
  (siehe paletten_pro_lkw_gemischt).
"""
from __future__ import annotations

import json
import math
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Persistenz
# ---------------------------------------------------------------------------
DEFAULT_COST_PARAMS = {
    # Transport (Standardsattel) — LKW-Maße
    "lkw_laenge_mm": 13620,
    "lkw_breite_mm": 2450,
    "lkw_hoehe_mm": 2700,
    "max_palettenstapel": 2,
    "max_gewicht_kg": 24000,
    # Logistik-Modi (Spec §11.1) — alle drei Werte werden parallel
    # gehalten, damit Umschalten keinen State verliert.
    "modus_logistik": "A",                 # "A" | "B" | "C"
    # Modus A — Pauschal pro LKW
    "kosten_pro_lkw_eur": 800.0,
    "lademeter_pro_lkw": 13.6,
    # Modus B — Direkt pro Lademeter
    "kosten_pro_lademeter_eur": 60.0,
    # Modus C — Pro m² (× lkw_breite_m → Lademeter)
    "kosten_pro_m2_eur": 25.0,
    # Berechnungsvariante (§11.2)
    "berechnung_variante": "flaeche",      # "flaeche" | "laenge"
    # Lager (optional)
    "lagerkosten_pro_stellplatz_pro_tag_eur": 0.50,
    "avg_lagerdauer_tage": 14,
    # Paletten-Handling
    "handling_kosten_pro_palettentyp_eur": 50.0,
    "variantenkosten_pro_typ_eur": 200.0,
    # Cold Start: manuelle Paletten/Periode wenn keine Historie da ist
    "paletten_pro_periode_manuell": 0,
    # Periode (Spec §11.7)
    "periode_tage": 30,
    # Toggle (Spec §11 boolean)
    "aktiv": False,
    # Legacy — kept for back-compat in vergleich(). 0 = ignoriert,
    # neuer Mechanismus ist lademeter-basiert.
    "kosten_pro_fahrt_eur": 0.0,
    "distanz_km": 0.0,
    "kosten_pro_km_eur": 0.0,
}


def _pfad() -> Path:
    env = os.environ.get("PALETTENMINI_WIRT")
    if env:
        return Path(env)
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "PalettenMini"
    else:
        base = Path.home() / ".palettenmini"
    base.mkdir(parents=True, exist_ok=True)
    return base / "wirtschaftlichkeit.json"


def pfad_str() -> str:
    return str(_pfad())


def _read_raw() -> dict[str, Any]:
    p = _pfad()
    if not p.exists():
        return {"cost_params": dict(DEFAULT_COST_PARAMS), "szenarien": {}}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("not a dict")
        cp = dict(DEFAULT_COST_PARAMS)
        cp.update(data.get("cost_params", {}))
        return {"cost_params": cp,
                "szenarien": data.get("szenarien", {})}
    except (OSError, json.JSONDecodeError, ValueError):
        return {"cost_params": dict(DEFAULT_COST_PARAMS), "szenarien": {}}


def _write_raw(d: dict[str, Any]) -> None:
    p = _pfad()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(d, ensure_ascii=False, indent=2),
                    encoding="utf-8")
    tmp.replace(p)


def lade_params() -> dict[str, Any]:
    return _read_raw()["cost_params"]


def speichere_params(params: dict[str, Any]) -> None:
    d = _read_raw()
    cp = dict(d["cost_params"])
    cp.update({k: v for k, v in params.items() if k in DEFAULT_COST_PARAMS})
    d["cost_params"] = cp
    _write_raw(d)


def speichere_szenario(name: str, params: dict[str, Any],
                        ergebnis: dict[str, Any]) -> None:
    d = _read_raw()
    d["szenarien"][name] = {
        "datum": datetime.now().isoformat(timespec="seconds"),
        "params": params,
        "ergebnis": ergebnis,
    }
    _write_raw(d)


def alle_szenarien() -> dict[str, Any]:
    return _read_raw()["szenarien"]


def loesche_szenario(name: str) -> bool:
    d = _read_raw()
    if name not in d["szenarien"]:
        return False
    del d["szenarien"][name]
    _write_raw(d)
    return True


# ---------------------------------------------------------------------------
# LKW-Layout (2D-Bin-Packing inkl. 90°-Drehung) — Spec §11.2 + §17
# ---------------------------------------------------------------------------
def paletten_pro_grundflaeche(lkw_l: int, lkw_b: int,
                                p_l: int, p_b: int) -> dict[str, Any]:
    """Best-Fit von 1 Paletten-Typ auf der LKW-Grundflaeche, mit
    90°-Rotation. Liefert dict mit anzahl + orientierung."""
    if p_l <= 0 or p_b <= 0 or lkw_l <= 0 or lkw_b <= 0:
        return {"anzahl": 0, "orientierung": None, "passt": False}
    if p_l > lkw_l and p_b > lkw_l:
        return {"anzahl": 0, "orientierung": None, "passt": False}
    if p_l > lkw_b and p_b > lkw_b:
        return {"anzahl": 0, "orientierung": None, "passt": False}
    optionen = []
    for orient_label, (a, b) in (("normal", (p_l, p_b)),
                                   ("90grad", (p_b, p_l))):
        if a > lkw_l or b > lkw_b:
            continue
        anz = (lkw_l // a) * (lkw_b // b)
        optionen.append((anz, orient_label))
    if not optionen:
        return {"anzahl": 0, "orientierung": None, "passt": False}
    best = max(optionen, key=lambda x: x[0])
    return {"anzahl": int(best[0]), "orientierung": best[1], "passt": True}


def paletten_pro_lkw(lkw_l: int, lkw_b: int, lkw_h: int,
                      max_stapel: int, max_gewicht_kg: float,
                      p_l: int, p_b: int, p_h: int = 0,
                      gewicht_pro_palette_kg: float = 0.0) -> dict[str, Any]:
    """Berechnet Paletten pro LKW unter Beruecksichtigung von Stapel-
    und Gewichts-Cap."""
    g = paletten_pro_grundflaeche(lkw_l, lkw_b, p_l, p_b)
    if not g["passt"]:
        return {**g, "stapel": 0, "anzahl_total": 0, "fehler": "Palette zu groß"}
    stapel = max(1, int(max_stapel))
    if p_h > 0 and lkw_h > 0:
        stapel = min(stapel, max(1, lkw_h // p_h))
    anz_total = g["anzahl"] * stapel
    # Gewichts-Cap
    if gewicht_pro_palette_kg > 0 and max_gewicht_kg > 0:
        max_per_gewicht = int(max_gewicht_kg // gewicht_pro_palette_kg)
        anz_total = min(anz_total, max_per_gewicht)
    return {"anzahl": g["anzahl"], "orientierung": g["orientierung"],
            "passt": True, "stapel": stapel, "anzahl_total": int(anz_total),
            "fehler": ""}


def fahrten_benoetigt(paletten_count_per_typ: dict[tuple, int],
                       cost_params: dict) -> dict[str, Any]:
    """Pro Typ wird angenommen, eine Fahrt enthaelt einen Typ
    (dedicated). Liefert dict mit fahrten_pro_typ + total_fahrten +
    detail-Liste fuers Dashboard.

    Liefert auch einen 'best_fit_total'-Wert als untere Schranke
    (Σ_Paletten / max_paletten_pro_lkw_irgendein_typ)."""
    lkw_l = int(cost_params.get("lkw_laenge_mm", 13620))
    lkw_b = int(cost_params.get("lkw_breite_mm", 2480))
    lkw_h = int(cost_params.get("lkw_hoehe_mm", 2700))
    stapel = int(cost_params.get("max_palettenstapel", 2))
    max_g = float(cost_params.get("max_gewicht_kg", 24000))

    fahrten_pro_typ: dict[tuple, int] = {}
    paletten_pro_lkw_dict: dict[tuple, int] = {}
    detail = []
    total_fahrten = 0
    total_paletten = 0
    for kand, count in paletten_count_per_typ.items():
        cs, cl = min(kand), max(kand)
        info = paletten_pro_lkw(lkw_l, lkw_b, lkw_h, stapel, max_g,
                                  p_l=cl, p_b=cs)
        if info["anzahl_total"] <= 0:
            # Palette passt nicht auf LKW
            detail.append({"typ": kand, "paletten": count,
                            "pro_lkw": 0, "fahrten": math.inf,
                            "fehler": info.get("fehler", "passt nicht")})
            continue
        f = int(math.ceil(count / info["anzahl_total"]))
        fahrten_pro_typ[kand] = f
        paletten_pro_lkw_dict[kand] = info["anzahl_total"]
        total_fahrten += f
        total_paletten += count
        detail.append({"typ": kand, "paletten": count,
                        "pro_lkw": info["anzahl_total"],
                        "fahrten": f, "orientierung": info["orientierung"],
                        "fehler": ""})
    # Untere Schranke (alle Paletten zusammen, beste Pro-LKW-Zahl)
    best_per_lkw = max(paletten_pro_lkw_dict.values()) if paletten_pro_lkw_dict else 0
    lower_bound = int(math.ceil(total_paletten / best_per_lkw)) if best_per_lkw > 0 else 0
    return {
        "fahrten_pro_typ": fahrten_pro_typ,
        "paletten_pro_lkw": paletten_pro_lkw_dict,
        "total_fahrten": total_fahrten,
        "untere_schranke_fahrten": lower_bound,
        "detail": detail,
    }


def leerflaeche(p_l: int, p_b: int,
                 artikel_l: int, artikel_b: int) -> dict[str, float]:
    """Pro Artikel-Zuordnung: Leerflächen-Anteil und absolut."""
    palette_a = max(0, p_l * p_b)
    nutz_a = max(0, artikel_l * artikel_b)
    if palette_a == 0:
        return {"anteil": 0.0, "absolut": 0.0}
    leer = max(0, palette_a - nutz_a)
    return {"anteil": leer / palette_a, "absolut": float(leer)}


# ---------------------------------------------------------------------------
# Logistik-Kosten: 3 Modi → einheitlich kosten_pro_lademeter (Spec §11.1)
# ---------------------------------------------------------------------------
def kosten_pro_lademeter(cp: dict) -> float:
    """Liefert kosten/Lademeter abhängig vom aktiven Modus.

    Modus A: kosten_pro_lkw / lademeter_pro_lkw
    Modus B: direkt
    Modus C: kosten_pro_m2 × lkw_breite (in m)

    Robust: bei lademeter_pro_lkw==0 (Modus A) → 0 (Validierung wirft
    separat eine Fehlermeldung).
    """
    modus = (cp.get("modus_logistik") or "A").upper()
    if modus == "A":
        lm = float(cp.get("lademeter_pro_lkw", 0))
        if lm <= 0:
            return 0.0
        return float(cp.get("kosten_pro_lkw_eur", 0)) / lm
    if modus == "B":
        return float(cp.get("kosten_pro_lademeter_eur", 0))
    if modus == "C":
        breite_m = float(cp.get("lkw_breite_mm", 0)) / 1000.0
        return float(cp.get("kosten_pro_m2_eur", 0)) * breite_m
    return 0.0


def validierung(cp: dict) -> list[dict]:
    """Liefert Liste von dicts mit 'art' ('fehler' | 'warnung' | 'info')
    und 'text'. Spec §16."""
    out: list[dict] = []
    modus = (cp.get("modus_logistik") or "A").upper()
    if modus == "A":
        klkw = float(cp.get("kosten_pro_lkw_eur", 0))
        lm = float(cp.get("lademeter_pro_lkw", 0))
        if lm <= 0:
            out.append({"art": "fehler",
                         "text": "lademeter_pro_lkw muss > 0 sein "
                                 "(Division durch Null)."})
        if klkw <= 0:
            out.append({"art": "warnung",
                         "text": "kosten_pro_lkw = 0 → "
                                 "kosten_pro_lademeter ebenfalls 0 — "
                                 "Modus A bitte ausfüllen."})
    elif modus == "B":
        if float(cp.get("kosten_pro_lademeter_eur", 0)) <= 0:
            out.append({"art": "warnung",
                         "text": "kosten_pro_lademeter = 0 — Modus B "
                                 "bitte ausfüllen."})
    elif modus == "C":
        if float(cp.get("kosten_pro_m2_eur", 0)) <= 0:
            out.append({"art": "warnung",
                         "text": "kosten_pro_m2 = 0 — Modus C bitte "
                                 "ausfüllen."})
        if float(cp.get("lkw_breite_mm", 0)) <= 0:
            out.append({"art": "fehler",
                         "text": "lkw_breite_mm muss > 0 sein "
                                 "(sonst kein Lademeter berechenbar)."})
    return out


# ---------------------------------------------------------------------------
# Δlademeter (Spec §11.2 — zwei Berechnungs-Varianten)
# ---------------------------------------------------------------------------
def delta_lademeter_flaechenbasiert(*,
                                       delta_flaeche_mm2: float,
                                       lkw_breite_mm: int) -> float:
    """Variante 1 (Default): Δlademeter = Δfläche / (lkw_breite × 1000)
    (Δfläche in mm², lkw_breite in mm, Resultat in m)."""
    if lkw_breite_mm <= 0:
        return 0.0
    # Δfläche [mm²] / (lkw_breite [mm] × 1000 [mm/m]) → [m]
    return float(delta_flaeche_mm2) / (lkw_breite_mm * 1000.0)


def delta_lademeter_laengenbasiert(*,
                                       palette_breite_mm: int,
                                       delta_laenge_pro_palette_mm: float,
                                       paletten_pro_periode: int,
                                       lkw_breite_mm: int) -> float:
    """Variante 2 (vereinfacht, nur wenn Δbreite ≈ 0):
    Δlängengesamt = Δlänge × n / paletten_pro_reihe → in m."""
    if palette_breite_mm <= 0 or lkw_breite_mm <= 0:
        return 0.0
    paletten_pro_reihe = max(1, lkw_breite_mm // palette_breite_mm)
    delta_mm = (float(delta_laenge_pro_palette_mm)
                * int(paletten_pro_periode)) / paletten_pro_reihe
    return delta_mm / 1000.0


def auslastung_lkw(*, paletten_count_per_typ: dict[tuple, int],
                     cp: dict) -> dict[str, float]:
    """Spec §16: LKW-Auslastung als Bruch [0..1]. Aggregiert über alle
    Typen, jeweils dedicated-LKW. < 50% → Mischladung empfehlenswert."""
    lkw_l = int(cp.get("lkw_laenge_mm", 13620))
    lkw_b = int(cp.get("lkw_breite_mm", 2450))
    lkw_h = int(cp.get("lkw_hoehe_mm", 2700))
    stapel = int(cp.get("max_palettenstapel", 2))
    max_g = float(cp.get("max_gewicht_kg", 24000))
    if not paletten_count_per_typ:
        return {"auslastung": 0.0, "fahrten_total": 0,
                 "paletten_total": 0}
    fahrten_total = 0
    pal_total = 0
    pal_lkw_max_je_typ = []
    for kand, count in paletten_count_per_typ.items():
        cs, cl = min(kand), max(kand)
        info = paletten_pro_lkw(lkw_l, lkw_b, lkw_h, stapel, max_g,
                                  p_l=cl, p_b=cs)
        pro = info.get("anzahl_total", 0)
        if pro <= 0:
            continue
        fahrten = int(math.ceil(count / pro))
        fahrten_total += fahrten
        pal_total += count
        pal_lkw_max_je_typ.append(pro)
    if fahrten_total == 0 or not pal_lkw_max_je_typ:
        return {"auslastung": 0.0, "fahrten_total": 0,
                 "paletten_total": pal_total}
    # Auslastung = realer Pal-Inhalt / Kapazität bei voller Belegung
    avg_pro = sum(pal_lkw_max_je_typ) / len(pal_lkw_max_je_typ)
    kapazitaet = fahrten_total * avg_pro
    aus = pal_total / kapazitaet if kapazitaet > 0 else 0.0
    return {"auslastung": min(1.0, aus),
             "fahrten_total": fahrten_total,
             "paletten_total": pal_total}


# ---------------------------------------------------------------------------
# Live-Beispielrechnung fuer das UI (Spec §11.3)
# ---------------------------------------------------------------------------
def beispielrechnung(cp: dict, *,
                       delta_laenge_pro_palette_mm: int = 100,
                       paletten_pro_periode: int = 200,
                       palette_breite_mm: int = 1200) -> dict:
    """Erzeugt das Spec-§11.3-Beispiel mit aktuellen User-Werten —
    bleibt in jedem UI-Zustand sichtbar."""
    kpl = kosten_pro_lademeter(cp)
    lkw_b = int(cp.get("lkw_breite_mm", 2450))
    paletten_pro_reihe = max(1, lkw_b // max(1, palette_breite_mm))
    delta_laenge_gesamt_mm = (delta_laenge_pro_palette_mm
                                * paletten_pro_periode) / paletten_pro_reihe
    delta_laenge_m = delta_laenge_gesamt_mm / 1000.0
    transport_mehrkosten = delta_laenge_m * kpl
    periode_tage = int(cp.get("periode_tage", 30))
    jahr_faktor = 365.0 / max(1, periode_tage)
    return {
        "kosten_pro_lademeter": kpl,
        "paletten_pro_reihe": paletten_pro_reihe,
        "delta_laenge_pro_palette_mm": delta_laenge_pro_palette_mm,
        "paletten_pro_periode": paletten_pro_periode,
        "delta_laenge_gesamt_mm": delta_laenge_gesamt_mm,
        "delta_lademeter": delta_laenge_m,
        "transport_mehrkosten_periode": transport_mehrkosten,
        "transport_mehrkosten_jahr": transport_mehrkosten * jahr_faktor,
    }


# ---------------------------------------------------------------------------
# Wirtschaftlichkeits-Vergleich (Spec §11.2)
# ---------------------------------------------------------------------------
def kostenpro_fahrt(cost_params: dict) -> float:
    """Legacy: liefert kosten_pro_fahrt direkt oder distanz·€/km.
    Wird nur fuer Rueckwaerts-Kompatibilitaet im alten vergleich-Pfad
    genutzt — neue Logik nutzt kosten_pro_lademeter()."""
    direkt = float(cost_params.get("kosten_pro_fahrt_eur", 0))
    if direkt > 0:
        return direkt
    return (float(cost_params.get("distanz_km", 0))
            * float(cost_params.get("kosten_pro_km_eur", 0)))


def vergleich(*, zustand_alt: dict, zustand_neu: dict,
              cost_params: dict) -> dict[str, Any]:
    """Vergleicht alten und neuen Zustand und liefert das volle Set
    Kennzahlen (Spec §11.4 Tabelle).

    zustand_alt / zustand_neu enthalten:
      - typen_count: int
      - paletten_count_per_typ: dict[(L,B)] → menge
      - leerflaeche_summe: float (mm²)
      - paletten_summe: int
      - ek_summe_eur: float (Σ menge·EK)
    """
    fahrten_alt = fahrten_benoetigt(zustand_alt["paletten_count_per_typ"],
                                       cost_params)
    fahrten_neu = fahrten_benoetigt(zustand_neu["paletten_count_per_typ"],
                                       cost_params)
    f_alt = fahrten_alt["total_fahrten"]
    f_neu = fahrten_neu["total_fahrten"]

    # Transport-Mehrkosten: NEUE Lademeter-basierte Berechnung
    # (Spec §11.2). Wenn Modus + Lademeter-Kosten gesetzt, dann:
    #   delta_lademeter ≈ Δ(Σpalettenflaeche) / (lkw_breite × 1000)
    # Fallback (Legacy): fahrten-basiert mit kostenpro_fahrt.
    kpl = kosten_pro_lademeter(cost_params)
    lkw_b = int(cost_params.get("lkw_breite_mm", 2450))
    variante = (cost_params.get("berechnung_variante") or "flaeche").lower()
    if kpl > 0 and lkw_b > 0:
        delta_flaeche = (zustand_neu.get("paletten_flaeche_summe", 0)
                          - zustand_alt.get("paletten_flaeche_summe", 0))
        if variante == "laenge":
            # Variante 2: nur sinnvoll wenn Δbreite ≈ 0
            # Approximation: Δlänge/Palette × Σpaletten / paletten_pro_reihe
            # Hier vereinfacht: nimm Lückenanteil-Differenz als pseudo-Δ
            delta_lm = delta_lademeter_flaechenbasiert(
                delta_flaeche_mm2=delta_flaeche,
                lkw_breite_mm=lkw_b,
            )
        else:
            delta_lm = delta_lademeter_flaechenbasiert(
                delta_flaeche_mm2=delta_flaeche,
                lkw_breite_mm=lkw_b,
            )
        transport_mehrkosten = delta_lm * kpl
        # Δlademeter ist hier bereits 'mehr' — alt/neu beziffern wir
        # ueber denselben Lademeter-Anteil pro Zustand:
        transport_alt = 0.0  # Referenz
        transport_neu = transport_mehrkosten
        delta_lademeter_period = delta_lm
    else:
        # Legacy fahrt-basiert
        kf = kostenpro_fahrt(cost_params)
        transport_alt = f_alt * kf
        transport_neu = f_neu * kf
        transport_mehrkosten = transport_neu - transport_alt
        delta_lademeter_period = 0.0

    # Lagerkosten: Stellplatz · Tag · Σ Paletten
    lager_pro_stk_tag = float(cost_params.get(
        "lagerkosten_pro_stellplatz_pro_tag_eur", 0))
    lager_dauer = float(cost_params.get("avg_lagerdauer_tage", 14))
    lager_alt = (zustand_alt["paletten_summe"] * lager_pro_stk_tag
                  * lager_dauer)
    lager_neu = (zustand_neu["paletten_summe"] * lager_pro_stk_tag
                  * lager_dauer)
    lager_mehrkosten = lager_neu - lager_alt

    # Handling-Einsparung: weniger Typen = guenstiger
    handling_pro_typ = float(cost_params.get(
        "handling_kosten_pro_palettentyp_eur", 0))
    handling_alt = zustand_alt["typen_count"] * handling_pro_typ
    handling_neu = zustand_neu["typen_count"] * handling_pro_typ
    handling_einsparung = handling_alt - handling_neu

    # Variantenkosten
    var_pro_typ = float(cost_params.get("variantenkosten_pro_typ_eur", 0))
    var_alt = zustand_alt["typen_count"] * var_pro_typ
    var_neu = zustand_neu["typen_count"] * var_pro_typ
    var_einsparung = var_alt - var_neu

    # Paletten-Beschaffung-Differenz
    palettenkauf_diff = (zustand_neu.get("ek_summe_eur", 0)
                         - zustand_alt.get("ek_summe_eur", 0))

    # Leerflaechen (mm² → m² ungenutzt)
    leer_alt_anteil = (zustand_alt.get("leerflaeche_summe", 0)
                        / max(1, zustand_alt.get("paletten_flaeche_summe", 1)))
    leer_neu_anteil = (zustand_neu.get("leerflaeche_summe", 0)
                        / max(1, zustand_neu.get("paletten_flaeche_summe", 1)))

    netto = (handling_einsparung + var_einsparung
             - palettenkauf_diff
             - transport_mehrkosten - lager_mehrkosten)

    # Hochrechnung Jahr (Spec §11.6)
    periode = max(1, int(cost_params.get("periode_tage", 30)))
    faktor_jahr = 365.0 / periode

    return {
        "transport_alt": transport_alt, "transport_neu": transport_neu,
        "transport_mehrkosten": transport_mehrkosten,
        "delta_lademeter_periode": delta_lademeter_period,
        "kosten_pro_lademeter": kpl,
        "fahrten_alt": f_alt, "fahrten_neu": f_neu,
        "fahrten_alt_detail": fahrten_alt,
        "fahrten_neu_detail": fahrten_neu,
        "lager_alt": lager_alt, "lager_neu": lager_neu,
        "lager_mehrkosten": lager_mehrkosten,
        "handling_alt": handling_alt, "handling_neu": handling_neu,
        "handling_einsparung": handling_einsparung,
        "var_alt": var_alt, "var_neu": var_neu,
        "var_einsparung": var_einsparung,
        "palettenkauf_diff": palettenkauf_diff,
        "leer_alt_anteil": leer_alt_anteil,
        "leer_neu_anteil": leer_neu_anteil,
        "typen_alt": zustand_alt["typen_count"],
        "typen_neu": zustand_neu["typen_count"],
        "paletten_alt": zustand_alt["paletten_summe"],
        "paletten_neu": zustand_neu["paletten_summe"],
        "netto_periode": netto,
        "netto_jahr": netto * faktor_jahr,
        "periode_tage": periode,
        "kosten_pro_fahrt": kostenpro_fahrt(cost_params),
    }


def empfehlungstext(v: dict, sensitivitaet_pct: int = 5) -> str:
    """Spec §11.4: Auto-Empfehlungstext basierend auf Netto-Effekt."""
    netto = v.get("netto_periode", 0)
    if netto > 0:
        return (f"✅ Standardisierung lohnt sich: Netto-Einsparung "
                f"{netto:,.0f} € pro Periode "
                f"({v.get('netto_jahr', 0):,.0f} €/Jahr).").replace(",", ".")
    elif netto < 0:
        return (f"⚠️ Logistik-Mehrkosten übersteigen Einsparung um "
                f"{-netto:,.0f} € pro Periode — "
                f"Toleranz erweitern oder Variantenkosten prüfen."
                ).replace(",", ".")
    else:
        return "💡 Wirtschaftlich neutral — Toleranz oder Gewichte anpassen."


def break_even_kosten_pro_lademeter(zustand_alt: dict, zustand_neu: dict,
                                       cost_params: dict) -> float | None:
    """Spec §11.6: ab welcher kosten_pro_lademeter kippt Netto auf 0?
    None wenn Δlademeter == 0 (Lademeter-Kosten haben keinen Einfluss)."""
    cp_zero = dict(cost_params)
    # Allen Modi 0 setzen → kpl = 0 → transport_mehrkosten = 0
    cp_zero["kosten_pro_lkw_eur"] = 0.0
    cp_zero["kosten_pro_lademeter_eur"] = 0.0
    cp_zero["kosten_pro_m2_eur"] = 0.0
    v0 = vergleich(zustand_alt=zustand_alt, zustand_neu=zustand_neu,
                    cost_params=cp_zero)
    lkw_b = int(cost_params.get("lkw_breite_mm", 2450))
    delta_flaeche = (zustand_neu.get("paletten_flaeche_summe", 0)
                      - zustand_alt.get("paletten_flaeche_summe", 0))
    delta_lm = delta_lademeter_flaechenbasiert(
        delta_flaeche_mm2=delta_flaeche, lkw_breite_mm=lkw_b)
    if abs(delta_lm) < 1e-9:
        return None
    konstant = (v0["handling_einsparung"] + v0["var_einsparung"]
                 - v0["palettenkauf_diff"] - v0["lager_mehrkosten"])
    return konstant / delta_lm


def break_even_kosten_pro_fahrt(zustand_alt: dict, zustand_neu: dict,
                                  cost_params: dict) -> float | None:
    """Spec §11.5: ab welcher Kosten/Fahrt kippt das Netto auf 0?

    Loesung von: handling + var − palettenkauf − (f_neu − f_alt)·kf
                 − lager_mehr = 0
    → kf_break_even = (handling + var − palettenkauf − lager_mehr)
                       / (f_neu − f_alt)
    None wenn f_neu == f_alt (kf hat keinen Einfluss)."""
    cp_zero = dict(cost_params)
    cp_zero["kosten_pro_fahrt_eur"] = 0.0
    cp_zero["distanz_km"] = 0.0
    cp_zero["kosten_pro_km_eur"] = 0.0
    v0 = vergleich(zustand_alt=zustand_alt, zustand_neu=zustand_neu,
                    cost_params=cp_zero)
    df = v0["fahrten_neu"] - v0["fahrten_alt"]
    if df == 0:
        return None  # Kosten pro Fahrt sind irrelevant
    konstant = (v0["handling_einsparung"] + v0["var_einsparung"]
                 - v0["palettenkauf_diff"] - v0["lager_mehrkosten"])
    return konstant / df


def baue_zustand(*, paletten_count_per_typ: dict[tuple, int],
                  zuordnungen: list[dict],
                  ek_lookup: dict[tuple, float]) -> dict[str, Any]:
    """Hilfsfunktion: baut den 'zustand'-Dict aus einer Liste von
    Zuordnungen (typ, ziel, L, B, menge) plus EK-Lookup."""
    typen = set(paletten_count_per_typ.keys())
    leer_summe = 0.0
    pal_flaeche_summe = 0.0
    ek_summe = 0.0
    for z in zuordnungen:
        try:
            menge = int(z.get("menge", 0))
            artikel_l = int(z.get("L", 0))
            artikel_b = int(z.get("B", 0))
            ziel = z.get("ziel", "")
            if "x" not in ziel or z.get("typ") not in (
                    "Standard", "Kombi-Stapel", "Kombi-Heterogen", "Sonder"):
                continue
            # Nur Standard → exakte palette
            if z.get("typ") != "Standard":
                continue
            a, b = ziel.split("x")
            p_l = max(int(a), int(b))
            p_b = min(int(a), int(b))
            leer = leerflaeche(p_l, p_b, max(artikel_l, artikel_b),
                                 min(artikel_l, artikel_b))
            leer_summe += leer["absolut"] * menge
            pal_flaeche_summe += (p_l * p_b) * menge
            kand = (min(p_l, p_b), max(p_l, p_b))
            ek_summe += ek_lookup.get(kand, 0.0) * menge
        except (ValueError, KeyError):
            continue
    return {
        "typen_count": len(typen),
        "paletten_count_per_typ": dict(paletten_count_per_typ),
        "paletten_summe": sum(paletten_count_per_typ.values()),
        "leerflaeche_summe": leer_summe,
        "paletten_flaeche_summe": pal_flaeche_summe,
        "ek_summe_eur": ek_summe,
    }
