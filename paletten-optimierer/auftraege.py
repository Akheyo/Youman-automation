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
    e.setdefault("import_key", "")
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
                   quelle: str = "manuell",
                   erlaube_aw_duplikat: bool = False,
                   import_key: str = "") -> dict[str, Any]:
    """Legt einen neuen Auftrag an. Wenn aw_nummer leer → auto-Nummer.
    erlaube_aw_duplikat=True (Excel-Import, Positions-Ebene): mehrere
    Positionen duerfen dieselbe AW tragen."""
    aw = (aw_nummer or "").strip() or _next_aw_nummer()
    # Spec §5 + §6: AW-Duplikat-Check (nur bei manueller Anlage)
    if not erlaube_aw_duplikat and finde_per_aw(aw):
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
        "import_key": str(import_key or ""),
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
def _aw_key(zeile: dict) -> str:
    """Auftragsnummer (AW) einer Excel-Zeile. Fehlt sie, wird ein stabiler
    Inhalts-Schluessel verwendet (damit auch AW-lose Zeilen idempotent sind)."""
    aw = (zeile.get("auftrag") or zeile.get("aw_nummer") or "").strip()
    if aw:
        return aw
    import hashlib
    sig = hashlib.md5(repr(_zeile_fingerprint(zeile)).encode()).hexdigest()[:10]
    return "AUTO:" + sig


def _zeile_fingerprint(zeile: dict) -> tuple:
    """Inhalts-Fingerabdruck EINER Position (alle fachlich relevanten Felder).
    Aenderung an irgendeinem Feld => anderer Fingerabdruck => Auftrag gilt als
    geaendert."""
    return (
        str(zeile.get("artikelnummer") or zeile.get("artikel_nummer") or ""),
        str(zeile.get("name") or zeile.get("kunde") or ""),
        int(zeile.get("anzahl") or zeile.get("menge") or 0),
        int(zeile.get("laenge") or zeile.get("L") or 0),
        int(zeile.get("breite") or zeile.get("B") or 0),
        int(zeile.get("hoehe") or 0),
        str(zeile.get("verbrauchsdatum") or ""),
        str(zeile.get("bestelldatum", "") or ""),
    )


def _eintrag_fingerprint(e: dict) -> tuple:
    """Wie _zeile_fingerprint, aber fuer einen gespeicherten Auftrag — exakt
    gleiche Feldreihenfolge, damit Alt/Neu vergleichbar sind."""
    ang = e.get("angeforderte_palette", {}) or {}
    return (
        str(e.get("artikel_nummer") or ""),
        str(e.get("kunde") or ""),
        int(e.get("menge") or 0),
        int(ang.get("l") or 0),
        int(ang.get("b") or 0),
        int(ang.get("h") or 0),
        str(e.get("verbrauchsdatum") or ""),
        str(e.get("bestelldatum", "") or ""),
    )


