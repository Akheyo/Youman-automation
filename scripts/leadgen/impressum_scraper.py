#!/usr/bin/env python3
"""
DACH E-Commerce Lead-Extraktor
==============================
Liest zu einer Liste von Shop-Domains das gesetzlich vorgeschriebene Impressum
(DE: §5 DDG, AT: §5 ECG, CH: Art. 3 UWG) aus und extrahiert die Firmendaten
inkl. namentlich genannter Entscheidungstraeger (Geschaeftsfuehrung/Inhaber).

Es wird ausschliesslich oeffentlich pflichtveroeffentlichte Information erfasst.
Datensaetze, die sich nicht live verifizieren lassen, werden verworfen.

Aufruf:  python3 impressum_scraper.py domains.txt out.csv [max_workers]
"""
import csv
import html
import re
import sys
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

import urllib3
urllib3.disable_warnings()

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
}
CANDIDATE_PATHS = [
    "/impressum", "/impressum/", "/impressum.html", "/impressum.php",
    "/de/impressum", "/ueber-uns/impressum", "/service/impressum",
    "/hilfe/impressum", "/i/impressum", "/pages/impressum", "/legal/impressum",
    "/rechtliches/impressum", "/kontakt/impressum", "/imprint", "/de/imprint",
]

# Rollen, die eine entscheidungsbefugte Person einleiten
ROLE_RE = re.compile(
    r"(Geschäftsführer(?:in)?(?:\s*\(CEO\))?|Geschäftsführung|"
    r"Vertretungsberechtigte[rn]?\s+Geschäftsführer(?:in)?|"
    r"Vertreten\s+durch(?:\s+den|\s+die)?|Vorstand|Inhaber(?:in)?|"
    r"Verantwortlich(?:er)?\s+für\s+den\s+Inhalt|Firmeninhaber(?:in)?)"
    r"\s*[:\-–]?\s*", re.I)

# Ein Personenname: 2-4 grossgeschriebene Woerter, erlaubt Adelspraefixe/Titel
NAME_RE = re.compile(
    r"((?:Dr\.|Prof\.|Dipl\.-\w+\.?|Mag\.|MBA)?\s*"
    r"[A-ZÄÖÜ][a-zäöüß]+"
    r"(?:\s+(?:von|van|de|der|zu|den))?"
    r"(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,2})")

# Wortgrenze ist Pflicht: ohne \b schneidet "USt" mitten in "M-ust-ermann".
TAIL_STOP = re.compile(
    r"\b(?:Verantwortl|Geschäftsführ|Vertretungsber|Vertreten|Inhaber|Vorstand|"
    r"Handelsregister|Registergericht|Amtsgericht|Umsatzsteuer|USt|Steuernummer|"
    r"Postanschrift|Anschrift|Telefon|Telefax|E-Mail|Sitz\s+der|Register|"
    r"Aufsichtsrat|Redaktionell|Kontakt|Adresse)", re.I)

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?:\+|00)\s?(?:49|43|41)[\s\-/()\d]{6,20}|0\d{2,5}[\s\-/]\d[\s\-/\d]{4,16}")
# Register-/Steuernummern bewusst OHNE re.I: sonst matcht "CHE" in
# "Rechtliches", "welche" usw. und produziert Schrottwerte.
HRB_RE = re.compile(
    r"\b(?:HRB|HRA)\s?\d{1,7}\b"                     # DE
    r"|\bFN\s?\d{5,7}\s?[a-z]\b"                     # AT
    r"|\bCHE[\s\-]?\d{3}\.\d{3}\.\d{3}\b")         # CH
VAT_RE = re.compile(
    r"\bDE\s?\d{9}\b"                                 # DE
    r"|\bATU\s?\d{8}\b"                               # AT
    r"|\bCHE[\s\-]?\d{3}\.\d{3}\.\d{3}(?:\s?MWST)?\b")  # CH
