"""Excel-Import/Export und Beispieldaten-Generator.

Liest .xlsx-Dateien mit flexibler Spaltenerkennung (DE/EN-Schreibweisen),
schreibt das Optimierungs-Ergebnis zurück und kann realistische Testdaten
mit Cluster-Verteilung erzeugen.
"""
from __future__ import annotations

import io
import random
from pathlib import Path
from typing import IO, Iterable

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from optimizer import OptimierungsErgebnis, Palette


SPALTEN_MAPPING: dict[str, list[str]] = {
    "artikelnummer": [
        "artikelnummer",
        "artikel",
        "artikelnr",
        "artikel-nr",
        "art-nr",
        "artnr",
        "sku",
        "item",
        "item_no",
        "item number",
        "nummer",
    ],
    "laenge": [
        "laenge",
        "länge",
        "lange",
        "length",
        "l",
        "laenge_mm",
        "länge_mm",
        "length_mm",
    ],
    "breite": [
        "breite",
        "width",
        "b",
        "w",
        "breite_mm",
        "width_mm",
    ],
    "anzahl": [
        "anzahl",
        "benoetigte_paletten",
        "benötigte_paletten",
        "benoetigte paletten",
        "benötigte paletten",
        "menge",
        "stueck",
        "stück",
        "qty",
        "quantity",
        "count",
    ],
    "stueck_pro_palette": [
        "stueckzahl_pro_palette",
        "stückzahl_pro_palette",
        "stueck_pro_palette",
        "stück_pro_palette",
        "stueckzahl pro palette",
        "stk_pro_palette",
        "items_per_pallet",
        "pieces_per_pallet",
    ],
    "kosten_alt": [
        "palettenkosten",
        "kosten",
        "kosten_alt",
        "palette_cost",
        "cost",
        "preis",
        "price",
    ],
}


def _normalisiere(name: str) -> str:
    return (
        str(name)
        .strip()
        .lower()
        .replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
        .replace("-", "_")
        .replace(" ", "_")
        .replace(".", "_")
    )


def _finde_spalten(header: list[str]) -> dict[str, int]:
    """Ordnet logische Feldnamen den tatsächlichen Spalten-Indizes zu."""
    norm_header = [_normalisiere(h) if h is not None else "" for h in header]
    mapping: dict[str, int] = {}
    for ziel, kandidaten in SPALTEN_MAPPING.items():
        for idx, h in enumerate(norm_header):
            if h in [_normalisiere(k) for k in kandidaten]:
                mapping[ziel] = idx
                break
    return mapping


def importiere_excel(
    file_or_buffer: str | Path | IO[bytes],
    sheet_name: str | None = None,
) -> list[Palette]:
    """Liest eine Palettenliste aus einer Excel-Datei.

    Args:
        file_or_buffer: Pfad oder Datei-ähnliches Objekt (z.B. Streamlit-Upload).
        sheet_name: Optionaler Name des Sheets, sonst das erste.

    Returns:
        Liste valider ``Palette``-Objekte. Ungültige Zeilen werden
        übersprungen.
    """
    wb = openpyxl.load_workbook(file_or_buffer, data_only=True, read_only=True)
    ws = wb[sheet_name] if sheet_name else wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    header_row = rows[0]
    header = [str(c) if c is not None else "" for c in header_row]
    spalten = _finde_spalten(header)

    pflicht = ["artikelnummer", "laenge", "breite"]
    fehlend = [p for p in pflicht if p not in spalten]
    if fehlend:
        raise ValueError(
            f"Pflichtspalten fehlen in Excel: {', '.join(fehlend)}. "
            f"Gefundene Spalten: {header}"
        )

    paletten: list[Palette] = []
    for row in rows[1:]:
        if all(c is None or str(c).strip() == "" for c in row):
            continue
        try:
            artikel = row[spalten["artikelnummer"]]
            laenge_v = row[spalten["laenge"]]
            breite_v = row[spalten["breite"]]
            if artikel is None or laenge_v is None or breite_v is None:
                continue
            laenge = float(laenge_v)
            breite = float(breite_v)
            if laenge <= 0 or breite <= 0:
                continue

            anzahl_v = row[spalten["anzahl"]] if "anzahl" in spalten else None
            anzahl = int(float(anzahl_v)) if anzahl_v not in (None, "") else 1
            if anzahl < 0:
                continue

            stk_v = (
                row[spalten["stueck_pro_palette"]]
                if "stueck_pro_palette" in spalten
                else None
            )
            stueck = int(float(stk_v)) if stk_v not in (None, "") else 0

            kosten_v = row[spalten["kosten_alt"]] if "kosten_alt" in spalten else None
            kosten = float(kosten_v) if kosten_v not in (None, "") else 14.0

            paletten.append(
                Palette(
                    artikelnummer=str(artikel).strip(),
                    laenge=laenge,
                    breite=breite,
                    anzahl=anzahl,
                    kosten_alt=kosten,
                    stueck_pro_palette=stueck,
                )
            )
        except (TypeError, ValueError):
            continue

    return paletten


