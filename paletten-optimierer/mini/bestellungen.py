"""Bestellungs-Historie (Spec §7).

Jeder bestaetigte 'Bestellung getaetigt'-Klick erzeugt einen persistenten
Eintrag — auch wenn die Palette spaeter geloescht wird (Snapshot).

Pfad:
  Windows:    %APPDATA%/PalettenMini/bestellungen.json
  Linux/Mac:  ~/.palettenmini/bestellungen.json
  ENV-Override: PALETTENMINI_BESTELLUNGEN

Schema pro Eintrag (Spec §7):
  {
    "id": "uuid-hex",
    "palette_id": str | None,            # FK auf palettenkatalog.id
    "palette_typ_snapshot": {            # eingefroren zum Bestellzeitpunkt
        "name": str, "L_mm": int, "B_mm": int, "hoehe_mm": int,
    },
    "menge": int,                         # >= 1
    "bestelldatum": "YYYY-MM-DD",
    "kunde": str,
    "artikelnummer": str,
    "auftragsnummer_aw": str,             # eindeutig pro Auftrag
    "geplantes_verbrauchsdatum": "YYYY-MM-DD" oder "",
    "status": "offen" | "verbraucht" | "storniert",
    "erstellt_am": "ISO8601",
    "geaendert_am": "ISO8601",
    "erstellt_von": str,                  # in dieser Single-User-App
                                          # immer 'user'
    "ergebnis_id": str | None,            # UUID des Optimierungslaufs
    "notiz": str,
  }

Robust: korrupte/fehlende Datei -> [] (kein Crash).
Transaktion (Spec §7, atomar mit Bestand-Anpassung): siehe
``bestellung_atomar()`` weiter unten.
"""
from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, date
from pathlib import Path
from typing import Any


STATUS_ERLAUBT = {"offen", "verbraucht", "storniert"}


def _pfad() -> Path:
    env = os.environ.get("PALETTENMINI_BESTELLUNGEN")
    if env:
        return Path(env)
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "PalettenMini"
    else:
        base = Path.home() / ".palettenmini"
    base.mkdir(parents=True, exist_ok=True)
    return base / "bestellungen.json"


def pfad_str() -> str:
    return str(_pfad())


def _read_raw() -> list[dict[str, Any]]:
    p = _pfad()
    if not p.exists():
        return []
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def _write_raw(eintraege: list[dict[str, Any]]) -> None:
    p = _pfad()
    p.parent.mkdir(parents=True, exist_ok=True)
    # Atomar via temp+rename
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(eintraege, ensure_ascii=False, indent=2),
                    encoding="utf-8")
    tmp.replace(p)


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _heute() -> str:
    return date.today().isoformat()


def neue_bestellung(*, palette_id: str | None,
                     palette_typ_snapshot: dict,
                     menge: int,
                     kunde: str = "",
                     artikelnummer: str = "",
                     auftragsnummer_aw: str = "",
                     geplantes_verbrauchsdatum: str = "",
                     bestelldatum: str = "",
                     status: str = "offen",
                     ergebnis_id: str | None = None,
                     notiz: str = "") -> str:
    """Legt einen Historie-Eintrag an. Liefert die id."""
    if menge < 1:
        raise ValueError(f"menge muss >= 1 sein, bekam {menge}")
    if status not in STATUS_ERLAUBT:
        status = "offen"
    snap = {
        "name": str(palette_typ_snapshot.get("name", "")),
        "L_mm": int(palette_typ_snapshot.get("L_mm", 0)),
        "B_mm": int(palette_typ_snapshot.get("B_mm", 0)),
        "hoehe_mm": int(palette_typ_snapshot.get("hoehe_mm", 0)),
    }
    jetzt = _now()
    eid = uuid.uuid4().hex
    eintrag = {
        "id": eid,
        "palette_id": palette_id,
        "palette_typ_snapshot": snap,
        "menge": int(menge),
        "bestelldatum": bestelldatum or _heute(),
        "kunde": str(kunde),
        "artikelnummer": str(artikelnummer),
        "auftragsnummer_aw": str(auftragsnummer_aw),
        "geplantes_verbrauchsdatum": str(geplantes_verbrauchsdatum or ""),
        "status": status,
        "erstellt_am": jetzt,
        "geaendert_am": jetzt,
        "erstellt_von": "user",
        "ergebnis_id": ergebnis_id,
        "notiz": str(notiz),
    }
    h = _read_raw()
    h.append(eintrag)
    _write_raw(h)
    return eid


def update_status(eintrag_id: str, neu_status: str) -> bool:
    """Status setzen ('offen' | 'verbraucht' | 'storniert')."""
    if neu_status not in STATUS_ERLAUBT:
        return False
    h = _read_raw()
    for e in h:
        if e.get("id") == eintrag_id:
            e["status"] = neu_status
            e["geaendert_am"] = _now()
            _write_raw(h)
            return True
    return False


def update_eintrag(eintrag_id: str, **felder) -> bool:
    """Aktualisiert einzelne Felder. Nur Whitelist."""
    erlaubt = {"menge", "kunde", "artikelnummer", "auftragsnummer_aw",
               "geplantes_verbrauchsdatum", "bestelldatum", "notiz"}
    h = _read_raw()
    for e in h:
        if e.get("id") == eintrag_id:
            for k, v in felder.items():
                if k in erlaubt:
                    e[k] = v
            e["geaendert_am"] = _now()
            _write_raw(h)
            return True
    return False


