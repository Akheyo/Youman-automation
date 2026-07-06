"""UI-Chrome für die Mini-App.

Übernimmt 1:1 die Präsentationsschicht der Hauptapp (Farben, Fonts,
Cards, Step-Indicator, KPI-Stil) — KEINE Logik aus app.py.
Damit fühlt sich die Mini-App optisch wie ein Modul der Hauptapp an,
hat aber nur das, was die Mini-App können soll.
"""
from __future__ import annotations

import base64
import sys
from html import escape
from pathlib import Path

import streamlit as st


# ---------------------------------------------------------------------------
# Logo (base64-embed) — sucht in mehreren Pfaden, damit es im Dev,
# im PyInstaller-Bundle und auf jeder Plattform funktioniert.
# ---------------------------------------------------------------------------
def _logo_pfad() -> Path | None:
    """Sucht das Brand-Logo in mehreren Standorten.

    Reihenfolge: Draht-Müller-Logo (static/) zuerst, danach das
    Youman-Logo (assets/) als Fallback. So funktioniert die App auch
    während der Inbetriebnahme, bevor das Kunden-Logo eingespielt wurde.
    """
    hier = Path(__file__).resolve().parent
    kandidaten = [
        hier / "static" / "draht_mueller_logo.png",
        hier.parent / "static" / "draht_mueller_logo.png",
        hier / "assets" / "youman_logo.png",
        hier.parent / "assets" / "youman_logo.png",
    ]
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        kandidaten.append(Path(meipass) / "static" / "draht_mueller_logo.png")
        kandidaten.append(Path(meipass) / "draht_mueller_logo.png")
        kandidaten.append(Path(meipass) / "assets" / "youman_logo.png")
        kandidaten.append(Path(meipass) / "youman_logo.png")
    for p in kandidaten:
        if p.exists():
            return p
    return None


def _logo_base64() -> str | None:
    """Liest das Logo und gibt einen data:image-URI zurück oder None."""
    p = _logo_pfad()
    if p is None:
        return None
    try:
        raw = p.read_bytes()
        b64 = base64.b64encode(raw).decode("ascii")
        return f"data:image/png;base64,{b64}"
    except OSError:
        return None


# --- Design-Tokens ---------------------------------------------------
# Brand-/Akzent-Farbe = exakter Hex-Wert aus dem Draht-Müller-Logo.
# PRIMARY_LIGHT ist der dunklere Hover-/Aktiv-Ton.
PRIMARY = "#00236E"          # DM-Blau (Brand)
PRIMARY_LIGHT = "#001A55"    # Hover/dunkler
PRIMARY_TEXT = "#FFFFFF"     # Text auf DM-Blau
ACCENT = PRIMARY             # Akzent-Bindings nutzen Brand-Blau
BLUE = PRIMARY               # Primary-Buttons in DM-Blau
GREEN = "#16A34A"            # Status: Standard-Badge (mit weisser Schrift)
GREEN_TEXT = "#FFFFFF"       # Text auf Success-Grün
DANGER = "#DC2626"           # Physik-/Fehler-Rot
DANGER_TEXT = "#FFFFFF"      # Text auf Rot
STD_BG = "#DCFCE7"           # Standard-Zeilen (hell)
STD_TEXT = "#14532D"         # Dunkles Grün auf Standard-BG
SON_BG = "#FEE2E2"           # Sonder-Zeilen (hell)
SON_TEXT = "#7F1D1D"         # Dunkles Rot auf Sonder-BG
KOMBI_BG = "#EFF6FF"         # Kombi-Zeilen (hell)
KOMBI_TEXT = "#1E3A8A"       # Dunkles Blau auf Kombi-BG
SURFACE = "#FFFFFF"          # Card-Hintergrund
SURFACE_TEXT = "#1F2937"     # Dunkelgrau auf weißem Hintergrund
MUTED = "#6B7280"            # Neutralgrau für Sekundär-Text
GRAY_BG = "#f5f6f8"          # App-Hintergrund


