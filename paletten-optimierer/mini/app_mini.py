"""Paletten Mini — Streamlit-App.

Optisch identisch zur Hauptapp (gleiches Branding, gleicher Flow:
Import → Einstellungen → Optimierung → Ergebnisse), aber funktional
auf Import + Optimierung reduziert.

Nutzt den verifizierten ``optimierer_kern`` (ILP via pulp+CBC),
KEINE Logik der alten Hauptapp.
"""
from __future__ import annotations

import io
import json
import sys
from html import escape
from pathlib import Path

import pandas as pd
import streamlit as st

HIER = Path(__file__).resolve().parent
if str(HIER) not in sys.path:
    sys.path.insert(0, str(HIER))

from import_excel import importiere  # noqa: E402
from optimierer_kern import optimiere  # noqa: E402
from _ui_chrome import (  # noqa: E402
    inject_css, topbar, step_indicator, card_open, card_close,
    disabled_feature, sidebar_brand, sidebar_section, sidebar_disabled_item,
    PRIMARY_LIGHT,
)


st.set_page_config(
    page_title="Youman Mini",
    page_icon="📦",
    layout="wide",
    initial_sidebar_state="expanded",
)
inject_css()


# ---------------------------------------------------------------------------
# Selbsttest-Status laden (vom CI-Lauf geschrieben).
# ---------------------------------------------------------------------------
def _lade_selbsttest_status() -> dict | None:
    kandidaten = [
        Path(__file__).resolve().parent / "selbsttest_status.json",
    ]
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        kandidaten.append(Path(meipass) / "selbsttest_status.json")
    for p in kandidaten:
        if p.exists():
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except Exception:
                return None
    return None


def selbsttest_banner() -> None:
    """Zeigt OBEN das Resultat des CI-Selbsttests:
    - passed=true  → kleines grünes Badge
    - passed=false → grosses rotes Banner mit Abweichungs-Hinweis
    - kein Status  → grauer Hinweis (dev-Build)
    """
    s = _lade_selbsttest_status()
    if s is None:
        st.markdown(
            '<div style="background:#f3f4f6;border:1px solid #e5e7eb;'
            'color:#6b7280;padding:6px 12px;border-radius:6px;'
            'font-size:12px;margin-bottom:10px;">'
            'ℹ️ Selbsttest-Status nicht verfügbar (Dev-Build).'
            '</div>',
            unsafe_allow_html=True,
        )
        return
    if s.get("passed"):
        sha = s.get("kern_sha", "?")
        st.markdown(
            f'<div style="background:#dcfce7;border:1px solid #86efac;'
            f'color:#166534;padding:6px 12px;border-radius:6px;'
            f'font-size:12px;margin-bottom:10px;font-weight:600;">'
            f'✓ Selbsttest bestanden — Soll-Logik verifiziert '
            f'({s["passed_count"]}/{s["total"]} Asserts · '
            f'Kern SHA {escape(sha)} · '
            f'{escape(s.get("timestamp", ""))}).'
            f'</div>',
            unsafe_allow_html=True,
        )
        return
    # Rot
    fails = s.get("failures") or []
    fail_html = "".join(
        f'<div style="font-size:11px;margin-top:4px;'
        f'font-family:ui-monospace,SF Mono,Menlo,monospace;'
        f'background:rgba(255,255,255,0.18);padding:4px 8px;'
        f'border-radius:4px;">• {escape(str(f))}</div>'
        for f in fails
    )
    st.markdown(
        f'<div style="background:#dc2626;color:#fff;padding:14px 18px;'
        f'border-radius:8px;margin-bottom:14px;font-size:14px;'
        f'box-shadow:0 4px 12px rgba(220,38,38,0.25);">'
        f'<div style="font-weight:800;font-size:16px;">'
        f'⚠ UNGEPRÜFTE VERSION — Optimierung NICHT verifiziert'
        f'</div>'
        f'<div style="margin-top:6px;">Zahlen können falsch sein. '
        f'<b>NICHT für Kunden verwenden.</b> '
        f'{s["passed_count"]}/{s["total"]} Asserts bestanden.</div>'
        f'{fail_html}'
        f'</div>',
        unsafe_allow_html=True,
    )


