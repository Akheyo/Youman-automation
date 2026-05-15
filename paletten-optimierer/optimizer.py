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
    """Eingabe-Palette aus der Excel-Datei.

    ``laenge`` und ``breite`` sind kanonisch normalisiert (``laenge`` ist
    immer die längere Achse). Die Felder ``laenge_original`` und
    ``breite_original`` halten die ursprüngliche Schreibweise aus der
    Excel-Datei fest, damit der User in der UI wiedererkennt was er
    importiert hat — auch wenn der Algorithmus die Maße rotiert hat.

    Hintergrund: Eine Palette 1200×800 und 800×1200 sind physisch die
    gleiche Sache (Drahtgitter-Paletten kann man auf dem LKW drehen).
    Ohne Normalisierung landeten beide in unterschiedlichen Clustern.
    """

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
    laenge_original: float = 0.0
    breite_original: float = 0.0

    def __post_init__(self) -> None:
        # Falls nicht explizit gesetzt, halte die Original-Werte parallel.
        if self.laenge_original == 0.0:
            self.laenge_original = self.laenge
        if self.breite_original == 0.0:
            self.breite_original = self.breite
        # Kanonische Form: lange Seite zuerst.
        if self.breite > self.laenge:
            self.laenge, self.breite = self.breite, self.laenge


@dataclass
class StandardPalette:
    """Eine zusammengefasste Standardpalette mit ihren Mitgliedern."""

    laenge: float
    breite: float
    hoehe: float = 0.0
    members: list[Palette] = field(default_factory=list)

    @property
    def label(self) -> str:
        base = f"{int(round(self.laenge))} × {int(round(self.breite))} mm"
        if self.hoehe > 0:
            base = f"{int(round(self.laenge))} × {int(round(self.breite))} × {int(round(self.hoehe))} mm"
        return base

    @property
    def gesamt_anzahl(self) -> int:
        return sum(m.anzahl for m in self.members)


@dataclass
class Kombination:
    """Kombination aus zwei oder drei Standardpaletten für eine Eingabe-Palette.

    Die ``richtung`` gibt an, ob die Standards in Längs- oder Breitenrichtung
    aneinandergelegt werden — entsprechend addieren sich entweder die Längen
    oder die Breiten zur Abdeckung der Original-Palette.
    """

    palette: Palette
    standards: list[StandardPalette] = field(default_factory=list)
    richtung: str = "laenge"  # "laenge" oder "breite"

    @property
    def standard_a(self) -> StandardPalette:
        return self.standards[0]

    @property
    def standard_b(self) -> StandardPalette:
        return self.standards[1] if len(self.standards) >= 2 else self.standards[0]

    @property
    def label(self) -> str:
        parts = [
            f"{int(round(s.laenge))} × {int(round(s.breite))}"
            for s in self.standards
        ]
        return " + ".join(parts)


@dataclass
class OptimierungsErgebnis:
    """Resultat der Optimierung: Standards, ggf. Kombinationen, Statistiken."""

    standards: list[StandardPalette]
    kombinationen: list[Kombination] = field(default_factory=list)
    eingabe_paletten: list[Palette] = field(default_factory=list)
    sonderpaletten: list[Palette] = field(default_factory=list)

    @property
    def anzahl_eingabe_typen(self) -> int:
        return len(self.eingabe_paletten)

    @property
    def anzahl_standards(self) -> int:
        return len(self.standards)

    @property
    def anzahl_sonder(self) -> int:
        return len(self.sonderpaletten)

    @property
    def reduktion_prozent(self) -> float:
        if self.anzahl_eingabe_typen == 0:
            return 0.0
        return 100.0 * (1 - self.anzahl_standards / self.anzahl_eingabe_typen)


