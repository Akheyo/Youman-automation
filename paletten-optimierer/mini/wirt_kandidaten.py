"""Wirtschaftliches Optimierungs-Modul (Spec §11.9 — Modus 2/3).

Liefert die Kandidaten-Tabelle, netto-pro-jahr-Berechnung pro Kandidat,
Anti-Aggregations-Schutz und Empfehlungs-Report.

Hauptfunktionen:
  cluster_bilden(orders, tol_k, tol_l)            → list[Cluster]
  kandidat_aus_cluster(cluster, aufschlag_mm)     → (cs, cl)
  netto_pro_kandidat(cluster, kand, cp, ...)      → dict mit netto, breakdown
  kandidaten_tabelle(orders, cp, ...)             → list[dict]
  anti_aggregation(kandidat_info, min_auslastung) → bool (True=übernehmen)
  modus2_auswahl(orders, cp, ...)                  → (uebernommen, verworfen,
                                                       sonder, begruendungen)
  empfehlungs_report(modus2_result, cp)           → str (Markdown)
  begruendungs_text(zuordnung, modus2_result)     → str

Spec-Mapping:
  §11.9.3 Algorithmus      → modus2_auswahl()
  §11.9.4 Anti-Aggregation → anti_aggregation()
  §11.9.5 Kandidaten-Tab    → kandidaten_tabelle()
  §11.9.6 Begründung        → begruendungs_text()
  §11.9.7 Empfehlungs-Rep.  → empfehlungs_report()
"""
from __future__ import annotations

from typing import Any

# Import-Aufschub, damit Modul ohne wirtschaftlichkeit.py importierbar bleibt
import wirtschaftlichkeit as wirt


# ---------------------------------------------------------------------------
# Cluster-Bildung (Spec §11.9.3 Schritt 1)
# ---------------------------------------------------------------------------
def _kanon(L: int, B: int) -> tuple[int, int]:
    return (min(L, B), max(L, B))


def cluster_bilden(orders: list[dict], *,
                    tol_kurz_mm: int = 100,
                    tol_lang_mm: int = 100) -> list[list[dict]]:
    """Greedy Clustering: Auftraege werden nach Maß sortiert und in
    Cluster gesammelt, deren maximaler Streubreite ≤ tol auf jeder Achse
    bleibt.

    orders: List of {L, B, menge, auftrag, name, artikelnummer, ...}
    """
    if not orders:
        return []
    # Sortiere nach kurz, lang
    sortiert = sorted(orders, key=lambda o: _kanon(int(o.get("L", o.get("laenge", 0))),
                                                       int(o.get("B", o.get("breite", 0)))))
    cluster: list[list[dict]] = []
    for o in sortiert:
        cs, cl = _kanon(int(o.get("L", o.get("laenge", 0))),
                          int(o.get("B", o.get("breite", 0))))
        # Suche Cluster in den Aufträge mit max(cs)−min(cs)≤tol_kurz
        # und max(cl)−min(cl)≤tol_lang nach Einfügen passen würden
        einfuegt = False
        for c in cluster:
            cs_min = min(_kanon(int(x.get("L", x.get("laenge", 0))),
                                  int(x.get("B", x.get("breite", 0))))[0]
                          for x in c)
            cs_max = max(_kanon(int(x.get("L", x.get("laenge", 0))),
                                  int(x.get("B", x.get("breite", 0))))[0]
                          for x in c)
            cl_min = min(_kanon(int(x.get("L", x.get("laenge", 0))),
                                  int(x.get("B", x.get("breite", 0))))[1]
                          for x in c)
            cl_max = max(_kanon(int(x.get("L", x.get("laenge", 0))),
                                  int(x.get("B", x.get("breite", 0))))[1]
                          for x in c)
            neu_cs_min, neu_cs_max = min(cs_min, cs), max(cs_max, cs)
            neu_cl_min, neu_cl_max = min(cl_min, cl), max(cl_max, cl)
            if ((neu_cs_max - neu_cs_min) <= tol_kurz_mm
                    and (neu_cl_max - neu_cl_min) <= tol_lang_mm):
                c.append(o)
                einfuegt = True
                break
        if not einfuegt:
            cluster.append([o])
    return cluster


