"""JSON-Persistenz für Bestand und Bestellhistorie.

Bestand und Bestellungen werden als JSON-Dateien gespeichert. Der Speicherort
wird per Umgebungsvariable ``PALETTEN_STORAGE_DIR`` gesteuert (Default:
./storage). Bestellungen besitzen eine UUID und einen Status, sodass
Doppelbestellungen vermieden werden können.
"""
from __future__ import annotations

import json
import os
import uuid
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Literal


BestellStatus = Literal["offen", "verbucht", "storniert"]
BestandsStatus = Literal["ok", "unter", "kritisch"]


@dataclass
class Bestellung:
    """Eine einzelne Bestell-Position für eine Standardpalette."""

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


def _storage_dir() -> Path:
    pfad = os.environ.get("PALETTEN_STORAGE_DIR")
    if pfad:
        d = Path(pfad)
    else:
        d = Path("storage")
    d.mkdir(parents=True, exist_ok=True)
    return d


def _bestand_pfad() -> Path:
    return _storage_dir() / "bestand.json"


def _bestellungen_pfad() -> Path:
    return _storage_dir() / "bestellungen.json"


def lade_bestand() -> dict[str, dict]:
    """Lädt den aktuellen Bestand pro Palettentyp.

    Format::

        {
            "1500 × 700 mm": {"menge": 250, "sicherheitsbestand": 100},
            ...
        }
    """
    p = _bestand_pfad()
    if not p.exists():
        return {}
    try:
        with p.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {}
        return data
    except (OSError, json.JSONDecodeError):
        return {}


def speichere_bestand(bestand: dict[str, dict]) -> None:
    p = _bestand_pfad()
    with p.open("w", encoding="utf-8") as f:
        json.dump(bestand, f, indent=2, ensure_ascii=False)


def aktualisiere_bestand(
    palettentyp: str,
    menge: int | None = None,
    sicherheitsbestand: int | None = None,
) -> dict[str, dict]:
    """Setzt oder aktualisiert Bestand und Sicherheitsbestand für einen Typ."""
    bestand = lade_bestand()
    eintrag = bestand.get(palettentyp, {"menge": 0, "sicherheitsbestand": 100})
    if menge is not None:
        eintrag["menge"] = int(menge)
    if sicherheitsbestand is not None:
        eintrag["sicherheitsbestand"] = int(sicherheitsbestand)
    bestand[palettentyp] = eintrag
    speichere_bestand(bestand)
    return bestand


def setze_sicherheitsbestand_global(sicherheitsbestand: int) -> dict[str, dict]:
    bestand = lade_bestand()
    for typ in bestand:
        bestand[typ]["sicherheitsbestand"] = int(sicherheitsbestand)
    speichere_bestand(bestand)
    return bestand


def bewerte_status(menge: int, sicherheitsbestand: int) -> BestandsStatus:
    if menge >= sicherheitsbestand:
        return "ok"
    if menge >= 0.5 * sicherheitsbestand:
        return "unter"
    return "kritisch"


def lade_bestellungen() -> list[Bestellung]:
    p = _bestellungen_pfad()
    if not p.exists():
        return []
    try:
        with p.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            return []
        return [Bestellung(**b) for b in data]
    except (OSError, json.JSONDecodeError, TypeError):
        return []


def speichere_bestellungen(bestellungen: list[Bestellung]) -> None:
    p = _bestellungen_pfad()
    with p.open("w", encoding="utf-8") as f:
        json.dump([asdict(b) for b in bestellungen], f, indent=2, ensure_ascii=False)


def fuege_bestellung_hinzu(bestellung: Bestellung) -> list[Bestellung]:
    """Hängt eine Bestellung an die Historie und schreibt sie."""
    alle = lade_bestellungen()
    alle.append(bestellung)
    speichere_bestellungen(alle)
    return alle


def aktualisiere_bestellstatus(
    bestell_id: str, neuer_status: BestellStatus
) -> list[Bestellung]:
    alle = lade_bestellungen()
    for b in alle:
        if b.bestell_id == bestell_id:
            b.status = neuer_status
            break
    speichere_bestellungen(alle)
    return alle


def buche_bestellung_in_bestand(bestell_id: str) -> dict[str, dict]:
    """Verbucht eine offene Bestellung in den Bestand und markiert sie als
    verbucht. Bereits verbuchte Bestellungen werden ignoriert."""
    alle = lade_bestellungen()
    bestand = lade_bestand()
    for b in alle:
        if b.bestell_id != bestell_id:
            continue
        if b.status != "offen":
            return bestand
        eintrag = bestand.get(b.palettentyp, {"menge": 0, "sicherheitsbestand": 100})
        eintrag["menge"] = int(eintrag.get("menge", 0)) + b.menge
        bestand[b.palettentyp] = eintrag
        b.status = "verbucht"
        break
    speichere_bestellungen(alle)
    speichere_bestand(bestand)
    return bestand


def offene_bestellung_existiert(palettentyp: str) -> bool:
    return any(
        b.palettentyp == palettentyp and b.status == "offen"
        for b in lade_bestellungen()
    )


def berechne_kritische_paletten(
    benoetigt_pro_typ: dict[str, int] | None = None,
) -> list[dict]:
    """Liefert eine Liste der Palettentypen mit Status und Bedarf.

    Args:
        benoetigt_pro_typ: Optional Mapping ``label → benötigte Menge``,
            kommt aus dem aktuellen Optimierungs-Ergebnis.

    Returns:
        Liste mit ``{typ, menge, sicherheitsbestand, benoetigt, status, zu_bestellen}``.
    """
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
        result.append(
            {
                "typ": typ,
                "menge": menge,
                "sicherheitsbestand": sb,
                "benoetigt": bedarf,
                "zu_bestellen": zu_bestellen,
                "status": status,
            }
        )
    return result
