from pvengine.config import DEFAULT_CONFIG
from pvengine.economics import calculate
from pvengine.models import (
    EconomicsInput,
    LayoutResult,
    ProjectInput,
    SimulationResult,
)


def _sim():
    return SimulationResult(
        annual_yield_kwh=6000,
        self_consumption_kwh=2500,
        feed_in_kwh=3500,
        grid_draw_kwh=2000,
    )


def test_cashflow_length_and_breakeven():
    project = ProjectInput(economics=EconomicsInput(capex_eur=12000))
    layout = LayoutResult(total_modules=15, kwp=6.6)
    res = calculate(project, layout, _sim(), DEFAULT_CONFIG)

    assert len(res.cashflow) == 20
    assert res.capex_eur == 12000
    # kumulierter Cashflow muss am Ende über der Investition liegen
    assert res.cashflow[-1].cumulative_eur > 0
    assert res.payback_years is not None
    assert 0 < res.payback_years < 20


def test_lcoe_and_roi_positive():
    project = ProjectInput(economics=EconomicsInput(capex_eur=12000))
    layout = LayoutResult(total_modules=15, kwp=6.6)
    res = calculate(project, layout, _sim(), DEFAULT_CONFIG)
    assert res.lcoe_ct_kwh > 0
    assert res.roi_pct > 0


def test_higher_capex_longer_payback():
    layout = LayoutResult(total_modules=15, kwp=6.6)
    cheap = calculate(ProjectInput(economics=EconomicsInput(capex_eur=10000)),
                      layout, _sim(), DEFAULT_CONFIG)
    pricey = calculate(ProjectInput(economics=EconomicsInput(capex_eur=18000)),
                       layout, _sim(), DEFAULT_CONFIG)
    assert pricey.payback_years > cheap.payback_years
