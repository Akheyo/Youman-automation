"""Kommandozeilen-Interface der PV-Engine.

Beispiele:
    pvengine --address "Mölndalstraße 8, 46325 Borken" --tilt 35 --azimuth 180 \\
             --area 60 --consumption 4500 --battery 10 --pdf report.pdf
    pvengine --json projekt.json --pdf report.pdf --offline
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .models import (
    BatterySpec,
    ConsumptionInput,
    Location,
    ProjectInput,
    RoofPlane,
)
from .pipeline import run, run_and_report


def _build_project(args: argparse.Namespace) -> ProjectInput:
    if args.json:
        data = json.loads(Path(args.json).read_text(encoding="utf-8"))
        return ProjectInput.model_validate(data)
    return ProjectInput(
        project_name=args.name,
        customer_name=args.customer,
        location=Location(address=args.address or ""),
        roofs=[RoofPlane(tilt_deg=args.tilt, azimuth_deg=args.azimuth,
                         area_m2=args.area, module_count=args.modules)],
        battery=BatterySpec(capacity_kwh=args.battery),
        consumption=ConsumptionInput(annual_kwh=args.consumption,
                                     ev_annual_kwh=args.ev,
                                     heatpump_annual_kwh=args.heatpump),
        shading_loss_pct=args.shading,
    )


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="PV-Planungs-Engine CLI")
    ap.add_argument("--json", help="Projekt als JSON-Datei (überschreibt Einzelargumente)")
    ap.add_argument("--name", default="PV-Anlage")
    ap.add_argument("--customer", default="")
    ap.add_argument("--address", default="")
    ap.add_argument("--tilt", type=float, default=35)
    ap.add_argument("--azimuth", type=float, default=180)
    ap.add_argument("--area", type=float, default=None, help="Nutzbare Dachfläche m²")
    ap.add_argument("--modules", type=int, default=None, help="Feste Modulanzahl")
    ap.add_argument("--consumption", type=float, default=4500, help="Jahresverbrauch kWh")
    ap.add_argument("--ev", type=float, default=0, help="E-Auto kWh/Jahr")
    ap.add_argument("--heatpump", type=float, default=0, help="Wärmepumpe kWh/Jahr")
    ap.add_argument("--battery", type=float, default=0, help="Speicher kWh")
    ap.add_argument("--shading", type=float, default=2.9, help="Verschattungsverlust %")
    ap.add_argument("--pdf", help="Report-Ausgabepfad (.pdf)")
    ap.add_argument("--out-json", help="Ergebnis als JSON speichern")
    ap.add_argument("--offline", action="store_true", help="Kein Netzwerk (Offline-TMY)")
    args = ap.parse_args(argv)

    if args.area is None and args.modules is None and not args.json:
        args.area = 60.0  # sinnvoller Default

    project = _build_project(args)
    allow_net = not args.offline

    if args.pdf:
        result, path = run_and_report(project, args.pdf, allow_network=allow_net)
        print(f"Report geschrieben: {path}")
    else:
        result = run(project, allow_network=allow_net)

    s, e, l = result.simulation, result.economics, result.layout
    print(f"\n=== {project.project_name} ===")
    print(f"Leistung:        {l.kwp:.2f} kWp ({l.total_modules} Module)")
    print(f"Jahresertrag:    {s.annual_yield_kwh:,.0f} kWh".replace(",", "."))
    print(f"Spez. Ertrag:    {s.specific_yield_kwh_per_kwp:.0f} kWh/kWp")
    print(f"Performance Ratio: {s.performance_ratio:.1f} %")
    print(f"Eigenverbrauch:  {s.self_consumption_pct:.0f} % · Autarkie {s.autarky_pct:.0f} %")
    print(f"Investition:     {e.capex_eur:,.0f} €".replace(",", "."))
    print(f"Amortisation:    {e.payback_years} Jahre")
    print(f"LCOE:            {e.lcoe_ct_kwh:.1f} ct/kWh")
    print(f"Klimaquelle:     {s.climate_source}")

    if args.out_json:
        Path(args.out_json).write_text(
            result.model_dump_json(indent=2), encoding="utf-8"
        )
        print(f"JSON geschrieben: {args.out_json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
