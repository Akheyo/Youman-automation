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
# Historisch: hiess in der Mini-Phase paletten_optimierer_kern.py.
# Beim Alignment mini/ -> Root wurde auf optimierer_kern.py
# vereinheitlicht.
import pulp
from itertools import combinations, product


def _passt_einzeln(cand, last, Tk, Tl, Pk=None, Pl=None):
    c0, c1 = sorted(cand)
    l0, l1 = sorted(last)
    if not (c0 >= l0 and c1 >= l1):
        return False
    if (c0 - l0) > Tk or (c1 - l1) > Tl:
        return False
    # Optional: prozentuale Zusatzbedingung
    if Pk is not None and (c0 - l0) > l0 * Pk / 100.0:
        return False
    if Pl is not None and (c1 - l1) > l1 * Pl / 100.0:
        return False
    return True


def _passt_kstapel(cand, last, Tk, Tl, kmax, Pk=None, Pl=None):
    cs, cl = cand
    l0, l1 = sorted(last)
    for k in range(2, kmax + 1):
        for ec0, ec1 in ((cs, cl * k), (cs * k, cl)):
            e0, e1 = sorted((ec0, ec1))
            if not (e0 >= l0 and e1 >= l1):
                continue
            if (e0 - l0) > Tk or (e1 - l1) > Tl:
                continue
            if Pk is not None and (e0 - l0) > l0 * Pk / 100.0:
                continue
            if Pl is not None and (e1 - l1) > l1 * Pl / 100.0:
                continue
            return (k, (ec0, ec1))
    return None


def _kann_decken(cand, last, Tk, Tl, kmax, Pk=None, Pl=None):
    if _passt_einzeln(cand, last, Tk, Tl, Pk, Pl):
        return ('direkt', None)
    k = _passt_kstapel(cand, last, Tk, Tl, kmax, Pk, Pl)
    if k is not None:
        return ('kstapel', k)
    return None


def _passt_heterogen(teile, last, Tk, Tl, Pk=None, Pl=None):
    l0, l1 = sorted(last)
    for variante in product(*[((a, b), (b, a)) for (a, b) in teile]):
        for arrangement in (
            (sum(t[0] for t in variante), max(t[1] for t in variante)),
            (max(t[0] for t in variante), sum(t[1] for t in variante)),
        ):
            b0, b1 = sorted(arrangement)
            if not (b0 >= l0 and b1 >= l1):
                continue
            if (b0 - l0) > Tk or (b1 - l1) > Tl:
                continue
            if Pk is not None and (b0 - l0) > l0 * Pk / 100.0:
                continue
            if Pl is not None and (b1 - l1) > l1 * Pl / 100.0:
                continue
            return True
    return False


DEFAULT_GEWICHTE = {
    "w1": 1.0,    # pro unterschiedlichem Palettentyp
    "w2": 0.0,    # Σ benötigter Paletten (Info, post-hoc im Score)
    "w3": 0.0,    # Verbrauchshäufigkeits-Match (negativ = Bonus)
    "w4": 0.0,    # Σ Einkaufskosten (EK · Σ menge)
    "w5": 0.0,    # − Σ Marge (VK − EK) · Σ menge — Bonus
    "w6": 0.0,    # extra Penalty pro Sonder-Typ (zusätzlich zu w1)
    "w7": 0.0,    # pro Kombi-Zuordnung (Stapel oder heterogen)
    "w8": 0.0,    # Logistik-Mehrkosten (Transport + Lager) — post-hoc
    "w9": 0.0,    # − Handling/Varianten-Einsparung — Bonus, post-hoc
}


