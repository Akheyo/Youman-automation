"""Domänen-Modelle (Pydantic v2) — die Datenverträge der Pipeline.

Eingang:  ProjectInput  (Standort, Dächer, Modul/WR, Verbrauch, Wirtschaftl.)
Ausgang:  ProjectResult (alle Werte der Report-Seiten)
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Eingangsmodelle
# ---------------------------------------------------------------------------
class RoofPlane(BaseModel):
    """Eine Dachteilfläche (Report S. 6–8, 20–22)."""

    name: str = "Dachfläche"
    tilt_deg: float = Field(35, ge=0, le=90, description="Dachneigung in Grad")
    azimuth_deg: float = Field(
        180, ge=0, le=360,
        description="Azimut in Grad (0=N, 90=O, 180=S, 270=W)",
    )
    area_m2: Optional[float] = Field(
        None, gt=0, description="Nutzbare Dachfläche in m² (für Auto-Layout)"
    )
    # Optional: explizites Polygon (lon/lat) für späteres Auto-Layout / 3D
    polygon: Optional[list[tuple[float, float]]] = None
    # Optional: Horizontprofil für Verschattung (Azimut° -> Höhenwinkel°)
    horizon: Optional[dict[float, float]] = None
    # Optional: feste Modulanzahl auf dieser Fläche (überschreibt Auto-Layout)
    module_count: Optional[int] = Field(None, ge=0)


class ModuleSpec(BaseModel):
    """PV-Modul-Datenblatt (Auszug)."""

    manufacturer: str = "Generic"
    model: str = "Mono 440 Wp"
    pmpp_wp: float = Field(440, gt=0, description="Nennleistung Wp (STC)")
    length_mm: float = 1762
    width_mm: float = 1134
    vmp_v: float = 33.6
    imp_a: float = 13.1
    voc_v: float = 40.2
    isc_a: float = 13.9
    temp_coeff_pmpp_pct_k: float = -0.35
    temp_coeff_voc_pct_k: float = -0.27
    efficiency_pct: float = 22.0

    @property
    def area_m2(self) -> float:
        return (self.length_mm / 1000.0) * (self.width_mm / 1000.0)


class InverterSpec(BaseModel):
    """Wechselrichter-Datenblatt (Auszug)."""

    manufacturer: str = "Generic"
    model: str = "Hybrid 8.0"
    pac_nom_w: float = Field(8000, gt=0, description="AC-Nennleistung W")
    pdc_max_w: float = Field(12000, gt=0, description="max. DC-Leistung W")
    mppt_count: int = 2
    mppt_v_min: float = 140
    mppt_v_max: float = 800
    v_max_dc: float = 1000
    strings_per_mppt: int = 2
    eta_max_pct: float = 98.0


class BatterySpec(BaseModel):
    """Batteriespeicher (optional)."""

    capacity_kwh: float = Field(0, ge=0)
    usable_fraction: float = Field(0.95, gt=0, le=1)
    max_charge_kw: float = 5.0
    max_discharge_kw: float = 5.0
    round_trip_efficiency: float = Field(0.92, gt=0, le=1)
    min_soc_fraction: float = 0.05
    # Optionale Batterie→Netz-Entladung (EMS/Arbitrage/Health). Standard: aus
    # → reine Eigenverbrauchsstrategie. Wird NICHT zur KPI-Kalibrierung benutzt.
    allow_grid_discharge: bool = False
    grid_discharge_hours: list[int] = Field(default_factory=list)  # Stunden 0–23
    grid_discharge_floor_soc: float = Field(0.5, ge=0, le=1)


class ConsumptionInput(BaseModel):
    """Verbrauchsangaben (Report S. 5)."""

    annual_kwh: float = Field(4500, gt=0)
    profile: str = Field("H0", description="BDEW-Profil: H0 (Haushalt) etc.")
    ev_annual_kwh: float = 0.0           # E-Auto Zusatzverbrauch
    heatpump_annual_kwh: float = 0.0     # Wärmepumpe Zusatzverbrauch
    custom_profile_8760: Optional[list[float]] = None  # eigenes stündl. Profil


class EconomicsInput(BaseModel):
    """Überschreibbare Wirtschaftlichkeits-Annahmen."""

    electricity_price_ct_kwh: Optional[float] = None
    price_escalation_pct: Optional[float] = None
    capex_eur: Optional[float] = None          # falls bekannt: Gesamtpreis
    capex_eur_per_kwp: Optional[float] = None
    project_years: Optional[int] = None
    commissioning_date: Optional[date] = None


class Location(BaseModel):
    """Standort (Report-Kopf)."""

    address: str = ""
    latitude: float = 51.84
    longitude: float = 6.86
    altitude_m: float = 50.0
    timezone: str = "Europe/Berlin"


class ProjectInput(BaseModel):
    """Vollständige Projekt-Eingabe (Pipeline-Input)."""

    location: Location = Field(default_factory=Location)
    roofs: list[RoofPlane] = Field(default_factory=lambda: [RoofPlane()])
    module: ModuleSpec = Field(default_factory=ModuleSpec)
    inverter: InverterSpec = Field(default_factory=InverterSpec)
    battery: BatterySpec = Field(default_factory=BatterySpec)
    consumption: ConsumptionInput = Field(default_factory=ConsumptionInput)
    economics: EconomicsInput = Field(default_factory=EconomicsInput)
    # Verschattungsverlust als Pauschale, falls keine 3D-Geometrie vorliegt (%)
    shading_loss_pct: float = Field(2.9, ge=0, le=100)
    customer_name: str = ""
    project_name: str = "PV-Anlage"


# ---------------------------------------------------------------------------
# Ausgangsmodelle
# ---------------------------------------------------------------------------
class LayoutResult(BaseModel):
    total_modules: int = 0
    modules_per_roof: list[int] = Field(default_factory=list)
    kwp: float = 0.0
    module_area_m2: float = 0.0


class ElectricalResult(BaseModel):
    modules_per_string: int = 0
    strings_total: int = 0
    string_voltage_stc_v: float = 0.0
    dc_ac_ratio: float = 0.0
    inverter_count: int = 1
    notes: list[str] = Field(default_factory=list)


class MonthlyValue(BaseModel):
    month: int
    yield_kwh: float
    consumption_kwh: float = 0.0
    self_consumption_kwh: float = 0.0
    feed_in_kwh: float = 0.0
    grid_draw_kwh: float = 0.0


class SimulationResult(BaseModel):
    annual_yield_kwh: float = 0.0
    specific_yield_kwh_per_kwp: float = 0.0
    performance_ratio: float = 0.0
    shading_loss_pct: float = 0.0
    poa_irradiation_kwh_m2: float = 0.0
    self_consumption_kwh: float = 0.0
    self_consumption_pct: float = 0.0
    autarky_pct: float = 0.0
    feed_in_kwh: float = 0.0
    grid_draw_kwh: float = 0.0
    battery_cycles: float = 0.0
    battery_charge_kwh: float = 0.0
    battery_to_load_kwh: float = 0.0
    battery_to_grid_kwh: float = 0.0
    battery_losses_kwh: float = 0.0
    ac_energy_with_battery_kwh: float = 0.0  # Eigenverbrauch + Einspeisung (netto)
    co2_savings_t: float = 0.0
    monthly: list[MonthlyValue] = Field(default_factory=list)
    climate_source: str = ""


class CashflowYear(BaseModel):
    year: int
    feed_in_revenue_eur: float
    savings_eur: float
    opex_eur: float
    net_cashflow_eur: float
    cumulative_eur: float


class EconomicsResult(BaseModel):
    capex_eur: float = 0.0
    feed_in_ct_kwh: float = 0.0
    payback_years: Optional[float] = None
    total_profit_20y_eur: float = 0.0
    roi_pct: float = 0.0
    lcoe_ct_kwh: float = 0.0
    irr_pct: Optional[float] = None
    cashflow: list[CashflowYear] = Field(default_factory=list)


class ProjectResult(BaseModel):
    input: ProjectInput
    layout: LayoutResult
    electrical: ElectricalResult
    simulation: SimulationResult
    economics: EconomicsResult
    generated_at: str = ""
    engine_version: str = "0.1.0"
