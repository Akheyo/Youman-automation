"""Charts für den Report (Komponente H Zulieferer).

Erzeugt Monatsbalken (Ertrag vs. Verbrauch), Cashflow-Kurve und
Deckungs-/Energiefluss-Grafik als Base64-PNG (direkt in HTML einbettbar).
"""
from __future__ import annotations

import base64
import io

import matplotlib

matplotlib.use("Agg")  # headless
import matplotlib.pyplot as plt  # noqa: E402

from .models import EconomicsResult, SimulationResult  # noqa: E402

_MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
           "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
_GREEN = "#2e7d32"
_BLUE = "#1565c0"
_ORANGE = "#ef6c00"
_GREY = "#9e9e9e"


def _to_b64(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return "data:image/png;base64," + base64.b64encode(buf.read()).decode("ascii")


def monthly_chart(sim: SimulationResult) -> str:
    yields = [m.yield_kwh for m in sim.monthly]
    cons = [m.consumption_kwh for m in sim.monthly]
    sc = [m.self_consumption_kwh for m in sim.monthly]

    fig, ax = plt.subplots(figsize=(7.5, 3.2))
    x = range(12)
    ax.bar([i - 0.2 for i in x], yields, width=0.4, label="PV-Ertrag", color=_GREEN)
    ax.bar([i + 0.2 for i in x], cons, width=0.4, label="Verbrauch", color=_GREY)
    ax.bar([i - 0.2 for i in x], sc, width=0.4, label="Eigenverbrauch",
           color=_ORANGE, alpha=0.85)
    ax.set_xticks(list(x))
    ax.set_xticklabels(_MONTHS, fontsize=8)
    ax.set_ylabel("kWh")
    ax.set_title("Monatlicher Ertrag & Verbrauch", fontsize=10)
    ax.legend(fontsize=8, loc="upper right")
    ax.grid(axis="y", alpha=0.3)
    return _to_b64(fig)


def cashflow_chart(eco: EconomicsResult) -> str:
    years = [0] + [c.year for c in eco.cashflow]
    cum = [-eco.capex_eur] + [c.cumulative_eur for c in eco.cashflow]

    fig, ax = plt.subplots(figsize=(7.5, 3.2))
    colors = [_GREEN if v >= 0 else _ORANGE for v in cum]
    ax.bar(years, cum, color=colors, alpha=0.85)
    ax.axhline(0, color="black", linewidth=0.8)
    if eco.payback_years:
        ax.axvline(eco.payback_years, color=_BLUE, linestyle="--", linewidth=1.2,
                   label=f"Amortisation {eco.payback_years:.1f} J")
        ax.legend(fontsize=8)
    ax.set_xlabel("Jahr")
    ax.set_ylabel("Kumulierter Cashflow (€)")
    ax.set_title("Wirtschaftlichkeit — kumulierter Cashflow", fontsize=10)
    ax.grid(axis="y", alpha=0.3)
    return _to_b64(fig)


def energy_flow_chart(sim: SimulationResult) -> str:
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(7.5, 3.2))

    # Ertragsverwendung (Basis = Jahresertrag, inkl. Speicherverluste)
    sc = sim.self_consumption_kwh
    feed = sim.feed_in_kwh
    losses = max(sim.annual_yield_kwh - sc - feed, 0.0)
    slices = [sc, feed]
    labels = ["Eigenverbrauch", "Einspeisung"]
    colors = [_ORANGE, _GREEN]
    if losses > 0.01 * sim.annual_yield_kwh:
        slices.append(losses)
        labels.append("Speicherverluste")
        colors.append(_GREY)
    ax1.pie(slices, labels=labels, autopct="%1.0f%%", colors=colors,
            textprops={"fontsize": 8})
    ax1.set_title("Ertragsverwendung", fontsize=10)

    # Verbrauchsdeckung
    grid = sim.grid_draw_kwh
    ax2.pie([sc, grid], labels=["aus PV/Speicher", "Netzbezug"],
            autopct="%1.0f%%", colors=[_GREEN, _GREY],
            textprops={"fontsize": 8})
    ax2.set_title(f"Verbrauchsdeckung (Autarkie {sim.autarky_pct:.0f}%)",
                  fontsize=10)
    return _to_b64(fig)