@dataclass
class PalettenKalkulation:
    """Detaillierte Kostenkalkulation pro Palette mit Sub-Positionen.

    Wenn ``aktiv=True``, wird die Summe der Sub-Positionen als
    Stückkosten verwendet. Sonst greift der flache Wert
    ``palettenkosten_neu`` bzw. ``palettenkosten_alt_default`` aus
    :class:`KostenParameter`.
    """

    aktiv: bool = False
    material: float = 0.0
    fertigung: float = 0.0
    einkauf: float = 0.0
    lager: float = 0.0
    handling: float = 0.0

    @property
    def total(self) -> float:
        return self.material + self.fertigung + self.einkauf + self.lager + self.handling


@dataclass
class KostenParameter:
    """Eingabe-Parameter für die Wirtschaftlichkeitsrechnung."""

    kosten_pro_lkw: float = 800.0
    nutzbare_ladelaenge: float = 13.6
    lkw_breite: float = 2.4
    palettenkosten_neu: float = 14.0
    palettenkosten_alt_default: float = 22.0
    # Einmalige Setup-Kosten pro neuem Standardtyp (Werkzeuge, Anlernung).
    # Wird für die Break-Even-Berechnung verwendet.
    setup_kosten_pro_standard: float = 200.0
    # Detaillierte Kalkulation (optional aktivierbar)
    kalkulation_neu: PalettenKalkulation = field(default_factory=PalettenKalkulation)
    kalkulation_alt: PalettenKalkulation = field(default_factory=PalettenKalkulation)

    def effektive_kosten_neu(self) -> float:
        if self.kalkulation_neu.aktiv:
            return self.kalkulation_neu.total
        return self.palettenkosten_neu

    def effektive_kosten_alt(self) -> float:
        if self.kalkulation_alt.aktiv:
            return self.kalkulation_alt.total
        return self.palettenkosten_alt_default

    def kosten_pro_quadratmeter(self) -> float:
        """€ pro Quadratmeter LKW-Bodenfläche."""
        flaeche = self.nutzbare_ladelaenge * self.lkw_breite
        if flaeche <= 0:
            return 0.0
        return self.kosten_pro_lkw / flaeche

    def kosten_pro_lademeter(self) -> float:
        if self.nutzbare_ladelaenge <= 0:
            return 0.0
        return self.kosten_pro_lkw / self.nutzbare_ladelaenge


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
    setup_kosten_einmalig: float = 0.0

    @property
    def gesamtkosten_alt(self) -> float:
        return self.palettenkosten_alt + self.logistikkosten_alt

    @property
    def gesamtkosten_neu(self) -> float:
        return self.palettenkosten_neu + self.logistikkosten_neu

    @property
    def ersparnis(self) -> float:
        return self.gesamtkosten_alt - self.gesamtkosten_neu

    @property
    def break_even_monate(self) -> float | None:
        """Anzahl Monate bis sich die einmaligen Setup-Kosten amortisiert haben.

        ``None`` wenn die monatliche Ersparnis <= 0 ist (lohnt sich nie)
        oder wenn keine Setup-Kosten anfallen (amortisiert sofort).
        """
        if self.setup_kosten_einmalig <= 0:
            return 0.0 if self.ersparnis > 0 else None
        if self.ersparnis <= 0:
            return None
        return self.setup_kosten_einmalig / self.ersparnis

    def hochrechnung(self, monate: int) -> float:
        return self.ersparnis * monate - self.setup_kosten_einmalig


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


