#!/usr/bin/env python3
"""
Rohdaten aus impressum_scraper.py zur versandfertigen Lead-Liste aufbereiten.

- verwirft unvollstaendige/unplausible Datensaetze
- dedupliziert nach Firmierung und Mail-Domain
- priorisiert nach Datenvollstaendigkeit (Entscheider + Mail + Telefon + Adresse)
- schreibt die besten N als CSV

Aufruf:  python3 build_leadlist.py leads_raw.csv leads.csv [N]
"""
import csv
import re
import sys

# Sammelpostfaecher sind schwaecher als eine namentliche/abteilungsbezogene Mail
GENERIC_MAIL = re.compile(r"^(info|kontakt|mail|office|service|shop|web|hallo|"
                          r"impressum|zentrale|team)@", re.I)
DECISION_ROLE = re.compile(r"(Geschäftsführ|Vorstand|Inhaber|Vertreten)", re.I)


def score(r: dict) -> int:
    """Je vollstaendiger und je naeher an einer echten Person, desto hoeher."""
    s = 0
    if r["entscheider"]:
        s += 5
        if DECISION_ROLE.search(r["rolle"] or ""):
            s += 2
        if len(r["entscheider"].split(";")) > 1:
            s += 1                      # mehrere Ansprechpartner
    if r["email"]:
        s += 4
        if not GENERIC_MAIL.match(r["email"]):
            s += 2                      # spezifischeres Postfach
    if r["telefon"]:
        s += 3
    if r["strasse"] and r["plz"] and r["ort"]:
        s += 2
    if r["firma"]:
        s += 2
    if r["handelsregister"]:
        s += 1
    if r["ust_id"]:
        s += 1
    return s


def plausible(r: dict) -> bool:
    if r.get("status") != "ok":
        return False
    # Ohne Kontaktweg ist der Datensatz als Lead wertlos
    if not (r.get("email") or r.get("telefon")):
        return False
    # Firmierung muss nach Firma aussehen, nicht nach Fliesstext
    firma = r.get("firma", "")
    if firma and (len(firma) > 70 or re.search(
            r"(Innerhalb|Versand|Lieferung|Bestellung|Widerruf|Cookie)", firma, re.I)):
        r["firma"] = ""
    return True


def main():
    src, out = sys.argv[1], sys.argv[2]
    want = int(sys.argv[3]) if len(sys.argv) > 3 else 100

    rows = [r for r in csv.DictReader(open(src, encoding="utf-8")) if plausible(r)]

    # Dedupe: gleiche Firmierung oder gleiche Mail-Domain nur einmal
    seen_firma, seen_maildom, uniq = set(), set(), []
    for r in sorted(rows, key=score, reverse=True):
        fkey = re.sub(r"[^a-z0-9]", "", (r.get("firma") or r["domain"]).lower())
        mkey = (r.get("email") or "").split("@")[-1].lower()
        if fkey and fkey in seen_firma:
            continue
        if mkey and mkey in seen_maildom:
            continue
        seen_firma.add(fkey)
        if mkey:
            seen_maildom.add(mkey)
        uniq.append(r)

    final = uniq[:want]
    cols = ["nr", "firma", "entscheider", "rolle", "email", "telefon", "website",
            "strasse", "plz", "ort", "land", "branche", "handelsregister",
            "ust_id", "quelle_impressum", "datenqualitaet"]
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        for i, r in enumerate(final, 1):
            w.writerow({
                "nr": i,
                "firma": r.get("firma") or r["domain"],
                "entscheider": r.get("entscheider", ""),
                "rolle": r.get("rolle", ""),
                "email": r.get("email", ""),
                "telefon": r.get("telefon", ""),
                "website": f"https://www.{r['domain']}",
                "strasse": r.get("strasse", ""),
                "plz": r.get("plz", ""),
                "ort": r.get("ort", ""),
                "land": r.get("land", ""),
                "branche": r.get("branche", ""),
                "handelsregister": r.get("handelsregister", ""),
                "ust_id": r.get("ust_id", ""),
                "quelle_impressum": r.get("impressum_url", ""),
                "datenqualitaet": score(r),
            })

    named = sum(1 for r in final if r.get("entscheider"))
    mailed = sum(1 for r in final if r.get("email"))
    phoned = sum(1 for r in final if r.get("telefon"))
    laender = {}
    for r in final:
        laender[r.get("land", "?")] = laender.get(r.get("land", "?"), 0) + 1
    print(f"geliefert={len(final)} (gewuenscht {want}) | mit Entscheidername={named} "
          f"| mit Mail={mailed} | mit Telefon={phoned} | Laender={laender}")
    if len(final) < want:
        print(f"HINWEIS: {want - len(final)} Datensaetze fehlen — Kandidatenliste erweitern.")


if __name__ == "__main__":
    main()