# ---------------------------------------------------------------------------
# Session-State
# ---------------------------------------------------------------------------
def init_state() -> None:
    defaults = {
        "datei_name": "",
        "import_dat": None,        # dict aus import_excel.importiere
        "params": {                # Optimierungs-Parameter
            "tol_mm": 100,
            "kombi_max": 2,        # Default 2 = schnell; 3 dauert deutlich länger
            "coverage": "einseitig",  # physisch korrekt: Standard >= Auftrag
            "sonder_deckel_aktiv": False,
            "sonder_deckel": 1,
        },
        "ergebnis": None,
        "seite": "Datenimport",
    }
    for k, v in defaults.items():
        st.session_state.setdefault(k, v)


init_state()


def aktiver_schritt() -> int:
    if st.session_state.import_dat is None:
        return 1
    if st.session_state.ergebnis is None:
        return 2 if st.session_state.seite == "Einstellungen" else 3
    return 4


# ---------------------------------------------------------------------------
# Sidebar — Navigation (identische Optik zur Hauptapp; nicht-verfügbare
# Punkte sichtbar deaktiviert).
# ---------------------------------------------------------------------------
with st.sidebar:
    sidebar_brand()

    sidebar_section("Workflow")
    seite_neu = st.radio(
        "Seite",
        ["Datenimport", "Einstellungen", "Optimierung", "Ergebnisse"],
        index=["Datenimport", "Einstellungen", "Optimierung", "Ergebnisse"].index(
            st.session_state.seite
        ),
        label_visibility="collapsed",
    )
    if seite_neu != st.session_state.seite:
        st.session_state.seite = seite_neu
        st.rerun()

    sidebar_section("Nicht in dieser Version")
    for nicht in ["Dashboard", "Bestand & Disposition", "Bestellungen",
                  "Kostenanalyse", "Stammdaten", "Berichte", "Einstellungen (App)"]:
        sidebar_disabled_item(nicht)


# ---------------------------------------------------------------------------
# Top-Header — identisch zur Hauptapp
# ---------------------------------------------------------------------------
selbsttest_banner()
topbar("Youman Mini", "Industriepaletten · Standardisierung")
step_indicator(aktiver_schritt())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _label(masse) -> str:
    if masse is None:
        return "—"
    if isinstance(masse, list):
        return " + ".join(_label(m) for m in masse)
    L, B = masse
    return f"{int(round(L))} × {int(round(B))} mm"


def _fmt_int(n) -> str:
    return f"{int(n):,}".replace(",", ".")


# ---------------------------------------------------------------------------
# Seite 1: Datenimport
# ---------------------------------------------------------------------------
def seite_datenimport() -> None:
    card_open("Datenimport")
    up = st.file_uploader("Excel-Datei (.xlsx)", type=["xlsx"], key="up_d")
    cols = st.columns(2)
    if cols[0].button("📥 Importieren", use_container_width=True, type="primary",
                       disabled=up is None):
        roh = up.read()
        with st.spinner(f"Lese {up.name} ({len(roh) / 1024:.0f} KB) ..."):
            dat = importiere(io.BytesIO(roh))
        st.session_state.datei_name = up.name
        st.session_state.import_dat = dat
        st.session_state.ergebnis = None
        st.session_state.seite = "Einstellungen"
        st.rerun()
    cols[1].markdown(
        '<div style="opacity:0.55;padding-top:6px;font-size:12px;">'
        '🔒 Beispieldaten in Mini-Version nicht enthalten</div>',
        unsafe_allow_html=True,
    )
    card_close()

    dat = st.session_state.import_dat
    if dat is None:
        return

    # Diagnose-Box (Mini-Version, gleiches Design wie große App)
    mit_n = len(dat["mit_mass"])
    ohne_n = len(dat["ohne_mass"])
    paletten_summe = sum(p["anzahl"] for p in dat["mit_mass"])
    st.markdown(
        f'<div class="diag-box">'
        f'<div class="title">📊 Import-Diagnose</div>'
        f'<div><b>Datei:</b> {escape(st.session_state.datei_name)}</div>'
        f'<div><b>Header in Datei-Zeile:</b> {dat["header_zeile"]}</div>'
        f'<div><b>Aufträge mit Maß:</b> {mit_n} · '
        f'<b>ohne Maß:</b> {ohne_n} · '
        f'<b>Paletten gesamt:</b> {paletten_summe}</div>'
        f'</div>',
        unsafe_allow_html=True,
    )

    if ohne_n:
        with st.expander(f"⚠️ {ohne_n} Aufträge ohne gültiges Maß (Bucket 'Maß fehlt')"):
            df = pd.DataFrame(dat["ohne_mass"])
            st.dataframe(df, use_container_width=True, hide_index=True)

    if mit_n:
        card_open(f"Importierte Aufträge ({mit_n})")
        # Bei sehr großen Dateien Vorschau begrenzen — die volle Liste
        # fließt unverändert in die Optimierung.
        if mit_n > 500:
            df = pd.DataFrame(dat["mit_mass"][:500])
            st.caption(f"Vorschau: erste 500 von {mit_n} Aufträgen.")
        else:
            df = pd.DataFrame(dat["mit_mass"])
        st.dataframe(df, use_container_width=True, hide_index=True, height=380)
        card_close()


