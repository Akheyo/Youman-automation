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


STATUS_ERLAUBT = {"offen", "bestellt", "unterwegs", "wareneingang",
                   "eingegangen", "storniert"}
BUCHUNGSMODUS = {"wareneingang", "sofort"}


# ---------------------------------------------------------------------------
# Auto-Nummerierung BST-YYYY-NNNN (Spec §3)
# ---------------------------------------------------------------------------
def _naechste_bst_nummer(jahr: int | None = None) -> str:
    """Liefert die nächste freie Nummer im Format BST-YYYY-NNNN.
    Zählt pro Jahr ab 0001."""
    if jahr is None:
        jahr = datetime.now().year
    prefix = f"BST-{jahr}-"
    max_nr = 0
    for e in _read_raw():
        bst = e.get("bst_nummer", "")
        if bst.startswith(prefix):
            try:
                nr = int(bst.split("-")[-1])
                if nr > max_nr:
                    max_nr = nr
            except (ValueError, IndexError):
                continue
    return f"{prefix}{max_nr + 1:04d}"


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
                   lieferant: str = "",
                   lieferant_id: str | None = None,
                   positionen: list[dict],
                   datum_geplant: str = "",
                   datum_bestellt: str = "",
                   buchungsmodus: str = "wareneingang",
                   bemerkung: str = "",
                   notiz: str = "",
                   user: str = "user") -> dict[str, Any]:
    """Legt einen neuen Beschaffungs-Auftrag an. Liefert
    {id, bst_nummer, ok, positionen, summe_eur}.

    positionen = [{palette_id, menge, ek_pro_stk_eur, kommentar}, ...]
    Snapshot pro Position wird hier eingefroren.

    Erhoeht bei Modus 'wareneingang' (default) die palette.bestand_bestellt
    um Σ menge. Bei Modus 'sofort' wird palette.bestand direkt erhoeht
    (kein bestand_bestellt-Tracking).
    """
    if buchungsmodus not in BUCHUNGSMODUS:
        buchungsmodus = "wareneingang"
    eid = uuid.uuid4().hex
    bst_nr = _naechste_bst_nummer()
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
            "id": uuid.uuid4().hex,
            "palette_id": pid,
            "snapshot": snap,
            "menge_bestellt": menge,
            "menge_geliefert": 0,
            "ek_pro_stk_eur": ek,
            "ek_summe": round(ek * menge, 2),
            "kommentar": str(pos.get("kommentar", "")),
            # §9: Mehrfach-AW-Zuordnung pro Position
            "verlinkte_aws": list(pos.get("verlinkte_aws", []) or []),
        })
        summe += ek * menge
        # Effekt auf Bestand
        if buchungsmodus == "sofort":
            katalog_modul.aendere_bestand(pid, +menge)
        else:
            akt = int(k.get("bestand_bestellt", 0) or 0)
            katalog_modul.update_eintrag(pid, bestand_bestellt=akt + menge)
    eintrag = {
        "id": eid,
        "bst_nummer": bst_nr,
        "lieferant": str(lieferant or ""),
        "lieferant_id": lieferant_id,
        "datum_erstellt": _now(),
        "datum_bestellt": str(datum_bestellt or ""),
        "datum_geplant": str(datum_geplant or ""),
        "datum_wareneingang": "",
        "tracking_nr": "",
        "status": "offen",
        "positionen": aufgeloest,
        "summe_netto_eur": round(summe, 2),
        "summe_brutto_eur": round(summe * 1.19, 2),  # 19% MwSt-Default
        "summe_eur": round(summe, 2),  # legacy alias
        "buchungsmodus": buchungsmodus,
        "bemerkung": str(bemerkung or ""),
        "notiz": str(notiz),
        "pdf_pfad": "",
        "audit_log": [{
            "datum": _now(),
            "action": "anlegen",
            "user": user,
            "details": {"positionen": len(aufgeloest), "summe": summe},
        }],
        "wareneingang_tokens": [],  # Idempotenz (§5)
        "created_by": user,
        "updated_at": _now(),
    }
    h = _read_raw()
    h.append(eintrag)
    _write_raw(h)
    return {"id": eid, "bst_nummer": bst_nr,
            "ok": len(aufgeloest) > 0,
            "positionen": len(aufgeloest),
            "summe_eur": eintrag["summe_netto_eur"]}


