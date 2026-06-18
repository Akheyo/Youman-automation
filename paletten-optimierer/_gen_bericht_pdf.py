#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Erzeugt den Projekt- & Preis-Bericht als PDF."""
from fpdf import FPDF

FONT_DIR = "/usr/share/fonts/truetype/dejavu"
ACCENT = (15, 60, 110)      # dunkelblau
ACCENT2 = (0, 120, 90)      # gruen
LIGHT = (240, 244, 248)
GREY = (90, 90, 90)


class PDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("DejaVu", "", 8)
        self.set_text_color(*GREY)
        self.cell(0, 6, "Paletten-Optimierungssoftware – Projekt- & Preisbericht",
                  align="L")
        self.ln(8)

    def footer(self):
        self.set_y(-15)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(*GREY)
        self.cell(0, 10, f"Seite {self.page_no()}", align="C")


pdf = PDF(format="A4")
pdf.set_auto_page_break(auto=True, margin=18)
pdf.add_font("DejaVu", "", f"{FONT_DIR}/DejaVuSans.ttf")
pdf.add_font("DejaVu", "B", f"{FONT_DIR}/DejaVuSans-Bold.ttf")
pdf.add_page()
W = pdf.w - pdf.l_margin - pdf.r_margin


def h1(txt):
    pdf.set_font("DejaVu", "B", 16)
    pdf.set_text_color(*ACCENT)
    pdf.multi_cell(W, 8, txt)
    pdf.ln(2)


def h2(txt):
    pdf.ln(2)
    pdf.set_font("DejaVu", "B", 12)
    pdf.set_text_color(*ACCENT)
    pdf.multi_cell(W, 7, txt)
    pdf.ln(1)


def body(txt):
    pdf.set_font("DejaVu", "", 10.5)
    pdf.set_text_color(30, 30, 30)
    pdf.multi_cell(W, 5.6, txt)
    pdf.ln(1)


def bullet(txt, bold_part=None):
    pdf.set_font("DejaVu", "", 10.5)
    pdf.set_text_color(30, 30, 30)
    x = pdf.get_x()
    pdf.set_text_color(*ACCENT2)
    pdf.cell(5, 5.6, "•")
    pdf.set_text_color(30, 30, 30)
    if bold_part:
        pdf.set_font("DejaVu", "B", 10.5)
        w_b = pdf.get_string_width(bold_part + " ")
        pdf.cell(w_b, 5.6, bold_part + " ")
        pdf.set_font("DejaVu", "", 10.5)
        pdf.multi_cell(W - 5 - w_b, 5.6, txt)
    else:
        pdf.multi_cell(W - 5, 5.6, txt)
    pdf.set_x(x)


def box(lines, fill=LIGHT, accent=ACCENT):
    pad = 4
    lh = 5.8
    inner_w = W - 2 * pad

    def font_for(typ):
        if typ == "b":
            return ("DejaVu", "B", 11)
        return ("DejaVu", "", 10.5)

    # 1) Hoehe vorab exakt messen (dry_run, kein Zeichnen)
    total_h = 2 * pad
    for typ, txt in lines:
        pdf.set_font(*font_for(typ))
        wrapped = pdf.multi_cell(inner_w, lh, txt, dry_run=True, output="LINES")
        total_h += max(1, len(wrapped)) * lh

    # 2) Passt die Box noch auf die Seite? Sonst vorher umbrechen.
    pdf.ln(1)
    if pdf.get_y() + total_h > pdf.h - pdf.b_margin:
        pdf.add_page()
    y0 = pdf.get_y()

    # 3) Rahmen + Fuellung in bekannter Hoehe zeichnen
    pdf.set_fill_color(*fill)
    pdf.set_draw_color(*accent)
    pdf.set_line_width(0.5)
    pdf.rect(pdf.l_margin, y0, W, total_h, style="DF")

    # 4) Text hineinschreiben (Auto-Umbruch aus, da Hoehe garantiert passt)
    pdf.set_auto_page_break(False)
    pdf.set_xy(pdf.l_margin + pad, y0 + pad)
    for typ, txt in lines:
        pdf.set_font(*font_for(typ))
        pdf.set_text_color(*(accent if typ == "b" else (30, 30, 30)))
        pdf.set_x(pdf.l_margin + pad)
        pdf.multi_cell(inner_w, lh, txt)
    pdf.set_auto_page_break(True, margin=18)
    pdf.set_y(y0 + total_h + 2)