CSS = f"""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    /* Brand-Tokens als CSS-Custom-Properties.
       WCAG-Kontrast >= 4.5:1 fuer Body, >= 3:1 fuer grosse Schrift.
       Regel: dunkler Hintergrund -> weisse Schrift, heller
       Hintergrund -> dunkle Schrift. */
    :root {{
        --color-primary:        {PRIMARY};
        --color-primary-hover:  {PRIMARY_LIGHT};
        --color-primary-text:   {PRIMARY_TEXT};

        --color-danger:         {DANGER};
        --color-danger-text:    {DANGER_TEXT};

        --color-success:        {GREEN};
        --color-success-text:   {GREEN_TEXT};

        --color-standard-bg:    {STD_BG};
        --color-standard-text:  {STD_TEXT};

        --color-sonder-bg:      {SON_BG};
        --color-sonder-text:    {SON_TEXT};

        --color-kombi-bg:       {KOMBI_BG};
        --color-kombi-text:     {KOMBI_TEXT};

        --color-surface:        {SURFACE};
        --color-surface-text:   {SURFACE_TEXT};

        --color-muted:          {MUTED};
    }}

    html, body, [class*="css"] {{
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        -webkit-font-smoothing: antialiased;
    }}
    .stApp {{ background: {GRAY_BG}; }}
    .block-container {{ padding-top: 1rem; padding-bottom: 2rem; max-width: 100%; }}
    header[data-testid="stHeader"] {{ background: transparent; height: 0; }}
    /* Alle Streamlit-Chrome-Elemente verstecken — App-Feel, kein Web-Feel */
    #MainMenu, footer,
    [data-testid="stToolbar"],
    [data-testid="stDecoration"],
    [data-testid="stStatusWidget"],
    [data-testid="stDeployButton"],
    .stAppDeployButton,
    .streamlitBadge {{ visibility: hidden !important; display: none !important; }}

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
        color: #cbd5e1 !important; font-size: 14px; font-weight: 500;
    }}
    section[data-testid="stSidebar"] [data-testid="stRadio"] > div {{ gap: 2px; }}
    section[data-testid="stSidebar"] [data-testid="stRadio"] > div > label {{
        padding: 10px 14px; border-radius: 8px; margin: 0;
        transition: background 0.15s, color 0.15s;
    }}
    section[data-testid="stSidebar"] [data-testid="stRadio"] > div > label:hover {{
        background: rgba(255,255,255,0.06);
    }}
    section[data-testid="stSidebar"] [data-testid="stRadio"] > div > label:has(input:checked) {{
        background: rgba(0,35,110,0.22);
        border-left: 3px solid #ffffff; padding-left: 11px;
    }}
    section[data-testid="stSidebar"] [data-testid="stRadio"] > div > label:has(input:checked) p {{
        color: #fff !important; font-weight: 600;
    }}
    .sidebar-brand {{
        display: flex; flex-direction: column; align-items: center; gap: 8px;
        padding: 22px 14px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);
        margin-bottom: 14px;
    }}
    .sidebar-brand img {{ height: 48px; width: auto; max-width: 100%;
        background: #fff; padding: 6px 10px; border-radius: 10px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);}}
    .sidebar-brand .pwr {{ color: #888; font-size: 11px; font-weight: 400;
        margin-top: 4px; text-align: center; letter-spacing: 0.2px;}}
    .sidebar-brand .sub  {{ color: #94a3b8; font-size: 10px; letter-spacing: 0.4px;
        text-transform: uppercase; text-align: center;}}
    .sidebar-section-label {{
        font-size: 10px; color: #64748b; font-weight: 700;
        text-transform: uppercase; letter-spacing: 1px;
        padding: 18px 18px 8px;
    }}
    .sidebar-disabled {{
        opacity: 0.45; padding: 8px 18px; font-size: 13px;
        display: flex; align-items: center; gap: 8px;
        color: #94a3b8 !important; cursor: not-allowed;
    }}
    .sidebar-disabled .lock {{ font-size: 11px; }}

    /* Top header */
    .topbar {{
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 14px; gap: 16px;
    }}
    .topbar .titleblock {{ display: flex; align-items: center; gap: 16px; }}
    .topbar img {{ height: 52px; width: auto; max-width: 220px; }}
    .topbar .sub   {{ color: #6b7280; font-size: 12px; margin-top: 4px;}}
    .topbar .stamp {{
        font-family: ui-monospace, SF Mono, Menlo, monospace;
        font-size: 11px; color: #9ca3af; text-align: right;
        background: #f3f4f6; padding: 4px 8px; border-radius: 4px;
        border: 1px solid #e5e7eb;
    }}

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
    .step.active .num {{ background: {PRIMARY}; color: #fff; box-shadow: 0 0 0 4px rgba(0,35,110,0.18);}}
    .step.active {{ color: {PRIMARY_LIGHT}; background: linear-gradient(180deg, #f0f7ff 0%, #fff 100%); border-color: #bfdbfe;}}

    /* Cards */
    .card {{
        background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
        padding: 18px;
        box-shadow: 0 1px 3px rgba(15,31,61,0.04), 0 1px 2px rgba(15,31,61,0.06);
        margin-bottom: 14px;
    }}
    .card h3 {{
        color: {PRIMARY_LIGHT}; font-size: 13px; margin: 0 0 14px 0;
        font-weight: 700; letter-spacing: 0.2px; text-transform: uppercase;
        display: flex; align-items: center; gap: 8px;
    }}
    .card h3::before {{
        content: ''; display: block; width: 3px; height: 14px;
        background: {ACCENT}; border-radius: 2px;
    }}
    .card .sub {{ color: #6b7280; font-size: 12px; margin-top: 4px;}}

    /* Diagnose-Box (Import) */
    .diag-box {{
        background: #eff6ff; border: 1px solid #bfdbfe;
        border-radius: 8px; padding: 12px 14px;
        margin: 8px 0 12px; font-size: 13px; color: #1e3a8a;
    }}
    .diag-box .title {{ font-weight: 700; margin-bottom: 6px; }}

    /* Result table — identisch zur Hauptapp */
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
    /* Detail-Zeilen — Kontrast-Regel: heller Hintergrund -> dunkle Schrift.
       !important, weil einige Zellen inline color-Styles mitbringen
       (z.B. subtiler grauer Sub-Text), der auf pastellfarbenem Hintergrund
       Kontrast verliert. Die Row-Klasse gewinnt jetzt und alle td und
       inline-Kinder erben die dunkle Status-Textfarbe. */
    .result-tbl tr.row-standard td,
    .result-tbl tr.row-standard td div,
    .result-tbl tr.row-standard td span {{ color: {STD_TEXT} !important; }}
    .result-tbl tr.row-sonder td,
    .result-tbl tr.row-sonder td div,
    .result-tbl tr.row-sonder td span {{ color: {SON_TEXT} !important; }}
    .result-tbl tr.row-kombi td,
    .result-tbl tr.row-kombi td div,
    .result-tbl tr.row-kombi td span {{ color: {KOMBI_TEXT} !important; }}
    /* Badges innerhalb der Zeile behalten IHRE eigene Farbe (weiss auf dunkel) */
    .result-tbl tr td .badge {{ color: {PRIMARY_TEXT} !important; }}
    .result-tbl tr td .badge.badge-ok    {{ color: {GREEN_TEXT}   !important; }}
    .result-tbl tr td .badge.badge-sonder{{ color: {DANGER_TEXT}  !important; }}
    .result-tbl tr td .badge.badge-kombi {{ color: {PRIMARY_TEXT} !important; }}
    .standard-cell {{
        background: linear-gradient(180deg, {KOMBI_BG} 0%, #dbeafe 100%) !important;
        color: {KOMBI_TEXT} !important; font-weight: 700; text-align: center;
        font-size: 14px; vertical-align: middle;
        border-right: 1px solid #bfdbfe !important;
    }}
    .standard-cell .sub-line {{ font-size: 11px; color: {KOMBI_TEXT}; font-weight: 500; margin-top: 4px;}}
    .badge {{
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
    }}
    /* Badges nutzen dunkle Grundfarben -> weisse Schrift (WCAG > 4.5:1) */
    .badge-ok    {{ background: {GREEN};  color: {GREEN_TEXT}; }}
    .badge-kombi {{ background: {PRIMARY}; color: {PRIMARY_TEXT}; }}
    .badge-sonder{{ background: {DANGER}; color: {DANGER_TEXT}; }}

    /* Buttons — Kontrast-Regel: Primary auf DM-Blau -> weiss (auch im Hover).
       Alle Descendants werden explizit gefaerbt, weil Streamlit den
       Button-Text in ein <p> innerhalb <div> rendert, das inline
       color-Attribute mitbringen kann. */
    .stButton > button[kind="primary"],
    .stButton > button[kind="primary"] *,
    .stButton > button[kind="primary"] p,
    .stButton > button[kind="primary"] div,
    .stButton > button[kind="primary"] span,
    button[data-testid="stBaseButton-primary"],
    button[data-testid="stBaseButton-primary"] *,
    button[data-testid="stBaseButton-primaryFormSubmit"],
    button[data-testid="stBaseButton-primaryFormSubmit"] * {{
        background-color: {PRIMARY} !important;
        color: {PRIMARY_TEXT} !important;
        border: none !important;
        font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }}
    .stButton > button[kind="primary"]:hover,
    .stButton > button[kind="primary"]:hover *,
    button[data-testid="stBaseButton-primary"]:hover,
    button[data-testid="stBaseButton-primary"]:hover * {{
        background-color: {PRIMARY_LIGHT} !important;
        color: {PRIMARY_TEXT} !important;
        box-shadow: 0 4px 12px rgba(0,35,110,0.30);
    }}

    /* Secondary-Button im Hauptbereich: weisser BG, DM-Blau-Text. */
    .block-container .stButton > button[kind="secondary"],
    .block-container .stButton > button[kind="secondary"] * {{
        background-color: {SURFACE} !important;
        color: {PRIMARY_LIGHT} !important;
        border: 1px solid #e5e7eb !important;
        font-weight: 600;
    }}

    /* Sidebar-Buttons (z.B. Abmelden): weisser BG braucht dunklen Text.
       Die generische Sidebar-Regel section-* fuer color #cbd5e1 ist
       sonst spezifischer als der Button-Selector — wir schlagen sie mit
       hoeherer Kaskaden-Spezifitaet plus !important. */
    section[data-testid="stSidebar"] .stButton > button,
    section[data-testid="stSidebar"] .stButton > button *,
    section[data-testid="stSidebar"] button[data-testid^="stBaseButton"],
    section[data-testid="stSidebar"] button[data-testid^="stBaseButton"] * {{
        background-color: {SURFACE} !important;
        color: {PRIMARY} !important;
        border: 1px solid rgba(255,255,255,0.35) !important;
        font-weight: 600;
    }}
    section[data-testid="stSidebar"] .stButton > button:hover,
    section[data-testid="stSidebar"] .stButton > button:hover * {{
        background-color: {PRIMARY_LIGHT} !important;
        color: {PRIMARY_TEXT} !important;
    }}

    /* Download-Button (st.download_button) — normaler Secondary-Style:
       weisser Hintergrund, dunkler Text, hellgrauer Rahmen.
       WICHTIG: BG und border NUR auf das <button>-Element, NICHT auf
       die inneren p/div/span (sonst rendert Streamlit fuer jedes
       innere Element einen eigenen Rahmen -> verschachtelte Boxen). */
    .stDownloadButton > button,
    [data-testid="stDownloadButton"] button,
    button[data-testid^="stBaseButton-secondaryDownload"] {{
        font-weight: 600; border-radius: 8px;
        background-color: {SURFACE} !important;
        color: {SURFACE_TEXT} !important;
        border: 1px solid #d1d5db !important;
    }}
    /* Textfarbe der inneren Elemente ohne Border-Assign */
    .stDownloadButton > button *,
    [data-testid="stDownloadButton"] button *,
    button[data-testid^="stBaseButton-secondaryDownload"] * {{
        color: {SURFACE_TEXT} !important;
        background: transparent !important;
        border: none !important;
    }}
    .stDownloadButton > button:hover,
    [data-testid="stDownloadButton"] button:hover,
    button[data-testid^="stBaseButton-secondaryDownload"]:hover {{
        background-color: #f9fafb !important;
        border-color: {PRIMARY} !important;
    }}
    .stDownloadButton > button:hover *,
    [data-testid="stDownloadButton"] button:hover *,
    button[data-testid^="stBaseButton-secondaryDownload"]:hover * {{
        color: {PRIMARY} !important;
    }}

    /* Form-Submit-Buttons (Anmelden im Login-Gate): gleiches Primary-Styling. */
    button[data-testid="stFormSubmitButton"],
    button[data-testid="stFormSubmitButton"] *,
    .stFormSubmitButton > button,
    .stFormSubmitButton > button * {{
        background-color: {PRIMARY} !important;
        color: {PRIMARY_TEXT} !important;
        border: none !important;
        font-weight: 600;
    }}
    button[data-testid="stFormSubmitButton"]:hover,
    button[data-testid="stFormSubmitButton"]:hover * {{
        background-color: {PRIMARY_LIGHT} !important;
        color: {PRIMARY_TEXT} !important;
    }}

    /* Inputs */
    [data-baseweb="input"] > div, [data-baseweb="select"] > div {{
        border-radius: 8px !important;
    }}

    /* Toggle-Switches im "an"-Zustand auf DM-Blau */
    [data-baseweb="switch"] [role="switch"][aria-checked="true"] > div,
    [data-baseweb="checkbox"] [role="checkbox"][aria-checked="true"] {{
        background: {PRIMARY} !important;
    }}
    [data-testid="stToggle"] [role="switch"][aria-checked="true"] > div {{
        background: {PRIMARY} !important;
    }}

    /* Disabled-Info-Box für nicht-verfügbare Features */
    .disabled-feature {{
        background: #f8fafc; border: 1px dashed #cbd5e1;
        border-radius: 10px; padding: 18px;
        color: #64748b; font-size: 13px;
    }}
    .disabled-feature .lock {{ font-size: 18px; margin-right: 6px; }}

    /* --- Lesbarkeit erzwingen (gegen OS-/Browser-Dark-Mode) ----------
       Alles im Hauptbereich bekommt dunkle Schrift auf hellem Grund.
       Die Sidebar (dunkler Verlauf, helle Schrift) bleibt unberührt,
       da deren Regeln spezifischer sind. */
    .stApp, .block-container {{ color: #1f2937; }}

    /* KPI-Karten (st.metric) — weisser Hintergrund, dunkler Wert.
       Sicherstellen dass Container weiss bleibt und Value dunkelblau. */
    [data-testid="stMetric"] {{ background: {SURFACE}; }}
    /* KPI-Karten (st.metric) — Wert dunkelblau, Label grau, gut sichtbar */
    [data-testid="stMetricValue"] {{ color: {PRIMARY} !important; font-weight: 700; }}
    [data-testid="stMetricLabel"],
    [data-testid="stMetricLabel"] p {{ color: #475569 !important; font-weight: 600; }}
    [data-testid="stMetricDelta"] {{ color: #64748b !important; }}

    /* Widget-Labels im Hauptbereich (Radio, Toggle, Number-Input, Select) */
    .block-container [data-testid="stWidgetLabel"] p,
    .block-container .stRadio label p,
    .block-container .stCheckbox label p,
    .block-container [data-testid="stMarkdownContainer"] p,
    .block-container [data-testid="stMarkdownContainer"] li,
    .block-container label {{ color: #374151 !important; }}

    /* Eingabefelder hell statt dunkel — Werte lesbar */
    .block-container [data-baseweb="input"],
    .block-container [data-baseweb="base-input"],
    .block-container [data-baseweb="textarea"],
    .block-container [data-baseweb="select"] > div {{
        background: #ffffff !important;
        border-color: #d1d5db !important;
    }}
    .block-container [data-baseweb="input"] input,
    .block-container [data-baseweb="textarea"] textarea,
    .block-container [data-baseweb="select"] div {{ color: #1f2937 !important; }}
</style>
"""


