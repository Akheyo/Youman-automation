"""Reine Rendering-Helfer ohne Streamlit-Abhaengigkeit.

Kern-v4-Typen: 'Standard', 'Kombi-Stapel', 'Kombi-Heterogen', 'Sonder'.
Farb-Codes pro Zeile gemaess FINAL-LOCK-Spec:
  Standard         -> gruener Hintergrund (#dcfce7), "✓ Standard"
  Kombi-Stapel     -> hellblau (#eff6ff),         "🔗 Stapel ..."
  Kombi-Heterogen  -> hellblau (#eff6ff),         "🔗 Kombination ..."
  Sonder           -> roter Hintergrund (#fee2e2),"Sonder"
"""
from __future__ import annotations

from html import escape


def fmt_int(n) -> str:
    return f"{int(n):,}".replace(",", ".")


def ziel_label(ziel_str: str) -> str:
    """Schoenes mm-Label fuer Ziel-Strings:
      '1500x720'                -> '1500 × 720 mm'
      '2x (800x1200)'           -> '2x (800 × 1200) mm'
      '400x800 + 800x1200'      -> '400 × 800 + 800 × 1200 mm'
    """
    if "+" in ziel_str:
        return " + ".join(_einzel(t.strip()) for t in ziel_str.split("+")) + " mm"
    if "(" in ziel_str:
        head, rest = ziel_str.split("x ", 1)
        return f"{head}x ({_einzel(rest.strip('()'))}) mm"
    return _einzel(ziel_str) + " mm"


def _einzel(t: str) -> str:
    try:
        a, b = t.split("x")
        return f"{int(a)} × {int(b)}"
    except Exception:
        return t


def _row_bg(typ: str) -> str:
    return {
        "Standard": "#dcfce7",          # gruen
        "Kombi-Stapel": "#eff6ff",      # hellblau
        "Kombi-Heterogen": "#eff6ff",   # hellblau
        "Sonder": "#fee2e2",            # rot
    }.get(typ, "")


def _badge_html(typ: str, ziel_str: str, aus_katalog: bool = False) -> str:
    katalog_badge = ('<span style="margin-left:6px;padding:2px 6px;'
                     'background:#fbbf24;color:#1a2944;font-weight:800;'
                     'border-radius:4px;font-size:10px;" '
                     'title="Maß ist im Palettenkatalog">'
                     'K</span>') if aus_katalog else ""
    if typ == "Standard":
        return ('<span class="badge badge-ok" style="background:#16a34a;'
                f'color:#fff;font-weight:700;">✓ Standard</span>{katalog_badge}')
    if typ == "Kombi-Stapel":
        return (f'<span class="badge badge-kombi" '
                f'style="background:#2563eb;color:#fff;font-weight:800;">'
                f'🔗 Stapel {escape(ziel_str)}</span>{katalog_badge}')
    if typ == "Kombi-Heterogen":
        return (f'<span class="badge badge-kombi" '
                f'style="background:#2563eb;color:#fff;font-weight:800;">'
                f'🔗 Kombination {escape(ziel_str)}</span>{katalog_badge}')
    if typ == "Sonder":
        return ('<span class="badge badge-sonder" '
                'style="color:#fff;background:#dc2626;font-weight:700;">'
                'Sonder</span>')
    return escape(typ)


def render_zuord_table(res: dict, katalog_masse: set | None = None) -> str:
    """Detail-Zuordnungstabelle (HTML).
    Spalten: STANDARD/ZIEL | ARTIKEL/KUNDE | AUFTRAG | PALETTEN |
             LAST (mm) | EXCEL P-LxP-B | TYP

    katalog_masse: optionale Menge von (cs, cl)-Tupeln aus dem
    Katalog. Standards die dort vorkommen bekommen ein K-Badge.
    """
    katalog_masse = katalog_masse or set()
    gruppen: dict[tuple[str, str], list[dict]] = {}
    for z in res["zuordnung"]:
        key = (z.get("typ", "Sonder"), z.get("ziel", ""))
        gruppen.setdefault(key, []).append(z)

    sort_key = lambda kv: (
        {"Standard": 0, "Kombi-Stapel": 1, "Kombi-Heterogen": 2,
         "Sonder": 3}.get(kv[0][0], 9),
        -sum(m.get("menge", 0) for m in kv[1]),
    )

    rows = []
    for (typ, ziel_str), members in sorted(gruppen.items(), key=sort_key):
        rs = max(1, len(members))
        gruppe_summe = sum(m.get("menge", 0) for m in members)
        bg = _row_bg(typ)
        row_cls = {
            "Standard": "row-standard",
            "Kombi-Stapel": "row-kombi",
            "Kombi-Heterogen": "row-kombi",
            "Sonder": "row-sonder",
        }.get(typ, "")
        row_style = f' class="{row_cls}" style="background:{bg};"' if bg else ""

        for i, m in enumerate(members):
            tds = []
            if i == 0:
                label = ziel_label(ziel_str)
                if typ == "Kombi-Stapel":
                    sub = f"Stapelung · {rs} Aufträge · Σ {gruppe_summe} Pal."
                elif typ == "Kombi-Heterogen":
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
            _anr = str(m.get("anr", "") or "").strip()
            _anr_html = (f'<div style="font-size:11px;color:#6b7280;'
                         f'margin-top:2px;">ANr {escape(_anr)}</div>'
                         if _anr else "")
            tds.append(
                f'<td style="font-family:ui-monospace,monospace;font-size:12px;">'
                f'{escape(str(m.get("auftrag", "")))}{_anr_html}</td>'
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
                    f'(vor Abzug Palettenaufschlag 50 mm)">'
                    f'{int(pL)} × {int(pB)}</span>'
                )
            else:
                excel_str = '<span style="color:#9ca3af;">—</span>'
            tds.append(f'<td>{excel_str}</td>')
            # K-Badge nur fuer Einzel-Standards (nicht Kombis/Sonder)
            aus_katalog = False
            if typ == "Standard" and ziel_str:
                try:
                    a, b = ziel_str.split("x")
                    canon = (min(int(a), int(b)), max(int(a), int(b)))
                    aus_katalog = canon in katalog_masse
                except Exception:
                    aus_katalog = False
            tds.append(f'<td>{_badge_html(typ, ziel_str, aus_katalog)}</td>')
            rows.append(f"<tr{row_style}>" + "".join(tds) + "</tr>")

    head = (
        "<thead><tr>"
        "<th>Standard / Ziel (mm)</th>"
        "<th>Artikel / Kunde</th>"
        "<th>Auftrag</th>"
        "<th style='text-align:right;' title=\"Palettenanzahl pro Auftrag = Spalte 'Menge'\">Paletten</th>"
        "<th title=\"Produkt-Maße (was der Optimierer sieht — Excel P-Werte minus Palettenaufschlag)\">Last (mm)</th>"
        "<th title=\"Roh-Werte aus Excel-Spalten P-Länge / P-Breite\">Excel P-L × P-B</th>"
        "<th>Typ</th>"
        "</tr></thead>"
    )
    return f'<table class="result-tbl">{head}<tbody>{"".join(rows)}</tbody></table>'
