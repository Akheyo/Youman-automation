#!/usr/bin/env python3
"""Prueft jede recherchierte E-Mail-Adresse gegen die angegebene Quell-URL.

Ruft die Quellseite ab und sucht die Adresse woertlich im ausgelieferten HTML
(mailto-Links, sichtbarer Text und Formularfelder zaehlen gleichermassen).
Adressen, die dort nicht auftauchen, werden als unbestaetigt markiert und
fliegen damit aus der Lead-Liste.

Ergebnis wird als "_verifiziert": true/false in die JSON-Dateien zurueck-
geschrieben, zusammen mit "_verifiziert_am" und der HTTP-Antwort.
"""
import concurrent.futures as futures
import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

BROWSER_HEADER = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9",
}
ZEITLIMIT = 30
# Mit "--erneut" werden auch bereits bestaetigte Adressen noch einmal geprueft.
ERNEUT_PRUEFEN = "--erneut" in sys.argv


def hole_seite(url: str, versuche: int = 3) -> tuple[str, str]:
    """Liefert (seiteninhalt, status). Bei Fehlern ist der Inhalt leer.

    Netzwerkfehler (DNS, TLS, Timeout) werden wiederholt, damit ein einmaliger
    Aussetzer keinen bereits belegten Lead aus der Liste wirft.
    """
    kontext = ssl.create_default_context()
    letzter_status = "unbekannt"
    for versuch in range(versuche):
        anfrage = urllib.request.Request(url, headers=BROWSER_HEADER)
        try:
            with urllib.request.urlopen(anfrage, timeout=ZEITLIMIT, context=kontext) as antwort:
                rohdaten = antwort.read()
                zeichensatz = antwort.headers.get_content_charset() or "utf-8"
                return rohdaten.decode(zeichensatz, errors="replace"), f"HTTP {antwort.status}"
        except urllib.error.HTTPError as fehler:
            # Ein echter HTTP-Status ist eine Antwort, keine Stoerung: nicht wiederholen.
            return "", f"HTTP {fehler.code}"
        except Exception as fehler:  # DNS, TLS, Timeout
            letzter_status = f"Netzwerkfehler: {type(fehler).__name__}"
            if versuch + 1 < versuche:
                time.sleep(2 * (versuch + 1))
    return "", letzter_status


def entschluessele_cloudflare(seite: str) -> str:
    """Loest Cloudflares E-Mail-Verschleierung auf (data-cfemail-Attribute)."""
    ergebnis = []
    for treffer in re.findall(r'data-cfemail="([0-9a-fA-F]+)"', seite):
        try:
            bytes_folge = bytes.fromhex(treffer)
            schluessel = bytes_folge[0]
            ergebnis.append("".join(chr(b ^ schluessel) for b in bytes_folge[1:]))
        except ValueError:
            continue
    return " ".join(ergebnis)


def pruefe_lead(lead: dict) -> dict:
    # Einmal belegte Adressen nicht erneut anfassen: die Quellseite kann sich
    # aendern oder zeitweise ausfallen, der Beleg von damals bleibt gueltig.
    if lead.get("_verifiziert") is True and not ERNEUT_PRUEFEN:
        return lead

    email = (lead.get("email") or "").strip()
    url = (lead.get("email_quelle") or "").strip()
    if not email or not url.startswith("http"):
        lead["_verifiziert"] = False
        lead["_verifiziert_status"] = "keine pruefbare Quell-URL"
        return lead

    seite, status = hole_seite(url)
    if seite:
        durchsuchbar = seite + " " + entschluessele_cloudflare(seite)
        # HTML-Entities in mailto-Links aufloesen, z. B. &#64; oder %40
        durchsuchbar = durchsuchbar.replace("%40", "@").replace("&#64;", "@").replace("&commat;", "@")
        gefunden = email.lower() in durchsuchbar.lower()
    else:
        gefunden = False

    lead["_verifiziert"] = gefunden
    lead["_verifiziert_status"] = status if gefunden else f"{status} – Adresse nicht auf Seite gefunden"
    lead["_verifiziert_am"] = date.today().isoformat()
    return lead


def main():
    argumente = [a for a in sys.argv[1:] if not a.startswith("--")]
    verzeichnis = Path(argumente[0]) if argumente else Path(__file__).resolve().parent / "rohdaten"
    dateien = sorted(verzeichnis.glob("*.json"))
    if not dateien:
        print(f"Keine JSON-Dateien in {verzeichnis}", file=sys.stderr)
        return 1

    gesamt_ok = gesamt_fehl = 0
    for pfad in dateien:
        daten = json.loads(pfad.read_text(encoding="utf-8"))
        leads = daten.get("leads", [])
        if not leads:
            continue
        with futures.ThreadPoolExecutor(max_workers=8) as pool:
            geprueft = list(pool.map(pruefe_lead, leads))
        daten["leads"] = geprueft
        pfad.write_text(json.dumps(daten, ensure_ascii=False, indent=2), encoding="utf-8")

        ok = sum(1 for l in geprueft if l.get("_verifiziert"))
        fehl = len(geprueft) - ok
        gesamt_ok += ok
        gesamt_fehl += fehl
        print(f"{pfad.name}: {ok} bestaetigt, {fehl} unbestaetigt")
        for lead in geprueft:
            if not lead.get("_verifiziert"):
                print(f"    ! {lead.get('email','?')} ({lead.get('firma','?')}): "
                      f"{lead.get('_verifiziert_status','')}")

    print(f"\nGesamt: {gesamt_ok} bestaetigt, {gesamt_fehl} unbestaetigt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
