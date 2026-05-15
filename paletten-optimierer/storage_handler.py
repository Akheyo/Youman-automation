"""Bestand, Bestellungen, AW-Tracking — jetzt persistent in SQLite.

API bleibt rückwärtskompatibel: existierender Code, der diese Funktionen
ruft, muss nicht angepasst werden.
"""
from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from typing import Literal

import db


BestellStatus = Literal["offen", "verbucht", "storniert"]
BestandsStatus = Literal["ok", "unter", "kritisch"]


@dataclass
class Bestellung:
    bestell_id: str
    datum: str
    palettentyp: str
    menge: int
    geplantes_verbrauchsdatum: str
    auftragsnummer: str = ""
    kunde: str = ""
    artikelnummern: list[str] = field(default_factory=list)
    status: BestellStatus = "offen"

    @classmethod
    def neu(
        cls,
        palettentyp: str,
        menge: int,
        geplantes_verbrauchsdatum: str | date,
        auftragsnummer: str = "",
        kunde: str = "",
        artikelnummern: list[str] | None = None,
    ) -> "Bestellung":
        if isinstance(geplantes_verbrauchsdatum, date):
            geplantes_verbrauchsdatum = geplantes_verbrauchsdatum.isoformat()
        return cls(
            bestell_id=str(uuid.uuid4()),
            datum=datetime.now().isoformat(timespec="seconds"),
            palettentyp=palettentyp,
            menge=int(menge),
            geplantes_verbrauchsdatum=geplantes_verbrauchsdatum,
            auftragsnummer=auftragsnummer,
            kunde=kunde,
            artikelnummern=list(artikelnummern or []),
        )


# ---------------------------------------------------------------------------
# Bestand
# ---------------------------------------------------------------------------

def lade_bestand() -> dict[str, dict]:
    return db.lade_bestand_db()


def speichere_bestand(bestand: dict[str, dict]) -> None:
    """Komplettes Überschreiben — eher selten gebraucht."""
    for typ, daten in bestand.items():
        db.setze_bestand_db(
            typ,
            menge=daten.get("menge"),
            sicherheitsbestand=daten.get("sicherheitsbestand"),
        )


def aktualisiere_bestand(
    palettentyp: str,
    menge: int | None = None,
    sicherheitsbestand: int | None = None,
) -> dict[str, dict]:
    db.setze_bestand_db(palettentyp, menge=menge, sicherheitsbestand=sicherheitsbestand)
    return lade_bestand()


def setze_sicherheitsbestand_global(sicherheitsbestand: int) -> dict[str, dict]:
    db.setze_sicherheitsbestand_global_db(int(sicherheitsbestand))
    return lade_bestand()


def bewerte_status(menge: int, sicherheitsbestand: int) -> BestandsStatus:
    if menge >= sicherheitsbestand:
        return "ok"
    if menge >= 0.5 * sicherheitsbestand:
        return "unter"
    return "kritisch"


# ---------------------------------------------------------------------------
# Bestellungen
# ---------------------------------------------------------------------------

def lade_bestellungen() -> list[Bestellung]:
    rows = db.lade_bestellungen_db()
    return [Bestellung(**r) for r in rows]


def speichere_bestellungen(bestellungen: list[Bestellung]) -> None:
    for b in bestellungen:
        db.speichere_bestellung_db(asdict(b))


def fuege_bestellung_hinzu(bestellung: Bestellung) -> list[Bestellung]:
    db.speichere_bestellung_db(asdict(bestellung))
    return lade_bestellungen()


def aktualisiere_bestellstatus(
    bestell_id: str, neuer_status: BestellStatus
) -> list[Bestellung]:
    db.aktualisiere_bestellstatus_db(bestell_id, neuer_status)
    return lade_bestellungen()


