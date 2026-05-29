"""Auftragsverwaltung (Spec Stammdaten 2).

Zentraler Store für ALLE AWs (Auftragsnummern), die jemals importiert
oder manuell angelegt wurden — unabhängig vom Bestellstatus.

Pfad:
  Windows:    %APPDATA%/PalettenMini/auftraege.json
  Linux/Mac:  ~/.palettenmini/auftraege.json
  ENV-Override: PALETTENMINI_AUFTRAEGE

Schema:
  {
    "id": "uuid",
    "aw_nummer": "AW-YYYY-NNNN",
    "kunde": str,
    "artikel_nummer": str,
    "menge": int,
    "angeforderte_palette": {"l": int, "b": int, "h": int},
    "zugewiesene_palette_id": str | None,  # FK auf palettenkatalog
    "bestelldatum": "YYYY-MM-DD",
    "verbrauchsdatum": "YYYY-MM-DD",
    "verlinkte_bestellung_id": str | None,  # FK auf procurement_orders
    "status": "offen" | "in_arbeit" | "abgeschlossen" | "storniert",
    "status_manuell_gesetzt": bool,
    "status_grund": str,
    "bemerkung": str,
    "quelle": "excel_import" | "manuell",
    "erstellt_am": ISO,
    "geaendert_am": ISO,
  }
"""
from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any


STATUS_ERLAUBT = {"offen", "in_arbeit", "abgeschlossen", "storniert"}
STATUS_BADGE = {
    "offen":           ("🟢", "offen"),
    "in_arbeit":       ("🟡", "in Arbeit"),
    "abgeschlossen":   ("✅", "abgeschlossen"),
    "storniert":       ("⚫", "storniert"),
}


def _pfad() -> Path:
    env = os.environ.get("PALETTENMINI_AUFTRAEGE")
    if env:
        return Path(env)
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "PalettenMini"
    else:
        base = Path.home() / ".palettenmini"
    base.mkdir(parents=True, exist_ok=True)
    return base / "auftraege.json"


def pfad_str() -> str:
    return str(_pfad())


def _read_raw() -> list[dict[str, Any]]:
    p = _pfad()
    if not p.exists():
        return []
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(d, list):
            return []
        for e in d:
            _migriere(e)
        return d
    except (OSError, json.JSONDecodeError):
        return []


def _migriere(e: dict[str, Any]) -> None:
    e.setdefault("kunde", "")
    e.setdefault("artikel_nummer", "")
    e.setdefault("menge", 0)
    e.setdefault("angeforderte_palette", {"l": 0, "b": 0, "h": 0})
    e.setdefault("zugewiesene_palette_id", None)
    e.setdefault("bestelldatum", "")
    e.setdefault("verbrauchsdatum", "")
    e.setdefault("verlinkte_bestellung_id", None)
    e.setdefault("status", "offen")
    e.setdefault("status_manuell_gesetzt", False)
    e.setdefault("status_grund", "")
    e.setdefault("bemerkung", "")
    e.setdefault("quelle", "manuell")
    e.setdefault("geaendert_am", e.get("erstellt_am", ""))


def _write_raw(eintraege: list[dict[str, Any]]) -> None:
    p = _pfad()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(eintraege, ensure_ascii=False, indent=2,
                                default=str),
                    encoding="utf-8")
    tmp.replace(p)


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _heute() -> str:
    return date.today().isoformat()


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------
def alle() -> list[dict[str, Any]]:
    """Alle Aufträge, neueste zuerst."""
    return sorted(_read_raw(),
                   key=lambda e: e.get("erstellt_am", ""), reverse=True)


def finde(eid: str) -> dict[str, Any] | None:
    for e in _read_raw():
        if e.get("id") == eid:
            return e
    return None


def finde_per_aw(aw_nummer: str) -> dict[str, Any] | None:
    """Liefert den Auftrag mit exakter AW-Nummer (case-insensitive)."""
    aw = (aw_nummer or "").strip().lower()
    if not aw:
        return None
    for e in _read_raw():
        if (e.get("aw_nummer", "") or "").strip().lower() == aw:
            return e
    return None


