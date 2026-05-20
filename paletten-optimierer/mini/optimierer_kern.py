"""
Paletten-Optimierungskern v4 — FINAL LOCK.

Was drin ist:
 - MODELL A (Kombinieren integriert): das ILP rechnet beim Auswählen der
   Standards schon mit k-Stapelung. Heterogene Kombination (Typ A + Typ B)
   bleibt als zusätzlicher Fallback.
 - Getrennte Toleranz: tol_kurz_mm für die SHORT-Achse (Breite),
   tol_lang_mm für die LONG-Achse (Länge). Erlaubt z.B. großzügige
   Toleranz auf der Länge bei enger Toleranz auf der Breite.
 - Sonder-Deckel als OBERGRENZE (≤ N). Optimierer nutzt Sonder NUR
   wenn sie das Gesamt verringern — sonst nicht.
 - Einseitig (Standard ≥ Last) — physikalisch zwingend.
 - Min Gesamt (Standards + verschiedene Sonder-Maße).
 - Physikalische Invariante hart geprüft.

Ergebnis-Typen pro Zuordnung:
 - 'Standard'         : einzelner Standard deckt die Last direkt
 - 'Kombi-Stapel'     : k Kopien eines Standards in einer Reihe
 - 'Kombi-Heterogen'  : 2-3 verschiedene Standards in einer Reihe
 - 'Sonder'           : eigenes Maß, nicht standardisierbar
"""
import pulp
from itertools import combinations, product


def _passt_einzeln(cand, last, Tk, Tl):
    c0, c1 = sorted(cand)
    l0, l1 = sorted(last)
    return c0 >= l0 and c1 >= l1 and (c0 - l0) <= Tk and (c1 - l1) <= Tl


def _passt_kstapel(cand, last, Tk, Tl, kmax):
    cs, cl = cand
    l0, l1 = sorted(last)
    for k in range(2, kmax + 1):
        for ec0, ec1 in ((cs, cl * k), (cs * k, cl)):
            e0, e1 = sorted((ec0, ec1))
            if e0 >= l0 and e1 >= l1 and (e0 - l0) <= Tk and (e1 - l1) <= Tl:
                return (k, (ec0, ec1))
    return None


def _kann_decken(cand, last, Tk, Tl, kmax):
    if _passt_einzeln(cand, last, Tk, Tl):
        return ('direkt', None)
    k = _passt_kstapel(cand, last, Tk, Tl, kmax)
    if k is not None:
        return ('kstapel', k)
    return None


def _passt_heterogen(teile, last, Tk, Tl):
    l0, l1 = sorted(last)
    for variante in product(*[((a, b), (b, a)) for (a, b) in teile]):
        for arrangement in (
            (sum(t[0] for t in variante), max(t[1] for t in variante)),
            (max(t[0] for t in variante), sum(t[1] for t in variante)),
        ):
            b0, b1 = sorted(arrangement)
            if b0 >= l0 and b1 >= l1 and (b0 - l0) <= Tk and (b1 - l1) <= Tl:
                return True
    return False


