"""Streamlit-Dashboard des Paletten-Optimierers.

Polished Dashboard nach Mockup: Sidebar-Navigation mit KPI-Footer,
Step-Indikator, gruppierte Ergebnistabelle, drei Analyse-Karten, Footer
mit Hinweis-Boxen. Berechnungen werden bei jeder Settings-Änderung
nachgezogen und im Session-State zwischengespeichert.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from html import escape
from pathlib import Path
from typing import Any

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from excel_handler import (
    erstelle_beispiel_excel,
    exportiere_ergebnis_excel,
    importiere_excel,
)
from optimizer import (
    KostenParameter,
    OptimierungsErgebnis,
    Palette,
    StandardPalette,
    WirtschaftlichkeitsErgebnis,
    berechne_wirtschaftlichkeit,
    optimiere,
)
from pdf_generator import erstelle_bestellung_pdf
from storage_handler import (
    Bestellung,
    aktualisiere_bestand,
    aktualisiere_bestellstatus,
    berechne_kritische_paletten,
    bewerte_status,
    buche_bestellung_in_bestand,
    fuege_bestellung_hinzu,
    lade_bestand,
    lade_bestellungen,
    setze_sicherheitsbestand_global,
)


st.set_page_config(
    page_title="Paletten Optimierer",
    page_icon="📦",
    layout="wide",
    initial_sidebar_state="expanded",
)


CSS = """
<style>
    /* Reset Streamlit Defaults */
    .stApp { background: #f3f4f6; }
    .block-container { padding-top: 1.2rem; padding-bottom: 2rem; max-width: 100%; }
    header[data-testid="stHeader"] { background: transparent; }
    #MainMenu { visibility: hidden; }
    footer { visibility: hidden; }

    /* Sidebar */
    section[data-testid="stSidebar"] {
        background-color: #1a2944 !important;
        padding-top: 0;
    }
    section[data-testid="stSidebar"] > div {
        padding-top: 0;
    }
    section[data-testid="stSidebar"] * { color: #e2e8f0; }
    section[data-testid="stSidebar"] h1,
    section[data-testid="stSidebar"] h2,
    section[data-testid="stSidebar"] h3 { color: #ffffff !important; }
    section[data-testid="stSidebar"] [data-testid="stRadio"] label,
    section[data-testid="stSidebar"] [data-testid="stRadio"] p {
        color: #cbd5e1 !important;
        font-size: 14px;
        font-weight: 500;
    }
    section[data-testid="stSidebar"] [data-testid="stRadio"] > div { gap: 4px; }
    section[data-testid="stSidebar"] [data-testid="stRadio"] > div > label {
        padding: 9px 12px;
        border-radius: 8px;
        transition: background 0.15s;
        margin: 0;
    }
    section[data-testid="stSidebar"] [data-testid="stRadio"] > div > label:hover {
        background: rgba(255,255,255,0.05);
    }
    section[data-testid="stSidebar"] [data-testid="stRadio"] input:checked + div {
        font-weight: 700;
    }
    section[data-testid="stSidebar"] [data-testid="stRadio"] input:checked ~ div {
        color: #ffffff !important;
    }

    .sidebar-brand {
        display: flex; align-items: center; gap: 10px;
        padding: 18px 16px 22px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        margin-bottom: 12px;
    }
    .sidebar-brand .logo {
        width: 36px; height: 36px; border-radius: 8px;
        background: #fbbf24; color: #1a2944;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px;
    }
    .sidebar-brand .name { color: #ffffff; font-weight: 800; font-size: 16px; line-height: 1.1;}
    .sidebar-brand .sub { color: #94a3b8; font-size: 11px; margin-top: 2px;}

    .sidebar-kpi {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 10px;
        padding: 14px;
        margin: 14px 6px 0;
    }
    .sidebar-kpi .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.6px;}
    .sidebar-kpi .row { display: flex; align-items: center; gap: 12px; margin-top: 8px;}
    .sidebar-kpi .icon-box {
        width: 40px; height: 40px; border-radius: 8px; background: rgba(251,191,36,0.15);
        color: #fbbf24; display:flex; align-items:center; justify-content:center; font-size: 22px;
    }
    .sidebar-kpi .value { font-size: 26px; font-weight: 800; color: #ffffff; line-height: 1;}
    .sidebar-kpi .unit { color: #94a3b8; font-size: 12px; margin-top: 2px;}
    .sidebar-status { margin: 14px 6px 0; }
    .sidebar-status .item {
        display: flex; align-items: center; gap: 10px;
        padding: 7px 8px; font-size: 12px; color: #cbd5e1;
    }
    .sidebar-status .dot {
        width: 9px; height: 9px; border-radius: 50%;
    }
    .sidebar-status .dot.ok { background: #22c55e; }
    .sidebar-status .dot.unter { background: #fbbf24; }
    .sidebar-status .dot.kritisch { background: #ef4444; }
    .sidebar-status .badge-rot {
        background: #ef4444; color: white; font-size: 11px; font-weight: 700;
        padding: 1px 8px; border-radius: 999px; margin-left: auto;
    }

    /* Header */
    .head-row {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 14px;
    }
    .head-title { color: #1a2944; font-size: 20px; font-weight: 800; margin:0;}
    .head-sub { color: #6b7280; font-size: 12px; margin-top: 2px;}

    /* Step Indicator */
    .step-row { display: flex; gap: 0; margin: 4px 0 18px; align-items: center;}
    .step {
        display: flex; align-items: center; gap: 10px;
        background: #ffffff; border: 1px solid #e5e7eb;
        padding: 10px 18px; color: #6b7280; font-size: 13px; font-weight: 600;
        border-radius: 0;
    }
    .step:first-child { border-top-left-radius: 8px; border-bottom-left-radius: 8px;}
    .step:last-child  { border-top-right-radius: 8px; border-bottom-right-radius: 8px;}
    .step + .step { border-left: none; }
    .step .num {
        width: 24px; height: 24px; border-radius: 50%;
        background: #e5e7eb; color: #6b7280; font-size: 12px;
        display: inline-flex; align-items: center; justify-content: center;
        font-weight: 700;
    }
    .step.done .num { background: #22c55e; color: white; }
    .step.done { color: #1a2944; }
    .step.active .num { background: #2563eb; color: white; }
    .step.active { color: #1a2944; background: #eff6ff; border-color: #bfdbfe; }
    .arrow { color: #cbd5e1; padding: 0 6px; font-size: 14px; }

    /* Cards */
    .card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 16px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        margin-bottom: 14px;
    }
    .card h3 {
        color: #1a2944;
        font-size: 14px;
        margin: 0 0 12px 0;
        font-weight: 700;
        text-transform: none;
    }
    .card .sub { color: #6b7280; font-size: 12px; margin-top: 4px;}

    /* File card */
    .file-card { display: flex; align-items: center; gap: 12px; padding: 10px 0; }
    .file-card .icon {
        width: 42px; height: 42px; border-radius: 8px;
        background: #dcfce7; color: #15803d;
        display:flex; align-items:center; justify-content:center; font-weight: 800; font-size: 13px;
    }
    .file-meta { flex: 1; }
    .file-meta .fn { font-weight: 700; color: #1a2944; font-size: 13px; }
    .file-meta .info { color: #6b7280; font-size: 11px; margin-top: 2px;}

    /* Compact rows in cards */
    .row-kv { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;}
    .row-kv .k { color: #6b7280;}
    .row-kv .v { color: #1a2944; font-weight: 600;}

    .lade-box {
        background: #f3f4f6; border-radius: 8px; padding: 12px;
        text-align: center; margin-top: 8px;
    }
    .lade-box .lbl { color: #6b7280; font-size: 11px; }
    .lade-box .val { color: #1a2944; font-size: 18px; font-weight: 800; margin-top: 2px;}

    /* Result table (grouped) */
    .result-tbl { width: 100%; border-collapse: collapse; font-size: 13px;}
    .result-tbl thead th {
        background: #f9fafb; color: #1a2944; font-weight: 700;
        padding: 11px 10px; text-align: left;
        border-bottom: 1px solid #e5e7eb;
        font-size: 12px;
    }
    .result-tbl td {
        padding: 9px 10px; border-bottom: 1px solid #f3f4f6;
        color: #374151;
    }
    .result-tbl tr:hover td { background: #fafbfc; }
    .standard-cell {
        background: #eff6ff !important;
        color: #1d4ed8 !important;
        font-weight: 700;
        text-align: center;
        font-size: 14px;
        vertical-align: middle;
        border-right: 1px solid #e5e7eb;
    }
    .standard-cell .sub-line { font-size: 11px; color: #64748b; font-weight: 500; margin-top: 4px;}
    .badge {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 600;
    }
    .badge-ok { background: #dcfce7; color: #166534; }
    .badge-kombi { background: #fef3c7; color: #92400e; }
    .badge-unter { background: #fef3c7; color: #92400e; }
    .badge-kritisch { background: #fee2e2; color: #991b1b; }

    /* Wirtschaftlichkeits-Tabelle */
    .wirt-tbl { width: 100%; border-collapse: collapse; font-size: 12px;}
    .wirt-tbl thead th {
        color: #6b7280; font-weight: 600; padding: 7px 8px;
        text-align: right; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px;
        border-bottom: 1px solid #e5e7eb;
    }
    .wirt-tbl thead th:first-child { text-align: left; }
    .wirt-tbl td {
        padding: 8px; text-align: right; color: #1a2944; font-weight: 600;
        border-bottom: 1px solid #f3f4f6;
    }
    .wirt-tbl td:first-child { text-align: left; color: #374151; font-weight: 500;}
    .wirt-tbl .pos { color: #16a34a; }
    .wirt-tbl .neg { color: #dc2626; }
    .wirt-tbl tr.gesamt td { font-weight: 800; font-size: 13px;}
    .wirt-summary {
        background: #dcfce7; color: #166534;
        border-radius: 8px; padding: 12px;
        display: flex; justify-content: space-between; align-items: center;
        margin-top: 10px; font-weight: 700;
    }
    .wirt-summary.bad { background: #fee2e2; color: #991b1b; }
    .wirt-summary .v { font-size: 20px; }

    /* Logistik */
    .log-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .log-grid .it { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0;}
    .log-grid .it .l { color: #6b7280; }
    .log-grid .it .v { color: #1a2944; font-weight: 700; }
    .log-grid .it .v.warn { color: #dc2626; }

    /* Chart card */
    .chart-anno {
        background: #dcfce7; color: #166534;
        border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 600;
        text-align: center; margin-top: -10px;
    }

    /* Footer info boxes */
    .info-row { display: grid; grid-template-columns: repeat(4, 1fr) auto; gap: 12px; align-items: stretch; margin-top: 8px; }
    .info-box {
        background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px;
        padding: 14px; display: flex; gap: 12px; align-items: center;
    }
    .info-box .ico {
        width: 38px; height: 38px; border-radius: 8px;
        background: #eff6ff; color: #2563eb;
        display:flex; align-items:center; justify-content:center; font-size: 18px;
    }
    .info-box.warn .ico { background: #fef3c7; color: #b45309; }
    .info-box.info .ico { background: #e0e7ff; color: #4338ca; }
    .info-box.cart .ico { background: #fce7f3; color: #be185d; }
    .info-box .lbl { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px;}
    .info-box .val { font-size: 13px; color: #1a2944; font-weight: 700; margin-top: 2px;}
    .info-box .sub { font-size: 11px; color: #6b7280; margin-top: 1px;}

    /* Override Streamlit button look in select places */
    .stButton > button[kind="primary"] {
        background: #2563eb; color: white; border: none;
        font-weight: 600;
    }
    .stButton > button[kind="secondary"] {
        background: white; color: #1a2944; border: 1px solid #e5e7eb;
        font-weight: 600;
    }
</style>
"""

st.markdown(CSS, unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Session State
# ---------------------------------------------------------------------------

def init_state() -> None:
    defaults: dict[str, Any] = {
        "paletten": [],
        "ergebnis": None,
        "wirtschaftlichkeit": None,
        "tol_einheit": "mm",
        "tol_l": 100.0,
        "tol_b": 100.0,
        "kosten_pro_lkw": 800.0,
        "nutzbare_ladelaenge": 13.6,
        "palettenkosten_neu": 18.0,
        "palettenkosten_alt": 14.0,
        "sicherheitsbestand": 100,
        "kombinieren_erlaubt": True,
        "raster": 50,
        "geplantes_lieferdatum": date.today() + timedelta(days=60),
        "planungs_monate": 2,
        "auftragsnummer": "",
        "kunde": "",
        "firma": "Paletten Optimierer",
        "datei_name": "",
        "datei_zeit": "",
        "nav_seite": "Dashboard",
    }
    for k, v in defaults.items():
        st.session_state.setdefault(k, v)


# ---------------------------------------------------------------------------
# Compute
# ---------------------------------------------------------------------------

def run_optimierung() -> None:
    if not st.session_state.paletten:
        st.session_state.ergebnis = None
        st.session_state.wirtschaftlichkeit = None
        return
    erg = optimiere(
        st.session_state.paletten,
        toleranz_l=st.session_state.tol_l,
        toleranz_b=st.session_state.tol_b,
        einheit=st.session_state.tol_einheit,
        raster=st.session_state.raster,
        kombinieren_erlaubt=st.session_state.kombinieren_erlaubt,
    )
    params = KostenParameter(
        kosten_pro_lkw=st.session_state.kosten_pro_lkw,
        nutzbare_ladelaenge=st.session_state.nutzbare_ladelaenge,
        palettenkosten_neu=st.session_state.palettenkosten_neu,
        palettenkosten_alt_default=st.session_state.palettenkosten_alt,
    )
    wirt = berechne_wirtschaftlichkeit(erg, params)
    st.session_state.ergebnis = erg
    st.session_state.wirtschaftlichkeit = wirt


def aktiver_schritt() -> int:
    if not st.session_state.paletten:
        return 1
    if st.session_state.ergebnis is None:
        return 2
    return 4


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fmt_eur(x: float) -> str:
    s = f"{x:,.2f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".") + " €"


def fmt_int(x: int | float) -> str:
    return f"{int(x):,}".replace(",", ".")


def kosten_pro_lademeter() -> float:
    if st.session_state.nutzbare_ladelaenge <= 0:
        return 0.0
    return st.session_state.kosten_pro_lkw / st.session_state.nutzbare_ladelaenge


# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------

NAV_ITEMS = [
    ("Dashboard", "📊"),
    ("Datenimport", "📥"),
    ("Optimierung", "⚙️"),
    ("Ergebnisse", "✅"),
    ("Bestand & Disposition", "📦"),
    ("Bestellungen", "🛒"),
    ("Kostenanalyse", "💰"),
    ("Einstellungen", "⚡"),
    ("Stammdaten", "📁"),
    ("Berichte", "📄"),
]


def sidebar() -> str:
    with st.sidebar:
        st.markdown(
            """
            <div class="sidebar-brand">
              <div class="logo">📦</div>
              <div>
                <div class="name">Paletten Optimierer</div>
                <div class="sub">Standardisierung &amp; Kostenanalyse</div>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        labels = [f"{ico}  {name}" for name, ico in NAV_ITEMS]
        idx = next(
            (i for i, (n, _) in enumerate(NAV_ITEMS) if n == st.session_state.nav_seite),
            0,
        )
        sel = st.radio(
            "Navigation",
            labels,
            index=idx,
            label_visibility="collapsed",
        )
        st.session_state.nav_seite = NAV_ITEMS[labels.index(sel)][0]

        # KPI-Footer
        bestand = lade_bestand()
        gesamt = sum(int(v.get("menge", 0)) for v in bestand.values())
        cnt_ok = cnt_unter = cnt_krit = 0
        for v in bestand.values():
            s = bewerte_status(int(v.get("menge", 0)), int(v.get("sicherheitsbestand", 100)))
            if s == "ok":
                cnt_ok += 1
            elif s == "unter":
                cnt_unter += 1
            else:
                cnt_krit += 1

        st.markdown(
            f"""
            <div class="sidebar-kpi">
              <div class="label">Aktueller Bestand (gesamt)</div>
              <div class="row">
                <div class="icon-box">📦</div>
                <div>
                  <div class="value">{fmt_int(gesamt)}</div>
                  <div class="unit">Paletten</div>
                </div>
              </div>
            </div>
            <div class="sidebar-status">
              <div class="item"><span class="dot ok"></span>Sicherheitsbestand ok</div>
              <div class="item"><span class="dot unter"></span>Unter Sicherheitsbestand</div>
              <div class="item"><span class="dot kritisch"></span>Kritisch
                {f'<span class="badge-rot">{cnt_krit}</span>' if cnt_krit else ''}
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    return st.session_state.nav_seite


# ---------------------------------------------------------------------------
# Header & Step Indicator
# ---------------------------------------------------------------------------

def header() -> None:
    aktiv = aktiver_schritt()
    schritte = [(1, "Import"), (2, "Einstellungen"), (3, "Optimierung"), (4, "Ergebnisse")]

    parts = []
    for n, name in schritte:
        if n < aktiv:
            cls = "step done"
            num = "✓"
        elif n == aktiv:
            cls = "step active"
            num = str(n)
        else:
            cls = "step"
            num = str(n)
        parts.append(
            f'<div class="{cls}"><span class="num">{num}</span>{name}</div>'
        )
        if n < 4:
            parts.append('<span class="arrow">→</span>')
    step_html = '<div class="step-row">' + "".join(parts) + "</div>"

    col_l, col_r = st.columns([3, 2])
    with col_l:
        st.markdown(step_html, unsafe_allow_html=True)
    with col_r:
        b1, b2 = st.columns(2)
        with b1:
            if st.session_state.ergebnis is not None:
                xlsx = exportiere_ergebnis_excel(st.session_state.ergebnis)
                st.download_button(
                    "📊 Bericht exportieren",
                    data=xlsx,
                    file_name=f"optimierung_{date.today().isoformat()}.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    use_container_width=True,
                )
            else:
                st.button("📊 Bericht exportieren", disabled=True, use_container_width=True)
        with b2:
            if st.session_state.ergebnis is not None:
                pdf = erstelle_bestellung_pdf(
                    st.session_state.ergebnis,
                    st.session_state.geplantes_lieferdatum,
                    firma=st.session_state.firma,
                    auftragsnummer=st.session_state.auftragsnummer,
                    kunde=st.session_state.kunde,
                )
                st.download_button(
                    "🛒 Bestellung erstellen (PDF)",
                    data=pdf,
                    file_name=f"bestellung_{date.today().isoformat()}.pdf",
                    mime="application/pdf",
                    use_container_width=True,
                    type="primary",
                )
            else:
                st.button(
                    "🛒 Bestellung erstellen (PDF)",
                    disabled=True,
                    use_container_width=True,
                    type="primary",
                )


# ---------------------------------------------------------------------------
# Left column cards
# ---------------------------------------------------------------------------

def card_datenimport() -> None:
    with st.container(border=False):
        if st.session_state.datei_name:
            n_artikel = len(st.session_state.paletten)
            st.markdown(
                f"""
                <div class="card">
                  <h3>Datenimport</h3>
                  <div class="file-card">
                    <div class="icon">XLS</div>
                    <div class="file-meta">
                      <div class="fn">{escape(st.session_state.datei_name)}</div>
                      <div class="info">Importiert am: {escape(st.session_state.datei_zeit)}<br/>
                        Gesamt Artikel: {fmt_int(n_artikel)}</div>
                    </div>
                  </div>
                </div>
                """,
                unsafe_allow_html=True,
            )
            with st.expander("Neue Datei importieren", expanded=False):
                upload = st.file_uploader(
                    "Excel-Datei", type=["xlsx"], key="up_dash", label_visibility="collapsed"
                )
                col_a, col_b = st.columns(2)
                if col_a.button("📥 Importieren", use_container_width=True, disabled=upload is None):
                    if upload is not None:
                        try:
                            ps = importiere_excel(upload)
                            st.session_state.paletten = ps
                            st.session_state.datei_name = upload.name
                            st.session_state.datei_zeit = datetime.now().strftime("%d.%m.%Y %H:%M")
                            run_optimierung()
                            st.rerun()
                        except Exception as exc:
                            st.error(f"Import-Fehler: {exc}")
                if col_b.button("📦 Beispieldaten", use_container_width=True):
                    lade_beispiel()
                    st.rerun()
        else:
            st.markdown('<div class="card"><h3>Datenimport</h3>', unsafe_allow_html=True)
            upload = st.file_uploader(
                "Excel-Datei (.xlsx) auswählen oder Beispieldaten laden",
                type=["xlsx"],
                key="up_dash_init",
            )
            col_a, col_b = st.columns(2)
            if col_a.button("📥 Importieren", use_container_width=True, disabled=upload is None):
                if upload is not None:
                    try:
                        ps = importiere_excel(upload)
                        st.session_state.paletten = ps
                        st.session_state.datei_name = upload.name
                        st.session_state.datei_zeit = datetime.now().strftime("%d.%m.%Y %H:%M")
                        run_optimierung()
                        st.rerun()
                    except Exception as exc:
                        st.error(f"Import-Fehler: {exc}")
            if col_b.button("📦 Beispieldaten", use_container_width=True):
                lade_beispiel()
                st.rerun()
            st.markdown("</div>", unsafe_allow_html=True)


def lade_beispiel() -> None:
    pfad = Path("data") / "beispiel_palettenliste.xlsx"
    if not pfad.exists():
        erstelle_beispiel_excel(pfad, 80)
    st.session_state.paletten = importiere_excel(pfad)
    st.session_state.datei_name = pfad.name
    st.session_state.datei_zeit = datetime.now().strftime("%d.%m.%Y %H:%M")
    run_optimierung()


def card_toleranz() -> None:
    st.markdown('<div class="card"><h3>Toleranz Einstellungen</h3>', unsafe_allow_html=True)
    col_l, col_b = st.columns(2)
    suffix = "mm" if st.session_state.tol_einheit == "mm" else "%"
    with col_l:
        st.session_state.tol_l = st.number_input(
            f"Länge Toleranz ({suffix})",
            min_value=0.0,
            value=float(st.session_state.tol_l),
            step=10.0 if suffix == "mm" else 1.0,
            key="tol_l_in",
        )
    with col_b:
        st.session_state.tol_b = st.number_input(
            f"Breite Toleranz ({suffix})",
            min_value=0.0,
            value=float(st.session_state.tol_b),
            step=10.0 if suffix == "mm" else 1.0,
            key="tol_b_in",
        )
    einheit = st.radio(
        "Einheit",
        ["Millimeter", "Prozent"],
        horizontal=True,
        index=0 if st.session_state.tol_einheit == "mm" else 1,
        key="einh_in",
    )
    st.session_state.tol_einheit = "mm" if einheit == "Millimeter" else "prozent"
    st.session_state.kombinieren_erlaubt = st.toggle(
        "Paletten kombinieren erlauben",
        value=st.session_state.kombinieren_erlaubt,
        key="kombi_in",
    )
    st.markdown("</div>", unsafe_allow_html=True)


def card_planung() -> None:
    st.markdown('<div class="card"><h3>Planungszeitraum für Bestellung</h3>', unsafe_allow_html=True)
    monate_label = ["1 Monat", "2 Monate", "3 Monate", "6 Monate", "12 Monate"]
    monate_val = [1, 2, 3, 6, 12]
    idx = monate_val.index(st.session_state.planungs_monate) if st.session_state.planungs_monate in monate_val else 1
    sel = st.selectbox("Zeitraum", monate_label, index=idx, key="plan_in")
    st.session_state.planungs_monate = monate_val[monate_label.index(sel)]
    st.session_state.geplantes_lieferdatum = st.date_input(
        "Bis Datum",
        value=date.today() + timedelta(days=30 * st.session_state.planungs_monate),
        key="lief_in",
    )
    st.markdown("</div>", unsafe_allow_html=True)


def card_kosten() -> None:
    st.markdown('<div class="card"><h3>Kosten &amp; Logistik (optional)</h3>', unsafe_allow_html=True)
    col_l, col_r = st.columns(2)
    with col_l:
        st.session_state.kosten_pro_lkw = st.number_input(
            "Kosten pro LKW (€)",
            min_value=0.0,
            value=float(st.session_state.kosten_pro_lkw),
            step=10.0,
            key="lkw_in",
        )
    with col_r:
        st.session_state.nutzbare_ladelaenge = st.number_input(
            "Nutzbare Ladelänge / LKW (m)",
            min_value=0.1,
            value=float(st.session_state.nutzbare_ladelaenge),
            step=0.1,
            key="lade_in",
        )
    st.markdown(
        f"""
        <div class="lade-box">
          <div class="lbl">Kosten pro Lademeter</div>
          <div class="val">{fmt_eur(kosten_pro_lademeter())} / m</div>
        </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def card_sicherheitsbestand() -> None:
    st.markdown('<div class="card"><h3>Sicherheitsbestand je Palette</h3>', unsafe_allow_html=True)
    st.session_state.sicherheitsbestand = st.number_input(
        "Stück",
        min_value=0,
        value=int(st.session_state.sicherheitsbestand),
        step=10,
        label_visibility="collapsed",
        key="sb_in",
    )
    st.markdown("</div>", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Result table (grouped HTML)
# ---------------------------------------------------------------------------

def render_result_table(erg: OptimierungsErgebnis) -> str:
    rows: list[str] = []
    for std in erg.standards:
        members = std.members
        rs = max(1, len(members))
        for i, m in enumerate(members):
            tds = []
            if i == 0:
                tds.append(
                    f'<td rowspan="{rs}" class="standard-cell">'
                    f'{int(round(std.laenge))} × {int(round(std.breite))}'
                    f'<div class="sub-line">{rs} Artikel · {std.gesamt_anzahl} Stk</div>'
                    f'</td>'
                )
            tds.append(f"<td>{escape(m.artikelnummer)}</td>")
            tds.append(f"<td>{fmt_int(m.anzahl)}</td>")
            tds.append(f"<td>{fmt_int(m.stueck_pro_palette)}</td>")
            tds.append(f"<td>{int(round(m.laenge))} × {int(round(m.breite))}</td>")
            tds.append(
                '<td><span class="badge badge-ok">✓ innerhalb Toleranz</span></td>'
            )
            rows.append("<tr>" + "".join(tds) + "</tr>")

    for k in erg.kombinationen:
        m = k.palette
        std_label = f"{int(round(k.standard_a.laenge))} × {int(round(k.standard_a.breite))} + " \
                    f"{int(round(k.standard_b.laenge))} × {int(round(k.standard_b.breite))}"
        rows.append(
            f"<tr>"
            f'<td class="standard-cell">{std_label}<div class="sub-line">(kombiniert)</div></td>'
            f"<td>{escape(m.artikelnummer)}</td>"
            f"<td>{fmt_int(m.anzahl)}</td>"
            f"<td>{fmt_int(m.stueck_pro_palette)}</td>"
            f"<td>{int(round(m.laenge))} × {int(round(m.breite))}</td>"
            f'<td><span class="badge badge-kombi">⚡ Kombination aus 2 Paletten</span></td>'
            "</tr>"
        )

    head = (
        "<thead><tr>"
        "<th>Neue Standardpalette (mm)</th>"
        "<th>Artikelnummer</th>"
        "<th>Benötigte Paletten</th>"
        "<th>Stückzahl pro Palette</th>"
        "<th>Alte Palettenmaße (mm)</th>"
        "<th>Bemerkung / Hinweis</th>"
        "</tr></thead>"
    )
    return f'<table class="result-tbl">{head}<tbody>{"".join(rows)}</tbody></table>'


def card_ergebnis(erg: OptimierungsErgebnis) -> None:
    st.markdown(
        f'<div class="card"><h3>Optimierungs Ergebnis</h3>{render_result_table(erg)}</div>',
        unsafe_allow_html=True,
    )


# ---------------------------------------------------------------------------
# Three analysis cards
# ---------------------------------------------------------------------------

def card_wirtschaftlichkeit(wirt: WirtschaftlichkeitsErgebnis, n_alt: int, n_neu: int) -> None:
    diff_anz = n_neu - n_alt
    diff_pal = wirt.palettenkosten_neu - wirt.palettenkosten_alt
    diff_log = wirt.logistikkosten_neu - wirt.logistikkosten_alt
    diff_ges = wirt.gesamtkosten_neu - wirt.gesamtkosten_alt
    diff_class = "neg" if diff_ges > 0 else "pos"
    summary_class = "wirt-summary" if wirt.ersparnis >= 0 else "wirt-summary bad"

    def _fmt_diff(x: float, einheit: str = "€") -> str:
        sign = "+" if x > 0 else ""
        if einheit == "€":
            return f"{sign}{fmt_eur(x)}"
        return f"{sign}{int(x):,}".replace(",", ".")

    def _cls(x: float, invertiert: bool = False) -> str:
        if x == 0:
            return ""
        if invertiert:
            return "pos" if x > 0 else "neg"
        return "neg" if x > 0 else "pos"

    html = f"""
    <div class="card">
      <h3>Wirtschaftlichkeitsvergleich (pro Monat)</h3>
      <table class="wirt-tbl">
        <thead><tr><th>Kennzahl</th><th>Aktuell</th><th>Neu</th><th>Differenz</th></tr></thead>
        <tbody>
          <tr>
            <td>Anzahl Palettenvarianten</td>
            <td>{fmt_int(n_alt)}</td>
            <td>{fmt_int(n_neu)}</td>
            <td class="{_cls(diff_anz)}">{_fmt_diff(diff_anz, '')}</td>
          </tr>
          <tr>
            <td>Palettenkosten</td>
            <td>{fmt_eur(wirt.palettenkosten_alt)}</td>
            <td>{fmt_eur(wirt.palettenkosten_neu)}</td>
            <td class="{_cls(diff_pal)}">{_fmt_diff(diff_pal)}</td>
          </tr>
          <tr>
            <td>Logistikkosten</td>
            <td>{fmt_eur(wirt.logistikkosten_alt)}</td>
            <td>{fmt_eur(wirt.logistikkosten_neu)}</td>
            <td class="{_cls(diff_log)}">{_fmt_diff(diff_log)}</td>
          </tr>
          <tr class="gesamt">
            <td>Gesamtkosten</td>
            <td>{fmt_eur(wirt.gesamtkosten_alt)}</td>
            <td>{fmt_eur(wirt.gesamtkosten_neu)}</td>
            <td class="{diff_class}">{_fmt_diff(diff_ges)}</td>
          </tr>
        </tbody>
      </table>
      <div class="{summary_class}">
        <div>{'Ersparnis pro Monat' if wirt.ersparnis >= 0 else 'Mehrkosten pro Monat'}</div>
        <div class="v">{fmt_eur(abs(wirt.ersparnis))}</div>
      </div>
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)


def truck_svg(zusatz_lademeter: float, max_breite: float) -> str:
    if max_breite <= 0:
        max_breite = 13.6
    pct = max(0.0, min(zusatz_lademeter / max_breite, 0.6))
    truck_w = 260
    extra_w = int(truck_w * pct)
    return f"""
    <div style="text-align:center;padding:6px 0;">
      <svg width="320" height="100" viewBox="0 0 320 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="46" width="20" height="34" fill="#1a2944" rx="2"/>
        <rect x="22" y="34" width="{truck_w}" height="46" rx="3" fill="#1a2944" stroke="#0f1a30"/>
        <rect x="26" y="38" width="{truck_w - 8}" height="38" rx="2" fill="#3b4a6b"/>
        <rect x="{22 + truck_w}" y="38" width="{extra_w}" height="38" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="5,3"/>
        <circle cx="50" cy="86" r="9" fill="#374151" stroke="#1f2937" stroke-width="2"/>
        <circle cx="90" cy="86" r="9" fill="#374151" stroke="#1f2937" stroke-width="2"/>
        <circle cx="240" cy="86" r="9" fill="#374151" stroke="#1f2937" stroke-width="2"/>
        <text x="{22 + truck_w + extra_w + 4}" y="32" font-size="10" font-family="Arial" fill="#dc2626" font-weight="700">+{zusatz_lademeter:.2f} m</text>
        <text x="22" y="98" font-size="9" fill="#6b7280">0 m</text>
        <text x="{22 + truck_w - 20}" y="98" font-size="9" fill="#6b7280">{max_breite:.2f} m</text>
      </svg>
    </div>
    """


def card_logistik(wirt: WirtschaftlichkeitsErgebnis) -> None:
    mehrkosten = wirt.logistikkosten_neu - wirt.logistikkosten_alt
    html = f"""
    <div class="card">
      <h3>Logistik Kostenanalyse</h3>
      <div class="log-grid">
        <div class="it"><span class="l">Zusätzlicher Laderaumbedarf</span>
          <span class="v warn">{wirt.zusatz_lademeter:.2f} m</span></div>
        <div class="it"><span class="l">Mehrkosten durch Logistik</span>
          <span class="v">{fmt_eur(abs(mehrkosten))}</span></div>
        <div class="it"><span class="l">Auswirkung auf Versandkosten<br/><span style="font-size:10px;">(pro Monat)</span></span>
          <span class="v warn">+{fmt_eur(abs(mehrkosten))}</span></div>
      </div>
      {truck_svg(wirt.zusatz_lademeter, st.session_state.nutzbare_ladelaenge)}
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)


def kosten_chart(wirt: WirtschaftlichkeitsErgebnis) -> go.Figure:
    monate = [1, 2, 3, 6, 12]
    alt = [wirt.gesamtkosten_alt * m for m in monate]
    neu = [wirt.gesamtkosten_neu * m for m in monate]
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=monate, y=alt, mode="lines+markers", name="Aktuell (individuell)",
        line=dict(color="#2563eb", width=3), marker=dict(size=8),
    ))
    fig.add_trace(go.Scatter(
        x=monate, y=neu, mode="lines+markers", name="Neu (Standardisiert)",
        line=dict(color="#16a34a", width=3), marker=dict(size=8),
    ))
    fig.update_layout(
        height=240,
        margin=dict(l=10, r=10, t=10, b=10),
        plot_bgcolor="#ffffff", paper_bgcolor="#ffffff",
        xaxis=dict(title="", gridcolor="#e5e7eb",
                   tickmode="array", tickvals=monate,
                   ticktext=[f"{m} Monat" if m == 1 else f"{m} Monate" for m in monate]),
        yaxis=dict(title="", gridcolor="#e5e7eb", tickformat=",.0f"),
        legend=dict(orientation="h", y=-0.2, x=0.0, font=dict(size=11)),
        font=dict(size=11),
    )
    return fig


def card_kosten_simulation(wirt: WirtschaftlichkeitsErgebnis) -> None:
    ersparnis_12 = wirt.ersparnis * 12
    farb_klasse = "" if ersparnis_12 >= 0 else "background:#fee2e2;color:#991b1b;"
    titel = "Ersparnis nach 12 Monaten" if ersparnis_12 >= 0 else "Mehrkosten nach 12 Monaten"
    st.markdown('<div class="card"><h3>Kostenentwicklung (Simulation)</h3>', unsafe_allow_html=True)
    st.plotly_chart(kosten_chart(wirt), use_container_width=True, config={"displayModeBar": False})
    st.markdown(
        f"""
        <div style="background:#dcfce7;color:#166534;border-radius:8px;padding:8px 12px;
                    font-size:12px;font-weight:600;text-align:center;margin-top:-8px;{farb_klasse}">
          {titel}: {fmt_eur(abs(ersparnis_12))}
        </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


# ---------------------------------------------------------------------------
# Footer info row
# ---------------------------------------------------------------------------

def footer_info(erg: OptimierungsErgebnis) -> None:
    benoetigt = {s.label: s.gesamt_anzahl for s in erg.standards}
    krit = berechne_kritische_paletten(benoetigt)
    n_kritisch = sum(1 for k in krit if k["status"] in ("unter", "kritisch"))

    bestellungen = lade_bestellungen()
    offen = sum(1 for b in bestellungen if b.status == "offen")
    pdf_text = "PDF erstellt" if offen else "noch keine Bestellung"

    bestand_total = sum(int(v.get("menge", 0)) for v in lade_bestand().values())
    monatsbedarf = sum(s.gesamt_anzahl for s in erg.standards) / max(1, st.session_state.planungs_monate)
    tage_reicht = int(bestand_total / max(1, monatsbedarf) * 30) if monatsbedarf > 0 else 999
    bis_datum = (date.today() + timedelta(days=tage_reicht)).strftime("%d.%m.%Y")

    empfohlen_in = max(0, tage_reicht - 7)

    info_html = f"""
    <div class="info-row">
      <div class="info-box">
        <div class="ico">📅</div>
        <div>
          <div class="lbl">Bestand reicht bis</div>
          <div class="val">{bis_datum}</div>
          <div class="sub">(ca. {tage_reicht} Tage)</div>
        </div>
      </div>
      <div class="info-box warn">
        <div class="ico">⚠️</div>
        <div>
          <div class="lbl">Sicherheitsbestand unterschritten</div>
          <div class="val">{n_kritisch} Palettentypen</div>
        </div>
      </div>
      <div class="info-box info">
        <div class="ico">ℹ️</div>
        <div>
          <div class="lbl">Empfehlung</div>
          <div class="val">Neue Bestellung in: {empfohlen_in} Tagen</div>
        </div>
      </div>
      <div class="info-box cart">
        <div class="ico">🛒</div>
        <div>
          <div class="lbl">Offene Bestellungen</div>
          <div class="val">{offen} Bestellung{'en' if offen != 1 else ''}</div>
          <div class="sub">({pdf_text})</div>
        </div>
      </div>
    </div>
    """
    col_info, col_btn = st.columns([5, 1.2])
    with col_info:
        st.markdown('<div class="card"><h3>Nächste Schritte / Hinweise</h3>' + info_html + '</div>', unsafe_allow_html=True)
    with col_btn:
        st.markdown("<div style='height:36px;'></div>", unsafe_allow_html=True)
        if st.button("🔄 Neue Optimierung starten", use_container_width=True, type="primary"):
            st.session_state.paletten = []
            st.session_state.ergebnis = None
            st.session_state.wirtschaftlichkeit = None
            st.session_state.datei_name = ""
            st.session_state.datei_zeit = ""
            st.rerun()


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

def seite_dashboard() -> None:
    header()

    if not st.session_state.paletten:
        c = st.container()
        c.markdown('<div class="card"><h3>Datenimport</h3>'
                   '<p style="color:#6b7280;font-size:13px;">Lade eine Excel-Datei hoch oder verwende Beispieldaten, '
                   'um zu starten.</p>', unsafe_allow_html=True)
        upload = c.file_uploader("Excel-Datei (.xlsx)", type=["xlsx"], key="up_init")
        col_a, col_b = c.columns(2)
        if col_a.button("📥 Importieren", use_container_width=True, disabled=upload is None):
            if upload is not None:
                try:
                    ps = importiere_excel(upload)
                    st.session_state.paletten = ps
                    st.session_state.datei_name = upload.name
                    st.session_state.datei_zeit = datetime.now().strftime("%d.%m.%Y %H:%M")
                    run_optimierung()
                    st.rerun()
                except Exception as exc:
                    c.error(f"Import-Fehler: {exc}")
        if col_b.button("📦 Beispieldaten laden", use_container_width=True, type="primary"):
            lade_beispiel()
            st.rerun()
        c.markdown("</div>", unsafe_allow_html=True)
        return

    # Re-compute if needed
    if st.session_state.ergebnis is None or st.session_state.wirtschaftlichkeit is None:
        run_optimierung()
    erg = st.session_state.ergebnis
    wirt = st.session_state.wirtschaftlichkeit

    # Main two-column layout
    col_l, col_r = st.columns([1, 2.2])
    with col_l:
        card_datenimport()
        card_toleranz()
        card_planung()
        card_kosten()
        card_sicherheitsbestand()
        if st.button("🔄 Neu optimieren", use_container_width=True, type="primary", key="reopt"):
            run_optimierung()
            st.rerun()
    with col_r:
        # Re-run after potential left-column changes
        run_optimierung()
        erg = st.session_state.ergebnis
        wirt = st.session_state.wirtschaftlichkeit

        card_ergebnis(erg)
        sub_a, sub_b, sub_c = st.columns([1, 1, 1])
        with sub_a:
            card_wirtschaftlichkeit(wirt, n_alt=erg.anzahl_eingabe_typen, n_neu=erg.anzahl_standards)
        with sub_b:
            card_logistik(wirt)
        with sub_c:
            card_kosten_simulation(wirt)

    footer_info(erg)


def seite_datenimport() -> None:
    header()
    st.markdown('<div class="card"><h3>Datenimport</h3>', unsafe_allow_html=True)
    upload = st.file_uploader("Excel-Datei (.xlsx) hochladen", type=["xlsx"], key="up_d")
    col_a, col_b = st.columns(2)
    if col_a.button("📥 Importieren", use_container_width=True, disabled=upload is None):
        if upload is not None:
            ps = importiere_excel(upload)
            st.session_state.paletten = ps
            st.session_state.datei_name = upload.name
            st.session_state.datei_zeit = datetime.now().strftime("%d.%m.%Y %H:%M")
            run_optimierung()
            st.success(f"{len(ps)} Paletten geladen.")
    if col_b.button("📦 Beispieldaten laden", use_container_width=True, type="primary"):
        lade_beispiel()
        st.rerun()
    st.markdown("</div>", unsafe_allow_html=True)

    if st.session_state.paletten:
        df = pd.DataFrame([
            {"Artikelnummer": p.artikelnummer, "Länge (mm)": p.laenge, "Breite (mm)": p.breite,
             "Anzahl": p.anzahl, "Stk/Pal": p.stueck_pro_palette, "Kosten alt (€)": p.kosten_alt}
            for p in st.session_state.paletten
        ])
        st.markdown(f'<div class="card"><h3>Importierte Paletten ({len(df)})</h3>', unsafe_allow_html=True)
        st.dataframe(df, use_container_width=True, hide_index=True, height=420)
        st.markdown("</div>", unsafe_allow_html=True)


def seite_optimierung() -> None:
    header()
    if not st.session_state.paletten:
        st.info("Erst Daten importieren.")
        return
    col_l, col_r = st.columns([1, 2])
    with col_l:
        card_toleranz()
        card_kosten()
        if st.button("🔄 Neu optimieren", use_container_width=True, type="primary"):
            run_optimierung()
            st.rerun()
    with col_r:
        if st.session_state.ergebnis:
            card_ergebnis(st.session_state.ergebnis)


def seite_ergebnisse() -> None:
    header()
    if not st.session_state.ergebnis:
        st.info("Erst optimieren.")
        return
    erg = st.session_state.ergebnis
    wirt = st.session_state.wirtschaftlichkeit
    card_ergebnis(erg)
    a, b, c = st.columns(3)
    with a:
        card_wirtschaftlichkeit(wirt, erg.anzahl_eingabe_typen, erg.anzahl_standards)
    with b:
        card_logistik(wirt)
    with c:
        card_kosten_simulation(wirt)


def seite_bestand() -> None:
    st.markdown('<div class="card"><h3>Bestand pro Palettentyp</h3>', unsafe_allow_html=True)
    benoetigt = {}
    if st.session_state.ergebnis:
        benoetigt = {s.label: s.gesamt_anzahl for s in st.session_state.ergebnis.standards}
    krit = berechne_kritische_paletten(benoetigt)
    if not krit:
        st.info("Noch kein Bestand erfasst.")
    else:
        rows = [{"Typ": k["typ"], "Bestand": k["menge"], "Sicherheit": k["sicherheitsbestand"],
                 "Bedarf": k["benoetigt"], "Zu bestellen": k["zu_bestellen"], "Status": k["status"]}
                for k in krit]
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
    st.markdown("</div>", unsafe_allow_html=True)

    st.markdown('<div class="card"><h3>Bestand pflegen</h3>', unsafe_allow_html=True)
    typ_default = (st.session_state.ergebnis.standards[0].label
                   if st.session_state.ergebnis and st.session_state.ergebnis.standards
                   else "1500 × 700 mm")
    typ = st.text_input("Palettentyp", value=typ_default)
    col1, col2, col3 = st.columns(3)
    menge = col1.number_input("Aktueller Bestand", min_value=0, value=100, step=10)
    sb = col2.number_input("Sicherheitsbestand", min_value=0, value=int(st.session_state.sicherheitsbestand), step=10)
    if col3.button("💾 Speichern", use_container_width=True, type="primary"):
        aktualisiere_bestand(typ, menge=int(menge), sicherheitsbestand=int(sb))
        st.success(f"Bestand für {typ} gespeichert.")
        st.rerun()
    st.markdown("</div>", unsafe_allow_html=True)


def seite_bestellungen() -> None:
    st.markdown('<div class="card"><h3>Bestellhistorie</h3>', unsafe_allow_html=True)
    bestellungen = lade_bestellungen()
    if not bestellungen:
        st.info("Noch keine Bestellungen.")
    else:
        df = pd.DataFrame([
            {"Datum": b.datum[:10], "Auftrag": b.auftragsnummer, "Kunde": b.kunde,
             "Palettentyp": b.palettentyp, "Menge": b.menge,
             "Lieferung": b.geplantes_verbrauchsdatum, "Status": b.status, "ID": b.bestell_id[:8]}
            for b in sorted(bestellungen, key=lambda x: x.datum, reverse=True)
        ])
        st.dataframe(df, use_container_width=True, hide_index=True)
    st.markdown("</div>", unsafe_allow_html=True)

    offen = [b for b in bestellungen if b.status == "offen"]
    if offen:
        st.markdown('<div class="card"><h3>Offene Bestellungen verbuchen</h3>', unsafe_allow_html=True)
        labels = [f"{b.bestell_id[:8]} · {b.palettentyp} · {b.menge} Stk" for b in offen]
        idx = st.selectbox("Wählen", range(len(offen)), format_func=lambda i: labels[i])
        col_v, col_s = st.columns(2)
        if col_v.button("✅ Verbuchen", use_container_width=True, type="primary"):
            buche_bestellung_in_bestand(offen[idx].bestell_id)
            st.rerun()
        if col_s.button("❌ Stornieren", use_container_width=True):
            aktualisiere_bestellstatus(offen[idx].bestell_id, "storniert")
            st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)

    if st.session_state.ergebnis:
        st.markdown('<div class="card"><h3>Neue Bestellung</h3>', unsafe_allow_html=True)
        labels = [s.label for s in st.session_state.ergebnis.standards]
        sel = st.selectbox("Standardpalette", labels)
        c1, c2, c3 = st.columns(3)
        menge = c1.number_input("Menge", min_value=1, value=50, step=10)
        liefer = c2.date_input("Lieferdatum", value=st.session_state.geplantes_lieferdatum)
        auftrag = c3.text_input("Auftragsnummer", value="")
        if st.button("➕ Anlegen", use_container_width=True, type="primary"):
            order = Bestellung.neu(palettentyp=sel, menge=int(menge),
                                   geplantes_verbrauchsdatum=liefer,
                                   auftragsnummer=auftrag, kunde=st.session_state.kunde)
            fuege_bestellung_hinzu(order)
            st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)


def seite_kostenanalyse() -> None:
    if not st.session_state.wirtschaftlichkeit:
        st.info("Erst optimieren.")
        return
    wirt = st.session_state.wirtschaftlichkeit
    erg = st.session_state.ergebnis
    a, b = st.columns(2)
    with a:
        card_wirtschaftlichkeit(wirt, erg.anzahl_eingabe_typen, erg.anzahl_standards)
    with b:
        card_kosten_simulation(wirt)
    card_logistik(wirt)


def seite_einstellungen() -> None:
    st.markdown('<div class="card"><h3>Einstellungen</h3>', unsafe_allow_html=True)
    st.session_state.firma = st.text_input("Firmenname", value=st.session_state.firma)
    st.session_state.kunde = st.text_input("Kunde (Default)", value=st.session_state.kunde)
    st.session_state.auftragsnummer = st.text_input("Auftragsnummer (Default)", value=st.session_state.auftragsnummer)
    st.session_state.palettenkosten_neu = st.number_input(
        "Palettenkosten neu (€)", min_value=0.0, value=float(st.session_state.palettenkosten_neu), step=0.5)
    st.session_state.palettenkosten_alt = st.number_input(
        "Palettenkosten alt (€, Default)", min_value=0.0, value=float(st.session_state.palettenkosten_alt), step=0.5)
    sb = st.number_input("Sicherheitsbestand global", min_value=0,
                         value=int(st.session_state.sicherheitsbestand), step=10)
    if st.button("💾 Speichern", use_container_width=True, type="primary"):
        st.session_state.sicherheitsbestand = int(sb)
        setze_sicherheitsbestand_global(int(sb))
        st.success("Einstellungen gespeichert.")
    st.markdown("</div>", unsafe_allow_html=True)


def seite_stammdaten() -> None:
    st.markdown('<div class="card"><h3>Stammdaten</h3>'
                '<p style="color:#6b7280;font-size:13px;">Hier kannst du Lieferanten, Kunden und '
                'andere Stammdaten pflegen. Aktuell werden Stammdaten direkt in den Bestellungen erfasst.</p>'
                '</div>', unsafe_allow_html=True)


def seite_berichte() -> None:
    st.markdown('<div class="card"><h3>Berichte</h3>', unsafe_allow_html=True)
    if st.session_state.ergebnis is None:
        st.info("Erst optimieren, um Berichte zu erzeugen.")
    else:
        col_a, col_b = st.columns(2)
        xlsx = exportiere_ergebnis_excel(st.session_state.ergebnis)
        col_a.download_button("📊 Excel-Bericht", data=xlsx,
                              file_name=f"bericht_{date.today().isoformat()}.xlsx",
                              mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                              use_container_width=True, type="primary")
        pdf = erstelle_bestellung_pdf(st.session_state.ergebnis,
                                      st.session_state.geplantes_lieferdatum,
                                      firma=st.session_state.firma,
                                      auftragsnummer=st.session_state.auftragsnummer,
                                      kunde=st.session_state.kunde)
        col_b.download_button("📄 PDF-Bestellung", data=pdf,
                              file_name=f"bestellung_{date.today().isoformat()}.pdf",
                              mime="application/pdf",
                              use_container_width=True, type="primary")
    st.markdown("</div>", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    init_state()
    seite = sidebar()
    st.markdown(
        f'<div class="head-row"><div><div class="head-title">{escape(st.session_state.firma)}</div>'
        f'<div class="head-sub">Wirtschaftliche Standardisierung von Industriepaletten</div></div></div>',
        unsafe_allow_html=True,
    )

    if seite == "Dashboard":
        seite_dashboard()
    elif seite == "Datenimport":
        seite_datenimport()
    elif seite == "Optimierung":
        seite_optimierung()
    elif seite == "Ergebnisse":
        seite_ergebnisse()
    elif seite == "Bestand & Disposition":
        seite_bestand()
    elif seite == "Bestellungen":
        seite_bestellungen()
    elif seite == "Kostenanalyse":
        seite_kostenanalyse()
    elif seite == "Einstellungen":
        seite_einstellungen()
    elif seite == "Stammdaten":
        seite_stammdaten()
    elif seite == "Berichte":
        seite_berichte()


if __name__ == "__main__":
    main()
