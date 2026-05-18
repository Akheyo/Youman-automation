"""Optimierungs-Kern für die Mini-App.

Set-Cover-Formulierung als Binär-ILP (pulp + CBC), exakt.

Aufgebaut nach User-Spec ('paletten_optimierer_kern.py'):

1) Kandidaten = volles Gitter aus den vorkommenden kurzen × langen
   Seiten der Aufträge: ``cands = [(cs, cl) for cs in S_vals
   for cl in L_vals if cs <= cl]``. KEINE Reduktion auf unique
   vorkommende Maße.

2) Coverage inkl. Stapelung in EINER Funktion (KEINE Kombi-
   Variablen im ILP). Für einen Standard ``(cs, cl)`` und einen
   Auftrag ``(os_, ol)`` (jeweils kurz, lang) gilt Coverage wenn:
   - direkt: abs(cs-os_) <= T und abs(cl-ol) <= T  (zweiseitig)
             oder cs>=os_, cl>=ol mit Differenz <= T  (einseitig)
   - oder per k-fach Stapelung (k = 2..kombi_max), in Längs-
     oder Querrichtung — wie im Referenz-Kern:
       for k in range(2, kombi_max+1):
         for e0,e1 in ((cs,cl*k),(cs*k,cl),(cl,cs*k),(cl*k,cs)):
           es0,es1 = sorted([e0,e1])
           passt? -> True

3) Zielfunktion:
   prob += lpSum(x) + lpSum(z.values())
   (Standards + verschiedene Sonder-Maße). Nichts anderes.

Damit gibt es keine c-Variablen für Kombinationen — die Stapelung
ist in die Coverage gefaltet. Das hält das ILP klein (~K x-Vars
und ~|unique-Auftragsmaße| z-Vars) und korrekt.
"""
from __future__ import annotations

from typing import Iterable

import pulp


def _kanon(L: float, B: float) -> tuple[float, float]:
    """Kanonische Reihenfolge: (kurz, lang)."""
    return (min(L, B), max(L, B))


def _deckt_inkl_stapelung(
    std: tuple[float, float],
    auf: tuple[float, float],
    tol: float,
    coverage: str,
    kombi_max: int,
) -> bool:
    """Standard deckt Auftrag — direkt ODER per k-fach-Stapelung.

    std und auf sind beide (kurz, lang). Stapelung k-fach exakt nach
    User-Spec: vier Permutationen (cs,cl*k),(cs*k,cl),(cl,cs*k),
    (cl*k,cs), sortiert, dann gegen (os_, ol) geprüft.
    """
    cs, cl = std
    os_, ol = auf
    T = tol

    def _passt(es0: float, es1: float) -> bool:
        if coverage == "zweiseitig":
            return abs(es0 - os_) <= T and abs(es1 - ol) <= T
        if coverage == "einseitig":
            return (es0 >= os_ and es1 >= ol
                    and (es0 - os_) <= T and (es1 - ol) <= T)
        raise ValueError(f"Unbekannter coverage-Modus: {coverage!r}")

    # direkte Coverage (k=1, kein Stapeln)
    if _passt(cs, cl):
        return True

    # Stapel-Coverage k-fach (User-Spec wortwörtlich)
    if kombi_max >= 2:
        for k in range(2, kombi_max + 1):
            for e0, e1 in ((cs, cl * k), (cs * k, cl), (cl, cs * k), (cl * k, cs)):
                es0, es1 = sorted([e0, e1])
                if _passt(es0, es1):
                    return True
    return False


