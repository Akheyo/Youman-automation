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
PLAIN = """Guten Tag {{anrede}},

viele Produktionsunternehmen arbeiten heute mit soliden ERP- oder
SAP-Systemen, und trotzdem laufen einzelne operative Prozesse im Alltag noch
manuell, etwa bei Sonderfaellen in der Auftragsabwicklung, bei
wiederkehrenden Planungsschritten oder bei der Abstimmung zwischen Fertigung
und Logistik.

Genau an solchen Stellen setzt adept& an. Wir entwickeln kundenspezifische
Workflow-Module, die direkt in bestehende Systeme integriert werden, ohne
diese zu ersetzen.

So lassen sich Variantenkomplexitaet reduzieren, Durchlaufzeiten verkuerzen
und wiederkehrende manuelle Schritte automatisieren, ohne dass ein
Systemwechsel notwendig wird.

Was wir machen:
- Prozessberatung von der Produktionsplanung bis zur Logistik
- Massgeschneiderte Software, eingebettet in adept&
- Integration in SAP, Microsoft Dynamics, infor & Co.
- Rollout im Betrieb, inklusive Schulung der Mitarbeiter

Fuer wen: Automobil & Zulieferer, Maschinenbau & Fertigung,
Logistik & Supply Chain, Chemie & Prozessindustrie, E-Commerce

Falls das fuer Ihr Unternehmen relevant sein koennte, wuerde ich mich ueber
einen kurzen Austausch freuen, um zu verstehen, wo bei Ihnen aktuell die
groessten operativen Reibungspunkte liegen.

Termin waehlen: https://calendar.app.google/1EqR2m9HM2mKRmLT6

Beste Gruesse
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
    plain = builder.fill(PLAIN)
    subject = re.search(r"<title>(.*?)</title>", html, re.S).group(1).strip()

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = ABSENDER
    msg["To"] = empfaenger
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="adeptandpartners.de")
    msg.set_content(plain)
    msg.add_alternative(html, subtype="html")

    TARGET.write_bytes(msg.as_bytes())
    print(f"geschrieben: {TARGET.relative_to(ROOT)} ({TARGET.stat().st_size} Bytes)")
    print(f"  an:      {empfaenger}")
    print(f"  Betreff: {subject}")


if __name__ == "__main__":
    main()
