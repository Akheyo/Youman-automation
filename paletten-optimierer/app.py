"""Youman — Streamlit-Dashboard für Paletten-Standardisierung.

Brandenfreies, professionelles Layout mit Sidebar-Navigation, Step-
Indikator, gruppierter Ergebnistabelle, drei Analyse-Karten und Footer mit
Hinweis-Boxen. Berechnungen werden bei jeder Settings-Änderung
nachgezogen und im Session-State zwischengespeichert.
"""
from __future__ import annotations

import base64
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
    PalettenKalkulation,
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
    filtere_neue_auftraege,
    fuege_bestellung_hinzu,
    lade_bearbeitete_auftraege,
    lade_bestand,
    lade_bestellungen,
    loesche_bearbeitete_auftraege,
    markiere_auftraege_bearbeitet,
    projiziere_bestand,
    setze_sicherheitsbestand_global,
)


APP_NAME = "Youman"
APP_TAGLINE = "Industriepaletten · Standardisierung & Kostenanalyse"
PRIMARY = "#0f1f3d"
PRIMARY_LIGHT = "#1a2944"
ACCENT = "#fbbf24"
BLUE = "#2563eb"
GREEN = "#16a34a"
GRAY_BG = "#f5f6f8"


st.set_page_config(
    page_title=APP_NAME,
    page_icon="📦",
    layout="wide",
    initial_sidebar_state="expanded",
)


# ---------------------------------------------------------------------------
# Logo helpers
# ---------------------------------------------------------------------------

def _logo_path() -> Path | None:
    base = Path(__file__).resolve().parent
    candidates = [
        base / "assets" / "youman_logo.png",
        base / "youman_logo.png",
    ]
    for c in candidates:
        if c.is_file():
            return c
    return None


def logo_base64() -> str | None:
    p = _logo_path()
    if p is None:
        return None
    try:
        return base64.b64encode(p.read_bytes()).decode("ascii")
    except OSError:
        return None


LOGO_B64 = logo_base64()


# ---------------------------------------------------------------------------
# CSS
# ---------------------------------------------------------------------------