def _finde_beste_kombi(
    palette: Palette,
    standards: list[StandardPalette],
    tol_l: float,
    tol_b: float,
    einheit: Einheit,
    max_k: int = 3,
) -> Kombination | None:
    """Sucht die kostengünstigste 2- bis ``max_k``-fach-Kombination.

    Eine Kombination legt mehrere Standardpaletten aneinander, sodass sie
    zusammen die Original-Palette abdecken — entweder in Längsrichtung
    (Längen addieren sich) oder in Querrichtung (Breiten addieren sich).
    Das Programm prüft beide Richtungen und nimmt die mit den kleinsten
    Lademeter-Mehrkosten.

    Constraints:
    - Die Summe in der gestapelten Dimension muss >= Original-Maß sein
      und darf das Maximum aus Original + Toleranz nicht überschreiten.
    - In der orthogonalen Dimension muss jeder Standard >= Original-Maß
      sein, und der größte darf max_zulaessig(Original, Tol) nicht
      überschreiten.
    - Jeder Standard muss in der gestapelten Dimension echt kleiner als
      die Original-Palette sein — sonst wäre ein einzelner ausreichend.
    """
    if not standards or max_k < 2:
        return None

    max_l = max_zulaessig(palette.laenge, tol_l, einheit)
    max_b = max_zulaessig(palette.breite, tol_b, einheit)
    anzahl = max(1, palette.anzahl)

    # Vorfilter: Standards die in *einer* Richtung passen und in der
    # *anderen* nicht zu groß sind. Das reduziert die Kombinations-Anzahl
    # bei vielen Cluster (z.B. 100+) drastisch.
    relevant = [
        s for s in standards
        if (
            (s.breite >= palette.breite and s.breite <= max_b and s.laenge <= max_l)
            or (s.laenge >= palette.laenge and s.laenge <= max_l and s.breite <= max_b)
        )
    ]
    if not relevant:
        return None
    standards = relevant

    # Bei 306 Paletten × bis zu 50 Standards × 3-fach = ca. 125k Kombis.
    # Akzeptabel, weil wir das nur für wenige Kandidaten ausführen.
    bester: tuple[float, list[StandardPalette], str] | None = None

    def _eintragen(kosten: float, combo: list[StandardPalette], richtung: str) -> None:
        nonlocal bester
        if bester is None or kosten < bester[0]:
            bester = (kosten, combo, richtung)

    def _kombi_laengs(combo: list[StandardPalette]) -> None:
        sum_l = sum(s.laenge for s in combo)
        if sum_l < palette.laenge or sum_l > max_l:
            return
        min_b = min(s.breite for s in combo)
        max_b_in_combo = max(s.breite for s in combo)
        if min_b < palette.breite or max_b_in_combo > max_b:
            return
        if all(s.laenge >= palette.laenge for s in combo):
            return  # ein einzelner würde reichen
        kosten = (sum_l - palette.laenge) / 1000.0 * anzahl + len(combo) * 0.05
        _eintragen(kosten, list(combo), "laenge")

    def _kombi_quer(combo: list[StandardPalette]) -> None:
        sum_b = sum(s.breite for s in combo)
        if sum_b < palette.breite or sum_b > max_b:
            return
        min_l = min(s.laenge for s in combo)
        max_l_in_combo = max(s.laenge for s in combo)
        if min_l < palette.laenge or max_l_in_combo > max_l:
            return
        if all(s.breite >= palette.breite for s in combo):
            return
        kosten = (max_l_in_combo - palette.laenge) / 1000.0 * anzahl + len(combo) * 0.05
        _eintragen(kosten, list(combo), "breite")

    n = len(standards)
    # 2-fach Kombis
    for i in range(n):
        for j in range(i, n):
            _kombi_laengs([standards[i], standards[j]])
            _kombi_quer([standards[i], standards[j]])
    # 3-fach Kombis (nur wenn aktiviert)
    if max_k >= 3:
        for i in range(n):
            for j in range(i, n):
                for k in range(j, n):
                    _kombi_laengs([standards[i], standards[j], standards[k]])
                    _kombi_quer([standards[i], standards[j], standards[k]])

    if bester is None:
        return None
    _, combo, richtung = bester
    return Kombination(palette=palette, standards=combo, richtung=richtung)


