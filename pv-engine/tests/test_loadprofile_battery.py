import pandas as pd

from pvengine.battery import dispatch
from pvengine.loadprofile import build_load_profile
from pvengine.models import BatterySpec, ConsumptionInput


def _index(n=8760):
    return pd.date_range("2019-01-01 00:30", periods=n, freq="h", tz="Europe/Berlin")


def test_load_profile_scales_to_annual_kwh():
    idx = _index()
    cons = ConsumptionInput(annual_kwh=4500)
    load = build_load_profile(cons, idx)
    assert abs(load.sum() - 4500) < 1.0
    assert (load >= 0).all()


def test_load_profile_adds_ev_and_heatpump():
    idx = _index()
    base = build_load_profile(ConsumptionInput(annual_kwh=4500), idx).sum()
    extra = build_load_profile(
        ConsumptionInput(annual_kwh=4500, ev_annual_kwh=2000,
                         heatpump_annual_kwh=3000), idx
    ).sum()
    assert abs(extra - (base + 5000)) < 2.0


def test_battery_increases_self_consumption():
    idx = _index(48)
    # Tag: PV-Überschuss mittags, Verbrauch abends
    prod = pd.Series([0]*6 + [2]*6 + [0]*6 + [0]*6 + [0]*6 + [2]*6 + [0]*6 + [0]*6, index=idx)
    load = pd.Series(([0.2]*18 + [1.5]*6)*2, index=idx)

    no_batt = dispatch(prod, load, BatterySpec(capacity_kwh=0))
    with_batt = dispatch(prod, load, BatterySpec(capacity_kwh=10))
    assert with_batt.self_consumption.sum() > no_batt.self_consumption.sum()
    assert with_batt.feed_in.sum() < no_batt.feed_in.sum()


def test_battery_energy_balance():
    idx = _index(24)
    prod = pd.Series([0]*7 + [3]*5 + [0.5]*12, index=idx)
    load = pd.Series([0.5]*24, index=idx)
    res = dispatch(prod, load, BatterySpec(capacity_kwh=8))
    # Einspeisung + Eigenverbrauch (direkt) ≤ Produktion (Rest geht in Batterie/Verluste)
    total_out = res.self_consumption.sum() + res.feed_in.sum()
    assert total_out <= prod.sum() + 1e-6
