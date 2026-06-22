"""PV-Planungs-Engine — eigene Ertrags-, Wirtschaftlichkeits- & Report-Engine.

Öffentliche API:
    from pvengine import run, run_and_report, ProjectInput
"""
from __future__ import annotations

from .config import DEFAULT_CONFIG, EngineConfig
from .models import (
    BatterySpec,
    ConsumptionInput,
    EconomicsInput,
    InverterSpec,
    Location,
    ModuleSpec,
    ProjectInput,
    ProjectResult,
    RoofPlane,
)
from .pipeline import run, run_and_report

__version__ = "0.1.0"

__all__ = [
    "run",
    "run_and_report",
    "ProjectInput",
    "ProjectResult",
    "Location",
    "RoofPlane",
    "ModuleSpec",
    "InverterSpec",
    "BatterySpec",
    "ConsumptionInput",
    "EconomicsInput",
    "EngineConfig",
    "DEFAULT_CONFIG",
    "__version__",
]