def _post_processing_kombinationen(
    ergebnis: OptimierungsErgebnis,
    tol_l: float,
    tol_b: float,
    einheit: Einheit,
    max_k: int = 3,
    max_iterationen: int = 200,
) -> OptimierungsErgebnis:
    """Eliminiert Standards aggressiv durch Kombinationen.

    Ziel: minimale Anzahl unique Standards. Geht iterativ den kleinsten
    Cluster zuerst durch und prüft, ob *jedes* Mitglied durch eine
    2- bis ``max_k``-fach-Kombination der verbleibenden Standards
    abgedeckt werden kann (in Längs- oder Querrichtung). Wenn ja, fällt
    der ganze Cluster weg und seine Mitglieder werden als Kombinationen
    erfasst. Wiederholt sich, bis keine weitere Eliminierung möglich ist
    — die übrig bleibenden Standards bilden eine Art „Basis", aus der
    sich alle Original-Maße reproduzieren lassen.
    """
    for _ in range(max_iterationen):
        if len(ergebnis.standards) < 3:
            break
        idx_sort = sorted(
            range(len(ergebnis.standards)),
            key=lambda i: (
                len(ergebnis.standards[i].members),
                ergebnis.standards[i].gesamt_anzahl,
            ),
        )
        eliminiert = False
        for idx in idx_sort:
            std = ergebnis.standards[idx]
            andere = [
                ergebnis.standards[i]
                for i in range(len(ergebnis.standards))
                if i != idx
            ]
            kombis: list[Kombination] = []
            kann_alles = True
            for m in std.members:
                k = _finde_beste_kombi(m, andere, tol_l, tol_b, einheit, max_k=max_k)
                if k is None:
                    kann_alles = False
                    break
                kombis.append(k)
            if kann_alles and kombis:
                ergebnis.kombinationen.extend(kombis)
                ergebnis.standards.pop(idx)
                eliminiert = True
                break
        if not eliminiert:
            break
    return ergebnis


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
    raster: int = 100,
    kombinieren_erlaubt: bool = False,
    wirtschaftliche_filterung: bool = False,
    kosten_parameter: KostenParameter | None = None,
    mengen_schwelle: int = 0,
    toleranz_h: float | None = None,
    hoehe_aktiv: bool = False,
) -> OptimierungsErgebnis:
    """Set-Cover-Optimierung der Paletten zu Standardpaletten.

    Spec-konformer 5-Phasen-Algorithmus:

    1. **Kandidaten erzeugen.** Für jeden Artikel als Anker wird die größte
       Gruppe gebildet, die innerhalb der Toleranzfenster zusammenbleibt.
       Die Standardgröße ist (max L_i, max W_i) der Gruppe — kleiner geht
       nicht, weil sonst Mitglieder rausfallen.
    2. **Greedy Set Cover.** Iterativ den Kandidaten wählen, der die meiste
       *noch unabgedeckte Stückzahl* abdeckt (gewichtet nach
       ``anzahl``, nicht nach Artikelanzahl). Wiederholen bis alles
       abgedeckt ist.
    3. **Schrumpfen.** Standardmaße sind durch die Konstruktion bereits
       minimal — keine zusätzliche Reduktion nötig.
    4. **Merging / Kombinationen.** Wenn ``kombinieren_erlaubt=True``,
       werden kleine Cluster eliminiert, deren Mitglieder durch 2- oder
       3-fach-Kombinationen größerer Standards abgedeckt werden können.
    5. **Wirtschaftlichkeitsfilter.** Wenn aktiv, werden Cluster
       aufgelöst, deren Logistik-Mehrkosten die Palettenkosten-Ersparnis
       übersteigen.

    Args:
        paletten: Eingabe-Paletten.
        toleranz_l / toleranz_b: Maximale Überdimensionierung.
        einheit: ``"mm"`` oder ``"prozent"``.
        raster: Aufrundungs-Raster (default 100 mm).
        kombinieren_erlaubt: Phase 4 aktivieren.
        wirtschaftliche_filterung: Phase 5 aktivieren.
        kosten_parameter: erforderlich wenn Phase 5 aktiv.
        mengen_schwelle: Artikel mit ``anzahl < mengen_schwelle`` werden
            als Sonderpaletten ausgewiesen und nicht standardisiert
            (Spec: "Sondergröße in Verkleidung" vermeiden).
    """
    if not paletten:
        return OptimierungsErgebnis(
            standards=[], kombinationen=[], eingabe_paletten=[], sonderpaletten=[]
        )

    zu_std = list(paletten)
    n = len(zu_std)
    L_min = [p.laenge for p in zu_std]
    W_min = [p.breite for p in zu_std]
    L_max_tol = [max_zulaessig(p.laenge, toleranz_l, einheit) for p in zu_std]
    W_max_tol = [max_zulaessig(p.breite, toleranz_b, einheit) for p in zu_std]
    anzahl = [max(1, p.anzahl) for p in zu_std]

    # Höhe als optionale dritte Dimension. Bei p.hoehe == 0 wird die Höhe
    # für diesen Artikel nicht erzwungen (er passt in jeden Standard).
    if hoehe_aktiv:
        tol_h_val = toleranz_h if toleranz_h is not None else toleranz_l
        H_min = [p.hoehe for p in zu_std]
        H_max_tol = [
            max_zulaessig(p.hoehe, tol_h_val, einheit) if p.hoehe > 0 else float("inf")
            for p in zu_std
        ]
    else:
        H_min = [0.0] * n
        H_max_tol = [float("inf")] * n

    # === Phase 1: Kandidaten ===
    # Für jeden Anker einen "maximalen kompatiblen Cluster" bauen.
    # Sortier-Reihenfolge der Hinzunahme: nach Anzahl absteigend, mit
    # Artikelnummer als Tie-Breaker — sonst ist das Ergebnis nicht
    # deterministisch, wenn mehrere Aufträge die gleiche anzahl haben.
    sortier_by_demand = sorted(
        range(n),
        key=lambda j: (-anzahl[j], zu_std[j].artikelnummer, j),
    )

    kandidaten: list[tuple[float, float, float, frozenset[int]]] = []
    seen: set[tuple[float, float, float, frozenset[int]]] = set()
    for anker in range(n):
        chosen: list[int] = [anker]
        L_s = L_min[anker]
        W_s = W_min[anker]
        H_s = H_min[anker]
        for j in sortier_by_demand:
            if j == anker:
                continue
            new_L = L_s if L_s > L_min[j] else L_min[j]
            new_W = W_s if W_s > W_min[j] else W_min[j]
            new_H = H_s if H_s > H_min[j] else H_min[j]
            # Passt der erweiterte Cluster zu allen bisherigen + j?
            if new_L > L_max_tol[j] or new_W > W_max_tol[j] or new_H > H_max_tol[j]:
                continue
            ok = True
            for k in chosen:
                if (new_L > L_max_tol[k] or new_W > W_max_tol[k]
                        or new_H > H_max_tol[k]):
                    ok = False
                    break
            if not ok:
                continue
            chosen.append(j)
            L_s, W_s, H_s = new_L, new_W, new_H
        key = (L_s, W_s, H_s, frozenset(chosen))
        if key not in seen:
            seen.add(key)
            kandidaten.append(key)

    # === Phase 2: Greedy Set Cover (nach Bedarf gewichtet) ===
    # Wirtschaftlicher Score (optional): summiere Netto-Ersparnis statt
    # nur Bedarfs-Abdeckung. So bevorzugt Set Cover Kandidaten, die
    # tatsächlich Geld sparen, statt nur viele Artikel zu fangen.
    wirt_score_aktiv = wirtschaftliche_filterung and kosten_parameter is not None

    def _score(L_s: float, W_s: float, cov: set[int]) -> tuple[float, float]:
        """Liefert (primary_score, fallback_score). Set Cover wählt nach
        primary, bei Gleichstand nach fallback. Bei aktivierter Wirt.-
        Optimierung ist primary die Summe positiver Netto-Beiträge."""
        if wirt_score_aktiv:
            net_summe = 0.0
            for i in cov:
                p = zu_std[i]
                net = palette_netto(L_s, W_s, p, kosten_parameter)
                if net > 0:
                    net_summe += net * p.anzahl
            return (net_summe, sum(anzahl[i] for i in cov))
        return (float(sum(anzahl[i] for i in cov)), 0.0)

    nicht_abgedeckt: set[int] = set(range(n))
    auswahl: list[tuple[float, float, float, set[int]]] = []
    while nicht_abgedeckt:
        bester: tuple[float, float, float, set[int]] | None = None
        bester_score = (-1.0, -1.0)
        for L_s, W_s, H_s, members in kandidaten:
            cov = members & nicht_abgedeckt
            if not cov:
                continue
            score = _score(L_s, W_s, cov)
            if score > bester_score:
                bester_score = score
                bester = (L_s, W_s, H_s, set(cov))
        if bester is None:
            for i in nicht_abgedeckt:
                auswahl.append((L_min[i], W_min[i], H_min[i], {i}))
            break
        # Wenn auch der beste Kandidat wirt. neutral/negativ ist,
        # Mitglieder als Singletons (Sonderpaletten) belassen.
        if wirt_score_aktiv and bester_score[0] <= 0:
            for i in bester[3]:
                auswahl.append((L_min[i], W_min[i], H_min[i], {i}))
            nicht_abgedeckt -= bester[3]
            continue
        auswahl.append(bester)
        nicht_abgedeckt -= bester[3]

    # === Phase 3: Schrumpfen ist implizit (L_s = max L_min des Subsets) ===

    # === Phase 4: Raster aufrunden ===
    tol_h_val = toleranz_h if toleranz_h is not None else toleranz_l
    standards: list[StandardPalette] = []
    for L_s, W_s, H_s, idx_set in auswahl:
        members = [zu_std[i] for i in idx_set]
        if raster > 0:
            k_l = _runde_auf(L_s, raster)
            k_w = _runde_auf(W_s, raster)
            if all(
                k_l <= max_zulaessig(m.laenge, toleranz_l, einheit)
                and k_w <= max_zulaessig(m.breite, toleranz_b, einheit)
                for m in members
            ):
                L_s, W_s = k_l, k_w
            if hoehe_aktiv and H_s > 0:
                k_h = _runde_auf(H_s, raster)
                if all(
                    (m.hoehe == 0) or (k_h <= max_zulaessig(m.hoehe, tol_h_val, einheit))
                    for m in members
                ):
                    H_s = k_h
        standards.append(
            StandardPalette(
                laenge=L_s,
                breite=W_s,
                hoehe=H_s if hoehe_aktiv else 0.0,
                members=members,
            )
        )

    standards.sort(key=lambda g: g.gesamt_anzahl, reverse=True)

    # === Mengen-Schwelle: kleine Cluster werden Sonderpaletten ===
    sonder: list[Palette] = []
    if mengen_schwelle > 0:
        haupt = [s for s in standards if s.gesamt_anzahl >= mengen_schwelle]
        klein = [s for s in standards if s.gesamt_anzahl < mengen_schwelle]
        for s in klein:
            sonder.extend(s.members)
        standards = haupt

    ergebnis = OptimierungsErgebnis(
        standards=standards,
        kombinationen=[],
        eingabe_paletten=list(paletten),
        sonderpaletten=sonder,
    )

    # === Phase 5: Kombinationen ===
    if kombinieren_erlaubt and len(standards) >= 3:
        ergebnis = _post_processing_kombinationen(
            ergebnis, tol_l=toleranz_l, tol_b=toleranz_b, einheit=einheit
        )

    # === Phase 6: Wirtschaftlichkeitsfilter ===
    if wirtschaftliche_filterung and kosten_parameter is not None:
        ergebnis = _wirtschaftliche_filterung(ergebnis, kosten_parameter)

    return ergebnis


