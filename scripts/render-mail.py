#!/usr/bin/env python3
"""Rendert die Cold Mail fuer einzelne Leads - fertig zum Versand.

Gedacht fuer eine Session mit angebundenem Gmail-Connector: Dieses Skript
liefert Empfaenger, Betreff, HTML und Plain Text als JSON, der Versand selbst
passiert ueber den Connector. Was raus ist, wird protokolliert, damit die
Liste ueber mehrere Sitzungen hinweg Stueck fuer Stueck abgearbeitet werden
kann, ohne dass jemand zweimal angeschrieben wird.

    python3 scripts/render-mail.py --status          # wie viele offen
    python3 scripts/render-mail.py --next 5          # naechste 5 rendern
    python3 scripts/render-mail.py --email a@b.de    # gezielt einen rendern
    python3 scripts/render-mail.py --mark a@b.de     # als versendet eintragen

Das Skript verschickt nichts und traegt von sich aus nichts ins Protokoll -
--mark ist ein eigener Aufruf, damit nur das als versendet gilt, was der
Connector auch wirklich angenommen hat.
"""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "marketing" / "cold-email-adept.html"
LEADS = ROOT / "marketing" / "leads-adept.csv"
LOG = ROOT / "marketing" / "versand-log.csv"

ABSENDER = "Amanuel Kheyo <kheyo@adeptandpartners.de>"

# Rechtsformen und Klammerzusaetze kosten im Betreff nur Platz.
RECHTSFORM = re.compile(
    r"\s*(GmbH\s*&\s*Co\.?\s*KGaA|GmbH\s*&\s*Co\.?\s*KG|AG\s*&\s*Co\.?\s*KG|gGmbH|GmbH"
    r"|AG|KGaA|KG|OHG|SE|e\.\s*K\.?|mbH|UG\s*\(haftungsbeschr[aä]nkt\)|UG)\b\.?",
    re.I,
)
KLAMMERZUSATZ = re.compile(r"\s*\([^)]*\)")
ECOM = re.compile(r"e-?commerce|handel|shop|versand", re.I)

# Der individuelle Einstiegsabsatz. Ohne Text faellt er ersatzlos weg.
HOOK = re.compile(r"<!--@hook:start-->(.*?)<!--@hook:end-->", re.S)

# Drei Betreffzeilen je Fassung. Immer dieselbe Zeile an alle 233 Empfaenger
# ist das auffaelligste Muster einer Serienmail - die Rotation bricht es.
# Gewaehlt wird stabil ueber die Adresse, damit derselbe Lead beim erneuten
# Rendern denselben Betreff bekommt.
BETREFFE = {
    "ind": [
        "Frage zu den Planungsprozessen bei {firma}",
        "Kurze Frage zu {firma}",
        "{firma}: manuelle Schritte trotz ERP?",
    ],
    "ecom": [
        "Frage zur Auftragsabwicklung bei {firma}",
        "Kurze Frage zu {firma}",
        "{firma}: Shop, Lager und ERP",
    ],
}


def betreff(art: str, firma: str, adresse: str) -> str:
    zeilen = BETREFFE[art]
    return zeilen[sum(adresse.lower().encode()) % len(zeilen)].format(firma=firma)


