"""Streamlit-Dashboard des Paletten-Optimierers.

Multi-Page-Dashboard mit Sidebar-Navigation, Step-Indikator, Karten-Layout und
Plotly-Charts. Alle Berechnungen werden bei Settings-Änderungen direkt neu
durchgeführt und im Session-State zwischengespeichert.
"""
from __future__ import annotations

from datetime import date, timedelta
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
    section[data-testid="stSidebar"] {
        background-color: #1a2944;
    }
    section[data-testid="stSidebar"] * {
        color: #f3f4f6 !important;
    }
    section[data-testid="stSidebar"] .stRadio label {
        color: #f3f4f6 !important;
        padding: 6px 0;
    }
    section[data-testid="stSidebar"] h1,
    section[data-testid="stSidebar"] h2,
    section[data-testid="stSidebar"] h3 {
        color: #ffffff !important;
    }
    .sidebar-logo {
        color: #ffffff;
        font-size: 20px;
        font-weight: 800;
        margin-bottom: 0;
    }
    .sidebar-sub {
        color: #94a3b8;
        font-size: 12px;
        margin-bottom: 18px;
    }
    .sidebar-kpi {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        padding: 12px;
        margin-top: 18px;
    }
    .sidebar-kpi .label { font-size: 11px; color: #94a3b8; }
    .sidebar-kpi .value { font-size: 22px; font-weight: 700; color: #ffffff; }
    .card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 18px 18px 14px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        margin-bottom: 14px;
    }
    .card h3 {
        color: #1a2944;
        font-size: 15px;
        margin: 0 0 12px 0;
        font-weight: 700;
    }
    .step-row {
        display: flex; gap: 8px;
        margin: 6px 0 22px;
    }
    .step {
        flex: 1; display: flex; align-items: center; gap: 10px;
        background: #f9fafb; border-radius: 8px;
        padding: 10px 14px; border: 1px solid #e5e7eb;
        color: #6b7280; font-size: 13px; font-weight: 600;
    }
    .step.active { background: #1a2944; color: #ffffff; border-color: #1a2944; }
    .step .num {
        width: 22px; height: 22px; border-radius: 50%;
        background: #d1d5db; color: #374151; font-size: 12px;
        display: inline-flex; align-items: center; justify-content: center;
        font-weight: 700;
    }
    .step.active .num { background: #fbbf24; color: #1a2944; }
    .kpi { display: flex; gap: 12px; margin: 6px 0 12px; }
    .kpi-box {
        flex: 1; border: 1px solid #e5e7eb; border-radius: 10px;
        padding: 12px; background: #ffffff;
    }
    .kpi-box .label { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-box .value { color: #1a2944; font-size: 24px; font-weight: 800; margin-top: 4px; }
    .kpi-box .delta { font-size: 12px; margin-top: 2px; color: #16a34a; }
    .kpi-box .delta.bad { color: #dc2626; }
    .info-box {
        background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;
        padding: 14px; height: 100%;
    }
    .info-box .icon { font-size: 22px; margin-bottom: 6px; }
    .info-box .title { color: #1a2944; font-weight: 700; font-size: 13px; }
    .info-box .desc { color: #6b7280; font-size: 12px; margin-top: 4px; }
    .badge {
        display: inline-block; padding: 2px 10px; border-radius: 999px;
        font-size: 11px; font-weight: 600;
    }
    .badge-ok { background: #dcfce7; color: #166534; }
    .badge-unter { background: #fef3c7; color: #92400e; }
    .badge-kritisch { background: #fee2e2; color: #991b1b; }
    .truck-wrap { text-align: center; padding: 8px 0; }
    .header-actions { display: flex; gap: 10px; }
    div[data-testid="stMetricValue"] { color: #1a2944; }
    .stApp { background: #f3f4f6; }
</style>
"""

st.markdown(CSS, unsafe_allow_html=True)


def init_state() -> None:
    """Initialisiert Session-State mit Defaults."""
    defaults: dict[str, Any] = {
        "paletten": [],
        "ergebnis": None,
        "wirtschaftlichkeit": None,
        "tol_einheit": "mm",
        "tol_l": 100.0,
        "tol_b": 80.0,
        "kosten_pro_lkw": 800.0,
        "nutzbare_ladelaenge": 13.6,
        "palettenkosten_neu": 18.0,
        "palettenkosten_alt": 14.0,
        "sicherheitsbestand": 100,
        "kombinieren_erlaubt": False,
        "raster": 50,
        "geplantes_lieferdatum": date.today() + timedelta(days=14),
        "auftragsnummer": "",
        "kunde": "",
        "firma": "Paletten Optimierer",
    }
    for k, v in defaults.items():
        st.session_state.setdefault(k, v)


def aktiver_schritt() -> int:
    if not st.session_state.paletten:
        return 1
    if st.session_state.ergebnis is None:
        return 2
    return 4


def step_indicator() -> None:
    aktiv = aktiver_schritt()
    schritte = [
        (1, "Import"),
        (2, "Einstellungen"),
        (3, "Optimierung"),
        (4, "Ergebnisse"),
    ]
    html = '<div class="step-row">'
    for n, name in schritte:
        cls = "step active" if n == aktiv else "step"
        html += f'<div class="{cls}"><span class="num">{n}</span>{name}</div>'
    html += "</div>"
    st.markdown(html, unsafe_allow_html=True)


def run_optimierung() -> None:
    """Berechnet Optimierung + Wirtschaftlichkeit neu, wenn Daten existieren."""
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


def truck_svg(zusatz_lademeter: float, max_breite: float = 13.6) -> str:
    """Liefert ein einfaches SVG eines LKW mit rot-gestricheltem Zusatzbedarf."""
    if max_breite <= 0:
        max_breite = 13.6
    pct = max(0.0, min(zusatz_lademeter / max_breite, 0.5))
    truck_w = 280
    extra_w = int(truck_w * pct)
    return f"""
    <div class="truck-wrap">
      <svg width="320" height="120" viewBox="0 0 320 120" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="30" width="{truck_w}" height="55" rx="4" fill="#1a2944" stroke="#0f1a30" stroke-width="2"/>
        <rect x="24" y="34" width="{truck_w - 8}" height="47" rx="2" fill="#3b4a6b"/>
        <rect x="{20 + truck_w}" y="40" width="{extra_w}" height="45" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="6,4"/>
        <rect x="0" y="60" width="20" height="25" fill="#1a2944"/>
        <circle cx="60" cy="92" r="10" fill="#374151" stroke="#1f2937" stroke-width="2"/>
        <circle cx="100" cy="92" r="10" fill="#374151" stroke="#1f2937" stroke-width="2"/>
        <circle cx="240" cy="92" r="10" fill="#374151" stroke="#1f2937" stroke-width="2"/>
        <text x="160" y="62" font-size="11" font-family="Arial" fill="#fbbf24" text-anchor="middle" font-weight="700">{max_breite:.1f} m Ladelänge</text>
        <text x="{20 + truck_w + extra_w + 4}" y="65" font-size="10" font-family="Arial" fill="#dc2626" font-weight="700">+{zusatz_lademeter:.2f} m</text>
      </svg>
    </div>
    """


def kosten_chart(wirt: WirtschaftlichkeitsErgebnis) -> go.Figure:
    monate = [1, 2, 3, 6, 12]
    alt = [wirt.gesamtkosten_alt * m for m in monate]
    neu = [wirt.gesamtkosten_neu * m for m in monate]
    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=monate,
            y=alt,
            mode="lines+markers",
            name="Aktuell",
            line=dict(color="#1a2944", width=3),
            marker=dict(size=8),
        )
    )
    fig.add_trace(
        go.Scatter(
            x=monate,
            y=neu,
            mode="lines+markers",
            name="Optimiert",
            line=dict(color="#16a34a", width=3),
            marker=dict(size=8),
        )
    )
    fig.update_layout(
        height=280,
        margin=dict(l=10, r=10, t=10, b=10),
        plot_bgcolor="#ffffff",
        paper_bgcolor="#ffffff",
        xaxis=dict(title="Monate", gridcolor="#e5e7eb", tickmode="array", tickvals=monate),
        yaxis=dict(title="Kosten (€)", gridcolor="#e5e7eb"),
        legend=dict(orientation="h", y=1.1, x=0.0),
    )
    return fig


def header_zeile() -> None:
    col_t, col_a = st.columns([3, 2])
    with col_t:
        st.markdown(
            f"<h2 style='color:#1a2944;margin:0;'>{st.session_state.firma}</h2>"
            "<div style='color:#6b7280;font-size:13px;'>Wirtschaftliche Standardisierung von Industriepaletten</div>",
            unsafe_allow_html=True,
        )
    with col_a:
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
                    "📄 Bestellung (PDF)",
                    data=pdf,
                    file_name=f"bestellung_{date.today().isoformat()}.pdf",
                    mime="application/pdf",
                    use_container_width=True,
                )
            else:
                st.button("📄 Bestellung (PDF)", disabled=True, use_container_width=True)


def sidebar() -> str:
    with st.sidebar:
        st.markdown(
            '<div class="sidebar-logo">📦 Paletten Optimierer</div>'
            '<div class="sidebar-sub">Drahtgitter · Standardisierung</div>',
            unsafe_allow_html=True,
        )
        seite = st.radio(
            "Navigation",
            [
                "Dashboard",
                "Datenimport",
                "Bestand",
                "Bestellungen",
                "Einstellungen",
            ],
            index=0,
            label_visibility="collapsed",
        )
        bestand = lade_bestand()
        gesamt = sum(int(v.get("menge", 0)) for v in bestand.values())
        kritisch = sum(
            1
            for v in bestand.values()
            if bewerte_status(int(v.get("menge", 0)), int(v.get("sicherheitsbestand", 100)))
            == "kritisch"
        )
        st.markdown(
            f"""
            <div class="sidebar-kpi">
              <div class="label">Gesamtbestand</div>
              <div class="value">{gesamt:,}</div>
            </div>
            <div class="sidebar-kpi">
              <div class="label">Kritische Typen</div>
              <div class="value" style="color:{'#fca5a5' if kritisch else '#86efac'};">{kritisch}</div>
            </div>
            """.replace(",", "."),
            unsafe_allow_html=True,
        )
    return seite


def card(titel: str) -> Any:
    container = st.container()
    container.markdown(f'<div class="card"><h3>{titel}</h3>', unsafe_allow_html=True)
    return container


def end_card(container: Any) -> None:
    container.markdown("</div>", unsafe_allow_html=True)


def seite_datenimport() -> None:
    step_indicator()
    c = card("Datenimport")
    upload = c.file_uploader(
        "Excel-Datei (.xlsx) hochladen", type=["xlsx"], accept_multiple_files=False
    )
    col_a, col_b = c.columns([1, 1])
    if col_a.button("📥 Datei laden", use_container_width=True, disabled=upload is None):
        if upload is not None:
            try:
                ps = importiere_excel(upload)
                st.session_state.paletten = ps
                run_optimierung()
                c.success(f"{len(ps)} Paletten geladen.")
            except Exception as exc:
                c.error(f"Fehler beim Import: {exc}")
    if col_b.button("📦 Beispieldaten laden (80 Artikel)", use_container_width=True):
        beispiel_pfad = Path("data") / "beispiel_palettenliste.xlsx"
        if not beispiel_pfad.exists():
            erstelle_beispiel_excel(beispiel_pfad, 80)
        ps = importiere_excel(beispiel_pfad)
        st.session_state.paletten = ps
        run_optimierung()
        c.success(f"{len(ps)} Beispiel-Paletten geladen.")
    end_card(c)

    if st.session_state.paletten:
        c2 = card(f"Importierte Paletten ({len(st.session_state.paletten)})")
        df = pd.DataFrame(
            [
                {
                    "Artikelnummer": p.artikelnummer,
                    "Länge (mm)": p.laenge,
                    "Breite (mm)": p.breite,
                    "Anzahl": p.anzahl,
                    "Stk/Pal": p.stueck_pro_palette,
                    "Kosten alt (€)": p.kosten_alt,
                }
                for p in st.session_state.paletten
            ]
        )
        c2.dataframe(df, use_container_width=True, hide_index=True, height=320)
        end_card(c2)


def seite_bestand() -> None:
    c = card("Bestand pro Palettentyp")
    bestand = lade_bestand()
    benoetigt = {}
    if st.session_state.ergebnis is not None:
        benoetigt = {
            s.label: s.gesamt_anzahl for s in st.session_state.ergebnis.standards
        }
    krit = berechne_kritische_paletten(benoetigt)

    if not krit:
        c.info("Noch kein Bestand erfasst. Lege einen Eintrag pro Palettentyp an.")
    else:
        rows = []
        for k in krit:
            badge_cls = {"ok": "badge-ok", "unter": "badge-unter", "kritisch": "badge-kritisch"}[
                k["status"]
            ]
            rows.append(
                {
                    "Typ": k["typ"],
                    "Bestand": k["menge"],
                    "Sicherheits-Bestand": k["sicherheitsbestand"],
                    "Bedarf": k["benoetigt"],
                    "Zu bestellen": k["zu_bestellen"],
                    "Status": k["status"],
                }
            )
        c.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
    end_card(c)

    c2 = card("Bestand pflegen")
    typ = c2.text_input(
        "Palettentyp",
        value=st.session_state.ergebnis.standards[0].label
        if st.session_state.ergebnis and st.session_state.ergebnis.standards
        else "1500 × 700 mm",
    )
    col_a, col_b, col_c = c2.columns(3)
    menge = col_a.number_input("Aktueller Bestand", min_value=0, value=100, step=10)
    sb = col_b.number_input("Sicherheitsbestand", min_value=0, value=100, step=10)
    if col_c.button("💾 Speichern", use_container_width=True):
        aktualisiere_bestand(typ, menge=int(menge), sicherheitsbestand=int(sb))
        c2.success(f"Bestand für {typ} gespeichert.")
        st.rerun()
    end_card(c2)


def seite_bestellungen() -> None:
    c = card("Bestellhistorie")
    bestellungen = lade_bestellungen()
    if not bestellungen:
        c.info("Noch keine Bestellungen erfasst.")
    else:
        df = pd.DataFrame(
            [
                {
                    "Datum": b.datum[:10],
                    "Auftrag": b.auftragsnummer,
                    "Kunde": b.kunde,
                    "Palettentyp": b.palettentyp,
                    "Menge": b.menge,
                    "Lieferung": b.geplantes_verbrauchsdatum,
                    "Status": b.status,
                    "ID": b.bestell_id[:8],
                }
                for b in sorted(bestellungen, key=lambda x: x.datum, reverse=True)
            ]
        )
        c.dataframe(df, use_container_width=True, hide_index=True)
    end_card(c)

    c2 = card("Bestellung verbuchen / stornieren")
    offen = [b for b in bestellungen if b.status == "offen"]
    if not offen:
        c2.info("Keine offenen Bestellungen.")
    else:
        labels = [
            f"{b.bestell_id[:8]} · {b.palettentyp} · {b.menge} Stk · {b.datum[:10]}"
            for b in offen
        ]
        idx = c2.selectbox(
            "Offene Bestellung wählen", range(len(offen)), format_func=lambda i: labels[i]
        )
        col_v, col_s = c2.columns(2)
        if col_v.button("✅ Verbuchen", use_container_width=True):
            buche_bestellung_in_bestand(offen[idx].bestell_id)
            c2.success("Bestellung verbucht und Bestand aktualisiert.")
            st.rerun()
        if col_s.button("❌ Stornieren", use_container_width=True):
            aktualisiere_bestellstatus(offen[idx].bestell_id, "storniert")
            c2.success("Bestellung storniert.")
            st.rerun()
    end_card(c2)

    c3 = card("Neue Bestellung erfassen")
    if not st.session_state.ergebnis:
        c3.info("Erst Optimierung durchführen, um Standardpaletten zu wählen.")
    else:
        labels = [s.label for s in st.session_state.ergebnis.standards]
        sel = c3.selectbox("Standardpalette", labels)
        col1, col2, col3 = c3.columns(3)
        menge = col1.number_input("Menge", min_value=1, value=50, step=10)
        liefer = col2.date_input("Lieferdatum", value=st.session_state.geplantes_lieferdatum)
        auftrag = col3.text_input("Auftragsnummer", value="")
        if c3.button("➕ Bestellung anlegen", use_container_width=True):
            order = Bestellung.neu(
                palettentyp=sel,
                menge=int(menge),
                geplantes_verbrauchsdatum=liefer,
                auftragsnummer=auftrag,
                kunde=st.session_state.kunde,
            )
            fuege_bestellung_hinzu(order)
            c3.success("Bestellung angelegt.")
            st.rerun()
    end_card(c3)


def seite_einstellungen() -> None:
    c = card("Einstellungen")
    st.session_state.firma = c.text_input("Firmenname", value=st.session_state.firma)
    st.session_state.kunde = c.text_input("Kunde (Default)", value=st.session_state.kunde)
    st.session_state.auftragsnummer = c.text_input(
        "Auftragsnummer (Default)", value=st.session_state.auftragsnummer
    )
    end_card(c)
    c2 = card("Sicherheitsbestand global setzen")
    sb = c2.number_input(
        "Wert", min_value=0, value=int(st.session_state.sicherheitsbestand), step=10
    )
    if c2.button("Auf alle Typen anwenden", use_container_width=True):
        st.session_state.sicherheitsbestand = int(sb)
        setze_sicherheitsbestand_global(int(sb))
        c2.success("Sicherheitsbestand global aktualisiert.")
    end_card(c2)


def kosten_block(spalte: Any) -> None:
    c = spalte.container()
    c.markdown('<div class="card"><h3>Kosten / Logistik</h3>', unsafe_allow_html=True)
    st.session_state.kosten_pro_lkw = c.number_input(
        "Kosten pro LKW (€)",
        min_value=0.0,
        value=float(st.session_state.kosten_pro_lkw),
        step=10.0,
    )
    st.session_state.nutzbare_ladelaenge = c.number_input(
        "Nutzbare Ladelänge (m)",
        min_value=1.0,
        value=float(st.session_state.nutzbare_ladelaenge),
        step=0.1,
    )
    st.session_state.palettenkosten_neu = c.number_input(
        "Palettenkosten neu (€)",
        min_value=0.0,
        value=float(st.session_state.palettenkosten_neu),
        step=0.5,
    )
    st.session_state.palettenkosten_alt = c.number_input(
        "Palettenkosten alt (€, Default)",
        min_value=0.0,
        value=float(st.session_state.palettenkosten_alt),
        step=0.5,
    )
    c.markdown("</div>", unsafe_allow_html=True)


def toleranz_block(spalte: Any) -> None:
    c = spalte.container()
    c.markdown('<div class="card"><h3>Toleranz</h3>', unsafe_allow_html=True)
    einheit = c.radio(
        "Einheit",
        ["mm", "prozent"],
        index=0 if st.session_state.tol_einheit == "mm" else 1,
        horizontal=True,
    )
    st.session_state.tol_einheit = einheit
    if einheit == "mm":
        st.session_state.tol_l = c.number_input(
            "Toleranz Länge (mm)",
            min_value=0.0,
            value=float(st.session_state.tol_l),
            step=10.0,
        )
        st.session_state.tol_b = c.number_input(
            "Toleranz Breite (mm)",
            min_value=0.0,
            value=float(st.session_state.tol_b),
            step=10.0,
        )
    else:
        st.session_state.tol_l = c.number_input(
            "Toleranz Länge (%)",
            min_value=0.0,
            value=float(st.session_state.tol_l),
            step=1.0,
        )
        st.session_state.tol_b = c.number_input(
            "Toleranz Breite (%)",
            min_value=0.0,
            value=float(st.session_state.tol_b),
            step=1.0,
        )
    st.session_state.kombinieren_erlaubt = c.checkbox(
        "Paletten kombinieren erlauben",
        value=st.session_state.kombinieren_erlaubt,
    )
    st.session_state.raster = c.select_slider(
        "Aufrunden auf Raster (mm)", options=[0, 10, 25, 50, 100], value=st.session_state.raster
    )
    c.markdown("</div>", unsafe_allow_html=True)


def planung_block(spalte: Any) -> None:
    c = spalte.container()
    c.markdown('<div class="card"><h3>Planungszeitraum</h3>', unsafe_allow_html=True)
    st.session_state.geplantes_lieferdatum = c.date_input(
        "Geplantes Lieferdatum",
        value=st.session_state.geplantes_lieferdatum,
    )
    st.session_state.auftragsnummer = c.text_input(
        "Auftragsnummer",
        value=st.session_state.auftragsnummer,
    )
    st.session_state.kunde = c.text_input("Kunde", value=st.session_state.kunde)
    c.markdown("</div>", unsafe_allow_html=True)


def sicherheit_block(spalte: Any) -> None:
    c = spalte.container()
    c.markdown('<div class="card"><h3>Sicherheitsbestand</h3>', unsafe_allow_html=True)
    st.session_state.sicherheitsbestand = c.number_input(
        "Default für neue Typen",
        min_value=0,
        value=int(st.session_state.sicherheitsbestand),
        step=10,
    )
    if c.button("📦 Beispieldaten laden", use_container_width=True):
        beispiel_pfad = Path("data") / "beispiel_palettenliste.xlsx"
        if not beispiel_pfad.exists():
            erstelle_beispiel_excel(beispiel_pfad, 80)
        st.session_state.paletten = importiere_excel(beispiel_pfad)
        run_optimierung()
        st.rerun()
    c.markdown("</div>", unsafe_allow_html=True)


def vergleichs_tabelle(wirt: WirtschaftlichkeitsErgebnis) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "Position": "Palettenkosten",
                "Aktuell (€)": round(wirt.palettenkosten_alt, 2),
                "Optimiert (€)": round(wirt.palettenkosten_neu, 2),
                "Differenz (€)": round(wirt.palettenkosten_alt - wirt.palettenkosten_neu, 2),
            },
            {
                "Position": "Logistikkosten",
                "Aktuell (€)": round(wirt.logistikkosten_alt, 2),
                "Optimiert (€)": round(wirt.logistikkosten_neu, 2),
                "Differenz (€)": round(wirt.logistikkosten_alt - wirt.logistikkosten_neu, 2),
            },
            {
                "Position": "Gesamtkosten / Monat",
                "Aktuell (€)": round(wirt.gesamtkosten_alt, 2),
                "Optimiert (€)": round(wirt.gesamtkosten_neu, 2),
                "Differenz (€)": round(wirt.ersparnis, 2),
            },
            {
                "Position": "Hochrechnung 12 Monate",
                "Aktuell (€)": round(wirt.gesamtkosten_alt * 12, 2),
                "Optimiert (€)": round(wirt.gesamtkosten_neu * 12, 2),
                "Differenz (€)": round(wirt.ersparnis * 12, 2),
            },
        ]
    )


def standards_tabelle(erg: OptimierungsErgebnis) -> pd.DataFrame:
    rows = []
    for s in erg.standards:
        rows.append(
            {
                "Standardpalette": s.label,
                "Länge (mm)": int(round(s.laenge)),
                "Breite (mm)": int(round(s.breite)),
                "Anzahl Artikel": len(s.members),
                "Gesamt Paletten": s.gesamt_anzahl,
                "Typ": "Standard",
            }
        )
    for k in erg.kombinationen:
        rows.append(
            {
                "Standardpalette": f"{k.standard_a.label} + {k.standard_b.label}",
                "Länge (mm)": int(round(k.palette.laenge)),
                "Breite (mm)": int(round(k.palette.breite)),
                "Anzahl Artikel": 1,
                "Gesamt Paletten": k.palette.anzahl,
                "Typ": "Kombination aus 2 Paletten",
            }
        )
    return pd.DataFrame(rows)


def kpi_zeile(erg: OptimierungsErgebnis, wirt: WirtschaftlichkeitsErgebnis) -> None:
    html = f"""
    <div class="kpi">
      <div class="kpi-box">
        <div class="label">Eingabe-Typen</div>
        <div class="value">{erg.anzahl_eingabe_typen}</div>
      </div>
      <div class="kpi-box">
        <div class="label">Standards</div>
        <div class="value">{erg.anzahl_standards}</div>
        <div class="delta">−{erg.reduktion_prozent:.0f}%</div>
      </div>
      <div class="kpi-box">
        <div class="label">Ersparnis / Monat</div>
        <div class="value">{wirt.ersparnis:,.0f} €</div>
      </div>
      <div class="kpi-box">
        <div class="label">Ersparnis / Jahr</div>
        <div class="value">{wirt.ersparnis * 12:,.0f} €</div>
      </div>
      <div class="kpi-box">
        <div class="label">Zusatz-Lademeter</div>
        <div class="value">+{wirt.zusatz_lademeter:.1f} m</div>
        <div class="delta bad">je Tour</div>
      </div>
    </div>
    """.replace(",", ".")
    st.markdown(html, unsafe_allow_html=True)


def naechste_schritte() -> None:
    st.markdown(
        """
        <div class="card"><h3>Nächste Schritte</h3>
          <div style="display:flex;gap:12px;">
            <div class="info-box" style="flex:1;">
              <div class="icon">📊</div>
              <div class="title">Bericht prüfen</div>
              <div class="desc">Excel-Bericht herunterladen und im Team teilen.</div>
            </div>
            <div class="info-box" style="flex:1;">
              <div class="icon">📦</div>
              <div class="title">Bestand prüfen</div>
              <div class="desc">Aktuellen Bestand mit Bedarf abgleichen.</div>
            </div>
            <div class="info-box" style="flex:1;">
              <div class="icon">📄</div>
              <div class="title">Bestellung erstellen</div>
              <div class="desc">PDF-Bestellung an den Lieferanten senden.</div>
            </div>
            <div class="info-box" style="flex:1;">
              <div class="icon">🔁</div>
              <div class="title">Iterieren</div>
              <div class="desc">Toleranzen anpassen und neu optimieren.</div>
            </div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    if st.button("🔄 Neue Optimierung starten", use_container_width=True):
        st.session_state.paletten = []
        st.session_state.ergebnis = None
        st.session_state.wirtschaftlichkeit = None
        st.rerun()


def seite_dashboard() -> None:
    step_indicator()

    if not st.session_state.paletten:
        c = card("Datenimport")
        c.write(
            "Lade eine Excel-Datei mit Palettenliste oder verwende Beispieldaten, "
            "um zu starten."
        )
        col_a, col_b = c.columns(2)
        upload = col_a.file_uploader(
            "Excel-Datei (.xlsx)", type=["xlsx"], key="upload_dash"
        )
        if upload is not None:
            try:
                st.session_state.paletten = importiere_excel(upload)
                run_optimierung()
                st.rerun()
            except Exception as exc:
                c.error(f"Import-Fehler: {exc}")
        if col_b.button("📦 Beispieldaten laden (80 Artikel)", use_container_width=True):
            beispiel_pfad = Path("data") / "beispiel_palettenliste.xlsx"
            if not beispiel_pfad.exists():
                erstelle_beispiel_excel(beispiel_pfad, 80)
            st.session_state.paletten = importiere_excel(beispiel_pfad)
            run_optimierung()
            st.rerun()
        end_card(c)
        return

    erg = st.session_state.ergebnis
    wirt = st.session_state.wirtschaftlichkeit
    if erg is None or wirt is None:
        run_optimierung()
        erg = st.session_state.ergebnis
        wirt = st.session_state.wirtschaftlichkeit

    kpi_zeile(erg, wirt)

    col_links, col_rechts = st.columns([1, 2])

    with col_links:
        toleranz_block(col_links)
        planung_block(col_links)
        kosten_block(col_links)
        sicherheit_block(col_links)
        if col_links.button("🔄 Neu optimieren", use_container_width=True, type="primary"):
            run_optimierung()
            st.rerun()

    with col_rechts:
        c1 = card(f"Optimierungs-Ergebnis · {erg.anzahl_standards} Standards")
        df_std = standards_tabelle(erg)
        c1.dataframe(df_std, use_container_width=True, hide_index=True)
        end_card(c1)

        sub_a, sub_b, sub_c = col_rechts.columns([2, 2, 3])
        with sub_a:
            cv = card("Wirtschaftlichkeitsvergleich")
            cv.dataframe(
                vergleichs_tabelle(wirt), use_container_width=True, hide_index=True
            )
            end_card(cv)
        with sub_b:
            cl = card("Logistik-Analyse")
            cl.markdown(
                truck_svg(wirt.zusatz_lademeter, st.session_state.nutzbare_ladelaenge),
                unsafe_allow_html=True,
            )
            cl.metric(
                "Lademeter je Tour",
                f"{wirt.basis_lademeter_neu:.1f} m",
                f"+{wirt.zusatz_lademeter:.2f} m",
                delta_color="inverse",
            )
            end_card(cl)
        with sub_c:
            cc = card("Kostenverlauf 12 Monate")
            cc.plotly_chart(kosten_chart(wirt), use_container_width=True)
            end_card(cc)

    naechste_schritte()


def main() -> None:
    init_state()
    seite = sidebar()
    header_zeile()

    if seite == "Dashboard":
        seite_dashboard()
    elif seite == "Datenimport":
        seite_datenimport()
    elif seite == "Bestand":
        seite_bestand()
    elif seite == "Bestellungen":
        seite_bestellungen()
    elif seite == "Einstellungen":
        seite_einstellungen()


if __name__ == "__main__":
    main()