def optimiere(
    paletten: Iterable[dict],
    tol_mm: float = 100,
    kombi_max: int = 3,
    coverage: str = "zweiseitig",
    sonder_deckel: int | None = None,
    zeit_limit_s: int = 60,
) -> dict:
    """Set-Cover-ILP.

    Returns:
        {
            'standards':  list[(kurz, lang)],
            'sonder':     list[(kurz, lang)],
            'gesamt':     int,                    # |Standards| + |Sonder|
            'zuordnung':  list[dict],            # pro Auftrag: ziel + typ
            'status':     str,                    # 'Optimal' / ...
            'kandidaten': int,                    # |volles Gitter|
        }
    """
    paletten = list(paletten)
    if not paletten:
        return {"standards": [], "sonder": [], "gesamt": 0,
                "zuordnung": [], "status": "leer", "kandidaten": 0}

    # Kanonisiere Aufträge auf (kurz, lang)
    auftrags_canon = [_kanon(float(p["laenge"]), float(p["breite"]))
                      for p in paletten]
    n = len(paletten)

    # === KANDIDATEN: volles Gitter ====================================
    S_vals = sorted({a for a, _ in auftrags_canon})
    L_vals = sorted({b for _, b in auftrags_canon})
    kandidaten = [(cs, cl) for cs in S_vals for cl in L_vals if cs <= cl]
    K = len(kandidaten)

    # Coverage-Matrix: ein Standard deckt einen Auftrag entweder direkt
    # oder per k-fach-Stapelung (siehe _deckt_inkl_stapelung).
    deckt_von = [
        [k for k in range(K)
         if _deckt_inkl_stapelung(kandidaten[k], auftrags_canon[i],
                                  tol_mm, coverage, kombi_max)]
        for i in range(n)
    ]

    # ILP-Variablen — exakt zwei Familien (User-Spec):
    # x[k] = 1  ⇔  Standard-Kandidat k wird verwendet
    # z[m] = 1  ⇔  unique Auftrags-Maß m wird zu einer Sonder-Palette
    prob = pulp.LpProblem("min_standards_sonder", pulp.LpMinimize)
    x = [pulp.LpVariable(f"x_{k}", cat="Binary") for k in range(K)]
    unique_auftrags_masse = sorted(set(auftrags_canon))
    z = {m: pulp.LpVariable(f"z_{i}", cat="Binary")
         for i, m in enumerate(unique_auftrags_masse)}

    # Coverage-Constraint: jeder Auftrag muss durch (Standard ODER
    # Sonder seines Maßes) abgedeckt sein.
    for i in range(n):
        teile = [x[k] for k in deckt_von[i]]
        teile.append(z[auftrags_canon[i]])
        prob += pulp.lpSum(teile) >= 1, f"cov_{i}"

    # Sonder-Deckel (optional)
    if sonder_deckel is not None and sonder_deckel >= 0:
        prob += pulp.lpSum(z.values()) <= sonder_deckel, "sonder_max"

    # Zielfunktion — EXAKT nach User-Spec
    prob += pulp.lpSum(x) + pulp.lpSum(z.values())

    solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=zeit_limit_s)
    prob.solve(solver)
    status = pulp.LpStatus[prob.status]

    # Bei Timeout/Unsolved: leeres Ergebnis (Variablen könnten None sein)
    if not x or x[0].value() is None:
        return {"standards": [], "sonder": [], "gesamt": 0,
                "zuordnung": [], "status": status, "kandidaten": K}

    standards = [kandidaten[k] for k in range(K)
                 if x[k].value() and x[k].value() > 0.5]
    sonder = [m for m, v in z.items() if v.value() and v.value() > 0.5]

    # Zuordnung pro Auftrag
    zuordnung: list[dict] = []
    for i, p in enumerate(paletten):
        eintrag = {
            "auftrag": p.get("auftrag", ""),
            "name": p.get("name", ""),
            "artikelnummer": p.get("artikelnummer", ""),
            "anzahl": int(p.get("anzahl", 0) or 0),
            "original": auftrags_canon[i],
            "ziel": None,
            "typ": None,
        }
        gewaehlt_std = sorted(
            [k for k in deckt_von[i]
             if x[k].value() and x[k].value() > 0.5],
            key=lambda k: kandidaten[k],
        )
        if gewaehlt_std:
            # kleinster passender Standard
            k_best = gewaehlt_std[0]
            std_mass = kandidaten[k_best]
            # Direkt oder Stapelung? Bei Stapelung Typ-Hinweis.
            cs, cl = std_mass
            os_, ol = auftrags_canon[i]
            T = tol_mm
            direkt = (
                (coverage == "zweiseitig" and abs(cs - os_) <= T and abs(cl - ol) <= T)
                or (coverage == "einseitig" and cs >= os_ and cl >= ol
                    and (cs - os_) <= T and (cl - ol) <= T)
            )
            if direkt:
                eintrag["typ"] = "standard"
                eintrag["ziel"] = std_mass
            else:
                # k-fach Stapelung
                eintrag["typ"] = "kombi"
                eintrag["ziel"] = std_mass
        else:
            sonder_mass = auftrags_canon[i]
            if z.get(sonder_mass) is not None and z[sonder_mass].value() and z[sonder_mass].value() > 0.5:
                eintrag["typ"] = "sonder"
                eintrag["ziel"] = sonder_mass
            else:
                eintrag["typ"] = "ungeloest"
                eintrag["ziel"] = None
        zuordnung.append(eintrag)

    return {
        "standards": sorted(standards),
        "sonder": sorted(sonder),
        "gesamt": len(standards) + len(sonder),
        "zuordnung": zuordnung,
        "status": status,
        "kandidaten": K,
    }