CSS = f"""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    html, body, [class*="css"] {{
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }}

    .stApp {{ background: {GRAY_BG}; }}
    .block-container {{ padding-top: 1rem; padding-bottom: 2rem; max-width: 100%; }}
    header[data-testid="stHeader"] {{ background: transparent; height: 0; }}
    #MainMenu, footer {{ visibility: hidden; }}

    /* Sidebar */
    section[data-testid="stSidebar"] {{
        background: linear-gradient(180deg, {PRIMARY} 0%, {PRIMARY_LIGHT} 100%) !important;
        padding-top: 0;
        border-right: 1px solid rgba(0,0,0,0.04);
    }}
    section[data-testid="stSidebar"] > div {{ padding-top: 0; }}
    section[data-testid="stSidebar"] * {{ color: #cbd5e1; }}
    section[data-testid="stSidebar"] h1,
    section[data-testid="stSidebar"] h2,
    section[data-testid="stSidebar"] h3 {{ color: #fff !important; }}

    section[data-testid="stSidebar"] [data-testid="stRadio"] label,
    section[data-testid="stSidebar"] [data-testid="stRadio"] p {{
        color: #cbd5e1 !important;
        font-size: 14px;
        font-weight: 500;
    }}
    section[data-testid="stSidebar"] [data-testid="stRadio"] > div {{ gap: 2px; }}
    section[data-testid="stSidebar"] [data-testid="stRadio"] > div > label {{
        padding: 10px 14px;
        border-radius: 8px;
        margin: 0;
        transition: background 0.15s, color 0.15s;
    }}
    section[data-testid="stSidebar"] [data-testid="stRadio"] > div > label:hover {{
        background: rgba(255,255,255,0.06);
    }}
    section[data-testid="stSidebar"] [data-testid="stRadio"] > div > label:has(input:checked) {{
        background: rgba(251,191,36,0.12);
        border-left: 3px solid {ACCENT};
        padding-left: 11px;
    }}
    section[data-testid="stSidebar"] [data-testid="stRadio"] > div > label:has(input:checked) p {{
        color: #fff !important;
        font-weight: 600;
    }}

    .sidebar-brand {{
        display: flex; align-items: center; gap: 12px;
        padding: 22px 18px 24px 18px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        margin-bottom: 14px;
    }}
    .sidebar-brand img {{ width: 44px; height: 44px; border-radius: 10px; object-fit: contain; background: rgba(255,255,255,0.06); padding: 4px;}}
    .sidebar-brand .name {{
        color: #fff; font-weight: 800; font-size: 22px; line-height: 1; letter-spacing: -0.5px;
    }}
    .sidebar-brand .sub {{
        color: #94a3b8; font-size: 11px; margin-top: 4px; letter-spacing: 0.3px;
    }}

    .sidebar-section-label {{
        font-size: 10px; color: #64748b; font-weight: 700;
        text-transform: uppercase; letter-spacing: 1px;
        padding: 18px 18px 8px;
    }}

    .sidebar-kpi {{
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 12px;
        padding: 14px 16px;
        margin: 10px 12px 0;
    }}
    .sidebar-kpi .label {{ font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px;}}
    .sidebar-kpi .row {{ display: flex; align-items: center; gap: 12px; margin-top: 8px;}}
    .sidebar-kpi .icon-box {{
        width: 42px; height: 42px; border-radius: 10px; background: rgba(251,191,36,0.14);
        color: {ACCENT}; display:flex; align-items:center; justify-content:center; font-size: 22px;
    }}
    .sidebar-kpi .value {{ font-size: 26px; font-weight: 800; color: #fff; line-height: 1;}}
    .sidebar-kpi .unit {{ color: #94a3b8; font-size: 12px; margin-top: 3px;}}
    .sidebar-status {{ margin: 12px 12px 8px; }}
    .sidebar-status .item {{
        display: flex; align-items: center; gap: 10px;
        padding: 6px 4px; font-size: 12px; color: #cbd5e1;
    }}
    .sidebar-status .dot {{ width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;}}
    .sidebar-status .dot.ok {{ background: #22c55e; box-shadow: 0 0 6px #22c55e80;}}
    .sidebar-status .dot.unter {{ background: {ACCENT}; box-shadow: 0 0 6px #fbbf2480;}}
    .sidebar-status .dot.kritisch {{ background: #ef4444; box-shadow: 0 0 6px #ef444480;}}
    .sidebar-status .badge-rot {{
        background: #ef4444; color: #fff; font-size: 11px; font-weight: 700;
        padding: 2px 9px; border-radius: 999px; margin-left: auto;
    }}

    /* Top header */
    .topbar {{
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 14px;
    }}
    .topbar .title {{ color: {PRIMARY_LIGHT}; font-size: 24px; font-weight: 800; line-height: 1; letter-spacing: -0.5px;}}
    .topbar .sub {{ color: #6b7280; font-size: 12px; margin-top: 4px;}}

    /* Step Indicator */
    .step-row {{ display: flex; gap: 0; margin: 4px 0 18px; align-items: stretch;}}
    .step {{
        display: flex; align-items: center; gap: 10px;
        background: #fff; border: 1px solid #e5e7eb;
        padding: 12px 18px; color: #6b7280; font-size: 13px; font-weight: 600;
        flex: 1;
    }}
    .step:first-child {{ border-top-left-radius: 10px; border-bottom-left-radius: 10px;}}
    .step:last-child  {{ border-top-right-radius: 10px; border-bottom-right-radius: 10px;}}
    .step + .step {{ border-left: none; }}
    .step .num {{
        width: 24px; height: 24px; border-radius: 50%;
        background: #e5e7eb; color: #6b7280; font-size: 12px;
        display: inline-flex; align-items: center; justify-content: center;
        font-weight: 700; flex-shrink: 0;
    }}
    .step.done .num {{ background: {GREEN}; color: #fff; }}
    .step.done {{ color: {PRIMARY_LIGHT}; }}
    .step.active .num {{ background: {BLUE}; color: #fff; box-shadow: 0 0 0 4px rgba(37,99,235,0.15);}}
    .step.active {{ color: {PRIMARY_LIGHT}; background: linear-gradient(180deg, #f0f7ff 0%, #fff 100%); border-color: #bfdbfe;}}

    /* Cards */
    .card {{
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 18px;
        box-shadow: 0 1px 3px rgba(15,31,61,0.04), 0 1px 2px rgba(15,31,61,0.06);
        margin-bottom: 14px;
    }}
    .card h3 {{
        color: {PRIMARY_LIGHT};
        font-size: 13px;
        margin: 0 0 14px 0;
        font-weight: 700;
        letter-spacing: 0.2px;
        text-transform: uppercase;
        display: flex; align-items: center; gap: 8px;
    }}
    .card h3::before {{
        content: ''; display: block; width: 3px; height: 14px;
        background: {ACCENT}; border-radius: 2px;
    }}
    .card .sub {{ color: #6b7280; font-size: 12px; margin-top: 4px;}}

    /* File card */
    .file-card {{ display: flex; align-items: center; gap: 12px; padding: 6px 0; }}
    .file-card .icon {{
        width: 44px; height: 44px; border-radius: 10px;
        background: #dcfce7; color: #15803d;
        display:flex; align-items:center; justify-content:center; font-weight: 800; font-size: 12px;
    }}
    .file-meta {{ flex: 1; min-width: 0; }}
    .file-meta .fn {{ font-weight: 700; color: {PRIMARY_LIGHT}; font-size: 13px; word-break: break-all;}}
    .file-meta .info {{ color: #6b7280; font-size: 11px; margin-top: 3px; line-height: 1.4;}}

    .lade-box {{
        background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
        border: 1px solid #e5e7eb;
        border-radius: 10px; padding: 14px;
        text-align: center; margin-top: 10px;
    }}
    .lade-box .lbl {{ color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;}}
    .lade-box .val {{ color: {PRIMARY_LIGHT}; font-size: 20px; font-weight: 800; margin-top: 4px;}}

    /* Result table */
    .result-tbl {{ width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px;}}
    .result-tbl thead th {{
        background: #f9fafb; color: {PRIMARY_LIGHT}; font-weight: 700;
        padding: 12px 12px; text-align: left;
        border-bottom: 2px solid #e5e7eb;
        font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
        position: sticky; top: 0;
    }}
    .result-tbl td {{
        padding: 11px 12px; border-bottom: 1px solid #f3f4f6;
        color: #374151;
    }}
    .result-tbl tbody tr:hover td {{ background: #fafbfc; }}
    .standard-cell {{
        background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%) !important;
        color: #1e40af !important;
        font-weight: 700;
        text-align: center;
        font-size: 14px;
        vertical-align: middle;
        border-right: 1px solid #bfdbfe !important;
    }}
    .standard-cell .sub-line {{ font-size: 11px; color: #3b82f6; font-weight: 500; margin-top: 4px;}}
    .badge {{
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
    }}
    .badge-ok {{ background: #dcfce7; color: #166534; }}
    .badge-kombi {{ background: #fef3c7; color: #92400e; }}

    /* Wirtschaftlichkeits-Tabelle */
    .wirt-tbl {{ width: 100%; border-collapse: collapse; font-size: 12px;}}
    .wirt-tbl thead th {{
        color: #6b7280; font-weight: 600; padding: 8px;
        text-align: right; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
        border-bottom: 1px solid #e5e7eb;
    }}
    .wirt-tbl thead th:first-child {{ text-align: left; }}
    .wirt-tbl td {{
        padding: 9px 8px; text-align: right; color: {PRIMARY_LIGHT}; font-weight: 600;
        border-bottom: 1px solid #f3f4f6;
    }}
    .wirt-tbl td:first-child {{ text-align: left; color: #374151; font-weight: 500;}}
    .wirt-tbl .pos {{ color: {GREEN}; }}
    .wirt-tbl .neg {{ color: #dc2626; }}
    .wirt-tbl tr.gesamt td {{ font-weight: 800; font-size: 13px; padding-top: 12px;}}
    .wirt-summary {{
        background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); color: #166534;
        border-radius: 10px; padding: 13px 16px;
        display: flex; justify-content: space-between; align-items: center;
        margin-top: 14px; font-weight: 700;
    }}
    .wirt-summary.bad {{
        background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #991b1b;
    }}
    .wirt-summary .v {{ font-size: 22px; }}

    /* Logistik */
    .log-grid {{ display: grid; grid-template-columns: 1fr; gap: 8px; }}
    .log-grid .it {{
        display: flex; justify-content: space-between; font-size: 13px;
        padding: 7px 10px; background: #f9fafb; border-radius: 6px;
    }}
    .log-grid .it .l {{ color: #6b7280; }}
    .log-grid .it .v {{ color: {PRIMARY_LIGHT}; font-weight: 700; }}
    .log-grid .it .v.warn {{ color: #dc2626; }}

    /* Footer info boxes */
    .info-row {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }}
    .info-box {{
        background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
        padding: 14px; display: flex; gap: 12px; align-items: center;
        transition: box-shadow 0.15s, transform 0.15s;
    }}
    .info-box:hover {{ box-shadow: 0 4px 12px rgba(15,31,61,0.06); transform: translateY(-1px);}}
    .info-box .ico {{
        width: 40px; height: 40px; border-radius: 10px;
        background: #eff6ff; color: {BLUE};
        display:flex; align-items:center; justify-content:center; font-size: 18px;
        flex-shrink: 0;
    }}
    .info-box.warn .ico {{ background: #fef3c7; color: #b45309; }}
    .info-box.info .ico {{ background: #e0e7ff; color: #4338ca; }}
    .info-box.cart .ico {{ background: #fce7f3; color: #be185d; }}
    .info-box .lbl {{ font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;}}
    .info-box .val {{ font-size: 14px; color: {PRIMARY_LIGHT}; font-weight: 700; margin-top: 3px;}}
    .info-box .sub {{ font-size: 11px; color: #6b7280; margin-top: 2px;}}

    /* Buttons */
    .stButton > button[kind="primary"] {{
        background: {BLUE}; color: #fff; border: none;
        font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }}
    .stButton > button[kind="primary"]:hover {{
        background: #1d4ed8;
        box-shadow: 0 4px 12px rgba(37,99,235,0.25);
    }}
    .stButton > button[kind="secondary"] {{
        background: #fff; color: {PRIMARY_LIGHT}; border: 1px solid #e5e7eb;
        font-weight: 600;
    }}
    .stDownloadButton > button {{
        font-weight: 600; border-radius: 8px;
    }}

    /* Inputs */
    [data-baseweb="input"] > div, [data-baseweb="select"] > div {{
        border-radius: 8px !important;
    }}
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
        "tol_l": 300.0,
        "tol_b": 300.0,
        "tol_h": 200.0,
        "hoehe_aktiv": False,
        "mengen_schwelle": 0,
        "letzte_opt_signatur": "",
        "raster": 100,
        "wirtschaftliche_filterung": False,
        "setup_kosten_pro_standard": 200.0,
        "kalkulation_aktiv": False,
        "kalk_alt_material": 12.0,
        "kalk_alt_fertigung": 6.0,
        "kalk_alt_einkauf": 2.0,
        "kalk_alt_lager": 1.0,
        "kalk_alt_handling": 1.0,
        "kalk_neu_material": 7.0,
        "kalk_neu_fertigung": 4.0,
        "kalk_neu_einkauf": 1.5,
        "kalk_neu_lager": 1.0,
        "kalk_neu_handling": 0.5,
        "ignore_bekannte_auftraege": True,
        "import_neu_count": 0,
        "import_schon_count": 0,
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
        "firma": APP_NAME,
        "datei_name": "",
        "datei_zeit": "",
        "nav_seite": "Dashboard",
    }
    for k, v in defaults.items():
        st.session_state.setdefault(k, v)


# ---------------------------------------------------------------------------
# Compute
# ---------------------------------------------------------------------------

def _opt_signatur() -> str:
    """Eindeutige Signatur der Optimierungs-Inputs für Caching."""
    s = st.session_state
    return "|".join(str(x) for x in [
        len(s.paletten), s.tol_einheit, s.tol_l, s.tol_b, s.raster,
        s.kombinieren_erlaubt, s.wirtschaftliche_filterung,
        s.mengen_schwelle, s.hoehe_aktiv, s.tol_h,
        s.palettenkosten_alt, s.palettenkosten_neu, s.kosten_pro_lkw,
        s.nutzbare_ladelaenge, s.setup_kosten_pro_standard,
        s.kalkulation_aktiv,
        s.kalk_alt_material, s.kalk_alt_fertigung, s.kalk_alt_einkauf,
        s.kalk_alt_lager, s.kalk_alt_handling,
        s.kalk_neu_material, s.kalk_neu_fertigung, s.kalk_neu_einkauf,
        s.kalk_neu_lager, s.kalk_neu_handling,
    ])


def aktuelle_kostenparameter() -> KostenParameter:
    s = st.session_state
    return KostenParameter(
        kosten_pro_lkw=s.kosten_pro_lkw,
        nutzbare_ladelaenge=s.nutzbare_ladelaenge,
        palettenkosten_neu=s.palettenkosten_neu,
        palettenkosten_alt_default=s.palettenkosten_alt,
        setup_kosten_pro_standard=s.setup_kosten_pro_standard,
        kalkulation_neu=PalettenKalkulation(
            aktiv=s.kalkulation_aktiv,
            material=s.kalk_neu_material,
            fertigung=s.kalk_neu_fertigung,
            einkauf=s.kalk_neu_einkauf,
            lager=s.kalk_neu_lager,
            handling=s.kalk_neu_handling,
        ),
        kalkulation_alt=PalettenKalkulation(
            aktiv=s.kalkulation_aktiv,
            material=s.kalk_alt_material,
            fertigung=s.kalk_alt_fertigung,
            einkauf=s.kalk_alt_einkauf,
            lager=s.kalk_alt_lager,
            handling=s.kalk_alt_handling,
        ),
    )


def run_optimierung() -> None:
    if not st.session_state.paletten:
        st.session_state.ergebnis = None
        st.session_state.wirtschaftlichkeit = None
        return
    params = aktuelle_kostenparameter()
    erg = optimiere(
        st.session_state.paletten,
        toleranz_l=st.session_state.tol_l,
        toleranz_b=st.session_state.tol_b,
        einheit=st.session_state.tol_einheit,
        raster=st.session_state.raster,
        kombinieren_erlaubt=st.session_state.kombinieren_erlaubt,
        wirtschaftliche_filterung=st.session_state.wirtschaftliche_filterung,
        kosten_parameter=params,
        mengen_schwelle=int(st.session_state.mengen_schwelle),
        hoehe_aktiv=st.session_state.hoehe_aktiv,
        toleranz_h=st.session_state.tol_h,
    )
    wirt = berechne_wirtschaftlichkeit(erg, params)
    st.session_state.ergebnis = erg
    st.session_state.wirtschaftlichkeit = wirt
    st.session_state.letzte_opt_signatur = _opt_signatur()


def stelle_aktualitaet_sicher() -> None:
    """Re-optimiert wenn sich die Inputs seit dem letzten Lauf geändert haben.

    So bleibt das Ergebnis live und reagiert auf jede Toleranz-Änderung,
    ohne dass der User extra einen Knopf drücken muss.
    """
    if not st.session_state.paletten:
        return
    if _opt_signatur() == st.session_state.get("letzte_opt_signatur", ""):
        return
    try:
        with st.spinner("Optimiere ..."):
            run_optimierung()
    except Exception as exc:  # noqa: BLE001
        st.error(f"⚠️ Optimierung fehlgeschlagen: {exc}")


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


def sidebar_brand_html() -> str:
    if LOGO_B64:
        logo = f'<img src="data:image/png;base64,{LOGO_B64}" alt="{APP_NAME}"/>'
    else:
        logo = (
            f'<div style="width:44px;height:44px;border-radius:10px;background:{ACCENT};'
            f'color:{PRIMARY_LIGHT};display:flex;align-items:center;justify-content:center;'
            f'font-weight:800;font-size:22px;">Y</div>'
        )
    return (
        f'<div class="sidebar-brand">{logo}'
        f'<div><div class="name">{APP_NAME}</div>'
        f'<div class="sub">{APP_TAGLINE}</div></div></div>'
    )


def sidebar() -> str:
    with st.sidebar:
        st.markdown(sidebar_brand_html(), unsafe_allow_html=True)
        st.markdown('<div class="sidebar-section-label">Navigation</div>', unsafe_allow_html=True)
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

        bestand = lade_bestand()
        gesamt = sum(int(v.get("menge", 0)) for v in bestand.values())
        cnt_krit = 0
        for v in bestand.values():
            s = bewerte_status(int(v.get("menge", 0)), int(v.get("sicherheitsbestand", 100)))
            if s == "kritisch":
                cnt_krit += 1

        st.markdown('<div class="sidebar-section-label">Bestand</div>', unsafe_allow_html=True)
        st.markdown(
            f"""
            <div class="sidebar-kpi">
              <div class="label">Gesamt im Lager</div>
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