def palette_ersparnis(p: Palette, parameter: KostenParameter) -> float:
    """Palettenkosten-Ersparnis pro Stück, wenn ``p`` standardisiert wird.

    Differenz zwischen Sonderanfertigung (``kosten_alt``) und Standard
    (``kosten_neu``). Negative Werte werden auf 0 begrenzt — keine
    Ersparnis bedeutet keine Ersparnis, keine Strafe.
    """
    kosten_alt = p.kosten_alt or parameter.effektive_kosten_alt()
    return max(0.0, kosten_alt - parameter.effektive_kosten_neu())


def palette_mehrkosten(
    L_s: float, W_s: float, p: Palette, parameter: KostenParameter
) -> float:
    """Logistik-Mehrkosten pro Palette, wenn ``p`` in einen Standard
    ``L_s × W_s`` einsortiert wird.

    Modelliert die zusätzlich beanspruchte LKW-Bodenfläche
    (Länge × Breite) als Kosten pro m² Ladefläche — berücksichtigt also
    *beide* Achsen, nicht nur die Länge wie in der älteren Formel.
    """
    flaeche_diff_m2 = max(
        0.0, (L_s * W_s - p.laenge * p.breite) / 1_000_000.0
    )
    return flaeche_diff_m2 * parameter.kosten_pro_quadratmeter()