# ---------------------------------------------------------------------------
# Seite 2: Einstellungen
# ---------------------------------------------------------------------------
def seite_einstellungen() -> None:
    if st.session_state.import_dat is None:
        st.info("Erst Daten importieren.")
        return

    col_l, col_r = st.columns([1, 1])
    p = st.session_state.params
    with col_l:
        card_open("Toleranz")
        p["tol_mm"] = st.number_input(
            "Toleranz (mm)", min_value=0, max_value=2000,
            value=int(p["tol_mm"]), step=10, key="tol_mm_in",
        )
        p["coverage"] = st.radio(
            "Coverage-Modus",
            ["einseitig", "zweiseitig"],
            index=0 if p["coverage"] == "einseitig" else 1,
            horizontal=True, key="cov_in",
            help=("einseitig (Default, physisch korrekt): Standard ≥ Auftrag "
                  "in beiden Dimensionen, Differenz ≤ tol. Last passt immer drauf.\n"
                  "zweiseitig: |S − A| ≤ tol je Dimension — Standard darf auch "
                  "KLEINER sein als Auftrag, Last hängt dann über. "
                  "Mathematisch optimaler (weniger Standards), physisch riskant."),
        )
        card_close()

        card_open("Sonder-Budget")
        p["sonder_deckel_aktiv"] = st.toggle(
            "Sonder-Deckel aktiv", value=p["sonder_deckel_aktiv"], key="sd_a",
        )
        if p["sonder_deckel_aktiv"]:
            p["sonder_deckel"] = st.number_input(
                "max. verschiedene Sonder-Maße",
                min_value=0, max_value=200, value=int(p["sonder_deckel"]),
                step=1, key="sd_n",
            )
        else:
            st.caption("Kein Deckel — Optimierer entscheidet zwischen Standard und Sonder rein nach Minimierung.")
        card_close()

    with col_r:
        card_open("Kombinationen")
        p["kombi_max"] = st.selectbox(
            "kombi_max",
            options=[1, 2, 3],
            index=[1, 2, 3].index(int(p["kombi_max"])),
            key="km_in",
            help=("1 = nur Einzel-Standards · 2 = zusätzlich 2-fach · "
                  "3 = zusätzlich 3-fach (längs/quer aneinandergestellt)."),
        )
        card_close()

        card_open("In der Mini-Version nicht verfügbar")
        for feat in [
            "Wirtschaftlichkeits-Optimierung",
            "Höhe als 3. Dimension",
            "Lade-Raster",
            "Mengen-Schwelle (bewusst entfernt)",
        ]:
            disabled_feature(feat)
        card_close()

    st.divider()
    if st.button("➡️ Weiter zur Optimierung", type="primary", use_container_width=True):
        st.session_state.seite = "Optimierung"
        st.rerun()


# ---------------------------------------------------------------------------
# Seite 3: Optimierung
# ---------------------------------------------------------------------------
def run_optimierung() -> None:
    p = st.session_state.params
    mit_mass = st.session_state.import_dat["mit_mass"]
    deckel = int(p["sonder_deckel"]) if p["sonder_deckel_aktiv"] else None
    km = int(p["kombi_max"])
    if km >= 3:
        zeit_limit = 30
        hinweis = (f"kombi_max=3 — Solver läuft mit 30s Time-Limit. "
                   f"Liefert bei Timeout die beste bisher gefundene Lösung.")
    else:
        zeit_limit = 15
        hinweis = (f"Solver läuft mit {zeit_limit}s Time-Limit — "
                   f"typischerweise in wenigen Sekunden fertig.")
    with st.spinner(hinweis):
        res = optimiere(
            mit_mass,
            tol_mm=p["tol_mm"], kombi_max=km,
            coverage=p["coverage"], sonder_deckel=deckel,
            zeit_limit_s=zeit_limit,
        )
    st.session_state.ergebnis = res


