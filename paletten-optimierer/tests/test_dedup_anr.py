"""E2: Dedup-Schluessel um ANr (Abrufnummer) erweitert.

Kunde ruft denselben Auftrag mehrfach ab (verschiedene ANr).
Der alte Dedup-Schluessel (auftrag, artikelnummer) hätte die
Abrufe 2, 3, ... faelschlicherweise als "schon bestellt"
markiert. Der neue Schluessel (auftrag, artikelnummer, anr)
haelt sie auseinander.
"""
from __future__ import annotations

import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

from import_doppelschutz import pruefe_import  # noqa: E402


def _neue_zeile(auftrag, anr, art, menge=30):
    return {"auftrag": auftrag, "anr": anr, "artikelnummer": art,
            "name": "Kunde X", "anzahl": menge,
            "verbrauchsdatum": "2026-08-15"}


def _historien_eintrag(aw, anr, art, menge=30, status="offen"):
    return {"auftragsnummer_aw": aw, "anr": anr, "artikelnummer": art,
            "kunde": "Kunde X", "menge": menge, "status": status,
            "bestelldatum": "2026-08-01",
            "geplantes_verbrauchsdatum": "2026-08-15", "id": f"hst-{aw}-{anr}"}


def test_drei_abrufe_gleicher_auftrag_alle_neu():
    """Erste Bestellrunde: drei Abrufe (ANr 1, 2, 3) desselben
    Auftrags/Artikels landen alle in der Bestellliste."""
    zeilen = [
        _neue_zeile("100100", "1", "X", 30),
        _neue_zeile("100100", "2", "X", 30),
        _neue_zeile("100100", "3", "X", 40),
    ]
    r = pruefe_import(zeilen, aktive_bestellungen=[])
    assert len(r["neu"]) == 3
    assert len(r["schon_bestellt"]) == 0
    assert len(r["teilbedarf"]) == 0


def test_reimport_alle_drei_bereits_bestellt():
    """Nach dem ersten Import stehen alle drei Abrufe in der Historie.
    Bei Re-Import derselben Excel werden sie als bereits bestellt
    erkannt — WEIL ANr im Schluessel steckt."""
    historie = [
        _historien_eintrag("100100", "1", "X", 30),
        _historien_eintrag("100100", "2", "X", 30),
        _historien_eintrag("100100", "3", "X", 40),
    ]
    r = pruefe_import([
        _neue_zeile("100100", "1", "X", 30),
        _neue_zeile("100100", "2", "X", 30),
        _neue_zeile("100100", "3", "X", 40),
    ], aktive_bestellungen=historie)
    assert len(r["schon_bestellt"]) == 3
    assert len(r["neu"]) == 0


def test_neuer_abruf_wird_als_neu_erkannt():
    """ANr 1..3 sind schon in Historie. ANr 4 kommt neu dazu.
    NUR ANr 4 landet in 'neu', 1..3 in 'schon_bestellt'."""
    historie = [
        _historien_eintrag("100100", "1", "X", 30),
        _historien_eintrag("100100", "2", "X", 30),
        _historien_eintrag("100100", "3", "X", 40),
    ]
    r = pruefe_import([
        _neue_zeile("100100", "1", "X", 30),
        _neue_zeile("100100", "2", "X", 30),
        _neue_zeile("100100", "3", "X", 40),
        _neue_zeile("100100", "4", "X", 25),   # neu
    ], aktive_bestellungen=historie)
    assert len(r["neu"]) == 1
    neu_zeile, _ = r["neu"][0]
    assert neu_zeile["anr"] == "4"
    assert len(r["schon_bestellt"]) == 3


def test_regression_alter_dedup_haette_alle_ignoriert():
    """Der alte Dedup (auftrag+artikelnummer) haette nach dem ersten
    Treffer (ANr=1) die ANrs 2 und 3 auch als 'schon_bestellt'
    gemeldet — obwohl sie neue Abrufe sind. Das darf NICHT mehr
    passieren.

    Historie enthaelt nur ANr=1. Neue Excel bringt ANr 2 und 3 mit.
    Mit dem neuen Schluessel: 2 + 3 werden als 'neu' erkannt.
    """
    historie = [
        _historien_eintrag("100100", "1", "X", 30),
    ]
    r = pruefe_import([
        _neue_zeile("100100", "2", "X", 30),
        _neue_zeile("100100", "3", "X", 40),
    ], aktive_bestellungen=historie)
    assert len(r["neu"]) == 2, (
        f"Erwartet 2 neue Abrufe, bekam {len(r['neu'])} "
        f"(alter Dedup-Bug wuerde 0 zurueckgeben)"
    )
    assert all(z.get("anr") in ("2", "3") for z, _ in r["neu"])


def test_leere_anr_beidseitig_matched_wie_vorher():
    """Wenn weder in Historie noch in neuer Zeile eine ANr steht
    (Alt-Daten), matched es wie vor E2 -> 'schon_bestellt'."""
    historie = [
        {"auftragsnummer_aw": "100200", "anr": "", "artikelnummer": "Y",
         "kunde": "Kunde X", "menge": 10, "status": "offen",
         "id": "old-1"},
    ]
    r = pruefe_import([
        {"auftrag": "100200", "anr": "", "artikelnummer": "Y",
         "name": "Kunde X", "anzahl": 10, "verbrauchsdatum": ""},
    ], aktive_bestellungen=historie)
    assert len(r["schon_bestellt"]) == 1
    assert len(r["neu"]) == 0


if __name__ == "__main__":
    tests = [test_drei_abrufe_gleicher_auftrag_alle_neu,
             test_reimport_alle_drei_bereits_bestellt,
             test_neuer_abruf_wird_als_neu_erkannt,
             test_regression_alter_dedup_haette_alle_ignoriert,
             test_leere_anr_beidseitig_matched_wie_vorher]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
            sys.exit(1)
    print(f"\n{len(tests)}/{len(tests)} ANr-Dedup-Tests bestanden.")
