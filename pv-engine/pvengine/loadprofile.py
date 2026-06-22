"""Komponente E — Lastprofil.

Aufgabe: stündliches Verbrauchsprofil (Report S. 5, Deckungsanteile).

Erzeugt ein BDEW-H0-ähnliches Haushaltsprofil (8760 h), skaliert auf die
Jahres-kWh. Form: Grundlast + Morgen-/Abendspitze, Wochenend-Verschiebung,
saisonale Gewichtung (Winter höher). Das ist eine anerkannte Näherung des
H0-Profils; die offiziellen BDEW-Tabellen können über `custom_profile_8760`
eingespeist werden. E-Auto- und Wärmepumpen-Verbrauch werden additiv
überlagert (typische Lade-/Heizmuster).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .models import ConsumptionInput


def _h0_hourly_shape(index: pd.DatetimeIndex) -> np.ndarray:
    """Relative H0-Stundenform (unnormiert)."""
    hour = index.hour.to_numpy()
    is_weekend = index.dayofweek.to_numpy() >= 5
    month = index.month.to_numpy()

    base = 0.55
    # Morgenspitze (~7 Uhr) + Abendspitze (~19–20 Uhr)
    morning = 0.6 * np.exp(-((hour - 7.0) ** 2) / (2 * 1.6 ** 2))
    evening = 1.0 * np.exp(-((hour - 19.5) ** 2) / (2 * 2.2 ** 2))
    midday = 0.25 * np.exp(-((hour - 13.0) ** 2) / (2 * 2.5 ** 2))
    shape = base + morning + evening + midday

    # Wochenende: Morgenspitze flacher/später, tagsüber etwas höher
    we_shape = base + 0.7 * np.exp(-((hour - 10.0) ** 2) / (2 * 3.0 ** 2)) \
        + 1.0 * np.exp(-((hour - 19.5) ** 2) / (2 * 2.5 ** 2)) + 0.15
    shape = np.where(is_weekend, we_shape, shape)

    # Saisonale Gewichtung (Winter ~ +20 %, Sommer ~ −15 %; Beleuchtung etc.)
    seasonal = 1.0 + 0.18 * np.cos((month - 1) / 12.0 * 2 * np.pi)
    return shape * seasonal


def _ev_hourly_shape(index: pd.DatetimeIndex) -> np.ndarray:
    """E-Auto-Heimladen: abends/nachts (18–23 Uhr Schwerpunkt)."""
    hour = index.hour.to_numpy()
    shape = np.exp(-((hour - 20.5) ** 2) / (2 * 2.5 ** 2))
    return shape


def _heatpump_hourly_shape(index: pd.DatetimeIndex) -> np.ndarray:
    """Wärmepumpe: stark winterlastig, Morgen-/Abendbetonung."""
    hour = index.hour.to_numpy()
    month = index.month.to_numpy()
    daily = 0.5 + 0.5 * np.exp(-((hour - 7.0) ** 2) / (2 * 3 ** 2)) \
        + 0.5 * np.exp(-((hour - 19.0) ** 2) / (2 * 3 ** 2))
    # Heizgradtag-Näherung: Winter hoch, Sommer ~0
    seasonal = np.clip(np.cos((month - 1) / 12.0 * 2 * np.pi), -0.2, 1.0) + 0.2
    return daily * seasonal


def build_load_profile(
    consumption: ConsumptionInput,
    index: pd.DatetimeIndex,
) -> pd.Series:
    """Stündliches Lastprofil (kWh je Stunde), passend zum TMY-Index."""
    if consumption.custom_profile_8760 is not None:
        vals = np.asarray(consumption.custom_profile_8760, dtype=float)
        if len(vals) != len(index):
            # auf Indexlänge bringen (z.B. Schaltjahr-Diskrepanz)
            vals = np.resize(vals, len(index))
        series = pd.Series(vals, index=index)
        return series * (consumption.annual_kwh / series.sum())

    def scaled(shape_fn, annual_kwh: float) -> np.ndarray:
        shape = shape_fn(index)
        total = shape.sum()
        return shape / total * annual_kwh if total > 0 else np.zeros(len(index))

    base = scaled(_h0_hourly_shape, consumption.annual_kwh)
    ev = scaled(_ev_hourly_shape, consumption.ev_annual_kwh) \
        if consumption.ev_annual_kwh > 0 else np.zeros(len(index))
    hp = scaled(_heatpump_hourly_shape, consumption.heatpump_annual_kwh) \
        if consumption.heatpump_annual_kwh > 0 else np.zeros(len(index))

    return pd.Series(base + ev + hp, index=index)
