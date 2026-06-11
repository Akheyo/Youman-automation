"""Test: Manuelle Lagerpaletten haben Vorrang vor auto-generierten Standards.

Szenario aus Issue: Artikel 1200x800, manuelle Standardpalette 1200x800
vorhanden (Toleranz +100mm), aber Optimizer wählt 830x1230 weil dieser
mehr Artikel abdeckt. Erwartetes Verhalten: 1200x800 wird verwendet.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from optimierer_kern import optimiere  # noqa: E402


def _orders(*dims):
    """Erzeugt Auftrags-Liste aus (L, B)-Tupeln mit menge=1."""
    return [{"L": l, "B": b, "menge": 1, "auftrag": f"A{i}", "name": f"A{i}"}
            for i, (l, b) in enumerate(dims)]


def test_exakter_treffer_manuell():
    """Artikel 1200x800 → manueller Standard 1200x800 muss verwendet werden."""
    orders = _orders((1200, 800))
    r = optimiere(
        orders,
        tol_kurz_mm=100,
        tol_lang_mm=100,
        katalog=[(800, 1200)],
        manuelle_masse=[(800, 1200)],
    )
    zuord = r["zuordnung"]
    assert len(zuord) == 1
    ziel = zuord[0]["ziel"]
    # Muss 800x1200 (oder 1200x800) sein — kein 830x1230
    assert "800" in ziel and "1200" in ziel, (
        f"Erwartet 800x1200, bekommen: {ziel}"
    )


def test_toleranz_treffer_manuell():
    """Artikel 1100x700 → manueller Standard 1200x800 passt innerhalb tol=100mm."""
    orders = _orders((1100, 700))
    r = optimiere(
        orders,
        tol_kurz_mm=100,
        tol_lang_mm=100,
        katalog=[(800, 1200)],
        manuelle_masse=[(800, 1200)],
    )
    zuord = r["zuordnung"]
    assert len(zuord) == 1
    ziel = zuord[0]["ziel"]
    assert "800" in ziel and "1200" in ziel, (
        f"Erwartet 800x1200, bekommen: {ziel}"
    )


def test_manuell_schlaegt_groesseren_auto_cluster():
    """Mehrere Artikel — manueller Standard 1200x800 gewinnt gegen
    einen auto-Kandidaten der mehr Artikel abdeckt aber kein Lagermaß ist."""
    # Artikel A: exakt 1200x800 → manueller Standard passt exakt
    # Artikel B: 1100x750 → manueller Standard 1200x800 passt (delta < 100)
    # Artikel C: 1300x900 → passt NICHT in 1200x800 (1300 > 1200+100=1300 → grenzwertig)
    # Ein auto-Kandidat 1300x900 würde B+C abdecken, aber manueller 1200x800 hat Vorrang für A+B
    orders = _orders((1200, 800), (1100, 750))
    r = optimiere(
        orders,
        tol_kurz_mm=100,
        tol_lang_mm=100,
        katalog=[(800, 1200)],
        manuelle_masse=[(800, 1200)],
    )
    for zg in r["zuordnung"]:
        ziel = zg["ziel"]
        assert "800" in ziel and "1200" in ziel, (
            f"Auftrag {zg['auftrag']}: erwartet 800x1200, bekommen: {ziel}"
        )


def test_kein_manuell_kein_vorrang():
    """Ohne manuelle_masse läuft alles wie bisher (Regression)."""
    orders = _orders((1200, 800))
    r = optimiere(
        orders,
        tol_kurz_mm=100,
        tol_lang_mm=100,
        katalog=[(800, 1200)],
        # manuelle_masse nicht übergeben
    )
    # Muss trotzdem eine Zuordnung liefern
    assert len(r["zuordnung"]) == 1
    assert r["invariante_ok"]


def test_ohne_passenden_manuell_sonder_erlaubt():
    """Artikel 1500x900 — kein manueller Standard passt (1200x800 zu klein).
    Fallback auf auto-generierten Kandidaten muss funktionieren."""
    orders = _orders((1500, 900))
    r = optimiere(
        orders,
        tol_kurz_mm=100,
        tol_lang_mm=100,
        katalog=[(800, 1200)],
        manuelle_masse=[(800, 1200)],
    )
    # Auftrag landet als Sonder oder wird auto-zugeordnet — kein Absturz
    assert len(r["zuordnung"]) == 1
    assert r["invariante_ok"]