def buche_bestellung_in_bestand(bestell_id: str) -> dict[str, dict]:
    """Verbucht eine offene Bestellung in den Bestand."""
    for b in lade_bestellungen():
        if b.bestell_id != bestell_id:
            continue
        if b.status != "offen":
            return lade_bestand()
        # Bestand erhöhen
        aktueller = lade_bestand().get(b.palettentyp, {"menge": 0, "sicherheitsbestand": 100})
        db.setze_bestand_db(
            b.palettentyp,
            menge=int(aktueller["menge"]) + b.menge,
        )
        db.aktualisiere_bestellstatus_db(b.bestell_id, "verbucht")
        break
    return lade_bestand()


def offene_bestellung_existiert(palettentyp: str) -> bool:
    return any(
        b.palettentyp == palettentyp and b.status == "offen"
        for b in lade_bestellungen()
    )


def berechne_kritische_paletten(
    benoetigt_pro_typ: dict[str, int] | None = None,
) -> list[dict]:
    bestand = lade_bestand()
    benoetigt_pro_typ = benoetigt_pro_typ or {}
    typen = set(bestand.keys()) | set(benoetigt_pro_typ.keys())

    result: list[dict] = []
    for typ in sorted(typen):
        eintrag = bestand.get(typ, {"menge": 0, "sicherheitsbestand": 100})
        menge = int(eintrag.get("menge", 0))
        sb = int(eintrag.get("sicherheitsbestand", 100))
        bedarf = int(benoetigt_pro_typ.get(typ, 0))
        zu_bestellen = max(0, bedarf + sb - menge) if bedarf > 0 else max(0, sb - menge)
        status = bewerte_status(menge, sb)
        result.append({
            "typ": typ,
            "menge": menge,
            "sicherheitsbestand": sb,
            "benoetigt": bedarf,
            "zu_bestellen": zu_bestellen,
            "status": status,
        })
    return result


# ---------------------------------------------------------------------------
# AW-Tracking
# ---------------------------------------------------------------------------

def lade_bearbeitete_auftraege() -> dict[str, dict]:
    return db.lade_aw_historie()


def markiere_auftraege_bearbeitet(
    auftragsnummern: list[str], quelle: str = ""
) -> int:
    return db.markiere_aw_bearbeitet(auftragsnummern, quelle)


def filtere_neue_auftraege(auftragsnummern: list[str]) -> tuple[list[str], list[str]]:
    return db.filtere_neue_aws(auftragsnummern)


def loesche_bearbeitete_auftraege() -> None:
    db.loesche_aw_historie()


# ---------------------------------------------------------------------------
# Verbrauchs-Timeline
# ---------------------------------------------------------------------------

def projiziere_bestand(
    palettentyp: str,
    monatsbedarf: float,
    horizont_tage: int = 120,
) -> list[dict]:
    from datetime import timedelta
    bestand_dict = lade_bestand()
    eintrag = bestand_dict.get(palettentyp, {"menge": 0, "sicherheitsbestand": 100})
    aktueller_bestand = float(eintrag.get("menge", 0))
    sicherheit = float(eintrag.get("sicherheitsbestand", 100))

    heute = date.today()
    if monatsbedarf < 0:
        monatsbedarf = 0
    tagesbedarf = monatsbedarf / 30.0

    zugaenge: dict[date, float] = {}
    for b in lade_bestellungen():
        if b.palettentyp != palettentyp or b.status == "storniert":
            continue
        if b.status == "verbucht":
            continue
        try:
            datum = date.fromisoformat(b.geplantes_verbrauchsdatum)
        except (TypeError, ValueError):
            continue
        if datum < heute:
            continue
        zugaenge[datum] = zugaenge.get(datum, 0.0) + b.menge

    verlauf: list[dict] = []
    bestand = aktueller_bestand
    for tag in range(horizont_tage + 1):
        d = heute + timedelta(days=tag)
        bestand -= tagesbedarf
        ereignis = ""
        if d in zugaenge:
            bestand += zugaenge[d]
            ereignis = f"+{int(zugaenge[d])} (Bestellung)"
        verlauf.append({
            "datum": d.isoformat(),
            "bestand": round(bestand, 1),
            "sicherheit": sicherheit,
            "ereignis": ereignis,
        })
    return verlauf