def kandidat_aus_cluster(cluster: list[dict],
                          aufschlag_mm: int = 0) -> tuple[int, int]:
    """Spec §11.9.3 Schritt 2: max(L) + Aufschlag, max(B) + Aufschlag.
    Liefert (cs, cl) kanonisch."""
    if not cluster:
        return (0, 0)
    auf = max(0, int(aufschlag_mm))
    cs_max = max(_kanon(int(o.get("L", o.get("laenge", 0))),
                          int(o.get("B", o.get("breite", 0))))[0]
                  for o in cluster)
    cl_max = max(_kanon(int(o.get("L", o.get("laenge", 0))),
                          int(o.get("B", o.get("breite", 0))))[1]
                  for o in cluster)
    return (cs_max + auf, cl_max + auf)


# ---------------------------------------------------------------------------
# Netto-pro-Jahr-Berechnung pro Kandidat (Spec §11.9.3 Schritt 3)
# ---------------------------------------------------------------------------
def netto_pro_kandidat(cluster: list[dict],
                         kandidat: tuple[int, int],
                         cp: dict,
                         ek_pro_kandidat: float = 0.0,
                         ek_pro_artikel_avg: float = 0.0) -> dict:
    """Berechnet das Netto pro Periode + Jahr fuer EINEN Kandidat.

    Vergleicht: Status Quo (jeder Artikel = eigener Typ) vs.
    Standardisiert (alle Artikel nutzen den Kandidat).

    Liefert dict:
      netto_periode, netto_jahr,
      paletten_einsparung, transport_mehrkosten, handling_einsparung,
      varianten_einsparung, lager_mehrkosten,
      auslastung (0..1), n_artikel, paletten_total,
      kandidat (cs, cl).
    """
    n_artikel = len(cluster)
    if n_artikel == 0:
        return {"netto_periode": 0.0, "netto_jahr": 0.0,
                 "kandidat": kandidat, "n_artikel": 0,
                 "paletten_total": 0, "auslastung": 0.0,
                 "transport_mehrkosten": 0.0, "lager_mehrkosten": 0.0,
                 "handling_einsparung": 0.0, "varianten_einsparung": 0.0,
                 "paletten_einsparung": 0.0}
    kand_cs, kand_cl = min(kandidat), max(kandidat)
    kand_flaeche = kand_cs * kand_cl

    # Aggregate aus Cluster
    paletten_total = sum(int(o.get("menge", o.get("anzahl", 0)))
                          for o in cluster)
    summe_nutz_x_menge = 0.0
    summe_delta_flaeche_x_menge = 0.0
    for o in cluster:
        L = int(o.get("L", o.get("laenge", 0)))
        B = int(o.get("B", o.get("breite", 0)))
        menge = int(o.get("menge", o.get("anzahl", 0)))
        artikel_flaeche = L * B
        summe_nutz_x_menge += artikel_flaeche * menge
        # Δ Flaeche: Kandidat-Flaeche - Artikel-Flaeche, mal Menge
        summe_delta_flaeche_x_menge += (kand_flaeche - artikel_flaeche) * menge

    # Auslastung (Spec §11.9.4): avg nutzfläche / palettenfläche
    auslastung = ((summe_nutz_x_menge / paletten_total) / kand_flaeche
                   if paletten_total > 0 and kand_flaeche > 0 else 0.0)

    # Transport-Mehrkosten: Δlademeter × kpl
    kpl = wirt.kosten_pro_lademeter(cp)
    lkw_b = int(cp.get("lkw_breite_mm", 2450))
    delta_lademeter = wirt.delta_lademeter_flaechenbasiert(
        delta_flaeche_mm2=summe_delta_flaeche_x_menge,
        lkw_breite_mm=lkw_b,
    )
    transport_mehrkosten = delta_lademeter * kpl

    # Lager-Mehrkosten: Δfläche × lager × dauer (vereinfacht)
    lager_pro_stk_tag = float(cp.get(
        "lagerkosten_pro_stellplatz_pro_tag_eur", 0))
    lager_dauer = float(cp.get("avg_lagerdauer_tage", 14))
    # Pro Stk-Mehrflaeche multiplizieren wir mit Stk-Tage
    # (vereinfacht: pauschal pro Palette × dauer)
    lager_mehrkosten = (max(0, summe_delta_flaeche_x_menge)
                          / (kand_flaeche if kand_flaeche > 0 else 1)
                          * lager_pro_stk_tag * lager_dauer)

    # Handling- + Varianten-Einsparung: pro vermiedener Variante
    handling_pro_typ = float(cp.get("handling_kosten_pro_palettentyp_eur", 0))
    var_pro_typ = float(cp.get("variantenkosten_pro_typ_eur", 0))
    # Jeder Artikel-Variante wäre ein eigener Typ ohne Standardisierung;
    # mit Standardisierung nur 1 Typ. Einsparung = (n_artikel - 1) × Kosten.
    n_unique_alt = len({_kanon(int(o.get("L", o.get("laenge", 0))),
                                  int(o.get("B", o.get("breite", 0))))
                          for o in cluster})
    handling_einsparung = max(0, n_unique_alt - 1) * handling_pro_typ
    varianten_einsparung = max(0, n_unique_alt - 1) * var_pro_typ

    # Paletten-Einsparung (Spec §11.9.5): EK-Differenz × Σ menge.
    # Wenn keine EKs gesetzt: fall back auf Σ Varianten × pauschal.
    if ek_pro_artikel_avg > 0 and ek_pro_kandidat > 0:
        paletten_einsparung = ((ek_pro_artikel_avg - ek_pro_kandidat)
                                * paletten_total)
    else:
        paletten_einsparung = 0.0

    # Netto pro Periode
    netto_periode = (handling_einsparung + varianten_einsparung
                       + paletten_einsparung
                       - transport_mehrkosten - lager_mehrkosten)
    periode_tage = max(1, int(cp.get("periode_tage", 30)))
    netto_jahr = netto_periode * 365.0 / periode_tage

    return {
        "kandidat": (kand_cs, kand_cl),
        "n_artikel": n_artikel,
        "paletten_total": paletten_total,
        "auslastung": min(1.0, max(0.0, auslastung)),
        "transport_mehrkosten": transport_mehrkosten,
        "lager_mehrkosten": lager_mehrkosten,
        "handling_einsparung": handling_einsparung,
        "varianten_einsparung": varianten_einsparung,
        "paletten_einsparung": paletten_einsparung,
        "delta_lademeter_periode": delta_lademeter,
        "netto_periode": netto_periode,
        "netto_jahr": netto_jahr,
        "cluster_auftraege": [o.get("auftrag", "") for o in cluster],
    }