PLZ_RE = re.compile(r"\b(\d{4,5})\s+([A-ZÄÖÜ][A-Za-zäöüß\.\-\s]{2,30})")
STREET_RE = re.compile(
    r"([A-ZÄÖÜ][A-Za-zäöüß\.\-]{2,30}"
    r"(?:straße|strasse|str\.|weg|allee|platz|ring|gasse|damm|ufer|chaussee)"
    r"\s+\d{1,4}\s?[a-zA-Z]?)", re.I)
LEGAL_RE = re.compile(
    r"([A-Z0-9ÄÖÜ][\wäöüß&\.\,\-\+\s]{2,60}?"
    r"\s(?:GmbH\s*&\s*Co\.?\s*KGaA|GmbH\s*&\s*Co\.?\s*KG|GmbH|AG|SE|UG\s*\(haftungsbeschränkt\)|"
    r"UG|e\.K\.|OHG|KG|GbR|AG\s*&\s*Co\.?\s*KG))")

# Mails, die keine echten Geschaeftskontakte sind
MAIL_BLOCK = re.compile(
    r"(sentry|example\.|\.png|\.jpg|\.gif|\.svg|wixpress|godaddy|sentry\.io|"
    r"domain\.tld|ihre-mail|your-?mail|muster|noreply|no-reply|abuse@|postmaster@)", re.I)

BAD_NAME_WORDS = re.compile(
    r"^(Der|Die|Das|Ein|Eine|Unsere|Unser|Diese|Bei|Alle|Wir|Sie|Herr|Frau|"
    r"Impressum|Kontakt|Angaben|Gemäß|Quelle|Inhalt|Verantwortlich|"
    r"Handelsregister|Amtsgericht|Registergericht|Umsatzsteuer|Telefon|Adresse|"
    r"Sitz|Postfach|Vertreten|Online|Plattform|Europ|Streit|Verbraucher|"
    r"In|Im|Am|An|Auf|Für|Mit|Von|Zur|Zum|Nach|Über|Unter|Als|Aus|Bis|Durch|"
    r"Ohne|Um|Seit|Gegen|Neben|Vor|Hinter|Zwischen|Sowie|Oder|Und|Dieser|"
    r"Sachen|Namen|Sinne|Bezug|Falle|Rahmen|Zuge)\b", re.I)

# Wortfragmente, die einen vermeintlichen Personennamen als Firmenteil entlarven
NOT_A_PERSON = re.compile(
    r"(Gmb|GmbH|\bAG\b|\bKG\b|\bUG\b|\bSE\b|OHG|GbR|e\.K|Verwaltung|"
    r"Holding|Beteiligung|Vertrieb|Handel|Gruppe|Group|Company|Stiftung|"
    r"Genossenschaft|Verein|Sitz|Register|Gericht|Straße|Strasse|Media|"
    r"Service|Solutions|Systems|Digital|Commerce|Shop|Store|Deutschland|"
    r"Austria|Schweiz|Germany)", re.I)

def clean_text(raw: str) -> str:
    """HTML -> flacher Text mit normalisierten Leerzeichen."""
    raw = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", raw)
    raw = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</li>|</tr>|</h[1-6]>", "\n", raw)
    raw = re.sub(r"<[^>]+>", " ", raw)
    raw = html.unescape(raw)
    raw = raw.replace(" ", " ").replace("​", "")
    # Anti-Spam-Schreibweisen zurueckuebersetzen
    raw = re.sub(r"\s*\(at\)\s*|\s*\[at\]\s*|\s+at\s+(?=[\w\-]+\.[a-z]{2,})", "@", raw, flags=re.I)
    raw = re.sub(r"\s*\(dot\)\s*|\s*\[dot\]\s*", ".", raw, flags=re.I)
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in raw.split("\n")]
    return "\n".join(ln for ln in lines if ln)


def fetch(url: str, timeout: int = 25, retries: int = 2):
    import time
    import requests
    for attempt in range(retries + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=timeout,
                             allow_redirects=True, verify=False)
            if r.status_code in (429, 503) and attempt < retries:
                time.sleep(2 * (attempt + 1))
                continue
            ctype = r.headers.get("content-type", "")
            if r.status_code == 200 and "html" in ctype and len(r.text) > 400:
                return r.text, r.url
            return None, None
        except Exception:
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
                continue
    return None, None