def palette_netto(
    L_s: float, W_s: float, p: Palette, parameter: KostenParameter
) -> float:
    """Wirtschaftlicher Netto-Beitrag pro Palette: Ersparnis minus Mehrkosten."""
    return palette_ersparnis(p, parameter) - palette_mehrkosten(L_s, W_s, p, parameter)


def mitglieder_wirtschaftlichkeit(
    std: StandardPalette, parameter: KostenParameter
) -> list[dict]:
    """Detail-Aufschlüsselung pro Mitglied eines Standards.

    Returns eine Liste mit pro-Mitglied:
        - artikelnummer, kunde, original_l, original_b, anzahl
        - ersparnis (pro Stück), mehrkosten (pro Stück), netto (pro Stück)
        - ersparnis_total = ersparnis × anzahl, mehrkosten_total, netto_total
    """
    rows: list[dict] = []
    for m in std.members:
        e_per = palette_ersparnis(m, parameter)
        k_per = palette_mehrkosten(std.laenge, std.breite, m, parameter)
        n_per = e_per - k_per
        rows.append({
            "artikelnummer": m.artikelnummer,
            "kunde": m.kunde,
            "auftrag": m.auftrag,
            "original_l": m.laenge_original or m.laenge,
            "original_b": m.breite_original or m.breite,
            "anzahl": m.anzahl,
            "ersparnis_pro_pal": e_per,
            "mehrkosten_pro_pal": k_per,
            "netto_pro_pal": n_per,
            "ersparnis_total": e_per * m.anzahl,
            "mehrkosten_total": k_per * m.anzahl,
            "netto_total": n_per * m.anzahl,
        })
    return rows