def seite_optimierung() -> None:
    if st.session_state.import_dat is None:
        st.info("Erst Daten importieren.")
        return
    p = st.session_state.params

    col_l, col_r = st.columns([1, 2])
    with col_l:
        card_open("Aktuelle Parameter")
        st.markdown(
            f"<div style='font-size:13px;color:#374151;line-height:1.8;'>"
            f"<b>tol_mm:</b> {int(p['tol_mm'])}<br>"
            f"<b>kombi_max:</b> {int(p['kombi_max'])}<br>"
            f"<b>coverage:</b> {p['coverage']}<br>"
            f"<b>sonder_deckel:</b> "
            f"{int(p['sonder_deckel']) if p['sonder_deckel_aktiv'] else 'frei'}"
            f"</div>",
            unsafe_allow_html=True,
        )
        card_close()
        if st.button("🔄 Optimieren", type="primary", use_container_width=True):
            run_optimierung()
            st.session_state.seite = "Ergebnisse"
            st.rerun()

    with col_r:
        if st.session_state.ergebnis is None:
            st.info("Auf 'Optimieren' klicken, um den ILP-Solver zu starten.")
        else:
            kpi_uebersicht()


# ---------------------------------------------------------------------------
# Seite 4: Ergebnisse (inkl. KPI-Karten im Stil der Hauptapp)
# ---------------------------------------------------------------------------
def kpi_uebersicht() -> None:
    """KPI-Karten — Headline = GESAMT. Stil identisch zur großen App."""
    res = st.session_state.ergebnis
    dat = st.session_state.import_dat
    if res is None or dat is None:
        return

    st.markdown(
        f'<div style="font-size:18px;font-weight:800;color:{PRIMARY_LIGHT};'
        f'margin-bottom:8px;">Optimierungs-Ergebnis</div>',
        unsafe_allow_html=True,
    )

    paletten_summe = sum(p["anzahl"] for p in dat["mit_mass"])
    n_std = len(res["standards"])
    n_son = len(res["sonder"])
    gesamt = res["gesamt"]

    c1, c2, c3, c4 = st.columns([1.4, 1, 1, 1.2])
    c1.metric(
        "GESAMT (Standards + Sonder)",
        _fmt_int(gesamt),
        help="Standards + verschiedene Sonder-Maße. Das ist die Zielgröße.",
    )
    c2.metric("Standards", _fmt_int(n_std),
              help="Anzahl gewählter Standardpaletten-Maße.")
    c3.metric("Sonder", _fmt_int(n_son),
              help="Anzahl verschiedener Sonder-Maße (Aufträge ohne passenden Standard).")
    c4.metric("Paletten gesamt", _fmt_int(paletten_summe),
              help="Σ der Mengen aller Aufträge mit Maß.")

    # Trade-off-Zeile (wie in der großen App). Kandidaten-Zahl prominent —
    # bei vollem Gitter typisch ~4000-5000, bei reduziertem Set <200.
    p = st.session_state.params
    deckel_text = f"{p['sonder_deckel']}" if p["sonder_deckel_aktiv"] else "frei"
    kand = res["kandidaten"]
    kand_warn = "" if kand >= 1000 else " ⚠️ verdächtig wenig — Kern soll volles Gitter liefern"
    st.markdown(
        f'<div style="background:#f8fafc;border:1px solid #e2e8f0;'
        f'border-radius:6px;padding:8px 12px;margin:8px 0 16px;'
        f'font-size:12px;color:#475569;">'
        f'⚙️ tol_mm={int(p["tol_mm"])} · kombi_max={int(p["kombi_max"])} · '
        f'coverage={p["coverage"]} · sonder_deckel={deckel_text} · '
        f'<b>Kandidaten={kand}</b>{kand_warn} · ILP-Status={res["status"]}'
        f'</div>',
        unsafe_allow_html=True,
    )


