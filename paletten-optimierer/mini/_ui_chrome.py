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
    """Sucht das Logo in mehreren Standorten."""
    kandidaten = [
        Path(__file__).resolve().parent / "assets" / "youman_logo.png",
        Path(__file__).resolve().parent.parent / "assets" / "youman_logo.png",
    ]
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
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


# --- Design-Tokens (identisch zur Hauptapp app.py:75-80) -------------
PRIMARY = "#0f1f3d"
PRIMARY_LIGHT = "#1a2944"
ACCENT = "#fbbf24"
BLUE = "#2563eb"
GREEN = "#16a34a"
GRAY_BG = "#f5f6f8"


CSS = f"""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    html, body, [class*="css"] {{
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        -webkit-font-smoothing: antialiased;
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
        background: rgba(251,191,36,0.12);
        border-left: 3px solid {ACCENT}; padding-left: 11px;
    }}
    section[data-testid="stSidebar"] [data-testid="stRadio"] > div > label:has(input:checked) p {{
        color: #fff !important; font-weight: 600;
    }}
    .sidebar-brand {{
        display: flex; align-items: center; gap: 12px;
        padding: 22px 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);
        margin-bottom: 14px;
    }}
    .sidebar-brand img {{ width: 38px; height: 38px; border-radius: 8px;
        background: #fff; padding: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);}}
    .sidebar-brand .name {{ color: #fff; font-weight: 800; font-size: 22px; line-height: 1; letter-spacing: -0.5px;}}
    .sidebar-brand .sub  {{ color: #94a3b8; font-size: 11px; margin-top: 4px; letter-spacing: 0.3px;}}
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
    .topbar .titleblock {{ display: flex; align-items: center; gap: 14px; }}
    .topbar img {{ width: 56px; height: 56px; border-radius: 10px;
        box-shadow: 0 2px 6px rgba(15,31,61,0.12); }}
    .topbar .title {{ color: {PRIMARY_LIGHT}; font-size: 28px; font-weight: 800; line-height: 1; letter-spacing: -0.5px;}}
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
    .step.active .num {{ background: {BLUE}; color: #fff; box-shadow: 0 0 0 4px rgba(37,99,235,0.15);}}
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
    .standard-cell {{
        background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%) !important;
        color: #1e40af !important; font-weight: 700; text-align: center;
        font-size: 14px; vertical-align: middle;
        border-right: 1px solid #bfdbfe !important;
    }}
    .standard-cell .sub-line {{ font-size: 11px; color: #3b82f6; font-weight: 500; margin-top: 4px;}}
    .badge {{
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
    }}
    .badge-ok    {{ background: #dcfce7; color: #166534; }}
    .badge-kombi {{ background: #fef3c7; color: #92400e; }}
    .badge-sonder{{ background: #fee2e2; color: #991b1b; }}

    /* Buttons */
    .stButton > button[kind="primary"] {{
        background: {BLUE}; color: #fff; border: none;
        font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }}
    .stButton > button[kind="primary"]:hover {{
        background: #1d4ed8; box-shadow: 0 4px 12px rgba(37,99,235,0.25);
    }}
    .stButton > button[kind="secondary"] {{
        background: #fff; color: {PRIMARY_LIGHT}; border: 1px solid #e5e7eb;
        font-weight: 600;
    }}
    .stDownloadButton > button {{ font-weight: 600; border-radius: 8px; }}

    /* Inputs */
    [data-baseweb="input"] > div, [data-baseweb="select"] > div {{
        border-radius: 8px !important;
    }}

    /* Disabled-Info-Box für nicht-verfügbare Features */
    .disabled-feature {{
        background: #f8fafc; border: 1px dashed #cbd5e1;
        border-radius: 10px; padding: 18px;
        color: #64748b; font-size: 13px;
    }}
    .disabled-feature .lock {{ font-size: 18px; margin-right: 6px; }}
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
    """Header oben mit Logo, Titel, Sub und Build-Stempel."""
    logo = _logo_base64()
    logo_html = (f'<img src="{logo}" alt="Youman">' if logo else "")
    st.markdown(
        f'<div class="topbar">'
        f'  <div class="titleblock">'
        f'    {logo_html}'
        f'    <div><div class="title">{escape(title)}</div>'
        f'         <div class="sub">{escape(sub)}</div></div>'
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
    logo = _logo_base64()
    logo_html = (f'<img src="{logo}" alt="Youman">' if logo else "")
    st.markdown(
        f'<div class="sidebar-brand">'
        f'{logo_html}'
        f'<div><div class="name">Youman</div>'
        f'<div class="sub">Automation · Industriepaletten</div></div>'
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