def _wirtschaftliche_filterung(
    ergebnis: OptimierungsErgebnis,
    parameter: KostenParameter,
) -> OptimierungsErgebnis:
    """Wirtschaftliche Optimierung: Cluster bleiben nur erhalten, wenn die
    Summe der Palettenkosten-Ersparnis größer ist als die Summe der
    zusätzlichen Logistikkosten (Bodenfläche-basiert, beide Achsen).

    Spec-konform: *Eine größere Standardpalette wird nur empfohlen, wenn
    die Einsparung der Palettenkosten größer ist als die zusätzlichen
    Transportkosten.*
    """
    behalten: list[StandardPalette] = []
    for std in ergebnis.standards:
        if len(std.members) <= 1:
            behalten.append(std)
            continue
        ersparnis = sum(
            palette_ersparnis(m, parameter) * m.anzahl for m in std.members
        )
        mehrkosten = sum(
            palette_mehrkosten(std.laenge, std.breite, m, parameter) * m.anzahl
            for m in std.members
        )
        if ersparnis >= mehrkosten:
            behalten.append(std)
            continue
        for m in std.members:
            behalten.append(
                StandardPalette(laenge=m.laenge, breite=m.breite, members=[m])
            )

    ergebnis.standards = behalten
    ergebnis.standards.sort(key=lambda g: g.gesamt_anzahl, reverse=True)
    return ergebnis


