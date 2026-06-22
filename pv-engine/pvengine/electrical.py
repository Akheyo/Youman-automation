"""Komponente C — Elektrische Auslegung.

Aufgabe: String-Sizing & Wechselrichterverschaltung (Report S. 9, 23–25).

- Module/String aus dem MPPT-Spannungsfenster des WR (mit Temperatur-
  Korrektur von Voc bei kalt / Vmp bei heiß).
- Anzahl Strings, Verteilung auf MPP-Tracker, WR-Anzahl.
- DC/AC-Dimensionierungsfaktor.
"""
from __future__ import annotations

from .models import ElectricalResult, InverterSpec, ModuleSpec

# Auslegungs-Temperaturen (Deutschland, konservativ)
T_COLD_C = -10.0   # für Voc-Maximum (kalt)
T_HOT_C = 70.0     # Zelltemperatur heiß, für Vmp-Minimum
T_STC_C = 25.0


def size_strings(
    module: ModuleSpec,
    inverter: InverterSpec,
    total_modules: int,
) -> ElectricalResult:
    """String-Auslegung über das MPPT-Fenster."""
    notes: list[str] = []
    if total_modules <= 0:
        return ElectricalResult(notes=["Keine Module — keine Auslegung."])

    # Spannungs-Temperaturkorrektur
    voc_cold = module.voc_v * (1 + module.temp_coeff_voc_pct_k / 100.0 * (T_COLD_C - T_STC_C))
    vmp_hot = module.vmp_v * (1 + module.temp_coeff_pmpp_pct_k / 100.0 * (T_HOT_C - T_STC_C))

    # Max Module/String: Voc(kalt)-Kette darf v_max_dc nicht übersteigen
    max_by_vmax = int(inverter.v_max_dc // voc_cold) if voc_cold > 0 else 0
    # Auch das obere MPPT-Fenster begrenzt (Vmp bei STC)
    max_by_mppt_hi = int(inverter.mppt_v_max // module.vmp_v) if module.vmp_v > 0 else 0
    max_modules = max(min(max_by_vmax, max_by_mppt_hi), 0)

    # Min Module/String: Vmp(heiß)-Kette muss über mppt_v_min bleiben
    min_modules = 1
    if vmp_hot > 0:
        import math
        min_modules = max(math.ceil(inverter.mppt_v_min / vmp_hot), 1)

    if min_modules > max_modules:
        notes.append(
            f"Spannungsfenster eng: min {min_modules} > max {max_modules} Module/String. "
            "Anderen WR oder Modul prüfen."
        )
        modules_per_string = max_modules or min_modules
    else:
        # Ziel: möglichst lange Strings (weniger Strings, gleichmäßig)
        modules_per_string = max_modules
        # auf Teiler suchen, der die Module gleichmäßig aufteilt
        for n in range(max_modules, min_modules - 1, -1):
            if total_modules % n == 0:
                modules_per_string = n
                break

    strings = max(round(total_modules / modules_per_string), 1) if modules_per_string else 1
    string_voltage = modules_per_string * module.vmp_v

    # WR-Anzahl aus Strings/MPPT-Kapazität
    strings_capacity = inverter.mppt_count * inverter.strings_per_mppt
    inverter_count = max(-(-strings // strings_capacity), 1)  # ceil

    kwp = total_modules * module.pmpp_wp / 1000.0
    dc_ac_ratio = (kwp * 1000.0) / (inverter.pac_nom_w * inverter_count)

    if dc_ac_ratio < 0.9:
        notes.append(f"WR überdimensioniert (DC/AC={dc_ac_ratio:.2f}).")
    elif dc_ac_ratio > 1.5:
        notes.append(f"WR knapp (DC/AC={dc_ac_ratio:.2f}) — Abregelung möglich.")

    return ElectricalResult(
        modules_per_string=modules_per_string,
        strings_total=strings,
        string_voltage_stc_v=round(string_voltage, 1),
        dc_ac_ratio=round(dc_ac_ratio, 2),
        inverter_count=inverter_count,
        notes=notes,
    )