# ---------------------------------------------------------------- Titel
pdf.set_fill_color(*ACCENT)
pdf.rect(0, 0, pdf.w, 34, style="F")
pdf.set_xy(pdf.l_margin, 9)
pdf.set_font("DejaVu", "B", 19)
pdf.set_text_color(255, 255, 255)
pdf.cell(0, 9, "Projekt- & Preisbericht")
pdf.set_xy(pdf.l_margin, 19)
pdf.set_font("DejaVu", "", 11)
pdf.cell(0, 7, "Paletten-Optimierungssoftware")
pdf.set_y(42)

# ---------------------------------------------------------------- Ausgangslage
h2("1. Ausgangslage")
body("Beauftragt war eine Software zur Standardisierung von Paletten – also "
     "weniger Varianten, automatische Optimierung innerhalb definierbarer "
     "Toleranzen und eine Wirtschaftlichkeitsbetrachtung.")
body("Dieser Auftrag wurde vollständig umgesetzt: Import, Optimierungslogik, "
     "Toleranzen (mm und %), Kombinations-Funktion, Bestandsführung, "
     "PDF-Bestellungen sowie die komplette Logistikkosten- und "
     "Wirtschaftlichkeitsanalyse sind fertig und getestet.")

# ---------------------------------------------------------------- Extras
h2("2. Geliefert wurde deutlich mehr als beauftragt")
body("Über den vereinbarten Umfang hinaus enthält die Software zahlreiche "
     "Funktionen, die nicht Teil des ursprünglichen Auftrags waren, den "
     "praktischen Nutzen aber erheblich steigern:")
bullet("– Einkaufspreise werden mitgeführt und vergleichbar gemacht.",
       "Lieferantenverwaltung mit Preis-Historie")
bullet("– faktenbasierte Make-or-Buy-Entscheidung.",
       "Bezugskosten-Vergleich Lieferant / Eigenfertigung")
bullet("– zeigt rechtzeitig, welche Paletten knapp werden.",
       "Wiederbeschaffungs-Ampel")
bullet("– Auswirkungen verschiedener Toleranzen auf einen Blick.",
       "Sensitivitäts- & Was-wäre-wenn-Analysen")
bullet("– saubere, nachvollziehbare Datenbasis.",
       "Stammdatenverwaltung & Import-Historie")
bullet("– jede Maß-Änderung wird dokumentiert.", "Audit-Protokoll")
bullet("aller Auswertungen sowie ein Zugangsschutz.", "Excel-Export")
pdf.ln(1)
body("Hinzu kommt eine umfangreiche automatische Qualitätssicherung (über "
     "5.500 Zeilen Testcode), die verlässliche Berechnungen sicherstellt und "
     "dafür sorgt, dass spätere Erweiterungen nichts beschädigen.")

# ---------------------------------------------------------------- Relevanz
h2("3. Warum das relevant ist")
body("Diese Zusatzfunktionen entsprechen noch einmal rund der Hälfte des "
     "Gesamtaufwands. Extern beauftragt lägen allein dafür mehrere tausend "
     "Euro zusätzlich an.")
body("Vor allem aber lösen sie das eigentliche Kernproblem: Die Software "
     "optimiert nicht nur geometrisch, sondern wirtschaftlich. Sie empfiehlt "
     "eine größere Standardpalette nur dann, wenn die Ersparnis die "
     "Mehrkosten übersteigt – und verhindert so den teuren Fehler einer "
     "blinden Über-Standardisierung.")

# ---------------------------------------------------------------- Nutzen
h2("4. Wirtschaftlicher Nutzen")
box([
    ("b", "Über 10.000 € Einsparung in der Beispielrechnung"),
    ("n", "Durch weniger Palettenvarianten sinken die Gesamtkosten deutlich – "
          "bei voller Transparenz über Transport- und Lagereffekte. Die "
          "Investition amortisiert sich damit typischerweise im ersten Jahr."),
], fill=(235, 245, 240), accent=ACCENT2)

