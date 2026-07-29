#!/usr/bin/env python3
"""Meldet Leads, die eine inhaltliche Nachkontrolle brauchen.

Die Verifikation in verify_leads.py belegt nur, dass eine Adresse auf der
angegebenen Seite steht. Sie sagt nichts darueber, ob die Adresse auch zur
richtigen Person und zur richtigen Firma gehoert. Dieses Skript sucht deshalb
nach den typischen Stolperfallen:

* Adress-Domain passt nicht zur Domain der Quellseite (Agentur, Webdesigner,
  Handelsvertretung oder Konzernmutter statt der Firma selbst)
* Position laesst nicht auf einen Entscheidungstraeger schliessen
* Firmengroesse ausserhalb des Zielkorridors oder als Konzern erkennbar
* mehrere Kontakte derselben Firma (kein Fehler, aber vor dem Versand zu pruefen)
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

ENTSCHEIDER_BEGRIFFE = [
    "geschäftsführ", "geschaeftsfuehr", "geschäftsleitung", "geschaeftsleitung",
    "inhaber", "prokurist", "prokura", "vorstand", "ceo", "cto", "coo", "cfo",
    "managing director", "gesellschafter", "eigentümer", "eigentuemer",
    "leiter", "leitung", "head of", "werkleiter", "betriebsleiter",
    "niederlassungsleit", "direktor",
]

KONZERN_HINWEISE = [
    "bosch", "zf friedrichshafen", "continental ag", "mahle", "schaeffler",
    "basf", "bayer ag", "evonik", "henkel", "lanxess", "covestro", "wacker",
    "thyssenkrupp", "siemens", "dhl", "db schenker", "kühne", "kuehne",
    "dachser", "rhenus", "hellmann",
]


def domain(url_oder_mail: str) -> str:
    if "@" in url_oder_mail and not url_oder_mail.startswith("http"):
        roh = url_oder_mail.split("@", 1)[1]
    else:
        roh = urlparse(url_oder_mail).netloc
    roh = roh.lower().removeprefix("www.")
    teile = roh.split(".")
    # Zweitliniendomains wie co.uk beruecksichtigen
    if len(teile) > 2 and teile[-2] in {"co", "com", "org"} and len(teile[-1]) == 2:
        return ".".join(teile[-3:])
    return ".".join(teile[-2:]) if len(teile) >= 2 else roh


def groesse_auffaellig(text: str) -> str:
    """Liest die Mitarbeiterangabe und meldet Werte ausserhalb 50-1000."""
    if not text:
        return ""
    ohne_jahre = re.sub(r"(gegründet|gegruendet|seit|est\.?|anno)\s*\d{4}", " ", text, flags=re.IGNORECASE)
    zahlen = [int(z.replace(".", "")) for z in re.findall(r"\d[\d.]*", ohne_jahre)]
    # Vierstellige Werte im Jahresbereich sind hier fast immer Jahreszahlen.
    zahlen = [z for z in zahlen if z < 500_000 and not 1800 <= z <= 2100]
    if not zahlen:
        return ""
    hoechst = max(zahlen)
    niedrigst = min(zahlen)
    if hoechst > 1000:
        return f"ueber Zielkorridor ({text})"
    if hoechst < 50 and niedrigst < 50:
        return f"unter Zielkorridor ({text})"
    return ""


def main():
    verzeichnis = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "rohdaten"
    leads = []
    for pfad in sorted(verzeichnis.glob("*.json")):
        daten = json.loads(pfad.read_text(encoding="utf-8"))
        for lead in daten.get("leads", []):
            if lead.get("_verifiziert") is True:
                lead.setdefault("branche", daten.get("branche", ""))
                leads.append(lead)

    fremde_domain, schwache_position, groesse, konzern = [], [], [], []
    firmen = defaultdict(list)

    for lead in leads:
        firmen[lead.get("firma", "?")].append(lead.get("name", "?"))

        mail_domain = domain(lead.get("email", ""))
        quell_domain = domain(lead.get("email_quelle", ""))
        if mail_domain and quell_domain and mail_domain != quell_domain:
            fremde_domain.append((lead.get("firma"), lead.get("email"), quell_domain))

        position = (lead.get("position") or "").lower()
        if not any(begriff in position for begriff in ENTSCHEIDER_BEGRIFFE):
            schwache_position.append((lead.get("firma"), lead.get("name"), lead.get("position")))

        hinweis = groesse_auffaellig(lead.get("mitarbeiter_ca", ""))
        if hinweis:
            groesse.append((lead.get("firma"), hinweis))

        firmenname = (lead.get("firma") or "").lower()
        if any(k in firmenname for k in KONZERN_HINWEISE):
            konzern.append(lead.get("firma"))

    print(f"Geprueft: {len(leads)} verifizierte Leads aus {len(firmen)} Firmen\n")

    def melde(titel, eintraege, formatierer):
        print(f"{titel}: {len(eintraege)}")
        for eintrag in eintraege:
            print("   ", formatierer(eintrag))
        print()

    melde("Adress-Domain weicht von der Quellseite ab", fremde_domain,
          lambda e: f"{e[0]} – {e[1]} (Quelle: {e[2]})")
    melde("Position nicht eindeutig als Entscheidungstraeger erkennbar", schwache_position,
          lambda e: f"{e[0]} – {e[1]}: {e[2]}")
    melde("Mitarbeiterzahl ausserhalb des Zielkorridors", groesse,
          lambda e: f"{e[0]}: {e[1]}")
    melde("Als Konzern erkennbar", konzern, lambda e: str(e))

    mehrfach = {f: n for f, n in firmen.items() if len(n) > 1}
    print(f"Firmen mit mehreren Kontakten: {len(mehrfach)}")
    for firma, namen in sorted(mehrfach.items()):
        print(f"    {firma}: {', '.join(namen)}")


if __name__ == "__main__":
    main()