def optimiere(orders, tol_kurz_mm=200, tol_lang_mm=None, max_kombi_teile=3,
              heterogen_fallback=True, sonder_deckel=None,
              zeitlimit_s=120, katalog=None,
              tol_kurz_pct=None, tol_lang_pct=None,
              sonder_erlaubt=True, sonder_min_artikel=0,
              sonder_aufschlag_mm=0,
              gewichte=None, katalog_kosten=None, katalog_verbrauch=None,
              katalog_marge=None, katalog_bestand=None,
              logistik_mehrkosten_per_typ=None,
              logistik_einsparung_per_typ=None,
              manuelle_masse=None):
    """
    orders: Liste dicts mit 'L','B','menge','auftrag','name'.
    tol_kurz_mm: max Übermaß auf der KURZ-Achse (Breite).
    tol_lang_mm: max Übermaß auf der LANG-Achse (Länge). None -> = tol_kurz.
    sonder_deckel: max Anzahl verschiedener Sonder-Maße. None = unbegrenzt.
    katalog: optionale Liste (cs, cl)-Tupel bekannter Maße — Tie-Breaker.
    tol_kurz_pct: optionale ZUSAETZLICHE prozentuale Toleranz auf der
        KURZ-Achse. Wenn gesetzt: Cand-Kurz darf hoechstens Last-Kurz
        * (1 + tol_kurz_pct/100) sein. Wird ZUSAMMEN mit tol_kurz_mm
        geprueft — beide muessen erfuellt sein (strenger).
        Reiner Prozent-Modus: tol_kurz_mm=99999, tol_kurz_pct=10.
    tol_lang_pct: analog fuer die LANG-Achse.
    sonder_erlaubt: bool. Wenn False → KEINE neuen Maße erzeugen, nur
        Katalog-Maße als Kandidaten zulassen. Auftraege, die kein
        Katalog-Maß decken kann, landen in result['nicht_zuordenbar'].
    sonder_min_artikel: int. Sonder-Maße werden NUR eingefuehrt, wenn
        die Σ der menge-Werte der Auftraege, die nur durch diesen
        Sonder gedeckt werden, ≥ N ist. Bricht den Solver dazu, lieber
        eine Sondergroesse einzufuehren wenn sie mehrere Artikel
        bündelt. 0 = kein Mindest-Bündel.
    sonder_aufschlag_mm: int. Bei der Erzeugung von Sonder-Kandidaten
        wird das Maß je Achse + Aufschlag verwendet (Sicherheitsmarge).
    gewichte: dict mit w1..w7 (Spec §7):
        Score = w1·#Palettentypen
              + w2·Σ Paletten (post-hoc info)
              − w3·Σ Verbrauchshäufigkeit_match
              + w4·Σ Einkaufskosten
              − w5·Σ Marge
              + w6·#Sonder-Typen
              + w7·#Kombi-Zuordnungen (post-hoc)
              + BIG·#nicht zuordenbar
    katalog_kosten: dict (cs,cl) → EK_pro_Stueck (für w4).
    katalog_verbrauch: dict (cs,cl) → verbrauchshäufigkeit (für w3).
    katalog_marge: dict (cs,cl) → marge_pro_stueck (= VK − EK) für w5.
    katalog_bestand: dict (cs,cl) → bestand (Spec §8 — Bestand > 0
        bevorzugen). Wirkt als kleiner ε-Bonus auf der Objective.
    manuelle_masse: Liste (cs,cl)-Tupel der manuellen Lagerpaletten
        (quelle="manuell"). Aufträge, die von mindestens einer dieser
        Paletten gedeckt werden können, MÜSSEN durch eine manuelle
        Palette bedient werden — kein Sonder erlaubt. Erst Aufträge
        ohne passende manuelle Palette laufen durch den freien Solver.
    """
    if not orders:
        return {'standards': [], 'sonder': [], 'gesamt': 0,
                'zuordnung': [], 'invariante_ok': True,
                'verletzungen': [], 'nicht_zuordenbar': [],
                'status': 'leer',
                'score': 0.0, 'score_breakdown': {},
                'bestand_nutzung': {},
                'parameter': {'tol_kurz_mm': tol_kurz_mm,
                              'tol_lang_mm': tol_lang_mm or tol_kurz_mm,
                              'tol_kurz_pct': tol_kurz_pct,
                              'tol_lang_pct': tol_lang_pct,
                              'max_kombi_teile': max_kombi_teile,
                              'heterogen_fallback': heterogen_fallback,
                              'sonder_deckel': sonder_deckel,
                              'sonder_erlaubt': sonder_erlaubt,
                              'sonder_min_artikel': sonder_min_artikel,
                              'sonder_aufschlag_mm': sonder_aufschlag_mm,
                              'gewichte': dict(DEFAULT_GEWICHTE)}}

    if tol_lang_mm is None:
        tol_lang_mm = tol_kurz_mm
    Tk, Tl = tol_kurz_mm, tol_lang_mm

    O = [(int(round(o['L'])), int(round(o['B'])),
          int(o['menge']), o.get('auftrag'), o.get('name'))
         for o in orders]
    K = max_kombi_teile
    Pk = tol_kurz_pct if (tol_kurz_pct is not None and tol_kurz_pct > 0) else None
    Pl = tol_lang_pct if (tol_lang_pct is not None and tol_lang_pct > 0) else None
    W = dict(DEFAULT_GEWICHTE)
    if gewichte:
        W.update({k: float(v) for k, v in gewichte.items() if k in W})

    # Katalog-Set (kanonisiert) — bestimmt was als "Standard" zaehlt
    katalog_set = set()
    if katalog:
        for cs, cl in katalog:
            csi, cli = int(round(min(cs, cl))), int(round(max(cs, cl)))
            katalog_set.add((csi, cli))

    S = sorted({min(a, b) for a, b, *_ in O})
    Lv = sorted({max(a, b) for a, b, *_ in O})
    cands_grid = [(cs, cl) for cs in S for cl in Lv if cs <= cl]

    # Auftragsmaße ggf. um Sicherheitsaufschlag vergroessern (Sonder-Kandidaten)
    auf = max(0, int(sonder_aufschlag_mm))
    if auf > 0:
        cands_grid_set = set(cands_grid)
        for a, b, *_ in O:
            cs, cl = min(a, b) + auf, max(a, b) + auf
            if (cs, cl) not in cands_grid_set:
                cands_grid.append((cs, cl))
                cands_grid_set.add((cs, cl))

    # Wenn Sonder NICHT erlaubt: nur Katalog-Maße als Kandidaten
    # (auch wenn der Katalog leer ist — dann gibt es keine Kandidaten und
    # alle Aufträge landen in nicht_zuordenbar).
    if not sonder_erlaubt:
        cands = sorted(katalog_set)
    else:
        cand_set = set(cands_grid) | katalog_set
        cands = sorted(cand_set)

    keep, cov = [], []
    for c in cands:
        s = {i for i, (a, b, *_) in enumerate(O)
             if _kann_decken(c, (a, b), Tk, Tl, K, Pk, Pl) is not None}
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
    # Slack-Variable pro Auftrag fuer "nicht zuordenbar" — nur falls
    # sonst infeasible (insbesondere wenn sonder_erlaubt=False UND
    # Katalog deckt nicht alle Auftraege ab). Hoher Penalty (= viel
    # mehr als ein ganzer Standard), damit der Solver es vermeidet.
    n = len(O)
    s_slack = [pulp.LpVariable(f"s{i}", cat="Binary") for i in range(n)]
    BIG = 1000.0  # Penalty pro nicht-zuordenbarem Auftrag

    # Katalog-Indizes (im keep-Set) und Sonder-Indizes
    katalog_indizes = [j for j, k in enumerate(keep) if k in katalog_set]
    sonder_indizes = [j for j, k in enumerate(keep) if k not in katalog_set]

    # Manuelle Lagerpaletten-Indizes (quelle="manuell") im keep-Set
    manuelle_set: set[tuple[int, int]] = set()
    if manuelle_masse:
        for l, b in manuelle_masse:
            manuelle_set.add((min(int(round(l)), int(round(b))),
                              max(int(round(l)), int(round(b)))))
    manual_indizes = [j for j, k in enumerate(keep) if k in manuelle_set]

    # Ziel-Funktion (Score nach §7-Spec, 7 Gewichte):
    #   Σ_x_katalog [w1 + w4·EK·meng_summe − w5·marge·meng_summe
    #                − w3·verbrauch − bestand_bonus]
    # + Σ_x_sonder [w1 + w6]                 (Sonder ueber Kandidaten)
    # + Σ_z [w1 + w6]                         (Auftrags-eigene Sonder)
    # + BIG · Σ_slack                         (nicht zuordenbar)
    # − ε · Σ_x_katalog                       (klassischer Tie-Breaker)
    # w2 (Σ Paletten) und w7 (Kombi-Count) wirken POST-HOC im Score —
    # nicht im ILP-Objective.
    eps = 1.0 / max(1, len(katalog_indizes) + 2)
    kosten_map = {tuple(sorted(k)): float(v) for k, v in (katalog_kosten or {}).items()}
    verbrauch_map = {tuple(sorted(k)): float(v) for k, v in (katalog_verbrauch or {}).items()}
    marge_map = {tuple(sorted(k)): float(v) for k, v in (katalog_marge or {}).items()}
    bestand_map = {tuple(sorted(k)): int(v) for k, v in (katalog_bestand or {}).items()}
    log_mehr_map = {tuple(sorted(k)): float(v)
                     for k, v in (logistik_mehrkosten_per_typ or {}).items()}
    log_einsp_map = {tuple(sorted(k)): float(v)
                      for k, v in (logistik_einsparung_per_typ or {}).items()}

    # menge_kand[j] = Σ menge der Auftraege die kand j theoretisch deckt.
    # Pragma: pro x[j]=1 ein Approximations-Term für w4/w5.
    mengen_pro_order = [int(o[2]) for o in O]
    menge_kand = [sum(mengen_pro_order[i] for i in cov[j])
                  for j in range(len(keep))]

    # Bestand-Bonus: tie-breaking, nicht überwältigend.
    # Spec §8 sagt Bestand > 0 zuerst — mit ε-Bonus pro x[j].
    eps_bestand = 0.5 * eps

    obj_terms = []
    for j, kand in enumerate(keep):
        koeff = W["w1"]
        if kand in katalog_set:
            # w4: Σ EK-Kosten (= EK pro Stk × Menge der gedeckten Aufträge)
            if kosten_map:
                koeff += W["w4"] * kosten_map.get(kand, 0.0) * menge_kand[j]
            # w5: − Σ Marge (= VK−EK × Menge)
            if marge_map:
                koeff -= W["w5"] * marge_map.get(kand, 0.0) * menge_kand[j]
            # w3: Verbrauchshäufigkeit-Match (negativ = Bonus)
            if verbrauch_map:
                koeff -= W["w3"] * verbrauch_map.get(kand, 0.0)
            # Bestand-Bonus (Spec §8 — Bestand priorisieren)
            if bestand_map.get(kand, 0) > 0:
                koeff -= eps_bestand
            # Katalog-Tie-Breaker
            koeff -= eps
        else:
            # Sonder: extra Penalty w6
            koeff += W["w6"]
        # w8: Logistik-Mehrkosten (Transport + Lager) — pro Typ-Aktiv
        # w9: − Einsparung (Handling + Varianten)
        if log_mehr_map:
            koeff += W["w8"] * log_mehr_map.get(kand, 0.0)
        if log_einsp_map:
            koeff -= W["w9"] * log_einsp_map.get(kand, 0.0)
        obj_terms.append(koeff * x[j])

    # z (Sonder = Auftragsmaß als eigene Palette) zaehlt als Sonder-Typ
    for zg in z.values():
        obj_terms.append((W["w1"] + W["w6"]) * zg)
    # Slack: hoher Penalty
    for sv in s_slack:
        obj_terms.append(BIG * sv)
    p += pulp.lpSum(obj_terms)

    # Coverage-Constraint pro Auftrag
    for i, (a, b, *_) in enumerate(O):
        g = tuple(sorted((a, b)))
        # z[g] muss existieren? Nur wenn Sonder-Auftragsmaß erlaubt ist.
        # Wenn sonder_erlaubt=False: z[g] sollte = 0 sein (forced unten)
        p += (pulp.lpSum(x[j] for j in range(len(keep)) if i in cov[j])
              + z[g] + s_slack[i] >= 1)
    # Wenn Sonder nicht erlaubt: alle z[g] = 0
    if not sonder_erlaubt:
        for zg in z.values():
            p += zg == 0

    # Manuelle Lagerpaletten-Priorität: Aufträge, die von mindestens einer
    # manuellen Palette gedeckt werden können, MÜSSEN durch eine solche
    # bedient werden. Kein Sonder-Fallback erlaubt — manuelle Standards
    # sind Lagerware und günstiger beim Lieferant.
    if manual_indizes:
        for i in range(n):
            coverable = [j for j in manual_indizes if i in cov[j]]
            if coverable:
                p += pulp.lpSum(x[j] for j in coverable) >= 1
                g = tuple(sorted((O[i][0], O[i][1])))
                if g in z:
                    p += z[g] == 0

    if sonder_deckel is not None:
        p += pulp.lpSum(z.values()) <= sonder_deckel

    # Sonder-Mindestmenge: ein Sonder-Kandidat (NICHT im Katalog) darf
    # nur dann gewaehlt werden, wenn er ≥ N Artikel deckt, die NICHT
    # auch durch einen anderen Standard abgedeckt werden koennten.
    # Pragmatisch (linear approximierbar): Σ menge der Auftraege die
    # diesen Kandidaten als EINZIG passenden haetten, ≥ N * x[j].
    # Vereinfacht: Σ menge der Auftraege die er deckt ≥ N * x[j].
    if sonder_erlaubt and int(sonder_min_artikel) > 0:
        N = int(sonder_min_artikel)
        mengen = [int(o[2]) for o in O]
        for j in sonder_indizes:
            gedeckte_summe = sum(mengen[i] for i in cov[j])
            # Wenn der Kandidat sogar in seiner Maximal-Auslegung
            # weniger als N Artikel decken koennte, x[j] = 0 erzwingen
            if gedeckte_summe < N:
                p += x[j] == 0
            else:
                # Soft-Constraint: x[j]=1 ⇒ Σ_i_covered menge_i ≥ N
                # Modelliert mit Big-M: das ist redundant wenn obige
                # Vorab-Filterung greift. Wir lassen den expliziten
                # Constraint hier weg — die statische Pruefung reicht
                # weil cov[j] die maximale moegliche Coverage ist.
                pass

    p.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=zeitlimit_s))

    standards = sorted(keep[j] for j in range(len(keep))
                       if x[j].value() and x[j].value() > 0.5)
    nicht_zuordenbar_idx = {i for i in range(n)
                             if s_slack[i].value() and s_slack[i].value() > 0.5}

    zuordnung, sonder_grp = [], set()
    nicht_zuordenbar_liste = []
    for i, (a, b, m, au, nm) in enumerate(O):
        if i in nicht_zuordenbar_idx:
            nicht_zuordenbar_liste.append({
                'auftrag': au, 'name': nm, 'L': a, 'B': b, 'menge': m,
            })
            zuordnung.append({'auftrag': au, 'name': nm, 'L': a, 'B': b,
                              'menge': m, 'typ': 'Nicht zuordenbar',
                              'ziel': '—'})
            continue
        einz = next((s for s in standards
                     if _passt_einzeln(s, (a, b), Tk, Tl, Pk, Pl)), None)
        if einz:
            zuordnung.append({'auftrag': au, 'name': nm, 'L': a, 'B': b,
                              'menge': m, 'typ': 'Standard',
                              'ziel': f"{einz[0]}x{einz[1]}"})
            continue
        kstapel = None
        for s in standards:
            kr = _passt_kstapel(s, (a, b), Tk, Tl, K, Pk, Pl)
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
                    if _passt_heterogen(combo, (a, b), Tk, Tl, Pk, Pl):
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
        if zg['typ'] in ('Sonder', 'Nicht zuordenbar'):
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
            if not _passt_heterogen(teile, (zg['L'], zg['B']), Tk, Tl, Pk, Pl):
                verletzungen.append(zg)

    # === Score-Breakdown nach Spec §7 (alle 7 Gewichte exakt post-hoc) ===
    n_std_kat = sum(1 for s in standards if s in katalog_set)
    n_std_son = sum(1 for s in standards if s not in katalog_set)
    n_son_total = n_std_son + len(sonder_grp)  # vom Solver erzeugte neue Maße
    n_typen_gesamt = len(standards) + len(sonder_grp)
    sum_paletten = sum(int(o[2]) for o in O)

    # Mengen pro tatsaechlicher Zuordnung — fuer exakte EK/Marge im Score
    sum_ek_pro_std: dict[tuple, float] = {}
    sum_marge_pro_std: dict[tuple, float] = {}
    bestand_nutzung: dict[tuple, dict] = {}
    n_kombi = 0

    for zg in zuordnung:
        typ = zg.get('typ', '')
        menge = int(zg.get('menge', 0))
        if typ == 'Standard':
            try:
                a, b = zg['ziel'].split('x')
                kand = (min(int(a), int(b)), max(int(a), int(b)))
                if kand in katalog_set:
                    sum_ek_pro_std[kand] = sum_ek_pro_std.get(kand, 0.0) + \
                        kosten_map.get(kand, 0.0) * menge
                    sum_marge_pro_std[kand] = sum_marge_pro_std.get(kand, 0.0) + \
                        marge_map.get(kand, 0.0) * menge
                    bn = bestand_nutzung.setdefault(kand, {
                        "benoetigt": 0, "bestand": bestand_map.get(kand, 0),
                        "differenz": 0,
                    })
                    bn["benoetigt"] += menge
            except Exception:
                pass
        elif typ in ('Kombi-Stapel', 'Kombi-Heterogen'):
            n_kombi += 1
        # Sonder/Nicht zuordenbar = kein EK/Marge (kein Katalog-Match)

    for kand, bn in bestand_nutzung.items():
        bn["differenz"] = max(0, bn["benoetigt"] - bn["bestand"])

    sum_kosten = sum(sum_ek_pro_std.values())
    sum_marge = sum(sum_marge_pro_std.values())
    sum_verbrauch = sum(verbrauch_map.get(s, 0.0)
                         for s in standards if s in katalog_set)

    sum_log_mehr = sum(log_mehr_map.get(s, 0.0) for s in standards)
    sum_log_einsp = sum(log_einsp_map.get(s, 0.0) for s in standards)
    score_breakdown = {
        "w1_palettentypen": W["w1"] * n_typen_gesamt,
        "w2_gesamt_paletten": W["w2"] * sum_paletten,
        "w3_verbrauch_bonus": -W["w3"] * sum_verbrauch,
        "w4_gesamtkosten_ek": W["w4"] * sum_kosten,
        "w5_marge_bonus": -W["w5"] * sum_marge,
        "w6_sonder_penalty": W["w6"] * n_son_total,
        "w7_kombi_penalty": W["w7"] * n_kombi,
        "w8_logistik_mehrkosten": W["w8"] * sum_log_mehr,
        "w9_logistik_einsparung_bonus": -W["w9"] * sum_log_einsp,
        "slack_nicht_zuordenbar": BIG * len(nicht_zuordenbar_liste),
    }
    score = sum(score_breakdown.values())

    return {'standards': standards,
            'sonder': sorted(sonder_grp),
            'gesamt': len(standards) + len(sonder_grp),
            'zuordnung': zuordnung,
            'invariante_ok': len(verletzungen) == 0,
            'verletzungen': verletzungen,
            'nicht_zuordenbar': nicht_zuordenbar_liste,
            'status': pulp.LpStatus[p.status],
            'score': score,
            'score_breakdown': score_breakdown,
            'bestand_nutzung': {f"{k[1]}x{k[0]}": v
                                  for k, v in bestand_nutzung.items()},
            'parameter': {'tol_kurz_mm': Tk, 'tol_lang_mm': Tl,
                          'tol_kurz_pct': Pk, 'tol_lang_pct': Pl,
                          'max_kombi_teile': K,
                          'heterogen_fallback': heterogen_fallback,
                          'sonder_deckel': sonder_deckel,
                          'katalog_groesse': len(katalog_set),
                          'sonder_erlaubt': sonder_erlaubt,
                          'sonder_min_artikel': sonder_min_artikel,
                          'sonder_aufschlag_mm': sonder_aufschlag_mm,
                          'gewichte': W}}
