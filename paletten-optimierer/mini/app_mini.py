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
from datetime import datetime
from html import escape
from pathlib import Path

import pandas as pd
import streamlit as st

HIER = Path(__file__).resolve().parent
if str(HIER) not in sys.path:
    sys.path.insert(0, str(HIER))

from import_excel import importiere  # noqa: E402
from optimierer_kern import optimiere  # noqa: E402
from import_verlauf import (  # noqa: E402
    neuer_eintrag, update_optimierung, alle as verlauf_alle,
    finde_per_hash, leere_verlauf, hash_bytes, verlauf_pfad_str,
)
from _render import render_zuord_table, ziel_label as _ziel_label  # noqa: E402
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
        "historie_id": None,       # uuid des aktuellen Historie-Eintrags
        "params": {                # Kern-v2-Parameter
            "tol_mm": 200,            # max. Übermaß (mm), Default 200
            "kombinieren": True,      # Boolean — Default an
            "max_kombi_teile": 3,
            "sonder_deckel_aktiv": False,
            "sonder_deckel": 5,
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
    SEITEN_LISTE = ["Datenimport", "Einstellungen", "Optimierung",
                    "Ergebnisse", "Verlauf"]
    if st.session_state.seite not in SEITEN_LISTE:
        st.session_state.seite = "Datenimport"
    seite_neu = st.radio(
        "Seite",
        SEITEN_LISTE,
        index=SEITEN_LISTE.index(st.session_state.seite),
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
        # Vor-Import: gleiche Datei schon mal verarbeitet?
        st.session_state.duplikat_hinweise = []
        try:
            sha = hash_bytes(roh)
            treffer = finde_per_hash(sha)
            if treffer:
                for t in treffer:
                    st.session_state.duplikat_hinweise.append(
                        f"Diese Datei wurde am {t.get('datum','?')[:16].replace('T',' ')} "
                        f"schon importiert (als '{t.get('datei_name','?')}')."
                    )
        except Exception:
            pass

        with st.spinner(f"Lese {up.name} ({len(roh) / 1024:.0f} KB) ..."):
            dat = importiere(io.BytesIO(roh))
        st.session_state.datei_name = up.name
        st.session_state.import_dat = dat
        st.session_state.ergebnis = None
        # Verlaufseintrag schreiben (persistent im User-Profil)
        try:
            st.session_state.historie_id = neuer_eintrag(
                datei_pfad=up.name,
                ergebnis=dat,
                datei_bytes=roh,
            )
        except Exception as exc:  # noqa: BLE001 — Verlauf darf Import nicht blockieren
            st.session_state.historie_id = None
            st.warning(f"Verlauf konnte nicht geschrieben werden: {exc}")
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

    # Duplikat-Hinweise (vor-Import-Check per SHA256)
    for hinweis in st.session_state.get("duplikat_hinweise", []):
        st.info(hinweis)

    # Diagnose-Box (Spec-Soll-Werte sichtbar)
    mit_n = len(dat["mit_mass"])
    ohne_n = len(dat["ohne_mass"])
    paletten_summe = dat.get("paletten_gesamt",
                              sum(p["anzahl"] for p in dat["mit_mass"]))
    unique_n = dat.get("unique_normalisierte_masse", 0)
    st.markdown(
        f'<div class="diag-box">'
        f'<div class="title">📊 Import-Diagnose</div>'
        f'<div><b>Datei:</b> {escape(st.session_state.datei_name)}</div>'
        f'<div><b>Header in Datei-Zeile:</b> {dat["header_zeile"]} · '
        f'<b>Datenzeilen nach Filter:</b> {dat.get("datenzeilen_gesamt", mit_n+ohne_n)}</div>'
        f'<div><b>Aufträge mit Maß:</b> {mit_n} · '
        f'<b>ohne Maß:</b> {ohne_n} · '
        f'<b>Paletten gesamt:</b> {paletten_summe} · '
        f'<b>Unique normalisierte Maße:</b> {unique_n}</div>'
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
            "max. Übermaß (mm)", min_value=0, max_value=2000,
            value=int(p["tol_mm"]), step=10, key="tol_mm_in",
            help="Wieviel mm darf der gewählte Standard über die Auftragsmaße "
                 "hinausgehen (in jeder Dimension). Standard ≥ Last ist immer "
                 "garantiert (einseitige Coverage, physisch korrekt).",
        )
        card_close()

        card_open("Kombinieren")
        p["kombinieren"] = st.toggle(
            "Kombi-Fallback aktiv",
            value=bool(p.get("kombinieren", True)),
            key="kombi_in",
            help="Wenn aktiv: Aufträge, die kein einzelner Standard abdeckt, "
                 "werden per Kombination aus 2 bis 3 GEWÄHLTEN Standards "
                 "abgedeckt (Typ A + Typ B). Spart Sonderpaletten.",
        )
        card_close()

        card_open("Sonder-Deckel")
        p["sonder_deckel_aktiv"] = st.toggle(
            "Anzahl Sonderpaletten begrenzen",
            value=bool(p.get("sonder_deckel_aktiv", False)),
            key="sd_a",
            help="Begrenzt die Anzahl unterschiedlicher Sonder-Maße im "
                 "Ergebnis. Mehr Sonder erlaubt → weniger Standards möglich.",
        )
        if p["sonder_deckel_aktiv"]:
            p["sonder_deckel"] = st.number_input(
                "max. verschiedene Sonder",
                min_value=0, max_value=500,
                value=int(p.get("sonder_deckel", 5)),
                step=1, key="sd_n",
            )
        else:
            st.caption("Unbegrenzt — der Solver entscheidet.")
        card_close()

    with col_r:
        card_open("In der Mini-Version nicht verfügbar")
        for feat in [
            "Wirtschaftlichkeits-Optimierung",
            "Höhe als 3. Dimension",
            "Lade-Raster",
            "Mengen-Schwelle (bewusst entfernt)",
            "Coverage zweiseitig (physisch ausgeschlossen)",
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

    # Mini-Format -> Kern-v2-Format. WICHTIG: L/B sind die PRODUKT-Maße
    # (Excel P-L/P-B minus PALETTEN_AUFSCHLAG_MM, im Importer berechnet).
    orders = [
        {"L": pal["laenge"], "B": pal["breite"], "menge": pal["anzahl"],
         "auftrag": pal["auftrag"], "name": pal["name"]}
        for pal in mit_mass
    ]
    # Pro Auftrag artikelnummer + Roh-Palettenmaße fuer die UI-Anzeige
    # mitschleppen (Kern braucht sie nicht).
    artikel_lookup = [pal.get("artikelnummer", "") for pal in mit_mass]
    palette_excel_lookup = [
        (pal.get("palette_L_excel"), pal.get("palette_B_excel"))
        for pal in mit_mass
    ]

    deckel = (int(p["sonder_deckel"])
              if p.get("sonder_deckel_aktiv") else None)
    hinweis = (f"ILP-Solver (CBC) optimiert {len(orders)} Aufträge — "
               f"Übermaß ≤ {int(p['tol_mm'])} mm, "
               f"Kombi {'an' if p['kombinieren'] else 'aus'}, "
               f"Sonder-Deckel {deckel if deckel is not None else 'frei'}.")
    with st.spinner(hinweis):
        res = optimiere(
            orders,
            tol_mm=int(p["tol_mm"]),
            kombinieren=bool(p.get("kombinieren", True)),
            max_kombi_teile=int(p.get("max_kombi_teile", 3)),
            zeitlimit_s=120,
            sonder_deckel=deckel,
        )
    # Artikelnummer + Roh-Palettenmaße aus Excel nachreichen
    for idx, zg in enumerate(res.get("zuordnung", [])):
        zg["artikelnummer"] = (artikel_lookup[idx]
                                if idx < len(artikel_lookup) else "")
        if idx < len(palette_excel_lookup):
            pL, pB = palette_excel_lookup[idx]
            zg["palette_L_excel"] = pL
            zg["palette_B_excel"] = pB
    st.session_state.ergebnis = res

    # Optimierungs-Block in der Historie ergaenzen
    hist_id = st.session_state.get("historie_id")
    if hist_id:
        try:
            update_optimierung(hist_id, {
                "zeitstempel": datetime.now().isoformat(timespec="seconds"),
                "parameter": {
                    "tol_mm": int(p["tol_mm"]),
                    "kombinieren": bool(p.get("kombinieren", True)),
                    "max_kombi_teile": int(p.get("max_kombi_teile", 3)),
                    "sonder_deckel": deckel,
                    "coverage": "einseitig",
                },
                "ergebnis": {
                    "standards": len(res.get("standards", [])),
                    "sonder": len(res.get("sonder", [])),
                    "gesamt": int(res.get("gesamt", 0)),
                    "invariante_ok": bool(res.get("invariante_ok", True)),
                    "verletzungen": len(res.get("verletzungen", [])),
                    "status": res.get("status", ""),
                },
            })
        except Exception:
            pass  # Historie ist Bonus, nie kritisch


def seite_optimierung() -> None:
    if st.session_state.import_dat is None:
        st.info("Erst Daten importieren.")
        return
    p = st.session_state.params

    col_l, col_r = st.columns([1, 2])
    with col_l:
        card_open("Aktuelle Parameter")
        deckel = (int(p["sonder_deckel"]) if p.get("sonder_deckel_aktiv")
                  else "frei")
        st.markdown(
            f"<div style='font-size:13px;color:#374151;line-height:1.8;'>"
            f"<b>max. Übermaß:</b> {int(p['tol_mm'])} mm<br>"
            f"<b>Kombinieren:</b> {'an' if p['kombinieren'] else 'aus'}<br>"
            f"<b>Sonder-Deckel:</b> {deckel}<br>"
            f"<b>Coverage:</b> einseitig (Standard ≥ Last)"
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

    # === Physikalische Invariante — rotes Banner wenn verletzt ===
    if not res.get("invariante_ok", True):
        verl = res.get("verletzungen", [])
        beispiele = "".join(
            f'<div style="font-size:11px;margin-top:4px;'
            f'font-family:ui-monospace,monospace;background:rgba(255,255,255,0.18);'
            f'padding:4px 8px;border-radius:4px;">• AW {escape(str(v.get("auftrag", "")))} '
            f'Last {v.get("L")}×{v.get("B")} → Ziel {escape(str(v.get("ziel", "")))} '
            f'({escape(str(v.get("typ", "")))})</div>'
            for v in verl[:5]
        )
        st.markdown(
            f'<div style="background:#dc2626;color:#fff;padding:14px 18px;'
            f'border-radius:8px;margin-bottom:14px;font-size:14px;'
            f'box-shadow:0 4px 12px rgba(220,38,38,0.25);">'
            f'<div style="font-weight:800;font-size:16px;">'
            f'⚠ PHYSIKALISCH UNGÜLTIG — {len(verl)} Verletzung(en)</div>'
            f'<div style="margin-top:6px;">Bei mindestens einer Zuordnung ist '
            f'die Last GRÖSSER als die zugewiesene Palette. '
            f'<b>Ergebnis darf nicht produktiv genutzt werden.</b></div>'
            f'{beispiele}'
            f'</div>',
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

    # Trade-off-Zeile mit Kern-v2-Parametern + Invariante-Status.
    p = st.session_state.params
    inv_text = ("Invariante OK" if res.get("invariante_ok", True)
                else f"INVARIANTE VERLETZT ({len(res.get('verletzungen', []))})")
    inv_color = "#16a34a" if res.get("invariante_ok", True) else "#dc2626"
    deckel_txt = (str(int(p["sonder_deckel"]))
                  if p.get("sonder_deckel_aktiv") else "frei")
    st.markdown(
        f'<div style="background:#f8fafc;border:1px solid #e2e8f0;'
        f'border-radius:6px;padding:8px 12px;margin:8px 0 16px;'
        f'font-size:12px;color:#475569;">'
        f'⚙️ max. Übermaß = {int(p["tol_mm"])} mm · '
        f'Kombinieren = {"an" if p["kombinieren"] else "aus"} · '
        f'Sonder-Deckel = {deckel_txt} · '
        f'Coverage = einseitig · ILP-Status = {res.get("status", "?")} · '
        f'<span style="color:{inv_color};font-weight:700;">{inv_text}</span>'
        f'</div>',
        unsafe_allow_html=True,
    )


def seite_ergebnisse() -> None:
    if st.session_state.ergebnis is None:
        st.info("Erst optimieren.")
        return
    res = st.session_state.ergebnis

    kpi_uebersicht()

    # === Inline-Anpassung: Übermaß + Kombi-Toggle + Sonder-Deckel ===
    card_open("🔁 Parameter anpassen und neu rechnen")
    p = st.session_state.params
    c1, c2, c3, c4 = st.columns([1.2, 1, 1, 1.2])
    with c1:
        p["tol_mm"] = st.number_input(
            "max. Übermaß (mm)", min_value=0, max_value=2000,
            value=int(p["tol_mm"]), step=10, key="erg_tol",
            help="Standard ≥ Last in beiden Dimensionen, höchstens X mm größer.",
        )
    with c2:
        p["kombinieren"] = st.toggle(
            "Kombi-Fallback aktiv",
            value=bool(p.get("kombinieren", True)),
            key="erg_kombi",
            help="Aufträge ohne einzelnen passenden Standard werden per "
                 "Kombination aus 2-3 gewählten Standards abgedeckt.",
        )
    with c3:
        p["sonder_deckel_aktiv"] = st.toggle(
            "Sonder-Deckel",
            value=bool(p.get("sonder_deckel_aktiv", False)),
            key="erg_sd_a",
        )
    with c4:
        if p["sonder_deckel_aktiv"]:
            p["sonder_deckel"] = st.number_input(
                "max. verschiedene Sonder",
                min_value=0, max_value=500,
                value=int(p.get("sonder_deckel", 5)),
                step=1, key="erg_sd_n",
            )
        else:
            st.caption("Sonder unbegrenzt.")
    if st.button("🔄 Neu optimieren mit diesen Werten",
                 type="primary", use_container_width=True, key="erg_rerun"):
        run_optimierung()
        st.rerun()
    card_close()

    if res.get("status") != "Optimal":
        st.warning(f"ILP-Status: {res.get('status')} — Ergebnis evtl. nicht beweisbar optimal.")

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

    # CSV-Export — Kern-v2-Format
    rows = []
    for z in res["zuordnung"]:
        rows.append({
            "Auftrag": z.get("auftrag", ""),
            "Kunde": z.get("name", ""),
            "Artikelnummer": z.get("artikelnummer", ""),
            "Paletten (Menge)": z.get("menge", 0),
            "Excel P-L": z.get("palette_L_excel", ""),
            "Excel P-B": z.get("palette_B_excel", ""),
            "Produkt L (= P-L - Aufschlag)": z.get("L", 0),
            "Produkt B (= P-B - Aufschlag)": z.get("B", 0),
            "Ziel": z.get("ziel", ""),
            "Typ": z.get("typ", ""),
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
# Seite 5: Verlauf
# ---------------------------------------------------------------------------
def _fmt_datum(iso: str) -> str:
    """ISO8601 → 'DD.MM.YYYY HH:MM'"""
    try:
        dt = datetime.fromisoformat(iso)
        return dt.strftime("%d.%m.%Y %H:%M")
    except Exception:
        return iso[:16]


def seite_verlauf() -> None:
    eintraege = verlauf_alle()
    card_open(f"Import-Verlauf ({len(eintraege)} Eintr&auml;ge)")
    if not eintraege:
        st.info("Noch kein Import — der Verlauf wird beim ersten Upload "
                "automatisch angelegt.")
        st.caption(f"Speicherort: {verlauf_pfad_str()}")
        card_close()
        return

    # Tabelle, neueste oben
    df_rows = []
    for e in eintraege:
        erg = e.get("ergebnis", {}) or {}
        opt = e.get("optimierung")
        if opt:
            opt_erg = opt.get("ergebnis", {}) or {}
            opt_txt = f"{opt_erg.get('standards', '?')}+{opt_erg.get('sonder', '?')}"
        else:
            opt_txt = "—"
        df_rows.append({
            "Datum": _fmt_datum(e.get("datum", "")),
            "Datei": e.get("datei_name", ""),
            "Datenzeilen": erg.get("datenzeilen", 0),
            "mit Maß": erg.get("auftraege_mit_mass", 0),
            "Paletten gesamt": erg.get("paletten_gesamt", 0),
            "letzte Optimierung": opt_txt,
            "id": e.get("id", ""),
        })
    df = pd.DataFrame(df_rows)
    st.dataframe(
        df.drop(columns=["id"]),
        use_container_width=True, hide_index=True, height=320,
    )

    # Auswahl per selectbox -> Expander mit allen Feldern
    ids = [r["id"] for r in df_rows]
    auswahl_label = st.selectbox(
        "Eintrag-Details anzeigen",
        options=range(len(df_rows)),
        format_func=lambda i: f"{df_rows[i]['Datum']} — {df_rows[i]['Datei']}",
        key="verlauf_auswahl",
    )
    eintrag = next((e for e in eintraege if e["id"] == ids[auswahl_label]), None)
    if eintrag:
        sha = eintrag.get("datei_hash_sha256", "")
        sha_kurz = sha[:12] + "…" if len(sha) > 12 else sha
        with st.expander(f"Details: {eintrag.get('datei_name','?')} "
                          f"({_fmt_datum(eintrag.get('datum',''))})",
                          expanded=True):
            col1, col2 = st.columns(2)
            with col1:
                st.markdown(f"**ID:** `{eintrag.get('id','')}`")
                st.markdown(f"**Datum:** {eintrag.get('datum','')}")
                st.markdown(f"**Datei:** {eintrag.get('datei_name','')}")
                st.markdown(f"**Original-Pfad:** "
                            f"`{eintrag.get('datei_pfad_original','') or '—'}`")
                st.markdown(f"**Größe:** {eintrag.get('datei_groesse_bytes',0):,} bytes"
                            .replace(",", "."))
            with col2:
                erg = eintrag.get("ergebnis", {})
                st.markdown(f"**Datenzeilen:** {erg.get('datenzeilen', 0)}")
                st.markdown(f"**Aufträge mit Maß:** {erg.get('auftraege_mit_mass', 0)}")
                st.markdown(f"**Aufträge ohne Maß:** {erg.get('auftraege_ohne_mass', 0)}")
                st.markdown(f"**Paletten gesamt:** {erg.get('paletten_gesamt', 0)}")
                st.markdown(f"**Normalisierte Maße:** {erg.get('normalisierte_masse', 0)}")
            st.markdown(f"**SHA256:** `{sha_kurz}`")
            st.code(sha, language=None)
            opt = eintrag.get("optimierung")
            if opt:
                st.markdown("**Letzte Optimierung:**")
                st.json(opt)
            else:
                st.caption("Noch nicht optimiert.")

    st.divider()
    st.caption(f"Verlauf gespeichert in: {verlauf_pfad_str()}")
    col_l, col_r = st.columns([3, 1])
    with col_r:
        if st.session_state.get("verlauf_loeschen_bestaetigen"):
            if st.button("⚠️ JA, endgültig löschen", type="primary",
                          use_container_width=True, key="verlauf_del_yes"):
                n = leere_verlauf()
                st.session_state.verlauf_loeschen_bestaetigen = False
                st.success(f"{n} Eintr&auml;ge geloescht.")
                st.rerun()
            if st.button("Abbrechen", use_container_width=True, key="verlauf_del_no"):
                st.session_state.verlauf_loeschen_bestaetigen = False
                st.rerun()
        else:
            if st.button("🗑️ Verlauf leeren", use_container_width=True,
                          key="verlauf_del_btn"):
                st.session_state.verlauf_loeschen_bestaetigen = True
                st.rerun()
    card_close()


# ---------------------------------------------------------------------------
# Page-Router
# ---------------------------------------------------------------------------
SEITEN = {
    "Datenimport":   seite_datenimport,
    "Einstellungen": seite_einstellungen,
    "Optimierung":   seite_optimierung,
    "Ergebnisse":    seite_ergebnisse,
    "Verlauf":       seite_verlauf,
}
SEITEN[st.session_state.seite]()
