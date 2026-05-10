"""PDF-Generator für Bestellungen.

Erzeugt eine professionell layoutete Bestell-PDF mit Logo-Kopfzeile,
Bestelltabelle und Detail-Blöcken pro Standardpalette. Verwendet
ReportLab Platypus.
"""
from __future__ import annotations

import io
from datetime import date, datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image as PdfImage,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from optimizer import OptimierungsErgebnis
from storage_handler import berechne_kritische_paletten


def _logo_pfad() -> Path | None:
    base = Path(__file__).resolve().parent
    for c in [base / "assets" / "youman_logo.png", base / "youman_logo.png"]:
        if c.is_file():
            return c
    return None


NAVY = colors.HexColor("#1a2944")
HELLGRAU = colors.HexColor("#f3f4f6")
MITTELGRAU = colors.HexColor("#e5e7eb")
DUNKELGRAU = colors.HexColor("#374151")
GRUEN = colors.HexColor("#16a34a")
ORANGE = colors.HexColor("#f59e0b")
ROT = colors.HexColor("#dc2626")


def _status_farbe(status: str) -> colors.Color:
    return {"ok": GRUEN, "unter": ORANGE, "kritisch": ROT}.get(status, DUNKELGRAU)


def erstelle_bestellung_pdf(
    ergebnis: OptimierungsErgebnis,
    geplantes_datum: date,
    firma: str = "Youman",
    auftragsnummer: str = "",
    kunde: str = "",
) -> bytes:
    """Erzeugt eine Bestell-PDF und liefert sie als Bytes zurück."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="Youman Palettenbestellung",
        author=firma,
    )

    styles = getSampleStyleSheet()
    titel = ParagraphStyle(
        "Titel",
        parent=styles["Heading1"],
        fontSize=22,
        textColor=NAVY,
        spaceAfter=2,
        leading=24,
    )
    subtitel = ParagraphStyle(
        "Sub",
        parent=styles["Normal"],
        fontSize=10,
        textColor=DUNKELGRAU,
        spaceAfter=14,
    )
    h2 = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=NAVY,
        spaceBefore=14,
        spaceAfter=6,
    )
    text = ParagraphStyle(
        "Text",
        parent=styles["Normal"],
        fontSize=9,
        textColor=DUNKELGRAU,
    )

    story: list = []

    logo = _logo_pfad()
    if logo is not None:
        try:
            logo_img = PdfImage(str(logo), width=14 * mm, height=14 * mm, kind="proportional")
            header_table = Table(
                [[logo_img, Paragraph(firma, titel)]],
                colWidths=[18 * mm, None],
            )
            header_table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]))
            story.append(header_table)
        except Exception:
            story.append(Paragraph(firma, titel))
    else:
        story.append(Paragraph(firma, titel))

    meta_parts = [
        f"Erstellt am: {datetime.now().strftime('%d.%m.%Y %H:%M')}",
        f"Geplantes Lieferdatum: {geplantes_datum.strftime('%d.%m.%Y')}",
    ]
    if auftragsnummer:
        meta_parts.append(f"Auftragsnummer: {auftragsnummer}")
    if kunde:
        meta_parts.append(f"Kunde: {kunde}")
    story.append(Paragraph(" &nbsp;|&nbsp; ".join(meta_parts), subtitel))

    story.append(Paragraph("Bestellpositionen", h2))

    benoetigt = {s.label: s.gesamt_anzahl for s in ergebnis.standards}
    krit = {k["typ"]: k for k in berechne_kritische_paletten(benoetigt)}

    header = [
        "Standardpalette",
        "Anzahl Artikel",
        "Benötigt",
        "Bestand",
        "Sicherheits-\nbestand",
        "Zu bestellen",
    ]
    daten: list[list[str]] = [header]
    for s in ergebnis.standards:
        eintrag = krit.get(s.label, {"menge": 0, "sicherheitsbestand": 100})
        bestand = int(eintrag.get("menge", 0))
        sb = int(eintrag.get("sicherheitsbestand", 100))
        zu_best = max(0, s.gesamt_anzahl + sb - bestand)
        daten.append(
            [
                s.label,
                str(len(s.members)),
                str(s.gesamt_anzahl),
                str(bestand),
                str(sb),
                str(zu_best),
            ]
        )

    tabelle = Table(daten, hAlign="LEFT", colWidths=[55 * mm, 25 * mm, 22 * mm, 22 * mm, 25 * mm, 25 * mm])
    style = TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, HELLGRAU]),
            ("LINEBELOW", (0, 0), (-1, 0), 0.6, NAVY),
            ("BOX", (0, 0), (-1, -1), 0.4, MITTELGRAU),
            ("INNERGRID", (0, 0), (-1, -1), 0.2, MITTELGRAU),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]
    )
    daten.append(
        [
            "Summe",
            str(sum(len(s.members) for s in ergebnis.standards)),
            str(sum(s.gesamt_anzahl for s in ergebnis.standards)),
            "",
            "",
            str(
                sum(
                    max(
                        0,
                        s.gesamt_anzahl
                        + int(krit.get(s.label, {}).get("sicherheitsbestand", 100))
                        - int(krit.get(s.label, {}).get("menge", 0)),
                    )
                    for s in ergebnis.standards
                )
            ),
        ]
    )
    style.add("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold")
    style.add("BACKGROUND", (0, -1), (-1, -1), MITTELGRAU)
    style.add("LINEABOVE", (0, -1), (-1, -1), 0.6, NAVY)
    tabelle.setStyle(style)
    story.append(tabelle)

    story.append(Paragraph("Detailzuordnung pro Standardpalette", h2))

    for s in ergebnis.standards:
        story.append(
            Paragraph(
                f"<b>{s.label}</b> &nbsp;·&nbsp; "
                f"{len(s.members)} Artikel &nbsp;·&nbsp; "
                f"{s.gesamt_anzahl} Paletten gesamt",
                ParagraphStyle(
                    "DetailHead",
                    parent=text,
                    fontSize=10,
                    textColor=NAVY,
                    spaceBefore=8,
                    spaceAfter=4,
                ),
            )
        )
        detail_header = [
            "Artikelnummer",
            "Original L (mm)",
            "Original B (mm)",
            "Anzahl",
            "Differenz L",
        ]
        detail_rows: list[list[str]] = [detail_header]
        for m in s.members:
            diff_l = int(round(s.laenge - m.laenge))
            detail_rows.append(
                [
                    m.artikelnummer,
                    str(int(round(m.laenge))),
                    str(int(round(m.breite))),
                    str(m.anzahl),
                    f"+{diff_l}",
                ]
            )
        det_tabelle = Table(
            detail_rows,
            hAlign="LEFT",
            colWidths=[40 * mm, 30 * mm, 30 * mm, 22 * mm, 25 * mm],
        )
        det_tabelle.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), HELLGRAU),
                    ("TEXTCOLOR", (0, 0), (-1, 0), NAVY),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                    ("ALIGN", (0, 0), (0, -1), "LEFT"),
                    ("BOX", (0, 0), (-1, -1), 0.3, MITTELGRAU),
                    ("INNERGRID", (0, 0), (-1, -1), 0.15, MITTELGRAU),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, HELLGRAU]),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        story.append(det_tabelle)

    if ergebnis.kombinationen:
        story.append(Paragraph("Kombinationen (2 Paletten)", h2))
        kombi_rows = [["Artikelnummer", "Original L", "Original B", "Standard A", "Standard B"]]
        for k in ergebnis.kombinationen:
            kombi_rows.append(
                [
                    k.palette.artikelnummer,
                    str(int(k.palette.laenge)),
                    str(int(k.palette.breite)),
                    k.standard_a.label,
                    k.standard_b.label,
                ]
            )
        ktab = Table(
            kombi_rows,
            hAlign="LEFT",
            colWidths=[35 * mm, 25 * mm, 25 * mm, 35 * mm, 35 * mm],
        )
        ktab.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                    ("BOX", (0, 0), (-1, -1), 0.3, MITTELGRAU),
                    ("INNERGRID", (0, 0), (-1, -1), 0.15, MITTELGRAU),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, HELLGRAU]),
                ]
            )
        )
        story.append(ktab)

    story.append(Spacer(1, 12))
    story.append(
        Paragraph(
            "<i>Erzeugt mit Youman.</i>",
            ParagraphStyle(
                "Footer", parent=text, fontSize=8, textColor=DUNKELGRAU
            ),
        )
    )

    doc.build(story)
    return buffer.getvalue()