def optimiere(orders, tol_kurz_mm=200, tol_lang_mm=None, max_kombi_teile=3,
              heterogen_fallback=True, sonder_deckel=None,
              zeitlimit_s=120, katalog=None):
    """
    orders: Liste dicts mit 'L','B','menge','auftrag','name'.
    tol_kurz_mm: max Übermaß auf der KURZ-Achse (Breite).
    tol_lang_mm: max Übermaß auf der LANG-Achse (Länge). None -> = tol_kurz.
    sonder_deckel: max Anzahl verschiedener Sonder-Maße. None = unbegrenzt.
    katalog: optionale Liste (cs, cl)-Tupel bekannter Maße. Wirkt als
        TIE-BREAKER: bei mehreren Lösungen mit gleichem Gesamt-Optimum
        bevorzugt der Solver die mit den meisten Katalog-Hits. Der
        Bonus ist klein genug, dass er das Gesamt-Optimum NIE
        verändert (nur Auswahl unter optimalen Lösungen).
    """
    if not orders:
        return {'standards': [], 'sonder': [], 'gesamt': 0,
                'zuordnung': [], 'invariante_ok': True,
                'verletzungen': [], 'status': 'leer',
                'parameter': {'tol_kurz_mm': tol_kurz_mm,
                              'tol_lang_mm': tol_lang_mm or tol_kurz_mm,
                              'max_kombi_teile': max_kombi_teile,
                              'heterogen_fallback': heterogen_fallback,
                              'sonder_deckel': sonder_deckel}}

    if tol_lang_mm is None:
        tol_lang_mm = tol_kurz_mm
    Tk, Tl = tol_kurz_mm, tol_lang_mm

    O = [(int(round(o['L'])), int(round(o['B'])),
          int(o['menge']), o.get('auftrag'), o.get('name'))
         for o in orders]
    K = max_kombi_teile

    S = sorted({min(a, b) for a, b, *_ in O})
    Lv = sorted({max(a, b) for a, b, *_ in O})
    cands = [(cs, cl) for cs in S for cl in Lv if cs <= cl]

    # Katalog-Maße zusaetzlich als Kandidaten zulassen (auch wenn sie nicht
    # in den Auftragsmaßen vorkommen). So kann der Solver sie waehlen wenn
    # sie das Optimum erreichen oder per Tie-Breaker bevorzugt werden.
    if katalog:
        cand_set = set(cands)
        for cs, cl in katalog:
            csi, cli = int(round(min(cs, cl))), int(round(max(cs, cl)))
            if (csi, cli) not in cand_set:
                cands.append((csi, cli))
                cand_set.add((csi, cli))
        cands = sorted(cands)

    keep, cov = [], []
    for c in cands:
        s = {i for i, (a, b, *_) in enumerate(O)
             if _kann_decken(c, (a, b), Tk, Tl, K) is not None}
        if s:
            keep.append(c)
            cov.append(s)

    groups = {}
    for i, (a, b, *_) in enumerate(O):
        groups.setdefault(tuple(sorted((a, b))), []).append(i)

    p = pulp.LpProblem("min_gesamt", pulp.LpMinimize)
    x = [pulp.LpVariable(f"x{j}", cat="Binary") for j in range(len(keep))]
    z = {g: pulp.LpVariable(f"z{gi}", cat="Binary")
         for gi, g in enumerate(groups)}

    # Katalog-Tie-Breaker: kleiner Bonus pro Kandidat der im Katalog ist.
    # Bonus-Gewicht = 1/(K+1) wo K = max moegliche Anzahl Katalog-Hits.
    # Damit kann der Bonus NIE einen ganzen Standard/Sonder kompensieren —
    # er bricht nur Ties unter mathematisch gleichwertigen Loesungen.
    katalog_set = set()
    if katalog:
        for cs, cl in katalog:
            cs_i, cl_i = int(round(min(cs, cl))), int(round(max(cs, cl)))
            katalog_set.add((cs_i, cl_i))
    katalog_indizes = [j for j, k in enumerate(keep) if k in katalog_set]
    n_max = max(1, len(katalog_indizes) + 1)
    eps = 1.0 / (n_max + 1)

    obj = pulp.lpSum(x) + pulp.lpSum(z.values())
    if katalog_indizes:
        obj -= eps * pulp.lpSum(x[j] for j in katalog_indizes)
    p += obj

    for i, (a, b, *_) in enumerate(O):
        g = tuple(sorted((a, b)))
        p += (pulp.lpSum(x[j] for j in range(len(keep)) if i in cov[j])
              + z[g] >= 1)
    if sonder_deckel is not None:
        p += pulp.lpSum(z.values()) <= sonder_deckel
    p.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=zeitlimit_s))

    standards = sorted(keep[j] for j in range(len(keep))
                       if x[j].value() and x[j].value() > 0.5)

    zuordnung, sonder_grp = [], set()
    for i, (a, b, m, au, nm) in enumerate(O):
        einz = next((s for s in standards
                     if _passt_einzeln(s, (a, b), Tk, Tl)), None)
        if einz:
            zuordnung.append({'auftrag': au, 'name': nm, 'L': a, 'B': b,
                              'menge': m, 'typ': 'Standard',
                              'ziel': f"{einz[0]}x{einz[1]}"})
            continue
        kstapel = None
        for s in standards:
            kr = _passt_kstapel(s, (a, b), Tk, Tl, K)
            if kr is not None:
                kstapel = (s, kr[0])
                break
        if kstapel:
            s, k = kstapel
            zuordnung.append({'auftrag': au, 'name': nm, 'L': a, 'B': b,
                              'menge': m, 'typ': 'Kombi-Stapel',
                              'ziel': f"{k}x ({s[0]}x{s[1]})"})
            continue
        heterogen = None
        if heterogen_fallback and standards:
            for r in range(2, K + 1):
                for combo in combinations(standards, r):
                    if _passt_heterogen(combo, (a, b), Tk, Tl):
                        heterogen = combo
                        break
                if heterogen:
                    break
        if heterogen:
            zuordnung.append({'auftrag': au, 'name': nm, 'L': a, 'B': b,
                              'menge': m, 'typ': 'Kombi-Heterogen',
                              'ziel': " + ".join(f"{c[0]}x{c[1]}"
                                                 for c in heterogen)})
        else:
            sonder_grp.add(tuple(sorted((a, b))))
            zuordnung.append({'auftrag': au, 'name': nm, 'L': a, 'B': b,
                              'menge': m, 'typ': 'Sonder',
                              'ziel': f"{min(a,b)}x{max(a,b)}"})

    verletzungen = []
    for zg in zuordnung:
        if zg['typ'] == 'Sonder':
            continue
        l0, l1 = sorted((zg['L'], zg['B']))
        if zg['typ'] == 'Standard':
            cs, cl = map(int, zg['ziel'].split('x'))
            if not (min(cs, cl) >= l0 and max(cs, cl) >= l1):
                verletzungen.append(zg)
        elif zg['typ'] == 'Kombi-Stapel':
            head, rest = zg['ziel'].split('x ', 1)
            k = int(head)
            cs, cl = map(int, rest.strip('()').split('x'))
            ok = False
            for ec0, ec1 in ((cs, cl * k), (cs * k, cl)):
                e0, e1 = sorted((ec0, ec1))
                if e0 >= l0 and e1 >= l1:
                    ok = True
                    break
            if not ok:
                verletzungen.append(zg)
        else:
            teile = [tuple(map(int, t.split('x')))
                     for t in zg['ziel'].split(" + ")]
            if not _passt_heterogen(teile, (zg['L'], zg['B']), Tk, Tl):
                verletzungen.append(zg)

    return {'standards': standards,
            'sonder': sorted(sonder_grp),
            'gesamt': len(standards) + len(sonder_grp),
            'zuordnung': zuordnung,
            'invariante_ok': len(verletzungen) == 0,
            'verletzungen': verletzungen,
            'status': pulp.LpStatus[p.status],
            'parameter': {'tol_kurz_mm': Tk, 'tol_lang_mm': Tl,
                          'max_kombi_teile': K,
                          'heterogen_fallback': heterogen_fallback,
                          'sonder_deckel': sonder_deckel,
                          'katalog_groesse': len(katalog_set)}}