def render_zuord_table(res: dict) -> str:
    """Zuordnungstabelle Standard → Mitglieder im Result-Table-Stil
    der Hauptapp (gruppiert, mit Sub-Zeile pro Mitglied)."""
    # Gruppiere Zuordnung nach Ziel + Typ. Wichtig: bei k-Stapelung
    # ist 'ziel' ein einzelnes Tupel, aber 'typ' == 'kombi'.
    gruppen: dict = {}
    for z in res["zuordnung"]:
        ziel = z["ziel"]
        typ = z.get("typ", "")
        if typ == "sonder":
            key = ("sonder", ziel)
        elif typ == "kombi":
            # Stapel-Variante in den Gruppen-Key reinnehmen, damit
            # 2-fach längs und 3-fach quer als getrennte Gruppen erscheinen
            k = z.get("stapel_k", 0)
            r = z.get("stapel_richtung", "")
            key = ("kombi", ziel, k, r)
        else:
            key = ("standard", ziel)
        gruppen.setdefault(key, []).append(z)

    rows = []
    # Sortierung: erst Standards, dann Kombis, dann Sonder; jeweils nach Größe
    sort_key = lambda kv: (
        {"standard": 0, "kombi": 1, "sonder": 2}.get(kv[0][0], 3),
        -sum(m.get("anzahl", 0) for m in kv[1]),
    )
    for key, members in sorted(gruppen.items(), key=sort_key):
        typ_kat = key[0]
        ziel = key[1]
        rs = max(1, len(members))
        gruppe_summe = sum(m.get("anzahl", 0) for m in members)
        for i, m in enumerate(members):
            tds = []
            if i == 0:
                if typ_kat == "kombi":
                    k = key[2] if len(key) > 2 else 0
                    r = key[3] if len(key) > 3 else ""
                    r_text = {"laengs": "längs", "quer": "quer"}.get(r, r)
                    label = (f"{int(round(ziel[0]))} × {int(round(ziel[1]))} mm"
                             f"<div style='font-size:11px;color:#3b82f6;margin-top:2px;'>"
                             f"× {k} ({r_text}) gestapelt</div>")
                    sub = f"{rs} Aufträge · Σ {gruppe_summe} Pal."
                elif typ_kat == "sonder":
                    label = _label(ziel)
                    sub = f"Sonder · Σ {gruppe_summe} Pal."
                else:
                    label = _label(ziel)
                    sub = f"{rs} Aufträge · Σ {gruppe_summe} Pal."
                tds.append(
                    f'<td rowspan="{rs}" class="standard-cell">{label}'
                    f'<div class="sub-line">{sub}</div></td>'
                )
            tds.append(f'<td><div style="font-weight:600;">{escape(m["artikelnummer"])}</div>'
                       f'<div style="font-size:11px;color:#6b7280;margin-top:2px;">'
                       f'{escape(m["name"][:35])}</div></td>')
            tds.append(f'<td style="font-family:ui-monospace,monospace;font-size:12px;">'
                       f'{escape(m["auftrag"])}</td>')
            tds.append(f'<td style="text-align:right;font-weight:700;">'
                       f'{_fmt_int(m.get("anzahl", 0))}</td>')
            tds.append(f'<td>{_label(m["original"])}</td>')
            if typ_kat == "standard":
                tds.append('<td><span class="badge badge-ok">✓ Standard</span></td>')
            elif typ_kat == "kombi":
                tds.append('<td><span class="badge badge-kombi">⚡ Kombination</span></td>')
            else:
                tds.append('<td><span class="badge badge-sonder">○ Sonderpalette</span></td>')
            rows.append("<tr>" + "".join(tds) + "</tr>")

    head = (
        "<thead><tr>"
        "<th>Standard / Sonder (mm)</th>"
        "<th>Artikel / Kunde</th>"
        "<th>Auftrag</th>"
        "<th style='text-align:right;' title=\"Palettenanzahl pro Auftrag = Spalte 'Menge'\">Paletten</th>"
        "<th>Original (mm)</th>"
        "<th>Typ</th>"
        "</tr></thead>"
    )
    return f'<table class="result-tbl">{head}<tbody>{"".join(rows)}</tbody></table>'


