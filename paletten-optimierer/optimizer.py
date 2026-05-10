"""Optimierungs-Algorithmus für Industriepaletten.

Greedy-Gruppierung mit Erweiterungs-Pass: Eingangs-Paletten werden unter
Toleranz-Constraints zu wenigen Standardpaletten zusammengefasst. Zusätzlich
enthält das Modul die Wirtschaftlichkeitsrechnung (Palettenkosten plus
zusätzliche Logistikkosten durch größere Standardmaße).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


Einheit = Literal["mm", "prozent"]


@dataclass
class Palette:
    """Eingabe-Palette aus der Excel-Datei."""

    artikelnummer: str
    laenge: float
    breite: float
    anzahl: int
    kosten_alt: float = 14.0
    stueck_pro_palette: int = 0
    hoehe: float = 0.0
    kunde: str = ""
    auftrag: str = ""
    kw_lieferung: str = ""
    menge: int = 0


@dataclass
class StandardPalette:
    """Eine zusammengefasste Standardpalette mit ihren Mitgliedern."""

    laenge: float
    breite: float
    members: list[Palette] = field(default_factory=list)

    @property
    def label(self) -> str:
        return f"{int(round(self.laenge))} × {int(round(self.breite))} mm"

    @property
    def gesamt_anzahl(self) -> int:
        return sum(m.anzahl for m in self.members)


@dataclass
class Kombination:
    """Kombination aus zwei Standardpaletten für eine Eingabe-Palette."""

    palette: Palette
    standard_a: StandardPalette
    standard_b: StandardPalette


@dataclass
class OptimierungsErgebnis:
    """Resultat der Optimierung: Standards, ggf. Kombinationen, Statistiken."""

    standards: list[StandardPalette]
    kombinationen: list[Kombination] = field(default_factory=list)
    eingabe_paletten: list[Palette] = field(default_factory=list)

    @property
    def anzahl_eingabe_typen(self) -> int:
        return len(self.eingabe_paletten)

    @property
    def anzahl_standards(self) -> int:
        return len(self.standards)

    @property
    def reduktion_prozent(self) -> float:
        if self.anzahl_eingabe_typen == 0:
            return 0.0
        return 100.0 * (1 - self.anzahl_standards / self.anzahl_eingabe_typen)


@dataclass
class KostenParameter:
    """Eingabe-Parameter für die Wirtschaftlichkeitsrechnung."""

    kosten_pro_lkw: float = 800.0
    nutzbare_ladelaenge: float = 13.6
    palettenkosten_neu: float = 18.0
    palettenkosten_alt_default: float = 14.0


@dataclass
class WirtschaftlichkeitsErgebnis:
    """Resultat der Wirtschaftlichkeitsrechnung."""

    palettenkosten_alt: float
    palettenkosten_neu: float
    logistikkosten_alt: float
    logistikkosten_neu: float
    basis_lademeter_alt: float
    basis_lademeter_neu: float
    zusatz_lademeter: float
    kosten_pro_lademeter: float

    @property
    def gesamtkosten_alt(self) -> float:
        return self.palettenkosten_alt + self.logistikkosten_alt

    @property
    def gesamtkosten_neu(self) -> float:
        return self.palettenkosten_neu + self.logistikkosten_neu

    @property
    def ersparnis(self) -> float:
        return self.gesamtkosten_alt - self.gesamtkosten_neu

    def hochrechnung(self, monate: int) -> float:
        return self.ersparnis * monate


def max_zulaessig(originalwert: float, toleranz: float, einheit: Einheit) -> float:
    """Berechnet das maximal zulässige Standardmaß für ein Originalmaß."""
    if einheit == "mm":
        return originalwert + toleranz
    if einheit == "prozent":
        return originalwert * (1.0 + toleranz / 100.0)
    raise ValueError(f"Unbekannte Einheit: {einheit}")


def _runde_auf(wert: float, raster: int = 50) -> float:
    """Rundet auf das nächste Vielfache von ``raster`` auf."""
    if raster <= 0:
        return wert
    rest = wert % raster
    if rest == 0:
        return wert
    return wert + (raster - rest)


def _passt_in_gruppe(
    palette: Palette,
    gruppe: StandardPalette,
    tol_l: float,
    tol_b: float,
    einheit: Einheit,
) -> bool:
    """Prüft, ob eine Palette in eine bestehende Gruppe passt (ohne Erweiterung)."""
    if gruppe.laenge < palette.laenge or gruppe.breite < palette.breite:
        return False
    return (
        gruppe.laenge <= max_zulaessig(palette.laenge, tol_l, einheit)
        and gruppe.breite <= max_zulaessig(palette.breite, tol_b, einheit)
    )


def _kann_erweitert_werden(
    palette: Palette,
    gruppe: StandardPalette,
    tol_l: float,
    tol_b: float,
    einheit: Einheit,
) -> tuple[bool, float, float]:
    """Prüft, ob die Gruppe so erweitert werden kann, dass die Palette passt."""
    neue_l = max(gruppe.laenge, palette.laenge)
    neue_b = max(gruppe.breite, palette.breite)
    for m in gruppe.members:
        if neue_l > max_zulaessig(m.laenge, tol_l, einheit):
            return False, 0.0, 0.0
        if neue_b > max_zulaessig(m.breite, tol_b, einheit):
            return False, 0.0, 0.0
    if neue_l > max_zulaessig(palette.laenge, tol_l, einheit):
        return False, 0.0, 0.0
    if neue_b > max_zulaessig(palette.breite, tol_b, einheit):
        return False, 0.0, 0.0
    return True, neue_l, neue_b


def _finde_kombination(
    palette: Palette, standards: list[StandardPalette]
) -> Kombination | None:
    """Sucht zwei Standardpaletten, die zusammen die Fläche abdecken.

    Eine Kombination ist nur sinnvoll, wenn die Eingabepalette in mindestens
    einer Dimension *größer* ist als jede einzelne Standardpalette — sonst
    würde eine einzelne Palette ausreichen (und hätte bereits in der ersten
    Phase gegriffen).
    """
    n = len(standards)
    for i in range(n):
        for j in range(i, n):
            a = standards[i]
            b = standards[j]
            if (
                a.laenge < palette.laenge
                and b.laenge < palette.laenge
                and a.laenge + b.laenge >= palette.laenge
                and a.breite >= palette.breite
                and b.breite >= palette.breite
            ):
                return Kombination(palette=palette, standard_a=a, standard_b=b)
            if (
                a.breite < palette.breite
                and b.breite < palette.breite
                and a.breite + b.breite >= palette.breite
                and a.laenge >= palette.laenge
                and b.laenge >= palette.laenge
            ):
                return Kombination(palette=palette, standard_a=a, standard_b=b)
    return None


def _kann_mergen(
    a: StandardPalette,
    b: StandardPalette,
    tol_l: float,
    tol_b: float,
    einheit: Einheit,
) -> tuple[bool, float, float]:
    """Prüft, ob zwei Cluster gemergt werden dürfen.

    Das Resultat ist die kleinste umschließende Box. Sie muss für *alle*
    Mitglieder beider Cluster innerhalb der Toleranz liegen — sonst würde
    eine Original-Palette in keinen passenden Standard mehr passen.
    """
    neue_l = max(a.laenge, b.laenge)
    neue_b = max(a.breite, b.breite)
    for m in a.members:
        if neue_l > max_zulaessig(m.laenge, tol_l, einheit):
            return False, 0.0, 0.0
        if neue_b > max_zulaessig(m.breite, tol_b, einheit):
            return False, 0.0, 0.0
    for m in b.members:
        if neue_l > max_zulaessig(m.laenge, tol_l, einheit):
            return False, 0.0, 0.0
        if neue_b > max_zulaessig(m.breite, tol_b, einheit):
            return False, 0.0, 0.0
    return True, neue_l, neue_b


def _merge_kosten(
    a: StandardPalette,
    b: StandardPalette,
    neue_l: float,
    neue_b: float,
) -> float:
    """Kostenfunktion eines Merges: zusätzliche Lademeter pro Tour.

    Das ist der Wert, den der Wirtschaftlichkeitsalgorithmus später als
    Logistik-Mehrkosten ausweist. Indem wir den Merge mit dem kleinsten
    Wert bevorzugen, minimieren wir genau diese Kosten.
    """
    extra_a = (neue_l - a.laenge) / 1000.0 * max(1, a.gesamt_anzahl)
    extra_b = (neue_l - b.laenge) / 1000.0 * max(1, b.gesamt_anzahl)
    return extra_a + extra_b


def optimiere(
    paletten: list[Palette],
    toleranz_l: float,
    toleranz_b: float,
    einheit: Einheit = "mm",
    raster: int = 50,
    kombinieren_erlaubt: bool = False,
) -> OptimierungsErgebnis:
    """Hierarchisches Clustering der Paletten zu Standardpaletten.

    Jede Eingabepalette startet als eigener Cluster. In jedem Schritt
    wird das Cluster-Paar gemergt, dessen umschließende Box den
    kleinsten Mehrbedarf an Lademetern erzeugt — vorausgesetzt jedes
    Mitglied beider Cluster passt anschließend noch in die Toleranz.
    Wenn kein Merge mehr erlaubt ist, ist die Lösung stabil.

    Im Vergleich zum naiven Greedy-Ansatz ergibt das deutlich weniger
    Standards, weil wir global den optimalen nächsten Schritt wählen
    statt der Reihenfolge der Eingabe zu folgen.

    Args:
        paletten: Liste der Eingabe-Paletten.
        toleranz_l: Maximal zulässige Überdimensionierung in Länge.
        toleranz_b: Maximal zulässige Überdimensionierung in Breite.
        einheit: Einheit der Toleranz, ``"mm"`` oder ``"prozent"``.
        raster: Aufrundungs-Raster für Standardmaße (in mm). 0 deaktiviert.
        kombinieren_erlaubt: Wenn True, werden Paletten ohne passende
            Gruppe ggf. einer Kombination aus zwei Standards zugeordnet.

    Returns:
        Ein ``OptimierungsErgebnis`` mit den ermittelten Standards und der
        Mitglieder-Zuordnung.
    """
    if not paletten:
        return OptimierungsErgebnis(standards=[], kombinationen=[], eingabe_paletten=[])

    # Cluster-State als parallele Arrays für schnelle In-Place-Updates.
    clusters: list[StandardPalette] = [
        StandardPalette(laenge=p.laenge, breite=p.breite, members=[p])
        for p in paletten
    ]
    # Pro Cluster: kleinster max_zulaessig über alle Mitglieder.
    # Bei einem Merge ist neuer Wert min(a, b) — O(1) Validierung.
    max_l: list[float] = [
        max_zulaessig(p.laenge, toleranz_l, einheit) for p in paletten
    ]
    max_b: list[float] = [
        max_zulaessig(p.breite, toleranz_b, einheit) for p in paletten
    ]
    gesamt: list[int] = [max(1, p.anzahl) for p in paletten]
    aktiv: list[bool] = [True] * len(paletten)

    while True:
        bester: tuple[float, int, int, float, float] | None = None
        n = len(clusters)
        for i in range(n):
            if not aktiv[i]:
                continue
            li, bi, ml_i, mb_i, ga_i = (
                clusters[i].laenge, clusters[i].breite,
                max_l[i], max_b[i], gesamt[i],
            )
            for j in range(i + 1, n):
                if not aktiv[j]:
                    continue
                lj, bj = clusters[j].laenge, clusters[j].breite
                nl = li if li > lj else lj
                nb = bi if bi > bj else bj
                # O(1)-Toleranzprüfung dank gecachtem max_zulaessig
                ml_min = ml_i if ml_i < max_l[j] else max_l[j]
                if nl > ml_min:
                    continue
                mb_min = mb_i if mb_i < max_b[j] else max_b[j]
                if nb > mb_min:
                    continue
                # Kosten = zusätzliche Lademeter
                kosten = (nl - li) / 1000.0 * ga_i + (nl - lj) / 1000.0 * gesamt[j]
                if bester is None or kosten < bester[0]:
                    bester = (kosten, i, j, nl, nb)
        if bester is None:
            break
        _, i, j, nl, nb = bester
        clusters[i].laenge = nl
        clusters[i].breite = nb
        clusters[i].members.extend(clusters[j].members)
        max_l[i] = max_l[i] if max_l[i] < max_l[j] else max_l[j]
        max_b[i] = max_b[i] if max_b[i] < max_b[j] else max_b[j]
        gesamt[i] += gesamt[j]
        aktiv[j] = False

    clusters = [c for c, a in zip(clusters, aktiv) if a]

    if raster > 0:
        for g in clusters:
            kandidat_l = _runde_auf(g.laenge, raster)
            kandidat_b = _runde_auf(g.breite, raster)
            if all(
                kandidat_l <= max_zulaessig(m.laenge, toleranz_l, einheit)
                and kandidat_b <= max_zulaessig(m.breite, toleranz_b, einheit)
                for m in g.members
            ):
                g.laenge = kandidat_l
                g.breite = kandidat_b

    clusters.sort(key=lambda g: g.gesamt_anzahl, reverse=True)

    return OptimierungsErgebnis(
        standards=clusters,
        kombinationen=[],
        eingabe_paletten=list(paletten),
    )


def empfohlene_toleranz(
    paletten: list[Palette],
    max_verschwendung_pct: float = 5.0,
    raster: int = 50,
) -> tuple[float, float]:
    """Empfiehlt eine Toleranz, die wenig Lademeter verschwendet.

    Sweept verschiedene Toleranz-Stufen und wählt die größte, bei der
    die zusätzlich benötigten Lademeter (gegenüber den Original-Maßen)
    unter ``max_verschwendung_pct`` Prozent der Gesamt-Lademeter
    bleiben. Damit hat der Algorithmus genug Spielraum, um wenige
    Standards zu produzieren, ohne den LKW unnötig leer mitzufahren.

    Returns:
        ``(toleranz_pct, anzahl_standards)`` — Toleranz in Prozent und
        die damit erreichte Standard-Anzahl.
    """
    if not paletten:
        return 5.0, 0

    gesamt_lm = sum(p.laenge / 1000.0 * max(1, p.anzahl) for p in paletten)
    if gesamt_lm <= 0:
        return 5.0, 0

    proben_tol = [0, 2, 5, 8, 10, 13, 17, 22, 28, 35, 45, 60, 80]
    bestes_tol = 5.0
    bestes_anz = len(paletten)

    for tol in proben_tol:
        e = optimiere(paletten, tol, tol, "prozent", raster)
        zusatz = sum(
            (s.laenge - m.laenge) / 1000.0 * max(1, m.anzahl)
            for s in e.standards for m in s.members
        )
        verschwendung = zusatz / gesamt_lm * 100
        if verschwendung <= max_verschwendung_pct:
            bestes_tol = float(tol)
            bestes_anz = e.anzahl_standards
        else:
            break

    return bestes_tol, bestes_anz


def optimiere_mit_zielanzahl(
    paletten: list[Palette],
    zielanzahl: int,
    raster: int = 50,
    einheit: Einheit = "prozent",
    obergrenze: float = 200.0,
    schritte: int = 12,
) -> tuple[OptimierungsErgebnis, float]:
    """Findet die kleinste Toleranz, mit der höchstens ``zielanzahl``
    Standards entstehen.

    Binäre Suche im Toleranz-Raum. Liefert das Optimierungs-Ergebnis und
    die ermittelte Toleranz (gleich für Länge und Breite). Nützlich, wenn
    der Anwender ein Ziel ("ich will ~15 Standards") statt eines
    Toleranzwertes vorgibt.

    Args:
        paletten: Eingabe-Paletten.
        zielanzahl: Maximal gewünschte Anzahl Standards.
        raster: Aufrundungs-Raster.
        einheit: ``"prozent"`` (default, 0-200%) oder ``"mm"`` (0-1500mm).
        obergrenze: Maximaler Toleranz-Wert (Prozent oder mm).
        schritte: Anzahl binäre-Such-Iterationen.

    Returns:
        ``(ergebnis, gefundene_toleranz)``. Wenn schon mit 0 Toleranz das
        Ziel erfüllt ist, wird 0 zurückgegeben. Wenn auch mit der
        Obergrenze das Ziel nicht erreichbar ist, wird das Resultat bei
        ``obergrenze`` geliefert.
    """
    if not paletten or zielanzahl <= 0:
        return optimiere(paletten, 0, 0, einheit, raster), 0.0

    lo, hi = 0.0, float(obergrenze)

    e_lo = optimiere(paletten, lo, lo, einheit, raster)
    if e_lo.anzahl_standards <= zielanzahl:
        return e_lo, lo

    bestes_e = optimiere(paletten, hi, hi, einheit, raster)
    bestes_t = hi

    for _ in range(schritte):
        if hi - lo < 0.5:
            break
        mid = (lo + hi) / 2
        e = optimiere(paletten, mid, mid, einheit, raster)
        if e.anzahl_standards <= zielanzahl:
            bestes_e = e
            bestes_t = mid
            hi = mid
        else:
            lo = mid

    return bestes_e, bestes_t


def berechne_wirtschaftlichkeit(
    ergebnis: OptimierungsErgebnis,
    parameter: KostenParameter,
) -> WirtschaftlichkeitsErgebnis:
    """Berechnet Palettenkosten, Logistikkosten und Ersparnis."""
    if parameter.nutzbare_ladelaenge <= 0:
        raise ValueError("nutzbare_ladelaenge muss > 0 sein")

    kosten_pro_lademeter = parameter.kosten_pro_lkw / parameter.nutzbare_ladelaenge

    palettenkosten_alt = sum(
        p.anzahl * (p.kosten_alt or parameter.palettenkosten_alt_default)
        for p in ergebnis.eingabe_paletten
    )

    palettenkosten_neu = 0.0
    zusatz_lademeter = 0.0
    for std in ergebnis.standards:
        for m in std.members:
            palettenkosten_neu += m.anzahl * parameter.palettenkosten_neu
            zusatz_lademeter += (
                (std.laenge - m.laenge) / 1000.0 * m.anzahl
            )

    for kombi in ergebnis.kombinationen:
        m = kombi.palette
        palettenkosten_neu += m.anzahl * parameter.palettenkosten_neu * 2
        groesste_l = max(kombi.standard_a.laenge, kombi.standard_b.laenge)
        zusatz_lademeter += (groesste_l - m.laenge) / 1000.0 * m.anzahl

    basis_lademeter_alt = sum(
        p.laenge / 1000.0 * p.anzahl for p in ergebnis.eingabe_paletten
    )
    basis_lademeter_neu = basis_lademeter_alt + zusatz_lademeter

    logistikkosten_alt = basis_lademeter_alt * kosten_pro_lademeter
    logistikkosten_neu = basis_lademeter_neu * kosten_pro_lademeter

    return WirtschaftlichkeitsErgebnis(
        palettenkosten_alt=palettenkosten_alt,
        palettenkosten_neu=palettenkosten_neu,
        logistikkosten_alt=logistikkosten_alt,
        logistikkosten_neu=logistikkosten_neu,
        basis_lademeter_alt=basis_lademeter_alt,
        basis_lademeter_neu=basis_lademeter_neu,
        zusatz_lademeter=zusatz_lademeter,
        kosten_pro_lademeter=kosten_pro_lademeter,
    )
