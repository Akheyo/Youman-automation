"""Doppelbestellungs-Vermeidung (Spec §8).

Beim Excel-Import: pro Bedarfszeile pruefe gegen aktive
Historie-Eintraege. Matching:

  primaer: (auftragsnummer_aw, artikelnummer)  — exakter Treffer
  fallback: (kunde, artikelnummer) + Bestelldatum
            innerhalb ± `zeitfenster_tage` (Default 30)

Status:
  'storniert'   → zaehlt NICHT als bestellt
  'offen'       → zaehlt als bestellt
  'verbraucht'  → zaehlt als bestellt (= bereits erfuellt)

Ergebnis pro Bedarfszeile (= Excel-Zeile):
  bucket = 'neu' | 'schon_bestellt' | 'teilbedarf'

Eine Bedarfszeile gilt als 'schon_bestellt', wenn EXAKTE Menge schon
in Historie steht (gleiche AW+Artikel UND aktive Historien-Menge ≥ neue Menge).
Sie ist 'teilbedarf', wenn alte Menge < neue Menge — dann ist
``delta_menge`` = neu - alt > 0.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any


def _parse_datum(s) -> date | None:
    """Versucht ISO 'YYYY-MM-DD' zu parsen."""
    if not s:
        return None
    if isinstance(s, date):
        return s
    try:
        return datetime.fromisoformat(str(s)[:10]).date()
    except ValueError:
        return None


def _zeitfenster_match(b_datum: str, ref_datum: date | None,
                       tage: int) -> bool:
    """Prueft, ob Bestelldatum im +/- Fenster um ref_datum liegt."""
    if ref_datum is None:
        return False
    d = _parse_datum(b_datum)
    if d is None:
        return False
    return abs((d - ref_datum).days) <= tage


def pruefe_zeile(zeile: dict, aktive_bestellungen: list[dict],
                 zeitfenster_tage: int = 30) -> dict:
    """Eine Bedarfszeile gegen Historie pruefen.

    Returns dict mit:
      bucket: 'neu' | 'schon_bestellt' | 'teilbedarf'
      delta_menge: int  (nur sinnvoll bei 'teilbedarf')
      gemachte_menge: int  (Σ Menge in Historie, die matched)
      historien_ids: list[str]  (matchende Historien-Eintraege)
      match_typ: 'aw_artikel' | 'kunde_artikel_zeitfenster' | None
    """
    aw = (zeile.get("auftrag") or "").strip()
    artnr = (zeile.get("artikelnummer") or "").strip()
    kunde = (zeile.get("name") or "").strip()
    menge_neu = int(zeile.get("anzahl", 0))
    vbd_neu = _parse_datum(zeile.get("verbrauchsdatum", ""))

    treffer: list[dict] = []
    match_typ: str | None = None

    # Primaer: exakter AW + Artikelnummer
    if aw and artnr:
        for b in aktive_bestellungen:
            if (b.get("auftragsnummer_aw", "").strip() == aw
                    and b.get("artikelnummer", "").strip() == artnr):
                treffer.append(b)
        if treffer:
            match_typ = "aw_artikel"

    # Fallback: Kunde + Artikel + Zeitfenster (nur wenn keine AW-Treffer)
    if not treffer and artnr and kunde:
        for b in aktive_bestellungen:
            if (b.get("artikelnummer", "").strip() == artnr
                    and b.get("kunde", "").strip() == kunde):
                # Pruefe Zeitfenster: Bestelldatum oder
                # geplantes_verbrauchsdatum nahe am neuen Bedarf
                ref = vbd_neu or date.today()
                if _zeitfenster_match(b.get("bestelldatum", ""), ref,
                                       zeitfenster_tage):
                    treffer.append(b)
                elif _zeitfenster_match(
                        b.get("geplantes_verbrauchsdatum", ""), ref,
                        zeitfenster_tage):
                    treffer.append(b)
        if treffer:
            match_typ = "kunde_artikel_zeitfenster"

    gemacht = sum(int(b.get("menge", 0)) for b in treffer)
    historien_ids = [b.get("id", "") for b in treffer]

    if not treffer:
        bucket = "neu"
        delta = menge_neu
    elif gemacht >= menge_neu:
        bucket = "schon_bestellt"
        delta = 0
    else:
        bucket = "teilbedarf"
        delta = menge_neu - gemacht

    return {
        "bucket": bucket,
        "delta_menge": delta,
        "gemachte_menge": gemacht,
        "historien_ids": historien_ids,
        "match_typ": match_typ,
    }


def pruefe_import(zeilen: list[dict],
                  aktive_bestellungen: list[dict],
                  zeitfenster_tage: int = 30) -> dict:
    """Komplette Import-Pruefung.

    Returns:
      {
        'gesamt': int,
        'neu': list[(zeile, info)],
        'schon_bestellt': list[(zeile, info)],
        'teilbedarf': list[(zeile, info)],
        'fuer_optimierung': list[zeile]  (= neu + teilbedarf mit delta-Menge),
      }
    """
    neu, schon, teil = [], [], []
    fuer_opt = []
    for z in zeilen:
        info = pruefe_zeile(z, aktive_bestellungen, zeitfenster_tage)
        bucket = info["bucket"]
        if bucket == "neu":
            neu.append((z, info))
            fuer_opt.append(z)
        elif bucket == "schon_bestellt":
            schon.append((z, info))
        else:
            teil.append((z, info))
            # Teilbedarf: in Optimierung nur die Delta-Menge nehmen
            z_neu = dict(z)
            z_neu["anzahl"] = info["delta_menge"]
            z_neu["_doppelschutz_delta"] = True
            fuer_opt.append(z_neu)
    return {
        "gesamt": len(zeilen),
        "neu": neu,
        "schon_bestellt": schon,
        "teilbedarf": teil,
        "fuer_optimierung": fuer_opt,
    }
