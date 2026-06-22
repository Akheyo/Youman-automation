"""Klimadaten-Layer — TMY-Beschaffung.

Primär: PVGIS-TMY (EU JRC, kostenlos) über pvlib.iotools.get_pvgis_tmy.
Fallback: deterministischer, physikalisch plausibler TMY-Synthesizer auf
Basis von pvlib-Clear-Sky + monatlichen Einstrahlungssummen (für Offline-
Betrieb / Tests / blockierte Netzwerke). Der Fallback ist klar als solcher
gekennzeichnet (`source`), damit er nie unbemerkt in einem Report landet.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
import pvlib

from .models import Location

# Monatliche Globalstrahlung auf die Horizontale (kWh/m²/Monat),
# Richtwert für das westliche NRW (~970 kWh/m²·a). Dient nur dem Offline-
# Fallback; mit echtem PVGIS werden Messreihen verwendet.
_NRW_MONTHLY_GHI_KWH = {
    1: 17, 2: 31, 3: 64, 4: 110, 5: 145, 6: 152,
    7: 150, 8: 128, 9: 88, 10: 50, 11: 22, 12: 13,
}
# Monatliche mittlere Lufttemperatur (°C), NRW-Richtwert.
_NRW_MONTHLY_TEMP_C = {
    1: 2.5, 2: 3.0, 3: 6.0, 4: 9.5, 5: 13.5, 6: 16.5,
    7: 18.5, 8: 18.0, 9: 14.5, 10: 10.0, 11: 6.0, 12: 3.5,
}
# Monatlicher Diffusstrahlungsanteil (DHI/GHI), NRW-Richtwert (~0.57 p.a.).
# Erbs auf gleichmäßig skaliertem Clear-Sky überschätzt den Diffusanteil
# systematisch; diese Tabelle hält ihn physikalisch plausibel.
_NRW_MONTHLY_DIFFUSE_FRAC = {
    1: 0.72, 2: 0.65, 3: 0.60, 4: 0.55, 5: 0.52, 6: 0.52,
    7: 0.52, 8: 0.52, 9: 0.55, 10: 0.62, 11: 0.70, 12: 0.75,
}


@dataclass
class TMY:
    """Typisches meteorologisches Jahr (8760 Stunden, lokale Zeit)."""

    data: pd.DataFrame  # Spalten: ghi, dni, dhi, temp_air, wind_speed
    source: str

    @property
    def is_fallback(self) -> bool:
        return self.source.startswith("fallback")


def get_tmy(location: Location, *, allow_network: bool = True,
            timeout: float = 15.0) -> TMY:
    """TMY beschaffen: erst PVGIS, dann Offline-Fallback."""
    if allow_network:
        tmy = _try_pvgis(location, timeout=timeout)
        if tmy is not None:
            return tmy
    return _synthesize_tmy(location)


def _try_pvgis(location: Location, *, timeout: float) -> TMY | None:
    try:
        df, _, _, _ = pvlib.iotools.get_pvgis_tmy(
            location.latitude, location.longitude,
            outputformat="json", map_variables=True, timeout=timeout,
        )
        df = df.tz_convert(location.timezone)
        out = pd.DataFrame({
            "ghi": df["ghi"],
            "dni": df["dni"],
            "dhi": df["dhi"],
            "temp_air": df["temp_air"],
            "wind_speed": df.get("wind_speed", pd.Series(2.0, index=df.index)),
        })
        # PVGIS-TMY hat gemischte Jahre — auf ein einheitliches Jahr normieren
        out.index = _normalize_to_year(out.index, location.timezone)
        out = out.sort_index()
        return TMY(data=out, source="PVGIS-TMY (EU JRC)")
    except Exception:
        return None


def _normalize_to_year(index: pd.DatetimeIndex, tz: str, year: int = 2019):
    return pd.DatetimeIndex(
        [ts.replace(year=year) for ts in index], tz=tz
    )


def _synthesize_tmy(location: Location, year: int = 2019) -> TMY:
    """Clear-Sky + monatliche Skalierung → realistischer Offline-TMY."""
    times = pd.date_range(
        f"{year}-01-01 00:30", f"{year}-12-31 23:30",
        freq="h", tz=location.timezone,
    )
    site = pvlib.location.Location(
        location.latitude, location.longitude,
        tz=location.timezone, altitude=location.altitude_m,
    )
    solpos = site.get_solarposition(times)
    clearsky = site.get_clearsky(times, model="ineichen")
    ghi_cs = clearsky["ghi"]

    # GHI pro Monat auf die Zielsumme skalieren (Diurnal-Form bleibt erhalten)
    ghi = ghi_cs.copy()
    for month in range(1, 13):
        mask = ghi.index.month == month
        cs_sum_kwh = ghi_cs[mask].sum() / 1000.0
        if cs_sum_kwh > 0:
            factor = _NRW_MONTHLY_GHI_KWH[month] / cs_sum_kwh
            ghi.loc[mask] = ghi_cs[mask] * factor

    # GHI → DHI/DNI über realistische monatliche Diffusfraktion.
    # DNI = (GHI − DHI) / cos(zenith), begrenzt auf die extraterr. Einstrahlung.
    ghi = ghi.clip(lower=0.0)
    df_month = np.array([_NRW_MONTHLY_DIFFUSE_FRAC[m] for m in times.month])
    dhi = (ghi * df_month).clip(lower=0.0)
    cos_z = np.cos(np.radians(solpos["zenith"].to_numpy())).clip(min=0.02)
    dni_extra = pvlib.irradiance.get_extra_radiation(times).to_numpy()
    dni = ((ghi.to_numpy() - dhi.to_numpy()) / cos_z).clip(min=0.0)
    dni = np.minimum(dni, dni_extra)
    # Nachts (Sonne unter Horizont) keine Direktstrahlung
    dni = np.where(solpos["zenith"].to_numpy() < 90, dni, 0.0)
    dni = pd.Series(dni, index=times)
    dhi = pd.Series(dhi.to_numpy(), index=times)

    # Lufttemperatur: Monatsmittel + Tagesgang (Min ~6 Uhr, Max ~15 Uhr)
    month_temp = np.array([_NRW_MONTHLY_TEMP_C[m] for m in times.month])
    hour = times.hour + times.minute / 60.0
    diurnal = 4.0 * np.sin((hour - 9.0) / 24.0 * 2 * np.pi)
    temp_air = month_temp + diurnal

    data = pd.DataFrame({
        "ghi": ghi.values,
        "dni": dni.values,
        "dhi": dhi.values,
        "temp_air": temp_air,
        "wind_speed": np.full(len(times), 2.0),
    }, index=times)

    return TMY(data=data, source="fallback (Offline-Synthese, NRW-Klimamittel)")
