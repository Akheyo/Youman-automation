"""Tests fuer Palettenkatalog + Tie-Breaker im Solver.

a) CRUD: neu/update/loesche/alle
b) Korrupte JSON -> alle() = [], kein Crash
c) Solver-Tie-Breaker: Katalog veraendert das Gesamt-Optimum NIE,
   aber bevorzugt Katalog-Maße bei mehreren optimalen Lösungen
d) lookup_preise findet Preise auch fuer gedrehte Maße
"""
from __future__ import annotations

import io
import os
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

# Isolierter Test-Pfad VOR dem Import des Moduls
_TMP = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
_TMP.close()
os.environ["PALETTENMINI_KATALOG"] = _TMP.name

import palettenkatalog as kat  # noqa: E402
from optimierer_kern import optimiere  # noqa: E402


def _reset():
    p = Path(_TMP.name)
    if p.exists():
        p.unlink()


def test_a_crud():
    _reset()
    e1 = kat.neuer_eintrag(1200, 800, 14.50, 22.00,
                            bestand=100, meldebestand=20, notiz="EU")
    e2 = kat.neuer_eintrag(1500, 1000, 18.00, 28.00)
    e3 = kat.neuer_eintrag(2000, 600, 16.00, 24.00)
    assert len(kat.alle()) == 3
    # Update inkl. neue Bestand/Meldebestand-Felder
    assert kat.update_eintrag(e2, verkaufspreis_eur=30.00,
                                bestand=50, meldebestand=10) is True
    e2_now = next(e for e in kat.alle() if e["id"] == e2)
    assert e2_now["verkaufspreis_eur"] == 30.00
    assert e2_now["bestand"] == 50
    assert e2_now["meldebestand"] == 10
    # Delete
    assert kat.loesche_eintrag(e3) is True
    assert len(kat.alle()) == 2
    masse = sorted(kat.aktive_masse())
    assert masse == [(800, 1200), (1000, 1500)], masse
    print(f"  CRUD OK — {len(kat.alle())} Eintraege, Maße {masse}, "
          f"e1.bestand=100/meld=20, e2.bestand=50/meld=10")


def test_e_meldebestand_warnung():
    """kritische_bestaende liefert nur Eintraege mit Meldebestand>0
    UND Bestand<=Meldebestand UND aktiv."""
    _reset()
    # Normal: Bestand > Meldebestand → keine Warnung
    eA = kat.neuer_eintrag(1200, 800, 0, 0, bestand=100, meldebestand=20)
    # Kritisch: Bestand == Meldebestand → Warnung
    eB = kat.neuer_eintrag(1500, 1000, 0, 0, bestand=10, meldebestand=10)
    # Kritisch: Bestand < Meldebestand → Warnung
    eC = kat.neuer_eintrag(2000, 600, 0, 0, bestand=2, meldebestand=5)
    # Meldebestand=0 (= aus) → niemals Warnung
    eD = kat.neuer_eintrag(1100, 700, 0, 0, bestand=0, meldebestand=0)
    # Inaktiv → ignoriert
    eE = kat.neuer_eintrag(900, 600, 0, 0, bestand=0, meldebestand=10,
                           aktiv=False)

    kritisch = kat.kritische_bestaende()
    ids = {e["id"] for e in kritisch}
    print(f"  Kritische IDs: {[e['L_mm'] for e in kritisch]}")
    assert eA not in ids, "Bestand=100 > Meldebestand=20 -> KEINE Warnung"
    assert eB in ids, "Bestand=10 = Meldebestand=10 -> Warnung"
    assert eC in ids, "Bestand=2 < Meldebestand=5 -> Warnung"
    assert eD not in ids, "Meldebestand=0 -> NIE Warnung"
    assert eE not in ids, "Inaktiv -> ignoriert"
    print(f"  Meldebestand-Logik OK ({len(kritisch)} kritisch von 5).")


def test_f_set_bestand():
    _reset()
    eid = kat.neuer_eintrag(1200, 800, 0, 0, bestand=100, meldebestand=20)
    assert kat.set_bestand(eid, 50) is True
    e = next(x for x in kat.alle() if x["id"] == eid)
    assert e["bestand"] == 50
    # Negative Werte werden auf 0 geclampt
    kat.set_bestand(eid, -10)
    e = next(x for x in kat.alle() if x["id"] == eid)
    assert e["bestand"] == 0
    print(f"  set_bestand: 100 -> 50 -> 0 (negative clamped).")


