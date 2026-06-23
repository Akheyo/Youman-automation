"""Crosscheck: Engine-Transposition vs. PVGIS — auf IDENTISCHEM Klima.

Ziel (vom Nutzer vorgegeben): Modell-Anteil vom Klima-Anteil des +7,5 %-Offsets
trennen, OHNE das Modell zu tunen.

Methode (gleiche SARAH-Stundenreihe für beide Seiten):
  1. PVGIS-Stundenreihe horizontal (tilt=0) holen → GHI, Strahl horizontal, DHI.
  2. Daraus DNI rekonstruieren (DNI = Strahl_horizontal / cos(zenith), pvlib-Sonnenstand).
  3. Meine Hay-&-Davies-Transposition (pvlib.get_total_irradiance) auf die geneigte
     Ebene rechnen → Engine-POA.
  4. PVGIS-Stundenreihe für DIESELBE geneigte Ebene holen → PVGIS-POA (dessen
     eigene Transposition derselben SARAH-Daten).
  5. Engine-POA vs PVGIS-POA vergleichen (kWp-gewichtet über alle Dachflächen).

Entscheidung:
  |Δ POA| < 2 %  → Transposition ok → Offset ist reines Klima (SARAH2 vs DWD-TMY3)
                   → Band-Weitung auf ±8 % gerechtfertigt.
  |Δ POA| ≥ 2 %  → Transpositions-/POA-Modellabweichung → MELDEN, Band NICHT weiten.

Zusätzlich (Kontext): PVGIS-eigene PV-Ertragsrechnung (pvcalculation) je Ebene.

Läuft nur online (GitHub-Runner); PVGIS in der Sandbox 403-geblockt.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pvlib

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

REPORT_MD = Path(__file__).resolve().parent / "pvgis_crosscheck_report.md"

LAT, LON = 51.9925, 6.92
ALBEDO = 0.20
# (tilt, azimuth pvlib-Konvention, Modulzahl) — Shamoun-Dächer
PLANES = [(45, 187, 16), (45, 98, 9), (45, 278, 9)]
PMPP_WP = 450
PVGIS_URLS = (
    "https://re.jrc.ec.europa.eu/api/v5_2/",
    "https://re.jrc.ec.europa.eu/api/v5_3/",
)


def _pvgis_hourly(**kwargs):
    """get_pvgis_hourly mit versionierter URL + robustem 2-Tupel-Unpack."""
    last = None
    for url in PVGIS_URLS:
        try:
            res = pvlib.iotools.get_pvgis_hourly(
                LAT, LON, url=url, map_variables=True, timeout=60, **kwargs
            )
            return res[0]
        except Exception as exc:  # noqa: BLE001
            last = exc
            print(f"[crosscheck] PVGIS {url} fehlgeschlagen: "
                  f"{type(exc).__name__}: {str(exc)[:160]}", file=sys.stderr)
    raise RuntimeError(f"PVGIS nicht erreichbar: {last}")


def _poa_sum(df: pd.DataFrame) -> float:
    cols = [c for c in ("poa_direct", "poa_sky_diffuse", "poa_ground_diffuse")
            if c in df.columns]
    return float(df[cols].sum(axis=1).clip(lower=0).sum())


def main() -> int:
    # 1) Horizontale Stundenreihe (tilt=0) → GHI/Strahl_h/DHI
    hor = _pvgis_hourly(surface_tilt=0, surface_azimuth=180,
                        components=True, pvcalculation=False)
    idx = hor.index
    ghi = hor.get("poa_direct", 0) + hor.get("poa_sky_diffuse", 0) \
        + hor.get("poa_ground_diffuse", 0)
    beam_h = hor["poa_direct"].clip(lower=0)
    dhi = hor["poa_sky_diffuse"].clip(lower=0)

    site = pvlib.location.Location(LAT, LON, tz="UTC")
    solpos = site.get_solarposition(idx)
    zenith = solpos["apparent_zenith"]
    azimuth = solpos["azimuth"]
    cosz = np.cos(np.radians(zenith)).clip(lower=0.02)
    dni = (beam_h / cosz).clip(lower=0, upper=1367)
    dni = dni.where(zenith < 90, 0.0)
    dni_extra = pvlib.irradiance.get_extra_radiation(idx)

    n_years = (idx[-1] - idx[0]).days / 365.25

    rows = []
    eng_poa_w = pvgis_poa_w = 0.0
    total_kwp = 0.0
    for tilt, az, n_mod in PLANES:
        kwp = n_mod * PMPP_WP / 1000.0
        total_kwp += kwp

        # Engine: Hay & Davies auf dieselbe Stundenreihe
        poa = pvlib.irradiance.get_total_irradiance(
            surface_tilt=tilt, surface_azimuth=az,
            solar_zenith=zenith, solar_azimuth=azimuth,
            dni=dni, ghi=ghi, dhi=dhi, dni_extra=dni_extra,
            albedo=ALBEDO, model="haydavies",
        )
        eng_poa = float(poa["poa_global"].fillna(0).clip(lower=0).sum())

        # PVGIS: eigene Transposition derselben SARAH-Daten, geneigte Ebene
        tilted = _pvgis_hourly(surface_tilt=tilt, surface_azimuth=az,
                               components=True, pvcalculation=False)
        pv_poa = _poa_sum(tilted)

        eng_kwh = eng_poa / 1000.0 / n_years
        pv_kwh = pv_poa / 1000.0 / n_years
        dev = (eng_poa - pv_poa) / pv_poa * 100.0 if pv_poa else 0.0
        rows.append((f"{tilt}°/{az}°", n_mod, eng_kwh, pv_kwh, dev))
        eng_poa_w += eng_poa * kwp
        pvgis_poa_w += pv_poa * kwp

    eng_w = eng_poa_w / total_kwp
    pv_w = pvgis_poa_w / total_kwp
    overall_dev = (eng_w - pv_w) / pv_w * 100.0

    # Kontext: PVGIS-eigene PV-Ertragsrechnung (kWp-gewichtet)
    pvgis_specyield = None
    try:
        py_w = 0.0
        for tilt, az, n_mod in PLANES:
            kwp = n_mod * PMPP_WP / 1000.0
            d = _pvgis_hourly(surface_tilt=tilt, surface_azimuth=az,
                              components=False, pvcalculation=True,
                              peakpower=1.0, loss=10.0, mountingplace="building")
            py = float(d["P"].sum()) / 1000.0 / n_years  # kWh/kWp
            py_w += py * kwp
        pvgis_specyield = py_w / total_kwp
    except Exception as exc:  # noqa: BLE001
        print(f"[crosscheck] PVGIS pvcalculation übersprungen: {exc}", file=sys.stderr)

    # Report
    lines = ["# PVGIS-Crosscheck — Transposition (identisches SARAH-Klima)", ""]
    lines.append(f"- Standort: {LAT}, {LON} · Zeitreihe ~{n_years:.0f} Jahre")
    lines.append("- Vergleich: Engine Hay&Davies vs PVGIS-Transposition, "
                 "**gleiche Stundenreihe** (keine Verluste, keine WR).")
    lines += ["", "| Ebene | Module | Engine-POA | PVGIS-POA | Δ |",
              "|---|--:|--:|--:|--:|"]
    for name, n, e, p, d in rows:
        lines.append(f"| {name} | {n} | {e:.0f} kWh/m² | {p:.0f} kWh/m² | {d:+.2f}% |")
    lines.append(f"| **kWp-gewichtet** | {sum(p[2] for p in PLANES)} | "
                 f"{eng_w/1000:.0f} kWh/m² | {pv_w/1000:.0f} kWh/m² | **{overall_dev:+.2f}%** |")
    if pvgis_specyield is not None:
        lines += ["", f"- Kontext PVGIS-eigene PV-Rechnung (loss=10 %, building): "
                  f"**{pvgis_specyield:.0f} kWh/kWp** (vs Engine auf PVGIS-TMY ~1004)."]

    verdict_fail = abs(overall_dev) >= 2.0
    lines += ["", "## Verdikt", ""]
    if verdict_fail:
        lines.append(f"❌ **Transpositions-Abweichung {overall_dev:+.2f}% ≥ 2 %** "
                     "→ Modell-Anteil vorhanden (POA/Transposition). Band NICHT "
                     "weiten — Ursache untersuchen.")
    else:
        lines.append(f"✅ **Transposition stimmt ({overall_dev:+.2f}%, < 2 %)** auf "
                     "identischem Klima → der +7,5 %-Ertragsoffset ist **reines "
                     "Klima** (PVGIS-SARAH2 vs PV*SOL-DWD-TMY3). Band-Weitung auf "
                     "±8 % gerechtfertigt (kein Modell-Tuning).")
    md = "\n".join(lines) + "\n"
    REPORT_MD.write_text(md, encoding="utf-8")
    print(md)
    print(f"Report: {REPORT_MD}")

    # Diagnose-Skript: Exit 0 (liefert Befund), Verdikt steht im Log.
    return 0


if __name__ == "__main__":
    sys.exit(main())
