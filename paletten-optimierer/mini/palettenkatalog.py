"""Palettenkatalog — vom Nutzer gepflegte Paletten-Maße mit Bestand,
EK/VK, Verbrauchshäufigkeit. Persistent im User-Profil.

Pfad:
  Windows:    %APPDATA%/PalettenMini/palettenkatalog.json
  Linux/Mac:  ~/.palettenmini/palettenkatalog.json
  ENV-Override: PALETTENMINI_KATALOG

Schema pro Eintrag (Spec §5):
  {
    "id": "uuid-hex",
    "datum_erstellt": "ISO8601",
    "datum_geaendert": "ISO8601",       # last update
    "name": str,                         # z.B. "Europalette"
    "L_mm": int,                         # Lange Seite (kanonisch: lang >= kurz)
    "B_mm": int,                         # Kurze Seite
    "hoehe_mm": int,                     # optional (0 = unbekannt)
    "einkaufspreis_eur": float,
    "verkaufspreis_eur": float,
    "bestand": int,                      # aktueller Lagerbestand (Stueck)
    "meldebestand": int,                 # ab diesem Bestand wird gewarnt
    "typ": str,                          # "standard" | "sonder" | "kombi-teil"
    "quelle": str,                       # "manuell" | "auto_aus_optimierung"
    "verbrauchshaeufigkeit": int,        # +1 pro Bestellung-getaetigt
    "notiz": str,                        # optional
    "aktiv": bool
  }

Backward-kompatibel: alte JSON-Eintraege ohne neue Felder werden mit
sinnvollen Defaults aufgefuellt (typ="standard", quelle="manuell",
name="", hoehe_mm=0, verbrauchshaeufigkeit=0).

Robust: korrupte/fehlende Datei -> [] (kein Crash).
"""
from __future__ import annotations

import csv
import io
import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any


def _katalog_pfad() -> Path:
    env = os.environ.get("PALETTENMINI_KATALOG")
    if env:
        return Path(env)
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "PalettenMini"
    else:
        base = Path.home() / ".palettenmini"
    base.mkdir(parents=True, exist_ok=True)
    return base / "palettenkatalog.json"


def katalog_pfad_str() -> str:
    return str(_katalog_pfad())


def _read_raw() -> list[dict[str, Any]]:
    p = _katalog_pfad()
    if not p.exists():
        return []
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            return []
        # Migration: alten Eintraegen fehlende Felder auffuellen
        for e in data:
            _migriere_eintrag(e)
        return data
    except (OSError, json.JSONDecodeError):
        return []


def _migriere_eintrag(e: dict[str, Any]) -> None:
    """Erweitert alte Eintraege um neue Felder ohne sie zu ueberschreiben."""
    e.setdefault("name", "")
    e.setdefault("hoehe_mm", 0)
    e.setdefault("typ", "standard")
    e.setdefault("quelle", "manuell")
    e.setdefault("verbrauchshaeufigkeit", 0)
    e.setdefault("bestand", 0)
    e.setdefault("bestand_bestellt", 0)  # Spec §5 (in Anlieferung)
    e.setdefault("meldebestand", 0)
    e.setdefault("notiz", "")
    e.setdefault("aktiv", True)
    e.setdefault("einkaufspreis_eur", 0.0)
    e.setdefault("verkaufspreis_eur", 0.0)
    e.setdefault("datum_geaendert", e.get("datum_erstellt", ""))


def _write_raw(eintraege: list[dict[str, Any]]) -> None:
    p = _katalog_pfad()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(eintraege, ensure_ascii=False, indent=2),
                 encoding="utf-8")


def _kanon(L: float, B: float) -> tuple[int, int]:
    """Kanonische Form (lang, kurz)."""
    a, b = int(round(L)), int(round(B))
    return (max(a, b), min(a, b))


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


_TYP_ERLAUBT = {"standard", "sonder", "kombi-teil"}
_QUELLE_ERLAUBT = {"manuell", "auto_aus_optimierung"}


