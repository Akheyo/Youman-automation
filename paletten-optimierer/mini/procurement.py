"""Beschaffungs-Aufträge (Spec §10).

Getrennt von 'orders' (Verkauf an Kunden). Beschaffung = Bestellung
beim Lieferanten zum Auffuellen des Bestands.

Schema 'procurement_orders' (JSON-Store):
  {
    "id": "uuid",
    "lieferant": str,
    "datum_erstellt": ISO,
    "datum_geplant": ISO,
    "datum_wareneingang": ISO | "",
    "status": "offen" | "bestellt" | "wareneingang" | "storniert",
    "positionen": [
       {"palette_id": str, "snapshot": dict, "menge": int,
        "ek_pro_stk_eur": float, "kommentar": str},
       ...
    ],
    "summe_eur": float,
    "buchungsmodus": "wareneingang" | "sofort",
    "notiz": str,
  }

Effekt auf Bestand:
- Default-Buchungsmodus 'wareneingang': bestand += menge erst nach
  Status 'wareneingang' + Datum gesetzt
- Modus 'sofort': bestand += menge direkt bei Anlage
- Solange offen/bestellt: palette.bestand_bestellt += menge
  (= 'in Anlieferung')
"""
from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any


STATUS_ERLAUBT = {"offen", "bestellt", "wareneingang", "storniert"}
BUCHUNGSMODUS = {"wareneingang", "sofort"}


def _pfad() -> Path:
    env = os.environ.get("PALETTENMINI_BESCHAFFUNG")
    if env:
        return Path(env)
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home()))) / "PalettenMini"
    else:
        base = Path.home() / ".palettenmini"
    base.mkdir(parents=True, exist_ok=True)
    return base / "beschaffungen.json"


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
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(eintraege, ensure_ascii=False, indent=2),
                    encoding="utf-8")
    tmp.replace(p)


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def neuer_auftrag(*, katalog_modul,
                   lieferant: str,
                   positionen: list[dict],
                   datum_geplant: str = "",
                   buchungsmodus: str = "wareneingang",
                   notiz: str = "") -> dict[str, Any]:
    """Legt einen neuen Beschaffungs-Auftrag an.

    positionen = [{palette_id, menge, ek_pro_stk_eur, kommentar}, ...]
    Snapshot pro Position wird hier eingefroren.

    Erhoeht bei Modus 'wareneingang' (default) die palette.bestand_bestellt
    um Σ menge. Bei Modus 'sofort' wird palette.bestand direkt erhoeht
    (kein bestand_bestellt-Tracking).
    """
    if buchungsmodus not in BUCHUNGSMODUS:
        buchungsmodus = "wareneingang"
    eid = uuid.uuid4().hex
    aufgeloest = []
    summe = 0.0
    eintraege_kat = {e["id"]: e for e in katalog_modul.alle()}
    for pos in positionen:
        pid = pos.get("palette_id")
        if not pid or pid not in eintraege_kat:
            continue
        k = eintraege_kat[pid]
        menge = int(pos.get("menge", 0))
        if menge < 1:
            continue
        ek = float(pos.get("ek_pro_stk_eur",
                              k.get("einkaufspreis_eur", 0)) or 0)
        snap = {
            "name": k.get("name", ""),
            "L_mm": int(k.get("L_mm", 0)),
            "B_mm": int(k.get("B_mm", 0)),
            "hoehe_mm": int(k.get("hoehe_mm", 0)),
        }
        aufgeloest.append({
            "palette_id": pid,
            "snapshot": snap,
            "menge": menge,
            "ek_pro_stk_eur": ek,
            "kommentar": str(pos.get("kommentar", "")),
        })
        summe += ek * menge
        # Effekt auf Bestand
        if buchungsmodus == "sofort":
            katalog_modul.aendere_bestand(pid, +menge)
        else:
            # bestand_bestellt += menge
            akt = int(k.get("bestand_bestellt", 0) or 0)
            katalog_modul.update_eintrag(pid, bestand_bestellt=akt + menge)
    eintrag = {
        "id": eid,
        "lieferant": str(lieferant or ""),
        "datum_erstellt": _now(),
        "datum_geplant": str(datum_geplant or ""),
        "datum_wareneingang": "",
        "status": "offen",
        "positionen": aufgeloest,
        "summe_eur": round(summe, 2),
        "buchungsmodus": buchungsmodus,
        "notiz": str(notiz),
    }
    h = _read_raw()
    h.append(eintrag)
    _write_raw(h)
    return {"id": eid, "ok": len(aufgeloest) > 0,
            "positionen": len(aufgeloest), "summe_eur": eintrag["summe_eur"]}