def _audit(eintrag: dict, action: str, user: str = "user",
            details: dict | None = None) -> None:
    eintrag.setdefault("audit_log", []).append({
        "datum": _now(),
        "action": action,
        "user": user,
        "details": details or {},
    })
    eintrag["updated_at"] = _now()


def _bereits_geliefert(pos: dict) -> int:
    """Helper: Σ menge_geliefert pro Position."""
    return int(pos.get("menge_geliefert", 0))


def _alle_positionen_voll_geliefert(positionen: list[dict]) -> bool:
    return all(_bereits_geliefert(p) >= int(p.get("menge_bestellt", 0))
                for p in positionen)


def update_status(auftrag_id: str, neu_status: str,
                   *, katalog_modul,
                   datum_wareneingang: str = "",
                   tracking_nr: str = "",
                   user: str = "user") -> dict[str, Any]:
    """Setzt Status. 'wareneingang'/'eingegangen' werden hier nur fuer
    Komplett-Eingang akzeptiert. Fuer Teilmengen verwende
    ``wareneingang_buchen()``."""
    if neu_status not in STATUS_ERLAUBT:
        return {"ok": False, "fehler": f"Status '{neu_status}' ungueltig"}
    h = _read_raw()
    for a in h:
        if a.get("id") != auftrag_id:
            continue
        alt = a.get("status")
        if alt == neu_status:
            return {"ok": True, "fehler": "kein-wechsel"}

        # Spec §5: Stornierung blockt wenn bereits Eingaenge gebucht
        if neu_status == "storniert":
            hat_eingaenge = any(_bereits_geliefert(p) > 0
                                  for p in a.get("positionen", []))
            if hat_eingaenge:
                return {"ok": False,
                         "fehler": ("Stornierung blockiert: bereits gebuchte "
                                    "Wareneingaenge vorhanden.")}

        # Komplett-Wareneingang (Alias fuer 'eingegangen')
        if neu_status in ("wareneingang", "eingegangen"):
            # Bucht alles, was noch offen ist
            erg = wareneingang_buchen(
                auftrag_id, positionen_mengen={
                    p["id"]: int(p.get("menge_bestellt", 0))
                            - _bereits_geliefert(p)
                    for p in a.get("positionen", [])
                },
                katalog_modul=katalog_modul,
                datum=datum_wareneingang,
                user=user,
                idempotenz_token=f"komplett-{auftrag_id}",
            )
            return erg

        # Storno: bestand_bestellt freigeben fuer noch nicht gelieferte Menge
        if (neu_status == "storniert"
                and a.get("buchungsmodus") == "wareneingang"):
            for pos in a["positionen"]:
                pid = pos.get("palette_id")
                rest = (int(pos.get("menge_bestellt", 0))
                         - _bereits_geliefert(pos))
                if not pid or rest <= 0:
                    continue
                kat_e = next((x for x in katalog_modul.alle()
                              if x["id"] == pid), None)
                if kat_e:
                    aktuell = int(kat_e.get("bestand_bestellt", 0) or 0)
                    katalog_modul.update_eintrag(
                        pid, bestand_bestellt=max(0, aktuell - rest)
                    )
        # Tracking-Nr bei 'unterwegs'
        if neu_status in ("unterwegs", "bestellt") and tracking_nr:
            a["tracking_nr"] = tracking_nr
        a["status"] = neu_status
        _audit(a, f"status_{neu_status}", user, {"alt": alt})
        _write_raw(h)
        return {"ok": True, "fehler": ""}
    return {"ok": False, "fehler": "auftrag-nicht-gefunden"}