# ---------------------------------------------------------------------------
# Anti-Aggregations-Schutz (Spec §11.9.4)
# ---------------------------------------------------------------------------
def anti_aggregation(kand_info: dict, *,
                       min_auslastung_pct: float = 65.0) -> dict:
    """Prueft, ob ein Kandidat trotz positivem Netto verworfen werden
    sollte: wenn Auslastung < min_auslastung UND Mehrkosten > Einsparung.

    Liefert dict mit ueberschriften 'uebernehmen' (bool) und 'grund' (str).
    """
    auslastung = kand_info.get("auslastung", 0.0)
    pct_grenze = max(0, float(min_auslastung_pct)) / 100.0
    mehrkosten = (kand_info.get("transport_mehrkosten", 0.0)
                   + kand_info.get("lager_mehrkosten", 0.0))
    einsparung = (kand_info.get("handling_einsparung", 0.0)
                   + kand_info.get("varianten_einsparung", 0.0)
                   + kand_info.get("paletten_einsparung", 0.0))
    # Anti-Aggregation: auslastung < pct_grenze UND mehrkosten > einsparung
    if pct_grenze > 0 and auslastung < pct_grenze and mehrkosten > einsparung:
        return {
            "uebernehmen": False,
            "grund": (f"Anti-Aggregation: Auslastung {auslastung*100:.0f}% "
                       f"< Schwelle {min_auslastung_pct:.0f}% "
                       f"und Mehrkosten ({mehrkosten:.0f} €) > "
                       f"Einsparung ({einsparung:.0f} €)."),
        }
    return {"uebernehmen": True, "grund": ""}


