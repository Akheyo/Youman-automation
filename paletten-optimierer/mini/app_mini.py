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
import palettenkatalog as katalog_modul  # noqa: E402
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
        "historie_id": None,       # uuid des aktuellen Verlauf-Eintrags
        "params": {                # Kern-v4-Parameter (FINAL LOCK Defaults)
            "tol_kurz_mm": 200,
            "tol_lang_mm": 400,
            "kombinieren": True,
            "sonder_deckel_aktiv": True,
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
    SEITEN_LISTE = [
        "Dashboard",
        "Datenimport",
        "Einstellungen",
        "Optimierung",
        "Ergebnisse",
        "Verlauf",
        "Katalog",
        "Bestand & Disposition",
        "Bestellungen",
        "Kostenanalyse",
        "Stammdaten",
        "Berichte",
        "App-Einstellungen",
    ]
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

    sidebar_section("Info")
    st.markdown(
        '<div style="font-size:10px;color:#64748b;padding:4px 18px;'
        'line-height:1.5;">'
        'Persistente Daten im Profil:<br>'
        '<code style="color:#94a3b8;">~/.palettenmini/</code><br>'
        '└─ import_verlauf.json<br>'
        '└─ palettenkatalog.json'
        '</div>',
        unsafe_allow_html=True,
    )


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
        try:
            st.session_state.historie_id = neuer_eintrag(
                datei_pfad=up.name,
                ergebnis=dat,
                datei_bytes=roh,
            )
        except Exception as exc:  # noqa: BLE001
            st.session_state.historie_id = None
            st.warning(f"Verlauf konnte nicht geschrieben werden: {exc}")
        # Auto-Optimierung mit Defaults (FINAL LOCK Punkt 10)
        if dat.get("mit_mass"):
            run_optimierung()
            st.session_state.seite = "Ergebnisse"
        else:
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
        card_open("Toleranz (getrennt nach Achse)")
        p["tol_kurz_mm"] = st.number_input(
            "max. Übermaß BREITE (mm)", min_value=0, max_value=2000,
            value=int(p["tol_kurz_mm"]), step=10, key="tol_kurz_in",
            help="Übermaß auf der kurzen Achse. Standard ≥ Last ist garantiert.",
        )
        p["tol_lang_mm"] = st.number_input(
            "max. Übermaß LÄNGE (mm)", min_value=0, max_value=2000,
            value=int(p["tol_lang_mm"]), step=10, key="tol_lang_in",
            help="Übermaß auf der langen Achse. Sweet-Spot 400 (12 Standards).",
        )
        card_close()

        card_open("Kombinieren")
        p["kombinieren"] = st.toggle(
            "Kombinieren aktiv",
            value=bool(p.get("kombinieren", True)),
            key="kombi_in",
            help="ON = max_kombi_teile=3 + heterogen_fallback=True. "
                 "OFF = nur Einzel-Standards, keine Kombinationen.",
        )
        card_close()

        card_open("Sonder-Deckel")
        p["sonder_deckel_aktiv"] = st.toggle(
            "Sonder-Deckel aktiv",
            value=bool(p.get("sonder_deckel_aktiv", True)),
            key="sd_a",
            help="ON = max. Anzahl verschiedener Sonder-Maße ist begrenzt. "
                 "OFF = unbegrenzt (Optimierer entscheidet).",
        )
        p["sonder_deckel"] = st.number_input(
            "Max. Sonderpaletten erlaubt",
            min_value=0, max_value=500,
            value=int(p.get("sonder_deckel", 5)),
            step=1, key="sd_n",
            disabled=not p["sonder_deckel_aktiv"],
            help="Greift nur wenn der Toggle 'Sonder-Deckel aktiv' an ist.",
        )
        card_close()

    with col_r:
        card_open("Auf separaten Seiten")
        st.markdown(
            '<div style="font-size:13px;color:#475569;line-height:1.8;">'
            '<b>Katalog</b> — Paletten mit Preisen + Bestand + Meldebestand<br>'
            '<b>Bestand &amp; Disposition</b> — Lagerübersicht + Nachbestellbedarf<br>'
            '<b>Kostenanalyse</b> — Marge pro Standard nach Optimierung<br>'
            '<b>Verlauf</b> — alle Imports persistent gespeichert<br>'
            '<b>Bestellungen</b> — Anlage von Bestellvorgängen<br>'
            '<b>Berichte</b> — Exporte als CSV/Excel/PDF<br>'
            '<b>Stammdaten</b> — z.B. Palettenaufschlag (50 mm)<br>'
            '<b>App-Einstellungen</b> — Konfiguration und Speicherorte'
            '</div>',
            unsafe_allow_html=True,
        )
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

    # Mini-Format -> Kern-v4-Format. L/B sind die PRODUKT-Maße
    # (Excel P-L/P-B minus PALETTEN_AUFSCHLAG_MM, im Importer berechnet).
    orders = [
        {"L": pal["laenge"], "B": pal["breite"], "menge": pal["anzahl"],
         "auftrag": pal["auftrag"], "name": pal["name"]}
        for pal in mit_mass
    ]
    artikel_lookup = [pal.get("artikelnummer", "") for pal in mit_mass]
    palette_excel_lookup = [
        (pal.get("palette_L_excel"), pal.get("palette_B_excel"))
        for pal in mit_mass
    ]

    # Toggle-Verdrahtung 1:1 nach FINAL-LOCK-Spec:
    #   Kombi ON  -> max_kombi_teile=3, heterogen_fallback=True
    #   Kombi OFF -> max_kombi_teile=1, heterogen_fallback=False
    kombi = bool(p.get("kombinieren", True))
    deckel = (int(p["sonder_deckel"])
              if p.get("sonder_deckel_aktiv") else None)

    hinweis = (f"ILP-Solver (CBC) optimiert {len(orders)} Aufträge — "
               f"Übermaß B≤{int(p['tol_kurz_mm'])}mm L≤{int(p['tol_lang_mm'])}mm, "
               f"Kombi {'an' if kombi else 'aus'}, "
               f"Sonder-Deckel {deckel if deckel is not None else 'frei'}.")
    # Katalog-Maße als Tie-Breaker mitgeben (bevorzugt aber nicht erzwingend)
    try:
        kat_masse = katalog_modul.aktive_masse()
    except Exception:
        kat_masse = []
    with st.spinner(hinweis):
        res = optimiere(
            orders,
            tol_kurz_mm=int(p["tol_kurz_mm"]),
            tol_lang_mm=int(p["tol_lang_mm"]),
            max_kombi_teile=3 if kombi else 1,
            heterogen_fallback=kombi,
            sonder_deckel=deckel,
            zeitlimit_s=120,
            katalog=kat_masse,
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

    # Verlauf ergaenzen (Kern-v4-Schema)
    hist_id = st.session_state.get("historie_id")
    if hist_id:
        try:
            update_optimierung(hist_id, {
                "zeitstempel": datetime.now().isoformat(timespec="seconds"),
                "tol_kurz_mm": int(p["tol_kurz_mm"]),
                "tol_lang_mm": int(p["tol_lang_mm"]),
                "kombinieren": kombi,
                "sonder_deckel": deckel,
                "standards": len(res.get("standards", [])),
                "sonder": len(res.get("sonder", [])),
                "gesamt": int(res.get("gesamt", 0)),
                "invariante_ok": bool(res.get("invariante_ok", True)),
                "status": res.get("status", ""),
            })
        except Exception:
            pass  # Verlauf ist Bonus, nie kritisch


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
            f"<b>max. Übermaß BREITE:</b> {int(p['tol_kurz_mm'])} mm<br>"
            f"<b>max. Übermaß LÄNGE:</b> {int(p['tol_lang_mm'])} mm<br>"
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

    # Trade-off-Zeile = SINGLE SOURCE OF TRUTH (aus res['parameter']!)
    # NICHT aus session_state — zeigt genau das was an optimiere() ging.
    inv_text = ("Invariante OK" if res.get("invariante_ok", True)
                else f"INVARIANTE VERLETZT ({len(res.get('verletzungen', []))})")
    inv_color = "#16a34a" if res.get("invariante_ok", True) else "#dc2626"
    rparam = res.get("parameter", {}) or {}
    deckel_real = rparam.get("sonder_deckel")
    deckel_txt = "frei" if deckel_real is None else str(int(deckel_real))
    kombi_real = bool(rparam.get("heterogen_fallback")) and int(rparam.get("max_kombi_teile", 1)) > 1
    st.markdown(
        f'<div style="background:#f8fafc;border:1px solid #e2e8f0;'
        f'border-radius:6px;padding:8px 12px;margin:8px 0 16px;'
        f'font-size:12px;color:#475569;">'
        f'⚙️ max. Übermaß: BREITE {int(rparam.get("tol_kurz_mm", 0))}mm · '
        f'LÄNGE {int(rparam.get("tol_lang_mm", 0))}mm · '
        f'Kombinieren = {"an" if kombi_real else "aus"} · '
        f'Sonder-Deckel = {deckel_txt} · '
        f'Coverage = einseitig · '
        f'ILP-Status = {res.get("status", "?")} · '
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

    # === Inline-Anpassung: 4 Eingaben gem. FINAL-LOCK-Spec ===
    card_open("🔁 Parameter anpassen und neu rechnen")
    p = st.session_state.params
    c1, c2, c3, c4 = st.columns([1.2, 1.2, 1, 1.2])
    with c1:
        p["tol_kurz_mm"] = st.number_input(
            "max. Übermaß BREITE (mm)", min_value=0, max_value=2000,
            value=int(p["tol_kurz_mm"]), step=10, key="erg_tol_kurz",
        )
        p["tol_lang_mm"] = st.number_input(
            "max. Übermaß LÄNGE (mm)", min_value=0, max_value=2000,
            value=int(p["tol_lang_mm"]), step=10, key="erg_tol_lang",
        )
    with c2:
        p["kombinieren"] = st.toggle(
            "Kombinieren aktiv",
            value=bool(p.get("kombinieren", True)),
            key="erg_kombi",
            help="ON = Stapel + heterogene Kombi erlaubt. OFF = nur Einzel.",
        )
    with c3:
        p["sonder_deckel_aktiv"] = st.toggle(
            "Sonder-Deckel aktiv",
            value=bool(p.get("sonder_deckel_aktiv", True)),
            key="erg_sd_a",
        )
    with c4:
        p["sonder_deckel"] = st.number_input(
            "Max. Sonderpaletten erlaubt",
            min_value=0, max_value=500,
            value=int(p.get("sonder_deckel", 5)),
            step=1, key="erg_sd_n",
            disabled=not p["sonder_deckel_aktiv"],
        )
    if st.button("🔄 Neu optimieren mit diesen Werten",
                 type="primary", use_container_width=True, key="erg_rerun"):
        run_optimierung()
        st.rerun()
    card_close()

    # Physikalisch ungültig: GROSSES rotes Banner ueber den KPIs (Punkt 8)
    if not res.get("invariante_ok", True):
        verl = res.get("verletzungen", [])
        st.markdown(
            f'<div style="background:#dc2626;color:#fff;padding:14px 18px;'
            f'border-radius:8px;margin:0 0 14px 0;font-size:14px;'
            f'box-shadow:0 4px 12px rgba(220,38,38,0.25);">'
            f'<div style="font-weight:800;font-size:16px;">'
            f'⚠ PHYSIKALISCH UNGÜLTIG — Lasten passen nicht auf Paletten'
            f'</div>'
            f'<div style="margin-top:6px;">'
            f'{len(verl)} Verletzung(en) — Ergebnis darf NICHT '
            f'produktiv genutzt werden.</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

    if res.get("status") != "Optimal":
        st.warning(f"ILP-Status: {res.get('status')} — Ergebnis evtl. nicht beweisbar optimal.")

    # Katalog-Maße fuer die K-Badges + Wirtschaftlichkeit
    try:
        katalog_set = set(katalog_modul.aktive_masse())
    except Exception:
        katalog_set = set()

    # Wirtschaftlichkeit: nur fuer Standards die im Katalog sind und Preise haben
    wirt_zeilen = []
    if katalog_set:
        # Pro Standard: Anzahl direkter Standard-Zuordnungen + Σ Menge
        from collections import defaultdict
        std_mengen = defaultdict(int)
        for z in res.get("zuordnung", []):
            if z.get("typ") == "Standard":
                try:
                    a, b = z["ziel"].split("x")
                    canon = (min(int(a), int(b)), max(int(a), int(b)))
                    std_mengen[canon] += int(z.get("menge", 0))
                except Exception:
                    pass
        for s, menge in std_mengen.items():
            preise = katalog_modul.lookup_preise(s[1], s[0])  # L=max, B=min
            if preise:
                ek = preise["einkaufspreis_eur"] * menge
                vk = preise["verkaufspreis_eur"] * menge
                wirt_zeilen.append({
                    "Standard (mm)": f"{s[1]} × {s[0]}",
                    "Paletten": menge,
                    "Einkauf gesamt (€)": ek,
                    "Verkauf gesamt (€)": vk,
                    "Marge (€)": vk - ek,
                })

    if wirt_zeilen:
        card_open(f"💰 Wirtschaftlichkeit (Katalog-Treffer)")
        df_wirt = pd.DataFrame(wirt_zeilen)
        summe_ek = df_wirt["Einkauf gesamt (€)"].sum()
        summe_vk = df_wirt["Verkauf gesamt (€)"].sum()
        summe_marge = summe_vk - summe_ek
        c1, c2, c3 = st.columns(3)
        c1.metric("Σ Einkauf", f"{summe_ek:,.2f} €".replace(",", "."))
        c2.metric("Σ Verkauf", f"{summe_vk:,.2f} €".replace(",", "."))
        c3.metric("Marge gesamt", f"{summe_marge:,.2f} €".replace(",", "."))
        st.dataframe(df_wirt, use_container_width=True, hide_index=True,
                     column_config={
                         "Paletten": st.column_config.NumberColumn(format="%d"),
                         "Einkauf gesamt (€)": st.column_config.NumberColumn(format="%.2f €"),
                         "Verkauf gesamt (€)": st.column_config.NumberColumn(format="%.2f €"),
                         "Marge (€)": st.column_config.NumberColumn(format="%.2f €"),
                     })
        st.caption("Nur Einzel-Standards mit Preisen im Katalog. "
                   "Kombi und Sonder fehlen — Preise dort unbekannt.")
        card_close()

    cl, cr = st.columns([2, 1])
    with cl:
        card_open(f"Detail-Zuordnung — {res['gesamt']} Maße "
                  f"({len(res['standards'])} Std + {len(res['sonder'])} Sonder)")
        st.markdown(
            f'<div style="max-height:560px;overflow:auto;">'
            f'{render_zuord_table(res, katalog_set)}</div>',
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
# ---------------------------------------------------------------------------
# Seite 6: Palettenkatalog (Stammdaten, persistent)
# ---------------------------------------------------------------------------
def _fmt_eur(x: float) -> str:
    return f"{x:.2f} €".replace(".", ",")


def seite_katalog() -> None:
    eintraege = katalog_modul.alle()
    card_open(f"Palettenkatalog ({len(eintraege)} Eintr&auml;ge)")
    st.markdown(
        '<div style="font-size:13px;color:#475569;margin-bottom:8px;">'
        'Bekannte Paletten-Maße mit Einkaufs- und Verkaufspreis. '
        'Der Optimierer <b>bevorzugt</b> diese Maße bei der Auswahl der '
        'Standards — er wählt sie aber NUR wenn es das Gesamt-Optimum '
        'nicht verschlechtert. Andere Maße bleiben weiterhin möglich.'
        '</div>',
        unsafe_allow_html=True,
    )

    # Warn-Banner fuer kritische Bestaende
    kritisch = katalog_modul.kritische_bestaende()
    if kritisch:
        meldungen = "<br>".join(
            f'• {e["L_mm"]}×{e["B_mm"]} mm — '
            f'Bestand {int(e.get("bestand", 0))} ≤ '
            f'Meldebestand {int(e.get("meldebestand", 0))}'
            for e in kritisch
        )
        st.markdown(
            f'<div style="background:#fef3c7;border:1px solid #fbbf24;'
            f'color:#92400e;padding:12px 14px;border-radius:8px;'
            f'margin-bottom:14px;font-size:13px;">'
            f'<div style="font-weight:700;margin-bottom:6px;">'
            f'⚠️ Meldebestand erreicht ({len(kritisch)})</div>'
            f'{meldungen}</div>',
            unsafe_allow_html=True,
        )

    # === Neuer Eintrag anlegen ===
    with st.expander("➕ Neue Palette hinzufügen", expanded=not eintraege):
        c1, c2, c3, c4 = st.columns([1, 1, 1.2, 1.2])
        with c1:
            n_L = st.number_input("Länge (mm)", min_value=0, max_value=10000,
                                   value=1200, step=10, key="kat_new_L")
        with c2:
            n_B = st.number_input("Breite (mm)", min_value=0, max_value=10000,
                                   value=800, step=10, key="kat_new_B")
        with c3:
            n_ek = st.number_input("Einkaufspreis (€)", min_value=0.0,
                                    value=0.0, step=0.50, format="%.2f",
                                    key="kat_new_ek")
        with c4:
            n_vk = st.number_input("Verkaufspreis (€)", min_value=0.0,
                                    value=0.0, step=0.50, format="%.2f",
                                    key="kat_new_vk")
        c5, c6, c7 = st.columns([1, 1, 2])
        with c5:
            n_best = st.number_input("Bestand (Stk)", min_value=0,
                                      max_value=100000, value=0, step=1,
                                      key="kat_new_best",
                                      help="Aktuelle Lagermenge in Stück.")
        with c6:
            n_meld = st.number_input("Meldebestand (Stk)", min_value=0,
                                      max_value=100000, value=0, step=1,
                                      key="kat_new_meld",
                                      help="Warnung wenn Bestand ≤ diesem Wert.")
        with c7:
            n_notiz = st.text_input("Notiz (optional)", value="",
                                     key="kat_new_notiz")
        if st.button("Palette hinzufügen", type="primary",
                      use_container_width=True, key="kat_add_btn"):
            if n_L > 0 and n_B > 0:
                katalog_modul.neuer_eintrag(int(n_L), int(n_B),
                                            float(n_ek), float(n_vk),
                                            int(n_best), int(n_meld),
                                            n_notiz, aktiv=True)
                st.success(f"Eintrag {int(max(n_L,n_B))}×{int(min(n_L,n_B))} "
                           f"hinzugefügt.")
                st.rerun()
            else:
                st.error("Länge und Breite müssen > 0 sein.")
    card_close()

    if not eintraege:
        st.info("Noch keine Paletten im Katalog. Füge oben welche hinzu — "
                "der Optimierer wird sie bei zukünftigen Läufen bevorzugen.")
        st.caption(f"Speicherort: {katalog_modul.katalog_pfad_str()}")
        return

    # === Katalog-Tabelle + CRUD ===
    card_open(f"Vorhandene Paletten ({len(eintraege)})")
    df = pd.DataFrame([
        {
            "id": e["id"],
            "Länge": e["L_mm"],
            "Breite": e["B_mm"],
            "Einkauf (€)": e.get("einkaufspreis_eur", 0.0),
            "Verkauf (€)": e.get("verkaufspreis_eur", 0.0),
            "Marge (€)": (e.get("verkaufspreis_eur", 0.0)
                          - e.get("einkaufspreis_eur", 0.0)),
            "Bestand": int(e.get("bestand", 0)),
            "Meldebestand": int(e.get("meldebestand", 0)),
            "Status": ("⚠️ niedrig" if (int(e.get("meldebestand", 0)) > 0
                       and int(e.get("bestand", 0))
                       <= int(e.get("meldebestand", 0))) else "✓ ok"),
            "Aktiv": e.get("aktiv", True),
            "Notiz": e.get("notiz", ""),
        }
        for e in eintraege
    ])
    st.dataframe(df.drop(columns=["id"]),
                 use_container_width=True, hide_index=True, height=300,
                 column_config={
                     "Einkauf (€)":   st.column_config.NumberColumn(format="%.2f €"),
                     "Verkauf (€)":   st.column_config.NumberColumn(format="%.2f €"),
                     "Marge (€)":     st.column_config.NumberColumn(format="%.2f €"),
                     "Bestand":       st.column_config.NumberColumn(format="%d"),
                     "Meldebestand":  st.column_config.NumberColumn(format="%d"),
                     "Aktiv":         st.column_config.CheckboxColumn(),
                 })

    # Auswahl für Edit/Delete
    ids = [r["id"] for r in df.to_dict("records")]
    auswahl_idx = st.selectbox(
        "Eintrag bearbeiten / löschen",
        options=range(len(eintraege)),
        format_func=lambda i: (f"{eintraege[i]['L_mm']}×{eintraege[i]['B_mm']} "
                                f"({_fmt_eur(eintraege[i].get('einkaufspreis_eur', 0))} "
                                f"→ {_fmt_eur(eintraege[i].get('verkaufspreis_eur', 0))})"),
        key="kat_sel",
    )
    eintrag = eintraege[auswahl_idx]
    with st.expander(f"Bearbeiten: {eintrag['L_mm']}×{eintrag['B_mm']}",
                      expanded=False):
        c1, c2, c3, c4 = st.columns([1, 1, 1.2, 1.2])
        with c1:
            e_L = st.number_input("Länge (mm)", min_value=0, max_value=10000,
                                   value=int(eintrag["L_mm"]), step=10,
                                   key=f"kat_edit_L_{eintrag['id']}")
        with c2:
            e_B = st.number_input("Breite (mm)", min_value=0, max_value=10000,
                                   value=int(eintrag["B_mm"]), step=10,
                                   key=f"kat_edit_B_{eintrag['id']}")
        with c3:
            e_ek = st.number_input("Einkaufspreis (€)", min_value=0.0,
                                    value=float(eintrag.get("einkaufspreis_eur", 0.0)),
                                    step=0.50, format="%.2f",
                                    key=f"kat_edit_ek_{eintrag['id']}")
        with c4:
            e_vk = st.number_input("Verkaufspreis (€)", min_value=0.0,
                                    value=float(eintrag.get("verkaufspreis_eur", 0.0)),
                                    step=0.50, format="%.2f",
                                    key=f"kat_edit_vk_{eintrag['id']}")
        c5, c6 = st.columns([1, 1])
        with c5:
            e_best = st.number_input("Bestand (Stk)", min_value=0,
                                      max_value=100000,
                                      value=int(eintrag.get("bestand", 0)),
                                      step=1,
                                      key=f"kat_edit_best_{eintrag['id']}",
                                      help="Aktuelle Lagermenge.")
        with c6:
            e_meld = st.number_input("Meldebestand (Stk)", min_value=0,
                                      max_value=100000,
                                      value=int(eintrag.get("meldebestand", 0)),
                                      step=1,
                                      key=f"kat_edit_meld_{eintrag['id']}",
                                      help="Warnung wenn Bestand ≤ diesem Wert.")
        e_notiz = st.text_input("Notiz", value=eintrag.get("notiz", ""),
                                 key=f"kat_edit_notiz_{eintrag['id']}")
        e_aktiv = st.toggle("Aktiv (wird vom Optimierer berücksichtigt)",
                             value=bool(eintrag.get("aktiv", True)),
                             key=f"kat_edit_aktiv_{eintrag['id']}")
        cs, cd = st.columns(2)
        if cs.button("💾 Speichern", type="primary",
                      use_container_width=True,
                      key=f"kat_save_{eintrag['id']}"):
            katalog_modul.update_eintrag(eintrag["id"], L_mm=int(e_L),
                                          B_mm=int(e_B),
                                          einkaufspreis_eur=float(e_ek),
                                          verkaufspreis_eur=float(e_vk),
                                          bestand=int(e_best),
                                          meldebestand=int(e_meld),
                                          notiz=e_notiz, aktiv=bool(e_aktiv))
            st.success("Gespeichert.")
            st.rerun()
        if cd.button("🗑️ Löschen", use_container_width=True,
                      key=f"kat_del_{eintrag['id']}"):
            katalog_modul.loesche_eintrag(eintrag["id"])
            st.warning("Eintrag gelöscht.")
            st.rerun()
    st.caption(f"Speicherort: {katalog_modul.katalog_pfad_str()}")
    card_close()


# ---------------------------------------------------------------------------
# Neue Seiten — werden nach und nach gefuellt. Aktiviert hier, damit
# der Nutzer sie schon sieht und navigieren kann.
# ---------------------------------------------------------------------------

def _stub(name: str, beschreibung: str, geplant: list[str]) -> None:
    """Platzhalter-Seite mit klarer Aussage was geplant ist."""
    card_open(name)
    st.markdown(
        f'<div style="font-size:13px;color:#475569;margin-bottom:8px;">'
        f'{escape(beschreibung)}</div>',
        unsafe_allow_html=True,
    )
    st.info("Diese Seite wird in einem nächsten Schritt gefüllt — "
            "noch in Entwicklung.")
    st.markdown("**Geplante Inhalte:**")
    for punkt in geplant:
        st.markdown(f"- {escape(punkt)}")
    card_close()


def seite_dashboard() -> None:
    """Zentrale Uebersicht: aktuelle Daten + Verlauf-Stats + kritische Bestände."""
    card_open("Dashboard — Übersicht")

    # KPIs aus aktueller Session
    dat = st.session_state.get("import_dat")
    erg = st.session_state.get("ergebnis")
    c1, c2, c3, c4 = st.columns(4)
    if dat:
        c1.metric("Aufträge mit Maß", len(dat.get("mit_mass", [])))
        c2.metric("Paletten gesamt",
                   dat.get("paletten_gesamt", 0) or
                   sum(p["anzahl"] for p in dat.get("mit_mass", [])))
    else:
        c1.metric("Aufträge mit Maß", "—")
        c2.metric("Paletten gesamt", "—")
    if erg:
        c3.metric("Letzte Optimierung",
                   f"{erg['gesamt']} Maße",
                   f"{len(erg['standards'])} Std + {len(erg['sonder'])} Sonder",
                   delta_color="off")
    else:
        c3.metric("Letzte Optimierung", "—")
    try:
        kat_n = len(katalog_modul.alle())
    except Exception:
        kat_n = 0
    c4.metric("Paletten im Katalog", kat_n)
    card_close()

    # Verlauf-Mini-Tabelle
    try:
        v = verlauf_alle()
    except Exception:
        v = []
    if v:
        card_open(f"Letzte 5 Imports ({len(v)} insgesamt)")
        rows = []
        for e in v[:5]:
            erg_e = e.get("ergebnis", {}) or {}
            opt = e.get("optimierung")
            opt_txt = (f"{opt.get('standards','?')}+{opt.get('sonder','?')}"
                       if opt else "—")
            rows.append({
                "Datum": e.get("datum", "")[:16].replace("T", " "),
                "Datei": e.get("datei_name", ""),
                "mit Maß": erg_e.get("auftraege_mit_mass", 0),
                "Paletten": erg_e.get("paletten_gesamt", 0),
                "Letzte Opt.": opt_txt,
            })
        st.dataframe(pd.DataFrame(rows), use_container_width=True,
                     hide_index=True)
        card_close()

    # Kritische Bestände
    try:
        krit = katalog_modul.kritische_bestaende()
    except Exception:
        krit = []
    if krit:
        card_open(f"⚠️ Kritische Bestände ({len(krit)})")
        rows = [{
            "Palette": f"{e['L_mm']} × {e['B_mm']} mm",
            "Bestand": int(e.get("bestand", 0)),
            "Meldebestand": int(e.get("meldebestand", 0)),
            "Fehlmenge": (int(e.get("meldebestand", 0))
                          - int(e.get("bestand", 0))),
        } for e in krit]
        st.dataframe(pd.DataFrame(rows), use_container_width=True,
                     hide_index=True)
        st.caption("→ Im Tab 'Bestand & Disposition' anpassen.")
        card_close()


def seite_bestand_dispo() -> None:
    """Lagerübersicht + Schnell-Editor für Bestände."""
    card_open("Bestand & Disposition")
    eintraege = katalog_modul.alle()
    if not eintraege:
        st.info("Keine Paletten im Katalog. → Tab 'Katalog' füllen.")
        card_close()
        return
    st.markdown(
        '<div style="font-size:13px;color:#475569;margin-bottom:8px;">'
        'Schneller Überblick über alle Palettenbestände. Bestand kann '
        'hier direkt editiert werden — Änderungen werden sofort gespeichert.'
        '</div>',
        unsafe_allow_html=True,
    )

    # Disposition: für jeden kritischen Eintrag Vorschlag "wieviel nachbestellen"
    krit = katalog_modul.kritische_bestaende()
    if krit:
        rows = [{
            "Palette": f"{e['L_mm']} × {e['B_mm']} mm",
            "Bestand": int(e.get("bestand", 0)),
            "Meldebestand": int(e.get("meldebestand", 0)),
            "Nachbestellen (mind.)": max(0, int(e.get("meldebestand", 0))
                                          * 2 - int(e.get("bestand", 0))),
            "Einkauf gesamt (€)": (
                max(0, int(e.get("meldebestand", 0)) * 2
                    - int(e.get("bestand", 0)))
                * float(e.get("einkaufspreis_eur", 0.0))
            ),
        } for e in krit]
        st.markdown(f"### ⚠️ Dispositionsvorschlag ({len(krit)} Paletten)")
        st.dataframe(
            pd.DataFrame(rows), use_container_width=True, hide_index=True,
            column_config={
                "Einkauf gesamt (€)": st.column_config.NumberColumn(format="%.2f €"),
            },
        )
        st.caption("Faustregel: auffüllen bis 2× Meldebestand. "
                   "Bestellungen kommen später in den 'Bestellungen'-Tab.")

    # Schnell-Editor pro Palette
    st.markdown("### Bestand schnell editieren")
    for e in eintraege:
        c1, c2, c3, c4 = st.columns([2, 1, 1, 1])
        c1.markdown(f"**{e['L_mm']} × {e['B_mm']} mm**  "
                    f"<span style='color:#6b7280;font-size:11px;'>"
                    f"{escape(e.get('notiz',''))}</span>",
                    unsafe_allow_html=True)
        with c2:
            neu_bestand = st.number_input(
                "Bestand", min_value=0, max_value=100000,
                value=int(e.get("bestand", 0)), step=1,
                key=f"bd_bestand_{e['id']}",
                label_visibility="collapsed",
            )
        with c3:
            warn = (int(e.get("meldebestand", 0)) > 0
                    and neu_bestand <= int(e.get("meldebestand", 0)))
            st.markdown(
                f'<div style="padding-top:6px;font-size:12px;'
                f'color:{"#dc2626" if warn else "#16a34a"};">'
                f'{"⚠️ Meldebestand" if warn else "✓ ok"} '
                f'(Meld.: {int(e.get("meldebestand", 0))})'
                f'</div>',
                unsafe_allow_html=True,
            )
        with c4:
            if neu_bestand != int(e.get("bestand", 0)):
                if st.button("💾 Speichern",
                              key=f"bd_save_{e['id']}",
                              use_container_width=True):
                    katalog_modul.set_bestand(e["id"], int(neu_bestand))
                    st.rerun()
    card_close()


def seite_bestellungen() -> None:
    _stub("Bestellungen",
          "Hier wirst du Bestellvorgänge anlegen, deren Status verfolgen "
          "und nach Wareneingang den Bestand automatisch aktualisieren.",
          ["Bestellvorgang anlegen (Lieferant, Datum, Positionen)",
           "Status: offen / unterwegs / eingegangen",
           "Bei Eingang: Katalog-Bestand automatisch erhöhen",
           "Auto-Vorschlag aus Dispositions-Tab übernehmen",
           "Historie aller Bestellungen (persistent)"])


def seite_kostenanalyse() -> None:
    """Marge pro Standard nach Optimierung — schon teilweise im Ergebnisse-Tab,
    hier separate Übersicht über alle Verlauf-Läufe."""
    card_open("Kostenanalyse")
    v = verlauf_alle()
    optimierungen = [e for e in v if e.get("optimierung")]
    if not optimierungen:
        st.info("Noch keine Optimierungen im Verlauf. → "
                "Datei importieren + optimieren.")
        card_close()
        return
    rows = []
    for e in optimierungen[:20]:
        opt = e["optimierung"]
        rows.append({
            "Datum": e.get("datum", "")[:16].replace("T", " "),
            "Datei": e.get("datei_name", ""),
            "Tol kurz": opt.get("tol_kurz_mm", "?"),
            "Tol lang": opt.get("tol_lang_mm", "?"),
            "Standards": opt.get("standards", 0),
            "Sonder": opt.get("sonder", 0),
            "Gesamt": opt.get("gesamt", 0),
        })
    st.markdown("### Optimierungs-Historie")
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
    st.caption("Detail-Marge pro Standard liegt im 'Ergebnisse'-Tab — "
               "dort wird Σ Einkauf/Verkauf/Marge live berechnet sobald "
               "Standards im Katalog mit Preisen vorhanden sind.")
    card_close()

    # Geplante Ausbauten
    _stub("Geplante Erweiterungen",
          "Über die aktuelle Verlaufstabelle hinaus:",
          ["Diagramme: Standards-Anzahl im Zeitverlauf",
           "Vergleich verschiedener Toleranz-Szenarien nebeneinander",
           "Marge-Auswertung mit Kombi/Sonder (sobald Preise verfügbar)",
           "Was-wäre-wenn-Simulation: gleiche Daten, andere Parameter"])


def seite_stammdaten() -> None:
    card_open("Stammdaten")
    st.markdown(
        '<div style="font-size:13px;color:#475569;margin-bottom:8px;">'
        'Globale Konstanten und Mappings.'
        '</div>',
        unsafe_allow_html=True,
    )

    # Aktive Konstanten anzeigen
    from import_excel import PALETTEN_AUFSCHLAG_MM
    c1, c2 = st.columns(2)
    c1.metric("Palettenaufschlag (mm)", PALETTEN_AUFSCHLAG_MM,
              help="P-L und P-B in der Excel sind Palettenmaße. Produkt = "
                   "Palette − Aufschlag. Konstante in mini/import_excel.py.")
    c2.metric("Coverage-Modus", "einseitig",
              help="Standard ≥ Last in beiden Dimensionen — physisch zwingend.")
    card_close()

    _stub("Geplante Stammdaten-Verwaltung",
          "Hier kommen über die Zeit:",
          ["Kunden-Stammdaten (Name, Adresse, Rabatte)",
           "Lieferanten-Stammdaten (mit Standard-Lieferzeiten)",
           "Eigene Maßraster (z.B. 100mm-Raster für Standards)",
           "Palettenaufschlag konfigurierbar machen (statt fix 50 mm)"])


def seite_berichte() -> None:
    _stub("Berichte",
          "Export-Funktionen für Kundenberichte und Auswertungen.",
          ["PDF-Report einer Optimierung (Standards + Zuordnung)",
           "Excel-Export der vollständigen Zuordnung",
           "Bestandsbericht (alle Paletten + Werte)",
           "Wirtschaftlichkeitsbericht über mehrere Optimierungen",
           "Lieferanten-bestelldokument aus Disposition"])
    # Schon vorhanden im Ergebnisse-Tab:
    st.info("ℹ️ Der CSV-Export der Detail-Zuordnung ist bereits im "
            "**Ergebnisse**-Tab unter der Tabelle verfügbar.")


def seite_app_einstellungen() -> None:
    card_open("App-Einstellungen")
    st.markdown(
        '<div style="font-size:13px;color:#475569;line-height:1.8;">'
        '<b>Persistente Speicherorte</b> (überleben App-Updates):</div>',
        unsafe_allow_html=True,
    )
    from import_verlauf import verlauf_pfad_str
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("**Import-Verlauf**")
        st.code(verlauf_pfad_str(), language=None)
        try:
            n_v = len(verlauf_alle())
        except Exception:
            n_v = 0
        st.caption(f"{n_v} Einträge")
    with c2:
        st.markdown("**Palettenkatalog**")
        st.code(katalog_modul.katalog_pfad_str(), language=None)
        try:
            n_k = len(katalog_modul.alle())
        except Exception:
            n_k = 0
        st.caption(f"{n_k} Einträge")
    card_close()

    # Build-Identitaet
    card_open("Build / Kern")
    from _ui_chrome import build_stempel
    st.code(build_stempel(), language=None)
    s = _lade_selbsttest_status()
    if s:
        st.markdown(f"**Selbsttest:** {s['passed_count']}/{s['total']} "
                    f"({'bestanden' if s.get('passed') else 'FAIL'})")
        st.caption(s.get("timestamp", ""))
    card_close()

    _stub("Geplante App-Einstellungen",
          "Mehr Konfiguration kommt schrittweise:",
          ["Dunkles/helles Theme umschaltbar",
           "Solver-Zeitlimit konfigurierbar (aktuell 120 s)",
           "Default-Werte für Toleranzen anpassbar",
           "Backup/Restore von Verlauf und Katalog als ZIP",
           "Sprache (de/en)"])


# ---------------------------------------------------------------------------
# Page-Router
# ---------------------------------------------------------------------------
SEITEN = {
    "Dashboard":             seite_dashboard,
    "Datenimport":           seite_datenimport,
    "Einstellungen":         seite_einstellungen,
    "Optimierung":           seite_optimierung,
    "Ergebnisse":            seite_ergebnisse,
    "Verlauf":               seite_verlauf,
    "Katalog":               seite_katalog,
    "Bestand & Disposition": seite_bestand_dispo,
    "Bestellungen":          seite_bestellungen,
    "Kostenanalyse":         seite_kostenanalyse,
    "Stammdaten":            seite_stammdaten,
    "Berichte":              seite_berichte,
    "App-Einstellungen":     seite_app_einstellungen,
}
SEITEN[st.session_state.seite]()
