"""Optimierungs-Kern für die Mini-App.

Set-Cover-Formulierung als Binär-ILP (pulp + CBC), exakt.

Zielfunktion: minimiere (Anzahl unterschiedlicher Standards) +
(Anzahl unterschiedlicher Sonder-Maße). Standards und Sonder werden
gleich gewichtet, weil beide aus Kundensicht "ein zusätzliches Maß
auf der Liste" bedeuten.

Coverage (ein Auftrag a wird von Standard s abgedeckt):
- "einseitig":  S.lang >= a.lang  UND  S.kurz >= a.kurz
                UND  S.lang-a.lang <= tol  UND  S.kurz-a.kurz <= tol
                (Last muss physisch draufpassen)
- "zweiseitig": |S.lang-a.lang| <= tol  UND  |S.kurz-a.kurz| <= tol
                (egal welcher größer; Standard darf kleiner sein)

Kombinationen (kombi_max in {1, 2, 3}):
- kombi_max=1: nur Einzel-Standards decken
- kombi_max=2: zusätzlich 2-fach längs/quer (zwei kleinere
                Standards aneinandergestellt füllen das Auftragsmaß)
- kombi_max=3: zusätzlich 3-fach

Sonder-Deckel:
- None: kein Limit (jeder Auftrag, der nicht standardisierbar
        ist, wird Sonder)
- int K: höchstens K verschiedene Sonder-Maße erlaubt; gibt es
         mehr Maße ohne Standard-Deckung, wird die LP infeasible
         (Status != Optimal).
"""
from __future__ import annotations

from typing import Iterable

import pulp


def _kanon(L: float, B: float) -> tuple[float, float]:
    """Lange Seite zuerst, kurze danach."""
    return (max(L, B), min(L, B))


def _deckt(std: tuple[float, float], auf: tuple[float, float],
           tol: float, coverage: str) -> bool:
    Ls, Ws = std
    La, Wa = auf
    if coverage == "einseitig":
        return (Ls >= La and Ws >= Wa
                and (Ls - La) <= tol and (Ws - Wa) <= tol)
    if coverage == "zweiseitig":
        return abs(Ls - La) <= tol and abs(Ws - Wa) <= tol
    raise ValueError(f"Unbekannter coverage-Modus: {coverage!r}")


def _kombi_optionen(
    auftrag: tuple[float, float],
    kandidaten: list[tuple[float, float]],
    tol: float,
    kombi_max: int,
) -> list[tuple[tuple[int, ...], str]]:
    """Liste aller Kombi-Möglichkeiten (combo_idx-tuple, richtung)
    die ``auftrag`` durch Aneinanderstellen kleinerer Kandidaten
    abdecken. Stark vorgefiltert für ILP-Komplexität."""
    if kombi_max < 2:
        return []
    La, Wa = auftrag
    optionen: list[tuple[tuple[int, ...], str]] = []

    # Vorfilter: für jede Richtung (längs/quer) nur passende Standards.
    # Längs: jeder Standard muss kürzer als La sein (sonst kein Stapeln),
    # aber Wa <= W_s <= Wa + tol (Breite muss passen).
    # Nach Länge sortieren, damit break-Schranken im 3-Kombi-Loop greifen.
    laengs_idx = sorted(
        [k for k, (Ls, Ws) in enumerate(kandidaten)
         if Ls < La and Wa <= Ws <= Wa + tol],
        key=lambda k: kandidaten[k][0],
    )
    quer_idx = sorted(
        [k for k, (Ls, Ws) in enumerate(kandidaten)
         if Ws < Wa and La <= Ls <= La + tol],
        key=lambda k: kandidaten[k][1],
    )

    def passt_laengs(combo: tuple[int, ...]) -> bool:
        L_sum = sum(kandidaten[k][0] for k in combo)
        return La <= L_sum <= La + tol

    def passt_quer(combo: tuple[int, ...]) -> bool:
        W_sum = sum(kandidaten[k][1] for k in combo)
        return Wa <= W_sum <= Wa + tol

    # 2-Kombi
    L = len(laengs_idx)
    for ai in range(L):
        k1 = laengs_idx[ai]
        for bi in range(ai, L):
            k2 = laengs_idx[bi]
            if passt_laengs((k1, k2)):
                optionen.append(((k1, k2), "laengs"))
    Q = len(quer_idx)
    for ai in range(Q):
        k1 = quer_idx[ai]
        for bi in range(ai, Q):
            k2 = quer_idx[bi]
            if passt_quer((k1, k2)):
                optionen.append(((k1, k2), "quer"))
    # 3-Kombi
    if kombi_max >= 3:
        for ai in range(L):
            k1 = laengs_idx[ai]
            L1 = kandidaten[k1][0]
            if 3 * L1 > La + tol:  # alle 3 = k1 schon zu lang
                break
            for bi in range(ai, L):
                k2 = laengs_idx[bi]
                L2 = kandidaten[k2][0]
                if L1 + 2 * L2 > La + tol:
                    continue
                for ci in range(bi, L):
                    k3 = laengs_idx[ci]
                    L3 = kandidaten[k3][0]
                    s = L1 + L2 + L3
                    if s > La + tol:
                        break
                    if s >= La:
                        optionen.append(((k1, k2, k3), "laengs"))
        for ai in range(Q):
            k1 = quer_idx[ai]
            W1 = kandidaten[k1][1]
            if 3 * W1 > Wa + tol:
                break
            for bi in range(ai, Q):
                k2 = quer_idx[bi]
                W2 = kandidaten[k2][1]
                if W1 + 2 * W2 > Wa + tol:
                    continue
                for ci in range(bi, Q):
                    k3 = quer_idx[ci]
                    W3 = kandidaten[k3][1]
                    s = W1 + W2 + W3
                    if s > Wa + tol:
                        break
                    if s >= Wa:
                        optionen.append(((k1, k2, k3), "quer"))
    return optionen


