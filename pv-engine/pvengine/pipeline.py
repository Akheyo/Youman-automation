"""Pipeline-Orchestrator — verdrahtet die Komponenten A–H.

Adresse/Dach → Geometrie → Layout → E-Auslegung → Simulation (pvlib +
Klima + Lastprofil + Batterie) → Wirtschaftlichkeit → Report.
"""
from __future__ import annotations

from pathlib import Path

from . import economics, electrical, geometry, layout, report, simulation
from .climate import get_tmy
from .config import DEFAULT_CONFIG, EngineConfig
from .models import ProjectInput, ProjectResult


def run(
    project: ProjectInput,
    config: EngineConfig = DEFAULT_CONFIG,
    *,
    allow_network: bool = True,
) -> ProjectResult:
    """Volle Pipeline ausführen und ein ProjectResult liefern."""
    # A — Geometrie: ggf. Adresse geocodieren
    if (allow_network and project.location.address
            and project.location.latitude == 51.84):
        geo = geometry.geocode(project.location.address)
        if geo is not None:
            project.location = geo

    # B — Modul-Layout
    lay = layout.plan_layout(project.roofs, project.module)

    # C — Elektrische Auslegung
    el = electrical.size_strings(project.module, project.inverter, lay.total_modules)

    # Klima (TMY)
    tmy = get_tmy(project.location, allow_network=allow_network)

    # D — Simulation (inkl. Lastprofil E + Batterie)
    sim = simulation.simulate(project, lay, tmy, config)

    # F — Wirtschaftlichkeit
    eco = economics.calculate(project, lay, sim, config)

    return ProjectResult(
        input=project,
        layout=lay,
        electrical=el,
        simulation=sim,
        economics=eco,
        generated_at=report.now_str(),
    )


def run_and_report(
    project: ProjectInput,
    output_path: str | Path,
    config: EngineConfig = DEFAULT_CONFIG,
    *,
    allow_network: bool = True,
) -> tuple[ProjectResult, Path]:
    """Pipeline + Report-PDF in einem Aufruf."""
    result = run(project, config, allow_network=allow_network)
    path = report.render_pdf(result, output_path)
    return result, path