def neuer_eintrag(L: int, B: int,
                   einkaufspreis: float = 0.0,
                   verkaufspreis: float = 0.0,
                   bestand: int = 0,
                   meldebestand: int = 0,
                   notiz: str = "",
                   aktiv: bool = True,
                   name: str = "",
                   hoehe_mm: int = 0,
                   typ: str = "standard",
                   quelle: str = "manuell",
                   verbrauchshaeufigkeit: int = 0,
                   bestand_bestellt: int = 0) -> str:
    """Fuegt einen neuen Katalog-Eintrag hinzu. Maß wird kanonisiert.
    Liefert die id."""
    L_k, B_k = _kanon(L, B)
    if typ not in _TYP_ERLAUBT:
        typ = "standard"
    if quelle not in _QUELLE_ERLAUBT:
        quelle = "manuell"
    eid = uuid.uuid4().hex
    jetzt = _now()
    eintrag = {
        "id": eid,
        "datum_erstellt": jetzt,
        "datum_geaendert": jetzt,
        "name": str(name),
        "L_mm": L_k,
        "B_mm": B_k,
        "hoehe_mm": int(max(0, hoehe_mm)),
        "einkaufspreis_eur": float(einkaufspreis),
        "verkaufspreis_eur": float(verkaufspreis),
        "bestand": int(max(0, bestand)),
        "bestand_bestellt": int(max(0, bestand_bestellt)),
        "meldebestand": int(max(0, meldebestand)),
        "typ": typ,
        "quelle": quelle,
        "verbrauchshaeufigkeit": int(max(0, verbrauchshaeufigkeit)),
        "notiz": str(notiz),
        "aktiv": bool(aktiv),
    }
    h = _read_raw()
    h.append(eintrag)
    _write_raw(h)
    return eid


def update_eintrag(eintrag_id: str, **felder) -> bool:
    """Aktualisiert ein paar Felder."""
    erlaubt = {"L_mm", "B_mm", "einkaufspreis_eur",
               "verkaufspreis_eur", "bestand", "bestand_bestellt",
               "meldebestand",
               "notiz", "aktiv", "name", "hoehe_mm", "typ", "quelle",
               "verbrauchshaeufigkeit"}
    h = _read_raw()
    for e in h:
        if e.get("id") == eintrag_id:
            for k, v in felder.items():
                if k in erlaubt:
                    if k in ("bestand", "bestand_bestellt", "meldebestand",
                             "verbrauchshaeufigkeit", "hoehe_mm"):
                        v = int(max(0, int(v)))
                    if k == "typ" and v not in _TYP_ERLAUBT:
                        continue
                    if k == "quelle" and v not in _QUELLE_ERLAUBT:
                        continue
                    e[k] = v
            if "L_mm" in felder or "B_mm" in felder:
                L_k, B_k = _kanon(e.get("L_mm", 0), e.get("B_mm", 0))
                e["L_mm"], e["B_mm"] = L_k, B_k
            e["datum_geaendert"] = _now()
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
    """Alle Eintraege, neueste zuerst."""
    h = _read_raw()
    return sorted(h, key=lambda e: e.get("datum_erstellt", ""), reverse=True)


def aktive_masse() -> list[tuple[int, int]]:
    """Liefert die aktiven Maße als (kurz, lang)-Tupel — passt zum Kern."""
    return [(min(e["L_mm"], e["B_mm"]), max(e["L_mm"], e["B_mm"]))
            for e in _read_raw() if e.get("aktiv", True)]


def vollstaendig(e: dict[str, Any]) -> bool:
    """Spec §5: 'vollständig' = EK > 0 UND VK > 0."""
    return (float(e.get("einkaufspreis_eur", 0) or 0) > 0
            and float(e.get("verkaufspreis_eur", 0) or 0) > 0)


def unvollstaendige() -> list[dict[str, Any]]:
    """Aktive Eintraege ohne EK oder VK — fuer Banner '§5'."""
    return [e for e in _read_raw()
            if e.get("aktiv", True) and not vollstaendig(e)]


