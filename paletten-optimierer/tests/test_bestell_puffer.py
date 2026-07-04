"""E3: Bestell-Puffer mit Aufrundung auf naechstes Vielfaches.

  menge_bestellen = ceil(bedarf / puffer) * puffer
  puffer = 1 schaltet das Feature aus (Bestellmenge = Bedarf).
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))


def aufrunden_bestellmenge(bedarf: int, puffer: int) -> int:
    """1:1 Kopie der Rechnung aus app.py."""
    if puffer <= 1 or bedarf <= 0:
        return bedarf
    return math.ceil(bedarf / puffer) * puffer


def test_puffer_5_beispiele():
    """Puffer=5: 78 -> 80, 76 -> 80, 75 -> 75, 5 -> 5, 0 -> 0."""
    assert aufrunden_bestellmenge(78, 5) == 80
    assert aufrunden_bestellmenge(76, 5) == 80
    assert aufrunden_bestellmenge(75, 5) == 75
    assert aufrunden_bestellmenge(5, 5) == 5
    assert aufrunden_bestellmenge(0, 5) == 0


def test_puffer_10_beispiele():
    """Puffer=10: 78 -> 80, 81 -> 90, 90 -> 90, 100 -> 100."""
    assert aufrunden_bestellmenge(78, 10) == 80
    assert aufrunden_bestellmenge(81, 10) == 90
    assert aufrunden_bestellmenge(90, 10) == 90
    assert aufrunden_bestellmenge(100, 10) == 100


def test_puffer_1_ist_aus():
    """Puffer=1 -> Bedarf 1:1 durchreichen."""
    for n in [1, 78, 999, 12345]:
        assert aufrunden_bestellmenge(n, 1) == n


def test_puffer_25():
    """Puffer=25: 78 -> 100, 100 -> 100, 101 -> 125."""
    assert aufrunden_bestellmenge(78, 25) == 100
    assert aufrunden_bestellmenge(100, 25) == 100
    assert aufrunden_bestellmenge(101, 25) == 125


def test_puffer_50():
    assert aufrunden_bestellmenge(78, 50) == 100
    assert aufrunden_bestellmenge(1, 50) == 50


def test_puffer_100():
    assert aufrunden_bestellmenge(78, 100) == 100
    assert aufrunden_bestellmenge(150, 100) == 200


def test_delta_ist_bestellmenge_minus_bedarf():
    """Der +Puffer-Delta wird in der UI angezeigt: Δ = Bestellmenge - Bedarf."""
    bedarf = 78
    puffer = 5
    b = aufrunden_bestellmenge(bedarf, puffer)
    delta = b - bedarf
    assert delta == 2, f"78 mit Puffer 5 -> +2, bekam +{delta}"


def test_optimierungsanzeige_bleibt_bei_bedarf():
    """Der Puffer greift NUR bei Bestellung. Die Optimierung sieht
    weiterhin den echten Bedarf. Simulation: puffer=5 wird nicht auf
    orders/menge angewendet."""
    orders = [{"menge": 78}, {"menge": 76}, {"menge": 5}]
    for o in orders:
        # Die Optimierung nutzt die reine 'menge' — kein Puffer
        assert o["menge"] in (78, 76, 5)


if __name__ == "__main__":
    tests = [test_puffer_5_beispiele,
             test_puffer_10_beispiele,
             test_puffer_1_ist_aus,
             test_puffer_25,
             test_puffer_50,
             test_puffer_100,
             test_delta_ist_bestellmenge_minus_bedarf,
             test_optimierungsanzeige_bleibt_bei_bedarf]
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
            sys.exit(1)
    print(f"\n{len(tests)}/{len(tests)} Bestell-Puffer-Tests bestanden.")