def upsert_aus_excel(zeilen: list[dict]) -> dict[str, Any]:
    """Import auf Auftragsnummer-Ebene (AW). Eine AW kann mehrere Positionen
    haben (mehrere Excel-Zeilen). Regeln:
      - AW neu                       -> anlegen
      - AW vorhanden, NICHTS geaendert -> ueberspringen (kein Duplikat)
      - AW vorhanden, etwas geaendert  -> alten Auftrag (alle Positionen
                                          dieser AW) ersetzen
    Exakte Dubletten innerhalb derselben AW im selben Import werden kollabiert.
    Ein einziger Schreibvorgang. Liefert
    {neu, ersetzt, unveraendert, vorhanden, fehler, ids}."""
    from collections import Counter, defaultdict

    h = _read_raw()
    jetzt = _now()

    # Bestehende nach AW gruppieren + Signatur (Multiset der Fingerprints)
    best_nach_aw: dict[str, list[dict]] = defaultdict(list)
    for e in h:
        best_nach_aw[str(e.get("aw_nummer") or "")].append(e)
    best_sig: dict[str, Counter] = {
        aw: Counter(_eintrag_fingerprint(e) for e in lst)
        for aw, lst in best_nach_aw.items()
    }

    # Eingehende nach AW gruppieren, exakte Dubletten je AW kollabieren
    eingehend: dict[str, list[dict]] = defaultdict(list)
    eingehend_sig: dict[str, Counter] = defaultdict(Counter)
    reihenfolge: list[str] = []
    for z in zeilen:
        awk = _aw_key(z)
        fp = _zeile_fingerprint(z)
        if awk not in eingehend:
            reihenfolge.append(awk)
        if eingehend_sig[awk][fp] >= 1:
            continue  # exakte Dublette derselben AW -> verwerfen
        eingehend_sig[awk][fp] += 1
        eingehend[awk].append(z)

    # Entscheidung je AW: neu / unveraendert / ersetzen
    aws_unveraendert = {awk for awk in eingehend
                        if awk in best_sig
                        and best_sig[awk] == eingehend_sig[awk]}
    aws_ersetzen = {awk for awk in eingehend
                    if awk in best_sig and awk not in aws_unveraendert}

    # Neue Liste: alle Bestehenden ausser denen ersetzter AWs
    neue_liste = [e for e in h
                  if str(e.get("aw_nummer") or "") not in aws_ersetzen]

    neu = ersetzt = unveraendert = fehler = 0
    ids: list[str] = []
    for awk in reihenfolge:
        if awk in aws_unveraendert:
            unveraendert += 1
            continue
        ist_ersatz = awk in aws_ersetzen
        aw_anzeige = (eingehend[awk][0].get("auftrag")
                      or eingehend[awk][0].get("aw_nummer") or "").strip()
        if not aw_anzeige:
            aw_anzeige = awk  # AUTO:... als Anzeige
        for z in eingehend[awk]:
            eid = uuid.uuid4().hex
            neue_liste.append({
                "id": eid,
                "aw_nummer": aw_anzeige,
                "kunde": str(z.get("name") or z.get("kunde") or ""),
                "artikel_nummer": str(z.get("artikelnummer")
                                       or z.get("artikel_nummer") or ""),
                "menge": int(max(0, int(z.get("anzahl")
                                        or z.get("menge") or 0))),
                "angeforderte_palette": {
                    "l": int(max(0, int(z.get("laenge") or z.get("L") or 0))),
                    "b": int(max(0, int(z.get("breite") or z.get("B") or 0))),
                    "h": int(max(0, int(z.get("hoehe") or 0))),
                },
                "zugewiesene_palette_id": None,
                "bestelldatum": str(z.get("bestelldatum", "") or ""),
                "verbrauchsdatum": str(z.get("verbrauchsdatum") or ""),
                "verlinkte_bestellung_id": None,
                "status": "offen",
                "status_manuell_gesetzt": False,
                "status_grund": "",
                "bemerkung": "",
                "import_key": awk,
                "quelle": "excel_import",
                "erstellt_am": jetzt,
                "geaendert_am": jetzt,
            })
            ids.append(eid)
        if ist_ersatz:
            ersetzt += 1
        else:
            neu += 1

    if neu or ersetzt:
        _write_raw(neue_liste)
    return {"neu": neu, "ersetzt": ersetzt, "unveraendert": unveraendert,
            "vorhanden": unveraendert, "fehler": fehler, "ids": ids}


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
    """Spec §4 Filter + AW-priorisierte Suche (Bug-Fix)."""
    q = (suche or "").strip().lower()
    # 1) Basis-Filter (Status / Kunde / Datum)
    basis = []
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
        basis.append(e)
    if not q:
        return basis

    def _aw(e):
        return (e.get("aw_nummer", "") or "").strip().lower()

    # 2) Sieht der Begriff wie eine AW-Nummer aus -> NUR aw_nummer matchen,
    #    und ein EXAKTER Treffer gewinnt (kein Rauschen aus 'AW-...-0050' o.
    #    aus artikel_nummer/kunde). Sonst Praefix-/Teilstring auf aw_nummer.
    if q.startswith("aw"):
        exakt = [e for e in basis if _aw(e) == q]
        if exakt:
            return exakt
        return [e for e in basis if q in _aw(e)]

    # 3) Allgemeine Multi-Field-Teilstringsuche (Kunde/ArtNr/Bemerkung/AW)
    out = []
    for e in basis:
        hay = " ".join([
            _aw(e),
            (e.get("kunde", "") or "").lower(),
            (e.get("artikel_nummer", "") or "").lower(),
            (e.get("bemerkung", "") or "").lower(),
        ])
        if q in hay:
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