def test_g_alte_json_ohne_bestand_felder():
    """Rueckwaerts-Kompatibilitaet: alte JSON ohne bestand/meldebestand."""
    _reset()
    # Direkt eine Alt-Version reinschreiben
    import json
    altes_schema = [{
        "id": "alt1", "datum_erstellt": "2024-01-01T00:00:00",
        "L_mm": 1200, "B_mm": 800,
        "einkaufspreis_eur": 14.0, "verkaufspreis_eur": 22.0,
        "notiz": "", "aktiv": True,
        # KEINE bestand/meldebestand-Felder
    }]
    Path(_TMP.name).write_text(json.dumps(altes_schema), encoding="utf-8")
    eintraege = kat.alle()
    assert len(eintraege) == 1
    # kritische_bestaende kommt nicht ins Stolpern
    krit = kat.kritische_bestaende()
    assert krit == []
    print(f"  Alte JSON ohne bestand/meldebestand: kein Crash.")


def test_b_korrupte_json():
    _reset()
    Path(_TMP.name).write_text("{kaputt\nbroken", encoding="utf-8")
    assert kat.alle() == [], "Korrupte JSON muss [] liefern"
    assert kat.aktive_masse() == []
    # Neue Eintraege legen saubere Datei an
    kat.neuer_eintrag(1200, 800, 10, 20)
    assert len(kat.alle()) == 1
    print(f"  Korrupte JSON wird sauber ueberschrieben, kein Crash.")


def test_c_tiebreaker_aendert_gesamt_nicht():
    """Mit oder ohne Katalog — das Gesamt muss IMMER gleich sein,
    aber Katalog-Maße werden bei Gleichstand bevorzugt."""
    # Aufträge so gewählt, dass mehrere optimale Lösungen existieren:
    # - Auftrag A (1190x790): kann von (800,1200) Katalog ODER von
    #   (790, 1190) als Singleton-Standard gedeckt werden
    # - Auftrag B (1490x990): analog mit (1000,1500) Katalog
    orders = [
        {"L": 1190, "B": 790, "menge": 5, "auftrag": "A1", "name": ""},
        {"L": 1490, "B": 990, "menge": 4, "auftrag": "B1", "name": ""},
    ]
    r1 = optimiere(orders, tol_kurz_mm=100, tol_lang_mm=100,
                   max_kombi_teile=1, heterogen_fallback=False)
    r2 = optimiere(orders, tol_kurz_mm=100, tol_lang_mm=100,
                   max_kombi_teile=1, heterogen_fallback=False,
                   katalog=[(800, 1200), (1000, 1500)])
    print(f"  Ohne Katalog: std={len(r1['standards'])} {r1['standards']}")
    print(f"  Mit Katalog:  std={len(r2['standards'])} {r2['standards']}")
    assert r1["gesamt"] == r2["gesamt"] == 2, (
        f"Beide Loesungen muessen 2 Standards haben: ohne={r1['gesamt']}, "
        f"mit={r2['gesamt']}"
    )
    # Mit Katalog: die 2 Standards MÜSSEN exakt die Katalog-Maße sein
    # (sie sind ja als deckende Standards verfügbar und gleich gut)
    kat_set = {(800, 1200), (1000, 1500)}
    treffer = sum(1 for s in r2["standards"] if s in kat_set)
    assert treffer == 2, (
        f"Erwartet 2 Katalog-Hits, bekam {treffer}. "
        f"Standards mit Katalog: {r2['standards']}"
    )


def test_d_lookup_preise_kanonisch():
    _reset()
    kat.neuer_eintrag(1200, 800, 14.50, 22.00)
    # Lookup fuer dasselbe Maß egal in welcher Orientierung
    p1 = kat.lookup_preise(1200, 800)
    p2 = kat.lookup_preise(800, 1200)  # gedreht
    assert p1 is not None and p2 is not None
    assert p1["einkaufspreis_eur"] == 14.50
    assert p1 == p2, "Lookup muss orientierungs-unabhaengig sein"
    # Unbekanntes Maß -> None
    assert kat.lookup_preise(9999, 9999) is None
    print(f"  Lookup-Preise OK (kanonisch, orientierungs-unabhaengig).")


def _run(fn):
    try:
        fn()
        print(f"OK  {fn.__name__}")
        return True
    except AssertionError as e:
        print(f"FAIL {fn.__name__}: {e}")
        return False


if __name__ == "__main__":
    tests = [test_a_crud, test_b_korrupte_json,
             test_c_tiebreaker_aendert_gesamt_nicht,
             test_d_lookup_preise_kanonisch,
             test_e_meldebestand_warnung,
             test_f_set_bestand,
             test_g_alte_json_ohne_bestand_felder]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Katalog-Tests bestanden.")
    try:
        Path(_TMP.name).unlink(missing_ok=True)
    except Exception:
        pass
    sys.exit(0 if erfolge == len(tests) else 1)
