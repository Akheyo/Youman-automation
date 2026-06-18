"""Palettenkatalog — vom Nutzer gepflegte Paletten-Maße mit Bestand,
Bezugskosten, Verbrauchshäufigkeit. Persistent im User-Profil.

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
    e.setdefault("bestand_bestellt", 0)
    e.setdefault("meldebestand", 0)
    e.setdefault("notiz", "")
    e.setdefault("aktiv", True)
    e.setdefault("einkaufspreis_eur", 0.0)
    e.setdefault("verkaufspreis_eur", 0.0)
    e.setdefault("datum_geaendert", e.get("datum_erstellt", ""))
    # §1 Auto-Standard
    e.setdefault("auto_standard", False)
    e.setdefault("auto_standard_seit", "")
    e.setdefault("verwendet_in_laeufen", [])
    # §4 EK-Vergleich Lieferant vs. Selbstfertigung
    e.setdefault("ek_lieferant_eur",
                  float(e.get("einkaufspreis_eur", 0) or 0))
    e.setdefault("selbstfertigung_material_eur", 0.0)
    e.setdefault("selbstfertigung_lohn_eur", 0.0)
    e.setdefault("selbstfertigung_gesamt_eur", 0.0)
    e.setdefault("bezug_modus", "lieferant")  # lieferant|selbstfertigung|auto_guenstiger
    # §5 Lieferzeit pro Palette (Override gegenueber Lieferant-Default)
    e.setdefault("lieferzeit_tage_override", 0)
    e.setdefault("default_lieferant_id", "")


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
                   bestand_bestellt: int = 0,
                   auto_standard: bool = False,
                   auto_standard_seit: str = "",
                   ek_lieferant_eur: float | None = None,
                   selbstfertigung_material_eur: float = 0.0,
                   selbstfertigung_lohn_eur: float = 0.0,
                   bezug_modus: str = "lieferant",
                   lieferzeit_tage_override: int = 0,
                   default_lieferant_id: str = "") -> str:
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
        # §1
        "auto_standard": bool(auto_standard),
        "auto_standard_seit": str(auto_standard_seit or ""),
        "verwendet_in_laeufen": [],
        # §4
        "ek_lieferant_eur": (float(ek_lieferant_eur)
                              if ek_lieferant_eur is not None
                              else float(einkaufspreis)),
        "selbstfertigung_material_eur": float(
            max(0, selbstfertigung_material_eur)),
        "selbstfertigung_lohn_eur": float(max(0, selbstfertigung_lohn_eur)),
        "selbstfertigung_gesamt_eur": float(
            max(0, selbstfertigung_material_eur)
            + max(0, selbstfertigung_lohn_eur)),
        "bezug_modus": (bezug_modus
                         if bezug_modus in {"lieferant", "selbstfertigung",
                                               "auto_guenstiger"}
                         else "lieferant"),
        # §5
        "lieferzeit_tage_override": int(max(0, lieferzeit_tage_override)),
        "default_lieferant_id": str(default_lieferant_id or ""),
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
               "verbrauchshaeufigkeit",
               # §1
               "auto_standard", "auto_standard_seit",
               "verwendet_in_laeufen",
               # §4
               "ek_lieferant_eur", "selbstfertigung_material_eur",
               "selbstfertigung_lohn_eur", "selbstfertigung_gesamt_eur",
               "bezug_modus",
               # §5
               "lieferzeit_tage_override", "default_lieferant_id"}
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
    """'vollständig' = EK Lieferant > 0 UND Selbstfertigung (Material+Lohn)
    > 0 — d.h. beide Bezugswege sind gepflegt und können verglichen werden."""
    ek_lief = float(e.get("ek_lieferant_eur",
                              e.get("einkaufspreis_eur", 0)) or 0)
    eigen = (float(e.get("selbstfertigung_material_eur", 0) or 0)
              + float(e.get("selbstfertigung_lohn_eur", 0) or 0))
    return ek_lief > 0 and eigen > 0


def unvollstaendige() -> list[dict[str, Any]]:
    """Aktive Eintraege ohne komplette Bezugskosten — fuer Banner."""
    return [e for e in _read_raw()
            if e.get("aktiv", True) and not vollstaendig(e)]


def lookup_preise(L: int, B: int) -> dict | None:
    """Liefert Preise + Bestand + ID fuer ein Maß (kanonisch matchend).
    'verkaufspreis_eur' enthält jetzt die Selbstfertigungs-Gesamtkosten
    (Material+Lohn) — VK wurde durch Selbstfertigung ersetzt."""
    cs_q, cl_q = min(L, B), max(L, B)
    for e in _read_raw():
        if not e.get("aktiv", True):
            continue
        cs, cl = min(e["L_mm"], e["B_mm"]), max(e["L_mm"], e["B_mm"])
        if cs == cs_q and cl == cl_q:
            ek_lief = float(e.get("ek_lieferant_eur",
                                      e.get("einkaufspreis_eur", 0)) or 0)
            eigen = (float(e.get("selbstfertigung_material_eur", 0) or 0)
                      + float(e.get("selbstfertigung_lohn_eur", 0) or 0))
            return {
                "einkaufspreis_eur": ek_lief,
                "ek_lieferant_eur": ek_lief,
                "selbstfertigung_gesamt_eur": eigen,
                # Legacy: verkaufspreis_eur enthält jetzt Selbstfertigung
                "verkaufspreis_eur": eigen,
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
               "bestand", "meldebestand", "ek_lieferant",
               "selbstfert_material", "selbstfert_lohn",
               "typ", "notiz")


def nach_csv() -> str:
    """Exportiert alle Eintraege als CSV-String (UTF-8, Semikolon).
    Spalten: name;laenge;breite;hoehe;bestand;meldebestand;
             ek_lieferant;selbstfert_material;selbstfert_lohn;typ;notiz
    (VK wurde durch Selbstfertigungskosten ersetzt.)"""
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", lineterminator="\n")
    w.writerow(CSV_SPALTEN)
    for e in _read_raw():
        ek_lief = float(e.get("ek_lieferant_eur",
                                 e.get("einkaufspreis_eur", 0)) or 0)
        w.writerow([
            e.get("name", ""),
            int(e.get("L_mm", 0)),
            int(e.get("B_mm", 0)),
            int(e.get("hoehe_mm", 0)),
            int(e.get("bestand", 0)),
            int(e.get("meldebestand", 0)),
            f"{ek_lief:.2f}",
            f"{float(e.get('selbstfertigung_material_eur', 0)):.2f}",
            f"{float(e.get('selbstfertigung_lohn_eur', 0)):.2f}",
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
            # EK Lieferant: neuer Name 'ek_lieferant', Fallback 'ek'
            ek_lief = float((row.get("ek_lieferant")
                                or row.get("ek") or "0").replace(",", "."))
            sf_mat = float((row.get("selbstfert_material")
                                 or "0").replace(",", "."))
            sf_lohn = float((row.get("selbstfert_lohn")
                                 or "0").replace(",", "."))
            typ = (row.get("typ") or "standard").strip().lower()
            if typ not in _TYP_ERLAUBT:
                typ = "standard"
            notiz = (row.get("notiz") or "").strip()
            neuer_eintrag(L, B,
                          einkaufspreis=ek_lief, verkaufspreis=0.0,
                          ek_lieferant_eur=ek_lief,
                          selbstfertigung_material_eur=sf_mat,
                          selbstfertigung_lohn_eur=sf_lohn,
                          bestand=bestand, meldebestand=meld,
                          notiz=notiz, name=name, hoehe_mm=hoehe,
                          typ=typ, quelle="manuell")
            importiert += 1
        except Exception as exc:
            fehler.append(f"Zeile {i}: {exc}")
    return {"importiert": importiert, "fehler": fehler,
            "gesamt": importiert + len(fehler)}


# ---------------------------------------------------------------------------
# §3 Duplikat-Check
# ---------------------------------------------------------------------------
def finde_duplikat(L: int, B: int, hoehe_mm: int = 0) -> dict | None:
    """Liefert den ersten Eintrag mit gleichem (L, B, hoehe_mm) ODER None.
    Match-Kriterium kanonisch + Höhe exakt (Toleranz 0)."""
    cs_q, cl_q = min(int(L), int(B)), max(int(L), int(B))
    h_q = int(hoehe_mm or 0)
    for e in _read_raw():
        cs, cl = (min(e.get("L_mm", 0), e.get("B_mm", 0)),
                   max(e.get("L_mm", 0), e.get("B_mm", 0)))
        if cs == cs_q and cl == cl_q and int(e.get("hoehe_mm", 0)) == h_q:
            return e
    return None


# ---------------------------------------------------------------------------
# §1 Auto-Standard-Erkennung
# ---------------------------------------------------------------------------
def auto_standard_pruefen(letzte_laeufe: list[dict],
                            schwelle: int = 4) -> list[dict]:
    """Prüft die letzten N Optimierungen — falls dasselbe Maß in ≥ schwelle
    aufeinanderfolgenden Läufen als Standard genutzt wurde, markiert die
    zugehörige Palette automatisch als 'auto_standard=True'.

    letzte_laeufe = Liste von Verlauf-Einträgen mit
    optimierung.ergebnis_snapshot.standards. Reihenfolge: neueste zuerst.

    Liefert Liste der frisch erkannten/aktualisierten Paletten."""
    if schwelle < 2 or len(letzte_laeufe) < schwelle:
        return []
    # Aus den letzten N Läufen die Standards-Maße ziehen (kanonisch)
    masse_pro_lauf: list[set[tuple[int, int]]] = []
    lauf_ids: list[str] = []
    for e in letzte_laeufe[:schwelle]:
        opt = (e.get("optimierung") or {})
        snap = (opt.get("ergebnis_snapshot") or {})
        std_list = snap.get("standards") or []
        masse = set()
        for s in std_list:
            try:
                a, b = int(s[0]), int(s[1])
                masse.add((min(a, b), max(a, b)))
            except (TypeError, IndexError, ValueError):
                continue
        if not masse:
            return []  # luecke
        masse_pro_lauf.append(masse)
        lauf_ids.append(e.get("id", ""))
    # Schnittmenge — Maße, die in ALLEN N Läufen vorkommen
    konstant = set.intersection(*masse_pro_lauf) if masse_pro_lauf else set()
    if not konstant:
        return []
    aktualisiert = []
    from datetime import date as _date
    heute_str = _date.today().isoformat()
    h = _read_raw()
    for e in h:
        cs, cl = (min(e.get("L_mm", 0), e.get("B_mm", 0)),
                   max(e.get("L_mm", 0), e.get("B_mm", 0)))
        if (cs, cl) in konstant:
            war_schon = bool(e.get("auto_standard"))
            e["auto_standard"] = True
            if not war_schon:
                e["auto_standard_seit"] = heute_str
            # verwendet_in_laeufen-Liste pflegen (letzte N IDs)
            vorhanden = list(e.get("verwendet_in_laeufen") or [])
            for lid in lauf_ids:
                if lid and lid not in vorhanden:
                    vorhanden.append(lid)
            e["verwendet_in_laeufen"] = vorhanden[-20:]  # cap
            e["datum_geaendert"] = _now()
            aktualisiert.append(e)
    if aktualisiert:
        _write_raw(h)
    return aktualisiert


def auto_standards() -> list[dict]:
    """Liefert alle Katalog-Einträge mit auto_standard==True (aktiv)."""
    return [e for e in _read_raw()
            if e.get("aktiv", True) and e.get("auto_standard")]


def auto_standard_aufheben(eintrag_id: str) -> bool:
    """Manuelles Entfernen des Auto-Standard-Flags."""
    return update_eintrag(eintrag_id, auto_standard=False,
                           auto_standard_seit="",
                           verwendet_in_laeufen=[])


# ---------------------------------------------------------------------------
# §4 Bezugs-Empfehlung (Lieferant vs. Selbstfertigung)
# ---------------------------------------------------------------------------
def empfohlene_bezugskosten(e: dict) -> dict:
    """Liefert dict mit ek, bezug ('lieferant' | 'selbstfertigung'),
    diff, empfehlung-Text basierend auf bezug_modus."""
    ek_lief = float(e.get("ek_lieferant_eur",
                            e.get("einkaufspreis_eur", 0)) or 0)
    eigen = (float(e.get("selbstfertigung_material_eur", 0) or 0)
              + float(e.get("selbstfertigung_lohn_eur", 0) or 0))
    # cached field aktualisieren
    e["selbstfertigung_gesamt_eur"] = eigen
    modus = e.get("bezug_modus", "lieferant")
    if modus == "lieferant":
        return {"ek": ek_lief, "bezug": "lieferant",
                 "diff": eigen - ek_lief if eigen > 0 else 0.0,
                 "empfehlung": "Lieferant (fix)"}
    if modus == "selbstfertigung":
        return {"ek": eigen, "bezug": "selbstfertigung",
                 "diff": eigen - ek_lief if ek_lief > 0 else 0.0,
                 "empfehlung": "Selbstfertigung (fix)"}
    # auto_guenstiger
    if ek_lief <= 0 and eigen > 0:
        return {"ek": eigen, "bezug": "selbstfertigung",
                 "diff": 0.0,
                 "empfehlung": "Selbstfertigung (nur diese gepflegt)"}
    if eigen <= 0 and ek_lief > 0:
        return {"ek": ek_lief, "bezug": "lieferant",
                 "diff": 0.0,
                 "empfehlung": "Lieferant (Selbstfertigung nicht gepflegt)"}
    if eigen < ek_lief:
        return {"ek": eigen, "bezug": "selbstfertigung",
                 "diff": eigen - ek_lief,
                 "empfehlung": f"Selbstfertigung ({ek_lief - eigen:.2f} EUR billiger)"}
    return {"ek": ek_lief, "bezug": "lieferant",
             "diff": eigen - ek_lief,
             "empfehlung": f"Lieferant ({eigen - ek_lief:.2f} EUR billiger)"
                          if eigen > ek_lief else "Lieferant (gleichauf)"}


def als_sonder_uebernehmen(L: int, B: int, hoehe_mm: int = 0,
                            name: str = "") -> str:
    """Spec §6b: legt einen neuen Eintrag fuer eine Sonder-/Kombi-Größe
    aus der Optimierung an — typ='sonder', quelle='auto_aus_optimierung',
    bestand=0, Bezugskosten leer (unvollstaendig). Liefert die id."""
    L_k, B_k = _kanon(L, B)
    if not name:
        name = f"Sonder {L_k}×{B_k}"
    return neuer_eintrag(
        L_k, B_k,
        einkaufspreis=0.0, verkaufspreis=0.0,
        bestand=0, meldebestand=0,
        notiz="Auto aus Optimierung — EK Lieferant + Selbstfertigung nachtragen",
        name=name, hoehe_mm=hoehe_mm,
        typ="sonder", quelle="auto_aus_optimierung",
    )