def wareneingang_buchen(auftrag_id: str, *,
                          positionen_mengen: dict[str, int],
                          katalog_modul,
                          datum: str = "",
                          user: str = "user",
                          idempotenz_token: str = "") -> dict[str, Any]:
    """Bucht Teilmengen-Eingang. Atomar + idempotent.

    positionen_mengen: dict {position_id → menge_geliefert_diese_buchung}
    idempotenz_token: wird im Auftrag gemerkt, doppelter Aufruf mit
        gleichem Token wird ignoriert (Spec §5 Race-Condition).

    Auswirkungen:
    - palette.bestand += geliefert
    - palette.bestand_bestellt -= geliefert
    - pos.menge_geliefert += geliefert
    - status → 'eingegangen' wenn ALLE Positionen voll geliefert,
              sonst bleibt 'unterwegs' / 'bestellt'
    """
    if not positionen_mengen:
        return {"ok": False, "fehler": "keine-positionen-uebergeben"}
    h = _read_raw()
    for a in h:
        if a.get("id") != auftrag_id:
            continue
        # Idempotenz-Check (Spec §5)
        if idempotenz_token:
            if idempotenz_token in a.get("wareneingang_tokens", []):
                return {"ok": True, "fehler": "idempotenz-bereits-gebucht",
                         "bereits_gebucht": True}
        gebucht = {}
        for pos in a.get("positionen", []):
            pid_pos = pos["id"]
            if pid_pos not in positionen_mengen:
                continue
            menge_jetzt = int(positionen_mengen[pid_pos])
            if menge_jetzt <= 0:
                continue
            # Cap auf Rest-Menge (kein Über-Liefern)
            rest = (int(pos.get("menge_bestellt", 0))
                     - _bereits_geliefert(pos))
            menge_buchen = min(menge_jetzt, max(0, rest))
            if menge_buchen <= 0:
                continue
            # Katalog-Update
            palette_id = pos.get("palette_id")
            if palette_id:
                if a.get("buchungsmodus") == "wareneingang":
                    katalog_modul.aendere_bestand(palette_id, +menge_buchen)
                    kat_e = next((x for x in katalog_modul.alle()
                                  if x["id"] == palette_id), None)
                    if kat_e:
                        aktuell = int(kat_e.get("bestand_bestellt", 0) or 0)
                        katalog_modul.update_eintrag(
                            palette_id,
                            bestand_bestellt=max(0, aktuell - menge_buchen),
                        )
            pos["menge_geliefert"] = _bereits_geliefert(pos) + menge_buchen
            gebucht[pid_pos] = menge_buchen
        # Status-Wechsel
        if _alle_positionen_voll_geliefert(a["positionen"]):
            a["status"] = "eingegangen"
            a["datum_wareneingang"] = datum or date.today().isoformat()
        elif a["status"] in ("offen", "bestellt"):
            a["status"] = "unterwegs"
        if idempotenz_token:
            a.setdefault("wareneingang_tokens", []).append(idempotenz_token)
        _audit(a, "wareneingang", user, {"buchungen": gebucht,
                                           "token": idempotenz_token})
        _write_raw(h)
        return {"ok": True, "fehler": "", "gebucht": gebucht,
                 "neu_status": a["status"]}
    return {"ok": False, "fehler": "auftrag-nicht-gefunden"}


def alle() -> list[dict[str, Any]]:
    return sorted(_read_raw(),
                   key=lambda e: e.get("datum_erstellt", ""), reverse=True)


def offene() -> list[dict[str, Any]]:
    """Status ∈ {offen, bestellt, unterwegs} = noch nicht abgeschlossen."""
    return [e for e in _read_raw()
            if e.get("status") in ("offen", "bestellt", "unterwegs")]


def ausstehende_eingaenge() -> int:
    """Σ Rest-Mengen aller noch-offenen Bestellungen (Spec §4)."""
    summe = 0
    for a in offene():
        for p in a.get("positionen", []):
            rest = (int(p.get("menge_bestellt", 0))
                     - _bereits_geliefert(p))
            summe += max(0, rest)
    return summe