def _next_aw_nummer(jahr: int | None = None) -> str:
    """Spec §6: AW-YYYY-NNNN — nächste freie Nummer pro Jahr."""
    jahr = jahr or datetime.now().year
    prefix = f"AW-{jahr}-"
    max_nr = 0
    for e in _read_raw():
        aw = e.get("aw_nummer", "") or ""
        if aw.startswith(prefix):
            try:
                nr = int(aw.split("-")[-1])
                if nr > max_nr:
                    max_nr = nr
            except (ValueError, IndexError):
                continue
    return f"{prefix}{max_nr + 1:04d}"


def naechste_aw_nummer() -> str:
    """Public Helper."""
    return _next_aw_nummer()


def neuer_auftrag(*, aw_nummer: str = "", kunde: str = "",
                   artikel_nummer: str = "",
                   menge: int = 0,
                   angeforderte_l: int = 0, angeforderte_b: int = 0,
                   angeforderte_h: int = 0,
                   zugewiesene_palette_id: str | None = None,
                   bestelldatum: str = "", verbrauchsdatum: str = "",
                   verlinkte_bestellung_id: str | None = None,
                   status: str = "offen",
                   bemerkung: str = "",
                   quelle: str = "manuell") -> dict[str, Any]:
    """Legt einen neuen Auftrag an. Wenn aw_nummer leer → auto-Nummer."""
    aw = (aw_nummer or "").strip() or _next_aw_nummer()
    # Spec §5 + §6: AW-Duplikat-Check
    if finde_per_aw(aw):
        return {"ok": False, "fehler": f"AW '{aw}' existiert bereits",
                 "id": None}
    if status not in STATUS_ERLAUBT:
        status = "offen"
    eid = uuid.uuid4().hex
    eintrag = {
        "id": eid,
        "aw_nummer": aw,
        "kunde": str(kunde or ""),
        "artikel_nummer": str(artikel_nummer or ""),
        "menge": int(max(0, menge)),
        "angeforderte_palette": {
            "l": int(max(0, angeforderte_l)),
            "b": int(max(0, angeforderte_b)),
            "h": int(max(0, angeforderte_h)),
        },
        "zugewiesene_palette_id": zugewiesene_palette_id,
        "bestelldatum": str(bestelldatum or ""),
        "verbrauchsdatum": str(verbrauchsdatum or ""),
        "verlinkte_bestellung_id": verlinkte_bestellung_id,
        "status": status,
        "status_manuell_gesetzt": False,
        "status_grund": "",
        "bemerkung": str(bemerkung or ""),
        "quelle": quelle if quelle in ("excel_import", "manuell")
                  else "manuell",
        "erstellt_am": _now(),
        "geaendert_am": _now(),
    }
    h = _read_raw()
    h.append(eintrag)
    _write_raw(h)
    return {"ok": True, "fehler": "", "id": eid, "aw_nummer": aw}


def update_auftrag(eid: str, **felder) -> dict[str, Any]:
    """Aktualisiert Felder. Bei aw_nummer-Aenderung wird Duplikat geprueft.
    Bei status-Aenderung muss status_grund mitgegeben werden (Spec §3)."""
    erlaubt = {"aw_nummer", "kunde", "artikel_nummer", "menge",
               "angeforderte_palette", "zugewiesene_palette_id",
               "bestelldatum", "verbrauchsdatum",
               "verlinkte_bestellung_id", "bemerkung"}
    h = _read_raw()
    for e in h:
        if e.get("id") != eid:
            continue
        # AW-Duplikat-Check
        if "aw_nummer" in felder:
            neu_aw = (felder["aw_nummer"] or "").strip()
            if neu_aw and neu_aw != e["aw_nummer"]:
                anderer = finde_per_aw(neu_aw)
                if anderer and anderer.get("id") != eid:
                    return {"ok": False,
                             "fehler": f"AW '{neu_aw}' existiert bereits",
                             "konflikt_id": anderer["id"]}
        for k, v in felder.items():
            if k in erlaubt:
                e[k] = v
        e["geaendert_am"] = _now()
        _write_raw(h)
        return {"ok": True, "fehler": ""}
    return {"ok": False, "fehler": "auftrag-nicht-gefunden"}


