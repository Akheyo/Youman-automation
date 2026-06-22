"""Komponente B — Modul-Layout-Engine.

Aufgabe: Modulanzahl + grobes Belegungsraster pro Dach (Report S. 20–22, 26).

MVP-Packing: rechteckige nutzbare Fläche, Module in Hoch- oder Querformat,
mit Randabständen und Modulzwischenräumen. Ergebnis: maximale Modulzahl je
Dach. Für krumme Polygone ist das eine konservative Abschätzung — das exakte
geometrische Packing ins Polygon ist Phase 3/4.
"""
from __future__ import annotations

import math

from .geometry import resolve_roof_area
from .models import LayoutResult, ModuleSpec, RoofPlane


def _modules_on_rectangle(
    area_m2: float,
    mod_l_m: float,
    mod_w_m: float,
    *,
    edge_margin_m: float,
    row_gap_m: float,
    col_gap_m: float,
    coverage: float,
) -> int:
    """Module auf einer (als ~quadratisch angenommenen) Fläche.

    Ohne explizites Polygon nähern wir die nutzbare Fläche als Quadrat an und
    rechnen mit einem Belegungsfaktor `coverage` (Dachfenster, Gauben, Kamine,
    Verschnitt). Liefert max. Modulzahl bei optimaler der beiden Orientierungen.
    """
    if area_m2 <= 0:
        return 0
    usable = area_m2 * coverage
    side = math.sqrt(usable)
    width = max(side - 2 * edge_margin_m, 0.0)
    height = max(side - 2 * edge_margin_m, 0.0)

    best = 0
    for l, w in ((mod_l_m, mod_w_m), (mod_w_m, mod_l_m)):  # Hoch-/Querformat
        cols = math.floor((width + col_gap_m) / (w + col_gap_m))
        rows = math.floor((height + row_gap_m) / (l + row_gap_m))
        best = max(best, max(cols, 0) * max(rows, 0))
    return best


def plan_layout(
    roofs: list[RoofPlane],
    module: ModuleSpec,
    *,
    edge_margin_m: float = 0.30,
    row_gap_m: float = 0.02,
    col_gap_m: float = 0.02,
    coverage: float = 0.80,
) -> LayoutResult:
    """Layout über alle Dächer planen."""
    mod_l = module.length_mm / 1000.0
    mod_w = module.width_mm / 1000.0
    per_roof: list[int] = []

    for roof in roofs:
        if roof.module_count is not None:
            per_roof.append(roof.module_count)
            continue
        area = resolve_roof_area(roof)
        count = _modules_on_rectangle(
            area, mod_l, mod_w,
            edge_margin_m=edge_margin_m,
            row_gap_m=row_gap_m,
            col_gap_m=col_gap_m,
            coverage=coverage,
        )
        per_roof.append(count)

    total = sum(per_roof)
    kwp = total * module.pmpp_wp / 1000.0
    return LayoutResult(
        total_modules=total,
        modules_per_roof=per_roof,
        kwp=round(kwp, 3),
        module_area_m2=round(total * module.area_m2, 1),
    )