def suche(query: str) -> list[dict]:
    """Spec §9: Live-Suche über BST-Nr, Lieferant, Positions-AWs und
    Artikelnummern (auf Positionen). Case-insensitive."""
    q = (query or "").strip().lower()
    if not q:
        return alle()
    treffer = []
    for a in alle():
        text_blocks = [
            a.get("bst_nummer", "") or "",
            a.get("lieferant", "") or "",
            a.get("bemerkung", "") or "",
            a.get("tracking_nr", "") or "",
        ]
        for p in a.get("positionen", []):
            snap = p.get("snapshot", {}) or {}
            text_blocks.append(snap.get("name", "") or "")
            text_blocks.append(p.get("kommentar", "") or "")
            for aw in (p.get("verlinkte_aws") or []):
                text_blocks.append(str(aw))
        if any(q in t.lower() for t in text_blocks):
            treffer.append(a)
    return treffer


def aw_ist_in_beschaffung(aw: str, *, nur_offen: bool = False) -> dict | None:
    """Findet den ERSTEN Beschaffungs-Auftrag, in dessen Positionen der
    AW verlinkt ist. Liefert {auftrag, position, status} oder None."""
    if not aw:
        return None
    aw_norm = aw.strip().lower()
    quelle = offene() if nur_offen else alle()
    for a in quelle:
        for p in a.get("positionen", []):
            for x in (p.get("verlinkte_aws") or []):
                if str(x).strip().lower() == aw_norm:
                    return {"auftrag": a, "position": p,
                             "status": a.get("status", "?")}
    return None


def aws_mit_wareneingang() -> set[str]:
    """Spec §6: Liefert alle AWs aus Beschaffungs-Positionen, deren
    Auftrag bereits den Status 'eingegangen' hat (= Paletten sind da)."""
    out: set[str] = set()
    for a in _read_raw():
        if a.get("status") not in ("eingegangen", "wareneingang"):
            continue
        for p in a.get("positionen", []):
            for aw in (p.get("verlinkte_aws") or []):
                if aw:
                    out.add(str(aw).strip())
    return out


def hat_lieferant_offene(lieferant_id: str) -> bool:
    """Spec §5: Lieferant löschen mit offener Bestellung → blockt."""
    for a in offene():
        if a.get("lieferant_id") == lieferant_id:
            return True
    return False


def aus_disposition_vorschlag(katalog_modul, *,
                                 ergebnis: dict | None = None,
                                 default_lieferant_per_palette: dict | None = None,
                                 ) -> list[dict]:
    """Spec §1.4 + §9: Generiert vorausgefüllte Positionen aus dem
    letzten Optimierungs-Ergebnis. Pro Standard-Maß: Differenz
    benötigt − (bestand + bestand_bestellt). Nur > 0.

    Sammelt zusätzlich die AWs (auftrag-Feld) aller Zuordnungen, die
    diesen Standard nutzen — werden als verlinkte_aws vorbefüllt.

    Liefert Liste von [{palette_id, menge, ek_pro_stk_eur, lieferant_id,
    label, verlinkte_aws}] — bereit zur Übernahme als Positionen.
    """
    if not ergebnis:
        return []
    default_lieferant_per_palette = default_lieferant_per_palette or {}
    from collections import defaultdict
    benoetigt: dict[tuple, int] = defaultdict(int)
    aws_pro_kand: dict[tuple, set] = defaultdict(set)
    for z in ergebnis.get("zuordnung", []):
        if z.get("typ") == "Standard":
            try:
                a, b = z["ziel"].split("x")
                kand = (min(int(a), int(b)), max(int(a), int(b)))
                benoetigt[kand] += int(z.get("menge", 0))
                aw = (z.get("auftrag") or "").strip()
                if aw:
                    aws_pro_kand[kand].add(aw)
            except (ValueError, KeyError):
                continue
    vorschlaege = []
    katalog_alle = katalog_modul.alle()
    for kand, menge_benoetigt in benoetigt.items():
        # Lookup Katalog
        kat_eintrag = None
        for e in katalog_alle:
            if not e.get("aktiv", True):
                continue
            if (min(e["L_mm"], e["B_mm"]),
                    max(e["L_mm"], e["B_mm"])) == kand:
                kat_eintrag = e
                break
        if not kat_eintrag:
            continue
        bestand = int(kat_eintrag.get("bestand", 0) or 0)
        bestand_bestellt = int(kat_eintrag.get("bestand_bestellt", 0) or 0)
        diff = menge_benoetigt - bestand - bestand_bestellt
        if diff <= 0:
            continue
        vorschlaege.append({
            "palette_id": kat_eintrag["id"],
            "menge": int(diff),
            "ek_pro_stk_eur": float(kat_eintrag.get("einkaufspreis_eur",
                                                      0) or 0),
            "lieferant_id": default_lieferant_per_palette.get(
                kat_eintrag["id"], ""),
            "verlinkte_aws": sorted(aws_pro_kand.get(kand, set())),
            "label": (
                f"{kat_eintrag.get('name', '') or '—'} "
                f"{kand[1]}×{kand[0]}"
            ),
            "benoetigt": menge_benoetigt,
            "bestand_aktuell": bestand,
            "in_anlieferung": bestand_bestellt,
        })
    return vorschlaege


