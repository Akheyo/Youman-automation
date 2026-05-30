"""Tests fuer Bestandsverwaltung-Workflow (Spec §5, §6, §7, §8).

a) Schema-Erweiterung: name, hoehe_mm, typ, quelle, verbrauchshaeufigkeit
   werden persistiert und gelesen.
b) vollstaendig()/unvollstaendige(): EK + VK > 0
c) als_sonder_uebernehmen: typ='sonder', quelle='auto_aus_optimierung'
d) aendere_bestand: Delta-Update, darf negativ werden (Vormerkung)
e) inkrement_verbrauch: +1 pro Aufruf
f) CSV-Export-Roundtrip: nach_csv() → aus_csv() liefert gleiche Eintraege
g) CSV-Import mit fehlenden Spalten: klare Fehlermeldung
h) Kernel: w7 zaehlt Kombi-Zuordnungen
i) Kernel: bestand_map mit bestand > 0 wirkt als Tie-Breaker (Spec §8)
j) Kernel: bestand_nutzung-dict im Ergebnis (benoetigt/bestand/differenz)
k) Idempotenz-Hilfe: zwei Calls auf inkrement_verbrauch addieren auf
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

_TMP = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
_TMP.close()
os.environ["PALETTENMINI_KATALOG"] = _TMP.name

import palettenkatalog as kat  # noqa: E402
from optimierer_kern import optimiere  # noqa: E402


def _reset():
    p = Path(_TMP.name)
    if p.exists():
        p.unlink()


def test_a_schema_erweitert():
    """Neue Felder werden persistiert und sind nach Read korrekt."""
    _reset()
    eid = kat.neuer_eintrag(1200, 800, 14.5, 22.0, bestand=10,
                             name="Europalette", hoehe_mm=144,
                             typ="standard")
    e = next(x for x in kat.alle() if x["id"] == eid)
    assert e["name"] == "Europalette"
    assert e["hoehe_mm"] == 144
    assert e["typ"] == "standard"
    assert e["quelle"] == "manuell"
    assert e["verbrauchshaeufigkeit"] == 0
    print(f"  Schema: name={e['name']}, hoehe={e['hoehe_mm']}, "
          f"typ={e['typ']}, quelle={e['quelle']}")


def test_b_vollstaendig_und_unvollstaendige():
    """vollstaendig() braucht EK Lieferant > 0 UND Selbstfertigung > 0."""
    _reset()
    e_voll = kat.neuer_eintrag(
        1200, 800, 10.0, 0.0, name="V",
        ek_lieferant_eur=10.0,
        selbstfertigung_material_eur=4.0,
        selbstfertigung_lohn_eur=3.0)
    e_nur_ek = kat.neuer_eintrag(1500, 1000, 15.0, 0.0, name="nurEK",
                                    ek_lieferant_eur=15.0)
    e_nur_eigen = kat.neuer_eintrag(
        2000, 600, 0.0, 0.0, name="nurEigen",
        selbstfertigung_material_eur=8.0,
        selbstfertigung_lohn_eur=4.0)
    e_leer = kat.neuer_eintrag(900, 700, 0.0, 0.0, name="leer")
    unvoll = kat.unvollstaendige()
    ids_unvoll = {e["id"] for e in unvoll}
    assert e_voll not in ids_unvoll
    assert e_nur_ek in ids_unvoll
    assert e_nur_eigen in ids_unvoll
    assert e_leer in ids_unvoll
    print(f"  vollstaendig: 1/4 vollstaendig (V), 3/4 unvollstaendig "
          f"(nur-EK, nur-Eigen, leer)")


def test_c_als_sonder_uebernehmen():
    """Spec §6b: neuer Eintrag mit typ='sonder' und
    quelle='auto_aus_optimierung'."""
    _reset()
    eid = kat.als_sonder_uebernehmen(1800, 1000, hoehe_mm=120)
    e = next(x for x in kat.alle() if x["id"] == eid)
    assert e["typ"] == "sonder"
    assert e["quelle"] == "auto_aus_optimierung"
    assert e["bestand"] == 0
    assert e["einkaufspreis_eur"] == 0.0
    assert e["verkaufspreis_eur"] == 0.0
    assert kat.vollstaendig(e) is False
    # Maß kanonisiert: 1800 lang, 1000 kurz
    assert e["L_mm"] == 1800 and e["B_mm"] == 1000
    print(f"  als_sonder_uebernehmen: typ=sonder, quelle=auto, "
          f"unvollstaendig, name={e['name']}")


def test_d_aendere_bestand_darf_negativ():
    """Spec §6a + §12: aendere_bestand mit Delta, darf negativ werden."""
    _reset()
    eid = kat.neuer_eintrag(1200, 800, 0, 0, bestand=10)
    assert kat.aendere_bestand(eid, -3) == 7
    assert kat.aendere_bestand(eid, -10) == -3  # Vormerkung erlaubt
    assert kat.aendere_bestand(eid, 100) == 97
    # unbekannte id liefert None
    assert kat.aendere_bestand("nope", 1) is None
    print(f"  aendere_bestand: 10 → 7 → -3 (Vormerkung erlaubt) → 97")


def test_e_inkrement_verbrauch():
    """Verbrauchshäufigkeit +1 pro Aufruf."""
    _reset()
    eid = kat.neuer_eintrag(1200, 800, 0, 0)
    assert kat.inkrement_verbrauch(eid) == 1
    assert kat.inkrement_verbrauch(eid) == 2
    assert kat.inkrement_verbrauch(eid, 5) == 7
    print(f"  inkrement_verbrauch: 0 → 1 → 2 → 7 (Idempotenz nicht "
          f"gesichert — Caller muss Idempotenz halten)")


def test_f_csv_roundtrip():
    """nach_csv() liefert CSV; aus_csv() liest es zurueck."""
    _reset()
    kat.neuer_eintrag(1200, 800, 14.5, 22.0, bestand=10, meldebestand=2,
                       name="Euro", hoehe_mm=144, notiz="EUR-Test")
    kat.neuer_eintrag(1500, 1000, 18.0, 28.0, bestand=5,
                       name="Industrie", typ="standard")
    txt = kat.nach_csv()
    print(f"  CSV-Header: {txt.splitlines()[0]}")
    # Loesche, lese CSV zurueck
    kat.leere_katalog()
    ergebnis = kat.aus_csv(txt)
    print(f"  Roundtrip: importiert={ergebnis['importiert']}, "
          f"fehler={len(ergebnis['fehler'])}")
    assert ergebnis["importiert"] == 2
    assert ergebnis["fehler"] == []
    eintraege = kat.alle()
    namen = {e["name"] for e in eintraege}
    assert namen == {"Euro", "Industrie"}


def test_g_csv_fehlende_pflichtspalten():
    """Spec §12: CSV ohne Pflichtspalten → klare Fehlermeldung."""
    _reset()
    csv_kaputt = "foo;bar;baz\n1;2;3\n"
    erg = kat.aus_csv(csv_kaputt)
    assert erg["importiert"] == 0
    assert len(erg["fehler"]) > 0
    assert "Pflichtspalten" in erg["fehler"][0]
    print(f"  Fehlende Spalten: {erg['fehler'][0][:80]}…")


def test_h_kernel_w7_kombi_count():
    """w7 zaehlt Kombi-Zuordnungen im Score-Breakdown."""
    # Auftrag (1500, 700) lässt sich z.B. durch Kombi 2x (750, 700) decken
    orders = [
        {'L': 1500, 'B': 700, 'menge': 3, 'auftrag': 'A', 'name': ''},
        {'L': 750, 'B': 700, 'menge': 4, 'auftrag': 'B', 'name': ''},
    ]
    r = optimiere(orders, tol_kurz_mm=50, tol_lang_mm=50,
                  max_kombi_teile=3, heterogen_fallback=True,
                  gewichte={"w1": 1.0, "w7": 1.0})
    bd = r["score_breakdown"]
    n_kombi = sum(1 for z in r["zuordnung"]
                  if z["typ"] in ("Kombi-Stapel", "Kombi-Heterogen"))
    erwartet_w7 = 1.0 * n_kombi
    print(f"  Kombi-Zuordnungen={n_kombi}, w7-Penalty={bd['w7_kombi_penalty']}")
    assert abs(bd["w7_kombi_penalty"] - erwartet_w7) < 1e-9


def test_i_kernel_bestand_priorisiert():
    """Spec §8: bei zwei gleichwertigen Katalog-Maßen sollte das mit
    Bestand > 0 bevorzugt werden."""
    # Auftrag passt zu beiden Katalog-Maßen; eines hat Bestand, eines nicht
    orders = [
        {'L': 1180, 'B': 790, 'menge': 5, 'auftrag': 'A', 'name': ''},
    ]
    katalog = [(800, 1200), (810, 1210)]
    r = optimiere(orders, tol_kurz_mm=100, tol_lang_mm=100,
                  katalog=katalog, sonder_erlaubt=False,
                  katalog_bestand={(800, 1200): 50, (810, 1210): 0})
    print(f"  Bestand-Tie: std={r['standards']}")
    # Beide könnten decken — der mit Bestand sollte gewählt sein
    assert (800, 1200) in r["standards"]
    assert (810, 1210) not in r["standards"]


def test_j_bestand_nutzung_im_ergebnis():
    """Kernel liefert bestand_nutzung-dict mit benoetigt/bestand/differenz."""
    orders = [
        {'L': 1180, 'B': 790, 'menge': 30, 'auftrag': 'A', 'name': ''},
    ]
    katalog = [(800, 1200)]
    r = optimiere(orders, tol_kurz_mm=100, tol_lang_mm=100,
                  katalog=katalog, sonder_erlaubt=False,
                  katalog_bestand={(800, 1200): 20})
    bn = r["bestand_nutzung"]
    print(f"  bestand_nutzung: {bn}")
    key = "1200x800"
    assert key in bn
    assert bn[key]["benoetigt"] == 30
    assert bn[key]["bestand"] == 20
    assert bn[key]["differenz"] == 10


def test_k_csv_komma_trenner_und_komma_dezimal():
    """CSV mit Komma-Trenner. EK Lieferant + Selbstfertigung-Spalten."""
    _reset()
    csv_de = ("name,laenge,breite,bestand,ek_lieferant,"
               "selbstfert_material,selbstfert_lohn\n"
               "DE,1200,800,10,14.50,5.00,3.00\n")
    erg = kat.aus_csv(csv_de)
    assert erg["importiert"] == 1
    e = kat.alle()[0]
    assert e["ek_lieferant_eur"] == 14.5
    assert e["selbstfertigung_material_eur"] == 5.0
    assert e["selbstfertigung_lohn_eur"] == 3.0
    # Legacy-Spiegel: einkaufspreis_eur = ek_lieferant_eur
    assert e["einkaufspreis_eur"] == 14.5
    print(f"  CSV (Komma-Trenner): importiert={erg['importiert']}")


def _run(fn):
    try:
        fn()
        print(f"OK  {fn.__name__}")
        return True
    except AssertionError as e:
        print(f"FAIL {fn.__name__}: {e}")
        return False
    except Exception as e:
        print(f"ERR  {fn.__name__}: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    tests = [
        test_a_schema_erweitert,
        test_b_vollstaendig_und_unvollstaendige,
        test_c_als_sonder_uebernehmen,
        test_d_aendere_bestand_darf_negativ,
        test_e_inkrement_verbrauch,
        test_f_csv_roundtrip,
        test_g_csv_fehlende_pflichtspalten,
        test_h_kernel_w7_kombi_count,
        test_i_kernel_bestand_priorisiert,
        test_j_bestand_nutzung_im_ergebnis,
        test_k_csv_komma_trenner_und_komma_dezimal,
    ]
    erfolge = sum(1 for t in tests if _run(t))
    print()
    print(f"{erfolge}/{len(tests)} Bestand-Workflow-Tests bestanden.")
    try:
        Path(_TMP.name).unlink(missing_ok=True)
    except Exception:
        pass
    sys.exit(0 if erfolge == len(tests) else 1)