def find_impressum(domain: str):
    """Impressum-Seite finden: erst Standardpfade, dann Link auf der Startseite."""
    for host in (f"https://www.{domain}", f"https://{domain}"):
        for path in CANDIDATE_PATHS:
            body, final = fetch(host + path, timeout=12, retries=0)
            if body and re.search(r"impressum|imprint|angaben gem", body, re.I):
                return body, final
        home, _ = fetch(host, timeout=20, retries=1)
        if home:
            for m in re.finditer(r'href=["\']([^"\']*(?:impressum|imprint)[^"\']*)["\']',
                                 home, re.I):
                body, final = fetch(urllib.parse.urljoin(host, m.group(1)))
                if body:
                    return body, final
            break  # Startseite erreichbar, aber kein Impressum-Link
    return None, None


def pick_decision_maker(text: str):
    """Namentlich genannte Geschaeftsfuehrung/Inhaber aus dem Impressum ziehen."""
    found = []
    for m in ROLE_RE.finditer(text):
        role = re.sub(r"\s+", " ", m.group(1)).strip()
        tail = text[m.end():m.end() + 160]
        tail = tail.split("\n")[0] if tail.split("\n")[0].strip() else tail.strip()
        # Vor dem naechsten Abschnittswort abschneiden, sonst wandert ein
        # angeschnittenes "Verantwortlich"/"Handelsregister" in den Namen.
        tail = TAIL_STOP.split(tail)[0]
        # "Thomas Holz, Birgit Rohn, Jonathan Gschwendner" -> alle drei erfassen
        taken = 0
        for nm in NAME_RE.finditer(tail[:160]):
            name = re.sub(r"\s+", " ", nm.group(1)).strip()
            if BAD_NAME_WORDS.match(name):
                continue
            if len(name.split()) < 2:
                continue
            # Rechtsformbestandteile sind keine Personennamen
            if NOT_A_PERSON.search(name):
                continue
            # Ein Personenname besteht aus normal langen Wortteilen
            if any(len(w) < 2 for w in name.split()):
                continue
            found.append((role, name))
            taken += 1
            if taken >= 3:
                break
    if not found:
        return "", ""
    # Mehrere Geschaeftsfuehrer: alle sammeln, Rolle des ersten Treffers
    role0 = found[0][0]
    names, seen = [], set()
    for r, n in found:
        if n not in seen:
            seen.add(n)
            names.append(n)
    return "; ".join(names[:3]), role0


BLOCK_SIGNALS = (
    (re.compile(r"Gesch.ftsf.hr|Vertreten\s+durch|Inhaber|Vorstand", re.I), 3),
    (re.compile(r"Handelsregister|Registergericht|Amtsgericht|HRB|FN\s?\d", re.I), 3),
    (re.compile(r"Umsatzsteuer|USt[\-\s]?Id|UID|Steuernummer", re.I), 2),
    (re.compile(r"Telefon|Tel\.", re.I), 1),
    (re.compile(r"E[\-\s]?Mail", re.I), 1),
    (LEGAL_RE, 3),
    (STREET_RE, 2),
)


def impressum_block(text: str) -> str:
    """Auf den eigentlichen Impressum-Abschnitt eingrenzen.

    "Impressum" steht auf fast jeder Seite auch als Navigationslink. Statt des
    ersten Treffers wird deshalb der Abschnitt gewaehlt, der die meisten
    echten Impressumsmerkmale enthaelt (Rechtsform, Registereintrag, USt-ID …).
    """
    heads = list(re.finditer(
        r"(Angaben\s+gem(?:ä|ae)ß\s*§?\s*5|Angaben\s+nach\s*§?\s*5|"
        r"Anbieterkennzeichnung|Diensteanbieter|Impressum|Imprint)", text, re.I))
    if not heads:
        return text
    best, best_score = text, -1
    for h in heads:
        block = text[h.end():h.end() + 6000]
        score = sum(w for rx, w in BLOCK_SIGNALS if rx.search(block))
        # Ein explizites "Angaben gemaess Paragraf 5" ist der staerkste Anker
        if re.match(r"(?i)Angaben|Anbieterkenn|Diensteanbieter", h.group(1)):
            score += 4
        if score > best_score:
            best, best_score = block, score
    # Firmierung steht oft unmittelbar VOR der Ueberschrift -> Vorlauf mitnehmen
    idx = text.find(best)
    if idx > 0:
        best = text[max(0, idx - 600):idx] + "\n" + best
    return best if best_score >= 3 else text


