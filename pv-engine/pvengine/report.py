"""Komponente H — Report-Generator.

Setzt alle Tabellen + Charts zu einem HTML zusammen (PV*SOL-Look) und
rendert daraus optional ein PDF via WeasyPrint. Ohne WeasyPrint bleibt der
HTML-Output erhalten (kein harter Fehler).
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from . import charts
from .models import ProjectResult

_MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli",
                "August", "September", "Oktober", "November", "Dezember"]

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"


def _context(result: ProjectResult) -> dict:
    p, lay, el, sim, eco = (
        result.input, result.layout, result.electrical,
        result.simulation, result.economics,
    )
    monthly = [
        {
            "name": _MONTH_NAMES[m.month - 1],
            "yield_kwh": m.yield_kwh,
            "consumption_kwh": m.consumption_kwh,
            "self_consumption_kwh": m.self_consumption_kwh,
            "feed_in_kwh": m.feed_in_kwh,
            "grid_draw_kwh": m.grid_draw_kwh,
        }
        for m in sim.monthly
    ]
    return {
        "project_name": p.project_name,
        "customer_name": p.customer_name,
        "address": p.location.address or f"{p.location.latitude:.4f}, {p.location.longitude:.4f}",
        "generated_at": result.generated_at,
        "engine_version": result.engine_version,
        "climate_source": sim.climate_source,
        "climate_fallback": sim.climate_source.startswith("fallback"),
        # KPIs
        "kwp": f"{lay.kwp:.2f}",
        "modules": lay.total_modules,
        "annual_yield": f"{sim.annual_yield_kwh:,.0f}".replace(",", "."),
        "specific_yield": f"{sim.specific_yield_kwh_per_kwp:.0f}",
        "pr": f"{sim.performance_ratio:.1f}",
        "self_consumption_pct": f"{sim.self_consumption_pct:.0f}",
        "autarky": f"{sim.autarky_pct:.0f}",
        "co2": f"{sim.co2_savings_t:.2f}",
        "shading": f"{sim.shading_loss_pct:.1f}",
        # Komponenten
        "module_name": f"{p.module.manufacturer} {p.module.model}",
        "module_wp": p.module.pmpp_wp,
        "inverter_name": f"{p.inverter.manufacturer} {p.inverter.model}",
        "inverter_kw": f"{p.inverter.pac_nom_w / 1000:.1f}",
        "battery_kwh": p.battery.capacity_kwh,
        "battery_cycles": sim.battery_cycles,
        "strings": el.strings_total,
        "modules_per_string": el.modules_per_string,
        "dc_ac": el.dc_ac_ratio,
        # Wirtschaftlichkeit
        "capex": f"{eco.capex_eur:,.0f}".replace(",", "."),
        "payback": f"{eco.payback_years:.1f}" if eco.payback_years else "—",
        "profit": f"{eco.total_profit_20y_eur:,.0f}".replace(",", "."),
        "roi": f"{eco.roi_pct:.0f}",
        "irr": f"{eco.irr_pct:.1f} %" if eco.irr_pct is not None else "—",
        "lcoe": f"{eco.lcoe_ct_kwh:.1f}",
        "feed_in_ct": f"{eco.feed_in_ct_kwh:.2f}",
        "years": len(eco.cashflow),
        # Charts + Tabellen
        "monthly_chart": charts.monthly_chart(sim),
        "energy_flow_chart": charts.energy_flow_chart(sim),
        "cashflow_chart": charts.cashflow_chart(eco),
        "monthly": monthly,
        "cashflow": [c.model_dump() for c in eco.cashflow],
    }


def render_html(result: ProjectResult) -> str:
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    template = env.get_template("report.html")
    return template.render(**_context(result))


def render_pdf(result: ProjectResult, output_path: str | Path) -> Path:
    """HTML→PDF via WeasyPrint. Fällt auf .html zurück, wenn WeasyPrint fehlt."""
    html = render_html(result)
    output_path = Path(output_path)
    try:
        from weasyprint import HTML  # lazy import (schwere Systemdeps)

        HTML(string=html, base_url=str(_TEMPLATE_DIR)).write_pdf(str(output_path))
        return output_path
    except Exception:
        fallback = output_path.with_suffix(".html")
        fallback.write_text(html, encoding="utf-8")
        return fallback


def now_str() -> str:
    return datetime.now().strftime("%d.%m.%Y %H:%M")