def lookup_preise(L: int, B: int) -> dict | None:
    """Liefert Preise + Bestand + ID fuer ein Maß (kanonisch matchend)."""
    cs_q, cl_q = min(L, B), max(L, B)
    for e in _read_raw():
        if not e.get("aktiv", True):
            continue
        cs, cl = min(e["L_mm"], e["B_mm"]), max(e["L_mm"], e["B_mm"])
        if cs == cs_q and cl == cl_q:
            return {
                "einkaufspreis_eur": float(e.get("einkaufspreis_eur", 0.0)),
                "verkaufspreis_eur": float(e.get("verkaufspreis_eur", 0.0)),
                "bestand": int(e.get("bestand", 0)),
                "verbrauchshaeufigkeit": int(e.get("verbrauchshaeufigkeit", 0)),
                "name": e.get("name", ""),
                "notiz": e.get("notiz", ""),
                "id": e.get("id", ""),
                "typ": e.get("typ", "standard"),
            }
    return None


def lookup_id(L: int, B: int) -> str | None:
    """Liefert die id eines aktiven Eintrags fuer das Maß."""
    p = lookup_preise(L, B)
    return p["id"] if p else None


def set_bestand(eintrag_id: str, neu_bestand: int) -> bool:
    """Setzt den Bestand absolut. Negative Werte werden auf 0 geclampt."""
    return update_eintrag(eintrag_id, bestand=int(max(0, neu_bestand)))


def aendere_bestand(eintrag_id: str, delta: int) -> int | None:
    """Erhoeht/vermindert den Bestand um delta. Bestand DARF negativ
    werden (Vormerkung, Spec §12). Liefert neuen Bestand oder None."""
    h = _read_raw()
    for e in h:
        if e.get("id") == eintrag_id:
            neu = int(e.get("bestand", 0)) + int(delta)
            e["bestand"] = neu
            e["datum_geaendert"] = _now()
            _write_raw(h)
            return neu
    return None


def inkrement_verbrauch(eintrag_id: str, delta: int = 1) -> int | None:
    """Erhoeht Verbrauchshäufigkeit. Liefert neuen Wert oder None."""
    h = _read_raw()
    for e in h:
        if e.get("id") == eintrag_id:
            neu = int(e.get("verbrauchshaeufigkeit", 0)) + int(delta)
            e["verbrauchshaeufigkeit"] = max(0, neu)
            e["datum_geaendert"] = _now()
            _write_raw(h)
            return e["verbrauchshaeufigkeit"]
    return None


def kritische_bestaende() -> list[dict[str, Any]]:
    """Liefert alle aktiven Eintraege, bei denen Bestand <= Meldebestand
    und Meldebestand > 0."""
    out = []
    for e in _read_raw():
        if not e.get("aktiv", True):
            continue
        m = int(e.get("meldebestand", 0) or 0)
        b = int(e.get("bestand", 0) or 0)
        if m > 0 and b <= m:
            out.append(e)
    return out


def leere_katalog() -> int:
    h = _read_raw()
    n = len(h)
    _write_raw([])
    return n


# ---------------------------------------------------------------------------
# CSV-Import/Export (Spec §5)
# ---------------------------------------------------------------------------
CSV_SPALTEN = ("name", "laenge", "breite", "hoehe",
               "bestand", "meldebestand", "ek", "vk",
               "typ", "notiz")


def nach_csv() -> str:
    """Exportiert alle Eintraege als CSV-String (UTF-8, Semikolon).
    Spalten: name;laenge;breite;hoehe;bestand;meldebestand;ek;vk;typ;notiz"""
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", lineterminator="\n")
    w.writerow(CSV_SPALTEN)
    for e in _read_raw():
        w.writerow([
            e.get("name", ""),
            int(e.get("L_mm", 0)),
            int(e.get("B_mm", 0)),
            int(e.get("hoehe_mm", 0)),
            int(e.get("bestand", 0)),
            int(e.get("meldebestand", 0)),
            f"{float(e.get('einkaufspreis_eur', 0)):.2f}",
            f"{float(e.get('verkaufspreis_eur', 0)):.2f}",
            e.get("typ", "standard"),
            e.get("notiz", ""),
        ])
    return buf.getvalue()


