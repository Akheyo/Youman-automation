"""Batterie-Dispatch (Teil von Komponente D/Simulation).

Greedy-Eigenverbrauchsoptimierung über das Stundenraster:
- Überschuss (PV > Last) lädt zuerst die Batterie, Rest → Netzeinspeisung.
- Defizit (Last > PV) wird zuerst aus der Batterie gedeckt, Rest → Netzbezug.

Optional (Standard: aus) eine Batterie→Netz-Entladung in definierten Stunden
(EMS/Arbitrage/Calendar-Health). Bei reiner Eigenverbrauchsstrategie und 1 h-
Auflösung ist Batterie→Netz physikalisch ~0; ein nennenswerter Wert in
PV*SOL-Reports stammt v. a. aus Sub-Stunden-Dynamik (hier bewusst nicht
modelliert) bzw. expliziter EMS-Strategie.

Liefert die stündlichen Energieflüsse + Zyklenzahl. Wirkungsgrad wird
hälftig auf Laden/Entladen aufgeteilt (sqrt(round_trip)).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .models import BatterySpec


@dataclass
class DispatchResult:
    self_consumption: pd.Series  # direkt + aus Batterie gedeckte Last
    feed_in: pd.Series
    grid_draw: pd.Series
    battery_charge: pd.Series
    battery_discharge: pd.Series
    cycles: float
    charge_total_kwh: float       # AC-Energie in die Batterie
    discharge_to_load_kwh: float  # aus Batterie an die Last
    discharge_to_grid_kwh: float  # aus Batterie ins Netz
    losses_kwh: float             # Lade-/Entladeverluste
    residual_soc_kwh: float       # Restladung am Jahresende


def dispatch(
    production: pd.Series,
    load: pd.Series,
    battery: BatterySpec,
) -> DispatchResult:
    """Stündlicher Dispatch. Indizes von production/load müssen gleich sein."""
    prod = production.to_numpy(dtype=float)
    cons = load.to_numpy(dtype=float)
    n = len(prod)

    usable = battery.capacity_kwh * battery.usable_fraction
    eta = float(np.sqrt(battery.round_trip_efficiency))
    p_chg = battery.max_charge_kw
    p_dis = battery.max_discharge_kw
    gd_hours = set(battery.grid_discharge_hours)
    gd_floor = battery.grid_discharge_floor_soc * usable
    hours = production.index.hour.to_numpy()

    sc = np.zeros(n)
    feed = np.zeros(n)
    grid = np.zeros(n)
    chg = np.zeros(n)
    dis = np.zeros(n)
    dis_grid = np.zeros(n)

    soc = 0.0
    throughput = 0.0
    losses = 0.0
    charge_total = 0.0
    discharge_to_load = 0.0
    discharge_to_grid = 0.0
    for i in range(n):
        direct = min(prod[i], cons[i])
        sc[i] = direct
        surplus = prod[i] - direct
        deficit = cons[i] - direct

        if usable > 0:
            if surplus > 0:
                room = (usable - soc) / eta      # netto fürs Speichern nötig
                charge = min(surplus, room, p_chg)
                charge = max(charge, 0.0)
                soc += charge * eta
                losses += charge * (1.0 - eta)   # Ladeverlust
                chg[i] = charge
                charge_total += charge
                surplus -= charge
            elif deficit > 0:
                avail = min(soc, p_dis)
                delivered = min(deficit, avail * eta)
                drawn = delivered / eta
                soc -= drawn
                losses += drawn * (1.0 - eta)     # Entladeverlust
                dis[i] = delivered
                sc[i] += delivered
                deficit -= delivered
                throughput += delivered
                discharge_to_load += delivered

            # Optionale Batterie→Netz-Entladung (nur wenn aktiviert, kein Defizit)
            if (battery.allow_grid_discharge and deficit <= 0
                    and hours[i] in gd_hours and soc > gd_floor):
                room_to_floor = soc - gd_floor
                released = min(room_to_floor * eta, p_dis)
                drawn = released / eta
                soc -= drawn
                losses += drawn * (1.0 - eta)
                dis_grid[i] = released
                surplus += released               # geht zusätzlich ins Netz
                throughput += released
                discharge_to_grid += released

        feed[i] = max(surplus, 0.0)
        grid[i] = max(deficit, 0.0)

    # Jahres-Vollzyklen: Definition über den LADEdurchsatz (AC-Energie in die
    # Batterie) / nutzbare Kapazität. Konsistent mit PV*SOL "Zyklenbelastung".
    # (Entladedurchsatz `throughput` wird nicht für die Zyklenzahl verwendet.)
    cycles = charge_total / usable if usable > 0 else 0.0
    idx = production.index
    return DispatchResult(
        self_consumption=pd.Series(sc, index=idx),
        feed_in=pd.Series(feed, index=idx),
        grid_draw=pd.Series(grid, index=idx),
        battery_charge=pd.Series(chg, index=idx),
        battery_discharge=pd.Series(dis + dis_grid, index=idx),
        cycles=float(cycles),
        charge_total_kwh=float(charge_total),
        discharge_to_load_kwh=float(discharge_to_load),
        discharge_to_grid_kwh=float(discharge_to_grid),
        losses_kwh=float(losses),
        residual_soc_kwh=float(soc),
    )