# ---------------------------------------------------------------------------
# Kandidaten-Tabelle (Spec §11.9.5)
# ---------------------------------------------------------------------------
def kandidaten_tabelle(orders: list[dict], cp: dict, *,
                        tol_kurz_mm: int = 100,
                        tol_lang_mm: int = 100,
                        aufschlag_mm: int = 0,
                        schwellwert_eur: float = 0.0,
                        min_auslastung_pct: float = 65.0,
                        ek_lookup: dict[tuple[int, int], float] | None = None,
                        ek_kandidat_avg: float = 0.0) -> list[dict]:
    """Baut die Kandidaten-Tabelle (Spec §11.9.5):

    Pro Kandidat: kandidat, n_artikel, netto/jahr, Einsparungs- und
    Mehrkosten-Teile, Auslastung, Empfehlung ('standardisieren' |
    'als sonder belassen' | 'anti-aggregation'). Sortiert absteigend
    nach netto_jahr.
    """
    cluster = cluster_bilden(orders, tol_kurz_mm=tol_kurz_mm,
                                tol_lang_mm=tol_lang_mm)
    ek_lookup = ek_lookup or {}
    zeilen = []
    for c in cluster:
        kand = kandidat_aus_cluster(c, aufschlag_mm=aufschlag_mm)
        # EK aus Lookup (durchschnittliches EK der Cluster-Artikel)
        ek_artikel_sum, ek_artikel_n = 0.0, 0
        for o in c:
            L = int(o.get("L", o.get("laenge", 0)))
            B = int(o.get("B", o.get("breite", 0)))
            ek = ek_lookup.get(_kanon(L, B), 0.0)
            if ek > 0:
                ek_artikel_sum += ek
                ek_artikel_n += 1
        ek_avg = ek_artikel_sum / ek_artikel_n if ek_artikel_n > 0 else 0.0
        info = netto_pro_kandidat(c, kand, cp,
                                     ek_pro_kandidat=ek_kandidat_avg,
                                     ek_pro_artikel_avg=ek_avg)
        anti = anti_aggregation(info,
                                  min_auslastung_pct=min_auslastung_pct)
        # Spec §11.9.3 Schritt 5: Übernehmen wenn netto > schwellwert
        # UND Anti-Aggregation = übernehmen.
        if not anti["uebernehmen"]:
            empfehlung = "anti-aggregation"
            grund = anti["grund"]
        elif info["netto_jahr"] >= float(schwellwert_eur):
            empfehlung = "standardisieren"
            grund = (f"Netto {info['netto_jahr']:.0f} €/Jahr ≥ Schwelle "
                      f"{schwellwert_eur:.0f}").replace(",", ".")
        else:
            empfehlung = "als sonder belassen"
            grund = (f"Netto {info['netto_jahr']:.0f} €/Jahr < Schwelle "
                      f"{schwellwert_eur:.0f}").replace(",", ".")
        zeilen.append({
            **info,
            "empfehlung": empfehlung,
            "grund": grund,
            "ueberschritten_manuell": None,
        })
    zeilen.sort(key=lambda r: r["netto_jahr"], reverse=True)
    return zeilen