def pick_company(text: str, domain: str = "") -> str:
    """Firmierung: kurze Zeile, die auf eine Rechtsform endet.

    Enthaelt ein Treffer den Domainnamen (z.B. "TeeGschwendner GmbH" zu
    teegschwendner.de), ist er nahezu sicher die gesuchte Firmierung.
    """
    root = re.sub(r"[^a-z0-9]", "", domain.split(".")[0].lower()) if domain else ""
    best = ""
    for line in text.split("\n")[:400]:
        line = line.strip(" .,;:-|/")
        if not (3 < len(line) <= 80):
            continue
        if re.search(r"(Impressum|Datenschutz|Startseite|Navigation|Anmelden|"
                     r"Warenkorb|Cookie|Newsletter|Versand|Zahlung|Widerruf)", line, re.I):
            continue
        m = LEGAL_RE.search(line)
        if not m:
            continue
        cand = re.sub(r"\s+", " ", m.group(1)).strip(" .,;-")
        flat = re.sub(r"[^a-z0-9]", "", cand.lower())
        if root and len(root) > 3 and root in flat:
            return cand
        if not best and abs(len(cand) - len(line)) <= 3:
            best = cand
        elif not best:
            best = cand
    return best


def pick_address(text: str, country: str):
    """Strasse + PLZ/Ort aus zusammenhaengenden Adresszeilen."""
    digits = 4 if country in ("AT", "CH") else 5
    plz_rx = re.compile(r"^(\d{%d})\s+([A-ZÄÖÜ][A-Za-zäöüß\.\-]+"
                        r"(?:[\s\-/][A-ZÄÖÜa-zäöüß\.]+){0,3})$" % digits)
    lines = [l.strip(" .,;:|") for l in text.split("\n")]
    street = plz = ort = ""
    for i, line in enumerate(lines):
        m = plz_rx.match(line)
        if not m:
            continue
        cand_plz, cand_ort = m.group(1), m.group(2).strip()
        if re.match(r"^(19|20)\d{2}$", cand_plz):      # Jahreszahl, keine PLZ
            continue
        if re.search(r"(Kollektion|Modell|Artikel|Preis|Euro|Version)", cand_ort, re.I):
            continue
        # Strasse steht in aller Regel unmittelbar davor
        for back in range(1, 4):
            if i - back < 0:
                break
            sm = STREET_RE.search(lines[i - back])
            if sm:
                street = re.sub(r"\s+", " ", sm.group(1)).strip()
                break
        plz, ort = cand_plz, cand_ort
        if street:
            break
    if not street:
        sm = STREET_RE.search(text)
        if sm:
            street = re.sub(r"\s+", " ", sm.group(1)).strip()
    return street, plz, ort


# Datumsangaben sehen wie Telefonnummern aus ("2026-08-20" -> "026-08-20 20")
DATEISH = re.compile(
    r"(?:19|20)\d{2}\s*[-–/\.]\s*(?:19|20)\d{2}"      # Jahresspanne "2015-2026"
    r"|(?:19|20)\d{2}[-/\.]\d{1,2}[-/\.]\d{1,2}"       # ISO-Datum
    r"|\d{1,2}[\./]\d{1,2}[\./](?:19|20)\d{2}")        # 20.08.2026


def strip_dates(text: str) -> str:
    return DATEISH.sub(" ", text)


