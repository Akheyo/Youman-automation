"""Komponente D — Simulations-Engine (pvlib, das Herz).

Stündlich über ein TMY-Jahr (8760 Schritte), je Dachfläche:
  1. Sonnenstand
  2. Transposition Hay & Davies → POA-Einstrahlung
  3. Verschattung (Pauschale oder Horizontprofil) → POA-Minderung
  4. Faiman-Temperaturmodell → Zelltemperatur
  5. PVWatts DC-Modell → DC-Leistung
  6. Systemverluste + PVWatts-WR-Modell → AC
Danach: Lastprofil + Batterie-Dispatch → Eigenverbrauch/Autarkie.

Aggregat: Jahresertrag, spez. Ertrag (kWh/kWp), PR, Eigenverbrauchsanteil,
Netzeinspeisung, CO₂, Autarkiegrad, Monatswerte.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pvlib

from .battery import dispatch
from .climate import TMY
from .config import EngineConfig
from .models import (
    LayoutResult,
    MonthlyValue,
    ProjectInput,
    SimulationResult,
)

G_STC = 1000.0  # W/m² Referenzeinstrahlung


def _horizon_shading_factor(roof_horizon, solpos: pd.DataFrame) -> np.ndarray:
    """Anteil je Stunde, der durch Horizontverschattung verloren geht (0..1).

    Sehr einfaches Modell: liegt die Sonnenhöhe unter dem Horizont-Höhenwinkel
    für ihren Azimut, gilt die Stunde als (direkt) verschattet → Faktor 1.
    """
    if not roof_horizon:
        return np.zeros(len(solpos))
    az = solpos["azimuth"].to_numpy()
    elev = solpos["apparent_elevation"].to_numpy()
    horizon_az = np.array(sorted(roof_horizon.keys()))
    horizon_el = np.array([roof_horizon[a] for a in horizon_az])
    interp = np.interp(az % 360, horizon_az, horizon_el, period=360)
    return ((elev > 0) & (elev < interp)).astype(float)


def simulate(
    project: ProjectInput,
    layout: LayoutResult,
    tmy: TMY,
    config: EngineConfig,
) -> SimulationResult:
    cfg = config.sim
    loc = project.location
    site = pvlib.location.Location(
        loc.latitude, loc.longitude, tz=loc.timezone, altitude=loc.altitude_m
    )
    times = tmy.data.index
    solpos = site.get_solarposition(times)
    dni_extra = pvlib.irradiance.get_extra_radiation(times)

    ghi = tmy.data["ghi"]
    dni = tmy.data["dni"]
    dhi = tmy.data["dhi"]
    temp_air = tmy.data["temp_air"]
    wind = tmy.data["wind_speed"]

    total_kwp = layout.kwp
    if total_kwp <= 0 or layout.total_modules <= 0:
        return SimulationResult(climate_source=tmy.source)

    dc_total = pd.Series(0.0, index=times)        # W
    poa_weighted = pd.Series(0.0, index=times)     # W/m², kWp-gewichtet

    for roof, n_mod in zip(project.roofs, layout.modules_per_roof):
        if n_mod <= 0:
            continue
        kwp_roof = n_mod * project.module.pmpp_wp / 1000.0

        poa = pvlib.irradiance.get_total_irradiance(
            surface_tilt=roof.tilt_deg,
            surface_azimuth=roof.azimuth_deg,
            solar_zenith=solpos["apparent_zenith"],
            solar_azimuth=solpos["azimuth"],
            dni=dni, ghi=ghi, dhi=dhi,
            dni_extra=dni_extra,
            albedo=cfg.albedo,
            model="haydavies",
        )
        poa_global = poa["poa_global"].fillna(0.0).clip(lower=0.0)

        # Verschattung: pauschal (shading_loss_pct) + optional Horizontprofil
        shade = np.full(len(times), project.shading_loss_pct / 100.0)
        horizon_loss = _horizon_shading_factor(roof.horizon, solpos)
        # Direktanteil-gewichtete Horizontverschattung (grobe Näherung)
        shade = np.clip(shade + horizon_loss * 0.7, 0.0, 1.0)
        poa_eff = poa_global * (1.0 - shade)

        temp_cell = pvlib.temperature.faiman(
            poa_eff, temp_air, wind, u0=cfg.temp_u0, u1=cfg.temp_u1
        )
        dc = pvlib.pvsystem.pvwatts_dc(
            poa_eff, temp_cell, pdc0=kwp_roof * 1000.0, gamma_pdc=cfg.gamma_pdc
        )
        dc_total = dc_total.add(dc.fillna(0.0), fill_value=0.0)
        poa_weighted = poa_weighted.add(poa_eff * kwp_roof, fill_value=0.0)

    poa_array = poa_weighted / total_kwp  # kWp-gewichtetes mittleres POA

    # Systemverluste (PVWatts) auf DC
    losses_pct = pvlib.pvsystem.pvwatts_losses(
        soiling=cfg.soiling, shading=cfg.shading_system, snow=cfg.snow,
        mismatch=cfg.mismatch, wiring=cfg.wiring, connections=cfg.connections,
        lid=cfg.lid, nameplate_rating=cfg.nameplate_rating, age=cfg.age,
        availability=cfg.availability,
    )
    dc_net = dc_total * (1.0 - losses_pct / 100.0)

    # Wechselrichter (PVWatts), inkl. Clipping bei AC-Nennleistung
    pac0 = project.inverter.pac_nom_w  # je WR; Anzahl via electrical separat,
    # hier skalieren wir die AC-Kapazität mit der DC-Größe (1 WR-Äquivalent
    # reicht fürs Energiemodell; Clipping greift nur bei starker Überbelegung)
    inv_count = max(round(total_kwp * 1000.0 / project.inverter.pdc_max_w + 0.49), 1)
    pac0_total = pac0 * inv_count
    pdc0_inv = pac0_total / cfg.inverter_eta_nom
    ac = pvlib.inverter.pvwatts(
        dc_net, pdc0_inv, eta_inv_nom=cfg.inverter_eta_nom
    ).clip(lower=0.0)

    ac_kwh = ac / 1000.0  # stündlich → kWh
    annual_yield = float(ac_kwh.sum())
    poa_irr_kwh_m2 = float(poa_array.sum() / 1000.0)

    specific_yield = annual_yield / total_kwp
    ref_yield = poa_irr_kwh_m2 / (G_STC / 1000.0)  # = poa_irr_kwh_m2
    pr = (specific_yield / ref_yield) if ref_yield > 0 else 0.0

    # Effektiver Verschattungsverlust (gegenüber unverschatteter POA)
    shading_loss_pct = project.shading_loss_pct

    # --- Eigenverbrauch / Autarkie über Batterie-Dispatch ---
    from .loadprofile import build_load_profile

    load = build_load_profile(project.consumption, times)
    disp = dispatch(ac_kwh, load, project.battery)
    sc_sum = float(disp.self_consumption.sum())
    feed_sum = float(disp.feed_in.sum())
    grid_sum = float(disp.grid_draw.sum())
    load_sum = float(load.sum())

    sc_pct = (sc_sum / annual_yield * 100.0) if annual_yield > 0 else 0.0
    autarky_pct = (sc_sum / load_sum * 100.0) if load_sum > 0 else 0.0

    co2_t = annual_yield * config.co2.grid_emission_factor_g_per_kwh / 1e6

    # Monatswerte
    monthly: list[MonthlyValue] = []
    grp_y = ac_kwh.groupby(ac_kwh.index.month).sum()
    grp_c = load.groupby(load.index.month).sum()
    grp_sc = disp.self_consumption.groupby(disp.self_consumption.index.month).sum()
    grp_fi = disp.feed_in.groupby(disp.feed_in.index.month).sum()
    grp_gd = disp.grid_draw.groupby(disp.grid_draw.index.month).sum()
    for m in range(1, 13):
        monthly.append(MonthlyValue(
            month=m,
            yield_kwh=round(float(grp_y.get(m, 0.0)), 1),
            consumption_kwh=round(float(grp_c.get(m, 0.0)), 1),
            self_consumption_kwh=round(float(grp_sc.get(m, 0.0)), 1),
            feed_in_kwh=round(float(grp_fi.get(m, 0.0)), 1),
            grid_draw_kwh=round(float(grp_gd.get(m, 0.0)), 1),
        ))

    return SimulationResult(
        annual_yield_kwh=round(annual_yield, 1),
        specific_yield_kwh_per_kwp=round(specific_yield, 2),
        performance_ratio=round(pr * 100.0, 2),
        shading_loss_pct=round(shading_loss_pct, 2),
        poa_irradiation_kwh_m2=round(poa_irr_kwh_m2, 1),
        self_consumption_kwh=round(sc_sum, 1),
        self_consumption_pct=round(sc_pct, 1),
        autarky_pct=round(autarky_pct, 1),
        feed_in_kwh=round(feed_sum, 1),
        grid_draw_kwh=round(grid_sum, 1),
        battery_cycles=round(disp.cycles, 1),
        battery_cycle_load_pct=round(
            disp.cycles / project.battery.rated_cycles * 100.0, 2
        ) if project.battery.rated_cycles > 0 else 0.0,
        battery_charge_kwh=round(disp.charge_total_kwh, 1),
        battery_to_load_kwh=round(disp.discharge_to_load_kwh, 1),
        battery_to_grid_kwh=round(disp.discharge_to_grid_kwh, 1),
        battery_losses_kwh=round(disp.losses_kwh, 1),
        ac_energy_with_battery_kwh=round(sc_sum + feed_sum, 1),
        co2_savings_t=round(co2_t, 2),
        monthly=monthly,
        climate_source=tmy.source,
    )