# ---------------------------------------------------------------------------
# Modus-2-Auswahl (Spec §11.9.3)
# ---------------------------------------------------------------------------
def modus2_auswahl(orders: list[dict], cp: dict, *,
                     tol_kurz_mm: int = 100,
                     tol_lang_mm: int = 100,
                     aufschlag_mm: int = 0,
                     schwellwert_eur: float = 0.0,
                     min_auslastung_pct: float = 65.0,
                     ek_lookup: dict | None = None,
                     manuelle_override: dict[tuple, str] | None = None
                     ) -> dict:
    """Komplette Modus-2-Logik:
      1. Cluster + Kandidaten
      2. Sortieren nach netto
      3. Übernehmen wenn netto > schwellwert UND anti-aggregation OK
      4. Manuelle Override (per Kandidat: 'standardisieren'/'verwerfen')

    Returns dict:
      uebernommen: list[kand_info]   (= neue Standards)
      verworfen:   list[kand_info]   (= Cluster bleibt Sonder)
      sonder:      list[(cs,cl)]     (Maße als Sonder)
      orders_zu_standard: dict[order_idx] → kand (cs,cl)  oder None=Sonder
    """
    zeilen = kandidaten_tabelle(orders, cp,
                                   tol_kurz_mm=tol_kurz_mm,
                                   tol_lang_mm=tol_lang_mm,
                                   aufschlag_mm=aufschlag_mm,
                                   schwellwert_eur=schwellwert_eur,
                                   min_auslastung_pct=min_auslastung_pct,
                                   ek_lookup=ek_lookup)
    manuelle_override = manuelle_override or {}
    uebernommen, verworfen = [], []
    for z in zeilen:
        kand = z["kandidat"]
        manuell = manuelle_override.get(kand)
        if manuell == "standardisieren":
            uebernommen.append(z)
        elif manuell == "verwerfen":
            verworfen.append(z)
        elif z["empfehlung"] == "standardisieren":
            uebernommen.append(z)
        else:
            verworfen.append(z)

    # Build assignment
    orders_zu_standard: dict[int, tuple[int, int] | None] = {}
    # Re-cluster, um den Cluster-Index aufrecht zu erhalten — wir
    # iterieren parallel zur Reihenfolge der Aufträge in den Clustern.
    cluster = cluster_bilden(orders, tol_kurz_mm=tol_kurz_mm,
                                tol_lang_mm=tol_lang_mm)
    # Map: Auftragsnummer/Index → Cluster-Index
    for idx, o in enumerate(orders):
        gefunden = False
        for c_idx, c in enumerate(cluster):
            if o in c:
                kand_cluster = kandidat_aus_cluster(c,
                                                       aufschlag_mm=aufschlag_mm)
                kand_norm = (min(kand_cluster), max(kand_cluster))
                # Ist dieser Cluster uebernommen?
                if any(u["kandidat"] == kand_norm for u in uebernommen):
                    orders_zu_standard[idx] = kand_norm
                else:
                    orders_zu_standard[idx] = None  # = Sonder
                gefunden = True
                break
        if not gefunden:
            orders_zu_standard[idx] = None

    sonder_masse = []
    for c_idx, c in enumerate(cluster):
        kand_c = kandidat_aus_cluster(c, aufschlag_mm=aufschlag_mm)
        kand_norm = (min(kand_c), max(kand_c))
        if not any(u["kandidat"] == kand_norm for u in uebernommen):
            # Cluster bleibt — pro Auftrag eine Sondergroesse
            for o in c:
                L = int(o.get("L", o.get("laenge", 0)))
                B = int(o.get("B", o.get("breite", 0)))
                sonder_masse.append(_kanon(L, B))

    return {
        "uebernommen": uebernommen,
        "verworfen": verworfen,
        "sonder": sonder_masse,
        "orders_zu_standard": orders_zu_standard,
        "cluster": cluster,
        "parameter": {
            "modus": 2,
            "schwellwert_eur": schwellwert_eur,
            "min_auslastung_pct": min_auslastung_pct,
            "tol_kurz_mm": tol_kurz_mm,
            "tol_lang_mm": tol_lang_mm,
            "aufschlag_mm": aufschlag_mm,
        },
    }


