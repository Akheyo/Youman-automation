"""Excel-Import für die Mini-App.

Liest .xlsx-Dateien mit:
- dynamischer Header-Erkennung (Zeile mit >=4 der erwarteten Spalten)
- Leerzeilen-Filterung
- Palettenanzahl aus Spalte 'Menge' (NICHT P-Anzahl)
- Trennt Aufträge in:
  * mit gültigem L/B  → optimierbar
  * ohne gültiges L/B → Bucket 'Maß fehlt'
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import IO

import openpyxl


# ---------------------------------------------------------------------
# Domain-Konvention Draht-Müller:
# Die Spalten 'P-Länge' und 'P-Breite' der Excel sind die BENÖTIGTEN
# PALETTEN-Maße (also Außen-Maß der Palette). Das transportierte
# PRODUKT ist in beiden Dimensionen um einen festen Wert KLEINER —
# 50 mm bei Draht-Müller. Der Optimierer arbeitet mit den Produkt-
# Maßen (nicht den Paletten-Maßen).
#
# Wenn ein anderer Kunde keinen 50-mm-Aufschlag nutzt, ist nur
# diese eine Konstante anzupassen.
# ---------------------------------------------------------------------
PALETTEN_AUFSCHLAG_MM = 50


# Erwartete Spalten (deutsch, mit Aliasen). Wert ist eine Liste
# normalisierter Aliase, die alle auf das logische Feld mappen.
SPALTEN = {
    "auftrag":       ["auftrag", "auftragsnummer", "auftrag_nr", "auftrag-nr",
                      "order", "order_no", "ordernumber"],
    "name":          ["name", "kunde", "customer", "abnehmer"],
    "artikelnummer": ["artikelnummer", "artikel", "artikelnr", "artikel-nr",
                      "art-nr", "artnr", "sku", "item", "item number"],
    "laenge":        ["p-laenge", "p-länge", "p_laenge", "p_länge",
                      "p.laenge", "p.länge", "laenge", "länge", "length", "l"],
    "breite":        ["p-breite", "p_breite", "p.breite",
                      "breite", "width", "b", "w"],
    "hoehe":         ["p-hoehe", "p-höhe", "p_hoehe", "p_höhe",
                      "p.hoehe", "p.höhe", "hoehe", "höhe", "height", "h"],
    "menge":         ["menge", "mng", "anzahl", "palettenanzahl",
                      "pallet_count", "pallets", "qty", "quantity"],
}

# Mindestens 4 dieser Felder müssen in der Zeile als Header erkannt
# werden, damit die Zeile als Header gilt.
PFLICHT_AUF_HEADER = {"auftrag", "name", "artikelnummer", "menge",
                       "laenge", "breite", "hoehe"}


def _norm(s) -> str:
    if s is None:
        return ""
    return (str(s).strip().lower()
            .replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
            .replace("ß", "ss").replace("-", "_").replace(" ", "_").replace(".", "_"))


def _mappe_header(header_row: list) -> dict[str, int]:
    norm_row = [_norm(c) for c in header_row]
    mapping: dict[str, int] = {}
    for feld, aliase in SPALTEN.items():
        norm_aliase = {_norm(a) for a in aliase}
        for idx, val in enumerate(norm_row):
            if val in norm_aliase:
                mapping[feld] = idx
                break
    return mapping


def _finde_header_zeile(
    rows: list[tuple],
    scan: int = 25,
    min_treffer: int = 4,
) -> tuple[int, dict[str, int]]:
    """Sucht die Zeile mit den meisten erkannten Spalten — mind. min_treffer."""
    best_idx = -1
    best_mapping: dict[str, int] = {}
    best_count = 0
    for i in range(min(scan, len(rows))):
        mapping = _mappe_header(list(rows[i]))
        relevante = set(mapping) & PFLICHT_AUF_HEADER
        if len(relevante) >= min_treffer and len(relevante) > best_count:
            best_count = len(relevante)
            best_idx = i
            best_mapping = mapping
    return best_idx, best_mapping


def _zahl(v) -> float | None:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    try:
        return float(s.replace(",", "."))
    except (TypeError, ValueError):
        return None


def _str(v) -> str:
    if v is None:
        return ""
    return str(v).strip()


def importiere(file_or_path: str | Path | IO[bytes]) -> dict:
    """Liest Excel, gibt Diagnose + zwei Listen zurück.

    Returns:
        {
            'header_zeile': int (1-basiert) oder None,
            'mapping': dict (Feld → Spalten-Index),
            'mit_mass': list of dicts (auftrag, name, artikelnummer, laenge, breite, hoehe, anzahl),
            'ohne_mass': list of dicts (alle Felder, aber L/B sind None oder 0),
            'datenzeilen_gesamt': int,
        }
    """
    wb = openpyxl.load_workbook(file_or_path, data_only=True, read_only=True)
    try:
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
    finally:
        # WICHTIG: read_only=True haelt einen ZIP-Handle offen.
        # Ohne wb.close() laesst Windows die Datei nicht loeschen
        # (PermissionError [WinError 32]).
        wb.close()

    idx, mapping = _finde_header_zeile(rows)
    if idx < 0:
        return {
            "header_zeile": None,
            "mapping": {},
            "mit_mass": [],
            "ohne_mass": [],
            "datenzeilen_gesamt": 0,
            "fehler": "Header-Zeile mit mindestens 4 bekannten Spalten nicht gefunden.",
        }

    def val(row, feld):
        if feld not in mapping:
            return None
        i = mapping[feld]
        if i >= len(row):
            return None
        return row[i]

    mit_mass = []
    ohne_mass = []
    daten = 0
    for row in rows[idx + 1:]:
        # Leerzeile?
        if all(c is None or _str(c) == "" for c in row):
            continue
        daten += 1
        # P-Länge / P-Breite aus Excel sind PALETTEN-Maße.
        # Produkt = Palette − Aufschlag (Domain-Konvention oben).
        palette_L = _zahl(val(row, "laenge"))
        palette_B = _zahl(val(row, "breite"))
        H = _zahl(val(row, "hoehe")) or 0.0
        anzahl_roh = _zahl(val(row, "menge"))
        # Spec-konform: fehlt die Menge, wird 1 angenommen.
        if anzahl_roh and anzahl_roh > 0:
            anzahl = int(anzahl_roh)
        else:
            anzahl = 1

        # Produkt-Maße berechnen (wenn Palettenmaße vorhanden)
        produkt_L = (palette_L - PALETTEN_AUFSCHLAG_MM) if palette_L else None
        produkt_B = (palette_B - PALETTEN_AUFSCHLAG_MM) if palette_B else None

        eintrag = {
            "auftrag":          _str(val(row, "auftrag")),
            "name":             _str(val(row, "name")),
            "artikelnummer":    _str(val(row, "artikelnummer")),
            # 'laenge' / 'breite' = PRODUKT-Maße (geht in die Optimierung)
            "laenge":           produkt_L,
            "breite":           produkt_B,
            "hoehe":            H,
            "anzahl":           anzahl,
            # Roh-Excel-Werte ZUR ANZEIGE, NICHT zur Optimierung
            "palette_L_excel":  palette_L,
            "palette_B_excel":  palette_B,
        }
        # Gültiges Maß = Produkt L UND Produkt B > 0
        if (produkt_L is not None and produkt_B is not None
                and produkt_L > 0 and produkt_B > 0):
            mit_mass.append(eintrag)
        else:
            # Auch Faelle mit P-L/P-B <= 50 (Aufschlag) landen hier —
            # ein Produkt mit 0 oder negativer Kantenlaenge ist nicht
            # optimierbar.
            ohne_mass.append(eintrag)

    # Diagnose-Aggregate (Spec-Soll-Werte)
    paletten_gesamt = sum(p["anzahl"] for p in mit_mass)
    unique_normalisiert = len({
        (min(p["laenge"], p["breite"]), max(p["laenge"], p["breite"]))
        for p in mit_mass
    })

    return {
        "header_zeile": idx + 1,  # 1-basiert für UI
        "mapping": mapping,
        "mit_mass": mit_mass,
        "ohne_mass": ohne_mass,
        "datenzeilen_gesamt": daten,
        "paletten_gesamt": paletten_gesamt,
        "unique_normalisierte_masse": unique_normalisiert,
    }