def topbar() -> None:
    st.markdown(
        f'<div class="topbar"><div><div class="title">{escape(st.session_state.firma)}</div>'
        f'<div class="sub">{APP_TAGLINE}</div></div></div>',
        unsafe_allow_html=True,
    )


def step_action_row() -> None:
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
        parts.append(f'<div class="{cls}"><span class="num">{num}</span>{name}</div>')
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
                    file_name=f"youman_bericht_{date.today().isoformat()}.xlsx",
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
                    file_name=f"youman_bestellung_{date.today().isoformat()}.pdf",
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

def lade_beispiel() -> None:
    pfad = Path(__file__).resolve().parent / "data" / "beispiel_palettenliste.xlsx"
    if not pfad.exists():
        erstelle_beispiel_excel(pfad, 80)
    _importiere_quelle(pfad, pfad.name)


def _importiere_quelle(quelle, anzeigename: str) -> bool:
    """Liest Paletten aus ``quelle`` und löst danach die Optimierung aus.

    Beide Schritte sind in einen Spinner verpackt und mit Try/Except
    geschützt, sodass UI-Hänger sichtbar werden und ein Optimierungs-
    Fehler nicht die bereits geladenen Paletten verwirft.
    """
    try:
        with st.spinner(f"Lese {anzeigename} ..."):
            ps = importiere_excel(quelle)
    except Exception as exc:  # noqa: BLE001 — wir wollen wirklich alles fangen
        st.error(f"❌ Import-Fehler: {exc}")
        return False

    if not ps:
        st.warning(
            "Keine Paletten in der Datei gefunden. "
            "Bitte prüfen, ob Spalten wie Artikelnummer, P-Länge, P-Breite vorhanden sind."
        )
        return False

    # AW-Tracking — verhindert Doppelimport derselben Aufträge
    auftrag_nummern = [p.auftrag for p in ps if p.auftrag]
    if auftrag_nummern:
        neu, schon = filtere_neue_auftraege(auftrag_nummern)
        st.session_state.import_neu_count = len(neu)
        st.session_state.import_schon_count = len(schon)
        if schon and st.session_state.ignore_bekannte_auftraege:
            schon_set = set(schon)
            ps = [p for p in ps if (p.auftrag not in schon_set) or not p.auftrag]
            st.info(
                f"📋 AW-Check: {len(schon)} bereits bekannte Aufträge übersprungen, "
                f"{len(neu)} neu. "
                + '(Einstellung "bekannte AWs ignorieren" deaktivieren, um alles zu laden.)'
            )
            if not ps:
                st.warning("Alle Aufträge wurden bereits importiert — nichts Neues zu tun.")
                return False
        markiere_auftraege_bearbeitet(
            [p.auftrag for p in ps if p.auftrag],
            quelle=anzeigename,
        )

    st.session_state.paletten = ps
    st.session_state.datei_name = anzeigename
    st.session_state.datei_zeit = datetime.now().strftime("%d.%m.%Y %H:%M")
    st.session_state.ergebnis = None
    st.session_state.wirtschaftlichkeit = None
    st.session_state.letzte_opt_signatur = ""

    try:
        with st.spinner(f"Optimiere {len(ps)} Paletten ..."):
            run_optimierung()
    except Exception as exc:  # noqa: BLE001
        st.error(
            "⚠️ Optimierung fehlgeschlagen: " + str(exc) + "\n\n"
            + f"{len(ps)} Paletten wurden geladen. Bitte links die Einstellungen prüfen "
            + 'und mit "Neu optimieren" erneut versuchen.'
        )

    return True


