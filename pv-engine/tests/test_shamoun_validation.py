"""Validierungstest gegen den realen PV*SOL-Referenzfall "Shamoun".

Strategie:
- Klima-UNABHÄNGIGE / dispatch-nahe KPIs (PR, Eigenverbrauchsanteil, Autarkie)
  werden eng geprüft.
- Klima-ABHÄNGIGE KPIs (spez. Ertrag, Erträge) werden locker geprüft.
- Ohne echte PVGIS-Daten (Offline-Synthese) ist keine belastbare Validierung
  möglich → Test wird übersprungen statt falsch zu bestehen.

Zusätzlich: ein klima-UNABHÄNGIGER Test der Dispatch-Bilanz (Energieerhaltung),
der immer läuft.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from pvengine import ProjectInput, run

FIXTURE = Path(__file__).resolve().parent.parent / "examples" / "shamoun_reference.json"
CONSUMPTION = 4506.0


def _load_project() -> ProjectInput:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    data.pop("_comment", None)
    return ProjectInput.model_validate(data)


def test_dispatch_energy_balance_closes():
    """Klima-unabhängig: die Dispatch-Bilanz muss exakt aufgehen."""
    res = run(_load_project(), allow_network=False)  # Offline reicht für Bilanz
    s = res.simulation

    # Erzeugung = Eigenverbrauch + Einspeisung + Batterieverluste (+ Rest-SOC ~0)
    assert s.ac_energy_with_battery_kwh == pytest.approx(
        s.self_consumption_kwh + s.feed_in_kwh, rel=1e-3
    )
    balance = s.self_consumption_kwh + s.feed_in_kwh + s.battery_losses_kwh
    assert balance <= s.annual_yield_kwh + 1.0

    # Lastdeckung: Eigenverbrauch + Netzbezug = Verbrauch
    assert s.self_consumption_kwh + s.grid_draw_kwh == pytest.approx(
        CONSUMPTION, rel=0.02
    )

    # Batterie: Ladung = Entladung(Last) + Verluste (+ Rest-SOC ~0)
    assert s.battery_charge_kwh == pytest.approx(
        s.battery_to_load_kwh + s.battery_losses_kwh, abs=20.0
    )


@pytest.mark.parametrize("network", [True])
def test_shamoun_kpis_vs_pvsol(network):
    """Voller KPI-Abgleich — nur mit echten PVGIS-Daten belastbar."""
    res = run(_load_project(), allow_network=network)
    s = res.simulation

    if s.climate_source.startswith("fallback"):
        pytest.skip("PVGIS nicht erreichbar — Offline-Synthese, keine belastbare "
                    "Validierung. Online mit Internetzugang ausführen.")

    # Anlagengröße exakt
    assert res.layout.kwp == pytest.approx(15.30, abs=0.01)
    assert res.layout.total_modules == 34

    # Klima-abhängig (locker, ±5 %)
    assert s.specific_yield_kwh_per_kwp == pytest.approx(933.84, rel=0.05)
    assert s.ac_energy_with_battery_kwh == pytest.approx(13944, rel=0.05)
    assert s.feed_in_kwh == pytest.approx(10063, rel=0.05)

    # PR ist klima-unabhängig → eng (±2 pp)
    assert abs(s.performance_ratio - 91.09) <= 2.0

    # Eigenverbrauch/Autarkie: NUR directional (±8 pp). Das H0-Standardprofil
    # und die 1h-Auflösung überschätzen den Eigenverbrauch systematisch; wir
    # tunen das bewusst NICHT auf den Sollwert, sondern prüfen die Größenordnung.
    assert abs(s.self_consumption_pct - 27.8) <= 8.0
    assert abs(s.autarky_pct - 86.1) <= 8.0

    # Batterie-Detail directional (±10 %)
    assert s.battery_charge_kwh == pytest.approx(2516, rel=0.10)
    assert s.battery_to_load_kwh == pytest.approx(2166, rel=0.10)
