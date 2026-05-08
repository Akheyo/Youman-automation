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


def optimiere(
    paletten: list[Palette],
    toleranz_l: float,
    toleranz_b: float,
    einheit: Einheit = "mm",
    raster: int = 50,
    kombinieren_erlaubt: bool = False,
) -> OptimierungsErgebnis:
    """Greedy-Gruppierung der Paletten zu Standardpaletten.

    Args:
        paletten: Liste der Eingabe-Paletten.
        toleranz_l: Maximal zulässige Überdimensionierung in Länge.
        toleranz_b: Maximal zulässige Überdimensionierung in Breite.
        einheit: Einheit der Toleranz, ``"mm"`` oder ``"prozent"``.
        raster: Aufrundungs-Raster für Standardmaße (in mm). 0 deaktiviert.
        kombinieren_erlaubt: Wenn True, werden Paletten ohne passende Gruppe
            ggf. einer Kombination aus zwei Standards zugeordnet.

    Returns:
        Ein ``OptimierungsErgebnis`` mit den ermittelten Standards und der
        Mitglieder-Zuordnung.
    """
    sortiert = sorted(
        paletten,
        key=lambda p: p.laenge * p.breite * max(p.anzahl, 1),
        reverse=True,
    )

    standards: list[StandardPalette] = []
    kombinationen: list[Kombination] = []

    for p in sortiert:
        zugeordnet = False
        for g in standards:
            if _passt_in_gruppe(p, g, toleranz_l, toleranz_b, einheit):
                g.members.append(p)
                zugeordnet = True
                break
        if zugeordnet:
            continue

        for g in standards:
            ok, neue_l, neue_b = _kann_erweitert_werden(
                p, g, toleranz_l, toleranz_b, einheit
            )
            if ok:
                g.laenge = neue_l
                g.breite = neue_b
                g.members.append(p)
                zugeordnet = True
                break
        if zugeordnet:
            continue

        if kombinieren_erlaubt and standards:
            kombi = _finde_kombination(p, standards)
            if kombi is not None:
                kombinationen.append(kombi)
                continue

        standards.append(
            StandardPalette(laenge=p.laenge, breite=p.breite, members=[p])
        )

    if raster > 0:
        for g in standards:
            kandidat_l = _runde_auf(g.laenge, raster)
            kandidat_b = _runde_auf(g.breite, raster)
            if all(
                kandidat_l <= max_zulaessig(m.laenge, toleranz_l, einheit)
                and kandidat_b <= max_zulaessig(m.breite, toleranz_b, einheit)
                for m in g.members
            ):
                g.laenge = kandidat_l
                g.breite = kandidat_b

    standards.sort(key=lambda g: g.gesamt_anzahl, reverse=True)

    return OptimierungsErgebnis(
        standards=standards,
        kombinationen=kombinationen,
        eingabe_paletten=list(paletten),
    )


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