def card_datenimport() -> None:
    if st.session_state.datei_name:
        n_artikel = len(st.session_state.paletten)
        st.markdown(
            f"""
            <div class="card">
              <h3>Datenimport</h3>
              <div class="file-card">
                <div class="icon">XLSX</div>
                <div class="file-meta">
                  <div class="fn">{escape(st.session_state.datei_name)}</div>
                  <div class="info">Importiert: {escape(st.session_state.datei_zeit)}<br/>
                    Gesamt Artikel: <b>{fmt_int(n_artikel)}</b></div>
                </div>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        with st.expander("Neue Datei importieren"):
            upload = st.file_uploader(
                "Excel-Datei", type=["xlsx"], key="up_dash", label_visibility="collapsed"
            )
            col_a, col_b = st.columns(2)
            if col_a.button("📥 Importieren", use_container_width=True, disabled=upload is None):
                if upload is not None and _importiere_quelle(upload, upload.name):
                    st.rerun()
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
            if upload is not None and _importiere_quelle(upload, upload.name):
                st.rerun()
        if col_b.button("📦 Beispieldaten", use_container_width=True):
            lade_beispiel()
            st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)


def card_toleranz() -> None:
    st.markdown('<div class="card"><h3>Toleranz</h3>', unsafe_allow_html=True)
    col_l, col_b = st.columns(2)
    suffix = "mm" if st.session_state.tol_einheit == "mm" else "%"
    with col_l:
        st.session_state.tol_l = st.number_input(
            f"Länge ({suffix})",
            min_value=0.0,
            value=float(st.session_state.tol_l),
            step=10.0 if suffix == "mm" else 1.0,
            key="tol_l_in",
        )
    with col_b:
        st.session_state.tol_b = st.number_input(
            f"Breite ({suffix})",
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

    st.session_state.hoehe_aktiv = st.toggle(
        "📦 Höhe mitstandardisieren (Stapel-/Gitterhöhe)",
        value=st.session_state.hoehe_aktiv,
        key="hoehe_in",
        help=(
            "Wenn aktiv, ist die Palettenhöhe (P-Höhe) die dritte Dimension. "
            "Standards werden 3D — eine 1200×800 Palette mit 600 mm "
            "Stapelhöhe ist dann ein anderer Standard als 1200×800 mit "
            "1500 mm. Artikel ohne Höhenangabe passen weiterhin in jeden "
            "Standard."
        ),
    )
    if st.session_state.hoehe_aktiv:
        st.session_state.tol_h = st.number_input(
            f"Höhe ({'mm' if st.session_state.tol_einheit == 'mm' else '%'})",
            min_value=0.0,
            value=float(st.session_state.tol_h),
            step=10.0 if st.session_state.tol_einheit == "mm" else 1.0,
            key="tol_h_in",
        )

    st.session_state.kombinieren_erlaubt = st.toggle(
        "Paletten kombinieren (2- bis 3-fach, in Länge oder Breite)",
        value=st.session_state.kombinieren_erlaubt,
        key="kombi_in",
        help=(
            "Wenn aktiv, dürfen Original-Paletten durch 2 oder 3 kleinere "
            "Standardpaletten ersetzt werden, die zusammen das Maß abdecken "
            "— entweder längs aneinandergelegt oder quer."
        ),
    )
    st.session_state.wirtschaftliche_filterung = st.toggle(
        "💰 Wirtschaftliche Optimierung",
        value=st.session_state.wirtschaftliche_filterung,
        key="wirt_in",
        help=(
            "Wenn aktiv, werden Standards nur empfohlen, wenn die "
            "Palettenkosten-Ersparnis größer ist als die zusätzlichen "
            "Transportkosten. Cluster, die sich logistisch nicht lohnen, "
            "werden als Sonderpaletten beibehalten."
        ),
    )
    raster_label = ["10 mm", "25 mm", "50 mm", "100 mm", "kein Raster"]
    raster_val = [10, 25, 50, 100, 0]
    raster_idx = raster_val.index(st.session_state.raster) if st.session_state.raster in raster_val else 3
    sel = st.selectbox(
        "Standardmaße aufrunden auf",
        raster_label,
        index=raster_idx,
        key="raster_in",
        help="Standardmaße werden auf das nächste Vielfache aufgerundet, sofern die Toleranz das zulässt.",
    )
    st.session_state.raster = raster_val[raster_label.index(sel)]

    st.session_state.mengen_schwelle = st.number_input(
        "Mengen-Schwelle (kleine Cluster werden Sonderpaletten)",
        min_value=0,
        max_value=50,
        value=int(st.session_state.mengen_schwelle),
        step=1,
        key="schwelle_in",
        help=(
            "Cluster mit weniger als dieser Anzahl Paletten gesamt werden "
            "aus dem Standardsortiment ausgegliedert und als Sonderpaletten "
            "behandelt. 0 = aus."
        ),
    )
    st.markdown("</div>", unsafe_allow_html=True)


def card_planung() -> None:
    st.markdown('<div class="card"><h3>Planungszeitraum</h3>', unsafe_allow_html=True)
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
    st.markdown('<div class="card"><h3>Kosten &amp; Logistik</h3>', unsafe_allow_html=True)
    col_l, col_r = st.columns(2)
    with col_l:
        st.session_state.kosten_pro_lkw = st.number_input(
            "Kosten / LKW (€)",
            min_value=0.0,
            value=float(st.session_state.kosten_pro_lkw),
            step=10.0,
            key="lkw_in",
        )
    with col_r:
        st.session_state.nutzbare_ladelaenge = st.number_input(
            "Ladelänge / LKW (m)",
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
    st.markdown('<div class="card"><h3>Sicherheitsbestand</h3>', unsafe_allow_html=True)
    st.session_state.sicherheitsbestand = st.number_input(
        "Stück je Palettentyp",
        min_value=0,
        value=int(st.session_state.sicherheitsbestand),
        step=10,
        key="sb_in",
    )
    st.markdown("</div>", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Result table (grouped HTML)
# ---------------------------------------------------------------------------

def render_result_table(erg: OptimierungsErgebnis) -> str:
    has_kunde = any(m.kunde for s in erg.standards for m in s.members)
    has_auftrag = any(m.auftrag for s in erg.standards for m in s.members)
    has_hoehe = any(s.hoehe > 0 for s in erg.standards)

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
            artikel_html = f'<div style="font-weight:600;">{escape(m.artikelnummer)}</div>'
            if has_kunde and m.kunde:
                artikel_html += f'<div style="font-size:11px;color:#6b7280;margin-top:2px;">{escape(m.kunde[:35])}</div>'
            tds.append(f"<td>{artikel_html}</td>")
            if has_auftrag:
                tds.append(f'<td style="font-family:ui-monospace,SF Mono,Menlo,monospace;font-size:12px;">{escape(m.auftrag)}</td>')
            tds.append(f"<td style='text-align:right;'>{fmt_int(m.anzahl)}</td>")
            tds.append(f"<td style='text-align:right;'>{fmt_int(m.stueck_pro_palette)}</td>")
            if has_hoehe:
                h_str = (f"{int(round(m.laenge))} × {int(round(m.breite))} × {int(round(m.hoehe))}"
                         if m.hoehe > 0 else f"{int(round(m.laenge))} × {int(round(m.breite))}")
            else:
                h_str = f"{int(round(m.laenge))} × {int(round(m.breite))}"
            tds.append(f"<td>{h_str}</td>")
            tds.append('<td><span class="badge badge-ok">✓ innerhalb Toleranz</span></td>')
            rows.append("<tr>" + "".join(tds) + "</tr>")

    for k in erg.kombinationen:
        m = k.palette
        def _fmt_std(s):
            if has_hoehe and s.hoehe > 0:
                return f"{int(round(s.laenge))} × {int(round(s.breite))} × {int(round(s.hoehe))}"
            return f"{int(round(s.laenge))} × {int(round(s.breite))}"
        std_label = " + ".join(_fmt_std(s) for s in k.standards)
        kombi_hinweis = "in Länge gestapelt" if k.richtung == "laenge" else "in Breite gestapelt"
        artikel_html = f'<div style="font-weight:600;">{escape(m.artikelnummer)}</div>'
        if has_kunde and m.kunde:
            artikel_html += f'<div style="font-size:11px;color:#6b7280;">{escape(m.kunde[:35])}</div>'
        kombi_row = (
            f"<tr>"
            f'<td class="standard-cell">{std_label}'
            f'<div class="sub-line">{len(k.standards)}× kombiniert, {kombi_hinweis}</div></td>'
            f"<td>{artikel_html}</td>"
        )
        if has_auftrag:
            kombi_row += f'<td style="font-family:ui-monospace,monospace;font-size:12px;">{escape(m.auftrag)}</td>'
        kombi_row += (
            f"<td style='text-align:right;'>{fmt_int(m.anzahl)}</td>"
            f"<td style='text-align:right;'>{fmt_int(m.stueck_pro_palette)}</td>"
            f"<td>{int(round(m.laenge))} × {int(round(m.breite))}</td>"
            f'<td><span class="badge badge-kombi">⚡ Kombination</span></td>'
            "</tr>"
        )
        rows.append(kombi_row)

    head_cells = ["<th>Standardpalette (mm)</th>", "<th>Artikel / Kunde</th>"]
    if has_auftrag:
        head_cells.append("<th>Auftrag</th>")
    head_cells.extend([
        "<th style='text-align:right;'>Paletten</th>",
        "<th style='text-align:right;'>Stk / Pal</th>",
        "<th>Original (mm)</th>",
        "<th>Bemerkung</th>",
    ])
    head = "<thead><tr>" + "".join(head_cells) + "</tr></thead>"
    return f'<table class="result-tbl">{head}<tbody>{"".join(rows)}</tbody></table>'


def card_ergebnis(erg: OptimierungsErgebnis) -> None:
    n_kombi = len(erg.kombinationen)
    n_sonder = erg.anzahl_sonder
    extras = []
    if n_kombi:
        extras.append(f"{n_kombi} Kombi")
    if n_sonder:
        extras.append(f"{n_sonder} Sonder")
    extras_str = f" · {' · '.join(extras)}" if extras else ""
    st.markdown(
        f'<div class="card" style="max-height:680px;overflow:auto;">'
        f'<h3>Optimierungs-Ergebnis · {erg.anzahl_standards} Standards aus '
        f'{erg.anzahl_eingabe_typen} Typen{extras_str}</h3>'
        f'{render_result_table(erg)}</div>',
        unsafe_allow_html=True,
    )

    if n_sonder:
        sonder_rows = "".join(
            f"<tr><td>{escape(p.artikelnummer)}</td>"
            f"<td>{escape(p.kunde[:35]) if p.kunde else ''}</td>"
            f"<td style='font-family:ui-monospace,monospace;font-size:12px;'>{escape(p.auftrag) if p.auftrag else ''}</td>"
            f"<td>{int(round(p.laenge))} × {int(round(p.breite))}</td>"
            f"<td style='text-align:right;'>{fmt_int(p.anzahl)}</td></tr>"
            for p in erg.sonderpaletten
        )
        st.markdown(
            f'<div class="card"><h3>Sonderpaletten ({n_sonder}) — unter Mengen-Schwelle</h3>'
            '<table class="result-tbl">'
            '<thead><tr><th>Artikelnummer</th><th>Kunde</th><th>Auftrag</th>'
            "<th>Maße (mm)</th><th style='text-align:right;'>Paletten</th></tr></thead>"
            f'<tbody>{sonder_rows}</tbody></table></div>',
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

    # Break-Even & Jahresersparnis
    be_text = ""
    if wirt.break_even_monate is None:
        be_text = "amortisiert sich nicht"
    elif wirt.break_even_monate == 0:
        be_text = "sofort"
    elif wirt.break_even_monate < 1:
        be_text = f"< 1 Monat ({wirt.break_even_monate * 30:.0f} Tage)"
    else:
        be_text = f"{wirt.break_even_monate:.1f} Monate"
    jahresersparnis = wirt.ersparnis * 12 - wirt.setup_kosten_einmalig

    setup_row = ""
    if wirt.setup_kosten_einmalig > 0:
        setup_row = f"""
          <tr>
            <td>Einmalige Setup-Kosten</td>
            <td>—</td>
            <td>{fmt_eur(wirt.setup_kosten_einmalig)}</td>
            <td class="neg">+{fmt_eur(wirt.setup_kosten_einmalig)}</td>
          </tr>
        """

    html = f"""
    <div class="card">
      <h3>Wirtschaftlichkeit</h3>
      <table class="wirt-tbl">
        <thead><tr><th>Position</th><th>Aktuell</th><th>Optimiert</th><th>Differenz</th></tr></thead>
        <tbody>
          <tr>
            <td>Variantenzahl</td>
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
          {setup_row}
          <tr class="gesamt">
            <td>Gesamt / Monat</td>
            <td>{fmt_eur(wirt.gesamtkosten_alt)}</td>
            <td>{fmt_eur(wirt.gesamtkosten_neu)}</td>
            <td class="{_cls(diff_ges)}">{_fmt_diff(diff_ges)}</td>
          </tr>
        </tbody>
      </table>
      <div class="{summary_class}">
        <div>
          <div style="font-size:11px;opacity:0.7;text-transform:uppercase;letter-spacing:0.5px;">
            {'Ersparnis pro Monat' if wirt.ersparnis >= 0 else 'Mehrkosten pro Monat'}
          </div>
          <div class="v">{fmt_eur(abs(wirt.ersparnis))}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;opacity:0.7;text-transform:uppercase;letter-spacing:0.5px;">
            Break-Even
          </div>
          <div style="font-size:14px;font-weight:700;margin-top:2px;">{be_text}</div>
          <div style="font-size:11px;opacity:0.7;margin-top:4px;">
            12 Mt: {fmt_eur(jahresersparnis)}
          </div>
        </div>
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
    <div style="text-align:center;padding:10px 0;">
      <svg width="320" height="100" viewBox="0 0 320 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="46" width="20" height="34" fill="{PRIMARY_LIGHT}" rx="2"/>
        <rect x="22" y="34" width="{truck_w}" height="46" rx="3" fill="{PRIMARY_LIGHT}" stroke="#0f1a30"/>
        <rect x="26" y="38" width="{truck_w - 8}" height="38" rx="2" fill="#3b4a6b"/>
        <rect x="{22 + truck_w}" y="38" width="{extra_w}" height="38" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="5,3"/>
        <circle cx="50" cy="86" r="9" fill="#374151" stroke="#1f2937" stroke-width="2"/>
        <circle cx="90" cy="86" r="9" fill="#374151" stroke="#1f2937" stroke-width="2"/>
        <circle cx="240" cy="86" r="9" fill="#374151" stroke="#1f2937" stroke-width="2"/>
        <text x="{22 + truck_w + extra_w + 4}" y="32" font-size="10" font-family="Inter, Arial" fill="#dc2626" font-weight="700">+{zusatz_lademeter:.2f} m</text>
        <text x="22" y="98" font-size="9" fill="#6b7280">0 m</text>
        <text x="{22 + truck_w - 20}" y="98" font-size="9" fill="#6b7280">{max_breite:.2f} m</text>
      </svg>
    </div>
    """


def card_logistik(wirt: WirtschaftlichkeitsErgebnis) -> None:
    mehrkosten = wirt.logistikkosten_neu - wirt.logistikkosten_alt
    html = f"""
    <div class="card">
      <h3>Logistik</h3>
      <div class="log-grid">
        <div class="it"><span class="l">Zusätzlicher Bedarf</span>
          <span class="v warn">{wirt.zusatz_lademeter:.2f} m</span></div>
        <div class="it"><span class="l">Mehrkosten Logistik</span>
          <span class="v">{fmt_eur(abs(mehrkosten))}</span></div>
        <div class="it"><span class="l">Versand pro Monat</span>
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
        x=monate, y=alt, mode="lines+markers", name="Aktuell",
        line=dict(color=BLUE, width=3), marker=dict(size=8),
        fill="tozeroy", fillcolor="rgba(37,99,235,0.05)",
    ))
    fig.add_trace(go.Scatter(
        x=monate, y=neu, mode="lines+markers", name="Optimiert",
        line=dict(color=GREEN, width=3), marker=dict(size=8),
        fill="tozeroy", fillcolor="rgba(22,163,74,0.05)",
    ))
    fig.update_layout(
        height=240,
        margin=dict(l=10, r=10, t=10, b=10),
        plot_bgcolor="#fff", paper_bgcolor="#fff",
        xaxis=dict(title="", gridcolor="#f3f4f6",
                   tickmode="array", tickvals=monate,
                   ticktext=[f"{m}M" for m in monate]),
        yaxis=dict(title="", gridcolor="#f3f4f6", tickformat=",.0f"),
        legend=dict(orientation="h", y=-0.18, x=0.0, font=dict(size=11)),
        font=dict(size=11, family="Inter, sans-serif"),
    )
    return fig


