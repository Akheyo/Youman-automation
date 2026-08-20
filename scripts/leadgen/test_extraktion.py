#!/usr/bin/env python3
"""Regressionstests fuer die Extraktionsmuster.

Die Muster sind regex-lastig; zwei Fehler sind hier bereits durchgerutscht
(fehlende Wortgrenze bei "USt", Datumsangaben als Telefonnummer). Aufruf:
    python3 test_extraktion.py
"""
import importlib.util
import sys

spec = importlib.util.spec_from_file_location("scraper", "impressum_scraper.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

fails = []


def check(label, got, want):
    if got != want:
        fails.append(f"{label}\n     erwartet: {want!r}\n     bekommen: {got!r}")


# --- Entscheidernamen ------------------------------------------------------
check("mehrere Geschaeftsfuehrer",
      m.pick_decision_maker("Geschäftsführer: Thomas Holz, Birgit Rohn, Jonathan Gschwendner")[0],
      "Thomas Holz; Birgit Rohn; Jonathan Gschwendner")
check("Rollenwort haengt am Namen",
      m.pick_decision_maker("Vertreten durch: Dr. Dominik Benner Verantwortlich für den Inhalt")[0],
      "Dr. Dominik Benner")
# Regression: "USt" ohne Wortgrenze schnitt "Max Mustermann" zu "Max M"
check("Name mit 'ust' darf nicht abgeschnitten werden",
      m.pick_decision_maker("Geschäftsführer: Max Mustermann Handelsregister: HRB 1234")[0],
      "Max Mustermann")
# Bewusste Grenze: die Stoppwoerter greifen als Praefix (damit "Register"
# auch "Registergericht" faengt). Ein Nachname, der mit einem Stoppwort
# BEGINNT, wuerde also abgeschnitten — das ist praktisch nicht relevant und
# der Preis dafuer, dass angehaengte Abschnittswoerter zuverlaessig wegfallen.
check("Stoppwort trennt Name und Folgeabschnitt",
      m.pick_decision_maker("Inhaber: Anna Bergmann Telefon: 030 123456")[0],
      "Anna Bergmann")
check("Firmierung ist keine Person",
      m.pick_decision_maker("Vertreten durch: Kaffeewerk Verwaltungs GmbH")[0], "")
check("Praeposition ist kein Name",
      m.pick_decision_maker("Verantwortlich für den Inhalt: In Sachen Klimaschutz")[0], "")

# --- Telefon ---------------------------------------------------------------
check("ISO-Datum ist keine Telefonnummer", m.pick_phone("Stand: 2026-08-20 20"), "")
check("Jahresspanne ist keine Telefonnummer", m.pick_phone("© 2015-2026 Muster GmbH"), "")
check("echte Nummer wird erkannt",
      m.pick_phone("Telefon: +49 541 75045-0"), "+49 541 75045-0")
check("Fax-Zeile wird uebersprungen",
      m.pick_phone("Telefax: 030 999888\nTelefon: 030 111222"), "030 111222")
check("zu kurze Ziffernfolge faellt raus", m.pick_phone("Tel. 12345"), "")

# --- Firmierung ------------------------------------------------------------
check("Domainwurzel schlaegt andere Treffer",
      m.pick_company("Andere Muster GmbH\nTeeGschwendner GmbH", "teegschwendner.de"),
      "TeeGschwendner GmbH")
check("GmbH & Co. KG bleibt vollstaendig",
      m.pick_company("Carl Prediger GmbH & Co. KG", "prediger.de"),
      "Carl Prediger GmbH & Co. KG")

# --- Register-/Steuernummern ----------------------------------------------
# Regression: "CHE" mit re.I matchte das "che" in "Rechtliches"
check("'Rechtliches' ist keine Registernummer", m.first(m.HRB_RE, "Rechtliches"), "")
check("HRB wird erkannt", m.first(m.HRB_RE, "Amtsgericht Jena HRB 205123"), "HRB 205123")
check("CHE-Nummer wird erkannt",
      m.first(m.HRB_RE, "CHE-116.281.277"), "CHE-116.281.277")
check("USt-IdNr wird erkannt", m.first(m.VAT_RE, "USt-IdNr.: DE123456789"), "DE123456789")

# --- Adresse ---------------------------------------------------------------
check("Strasse und Ort aus Adressblock",
      m.pick_address("Hiberniastraße 5\n45731 Waltrop", "DE"),
      ("Hiberniastraße 5", "45731", "Waltrop"))
check("Jahreszahl ist keine PLZ",
      m.pick_address("2026 Kollektion Scott", "DE")[1], "")

# --- Anti-Spam-Schreibweisen ----------------------------------------------
# "muster"/"example" stehen selbst auf der Platzhalter-Sperrliste, daher
# eine neutrale Testdomain.
check("(at)/(dot) werden zurueckuebersetzt",
      m.pick_email(m.clean_text("info (at) kaffeewerk (dot) de"), "kaffeewerk.de"),
      "info@kaffeewerk.de")

if fails:
    print(f"FEHLGESCHLAGEN: {len(fails)}")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("alle Extraktionstests bestanden")