# ---------------------------------------------------------------- Preis
pdf.add_page()
h1("Preisempfehlung")
body("Einordnung: Diese Lösung ist kein einfaches Stapel-Tool (Markt: ca. "
     "380–2.500 €), sondern eine vollständige, getestete Logistik- und "
     "Beschaffungsplattform. Eine vergleichbare Individualentwicklung in der "
     "DACH-Region liegt bei 45.000–75.000 €. Das ist der Wert-Anker – nicht "
     "der Verkaufspreis für diesen Auftrag.")

h2("Strategische Lage: Erstauftrag mit Folgepotenzial")
body("Dies ist einer der ersten Aufträge eines jungen Unternehmens – und "
     "voraussichtlich der erste von mehreren bei diesem Kunden, sofern das "
     "Ergebnis überzeugt. Das spricht klar für einen fairen Einstiegspreis: "
     "Er senkt die Hürde für den Kunden, baut Vertrauen auf und öffnet die "
     "Tür für Folgeaufträge, Wartung und Empfehlungen. Der genannte Marktwert "
     "wird transparent gemacht, der Rabatt bewusst als Founding-Kondition "
     "ausgewiesen – so bleibt der Wert sichtbar, ohne sich zu verkaufen.")

h2("Empfohlenes Modell")
box([
    ("b", "Founding-Customer-Preis"),
    ("n", "Marktwert der Lösung: 9.900 €  (Vollpreis-Anker)"),
    ("n", "Einführungspreis für diesen Auftrag:"),
    ("b", "4.500 € einmalig  +  179 €/Monat (Wartung, Updates, Support)"),
    ("n", "Alternativ als Einmalzahlung: 7.500 € inkl. 1 Jahr Support."),
    ("n", "Geliefert wird die Nutzungslizenz – der Quellcode verbleibt beim "
          "Entwickler und kann an weitere Kunden lizenziert werden."),
], fill=LIGHT, accent=ACCENT)

h2("Warum dieses Modell für ein Startup optimal ist")
bullet("statt einmaligem Großbetrag – das schafft Planbarkeit und einen "
       "zweiten, dauerhaften Referenzbeweis.",
       "Wiederkehrender Umsatz")
bullet("statt Code-Verkauf – das Produkt bleibt Kapital und kann an weitere "
       "Paletten- und Logistikfirmen verkauft werden.", "Lizenzmodell")
bullet("senkt die Einstiegshürde beim ersten Kunden und macht den Wert über "
       "den ausgewiesenen Vollpreis trotzdem sichtbar.", "Founding-Rabatt")

h2("Im Gegenzug zum Einstiegspreis")
body("Als Ausgleich zum reduzierten Preis empfiehlt sich, nicht-monetären "
     "Gegenwert zu vereinbaren, der Folgegeschäft bringt:")
bullet("(\"spart uns X € im Jahr\").", "Schriftliche Referenz / Testimonial")
bullet("auf Website und in Angeboten.", "Nennung als Referenzkunde")
bullet("nach 3 Monaten als Grundlage für eine Fallstudie.",
       "Konkrete Einsparzahlen")
bullet("an ein bis zwei weitere Unternehmen im Netzwerk.", "Empfehlung")

# ---------------------------------------------------------------- Fazit
h2("Fazit")
box([
    ("n", "Geliefert wurde nicht ein einfaches Tool, sondern eine vollständige, "
          "getestete Logistik- und Beschaffungsplattform – inklusive "
          "zahlreicher Funktionen über den Auftrag hinaus. Der Founding-Preis "
          "von 4.500 € + 179 €/Monat ist fair für beide Seiten: Er honoriert "
          "den realen Wert, bleibt für einen Erstkunden attraktiv und legt das "
          "Fundament für die nächsten Aufträge."),
], fill=(235, 245, 240), accent=ACCENT2)

pdf.ln(2)
pdf.set_font("DejaVu", "", 8)
pdf.set_text_color(*GREY)
pdf.multi_cell(W, 4.5, "Hinweis: Alle Preis- und Aufwandsangaben sind "
               "marktbasierte Schätzungen und kein verbindliches Gutachten. "
               "Der finale Preis hängt von Zielkunde, Support-Umfang und "
               "Exklusivität ab.")

if __name__ == "__main__":
    import os as _os
    out = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)),
                        "Projekt_und_Preisbericht.pdf")
    pdf.output(out)
    print("PDF erstellt:", out)