def optimiere(
    paletten: Iterable[dict],
    tol_mm: float = 100,
    kombi_max: int = 2,
    coverage: str = "zweiseitig",
    sonder_deckel: int | None = None,
    zeit_limit_s: int = 30,
) -> dict:
    """Set-Cover-ILP über die Aufträge.

    Erwartete dict-Schlüssel pro Palette: 'auftrag', 'name',
    'artikelnummer', 'laenge', 'breite', 'anzahl' (optional 'hoehe').

    Returns:
        {
            'standards':   list[(L, B)],          # gewählte Standardmaße
            'sonder':      list[(L, B)],          # gewählte Sonder-Maße
            'gesamt':      int,                    # = len(standards) + len(sonder)
            'zuordnung':   list[dict],            # pro Auftrag: ziel + typ
            'status':      str,                    # 'Optimal' / 'Infeasible' / ...
            'kandidaten':  int,                    # Anzahl Kandidaten-Maße
        }
    """
    paletten = list(paletten)
    if not paletten:
        return {"standards": [], "sonder": [], "gesamt": 0,
                "zuordnung": [], "status": "leer", "kandidaten": 0}

    # Kanonisierte Auftragsmaße
    auftrags_canon = [_kanon(float(p["laenge"]), float(p["breite"])) for p in paletten]

    # === KANDIDATEN: volles Gitter ====================================
    # Identisch zum verifizierten Referenz-Kern: alle Paare
    # (kurze, lange) aus den vorkommenden kurzen × langen Seiten —
    # NICHT auf die 158 tatsächlich vorkommenden Maße reduzieren.
    # Das volle Gitter erlaubt z.B. einen Standard (850×1300), auch
    # wenn keine einzelne Eingabezeile genau dieses Maß hat — der
    # Solver kann damit mehr Cluster bilden, was die echte Minimum-
    # Lösung erst erreichbar macht.
    S_vals = sorted({min(a, b) for a, b in auftrags_canon})
    L_vals = sorted({max(a, b) for a, b in auftrags_canon})
    kandidaten = [(cl, cs) for cs in S_vals for cl in L_vals if cs <= cl]
    kandidaten.sort()
    K = len(kandidaten)
    n = len(paletten)

    # Coverage-Matrix: für jeden Auftrag i, Liste der Kandidaten-Indizes
    # die i einzeln abdecken
    deckt_einzel = [
        [k for k in range(K) if _deckt(kandidaten[k], auftrags_canon[i], tol_mm, coverage)]
        for i in range(n)
    ]

    # Kombi-Optionen pro Auftrag (bei kombi_max >= 2)
    kombi_pro_auftrag = [
        _kombi_optionen(auftrags_canon[i], kandidaten, tol_mm, kombi_max)
        for i in range(n)
    ]

    # Sonder-Maß-Index pro Auftrag (O(1)-Lookup statt list.index)
    kand_pos = {m: idx for idx, m in enumerate(kandidaten)}
    sonder_idx = [kand_pos[auftrags_canon[i]] for i in range(n)]

    prob = pulp.LpProblem("min_standards_sonder", pulp.LpMinimize)

    # Binär-Variablen
    x = [pulp.LpVariable(f"x_{k}", cat="Binary") for k in range(K)]   # Standard k gewählt?
    y = [pulp.LpVariable(f"y_{k}", cat="Binary") for k in range(K)]   # Sonder-Maß k benutzt?

    # Kombi-Variablen pro (auftrag, kombi-option)
    c: dict[tuple[int, int], pulp.LpVariable] = {}
    for i, optionen in enumerate(kombi_pro_auftrag):
        for j, _ in enumerate(optionen):
            c[(i, j)] = pulp.LpVariable(f"c_{i}_{j}", cat="Binary")

    # Coverage-Constraint: jeder Auftrag muss abgedeckt sein
    for i in range(n):
        teile = [x[k] for k in deckt_einzel[i]]
        teile += [c[(i, j)] for j in range(len(kombi_pro_auftrag[i]))]
        teile.append(y[sonder_idx[i]])
        prob += pulp.lpSum(teile) >= 1, f"cov_{i}"

    # Kombi-Constraint: c[(i, j)] = 1 ⇒ alle beteiligten x[k] = 1
    for i, optionen in enumerate(kombi_pro_auftrag):
        for j, (combo, _) in enumerate(optionen):
            for k in set(combo):
                prob += c[(i, j)] <= x[k], f"kombi_{i}_{j}_{k}"

    # Sonder-Deckel
    if sonder_deckel is not None and sonder_deckel >= 0:
        prob += pulp.lpSum(y) <= sonder_deckel, "sonder_max"

    # Zielfunktion
    prob += pulp.lpSum(x) + pulp.lpSum(y)

    solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=zeit_limit_s)
    prob.solve(solver)
    status = pulp.LpStatus[prob.status]

    # Wenn der Solver KEINE Lösung gefunden hat: leeres Ergebnis.
    # Eine Suboptimal-Lösung (Time-Limit überschritten) hat aber meist
    # gesetzte Variablen-Werte — die nutzen wir trotzdem, mit Warnung.
    hat_werte = (
        x and x[0].value() is not None
    )
    if not hat_werte:
        return {"standards": [], "sonder": [], "gesamt": 0,
                "zuordnung": [], "status": status, "kandidaten": K}

    standards = [kandidaten[k] for k in range(K) if x[k].value() and x[k].value() > 0.5]
    sonder = [kandidaten[k] for k in range(K) if y[k].value() and y[k].value() > 0.5]

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
        # Standard? (kleinster passender wins; deterministisch)
        gewaehlt_std = sorted(
            [k for k in deckt_einzel[i]
             if x[k].value() and x[k].value() > 0.5],
            key=lambda k: kandidaten[k],
        )
        if gewaehlt_std:
            eintrag["typ"] = "standard"
            eintrag["ziel"] = kandidaten[gewaehlt_std[0]]
        else:
            # Kombi?
            kombi_treffer = [
                (j, opt) for j, opt in enumerate(kombi_pro_auftrag[i])
                if c.get((i, j)) and c[(i, j)].value() and c[(i, j)].value() > 0.5
            ]
            if kombi_treffer:
                j, (combo, richtung) = kombi_treffer[0]
                eintrag["typ"] = f"kombi-{len(combo)}-{richtung}"
                eintrag["ziel"] = [kandidaten[k] for k in combo]
            else:
                # Sonder
                if y[sonder_idx[i]].value() and y[sonder_idx[i]].value() > 0.5:
                    eintrag["typ"] = "sonder"
                    eintrag["ziel"] = auftrags_canon[i]
                else:
                    eintrag["typ"] = "ungelöst"
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