# ---------------------------------------------------------------------------
# Begründungs-Text pro Zuordnung (Spec §11.9.6)
# ---------------------------------------------------------------------------
def begruendungs_text(auftrag_idx: int, modus2_result: dict) -> str:
    """Liefert einen kurzen erklärenden Text für eine Zuordnung."""
    kand = modus2_result.get("orders_zu_standard", {}).get(auftrag_idx)
    if kand is None:
        # Suche zugehörigen verworfenen Kandidaten
        for v in modus2_result.get("verworfen", []):
            if v.get("empfehlung") == "anti-aggregation":
                return v.get("grund", "Eigener Typ wegen niedriger Auslastung.")
        return ("Sondergröße belassen: Standardisierung würde Mehrkosten "
                "erzeugen.")
    # Standardisiert — Begründungstext aus uebernommen suchen
    for u in modus2_result.get("uebernommen", []):
        if u["kandidat"] == kand:
            n_jahr = u.get("netto_jahr", 0)
            periode_jahr_faktor = 12.0  # default Monat
            n_periode = u.get("netto_periode", 0)
            return (f"Standardisiert: +{n_periode:.0f} €/Periode netto "
                     f"(≈ {n_jahr:.0f} €/Jahr)")
    return "Standardisiert."


# ---------------------------------------------------------------------------
# Empfehlungs-Report (Spec §11.9.7)
# ---------------------------------------------------------------------------
def empfehlungs_report(modus2_result: dict, cp: dict,
                         vorher_typen: int | None = None) -> str:
    """Markdown-Text fuer den auto-generierten Empfehlungs-Report."""
    u = modus2_result.get("uebernommen", [])
    v = modus2_result.get("verworfen", [])
    sonder_masse = modus2_result.get("sonder", [])
    sonder_unique = set(sonder_masse)
    netto_summe = sum(x["netto_jahr"] for x in u)
    zeilen = []
    zeilen.append(
        f"### Wirtschaftliches Optimum: **{len(u)} Standardgrößen + "
        f"{len(sonder_unique)} Sondergrößen**" +
        (f" (statt aktuell {vorher_typen} Varianten)"
          if vorher_typen else "")
    )
    zeilen.append("")
    if u:
        zeilen.append(f"✅ **Übernommene Standardgrößen ({len(u)}):**")
        for x in u[:15]:
            cs, cl = x["kandidat"]
            zeilen.append(
                f"- {cl}×{cs} mm — {x['n_artikel']} Artikel, "
                f"Netto **+{x['netto_jahr']:.0f} €/Jahr**, "
                f"Auslastung {x['auslastung']*100:.0f}%"
            )
        if len(u) > 15:
            zeilen.append(f"  … und {len(u) - 15} weitere.")
        zeilen.append("")
    if v:
        zeilen.append(f"❌ **Verworfene Kandidaten ({len(v)}) — "
                       f"Mehrkosten > Einsparung oder Anti-Aggregation:**")
        for x in v[:15]:
            cs, cl = x["kandidat"]
            zeilen.append(
                f"- {cl}×{cs} mm — {x['n_artikel']} Artikel, "
                f"Netto **{x['netto_jahr']:.0f} €/Jahr**. {x.get('grund', '')}"
            )
        if len(v) > 15:
            zeilen.append(f"  … und {len(v) - 15} weitere.")
        zeilen.append("")
    if sonder_unique:
        zeilen.append(
            f"💡 **{len(sonder_unique)} Sondergrößen bleiben wirtschaftlicher "
            f"als jeder Standard:**"
        )
        for cs, cl in list(sonder_unique)[:10]:
            zeilen.append(f"- {cl}×{cs} mm")
        if len(sonder_unique) > 10:
            zeilen.append(f"  … und {len(sonder_unique) - 10} weitere.")
        zeilen.append("")
    zeilen.append(f"📊 **Gesamteinsparung: {netto_summe:,.0f} €/Jahr**"
                    .replace(",", "."))
    # Break-Even: hypothetisch wenn Investition = 0 → sofort
    # (Aussage wirkt nur sinnvoll bei einer Investitionssumme)
    return "\n".join(zeilen)