def loesche_eintrag(eintrag_id: str, *, user: str = "user") -> bool:
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
    """Plain-Text-Variante des Beschaffungs-Auftrags fuer Druck/PDF."""
    zeilen = []
    bst = auftrag.get("bst_nummer") or auftrag["id"][:8]
    zeilen.append(f"Beschaffungsauftrag {bst}")
    zeilen.append("=" * 60)
    zeilen.append(f"Lieferant: {auftrag.get('lieferant', '—')}")
    zeilen.append(f"Erstellt:  {auftrag.get('datum_erstellt', '—')}")
    if auftrag.get("datum_geplant"):
        zeilen.append(f"Geplant:   {auftrag['datum_geplant']}")
    zeilen.append(f"Status:    {auftrag.get('status', '—')}")
    if auftrag.get("tracking_nr"):
        zeilen.append(f"Tracking:  {auftrag['tracking_nr']}")
    zeilen.append("")
    zeilen.append(f"{'Pos.':<5}{'Palette':<30}{'Bestellt':>10}"
                   f"{'Geliefert':>10}{'EK/Stk':>10}{'Summe':>12}")
    zeilen.append("-" * 77)
    for i, pos in enumerate(auftrag.get("positionen", []), 1):
        snap = pos.get("snapshot", {})
        name = (f"{snap.get('name', '')} "
                f"{snap.get('L_mm', 0)}×{snap.get('B_mm', 0)}").strip()[:28]
        menge_b = int(pos.get("menge_bestellt", pos.get("menge", 0)))
        menge_g = int(pos.get("menge_geliefert", 0))
        ek = float(pos.get("ek_pro_stk_eur", 0))
        s = menge_b * ek
        zeilen.append(f"{i:<5}{name:<30}{menge_b:>10}{menge_g:>10}"
                       f"{ek:>10.2f}{s:>12.2f}")
    zeilen.append("-" * 77)
    summe = auftrag.get("summe_netto_eur",
                          auftrag.get("summe_eur", 0))
    zeilen.append(f"{'Summe netto:':>67} {summe:>10.2f} €")
    if auftrag.get("summe_brutto_eur"):
        zeilen.append(f"{'Summe brutto:':>67} "
                       f"{auftrag['summe_brutto_eur']:>10.2f} €")
    if auftrag.get("bemerkung"):
        zeilen.append("")
        zeilen.append(f"Bemerkung: {auftrag['bemerkung']}")
    if auftrag.get("notiz"):
        zeilen.append(f"Notiz: {auftrag['notiz']}")
    return "\n".join(zeilen)