def aus_csv(text: str, ersetze_alles: bool = False) -> dict[str, Any]:
    """Liest CSV (UTF-8, Semikolon oder Komma).
    Pflichtspalten: name, laenge, breite, bestand.
    Optional: hoehe, meldebestand, ek, vk, typ, notiz.
    Liefert dict mit 'importiert', 'fehler', 'gesamt'.
    Spec §12: klare Fehlermeldung bei fehlenden Spalten."""
    if not text or not text.strip():
        return {"importiert": 0, "fehler": ["Leere Datei"], "gesamt": 0}
    # Trenner-Sniff
    erste_zeile = text.splitlines()[0]
    delim = ";" if erste_zeile.count(";") >= erste_zeile.count(",") else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delim)
    header = [h.strip().lower() for h in (reader.fieldnames or [])]
    reader.fieldnames = header  # normalisiere
    pflicht = {"name", "laenge", "breite", "bestand"}
    fehlend = pflicht - set(header)
    if fehlend:
        return {"importiert": 0,
                "fehler": [f"Pflichtspalten fehlen: {sorted(fehlend)}. "
                            f"Erwartet: {sorted(pflicht)}, gefunden: {header}"],
                "gesamt": 0}

    if ersetze_alles:
        _write_raw([])

    importiert, fehler = 0, []
    for i, row in enumerate(reader, start=2):  # Zeile 2 = erste Datenzeile
        try:
            name = (row.get("name") or "").strip()
            L = int(float((row.get("laenge") or "0").replace(",", ".")))
            B = int(float((row.get("breite") or "0").replace(",", ".")))
            bestand = int(float((row.get("bestand") or "0").replace(",", ".")))
            if L <= 0 or B <= 0:
                raise ValueError(f"Zeile {i}: L/B muss > 0 sein ({L}/{B})")
            hoehe = int(float((row.get("hoehe") or "0").replace(",", ".")))
            meld = int(float((row.get("meldebestand") or "0").replace(",", ".")))
            ek = float((row.get("ek") or "0").replace(",", "."))
            vk = float((row.get("vk") or "0").replace(",", "."))
            typ = (row.get("typ") or "standard").strip().lower()
            if typ not in _TYP_ERLAUBT:
                typ = "standard"
            notiz = (row.get("notiz") or "").strip()
            neuer_eintrag(L, B,
                          einkaufspreis=ek, verkaufspreis=vk,
                          bestand=bestand, meldebestand=meld,
                          notiz=notiz, name=name, hoehe_mm=hoehe,
                          typ=typ, quelle="manuell")
            importiert += 1
        except Exception as exc:
            fehler.append(f"Zeile {i}: {exc}")
    return {"importiert": importiert, "fehler": fehler,
            "gesamt": importiert + len(fehler)}


def als_sonder_uebernehmen(L: int, B: int, hoehe_mm: int = 0,
                            name: str = "") -> str:
    """Spec §6b: legt einen neuen Eintrag fuer eine Sonder-/Kombi-Größe
    aus der Optimierung an — typ='sonder', quelle='auto_aus_optimierung',
    bestand=0, EK/VK leer (unvollstaendig). Liefert die id."""
    L_k, B_k = _kanon(L, B)
    if not name:
        name = f"Sonder {L_k}×{B_k}"
    return neuer_eintrag(
        L_k, B_k,
        einkaufspreis=0.0, verkaufspreis=0.0,
        bestand=0, meldebestand=0,
        notiz="Auto aus Optimierung — EK/VK nachtragen",
        name=name, hoehe_mm=hoehe_mm,
        typ="sonder", quelle="auto_aus_optimierung",
    )