def pick_phone(text: str) -> str:
    """Telefonnummer bevorzugt aus einer als solche beschrifteten Zeile."""
    text = strip_dates(text)
    for line in text.split("\n"):
        if not re.search(r"(Telefon|Tel\.?|Fon|Phone|Rufnummer)", line, re.I):
            continue
        if re.search(r"(Fax|Telefax)", line, re.I) and not re.search(r"(Telefon|Tel\.|Fon)", line, re.I):
            continue
        m = PHONE_RE.search(line)
        if m:
            v = re.sub(r"\s+", " ", m.group(0)).strip(" .,;-/")
            if plausible_phone(v):
                return v
    m = PHONE_RE.search(text)
    if m:
        v = re.sub(r"\s+", " ", m.group(0)).strip(" .,;-/")
        if plausible_phone(v):
            return v
    return ""


def plausible_phone(v: str) -> bool:
    digits = re.sub(r"\D", "", v)
    if not (8 <= len(digits) <= 16):
        return False
    return not DATEISH.search(v)


def first(rx, text, group=0, transform=None):
    m = rx.search(text)
    if not m:
        return ""
    v = m.group(group) if group else m.group(0)
    v = re.sub(r"\s+", " ", v).strip(" .,;-")
    return transform(v) if transform else v


def pick_email(text: str, domain: str):
    cands = [e for e in EMAIL_RE.findall(text) if not MAIL_BLOCK.search(e)]
    if not cands:
        return ""
    root = domain.split(".")[0].lower()
    # bevorzugt eine Adresse auf der eigenen Domain
    own = [e for e in cands if root in e.split("@")[-1].lower()]
    pool = own or cands
    # persoenliche/relevante Postfaecher vor generischen
    for pref in ("geschaeftsfuehrung", "gf@", "leitung", "vertrieb", "sales",
                 "kontakt", "info", "mail", "office", "service"):
        for e in pool:
            if e.lower().startswith(pref) or pref in e.lower().split("@")[0]:
                return e.lower()
    return pool[0].lower()


def country_of(domain: str, text: str) -> str:
    tld = domain.rsplit(".", 1)[-1].lower()
    if tld == "at":
        return "AT"
    if tld == "ch":
        return "CH"
    if tld == "de":
        return "DE"
    if re.search(r"\bATU\d", text):
        return "AT"
    if re.search(r"\bCHE[\s\-]?\d", text):
        return "CH"
    return "DE"


def process(entry):
    domain, branche = entry
    body, url = find_impressum(domain)
    if not body:
        return {"domain": domain, "status": "kein_impressum_erreichbar"}
    text = clean_text(body)
    block = impressum_block(text)
    land = country_of(domain, text)
    name, role = pick_decision_maker(block) 
    if not name:
        name, role = pick_decision_maker(text)
    street, plz, ort = pick_address(block, land)
    rec = {
        "domain": domain,
        "branche": branche,
        "firma": pick_company(block, domain) or pick_company(text, domain),
        "entscheider": name,
        "rolle": role,
        "email": pick_email(block, domain) or pick_email(text, domain),
        "telefon": pick_phone(block) or pick_phone(text),
        "strasse": street,
        "plz": plz,
        "ort": ort,
        "land": land,
        "handelsregister": first(HRB_RE, block) or first(HRB_RE, text),
        "ust_id": first(VAT_RE, block) or first(VAT_RE, text),
        "impressum_url": url or "",
        "status": "ok",
    }
    return rec


def main():
    src, out = sys.argv[1], sys.argv[2]
    workers = int(sys.argv[3]) if len(sys.argv) > 3 else 12
    entries = []
    for line in open(src, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split(",", 1)]
        entries.append((parts[0], parts[1] if len(parts) > 1 else ""))

    with ThreadPoolExecutor(max_workers=workers) as ex:
        rows = list(ex.map(process, entries))

    cols = ["firma", "entscheider", "rolle", "email", "telefon", "domain",
            "strasse", "plz", "ort", "land", "branche", "handelsregister",
            "ust_id", "impressum_url", "status"]
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in cols})

    ok = [r for r in rows if r.get("status") == "ok"]
    full = [r for r in ok if r.get("email") and r.get("entscheider")]
    print(f"verarbeitet={len(rows)} impressum_ok={len(ok)} "
          f"mit_mail_und_name={len(full)} -> {out}")


if __name__ == "__main__":
    main()