def setze_status(eid: str, neu_status: str, *, grund: str = "",
                  manuell: bool = True) -> dict[str, Any]:
    """Spec §3: Status-Wechsel mit Pflicht-Grund bei manueller
    Überschreibung."""
    if neu_status not in STATUS_ERLAUBT:
        return {"ok": False, "fehler": f"Status '{neu_status}' ungueltig"}
    if manuell and not (grund or "").strip():
        return {"ok": False,
                 "fehler": "Bei manueller Status-Aenderung: Grund Pflicht."}
    h = _read_raw()
    for e in h:
        if e.get("id") != eid:
            continue
        alt = e.get("status")
        e["status"] = neu_status
        e["status_manuell_gesetzt"] = bool(manuell)
        if manuell:
            e["status_grund"] = grund.strip()
        e["geaendert_am"] = _now()
        _write_raw(h)
        return {"ok": True, "fehler": "", "alt_status": alt}
    return {"ok": False, "fehler": "auftrag-nicht-gefunden"}


def loesche_auftrag(eid: str) -> bool:
    h = _read_raw()
    neu = [e for e in h if e.get("id") != eid]
    if len(neu) == len(h):
        return False
    _write_raw(neu)
    return True


def leere_alle() -> int:
    h = _read_raw()
    n = len(h)
    _write_raw([])
    return n


# ---------------------------------------------------------------------------
# Excel-Import: AW upserten (Spec §8 Verknüpfung mit Tab Import)
# ---------------------------------------------------------------------------
def upsert_aus_excel_zeile(zeile: dict) -> dict[str, Any]:
    """Wenn AW noch nicht existiert → neu anlegen (quelle=excel_import).
    Wenn schon da → NICHT überschreiben, nur id zurueckgeben."""
    aw = (zeile.get("auftrag") or zeile.get("aw_nummer") or "").strip()
    if not aw:
        return {"ok": False, "fehler": "keine-aw", "id": None}
    vorhanden = finde_per_aw(aw)
    if vorhanden:
        return {"ok": True, "fehler": "existiert", "id": vorhanden["id"],
                 "aw_nummer": aw, "neu": False}
    erg = neuer_auftrag(
        aw_nummer=aw,
        kunde=str(zeile.get("name") or zeile.get("kunde") or ""),
        artikel_nummer=str(zeile.get("artikelnummer")
                              or zeile.get("artikel_nummer") or ""),
        menge=int(zeile.get("anzahl") or zeile.get("menge") or 0),
        angeforderte_l=int(zeile.get("laenge") or zeile.get("L") or 0),
        angeforderte_b=int(zeile.get("breite") or zeile.get("B") or 0),
        angeforderte_h=int(zeile.get("hoehe") or 0),
        bestelldatum=str(zeile.get("bestelldatum", "") or ""),
        verbrauchsdatum=str(zeile.get("verbrauchsdatum") or ""),
        quelle="excel_import",
    )
    erg["neu"] = True
    return erg


def upsert_aus_excel(zeilen: list[dict]) -> dict[str, Any]:
    """Bulk-Upsert. Liefert {neu_count, existiert_count, fehler_count}."""
    neu = 0; vorhanden = 0; fehler = 0
    ids = []
    for z in zeilen:
        erg = upsert_aus_excel_zeile(z)
        if not erg["ok"]:
            fehler += 1
            continue
        ids.append(erg["id"])
        if erg.get("neu"):
            neu += 1
        else:
            vorhanden += 1
    return {"neu": neu, "vorhanden": vorhanden, "fehler": fehler,
             "ids": ids}