def update_status(auftrag_id: str, neu_status: str,
                   *, katalog_modul,
                   datum_wareneingang: str = "") -> dict[str, Any]:
    """Status setzen. Beim Wechsel auf 'wareneingang' (Modus='wareneingang')
    wird Bestand erhoeht und bestand_bestellt reduziert."""
    if neu_status not in STATUS_ERLAUBT:
        return {"ok": False, "fehler": f"Status '{neu_status}' ungueltig"}
    h = _read_raw()
    for a in h:
        if a.get("id") != auftrag_id:
            continue
        alt = a.get("status")
        if alt == neu_status:
            return {"ok": True, "fehler": "kein-wechsel"}
        # Übergänge mit Buchung
        if (neu_status == "wareneingang" and alt != "wareneingang"
                and a.get("buchungsmodus") == "wareneingang"):
            for pos in a["positionen"]:
                pid = pos.get("palette_id")
                if not pid:
                    continue
                m = int(pos.get("menge", 0))
                katalog_modul.aendere_bestand(pid, +m)
                # bestand_bestellt -= m (mind. 0)
                kat_e = next((x for x in katalog_modul.alle()
                              if x["id"] == pid), None)
                if kat_e:
                    aktuell = int(kat_e.get("bestand_bestellt", 0) or 0)
                    katalog_modul.update_eintrag(
                        pid, bestand_bestellt=max(0, aktuell - m)
                    )
            a["datum_wareneingang"] = datum_wareneingang or date.today().isoformat()
        # Stornierung: bestand_bestellt zuruecksetzen wenn vorher offen/bestellt
        if neu_status == "storniert" and a.get("buchungsmodus") == "wareneingang":
            for pos in a["positionen"]:
                pid = pos.get("palette_id")
                if not pid:
                    continue
                m = int(pos.get("menge", 0))
                kat_e = next((x for x in katalog_modul.alle()
                              if x["id"] == pid), None)
                if kat_e:
                    aktuell = int(kat_e.get("bestand_bestellt", 0) or 0)
                    katalog_modul.update_eintrag(
                        pid, bestand_bestellt=max(0, aktuell - m)
                    )
        a["status"] = neu_status
        _write_raw(h)
        return {"ok": True, "fehler": ""}
    return {"ok": False, "fehler": "auftrag-nicht-gefunden"}


def alle() -> list[dict[str, Any]]:
    return sorted(_read_raw(),
                   key=lambda e: e.get("datum_erstellt", ""), reverse=True)


def offene() -> list[dict[str, Any]]:
    return [e for e in _read_raw()
            if e.get("status") in ("offen", "bestellt")]


def loesche_eintrag(eintrag_id: str) -> bool:
    h = _read_raw()
    neu = [e for e in h if e.get("id") != eintrag_id]
    if len(neu) == len(h):
        return False
    _write_raw(neu)
    return True


# ---------------------------------------------------------------------------
# PDF-Export (Spec §10) — als Text/HTML, kein externes Dep
# ---------------------------------------------------------------------------
def als_text(auftrag: dict) -> str:
    """Liefert eine Plain-Text-Variante des Beschaffungs-Auftrags
    fuer Druck/PDF/Export."""
    zeilen = []
    zeilen.append(f"Beschaffungsauftrag {auftrag['id'][:8]}")
    zeilen.append(f"=" * 60)
    zeilen.append(f"Lieferant: {auftrag.get('lieferant', '—')}")
    zeilen.append(f"Erstellt:  {auftrag.get('datum_erstellt', '—')}")
    if auftrag.get("datum_geplant"):
        zeilen.append(f"Geplant:   {auftrag['datum_geplant']}")
    zeilen.append(f"Status:    {auftrag.get('status', '—')}")
    zeilen.append("")
    zeilen.append(f"{'Pos.':<5}{'Palette':<30}{'Menge':>8}"
                   f"{'EK/Stk':>10}{'Summe':>12}")
    zeilen.append("-" * 65)
    for i, pos in enumerate(auftrag.get("positionen", []), 1):
        snap = pos.get("snapshot", {})
        name = (f"{snap.get('name', '')} "
                f"{snap.get('L_mm', 0)}×{snap.get('B_mm', 0)}").strip()
        menge = int(pos.get("menge", 0))
        ek = float(pos.get("ek_pro_stk_eur", 0))
        s = menge * ek
        zeilen.append(f"{i:<5}{name:<30}{menge:>8}"
                       f"{ek:>10.2f}{s:>12.2f}")
    zeilen.append("-" * 65)
    zeilen.append(f"{'Summe gesamt:':>53} {auftrag.get('summe_eur', 0):>10.2f} €")
    if auftrag.get("notiz"):
        zeilen.append("")
        zeilen.append(f"Notiz: {auftrag['notiz']}")
    return "\n".join(zeilen)