def card_kosten_simulation(wirt: WirtschaftlichkeitsErgebnis) -> None:
    ersparnis_12 = wirt.ersparnis * 12
    farb = "background:#dcfce7;color:#166534;" if ersparnis_12 >= 0 else "background:#fee2e2;color:#991b1b;"
    titel = "Ersparnis nach 12 Monaten" if ersparnis_12 >= 0 else "Mehrkosten nach 12 Monaten"
    st.markdown('<div class="card"><h3>Kostenentwicklung</h3>', unsafe_allow_html=True)
    st.plotly_chart(kosten_chart(wirt), use_container_width=True, config={"displayModeBar": False})
    st.markdown(
        f"""
        <div style="border-radius:8px;padding:10px 14px;
                    font-size:12px;font-weight:600;text-align:center;margin-top:-8px;{farb}">
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
    pdf_text = "PDF erstellt" if offen else "noch keine"

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
          <div class="sub">ca. {tage_reicht} Tage</div>
        </div>
      </div>
      <div class="info-box warn">
        <div class="ico">⚠️</div>
        <div>
          <div class="lbl">Sicherheitsbestand</div>
          <div class="val">{n_kritisch} Typen unter</div>
        </div>
      </div>
      <div class="info-box info">
        <div class="ico">ℹ️</div>
        <div>
          <div class="lbl">Empfehlung</div>
          <div class="val">Bestellen in {empfohlen_in} Tagen</div>
        </div>
      </div>
      <div class="info-box cart">
        <div class="ico">🛒</div>
        <div>
          <div class="lbl">Offene Bestellungen</div>
          <div class="val">{offen}</div>
          <div class="sub">{pdf_text}</div>
        </div>
      </div>
    </div>
    """
    col_info, col_btn = st.columns([5, 1.2])
    with col_info:
        st.markdown('<div class="card"><h3>Nächste Schritte</h3>' + info_html + '</div>', unsafe_allow_html=True)
    with col_btn:
        st.markdown("<div style='height:36px;'></div>", unsafe_allow_html=True)
        if st.button("🔄 Neue Optimierung", use_container_width=True, type="primary"):
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
    step_action_row()

    if not st.session_state.paletten:
        c = st.container()
        c.markdown(
            '<div class="card"><h3>Datenimport</h3>'
            '<p style="color:#6b7280;font-size:13px;">Excel-Datei hochladen oder Beispieldaten verwenden.</p>',
            unsafe_allow_html=True,
        )
        upload = c.file_uploader("Excel-Datei (.xlsx)", type=["xlsx"], key="up_init")
        col_a, col_b = c.columns(2)
        if col_a.button("📥 Importieren", use_container_width=True, disabled=upload is None):
            if upload is not None and _importiere_quelle(upload, upload.name):
                st.rerun()
        if col_b.button("📦 Beispieldaten laden", use_container_width=True, type="primary"):
            lade_beispiel()
            st.rerun()
        c.markdown("</div>", unsafe_allow_html=True)
        return

    if st.session_state.ergebnis is None or st.session_state.wirtschaftlichkeit is None:
        try:
            with st.spinner("Berechne Optimierung ..."):
                run_optimierung()
        except Exception as exc:  # noqa: BLE001
            st.error(
                "⚠️ Optimierung fehlgeschlagen: " + str(exc) + "\n\n"
                + 'Bitte die Einstellungen prüfen und "Neu optimieren" klicken.'
            )

    col_l, col_r = st.columns([1, 2.4])
    with col_l:
        card_datenimport()
        card_toleranz()
        card_planung()
        card_kosten()
        card_sicherheitsbestand()
        if st.button("🔄 Neu optimieren", use_container_width=True, type="primary", key="reopt"):
            try:
                with st.spinner("Optimiere ..."):
                    run_optimierung()
            except Exception as exc:  # noqa: BLE001
                st.error(f"⚠️ Optimierung fehlgeschlagen: {exc}")
            st.rerun()
    with col_r:
        # Live re-optimize wenn sich Werte geändert haben (Toleranz, Einheit, ...)
        stelle_aktualitaet_sicher()
        erg = st.session_state.ergebnis
        wirt = st.session_state.wirtschaftlichkeit

        if erg is None or wirt is None:
            n = len(st.session_state.paletten)
            hinweis = (
                '<div class="card"><h3>Optimierungs-Ergebnis</h3>'
                '<p style="color:#6b7280;font-size:13px;">'
                f"{n} Paletten geladen. "
                "Klicke links auf <b>Neu optimieren</b>, um die Standardpaletten "
                "zu berechnen.</p></div>"
            )
            st.markdown(hinweis, unsafe_allow_html=True)
            return

        card_ergebnis(erg)
        sub_a, sub_b, sub_c = st.columns([1, 1, 1])
        with sub_a:
            card_wirtschaftlichkeit(wirt, n_alt=erg.anzahl_eingabe_typen, n_neu=erg.anzahl_standards)
        with sub_b:
            card_logistik(wirt)
        with sub_c:
            card_kosten_simulation(wirt)

    if erg is not None:
        footer_info(erg)


def seite_datenimport() -> None:
    step_action_row()
    st.markdown('<div class="card"><h3>Datenimport</h3>', unsafe_allow_html=True)
    upload = st.file_uploader("Excel-Datei (.xlsx)", type=["xlsx"], key="up_d")
    col_a, col_b = st.columns(2)
    if col_a.button("📥 Importieren", use_container_width=True, disabled=upload is None):
        if upload is not None and _importiere_quelle(upload, upload.name):
            st.success(f"{len(st.session_state.paletten)} Paletten geladen.")
            st.rerun()
    if col_b.button("📦 Beispieldaten laden", use_container_width=True, type="primary"):
        lade_beispiel()
        st.rerun()
    st.markdown("</div>", unsafe_allow_html=True)

    if st.session_state.paletten:
        df = pd.DataFrame([
            {
                "Artikel": p.artikelnummer, "Kunde": p.kunde, "Auftrag": p.auftrag,
                "Länge": p.laenge, "Breite": p.breite, "Höhe": p.hoehe or "",
                "Anzahl": p.anzahl, "Stk/Pal": p.stueck_pro_palette,
                "Kosten alt (€)": p.kosten_alt,
            }
            for p in st.session_state.paletten
        ])
        st.markdown(f'<div class="card"><h3>Importierte Paletten ({len(df)})</h3>', unsafe_allow_html=True)
        st.dataframe(df, use_container_width=True, hide_index=True, height=420)
        st.markdown("</div>", unsafe_allow_html=True)


def seite_optimierung() -> None:
    step_action_row()
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
    step_action_row()
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

    # === Verbrauchs-Timeline ===
    if krit:
        st.markdown('<div class="card"><h3>Verbrauchs-Timeline (Projektion)</h3>', unsafe_allow_html=True)
        typen = [k["typ"] for k in krit]
        sel_typ = st.selectbox("Palettentyp wählen", typen, key="vt_typ")
        col_p1, col_p2 = st.columns([1, 2])
        with col_p1:
            monatsbedarf = st.number_input(
                "Monatlicher Bedarf (Stück)",
                min_value=0.0,
                value=float(next((k["benoetigt"] for k in krit if k["typ"] == sel_typ), 50)),
                step=10.0,
                key="vt_bedarf",
            )
        with col_p2:
            horizont = st.slider("Horizont (Tage)", min_value=30, max_value=365, value=120, key="vt_horizont")
        verlauf = projiziere_bestand(sel_typ, monatsbedarf, horizont_tage=horizont)
        if verlauf:
            df_v = pd.DataFrame(verlauf)
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=df_v["datum"], y=df_v["bestand"], mode="lines",
                line=dict(color=PRIMARY_LIGHT, width=2),
                fill="tozeroy", fillcolor="rgba(26,41,68,0.07)",
                name="Bestand",
            ))
            fig.add_trace(go.Scatter(
                x=df_v["datum"], y=df_v["sicherheit"], mode="lines",
                line=dict(color="#dc2626", width=1, dash="dash"),
                name="Sicherheitsbestand",
            ))
            # Marker für Bestellungs-Eingänge
            zugaenge = df_v[df_v["ereignis"] != ""]
            if not zugaenge.empty:
                fig.add_trace(go.Scatter(
                    x=zugaenge["datum"], y=zugaenge["bestand"], mode="markers",
                    marker=dict(color=GREEN, size=10, symbol="triangle-up"),
                    text=zugaenge["ereignis"],
                    name="Lieferungen",
                ))
            fig.update_layout(
                height=320,
                margin=dict(l=10, r=10, t=10, b=10),
                plot_bgcolor="#fff", paper_bgcolor="#fff",
                xaxis=dict(gridcolor="#f3f4f6"),
                yaxis=dict(title="Stück", gridcolor="#f3f4f6"),
                legend=dict(orientation="h", y=-0.18, x=0.0),
                font=dict(size=11, family="Inter, sans-serif"),
            )
            st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

            # Kritische Phase erkennen
            unter_null = next((v["datum"] for v in verlauf if v["bestand"] <= 0), None)
            unter_sb = next((v["datum"] for v in verlauf if v["bestand"] < v["sicherheit"]), None)
            cols = st.columns(2)
            if unter_sb:
                cols[0].warning(f"⚠️ Bestand unter Sicherheitsbestand ab **{unter_sb}**")
            else:
                cols[0].success("✅ Sicherheitsbestand wird im Zeitraum nicht unterschritten")
            if unter_null:
                cols[1].error(f"❌ Bestand komplett verbraucht ab **{unter_null}**")
            else:
                cols[1].success("✅ Reicht über den ganzen Zeitraum")
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
    st.markdown('<div class="card"><h3>Allgemein</h3>', unsafe_allow_html=True)
    st.session_state.firma = st.text_input("Firmenname", value=st.session_state.firma)
    st.session_state.kunde = st.text_input("Kunde (Default)", value=st.session_state.kunde)
    st.session_state.auftragsnummer = st.text_input("Auftragsnummer (Default)", value=st.session_state.auftragsnummer)
    sb = st.number_input("Sicherheitsbestand global", min_value=0,
                         value=int(st.session_state.sicherheitsbestand), step=10)
    if st.button("💾 Sicherheitsbestand global anwenden", use_container_width=True, type="primary"):
        st.session_state.sicherheitsbestand = int(sb)
        setze_sicherheitsbestand_global(int(sb))
        st.success("Sicherheitsbestand auf alle Typen angewendet.")
    st.markdown("</div>", unsafe_allow_html=True)

    # === Pallettenkosten — flach oder detailliert ===
    st.markdown('<div class="card"><h3>Palettenkosten</h3>', unsafe_allow_html=True)
    st.session_state.kalkulation_aktiv = st.toggle(
        "Detaillierte Kalkulation aktivieren (Material / Fertigung / Einkauf / Lager / Handling)",
        value=st.session_state.kalkulation_aktiv,
        key="kalk_aktiv_in",
    )
    if not st.session_state.kalkulation_aktiv:
        col_a, col_b = st.columns(2)
        st.session_state.palettenkosten_alt = col_a.number_input(
            "Palettenkosten alt (€/Stk, Sonderanfertigung)",
            min_value=0.0, value=float(st.session_state.palettenkosten_alt), step=0.5,
            key="pk_alt_in",
        )
        st.session_state.palettenkosten_neu = col_b.number_input(
            "Palettenkosten neu (€/Stk, Standard)",
            min_value=0.0, value=float(st.session_state.palettenkosten_neu), step=0.5,
            key="pk_neu_in",
        )
    else:
        col_alt, col_neu = st.columns(2)
        with col_alt:
            st.markdown("<b>Sonderanfertigung (alt)</b>", unsafe_allow_html=True)
            st.session_state.kalk_alt_material = st.number_input(
                "Material (€)", min_value=0.0, value=float(st.session_state.kalk_alt_material), step=0.5, key="ka_mat")
            st.session_state.kalk_alt_fertigung = st.number_input(
                "Fertigung (€)", min_value=0.0, value=float(st.session_state.kalk_alt_fertigung), step=0.5, key="ka_fer")
            st.session_state.kalk_alt_einkauf = st.number_input(
                "Einkauf (€)", min_value=0.0, value=float(st.session_state.kalk_alt_einkauf), step=0.5, key="ka_ein")
            st.session_state.kalk_alt_lager = st.number_input(
                "Lager (€)", min_value=0.0, value=float(st.session_state.kalk_alt_lager), step=0.5, key="ka_lag")
            st.session_state.kalk_alt_handling = st.number_input(
                "Handling (€)", min_value=0.0, value=float(st.session_state.kalk_alt_handling), step=0.5, key="ka_han")
            alt_total = (st.session_state.kalk_alt_material + st.session_state.kalk_alt_fertigung
                         + st.session_state.kalk_alt_einkauf + st.session_state.kalk_alt_lager
                         + st.session_state.kalk_alt_handling)
            st.markdown(f"<div class='lade-box'><div class='lbl'>Summe alt</div>"
                        f"<div class='val'>{fmt_eur(alt_total)}</div></div>", unsafe_allow_html=True)
        with col_neu:
            st.markdown("<b>Standardpalette (neu)</b>", unsafe_allow_html=True)
            st.session_state.kalk_neu_material = st.number_input(
                "Material (€)", min_value=0.0, value=float(st.session_state.kalk_neu_material), step=0.5, key="kn_mat")
            st.session_state.kalk_neu_fertigung = st.number_input(
                "Fertigung (€)", min_value=0.0, value=float(st.session_state.kalk_neu_fertigung), step=0.5, key="kn_fer")
            st.session_state.kalk_neu_einkauf = st.number_input(
                "Einkauf (€)", min_value=0.0, value=float(st.session_state.kalk_neu_einkauf), step=0.5, key="kn_ein")
            st.session_state.kalk_neu_lager = st.number_input(
                "Lager (€)", min_value=0.0, value=float(st.session_state.kalk_neu_lager), step=0.5, key="kn_lag")
            st.session_state.kalk_neu_handling = st.number_input(
                "Handling (€)", min_value=0.0, value=float(st.session_state.kalk_neu_handling), step=0.5, key="kn_han")
            neu_total = (st.session_state.kalk_neu_material + st.session_state.kalk_neu_fertigung
                         + st.session_state.kalk_neu_einkauf + st.session_state.kalk_neu_lager
                         + st.session_state.kalk_neu_handling)
            st.markdown(f"<div class='lade-box'><div class='lbl'>Summe neu</div>"
                        f"<div class='val'>{fmt_eur(neu_total)}</div></div>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)

    # === Setup-Kosten & Break-Even ===
    st.markdown('<div class="card"><h3>Setup-Kosten</h3>', unsafe_allow_html=True)
    st.session_state.setup_kosten_pro_standard = st.number_input(
        "Einmalige Setup-Kosten je neuem Standardtyp (€)",
        min_value=0.0, value=float(st.session_state.setup_kosten_pro_standard), step=50.0,
        help="Anschaffung neuer Werkzeuge / Anlernung der Fertigung. Beeinflusst den Break-Even-Punkt.",
        key="setup_in",
    )
    st.markdown("</div>", unsafe_allow_html=True)

    # === AW-Historie ===
    st.markdown('<div class="card"><h3>Auftrags-Historie (Doppelimport-Schutz)</h3>', unsafe_allow_html=True)
    st.session_state.ignore_bekannte_auftraege = st.toggle(
        "Bereits bekannte Auftragsnummern beim Re-Import ignorieren",
        value=st.session_state.ignore_bekannte_auftraege,
        key="ignore_aw_in",
        help="Beim erneuten Excel-Import werden Aufträge, deren AW schon einmal eingelesen wurde, übersprungen.",
    )
    historie = lade_bearbeitete_auftraege()
    st.markdown(
        f'<div class="lade-box"><div class="lbl">Bereits eingelesene Aufträge</div>'
        f'<div class="val">{fmt_int(len(historie))}</div></div>',
        unsafe_allow_html=True,
    )
    if historie and st.button("🗑️ Historie löschen", use_container_width=True, key="del_aw"):
        loesche_bearbeitete_auftraege()
        st.success("Auftrags-Historie wurde geleert.")
        st.rerun()
    st.markdown("</div>", unsafe_allow_html=True)


def seite_stammdaten() -> None:
    st.markdown(
        '<div class="card"><h3>Stammdaten</h3>'
        '<p style="color:#6b7280;font-size:13px;">Lieferanten- und Kundendaten werden aktuell '
        'in den Bestellungen erfasst. Eigener Stammdaten-Bereich folgt in einer der nächsten '
        'Versionen.</p></div>',
        unsafe_allow_html=True,
    )


def seite_berichte() -> None:
    st.markdown('<div class="card"><h3>Berichte</h3>', unsafe_allow_html=True)
    if st.session_state.ergebnis is None:
        st.info("Erst optimieren, um Berichte zu erzeugen.")
    else:
        col_a, col_b = st.columns(2)
        xlsx = exportiere_ergebnis_excel(st.session_state.ergebnis)
        col_a.download_button(
            "📊 Excel-Bericht", data=xlsx,
            file_name=f"youman_bericht_{date.today().isoformat()}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True, type="primary",
        )
        pdf = erstelle_bestellung_pdf(
            st.session_state.ergebnis,
            st.session_state.geplantes_lieferdatum,
            firma=st.session_state.firma,
            auftragsnummer=st.session_state.auftragsnummer,
            kunde=st.session_state.kunde,
        )
        col_b.download_button(
            "📄 PDF-Bestellung", data=pdf,
            file_name=f"youman_bestellung_{date.today().isoformat()}.pdf",
            mime="application/pdf",
            use_container_width=True, type="primary",
        )
    st.markdown("</div>", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    init_state()
    seite = sidebar()
    topbar()

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
