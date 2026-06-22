"""Zentrale, konfigurierbare Konstanten der PV-Engine.

Wichtig (Knackpunkt aus dem Architektur-Plan):
- EEG-Einspeisevergütungen ändern sich halbjährlich/degressiv.
  Sie werden hier NIEMALS undatiert hartkodiert, sondern als
  datierte Stützstellen geführt. `eeg_feed_in_ct_kwh()` wählt
  den zum Inbetriebnahme-Datum gültigen Satz.
- Alle Wirtschaftlichkeits- und Verlust-Konstanten sind an einer
  Stelle gebündelt, damit Tests deterministisch und Regressionen
  sofort sichtbar sind.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date


# ---------------------------------------------------------------------------
# EEG-Einspeisevergütung (Teileinspeisung, Anlagen bis 10 kWp / 10–40 kWp)
# Quelle: EEG 2023 §48/§49 inkl. halbjährlicher Degression.
# Stützstellen sind ab-Datum gültig (gilt bis zur nächsten Stützstelle).
# Werte in ct/kWh. Bei Gesetzesänderung hier ergänzen — Code bleibt unberührt.
# ---------------------------------------------------------------------------
EEG_FEED_IN_RATES: list[tuple[date, float, float]] = [
    # (gültig_ab, satz_bis_10kWp, satz_anteil_10_bis_40kWp)
    (date(2023, 2, 1), 8.20, 7.10),
    (date(2024, 2, 1), 8.10, 7.00),
    (date(2024, 8, 1), 8.03, 6.95),
    (date(2025, 2, 1), 7.94, 6.88),
    (date(2025, 8, 1), 7.86, 6.80),
    (date(2026, 2, 1), 7.78, 6.73),
]


def eeg_feed_in_ct_kwh(kwp: float, commissioning: date | None = None) -> float:
    """Mengengewichteter EEG-Satz (ct/kWh) für Teileinspeisung.

    Anlagen >10 kWp werden anteilig vergütet: erste 10 kWp zum kleinen-Satz,
    Rest (bis 40 kWp) zum mittleren Satz.
    """
    commissioning = commissioning or date.today()
    rate_small, rate_mid = EEG_FEED_IN_RATES[0][1], EEG_FEED_IN_RATES[0][2]
    for valid_from, small, mid in EEG_FEED_IN_RATES:
        if commissioning >= valid_from:
            rate_small, rate_mid = small, mid
        else:
            break
    if kwp <= 10:
        return rate_small
    share_small = 10.0 / kwp
    share_mid = (min(kwp, 40.0) - 10.0) / kwp
    return rate_small * share_small + rate_mid * share_mid


@dataclass(frozen=True)
class SimulationDefaults:
    """Default-Modellparameter für die pvlib-Simulation."""

    # Temperaturmodell (Faiman): u0/u1 für freistehend/aufgeständert
    temp_u0: float = 25.0
    temp_u1: float = 6.84
    # PVWatts DC-Modell
    gamma_pdc: float = -0.0035          # Temperatur-Koeffizient Pmpp [1/°C]
    # Wechselrichter (PVWatts)
    inverter_eta_nom: float = 0.97      # Nenn-Wirkungsgrad
    # System-Verluste (PVWatts pvwatts_losses, in %)
    # Default-Stack auf eine hochwertige Neuanlage kalibriert (Ziel-PR ~91 %,
    # vgl. Shamoun-Referenzreport). Für konservativere Prognosen erhöhen.
    soiling: float = 1.5
    shading_system: float = 0.0         # zusätzlich zur geometrischen Verschattung
    snow: float = 0.0
    mismatch: float = 1.0
    wiring: float = 1.0
    connections: float = 0.5
    lid: float = 0.5                    # Light Induced Degradation (Anfang)
    nameplate_rating: float = 0.0
    age: float = 0.0
    availability: float = 0.0           # Verfügbarkeit separat (z.B. 3%)
    # Albedo (Bodenreflexion)
    albedo: float = 0.20


@dataclass(frozen=True)
class EconomicsDefaults:
    """Default-Annahmen der Wirtschaftlichkeits-Engine."""

    project_years: int = 20
    electricity_price_ct_kwh: float = 35.0      # Bezugs-Strompreis
    price_escalation_pct: float = 3.0           # jährl. Strompreissteigerung
    feed_in_escalation_pct: float = 0.0         # EEG ist fix über 20 J
    discount_rate_pct: float = 3.0              # Kalkulationszins (LCOE/Barwert)
    opex_pct_of_capex: float = 1.0             # jährl. Betriebskosten
    module_degradation_pct: float = 0.5         # jährl. Leistungsverlust
    inflation_pct: float = 2.0
    # Investitionskosten (Richtwerte, konfigurierbar)
    capex_eur_per_kwp: float = 1350.0
    battery_eur_per_kwh: float = 700.0
    vat_pct: float = 0.0                         # 0% USt für Privat-PV (§12 III UStG)


@dataclass(frozen=True)
class CO2Defaults:
    """CO₂-Bilanz."""

    grid_emission_factor_g_per_kwh: float = 380.0   # dt. Strommix (UBA-Richtwert)


@dataclass(frozen=True)
class EngineConfig:
    """Gebündelte Engine-Konfiguration (frozen → deterministisch)."""

    sim: SimulationDefaults = field(default_factory=SimulationDefaults)
    eco: EconomicsDefaults = field(default_factory=EconomicsDefaults)
    co2: CO2Defaults = field(default_factory=CO2Defaults)


DEFAULT_CONFIG = EngineConfig()
