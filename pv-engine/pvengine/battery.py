"""Batterie-Dispatch (Teil von Komponente D/Simulation).

Greedy-Eigenverbrauchsoptimierung über das Stundenraster:
- Überschuss (PV > Last) lädt zuerst die Batterie, Rest → Netzeinspeisung.
- Defizit (Last > PV) wird zuerst aus der Batterie gedeckt, Rest → Netzbezug.

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

    sc = np.zeros(n)
    feed = np.zeros(n)
    grid = np.zeros(n)
    chg = np.zeros(n)
    dis = np.zeros(n)

    soc = 0.0
    throughput = 0.0
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
                chg[i] = charge
                surplus -= charge
            elif deficit > 0:
                avail = min(soc, p_dis)
                discharge_to_load = min(deficit, avail * eta)
                drawn = discharge_to_load / eta
                soc -= drawn
                dis[i] = discharge_to_load
                sc[i] += discharge_to_load
                deficit -= discharge_to_load
                throughput += discharge_to_load

        feed[i] = max(surplus, 0.0)
        grid[i] = max(deficit, 0.0)

    cycles = throughput / usable if usable > 0 else 0.0
    idx = production.index
    return DispatchResult(
        self_consumption=pd.Series(sc, index=idx),
        feed_in=pd.Series(feed, index=idx),
        grid_draw=pd.Series(grid, index=idx),
        battery_charge=pd.Series(chg, index=idx),
        battery_discharge=pd.Series(dis, index=idx),
        cycles=float(cycles),
    )
