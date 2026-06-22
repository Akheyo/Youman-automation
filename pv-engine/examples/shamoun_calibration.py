"""Kalibrierungs-Beispiel gegen einen echten PV*SOL-Report (Shamoun).

Zielwerte aus dem Referenz-Report:
    spez. Ertrag   933,84 kWh/kWp
    Performance Ratio  91,09 %
    Verschattung    2,9 %

Aufruf:
    python examples/shamoun_calibration.py            # online (PVGIS)
    python examples/shamoun_calibration.py --offline  # Offline-Synthese

Hinweis: Belastbar kalibrieren NUR mit echten PVGIS-Daten (online). Der
Offline-Modus dient als Plausibilitätscheck der Pipeline.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pvengine import ProjectInput, run  # noqa: E402
from pvengine.models import ConsumptionInput, Location, RoofPlane  # noqa: E402

# --- Zielwerte ---
TARGET_SPECIFIC_YIELD = 933.84
TARGET_PR = 91.09
TARGET_SHADING = 2.9


def main(offline: bool) -> int:
    project = ProjectInput(
        project_name="Shamoun (Kalibrierung)",
        location=Location(address="Borken, NRW", latitude=51.84, longitude=6.86),
        roofs=[RoofPlane(tilt_deg=35, azimuth_deg=180, module_count=18)],
        consumption=ConsumptionInput(annual_kwh=4500),
        shading_loss_pct=TARGET_SHADING,
    )
    res = run(project, allow_network=not offline)
    s = res.simulation

    print(f"Klimaquelle:        {s.climate_source}")
    print(f"{'Kennzahl':<22}{'Engine':>12}{'Ziel':>12}{'Abw.':>10}")
    rows = [
        ("Spez. Ertrag kWh/kWp", s.specific_yield_kwh_per_kwp, TARGET_SPECIFIC_YIELD),
        ("Performance Ratio %", s.performance_ratio, TARGET_PR),
        ("Verschattung %", s.shading_loss_pct, TARGET_SHADING),
    ]
    for name, got, target in rows:
        dev = (got - target) / target * 100 if target else 0
        print(f"{name:<22}{got:>12.2f}{target:>12.2f}{dev:>9.1f}%")

    if s.climate_source.startswith("fallback"):
        print("\n⚠  Offline-Synthese — für echte Kalibrierung online (PVGIS) laufen lassen.")
    return 0


if __name__ == "__main__":
    sys.exit(main(offline="--offline" in sys.argv))
