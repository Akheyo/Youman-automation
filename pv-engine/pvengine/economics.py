"""Komponente F — Wirtschaftlichkeits-Engine (Report S. 4, 15–17).

- EEG-Einspeisevergütung (datiert/konfigurierbar) für eingespeiste kWh
- Eigenverbrauchs-Ersparnis zum Bezugspreis (mit Preissteigerung)
- 20-Jahre-Cashflow + kumulierter Cashflow
- Amortisationsdauer, Gesamtrendite (ROI), Stromgestehungskosten (LCOE), IRR
"""
from __future__ import annotations

from datetime import date

from .config import EngineConfig, eeg_feed_in_ct_kwh
from .models import (
    CashflowYear,
    EconomicsResult,
    LayoutResult,
    ProjectInput,
    SimulationResult,
)


def _irr(cashflows: list[float]) -> float | None:
    """Interner Zinsfuß via Bisektion (Cashflow[0] = -CAPEX)."""
    def npv(rate: float) -> float:
        return sum(cf / (1 + rate) ** t for t, cf in enumerate(cashflows))

    if npv(0.0) <= 0:
        return None
    lo, hi = 0.0, 1.0
    if npv(hi) > 0:
        return None  # >100 % IRR, nicht sinnvoll auszuweisen
    for _ in range(200):
        mid = (lo + hi) / 2
        v = npv(mid)
        if abs(v) < 1e-6:
            return mid
        if v > 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def calculate(
    project: ProjectInput,
    layout: LayoutResult,
    sim: SimulationResult,
    config: EngineConfig,
) -> EconomicsResult:
    eco = config.eco
    ein = project.economics

    years = ein.project_years or eco.project_years
    price = (ein.electricity_price_ct_kwh
             if ein.electricity_price_ct_kwh is not None
             else eco.electricity_price_ct_kwh) / 100.0  # €/kWh
    escalation = ((ein.price_escalation_pct
                   if ein.price_escalation_pct is not None
                   else eco.price_escalation_pct) / 100.0)

    commissioning = ein.commissioning_date or date.today()
    feed_in_ct = eeg_feed_in_ct_kwh(layout.kwp, commissioning)
    feed_in_rate = feed_in_ct / 100.0  # €/kWh

    # CAPEX
    if ein.capex_eur is not None:
        capex = ein.capex_eur
    else:
        per_kwp = ein.capex_eur_per_kwp or eco.capex_eur_per_kwp
        capex = layout.kwp * per_kwp
        capex += project.battery.capacity_kwh * eco.battery_eur_per_kwh
    capex *= (1 + eco.vat_pct / 100.0)

    sc0 = sim.self_consumption_kwh
    feed0 = sim.feed_in_kwh
    degr = eco.module_degradation_pct / 100.0
    opex0 = capex * eco.opex_pct_of_capex / 100.0
    infl = eco.inflation_pct / 100.0
    disc = eco.discount_rate_pct / 100.0

    cashflow: list[CashflowYear] = []
    cumulative = -capex
    nominal_cashflows = [-capex]
    disc_energy = 0.0
    disc_cost = capex  # CAPEX im Jahr 0

    payback = None
    total_profit = 0.0

    for y in range(1, years + 1):
        perf = (1 - degr) ** (y - 1)
        sc = sc0 * perf
        feed = feed0 * perf
        cur_price = price * (1 + escalation) ** (y - 1)

        savings = sc * cur_price
        feed_rev = feed * feed_in_rate  # EEG 20 J fix
        opex = opex0 * (1 + infl) ** (y - 1)
        net = savings + feed_rev - opex

        cumulative += net
        total_profit += net
        nominal_cashflows.append(net)

        # LCOE: diskontierte Energie & Kosten
        energy = sc + feed
        disc_energy += energy / (1 + disc) ** y
        disc_cost += opex / (1 + disc) ** y

        if payback is None and cumulative >= 0:
            prev = cumulative - net
            frac = (-prev / net) if net > 0 else 0.0
            payback = round((y - 1) + frac, 1)

        cashflow.append(CashflowYear(
            year=y,
            feed_in_revenue_eur=round(feed_rev, 2),
            savings_eur=round(savings, 2),
            opex_eur=round(opex, 2),
            net_cashflow_eur=round(net, 2),
            cumulative_eur=round(cumulative, 2),
        ))

    lcoe = (disc_cost / disc_energy * 100.0) if disc_energy > 0 else 0.0  # ct/kWh
    roi = (total_profit / capex * 100.0) if capex > 0 else 0.0
    irr = _irr(nominal_cashflows)

    return EconomicsResult(
        capex_eur=round(capex, 2),
        feed_in_ct_kwh=round(feed_in_ct, 2),
        payback_years=payback,
        total_profit_20y_eur=round(total_profit, 2),
        roi_pct=round(roi, 1),
        lcoe_ct_kwh=round(lcoe, 2),
        irr_pct=round(irr * 100.0, 1) if irr is not None else None,
        cashflow=cashflow,
    )
