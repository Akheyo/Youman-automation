"""End-to-End-Tests der Pipeline (offline, deterministisch)."""
from pathlib import Path

from pvengine import ProjectInput, run
from pvengine.models import BatterySpec, ConsumptionInput, RoofPlane
from pvengine.report import render_html, render_pdf


def _project(**kw):
    return ProjectInput(
        roofs=[RoofPlane(tilt_deg=35, azimuth_deg=180, area_m2=60)],
        consumption=ConsumptionInput(annual_kwh=4500),
        **kw,
    )


def test_pipeline_runs_offline_with_sane_ranges():
    res = run(_project(), allow_network=False)
    sim = res.simulation
    assert res.simulation.climate_source.startswith("fallback")
    # spez. Ertrag NRW: plausibles Fenster
    assert 800 <= sim.specific_yield_kwh_per_kwp <= 1100
    # PR im realistischen Bereich
    assert 75 <= sim.performance_ratio <= 95
    assert sim.annual_yield_kwh > 0
    assert len(sim.monthly) == 12
    # Sommer (Juni) liefert mehr als Winter (Dezember)
    june = next(m for m in sim.monthly if m.month == 6)
    dec = next(m for m in sim.monthly if m.month == 12)
    assert june.yield_kwh > dec.yield_kwh


def test_battery_improves_autarky():
    no_b = run(_project(), allow_network=False)
    with_b = run(_project(battery=BatterySpec(capacity_kwh=10)), allow_network=False)
    assert with_b.simulation.autarky_pct > no_b.simulation.autarky_pct


def test_economics_present():
    res = run(_project(), allow_network=False)
    assert res.economics.capex_eur > 0
    assert res.economics.feed_in_ct_kwh > 0
    assert len(res.economics.cashflow) == 20


def test_report_html_renders():
    res = run(_project(), allow_network=False)
    html = render_html(res)
    assert "Photovoltaik-Ertragsprognose" in html
    assert "data:image/png;base64" in html  # Charts eingebettet


def test_report_pdf_or_html_written(tmp_path: Path):
    res = run(_project(), allow_network=False)
    out = render_pdf(res, tmp_path / "r.pdf")
    assert out.exists()
    assert out.suffix in (".pdf", ".html")