def exportiere_ergebnis_excel(ergebnis: OptimierungsErgebnis) -> bytes:
    """Schreibt das Optimierungs-Ergebnis als Excel-Datei (Bytes)."""
    wb = openpyxl.Workbook()
    ws_std = wb.active
    ws_std.title = "Standards"
    header_fill = PatternFill("solid", fgColor="1A2944")
    header_font = Font(color="FFFFFF", bold=True)

    spalten_std = [
        "Standard",
        "Länge (mm)",
        "Breite (mm)",
        "Anzahl Mitglieder",
        "Gesamt Paletten",
    ]
    ws_std.append(spalten_std)
    for col, _ in enumerate(spalten_std, start=1):
        c = ws_std.cell(row=1, column=col)
        c.fill = header_fill
        c.font = header_font
        c.alignment = Alignment(horizontal="center")

    for s in ergebnis.standards:
        ws_std.append(
            [
                s.label,
                round(s.laenge),
                round(s.breite),
                len(s.members),
                s.gesamt_anzahl,
            ]
        )

    for col_idx in range(1, len(spalten_std) + 1):
        ws_std.column_dimensions[get_column_letter(col_idx)].width = 22

    ws_det = wb.create_sheet("Zuordnung")
    spalten_det = [
        "Standard",
        "Artikelnummer",
        "Original Länge",
        "Original Breite",
        "Anzahl",
    ]
    ws_det.append(spalten_det)
    for col, _ in enumerate(spalten_det, start=1):
        c = ws_det.cell(row=1, column=col)
        c.fill = header_fill
        c.font = header_font
        c.alignment = Alignment(horizontal="center")

    for s in ergebnis.standards:
        for m in s.members:
            ws_det.append(
                [s.label, m.artikelnummer, m.laenge, m.breite, m.anzahl]
            )
    for col_idx in range(1, len(spalten_det) + 1):
        ws_det.column_dimensions[get_column_letter(col_idx)].width = 22

    if ergebnis.kombinationen:
        ws_kombi = wb.create_sheet("Kombinationen")
        spalten_kombi = [
            "Artikelnummer",
            "Original Länge",
            "Original Breite",
            "Standard A",
            "Standard B",
        ]
        ws_kombi.append(spalten_kombi)
        for col, _ in enumerate(spalten_kombi, start=1):
            c = ws_kombi.cell(row=1, column=col)
            c.fill = header_fill
            c.font = header_font
        for k in ergebnis.kombinationen:
            ws_kombi.append(
                [
                    k.palette.artikelnummer,
                    k.palette.laenge,
                    k.palette.breite,
                    k.standard_a.label,
                    k.standard_b.label,
                ]
            )
        for col_idx in range(1, len(spalten_kombi) + 1):
            ws_kombi.column_dimensions[get_column_letter(col_idx)].width = 22

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def erstelle_beispiel_excel(pfad: str | Path, n_artikel: int = 80) -> Path:
    """Erzeugt eine realistische Beispiel-Palettenliste.

    Die Größen werden aus einigen Cluster-Zentren mit ±20mm Rauschen gezogen,
    sodass die Optimierung sinnvolle Standards finden kann.
    """
    rnd = random.Random(42)
    cluster: list[tuple[float, float]] = [
        (1500, 700),
        (1800, 1000),
        (1200, 800),
        (1600, 800),
        (2000, 1200),
        (1000, 600),
    ]

    rows: list[tuple[str, int, int, int, int, float]] = []
    for i in range(n_artikel):
        c = rnd.choice(cluster)
        l = c[0] + rnd.randint(-20, 20)
        b = c[1] + rnd.randint(-15, 15)
        anzahl = rnd.randint(5, 50)
        stueck = rnd.choice([20, 25, 30, 40, 50])
        kosten_alt = round(rnd.uniform(12.0, 16.0), 2)
        artnr = f"ART-{1000 + i:04d}"
        rows.append((artnr, int(l), int(b), anzahl, stueck, kosten_alt))

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Palettenliste"

    header = [
        "Artikelnummer",
        "Laenge",
        "Breite",
        "Benoetigte_Paletten",
        "Stueckzahl_pro_Palette",
        "Palettenkosten",
    ]
    ws.append(header)

    header_fill = PatternFill("solid", fgColor="1A2944")
    header_font = Font(color="FFFFFF", bold=True)
    for col_idx, _ in enumerate(header, start=1):
        c = ws.cell(row=1, column=col_idx)
        c.fill = header_fill
        c.font = header_font
        c.alignment = Alignment(horizontal="center")
        ws.column_dimensions[get_column_letter(col_idx)].width = 22

    for r in rows:
        ws.append(list(r))

    pfad = Path(pfad)
    pfad.parent.mkdir(parents=True, exist_ok=True)
    wb.save(pfad)
    return pfad


def paletten_aus_iterable(
    eintraege: Iterable[dict],
    default_kosten: float = 14.0,
) -> list[Palette]:
    """Hilfsfunktion: erzeugt Paletten aus einer Liste von Dicts."""
    out: list[Palette] = []
    for e in eintraege:
        try:
            out.append(
                Palette(
                    artikelnummer=str(e["artikelnummer"]),
                    laenge=float(e["laenge"]),
                    breite=float(e["breite"]),
                    anzahl=int(e.get("anzahl", 1)),
                    kosten_alt=float(e.get("kosten_alt", default_kosten)),
                    stueck_pro_palette=int(e.get("stueck_pro_palette", 0)),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    return out