# ---------------------------------------------------------------------------
# Auto-Statuswechsel (Spec §3)
# ---------------------------------------------------------------------------
def sync_status_aus_beschaffung(procurement_modul) -> dict[str, Any]:
    """Sync gegen alle Beschaffungs-Aufträge (procurement):
      - offen → in_arbeit: AW in irgendeiner Beschaffung verlinkt
      - in_arbeit → abgeschlossen: AW in Beschaffung mit Status
        'eingegangen' UND verbrauchsdatum < heute

    Manuell gesetzte Stati werden NICHT überschrieben.
    Liefert dict {wechsel: n, details: [(aw, alt, neu)]}.
    """
    # AW → (status, has_eingang)
    aw_zu_proc: dict[str, tuple[str, bool]] = {}
    for proc_a in procurement_modul.alle():
        prc_status = proc_a.get("status", "")
        eingegangen = prc_status in ("eingegangen", "wareneingang")
        for pos in proc_a.get("positionen", []) or []:
            for aw in (pos.get("verlinkte_aws") or []):
                key = str(aw).strip()
                if not key:
                    continue
                # Höchster Status gewinnt: eingegangen > unterwegs > offen
                if (key not in aw_zu_proc
                        or eingegangen
                        and not aw_zu_proc[key][1]):
                    aw_zu_proc[key] = (prc_status, eingegangen)

    heute = date.today()
    details = []
    h = _read_raw()
    geaendert = 0
    for e in h:
        if e.get("status_manuell_gesetzt"):
            continue  # nicht auto-überschreiben
        if e.get("status") == "storniert":
            continue  # nicht auto-überschreiben
        aw = e.get("aw_nummer", "")
        info = aw_zu_proc.get(aw)
        neu_status = None
        if info is None:
            # Keine Beschaffung verlinkt: behalten was ist (offen ist default)
            continue
        _, eingegangen = info
        vbd_str = e.get("verbrauchsdatum", "")
        vbd_erreicht = False
        if vbd_str:
            try:
                vbd = datetime.fromisoformat(vbd_str[:10]).date()
                vbd_erreicht = vbd <= heute
            except ValueError:
                vbd_erreicht = False
        if eingegangen and vbd_erreicht:
            neu_status = "abgeschlossen"
        else:
            neu_status = "in_arbeit"
        if neu_status and neu_status != e.get("status"):
            details.append((aw, e.get("status"), neu_status))
            e["status"] = neu_status
            e["geaendert_am"] = _now()
            geaendert += 1
    if geaendert > 0:
        _write_raw(h)
    return {"wechsel": geaendert, "details": details}


# ---------------------------------------------------------------------------
# Filter / Stats
# ---------------------------------------------------------------------------
def filter_aufträge(*, suche: str = "",
                      status_in: set[str] | None = None,
                      kunde: str = "",
                      bestelldatum_von: str = "",
                      bestelldatum_bis: str = "") -> list[dict]:
    """Spec §4 Filter."""
    q = (suche or "").strip().lower()
    out = []
    for e in alle():
        if status_in and e.get("status") not in status_in:
            continue
        if kunde and (e.get("kunde", "").lower() != kunde.lower()):
            continue
        bd = e.get("bestelldatum", "")
        if bestelldatum_von and bd and bd < bestelldatum_von:
            continue
        if bestelldatum_bis and bd and bd > bestelldatum_bis:
            continue
        if q:
            hay = " ".join([
                e.get("aw_nummer", ""),
                e.get("kunde", ""),
                e.get("artikel_nummer", ""),
                e.get("bemerkung", ""),
            ]).lower()
            if q not in hay:
                continue
        out.append(e)
    return out


def stats() -> dict[str, int]:
    """Spec §9 KPIs."""
    from datetime import timedelta
    heute = date.today()
    grenze_30 = (heute - timedelta(days=30)).isoformat()
    s = {"offen": 0, "in_arbeit": 0,
          "abgeschlossen_30T": 0, "storniert_30T": 0}
    for e in _read_raw():
        st_ = e.get("status", "")
        if st_ == "offen":
            s["offen"] += 1
        elif st_ == "in_arbeit":
            s["in_arbeit"] += 1
        elif st_ == "abgeschlossen":
            if (e.get("geaendert_am", "")[:10]) >= grenze_30:
                s["abgeschlossen_30T"] += 1
        elif st_ == "storniert":
            if (e.get("geaendert_am", "")[:10]) >= grenze_30:
                s["storniert_30T"] += 1
    return s


def alle_kunden() -> list[str]:
    """Distinct Kunden fuer Dropdown."""
    out = set()
    for e in _read_raw():
        k = (e.get("kunde", "") or "").strip()
        if k:
            out.add(k)
    return sorted(out)