def inject_css() -> None:
    """In jeder Streamlit-Page einmalig aufrufen."""
    st.markdown(CSS, unsafe_allow_html=True)


def _kern_sha7() -> str:
    """SHA256[:7] des Optimierer-Kerns — beweist welcher Stand laeuft."""
    import hashlib
    import sys
    from pathlib import Path
    candidates = [
        Path(__file__).resolve().parent / "optimierer_kern.py",
    ]
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        candidates.append(Path(meipass) / "optimierer_kern.py")
    for p in candidates:
        if p.exists():
            try:
                return hashlib.sha256(p.read_bytes()).hexdigest()[:7]
            except Exception:
                return "?"
    return "?"


def build_stempel() -> str:
    """Format gemaess FINAL-LOCK-Spec:
       'Build {sha7} · Kern {kern_sha7} · v1.0.0'"""
    try:
        from _build_info import BUILD_SHA, BUILD_VERSION  # type: ignore
        build_sha = BUILD_SHA[:7] if BUILD_SHA else "dev"
        version = BUILD_VERSION or "dev"
    except Exception:
        build_sha = "dev"
        version = "dev"
    return f"Build {build_sha} · Kern {_kern_sha7()} · v{version}"


def topbar(title: str, sub: str) -> None:
    """Header oben mit Logo, Sub und Build-Stempel. Der Titel ist im
    Logo-Wordmark enthalten — daneben steht nur noch der Sub-Text."""
    logo = _logo_base64()
    logo_html = (f'<img src="{logo}" alt="Youman Automation">'
                  if logo else f'<div class="title">{escape(title)}</div>')
    st.markdown(
        f'<div class="topbar">'
        f'  <div class="titleblock">'
        f'    {logo_html}'
        f'    <div class="sub">{escape(sub)}</div>'
        f'  </div>'
        f'  <div class="stamp">{escape(build_stempel())}</div>'
        f'</div>',
        unsafe_allow_html=True,
    )


