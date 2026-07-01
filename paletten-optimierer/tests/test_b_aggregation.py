"""B1/B4: Aggregation Maße + Menge sowie Dashboard-Kern.

Verifiziert die Aggregations-Logik (Ziel-Text -> Summe Menge, sortiert
absteigend) und den mailto-Link-Aufbau.
"""
from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import quote as _q

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))
sys.path.insert(0, str(HIER))


def _aggregate_masse_menge(zuordnung: list[dict]) -> list[dict]:
    """1:1-Kopie der Aggregations-Logik aus app.py (B4)."""
    from collections import Counter
    ziel_summe: Counter = Counter()
    for z in zuordnung:
        ziel = z.get("ziel", "")
        if not ziel:
            continue
        ziel_summe[ziel] += int(z.get("menge", 0) or 0)
    return sorted(
        [{"Maß": ziel, "Bedarfsmenge (Paletten)": menge}
         for ziel, menge in ziel_summe.items()],
        key=lambda r: -r["Bedarfsmenge (Paletten)"],
    )


def _aktion_menge_pro_typ(zuordnung: list[dict]) -> dict[tuple[int, int], int]:
    """1:1-Kopie der Aggregations-Logik aus app.py (B1)."""
    from collections import defaultdict
    aktion_menge: dict = defaultdict(int)
    for z in zuordnung:
        if z.get("typ") != "Standard":
            continue
        try:
            a, b = z["ziel"].split("x")
            canon = (min(int(a), int(b)), max(int(a), int(b)))
            aktion_menge[canon] += int(z.get("menge", 0) or 0)
        except Exception:
            pass
    return dict(aktion_menge)


def _baue_mailto(lief_email: str, lief_name: str,
                 cl: int, cs: int, menge: int) -> str:
    """1:1-Kopie des mailto-Builders aus app.py (B3)."""
    betreff = _q(f"Bestellanfrage Paletten {cl}x{cs} mm — {menge} Stück")
    body = _q(
        f"Guten Tag {lief_name or '<Lieferant>'},\n\n"
        f"wir moechten folgende Bedarfsmenge bestellen:\n\n"
        f"  Palettengroesse: {cl} x {cs} mm\n"
        f"  Menge:           {menge} Stueck\n\n"
        f"Bitte um Angebot mit Preis und Liefertermin.\n\n"
        f"Mit freundlichen Gruessen\n"
        f"Draht Mueller GmbH"
    )
    return (f"mailto:{lief_email}?subject={betreff}&body={body}"
             if lief_email else
             f"mailto:?subject={betreff}&body={body}")


def _synth_zuordnung() -> list[dict]:
    return [
        # Standard 1200x800 mit Summe 100
        {"ziel": "800x1200", "typ": "Standard", "menge": 40},
        {"ziel": "800x1200", "typ": "Standard", "menge": 60},
        # Standard 1500x900 mit Summe 20
        {"ziel": "900x1500", "typ": "Standard", "menge": 20},
        # Kombi-Stapel — wird von Aggregation B1 ignoriert, aber in B4 gezaehlt
        {"ziel": "2x (800x1200)", "typ": "Kombi-Stapel", "menge": 10},
        # Sonder — B1 ignoriert, B4 rechnet
        {"ziel": "1700x1100", "typ": "Sonder", "menge": 3},
    ]


def test_b4_masse_menge_sortiert_absteigend():
    rows = _aggregate_masse_menge(_synth_zuordnung())
    assert len(rows) == 4  # 4 verschiedene Ziele
    assert rows[0]["Bedarfsmenge (Paletten)"] == 100
    assert rows[0]["Maß"] == "800x1200"
    assert rows[-1]["Bedarfsmenge (Paletten)"] == 3


def test_b4_ohne_ziel_wird_ignoriert():
    zuordnung = [
        {"ziel": "800x1200", "typ": "Standard", "menge": 5},
        {"ziel": "", "typ": "Nicht zuordenbar", "menge": 3},
    ]
    rows = _aggregate_masse_menge(zuordnung)
    assert len(rows) == 1
    assert rows[0]["Bedarfsmenge (Paletten)"] == 5


def test_b1_dashboard_nur_standards():
    """Kombi und Sonder werden im Dashboard NICHT gezaehlt."""
    menge = _aktion_menge_pro_typ(_synth_zuordnung())
    # Kanonisch (min, max) = (800, 1200) und (900, 1500)
    assert menge[(800, 1200)] == 100
    assert menge[(900, 1500)] == 20
    assert len(menge) == 2  # keine Kombi, keine Sonder


def test_b3_mailto_enthaelt_alle_infos():
    mailto = _baue_mailto("service@lief.de", "Palettenshop", 1200, 800, 42)
    assert mailto.startswith("mailto:service@lief.de?")
    assert "Bestellanfrage" in mailto
    assert "1200x800" in mailto
    assert "42%20" in mailto or "42+Stueck" in mailto or "42" in mailto


def test_b3_mailto_ohne_email_hat_leeren_empfaenger():
    mailto = _baue_mailto("", "", 1000, 800, 5)
    assert mailto.startswith("mailto:?")
    assert "1000x800" in mailto


if __name__ == "__main__":
    tests = [test_b4_masse_menge_sortiert_absteigend,
             test_b4_ohne_ziel_wird_ignoriert,
             test_b1_dashboard_nur_standards,
             test_b3_mailto_enthaelt_alle_infos,
             test_b3_mailto_ohne_email_hat_leeren_empfaenger]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
            sys.exit(1)
    print(f"\n{len(tests)}/{len(tests)} B-Aggregation-Tests bestanden.")