def break_even_analyse(
    paletten: list[Palette],
    parameter: KostenParameter,
    toleranzen_mm: list[int] | None = None,
    kombinieren_erlaubt: bool = True,
    raster: int = 100,
) -> list[dict]:
    """Sweept verschiedene Toleranzen und berechnet pro Stufe die
    wirtschaftliche Bilanz.

    Liefert eine Tabelle mit ``toleranz, anzahl_standards,
    palettenkosten_diff, logistikkosten_diff, gesamt_ersparnis,
    break_even_monate`` — der Punkt mit der größten Gesamt-Ersparnis ist
    die wirtschaftlich optimale Toleranz.

    Wird vom „🎯 Break-Even-Analyse"-Knopf in der UI aufgerufen.
    """
    if toleranzen_mm is None:
        toleranzen_mm = [50, 100, 150, 200, 300, 400, 500, 700, 1000]

    ergebnisse: list[dict] = []
    for tol in toleranzen_mm:
        erg = optimiere(
            paletten,
            toleranz_l=float(tol),
            toleranz_b=float(tol),
            einheit="mm",
            raster=raster,
            kombinieren_erlaubt=kombinieren_erlaubt,
            wirtschaftliche_filterung=False,
            kosten_parameter=parameter,
        )
        w = berechne_wirtschaftlichkeit(erg, parameter)
        ergebnisse.append({
            "toleranz_mm": tol,
            "anzahl_standards": erg.anzahl_standards,
            "anzahl_kombinationen": len(erg.kombinationen),
            "palettenkosten_alt": w.palettenkosten_alt,
            "palettenkosten_neu": w.palettenkosten_neu,
            "palettenkosten_diff": w.palettenkosten_neu - w.palettenkosten_alt,
            "logistikkosten_alt": w.logistikkosten_alt,
            "logistikkosten_neu": w.logistikkosten_neu,
            "logistikkosten_diff": w.logistikkosten_neu - w.logistikkosten_alt,
            "ersparnis_pro_monat": w.ersparnis,
            "ersparnis_pro_jahr": w.ersparnis * 12,
            "setup_kosten": w.setup_kosten_einmalig,
            "break_even_monate": w.break_even_monate,
        })
    return ergebnisse


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
    kosten_neu_pro_stk = parameter.effektive_kosten_neu()
    kosten_alt_default = parameter.effektive_kosten_alt()

    palettenkosten_alt = sum(
        p.anzahl * (p.kosten_alt or kosten_alt_default)
        for p in ergebnis.eingabe_paletten
    )

    palettenkosten_neu = 0.0
    zusatz_lademeter = 0.0
    for std in ergebnis.standards:
        for m in std.members:
            palettenkosten_neu += m.anzahl * kosten_neu_pro_stk
            zusatz_lademeter += (
                (std.laenge - m.laenge) / 1000.0 * m.anzahl
            )

    for kombi in ergebnis.kombinationen:
        m = kombi.palette
        anzahl_standards_im_kombi = len(kombi.standards)
        palettenkosten_neu += m.anzahl * kosten_neu_pro_stk * anzahl_standards_im_kombi
        if kombi.richtung == "laenge":
            groesste_l = max(s.laenge for s in kombi.standards)
        else:
            groesste_l = max(s.laenge for s in kombi.standards)
        zusatz_lademeter += (groesste_l - m.laenge) / 1000.0 * m.anzahl

    basis_lademeter_alt = sum(
        p.laenge / 1000.0 * p.anzahl for p in ergebnis.eingabe_paletten
    )
    basis_lademeter_neu = basis_lademeter_alt + zusatz_lademeter

    logistikkosten_alt = basis_lademeter_alt * kosten_pro_lademeter
    logistikkosten_neu = basis_lademeter_neu * kosten_pro_lademeter

    setup_kosten_einmalig = parameter.setup_kosten_pro_standard * len(ergebnis.standards)

    return WirtschaftlichkeitsErgebnis(
        palettenkosten_alt=palettenkosten_alt,
        palettenkosten_neu=palettenkosten_neu,
        logistikkosten_alt=logistikkosten_alt,
        logistikkosten_neu=logistikkosten_neu,
        basis_lademeter_alt=basis_lademeter_alt,
        basis_lademeter_neu=basis_lademeter_neu,
        zusatz_lademeter=zusatz_lademeter,
        kosten_pro_lademeter=kosten_pro_lademeter,
        setup_kosten_einmalig=setup_kosten_einmalig,
    )
