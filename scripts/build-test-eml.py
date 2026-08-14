#!/usr/bin/env python3
"""Baut aus der Cold Mail eine versandfertige .eml zum Testen.

Die Datei laesst sich per Drag-and-drop in Gmail ziehen oder in Thunderbird
bzw. Outlook oeffnen - so sieht man die Mail im echten Client statt im Browser.

    python3 scripts/build-test-eml.py [empfaenger]

Enthaelt beide Teile einer ordentlichen Mail: HTML und Plain Text. Ohne den
Plain-Text-Teil stufen Spamfilter die Nachricht ab.
"""

from __future__ import annotations

import importlib.util
import re
import sys
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "marketing" / "cold-email-adept.html"
TARGET = ROOT / "marketing" / "test-cold-email-adept.eml"

ABSENDER = "Amanuel Kheyo <kheyo@adeptandpartners.de>"
EMPFAENGER = "Info@youman-automation.com"

# Plain-Text-Fassung. Bewusst von Hand gepflegt statt aus dem HTML generiert -
# im Text traegt die Struktur der Zeilenumbruch, nicht das Markup.
PLAIN = """Hallo Frau Berger,

Ihr Beitrag zur neuen Fertigungslinie in Ense - deshalb schreibe ich Ihnen.

In Produktion, Logistik und Supply Chain sehen wir fast immer dasselbe
Muster: Das ERP verwaltet die Auftraege sauber, aber die eigentliche Planung
laeuft daneben - in Excel, im Kopf einzelner Mitarbeiter, per Zuruf. Jede
Abweichung kostet Handarbeit, und niemand sieht sie im System.

Bei einem Gitterdraht-Hersteller waren es 2.556 verschiedene Palettentypen,
jede Kalkulation von Hand. Wir haben ein Modul gebaut, das die Auftragsdaten
per API aus dem ERP zieht, Standard- und Sonderpaletten automatisch
klassifiziert und die Variantenzahl massiv reduziert hat.

Kein Systemwechsel. Keine Medienbrueche. Eine Oberflaeche.

Was wir machen:
- Prozessberatung von der Produktionsplanung bis zur Logistik
- Massgeschneiderte Software, eingebettet in adept&
- Integration in SAP, Microsoft Dynamics, infor & Co.
- Rollout im Betrieb, inklusive Schulung der Mitarbeiter

Fuer wen: Automobil & Zulieferer, Maschinenbau & Fertigung,
Logistik & Supply Chain, Chemie & Prozessindustrie, E-Commerce

Ob so etwas bei Meridian Fertigung ueberhaupt passt, weiss ich nicht - dafuer
kenne ich Ihre Prozesse zu wenig. 15 Minuten wuerden reichen, um genau das zu
klaeren. Falls das Thema bei Ihnen keine Rolle spielt, sagen Sie kurz
Bescheid - dann melde ich mich nicht wieder.

Termin waehlen: https://calendar.app.google/1EqR2m9HM2mKRmLT6

Viele Gruesse
Amanuel Kheyo
CEO & CTO, adept&
+49 155 67541365 | kheyo@adeptandpartners.de
www.adeptandpartners.de

--
adept& GbR, Duelmener Weg 86a, 46325 Borken
Vertreten durch Amanuel Kheyo
Ihre geschaeftlichen Kontaktdaten stammen aus oeffentlich zugaenglichen
Quellen. Sie koennen der Verwendung jederzeit widersprechen - eine kurze
Antwort genuegt, dann hoeren Sie nichts mehr von uns.
"""


def load_builder():
    """Holt variant() und fill() aus dem Vorschau-Skript (Bindestrich im Namen)."""
    spec = importlib.util.spec_from_file_location(
        "build_mail_preview", ROOT / "scripts" / "build-mail-preview.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    empfaenger = sys.argv[1] if len(sys.argv) > 1 else EMPFAENGER
    builder = load_builder()

    html = builder.fill(builder.variant(SOURCE.read_text(encoding="utf-8"), "ind"))
    subject = re.search(r"<title>(.*?)</title>", html, re.S).group(1).strip()

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = ABSENDER
    msg["To"] = empfaenger
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="adeptandpartners.de")
    msg.set_content(PLAIN)
    msg.add_alternative(html, subtype="html")

    TARGET.write_bytes(msg.as_bytes())
    print(f"geschrieben: {TARGET.relative_to(ROOT)} ({TARGET.stat().st_size} Bytes)")
    print(f"  an:      {empfaenger}")
    print(f"  Betreff: {subject}")


if __name__ == "__main__":
    main()