def seite_ergebnisse() -> None:
    if st.session_state.ergebnis is None:
        st.info("Erst optimieren.")
        return
    res = st.session_state.ergebnis

    kpi_uebersicht()

    # === Inline-Anpassung: Toleranz + Sonder-Budget direkt hier ändern ===
    # Damit muss der User nicht zurück in "Einstellungen", sondern kann
    # die Stellschrauben am Ergebnis vergleichen.
    card_open("🔁 Parameter anpassen und neu rechnen")
    p = st.session_state.params
    c1, c2, c3, c4, c5 = st.columns([1.2, 1.2, 1.4, 1, 1.4])
    with c1:
        p["tol_mm"] = st.number_input(
            "Toleranz (mm)", min_value=0, max_value=2000,
            value=int(p["tol_mm"]), step=10, key="erg_tol",
        )
    with c2:
        p["kombi_max"] = st.selectbox(
            "kombi_max", [1, 2, 3],
            index=[1, 2, 3].index(int(p["kombi_max"])),
            key="erg_km",
        )
    with c3:
        p["coverage"] = st.radio(
            "Coverage", ["zweiseitig", "einseitig"],
            index=0 if p["coverage"] == "zweiseitig" else 1,
            horizontal=True, key="erg_cov",
        )
    with c4:
        p["sonder_deckel_aktiv"] = st.toggle(
            "Sonder-Deckel", value=p["sonder_deckel_aktiv"], key="erg_sd_a",
        )
    with c5:
        if p["sonder_deckel_aktiv"]:
            p["sonder_deckel"] = st.number_input(
                "max. Sonder", min_value=0, max_value=500,
                value=int(p["sonder_deckel"]), step=1, key="erg_sd_n",
            )
        else:
            st.caption("Sonder unbegrenzt — der Solver entscheidet.")
    if st.button("🔄 Neu optimieren mit diesen Werten",
                 type="primary", use_container_width=True, key="erg_rerun"):
        run_optimierung()
        st.rerun()
    card_close()

    if res["status"] != "Optimal":
        st.warning(f"ILP-Status: {res['status']} — Ergebnis evtl. nicht beweisbar optimal.")

    cl, cr = st.columns([2, 1])
    with cl:
        card_open(f"Detail-Zuordnung — {res['gesamt']} Maße "
                  f"({len(res['standards'])} Std + {len(res['sonder'])} Sonder)")
        st.markdown(
            f'<div style="max-height:560px;overflow:auto;">'
            f'{render_zuord_table(res)}</div>',
            unsafe_allow_html=True,
        )
        card_close()
    with cr:
        card_open("Standards")
        if res["standards"]:
            df = pd.DataFrame(
                [{"L": int(round(s[0])), "B": int(round(s[1]))} for s in res["standards"]]
            )
            st.dataframe(df, use_container_width=True, hide_index=True, height=240)
        card_close()

        card_open("Sonder-Maße")
        if res["sonder"]:
            df = pd.DataFrame(
                [{"L": int(round(s[0])), "B": int(round(s[1]))} for s in res["sonder"]]
            )
            st.dataframe(df, use_container_width=True, hide_index=True, height=200)
        else:
            st.caption("Keine Sonder.")
        card_close()

    # CSV-Export
    rows = []
    for z in res["zuordnung"]:
        rows.append({
            "Auftrag": z["auftrag"],
            "Kunde": z["name"],
            "Artikelnummer": z["artikelnummer"],
            "Paletten (Menge)": z.get("anzahl", 0),
            "Original": _label(z["original"]),
            "Ziel": _label(z["ziel"]),
            "Typ": z["typ"],
        })
    csv = pd.DataFrame(rows).to_csv(index=False, sep=";", encoding="utf-8-sig").encode("utf-8-sig")
    st.download_button(
        "📥 Zuordnung als CSV exportieren",
        data=csv,
        file_name="paletten-mini-zuordnung.csv",
        mime="text/csv",
        use_container_width=True,
    )


# ---------------------------------------------------------------------------
# Page-Router
# ---------------------------------------------------------------------------
SEITEN = {
    "Datenimport":   seite_datenimport,
    "Einstellungen": seite_einstellungen,
    "Optimierung":   seite_optimierung,
    "Ergebnisse":    seite_ergebnisse,
}
SEITEN[st.session_state.seite]()
