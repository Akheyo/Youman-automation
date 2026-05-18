"""Paletten-Mini — eigenständige Streamlit-App.

Macht NUR zwei Dinge: Excel-Import und Optimierung. Sonst nichts.
Keine Importe aus paletten-optimierer/app.py — komplett getrennt.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

import pandas as pd
import streamlit as st

# Eigene Module
HIER = Path(__file__).resolve().parent
if str(HIER) not in sys.path:
    sys.path.insert(0, str(HIER))

from import_excel import importiere  # noqa: E402
from optimierer_kern import optimiere  # noqa: E402


def _build_stempel() -> str:
    try:
        from _build_info import BUILD_SHA, BUILD_DATE, BUILD_VERSION  # type: ignore
        return f"Build {BUILD_SHA} · {BUILD_DATE} · v{BUILD_VERSION}"
    except Exception:
        return "Build dev"


st.set_page_config(
    page_title="Paletten Mini",
    page_icon="📦",
    layout="wide",
    initial_sidebar_state="collapsed",
)


def _label(masse: tuple[float, float]) -> str:
    return f"{int(round(masse[0]))} × {int(round(masse[1]))} mm"


def _csv_export(zuordnung: list[dict]) -> bytes:
    rows = []
    for z in zuordnung:
        ziel = z.get("ziel")
        if isinstance(ziel, list):
            ziel_str = " + ".join(_label(m) for m in ziel)
        elif isinstance(ziel, tuple):
            ziel_str = _label(ziel)
        else:
            ziel_str = ""
        rows.append({
            "Auftrag": z.get("auftrag", ""),
            "Kunde": z.get("name", ""),
            "Artikelnummer": z.get("artikelnummer", ""),
            "Original (L × B)": _label(z.get("original", (0, 0))),
            "Ziel": ziel_str,
            "Typ": z.get("typ", ""),
        })
    df = pd.DataFrame(rows)
    return df.to_csv(index=False, sep=";", encoding="utf-8-sig").encode("utf-8-sig")


# ============================================================
# Header
# ============================================================
col_t, col_b = st.columns([4, 1])
with col_t:
    st.title("Paletten Mini")
    st.caption("Excel-Import und Optimierung — sonst nichts.")
with col_b:
    st.markdown(
        f'<div style="font-family:ui-monospace,monospace;font-size:11px;'
        f'color:#6b7280;text-align:right;padding-top:18px;">{_build_stempel()}</div>',
        unsafe_allow_html=True,
    )

st.divider()

# ============================================================
# Upload
# ============================================================
upload = st.file_uploader("Excel-Datei (.xlsx)", type=["xlsx"])

if upload is None:
    st.info("Bitte eine Excel-Datei hochladen.")
    st.stop()

with st.spinner(f"Lese {upload.name} ..."):
    dat = importiere(io.BytesIO(upload.read()))

if dat.get("fehler"):
    st.error(dat["fehler"])
    st.stop()

mit_mass = dat["mit_mass"]
ohne_mass = dat["ohne_mass"]

# Diagnose-Box
diag_html = (
    f"<div style='background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;"
    f"padding:12px 14px;font-size:13px;color:#1e3a8a;'>"
    f"<div style='font-weight:700;margin-bottom:6px;'>📊 Import-Diagnose</div>"
    f"<div>Header erkannt in Datei-Zeile <b>{dat['header_zeile']}</b></div>"
    f"<div>Aufträge mit gültigem L/B: <b>{len(mit_mass)}</b></div>"
    f"<div>Aufträge ohne Maß (Bucket 'Maß fehlt'): <b>{len(ohne_mass)}</b></div>"
    f"<div>Paletten gesamt (Σ Menge): <b>{sum(p['anzahl'] for p in mit_mass)}</b></div>"
    f"<div>Normalisierte Varianten: <b>{len({(max(p['laenge'],p['breite']), min(p['laenge'],p['breite'])) for p in mit_mass})}</b></div>"
    f"</div>"
)
st.markdown(diag_html, unsafe_allow_html=True)

if ohne_mass:
    with st.expander(f"⚠️ {len(ohne_mass)} Aufträge ohne gültige Maße"):
        df_ohne = pd.DataFrame(ohne_mass)
        st.dataframe(df_ohne, use_container_width=True, hide_index=True)

if not mit_mass:
    st.warning("Keine Aufträge mit gültigen Maßen — Optimierung nicht möglich.")
    st.stop()

st.divider()

# ============================================================
# Parameter
# ============================================================
st.subheader("Parameter")
c1, c2, c3, c4 = st.columns(4)
with c1:
    tol_mm = st.number_input("tol_mm", min_value=0, max_value=2000, value=100, step=10)
with c2:
    kombi_max = st.selectbox("kombi_max", [1, 2, 3], index=2)
with c3:
    coverage = st.selectbox("coverage", ["einseitig", "zweiseitig"], index=0)
with c4:
    sonder_aktiv = st.toggle("Sonder-Deckel?", value=False)
    if sonder_aktiv:
        sonder_deckel = st.number_input("max. Sonder", min_value=0, value=1, step=1)
    else:
        sonder_deckel = None

run = st.button("🔄 Optimieren", type="primary", use_container_width=True)

if not run:
    st.stop()

# ============================================================
# Optimierung
# ============================================================
with st.spinner(f"Optimiere {len(mit_mass)} Aufträge per ILP (CBC) ..."):
    res = optimiere(
        mit_mass,
        tol_mm=tol_mm,
        kombi_max=int(kombi_max),
        coverage=coverage,
        sonder_deckel=sonder_deckel,
        zeit_limit_s=60,
    )

if res["status"] != "Optimal":
    st.warning(f"ILP-Status: {res['status']} — Ergebnis evtl. nicht optimal.")

# Headline-KPI: GESAMT groß, Standards + Sonder einzeln
st.subheader("Ergebnis")
c1, c2, c3 = st.columns(3)
c1.metric("GESAMT (Standards + Sonder)", res["gesamt"])
c2.metric("Standards", len(res["standards"]))
c3.metric("Sonder", len(res["sonder"]))

# Trade-off-Zeile
st.markdown(
    f"<div style='font-size:12px;color:#475569;margin:4px 0 16px 0;'>"
    f"⚙️ tol_mm={tol_mm} · kombi_max={kombi_max} · coverage={coverage} · "
    f"sonder_deckel={'∞' if sonder_deckel is None else sonder_deckel} · "
    f"Kandidaten={res['kandidaten']} · Status={res['status']}"
    f"</div>",
    unsafe_allow_html=True,
)

# Listen
cl, cr = st.columns(2)
with cl:
    st.markdown("**Standards**")
    if res["standards"]:
        df_std = pd.DataFrame(
            [{"Länge (mm)": int(round(s[0])), "Breite (mm)": int(round(s[1]))}
             for s in res["standards"]]
        )
        st.dataframe(df_std, use_container_width=True, hide_index=True)
    else:
        st.caption("—")
with cr:
    st.markdown("**Sonder-Maße**")
    if res["sonder"]:
        df_sd = pd.DataFrame(
            [{"Länge (mm)": int(round(s[0])), "Breite (mm)": int(round(s[1]))}
             for s in res["sonder"]]
        )
        st.dataframe(df_sd, use_container_width=True, hide_index=True)
    else:
        st.caption("—")

# Zuordnungstabelle
st.markdown("**Zuordnung Auftrag → Ziel**")
zuord_rows = []
for z in res["zuordnung"]:
    ziel = z.get("ziel")
    if isinstance(ziel, list):
        ziel_str = " + ".join(_label(m) for m in ziel)
    elif isinstance(ziel, tuple):
        ziel_str = _label(ziel)
    else:
        ziel_str = "—"
    zuord_rows.append({
        "Auftrag": z["auftrag"],
        "Kunde": z["name"],
        "Artikelnummer": z["artikelnummer"],
        "Original": _label(z["original"]),
        "Ziel": ziel_str,
        "Typ": z["typ"],
    })
df_z = pd.DataFrame(zuord_rows)
st.dataframe(df_z, use_container_width=True, hide_index=True, height=400)

# CSV-Export
st.download_button(
    "📥 Zuordnung als CSV exportieren",
    data=_csv_export(res["zuordnung"]),
    file_name="paletten-mini-zuordnung.csv",
    mime="text/csv",
    use_container_width=True,
)