def loesche_eintrag(eintrag_id: str) -> bool:
    h = _read_raw()
    neu = [e for e in h if e.get("id") != eintrag_id]
    if len(neu) == len(h):
        return False
    _write_raw(neu)
    return True


def alle() -> list[dict[str, Any]]:
    """Alle Bestellungen, neueste zuerst."""
    return sorted(_read_raw(),
                   key=lambda e: e.get("erstellt_am", ""), reverse=True)


def offene() -> list[dict[str, Any]]:
    """Status == 'offen'."""
    return [e for e in _read_raw() if e.get("status") == "offen"]


def verbraucht() -> list[dict[str, Any]]:
    """Status == 'verbraucht'."""
    return [e for e in _read_raw() if e.get("status") == "verbraucht"]


def stornierte() -> list[dict[str, Any]]:
    """Status == 'storniert'."""
    return [e for e in _read_raw() if e.get("status") == "storniert"]


def aktive() -> list[dict[str, Any]]:
    """Alles ausser storniert — zaehlt fuer Doppelschutz."""
    return [e for e in _read_raw() if e.get("status") != "storniert"]


def leere_alle() -> int:
    h = _read_raw()
    n = len(h)
    _write_raw([])
    return n


# ---------------------------------------------------------------------------
# Atomare Transaktion (Spec §6 + §7): Bestand reduzieren + Historie schreiben
# ---------------------------------------------------------------------------
def bestellung_atomar(*, katalog_modul, palette_id: str, menge: int,
                       kunde: str, artikelnummer: str,
                       auftragsnummer_aw: str,
                       geplantes_verbrauchsdatum: str = "",
                       bestelldatum: str = "",
                       ergebnis_id: str | None = None,
                       notiz: str = "") -> dict:
    """Atomare Transaktion: Bestand -= menge, Verbrauch += 1,
    Historie-Eintrag.

    Achtung: 'atomar' im JSON-Sinne = beste-effort. Falls katalog-Update
    fehlschlaegt, wird KEIN Historie-Eintrag geschrieben.

    Liefert dict {'ok': bool, 'fehler': str, 'bestellung_id': str|None}.
    """
    if menge < 1:
        return {"ok": False, "fehler": f"Menge {menge} < 1",
                "bestellung_id": None}
    # Lookup Palette fuer Snapshot
    eintraege = katalog_modul.alle()
    palette = next((e for e in eintraege if e.get("id") == palette_id), None)
    if palette is None:
        return {"ok": False,
                "fehler": f"Palette-id {palette_id} nicht im Katalog",
                "bestellung_id": None}
    snap = {
        "name": palette.get("name", ""),
        "L_mm": int(palette.get("L_mm", 0)),
        "B_mm": int(palette.get("B_mm", 0)),
        "hoehe_mm": int(palette.get("hoehe_mm", 0)),
    }
    # 1. Bestand aendern (kann negativ werden — Vormerkung)
    bestand_neu = katalog_modul.aendere_bestand(palette_id, -menge)
    if bestand_neu is None:
        return {"ok": False, "fehler": "Bestand-Update fehlgeschlagen",
                "bestellung_id": None}
    # 2. Verbrauch +1
    katalog_modul.inkrement_verbrauch(palette_id)
    # 3. Historie schreiben
    try:
        bid = neue_bestellung(
            palette_id=palette_id,
            palette_typ_snapshot=snap,
            menge=menge,
            kunde=kunde,
            artikelnummer=artikelnummer,
            auftragsnummer_aw=auftragsnummer_aw,
            geplantes_verbrauchsdatum=geplantes_verbrauchsdatum,
            bestelldatum=bestelldatum,
            ergebnis_id=ergebnis_id,
            notiz=notiz,
        )
    except Exception as exc:
        # Rollback Bestand
        katalog_modul.aendere_bestand(palette_id, +menge)
        katalog_modul.inkrement_verbrauch(palette_id, -1)
        return {"ok": False, "fehler": f"Historie-Schreiben: {exc}",
                "bestellung_id": None}
    return {"ok": True, "fehler": "", "bestellung_id": bid}


# ---------------------------------------------------------------------------
# CSV-Export (Spec §7)
# ---------------------------------------------------------------------------
CSV_SPALTEN = (
    "id", "bestelldatum", "status", "kunde", "artikelnummer",
    "auftragsnummer_aw", "menge",
    "palette_name", "palette_L", "palette_B", "palette_hoehe",
    "geplantes_verbrauchsdatum", "erstellt_am", "notiz",
)


def nach_csv() -> str:
    """CSV-Export aller Bestellungen, Semikolon-Trenner."""
    import csv
    import io
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", lineterminator="\n")
    w.writerow(CSV_SPALTEN)
    for e in alle():
        snap = e.get("palette_typ_snapshot", {}) or {}
        w.writerow([
            e.get("id", ""),
            e.get("bestelldatum", ""),
            e.get("status", ""),
            e.get("kunde", ""),
            e.get("artikelnummer", ""),
            e.get("auftragsnummer_aw", ""),
            int(e.get("menge", 0)),
            snap.get("name", ""),
            int(snap.get("L_mm", 0)),
            int(snap.get("B_mm", 0)),
            int(snap.get("hoehe_mm", 0)),
            e.get("geplantes_verbrauchsdatum", ""),
            e.get("erstellt_am", ""),
            e.get("notiz", ""),
        ])
    return buf.getvalue()