def load(name: str):
    """Laedt ein Nachbarskript (Bindestrich im Dateinamen, kein Modulname)."""
    spec = importlib.util.spec_from_file_location(
        name.replace("-", "_"), ROOT / "scripts" / f"{name}.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def kurzname(firma: str) -> str:
    """Firmenname fuer den Betreff, ohne Rechtsform und Klammerzusatz."""
    kurz = RECHTSFORM.sub("", KLAMMERZUSATZ.sub("", firma))
    return re.sub(r"[\s,]+$", "", kurz).strip() or firma.strip()


def leads() -> list[dict]:
    with LEADS.open(encoding="utf-8-sig", newline="") as f:
        return [r for r in csv.DictReader(f, delimiter=";") if (r.get("E-Mail") or "").strip()]


def versendet() -> dict[str, str]:
    if not LOG.exists():
        return {}
    with LOG.open(encoding="utf-8-sig", newline="") as f:
        return {r["E-Mail"].lower(): r["Zeitpunkt"] for r in csv.DictReader(f, delimiter=";")}


def rendern(lead: dict, fassungen: dict[str, str], plain: str, aufhaenger: str = "") -> dict:
    aufhaenger = (aufhaenger or "").strip()
    werte = {
        "anrede": (lead.get("Anrede") or "").strip() or lead["Name"].strip(),
        "firma": kurzname(lead.get("Firmenname", "")),
        "aufhaenger": aufhaenger,
    }
    art = "ecom" if ECOM.search(lead.get("Branche") or "") else "ind"

    def setze(vorlage: str) -> str:
        return re.sub(r"\{\{(\w+)\}\}", lambda m: werte.get(m.group(1), m.group(0)), vorlage)

    # Ohne Einstiegssatz verschwindet der Absatz, statt leer stehen zu bleiben.
    roh = fassungen[art]
    roh = HOOK.sub(lambda m: m.group(1) if aufhaenger else "", roh)
    html = setze(roh)
    text = re.sub(r"\n{3,}", "\n\n", setze(plain))

    adresse = lead["E-Mail"].strip()
    return {
        "an": adresse,
        "name": lead["Name"].strip(),
        "firma": lead.get("Firmenname", "").strip(),
        "position": (lead.get("Position") or "").strip(),
        "branche": (lead.get("Branche") or "").strip(),
        "ort": (lead.get("Ort") or "").strip(),
        "beschreibung": (lead.get("Beschreibung") or "").strip(),
        "aufhaenger": aufhaenger,
        "von": ABSENDER,
        "betreff": betreff(art, werte["firma"], adresse),
        "html": html,
        "text": text,
        "fassung": art,
    }


def markieren(adressen: list[str]) -> None:
    neu = not LOG.exists()
    zeitpunkt = datetime.now(timezone.utc).isoformat(timespec="seconds")
    bekannt = versendet()
    with LOG.open("a", encoding="utf-8-sig", newline="") as f:
        schreiber = csv.DictWriter(f, fieldnames=["E-Mail", "Zeitpunkt"], delimiter=";")
        if neu:
            schreiber.writeheader()
        for adresse in adressen:
            if adresse.lower() in bekannt:
                print(f"schon eingetragen: {adresse} ({bekannt[adresse.lower()]})")
                continue
            schreiber.writerow({"E-Mail": adresse, "Zeitpunkt": zeitpunkt})
            print(f"eingetragen: {adresse}")


def main() -> None:
    p = argparse.ArgumentParser(description="Cold Mail fuer Leads rendern.")
    p.add_argument("--next", type=int, metavar="N", help="die naechsten N offenen Leads rendern")
    p.add_argument("--email", help="einen bestimmten Lead rendern")
    p.add_argument("--mark", nargs="+", metavar="ADRESSE", help="Adressen als versendet eintragen")
    p.add_argument("--status", action="store_true", help="Zaehlstand ausgeben")
    p.add_argument("--aufhaenger", default="", help="individueller Einstiegssatz (nur mit --email)")
    args = p.parse_args()

    if args.mark:
        markieren(args.mark)
        return

    alle, fertig = leads(), versendet()
    offen = [l for l in alle if l["E-Mail"].strip().lower() not in fertig]

    if args.status or not (args.next or args.email):
        print(f"Leads gesamt: {len(alle)}")
        print(f"versendet:    {len(fertig)}")
        print(f"offen:        {len(offen)}")
        if offen:
            print(f"naechster:    {offen[0]['Name']} - {offen[0]['Firmenname']} <{offen[0]['E-Mail']}>")
        return

    preview, eml = load("build-mail-preview"), load("build-test-eml")
    quelle = SOURCE.read_text(encoding="utf-8")
    fassungen = {art: preview.variant(quelle, art) for art in ("ind", "ecom")}

    if args.email:
        treffer = [l for l in alle if l["E-Mail"].strip().lower() == args.email.strip().lower()]
        if not treffer:
            raise SystemExit(f"kein Lead mit der Adresse {args.email}")
        ausgabe = [rendern(treffer[0], fassungen, eml.PLAIN, args.aufhaenger)]
    else:
        ausgabe = [rendern(l, fassungen, eml.PLAIN) for l in offen[: args.next]]

    print(json.dumps(ausgabe, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
