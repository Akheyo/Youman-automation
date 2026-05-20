"""Reine Rendering-Helfer ohne Streamlit-Abhaengigkeit.

Extrahiert aus app_mini.py, damit Tests die Funktionen direkt
aufrufen koennen ohne den Streamlit-Modul-Body von app_mini.py
auszufuehren (der haette st.set_page_config / st.sidebar /
st.markdown-Aufrufe als Side-Effects beim Import — auf
Windows-CI ohne Streamlit-Runtime ein Problem).
"""
from __future__ import annotations

from html import escape


def fmt_int(n) -> str:
    return f"{int(n):,}".replace(",", ".")


def ziel_label(ziel_str: str) -> str:
    """'1500x720' -> '1500 × 720 mm'
    '400x800 + 800x1200' -> '400 × 800 + 800 × 1200 mm'"""
    teile = [t.strip() for t in ziel_str.split("+")]
    schoen = []
    for t in teile:
        try:
            a, b = t.split("x")
            schoen.append(f"{int(a)} × {int(b)}")
        except Exception:
            schoen.append(t)
    return " + ".join(schoen) + " mm"


def render_zuord_table(res: dict) -> str:
    """Zuordnungstabelle (HTML-String).
    Erwartet das Kern-v2-Output-Format mit 'zuordnung'-Liste.
    """
    gruppen: dict[tuple[str, str], list[dict]] = {}
    for z in res["zuordnung"]:
        key = (z.get("typ", "Sonder"), z.get("ziel", ""))
        gruppen.setdefault(key, []).append(z)

    sort_key = lambda kv: (
        {"Standard": 0, "Kombination": 1, "Sonder": 2}.get(kv[0][0], 3),
        -sum(m.get("menge", 0) for m in kv[1]),
    )

    rows = []
    for (typ, ziel_str), members in sorted(gruppen.items(), key=sort_key):
        rs = max(1, len(members))
        gruppe_summe = sum(m.get("menge", 0) for m in members)
        row_style = (
            ' style="background:#eff6ff;"' if typ == "Kombination" else ""
        )
        for i, m in enumerate(members):
            tds = []
            if i == 0:
                label = ziel_label(ziel_str)
                if typ == "Kombination":
                    sub = f"Typ A + Typ B · {rs} Aufträge · Σ {gruppe_summe} Pal."
                elif typ == "Sonder":
                    sub = f"Sonder · Σ {gruppe_summe} Pal."
                else:
                    sub = f"{rs} Aufträge · Σ {gruppe_summe} Pal."
                tds.append(
                    f'<td rowspan="{rs}" class="standard-cell">{label}'
                    f'<div class="sub-line">{sub}</div></td>'
                )
            tds.append(
                f'<td><div style="font-weight:600;">'
                f'{escape(str(m.get("artikelnummer", "")))}</div>'
                f'<div style="font-size:11px;color:#6b7280;margin-top:2px;">'
                f'{escape(str(m.get("name", ""))[:35])}</div></td>'
            )
            tds.append(
                f'<td style="font-family:ui-monospace,monospace;font-size:12px;">'
                f'{escape(str(m.get("auftrag", "")))}</td>'
            )
            tds.append(
                f'<td style="text-align:right;font-weight:700;">'
                f'{fmt_int(m.get("menge", 0))}</td>'
            )
            tds.append(
                f'<td>{int(m.get("L", 0))} × {int(m.get("B", 0))} mm</td>'
            )
            pL = m.get("palette_L_excel")
            pB = m.get("palette_B_excel")
            if pL and pB:
                excel_str = (
                    f'<span style="font-family:ui-monospace,monospace;'
                    f'font-size:11px;color:#6b7280;" '
                    f'title="Roh-Werte aus Excel-Spalten P-Länge / P-Breite '
                    f'(vor Abzug Palettenaufschlag)">'
                    f'{int(pL)} × {int(pB)}</span>'
                )
            else:
                excel_str = '<span style="color:#9ca3af;">—</span>'
            tds.append(f'<td>{excel_str}</td>')
            if typ == "Standard":
                tds.append(
                    '<td><span class="badge badge-ok">✓ Standard</span></td>'
                )
            elif typ == "Kombination":
                tds.append(
                    f'<td><span class="badge badge-kombi" '
                    f'style="font-weight:800;">🔗 Kombination</span>'
                    f'<div style="font-family:ui-monospace,monospace;'
                    f'font-size:11px;color:#1e3a8a;margin-top:3px;">'
                    f'{escape(ziel_label(ziel_str))}</div></td>'
                )
            else:
                tds.append(
                    '<td><span class="badge badge-sonder" '
                    'style="color:#fff;background:#dc2626;'
                    'font-weight:700;">Sonder</span></td>'
                )
            rows.append(f"<tr{row_style}>" + "".join(tds) + "</tr>")

    head = (
        "<thead><tr>"
        "<th>Standard / Sonder / Kombi (mm)</th>"
        "<th>Artikel / Kunde</th>"
        "<th>Auftrag</th>"
        "<th style='text-align:right;' title=\"Palettenanzahl pro Auftrag = Spalte 'Menge'\">Paletten</th>"
        "<th title=\"Produkt-Maße (was der Optimierer sieht — Excel P-Werte minus Palettenaufschlag)\">Last (mm)</th>"
        "<th title=\"Roh-Werte aus Excel-Spalten P-Länge / P-Breite\">Excel P-L × P-B</th>"
        "<th>Typ</th>"
        "</tr></thead>"
    )
    return f'<table class="result-tbl">{head}<tbody>{"".join(rows)}</tbody></table>'