def step_indicator(aktiv: int) -> None:
    """Step-Bar Import → Einstellungen → Optimierung → Ergebnisse,
    1:1 wie in der Hauptapp (app.py:step_action_row)."""
    schritte = [(1, "Import"), (2, "Einstellungen"), (3, "Optimierung"), (4, "Ergebnisse")]
    parts = []
    for n, name in schritte:
        if n < aktiv:
            cls = "step done"; num = "✓"
        elif n == aktiv:
            cls = "step active"; num = str(n)
        else:
            cls = "step"; num = str(n)
        parts.append(f'<div class="{cls}"><span class="num">{num}</span>{escape(name)}</div>')
    st.markdown('<div class="step-row">' + "".join(parts) + "</div>", unsafe_allow_html=True)


def card_open(titel: str) -> None:
    st.markdown(f'<div class="card"><h3>{escape(titel)}</h3>', unsafe_allow_html=True)


def card_close() -> None:
    st.markdown("</div>", unsafe_allow_html=True)


def disabled_feature(name: str, grund: str = "in dieser Mini-Version nicht verfügbar") -> None:
    st.markdown(
        f'<div class="disabled-feature">'
        f'<span class="lock">🔒</span><b>{escape(name)}</b> — {escape(grund)}.'
        f'</div>',
        unsafe_allow_html=True,
    )


def sidebar_brand() -> None:
    """Sidebar-Brand: Draht-Müller-Logo oben, darunter dezent
    "powered by Youman Automation", darunter der Untertitel."""
    logo = _logo_base64()
    logo_html = (f'<img src="{logo}" alt="Draht Müller">'
                  if logo else
                  '<div style="color:#fff;font-weight:800;font-size:22px;">'
                  'Draht Müller</div>')
    st.markdown(
        f'<div class="sidebar-brand">'
        f'{logo_html}'
        f'<div class="pwr">powered by Youman Automation</div>'
        f'<div class="sub">Industriepaletten · Standardisierung</div>'
        f'</div>',
        unsafe_allow_html=True,
    )


def sidebar_section(label: str) -> None:
    st.markdown(f'<div class="sidebar-section-label">{escape(label)}</div>',
                unsafe_allow_html=True)


def sidebar_disabled_item(name: str) -> None:
    st.markdown(
        f'<div class="sidebar-disabled">'
        f'<span class="lock">🔒</span>{escape(name)}'
        f'</div>',
        unsafe_allow_html=True,
    )
