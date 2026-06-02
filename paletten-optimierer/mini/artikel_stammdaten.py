"""Zentrale Artikel-Stammdaten — Single Source of Truth fuer Artikel-Masse.

Masse sind eine Eigenschaft DES ARTIKELS (Schluessel = Artikelnummer),
NICHT des einzelnen Auftrags. Eine manuelle Korrektur wirkt damit auf alle
Auftraege gleicher ArtikelNr und auf zukuenftige Importe.

Gespeichert werden PRODUKT-Masse (laenge_mm / breite_mm / hoehe_mm) — exakt
wie sie der Optimierer (import_dat['mit_mass']) und auftraege.json
('angeforderte_palette') verwenden. So bleibt alles konsistent und die
bestehende Optimierungslogik unveraendert.

Datei: %APPDATA%/PalettenMini/artikel_stammdaten.json   (Windows)
       ~/.palettenmini/artikel_stammdaten.json           (sonst)
Override per Umgebungsvariable PALETTENMINI_ARTIKEL (fuer Tests).

Eintrag-Schema:
    {
      "artikel_nummer": "PSV900x900",
      "laenge_mm": 900, "breite_mm": 900, "hoehe_mm": 144,
      "bezeichnung": "",
      "manuell_ueberschrieben": true,
      "letzte_aenderung": "2026-05-24T14:33:00",
      "geaendert_von": "manuell",
      "quelle": "stammdaten_2" | "excel_import" | "migration"
    }
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


def _pfad() -> Path:
    env = os.environ.get("PALETTENMINI_ARTIKEL")
    if env:
        return Path(env)
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "PalettenMini"
    else:
        base = Path.home() / ".palettenmini"
    base.mkdir(parents=True, exist_ok=True)
    return base / "artikel_stammdaten.json"


def pfad_str() -> str:
    return str(_pfad())


def datei_existiert() -> bool:
    return _pfad().exists()


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _norm_nr(nr: Any) -> str:
    return str(nr if nr is not None else "").strip()


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
    p.write_text(json.dumps(eintraege, ensure_ascii=False, indent=2),
                 encoding="utf-8")


def alle() -> list[dict[str, Any]]:
    return _read_raw()


def _index() -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for e in _read_raw():
        nr = _norm_nr(e.get("artikel_nummer"))
        if nr:
            out[nr] = e
    return out


def lookup(artikel_nr: Any) -> dict[str, Any] | None:
    return _index().get(_norm_nr(artikel_nr))


def upsert(artikel_nr: Any, laenge_mm: int, breite_mm: int, hoehe_mm: int = 0,
           *, manuell: bool = False, bezeichnung: str = "",
           quelle: str = "excel_import",
           geaendert_von: str = "manuell") -> tuple[dict[str, Any], bool]:
    """Legt an oder aktualisiert die Masse eines Artikels.
    Liefert (eintrag, neu_angelegt)."""
    nr = _norm_nr(artikel_nr)
    if not nr:
        return {}, False
    h = _read_raw()
    jetzt = _now()
    for e in h:
        if _norm_nr(e.get("artikel_nummer")) == nr:
            e["laenge_mm"] = int(laenge_mm)
            e["breite_mm"] = int(breite_mm)
            e["hoehe_mm"] = int(max(0, hoehe_mm))
            if bezeichnung:
                e["bezeichnung"] = str(bezeichnung)
            e["manuell_ueberschrieben"] = bool(manuell)
            e["letzte_aenderung"] = jetzt
            e["geaendert_von"] = str(geaendert_von)
            e["quelle"] = str(quelle)
            _write_raw(h)
            return e, False
    neu = {
        "artikel_nummer": nr,
        "laenge_mm": int(laenge_mm),
        "breite_mm": int(breite_mm),
        "hoehe_mm": int(max(0, hoehe_mm)),
        "bezeichnung": str(bezeichnung),
        "manuell_ueberschrieben": bool(manuell),
        "letzte_aenderung": jetzt,
        "geaendert_von": str(geaendert_von),
        "quelle": str(quelle),
    }
    h.append(neu)
    _write_raw(h)
    return neu, True


def setze_manuell(artikel_nr: Any, flag: bool) -> bool:
    """Setzt/entfernt den manuellen Pin. False = beim naechsten Import
    werden wieder Excel-Masse uebernommen."""
    nr = _norm_nr(artikel_nr)
    h = _read_raw()
    geaendert = False
    for e in h:
        if _norm_nr(e.get("artikel_nummer")) == nr:
            e["manuell_ueberschrieben"] = bool(flag)
            e["letzte_aenderung"] = _now()
            geaendert = True
            break
    if geaendert:
        _write_raw(h)
    return geaendert


def betroffene_auftraege(artikel_nr: Any, auftraege_modul) -> int:
    """Anzahl Auftraege mit dieser ArtikelNr (fuer das Warn-Feedback)."""
    nr = _norm_nr(artikel_nr)
    if not nr:
        return 0
    return sum(1 for a in auftraege_modul.alle()
               if _norm_nr(a.get("artikel_nummer")) == nr)


def anwenden_auf_zeilen(zeilen: list[dict[str, Any]]) -> dict[str, int]:
    """Wendet die zentralen Stammdaten auf importierte 'mit_mass'-Zeilen an
    (mutiert in-place):
      - manuell gepinnter Artikel -> Excel-Masse werden durch Stammdaten
        ERSETZT (laenge/breite/hoehe).
      - sonst -> Stammdaten aus Excel upserten (nicht-manuell).
    Setzt pro Zeile 'mass_quelle'. Liefert Statistik fuer den UI-Hinweis.
    """
    stats = {"manuell": 0, "excel": 0, "neu": 0, "abweichung": 0,
             "ohne_nr": 0}
    # Ein einziges Read + Write (statt pro Zeile) — O(n) statt O(n*m).
    h = _read_raw()
    idx: dict[str, dict[str, Any]] = {}
    for e in h:
        nr0 = _norm_nr(e.get("artikel_nummer"))
        if nr0:
            idx[nr0] = e
    jetzt = _now()
    geaendert = False
    for z in zeilen:
        nr = _norm_nr(z.get("artikelnummer") or z.get("artikel_nummer"))
        if not nr:
            z["mass_quelle"] = "ohne_artikelnr"
            stats["ohne_nr"] += 1
            continue
        st = idx.get(nr)
        if st and st.get("manuell_ueberschrieben"):
            try:
                if (z.get("laenge") is not None and z.get("breite") is not None
                        and (int(z["laenge"]) != int(st["laenge_mm"])
                             or int(z["breite"]) != int(st["breite_mm"]))):
                    stats["abweichung"] += 1
            except (TypeError, ValueError):
                pass
            z["laenge"] = int(st["laenge_mm"])
            z["breite"] = int(st["breite_mm"])
            z["hoehe"] = int(st.get("hoehe_mm", 0))
            z["mass_quelle"] = "manuell_gepflegt"
            stats["manuell"] += 1
        else:
            try:
                l = int(z.get("laenge"))
                b = int(z.get("breite"))
                hh = int(z.get("hoehe") or 0)
            except (TypeError, ValueError):
                z["mass_quelle"] = "ungueltig"
                continue
            if st:
                st["laenge_mm"] = l
                st["breite_mm"] = b
                st["hoehe_mm"] = int(max(0, hh))
                st["letzte_aenderung"] = jetzt
                st["quelle"] = "excel_import"
                z["mass_quelle"] = "excel_import"
                stats["excel"] += 1
            else:
                neu = {
                    "artikel_nummer": nr,
                    "laenge_mm": l, "breite_mm": b,
                    "hoehe_mm": int(max(0, hh)),
                    "bezeichnung": "", "manuell_ueberschrieben": False,
                    "letzte_aenderung": jetzt, "geaendert_von": "Import",
                    "quelle": "excel_import",
                }
                h.append(neu)
                idx[nr] = neu
                z["mass_quelle"] = "neu"
                stats["neu"] += 1
            geaendert = True
    if geaendert:
        _write_raw(h)
    return stats


def migration_aus_auftraege(auftraege_modul) -> dict[str, Any]:
    """Einmalige Migration: baut die Stammdaten aus auftraege.json.
    Erstes Vorkommen mit gueltigen Massen gewinnt. Laeuft NUR, wenn die
    Stammdaten-Datei noch nicht existiert (danach kein Re-Run)."""
    if _pfad().exists():
        return {"migriert": False, "angelegt": 0}
    gesehen: dict[str, dict[str, Any]] = {}
    for a in auftraege_modul.alle():
        nr = _norm_nr(a.get("artikel_nummer"))
        if not nr or nr in gesehen:
            continue
        ang = a.get("angeforderte_palette", {}) or {}
        l = int(ang.get("l", 0) or 0)
        b = int(ang.get("b", 0) or 0)
        hh = int(ang.get("h", 0) or 0)
        if l <= 0 or b <= 0:
            continue
        gesehen[nr] = {
            "artikel_nummer": nr,
            "laenge_mm": l, "breite_mm": b, "hoehe_mm": hh,
            "bezeichnung": "",
            "manuell_ueberschrieben": False,
            "letzte_aenderung": _now(),
            "geaendert_von": "Migration",
            "quelle": "migration",
        }
    _write_raw(list(gesehen.values()))
    return {"migriert": True, "angelegt": len(gesehen)}
