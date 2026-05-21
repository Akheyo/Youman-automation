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
import bestellungen as bestellungen_modul  # noqa: E402
import wirtschaftlichkeit as wirt_modul  # noqa: E402
import verbrauch as verbrauch_modul  # noqa: E402
import procurement as procurement_modul  # noqa: E402
from import_doppelschutz import pruefe_import as _pruefe_import  # noqa: E402
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
            "tol_modus": "absolut",   # "absolut" (mm) ODER "prozent" (%)
            # Modus A — Absolut (mm):
            "tol_kurz_mm": 200,
            "tol_lang_mm": 400,
            # Modus B — Prozentual (%) — Defaults laut Spec:
            "tol_kurz_pct": 15,       # Breite +15 %
            "tol_lang_pct": 10,       # Länge  +10 %
            "kombinieren": True,
            "sonder_deckel_aktiv": True,
            "sonder_deckel": 5,
            # Sonderpaletten-Option (Spec §3)
            "sonder_erlaubt": True,
            "sonder_min_artikel": 5,
            "sonder_aufschlag_mm": 0,
            # Score-Gewichte (Spec §3)
            "w1": 1.0,   # Anzahl unterschiedlicher Palettentypen
            "w2": 0.0,   # Σ Paletten (info-only, post-hoc)
            "w3": 0.0,   # Verbrauchshäufigkeits-Bonus (Bestand-Match)
            "w4": 0.0,   # Σ EK-Kosten (Neubeschaffung)
            "w5": 0.0,   # Marge-Bonus (negativ)
            "w6": 0.0,   # Penalty pro Sonder-Typ
            "w7": 0.0,   # Penalty pro Kombi-Zuordnung
            "w8": 0.0,   # Logistik-Mehrkosten (Transport+Lager)
            "w9": 0.0,   # − Handling/Varianten-Einsparung (Bonus)
            # Filter in der Ergebnis-Tabelle
            "ergebnis_filter": "alle",
            # Doppelschutz (Spec §8)
            "doppelschutz_aktiv": True,
            "doppelschutz_zeitfenster": 30,
        },
        "ergebnis": None,
        "ergebnis_id": None,           # UUID pro Optimierungslauf
        "bestellt_ergebnisse": set(),  # Idempotenz: schon-bestellte ergebnis_ids
        "bestellt_pro_kand": {},        # pro (ergebnis_id, kand) bool
        "neue_sonder_uebernommen": {}, # pro (ergebnis_id, kand) bool
        "vergleich": None,             # Compare-Modus-Resultat
        "doppelschutz_preview": None,  # Ergebnis von pruefe_import
        "doppelschutz_skip_ids": set(),# manuelle Skip-IDs (zeile-keys)
        "bestellung_modal": None,      # dict mit pending Bestellung-Daten
        "historie_filter": {            # Filter Historie-Page
            "status": "alle",
            "kunde": "",
            "aw": "",
            "datum_von": "",
            "datum_bis": "",
        },
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
        "Beschaffung",
        "Historie",
        "Wirtschaftlichkeit",
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


def _globale_banner() -> None:
    """Globale Hinweise (Spec §5 + §13 + §14): X Paletten ohne EK/VK +
    Y offene Bestellungen + Z offene Beschaffungen + Netto-Effekt."""
    try:
        unvoll = katalog_modul.unvollstaendige()
    except Exception:
        unvoll = []
    try:
        offene = bestellungen_modul.offene()
    except Exception:
        offene = []
    try:
        offene_bes = procurement_modul.offene()
    except Exception:
        offene_bes = []
    try:
        kritisch = [k for k in verbrauch_modul.kritische_paletten(
            katalog_modul=katalog_modul,
            bestellungen_modul=bestellungen_modul,
        ) if k["kritisch"]]
    except Exception:
        kritisch = []
    teile = []
    if unvoll:
        n = len(unvoll)
        teile.append(
            f'⚠️ <b>{n}</b> Palette{"n" if n != 1 else ""} ohne EK/VK'
        )
    if kritisch:
        n = len(kritisch)
        teile.append(
            f'🔴 <b>{n}</b> kritisch (Reichweite)'
        )
    if offene:
        teile.append(
            f'📋 <b>{len(offene)}</b> offene Bestellung'
            f'{"en" if len(offene) != 1 else ""}'
        )
    if offene_bes:
        teile.append(
            f'📦 <b>{len(offene_bes)}</b> offene Beschaffung'
            f'{"en" if len(offene_bes) != 1 else ""}'
        )
    if not teile:
        return
    st.markdown(
        f'<div style="background:#fef3c7;border:1px solid #fde68a;'
        f'color:#92400e;padding:8px 14px;border-radius:6px;'
        f'margin-bottom:10px;font-size:13px;">'
        f'{" · ".join(teile)}'
        f'</div>',
        unsafe_allow_html=True,
    )


# Cron-Abtragen einmal pro Session ausfuehren (Spec §9)
if not st.session_state.get("_cron_done", False):
    try:
        cron_erg = verbrauch_modul.cron_abtragen(
            bestellungen_modul=bestellungen_modul)
        if cron_erg["geaendert"] > 0:
            st.toast(
                f"Verbrauch-Cron: {cron_erg['geaendert']} überfällige "
                f"Bestellung(en) auf 'verbraucht' gesetzt."
            )
    except Exception:
        pass
    st.session_state._cron_done = True

_globale_banner()


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
        st.session_state.doppelschutz_preview = None
        st.session_state.doppelschutz_skip_ids = set()
        try:
            st.session_state.historie_id = neuer_eintrag(
                datei_pfad=up.name,
                ergebnis=dat,
                datei_bytes=roh,
            )
        except Exception as exc:  # noqa: BLE001
            st.session_state.historie_id = None
            st.warning(f"Verlauf konnte nicht geschrieben werden: {exc}")
        # Doppelschutz-Check (Spec §8): pruefen ob Bedarfe schon in Historie
        if (dat.get("mit_mass") and
                st.session_state.params.get("doppelschutz_aktiv", True)):
            try:
                aktive = bestellungen_modul.aktive()
                preview = _pruefe_import(
                    dat["mit_mass"], aktive,
                    zeitfenster_tage=int(
                        st.session_state.params.get(
                            "doppelschutz_zeitfenster", 30)),
                )
                st.session_state.doppelschutz_preview = preview
            except Exception as exc:
                st.warning(f"Doppelschutz uebersprungen: {exc}")
        # Wenn Doppelschutz Treffer hat → User soll bestaetigen,
        # sonst direkt zur Optimierung
        if (st.session_state.doppelschutz_preview and
                (st.session_state.doppelschutz_preview.get("schon_bestellt")
                 or st.session_state.doppelschutz_preview.get("teilbedarf"))):
            # auf der Import-Seite bleiben, Preview anzeigen
            st.rerun()
        elif dat.get("mit_mass"):
            run_optimierung()
            st.session_state.seite = "Ergebnisse"
            st.rerun()
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

    # === Doppelschutz-Preview (Spec §8) ===
    preview = st.session_state.get("doppelschutz_preview")
    if preview:
        _doppelschutz_preview_ui(preview)

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


def _doppelschutz_preview_ui(preview: dict) -> None:
    """Spec §8: 3-Kategorien-Vorschau mit Bulk-Aktionen."""
    n_neu = len(preview.get("neu", []))
    n_schon = len(preview.get("schon_bestellt", []))
    n_teil = len(preview.get("teilbedarf", []))
    if n_neu + n_schon + n_teil == 0:
        return

    card_open(f"🛡️ Doppelschutz-Vorschau "
              f"({n_neu} neu · {n_schon} schon · {n_teil} Teilbedarf)")

    if n_schon > 0 or n_teil > 0:
        st.warning(
            f"{n_schon} Auftrag/Aufträge sind bereits in der Historie "
            f"bestellt — diese werden NICHT erneut geplant. "
            f"{n_teil} sind teilweise gedeckt — nur das Delta geht in "
            f"die Optimierung."
        )
    else:
        st.success("Alle Aufträge sind neue Bedarfe.")

    rows = []
    for z, info in preview.get("neu", []):
        rows.append({
            "Status": "✅ Neu",
            "AW": z.get("auftrag", ""),
            "Artikel": z.get("artikelnummer", ""),
            "Kunde": z.get("name", ""),
            "Menge": int(z.get("anzahl", 0)),
            "Delta": "—",
            "Match": "—",
        })
    for z, info in preview.get("teilbedarf", []):
        rows.append({
            "Status": f"➕ Teilbedarf ({info['gemachte_menge']} schon)",
            "AW": z.get("auftrag", ""),
            "Artikel": z.get("artikelnummer", ""),
            "Kunde": z.get("name", ""),
            "Menge": int(z.get("anzahl", 0)),
            "Delta": int(info["delta_menge"]),
            "Match": info.get("match_typ", "—"),
        })
    for z, info in preview.get("schon_bestellt", []):
        rows.append({
            "Status": "⚠️ schon bestellt",
            "AW": z.get("auftrag", ""),
            "Artikel": z.get("artikelnummer", ""),
            "Kunde": z.get("name", ""),
            "Menge": int(z.get("anzahl", 0)),
            "Delta": 0,
            "Match": info.get("match_typ", "—"),
        })
    if rows:
        df = pd.DataFrame(rows)
        st.dataframe(df, use_container_width=True, hide_index=True,
                     height=min(400, 40 + 35 * len(rows)))

    fuer_opt = preview.get("fuer_optimierung", [])
    cc1, cc2 = st.columns([1, 1])
    if cc1.button(
        f"✅ {len(fuer_opt)} Aufträge übernehmen + optimieren",
        type="primary", use_container_width=True, key="dops_uebernehmen",
        disabled=len(fuer_opt) == 0,
    ):
        # Tausche mit_mass durch fuer_optimierung-Liste fuer den
        # Optimierer-Lauf (Schon-Bestellte sind raus, Teilbedarf hat
        # delta_menge).
        dat = st.session_state.import_dat
        dat["mit_mass"] = list(fuer_opt)
        st.session_state.doppelschutz_preview = None
        run_optimierung()
        st.session_state.seite = "Ergebnisse"
        st.rerun()
    if cc2.button(
        "❌ Doppelschutz ignorieren (alle übernehmen)",
        use_container_width=True, key="dops_ignorieren",
    ):
        st.session_state.doppelschutz_preview = None
        run_optimierung()
        st.session_state.seite = "Ergebnisse"
        st.rerun()
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
        # Umschalter: Modus A (mm) vs Modus B (%) — State bleibt fuer beide.
        modi = ["Absolut (mm)", "Prozentual (%)"]
        modi_keys = ["absolut", "prozent"]
        idx = 0 if p.get("tol_modus", "absolut") == "absolut" else 1
        sel = st.radio(
            "Modus",
            modi,
            index=idx,
            horizontal=True,
            key="tol_modus_in",
            help="Absolut: Übermaß in mm. Prozentual: Übermaß als "
                 "Prozent vom Auftragsmaß. Werte beider Modi werden "
                 "im Hintergrund unabhängig gespeichert.",
        )
        p["tol_modus"] = modi_keys[modi.index(sel)]

        if p["tol_modus"] == "absolut":
            p["tol_kurz_mm"] = st.number_input(
                "max. Übermaß BREITE", min_value=0, max_value=2000,
                value=int(p["tol_kurz_mm"]), step=10, key="tol_kurz_mm_in",
                help="Absolutes Übermaß in Millimetern auf der kurzen Achse.",
            )
            p["tol_lang_mm"] = st.number_input(
                "max. Übermaß LÄNGE", min_value=0, max_value=2000,
                value=int(p["tol_lang_mm"]), step=10, key="tol_lang_mm_in",
                help="Absolutes Übermaß in Millimetern auf der langen Achse.",
            )
            st.caption("Einheit: mm · Modus A (absolut)")
        else:
            p["tol_kurz_pct"] = st.number_input(
                "max. Übermaß BREITE",
                min_value=0.0, max_value=100.0,
                value=float(p.get("tol_kurz_pct", 15)),
                step=1.0, format="%.1f", key="tol_kurz_pct_in",
                help="Prozentuales Übermaß auf der kurzen Achse. "
                     "max_breite = palette_breite * (1 + %/100).",
            )
            p["tol_lang_pct"] = st.number_input(
                "max. Übermaß LÄNGE",
                min_value=0.0, max_value=100.0,
                value=float(p.get("tol_lang_pct", 10)),
                step=1.0, format="%.1f", key="tol_lang_pct_in",
                help="Prozentuales Übermaß auf der langen Achse. "
                     "max_länge = palette_länge * (1 + %/100).",
            )
            st.caption("Einheit: % · Modus B (prozentual)")
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

        card_open("Sonderpaletten")
        p["sonder_erlaubt"] = st.toggle(
            "Sonderpaletten zulassen",
            value=bool(p.get("sonder_erlaubt", True)),
            key="son_e",
            help="ON = neue Maße dürfen erzeugt werden (auch außerhalb "
                 "Katalog). OFF = nur Katalog-Maße — nicht zuordenbare "
                 "Aufträge werden separat ausgewiesen.",
        )
        p["sonder_deckel_aktiv"] = st.toggle(
            "Sonder-Deckel aktiv",
            value=bool(p.get("sonder_deckel_aktiv", True)),
            key="sd_a",
            disabled=not p["sonder_erlaubt"],
            help="ON = max. Anzahl verschiedener Sonder-Maße ist begrenzt. "
                 "OFF = unbegrenzt (Optimierer entscheidet).",
        )
        p["sonder_deckel"] = st.number_input(
            "Max. Sonderpaletten erlaubt",
            min_value=0, max_value=500,
            value=int(p.get("sonder_deckel", 5)),
            step=1, key="sd_n",
            disabled=(not p["sonder_deckel_aktiv"]) or (not p["sonder_erlaubt"]),
            help="Greift nur wenn der Toggle 'Sonder-Deckel aktiv' an ist.",
        )
        p["sonder_min_artikel"] = st.number_input(
            "Mindest-Bündel pro Sonder (N Artikel)",
            min_value=0, max_value=10000,
            value=int(p.get("sonder_min_artikel", 5)),
            step=1, key="son_n",
            disabled=not p["sonder_erlaubt"],
            help="Ein Sonder wird nur eingeführt, wenn er ≥ N Artikel "
                 "bündelt. 0 = kein Mindest-Bündel.",
        )
        p["sonder_aufschlag_mm"] = st.number_input(
            "Sicherheits-Aufschlag pro Sonder (mm)",
            min_value=0, max_value=500,
            value=int(p.get("sonder_aufschlag_mm", 0)),
            step=5, key="son_a",
            disabled=not p["sonder_erlaubt"],
            help="Wird auf jede Achse des Sonder-Maßes addiert "
                 "(Standard-Maße bleiben unverändert).",
        )
        card_close()

        card_open("Doppelschutz (Spec §8)")
        p["doppelschutz_aktiv"] = st.toggle(
            "Doppelschutz aktiv",
            value=bool(p.get("doppelschutz_aktiv", True)),
            key="dops_aktiv",
            help="ON = beim Import wird gegen Historie geprueft. "
                 "Bereits bestellte AW+Artikel werden nicht erneut "
                 "geplant; Teilbedarf nur als Delta. OFF = alle Bedarfe "
                 "gehen direkt in die Optimierung.",
        )
        p["doppelschutz_zeitfenster"] = st.number_input(
            "Fallback-Zeitfenster (Tage)",
            min_value=0, max_value=365,
            value=int(p.get("doppelschutz_zeitfenster", 30)),
            step=5, key="dops_fenster",
            disabled=not p["doppelschutz_aktiv"],
            help="Wenn AW fehlt: Match ueber Kunde+Artikel innerhalb "
                 "± dieser Tage gegen Bestelldatum.",
        )
        card_close()

        card_open("Score-Gewichte (w1 – w7, Spec §7)")
        st.caption(
            "Score = w1·#Typen + w2·ΣPaletten − w3·Verbrauch "
            "+ w4·ΣEK − w5·ΣMarge + w6·#Sonder + w7·#Kombi.  "
            "Default: nur w1 wirkt (klassisches Min-Typ-Optimum). "
            "Bestand > 0 wird IMMER bevorzugt (Tie-Breaker, Spec §8)."
        )
        p["w1"] = st.slider(
            "w1 — # unterschiedlicher Palettentypen", 0.0, 5.0,
            float(p.get("w1", 1.0)), step=0.1, key="w1_in",
            help="Standard-Strafe — höher = weniger verschiedene Maße.",
        )
        p["w2"] = st.slider(
            "w2 — Σ benötigter Paletten (info)", 0.0, 1.0,
            float(p.get("w2", 0.0)), step=0.05, key="w2_in",
            help="Info-Term im Score-Breakdown — beeinflusst Solver nicht.",
        )
        p["w3"] = st.slider(
            "w3 — Verbrauchs-Bonus (negativ = besser)", 0.0, 5.0,
            float(p.get("w3", 0.0)), step=0.1, key="w3_in",
            help="Höher = Katalog-Maße mit hoher Verbrauchshäufigkeit "
                 "werden bevorzugt.",
        )
        p["w4"] = st.slider(
            "w4 — Σ Einkaufskosten", 0.0, 1.0,
            float(p.get("w4", 0.0)), step=0.05, key="w4_in",
            help="Höher = preisgünstige Katalog-Maße werden bevorzugt "
                 "(EK · Σ Menge der gedeckten Aufträge).",
        )
        p["w5"] = st.slider(
            "w5 — Σ Marge-Bonus (VK − EK)", 0.0, 1.0,
            float(p.get("w5", 0.0)), step=0.05, key="w5_in",
            help="Höher = Katalog-Maße mit hoher Marge werden bevorzugt.",
        )
        p["w6"] = st.slider(
            "w6 — extra Penalty pro Sonder-Typ", 0.0, 10.0,
            float(p.get("w6", 0.0)), step=0.5, key="w6_in",
            help="Zusätzlich zu w1 — höher = noch weniger Sonder.",
        )
        p["w7"] = st.slider(
            "w7 — Penalty pro Kombi-Zuordnung", 0.0, 5.0,
            float(p.get("w7", 0.0)), step=0.1, key="w7_in",
            help="Post-hoc — höher = Kombi-Zuordnungen schlechter "
                 "bewertet (Single-Standard bevorzugt).",
        )
        p["w8"] = st.slider(
            "w8 — Logistik-Mehrkosten (Transport+Lager)", 0.0, 1.0,
            float(p.get("w8", 0.0)), step=0.01, key="w8_in",
            help="Wirkt nur wenn Tab 'Wirtschaftlichkeit' aktiv ist "
                 "(sonst Eintrag = 0).",
        )
        p["w9"] = st.slider(
            "w9 — Handling/Varianten-Einsparung (Bonus)", 0.0, 1.0,
            float(p.get("w9", 0.0)), step=0.01, key="w9_in",
            help="Wirkt nur wenn Tab 'Wirtschaftlichkeit' aktiv ist.",
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
    vbd_lookup = [pal.get("verbrauchsdatum", "") for pal in mit_mass]
    palette_excel_lookup = [
        (pal.get("palette_L_excel"), pal.get("palette_B_excel"))
        for pal in mit_mass
    ]

    # Toggle-Verdrahtung 1:1 nach FINAL-LOCK-Spec
    kombi = bool(p.get("kombinieren", True))
    deckel = (int(p["sonder_deckel"])
              if p.get("sonder_deckel_aktiv") else None)

    # Toleranz-Modus: "absolut" (mm) oder "prozent" (%).
    # Im Prozent-Modus setzen wir die mm-Grenze auf einen sehr hohen
    # Wert, damit nur die Prozent-Bedingung greift.
    modus = p.get("tol_modus", "absolut")
    if modus == "prozent":
        Tk_eff, Tl_eff = 99999, 99999
        Pk_eff = float(p.get("tol_kurz_pct", 15))
        Pl_eff = float(p.get("tol_lang_pct", 10))
        modus_text = f"Modus % (B {Pk_eff:g}% / L {Pl_eff:g}%)"
    else:
        Tk_eff = int(p.get("tol_kurz_mm", 200))
        Tl_eff = int(p.get("tol_lang_mm", 400))
        Pk_eff, Pl_eff = None, None
        modus_text = f"Modus mm (B≤{Tk_eff}mm / L≤{Tl_eff}mm)"

    sonder_erlaubt = bool(p.get("sonder_erlaubt", True))
    sonder_min = int(p.get("sonder_min_artikel", 0))
    sonder_auf = int(p.get("sonder_aufschlag_mm", 0))
    gewichte = {f"w{i}": float(p.get(f"w{i}", 0.0)) for i in range(1, 10)}
    gewichte["w1"] = float(p.get("w1", 1.0))

    hinweis = (f"ILP-Solver (CBC) optimiert {len(orders)} Aufträge — "
               f"{modus_text}, "
               f"Kombi {'an' if kombi else 'aus'}, "
               f"Sonder-Deckel {deckel if deckel is not None else 'frei'}, "
               f"Sonder {'erlaubt' if sonder_erlaubt else 'verboten'}.")
    # Katalog-Maße + Kosten/Marge/Verbrauch/Bestand fuer Score-Gewichte
    try:
        kat_eintraege = katalog_modul.alle()
    except Exception:
        kat_eintraege = []
    kat_masse = []
    katalog_kosten: dict[tuple[int, int], float] = {}
    katalog_marge: dict[tuple[int, int], float] = {}
    katalog_verbrauch: dict[tuple[int, int], float] = {}
    katalog_bestand: dict[tuple[int, int], int] = {}
    for e in kat_eintraege:
        if not e.get("aktiv", True):
            continue
        try:
            cs = int(min(e["L_mm"], e["B_mm"]))
            cl = int(max(e["L_mm"], e["B_mm"]))
        except Exception:
            continue
        kat_masse.append((cs, cl))
        ek = float(e.get("einkaufspreis_eur", 0) or 0)
        vk = float(e.get("verkaufspreis_eur", 0) or 0)
        if ek > 0:
            katalog_kosten[(cs, cl)] = ek
        if vk > 0 and ek > 0:
            katalog_marge[(cs, cl)] = vk - ek
        # w3-Bonus = tatsaechliche Verbrauchshaufigkeit (Spec §7)
        vh = int(e.get("verbrauchshaeufigkeit", 0) or 0)
        if vh > 0:
            katalog_verbrauch[(cs, cl)] = float(vh)
        bestand = int(e.get("bestand", 0) or 0)
        if bestand > 0:
            katalog_bestand[(cs, cl)] = bestand

    # Logistik-Maps fuer w8/w9 — nur wenn Wirtschaftlichkeit aktiv.
    # Approximative pro-Typ-Kosten:
    #   mehrkosten = (Δfläche zu durchschnittlicher Alternative) ·
    #                 kosten_pro_lademeter / (lkw_breite · 1000)
    #   einsparung = handling_pro_typ + varianten_pro_typ
    # Da wir alternative Maße nicht im voraus kennen, nehmen wir als
    # Approx: mehrkosten = palette_flaeche / (lkw_breite·1000) × kpl
    # (= 'wieviele Lademeter belegt 1 Stk dieser Palette als single').
    log_mehr_map, log_einsp_map = None, None
    try:
        cp_w = wirt_modul.lade_params()
        if cp_w.get("aktiv"):
            handling = float(cp_w.get("handling_kosten_pro_palettentyp_eur", 0))
            varianten = float(cp_w.get("variantenkosten_pro_typ_eur", 0))
            kpl = wirt_modul.kosten_pro_lademeter(cp_w)
            lkw_b = int(cp_w.get("lkw_breite_mm", 2450))
            log_mehr_map = {}
            log_einsp_map = {}
            for k in kat_masse:
                cs, cl = min(k), max(k)
                # Palette-Flaeche / (lkw_b·1000) → Lademeter
                lm_pro_stk = (cs * cl) / (max(1, lkw_b) * 1000.0)
                log_mehr_map[k] = lm_pro_stk * kpl
                log_einsp_map[k] = handling + varianten
    except Exception:
        pass

    with st.spinner(hinweis):
        res = optimiere(
            orders,
            tol_kurz_mm=Tk_eff,
            tol_lang_mm=Tl_eff,
            tol_kurz_pct=Pk_eff,
            tol_lang_pct=Pl_eff,
            max_kombi_teile=3 if kombi else 1,
            heterogen_fallback=kombi,
            sonder_deckel=deckel,
            zeitlimit_s=120,
            katalog=kat_masse,
            sonder_erlaubt=sonder_erlaubt,
            sonder_min_artikel=sonder_min,
            sonder_aufschlag_mm=sonder_auf,
            gewichte=gewichte,
            katalog_kosten=katalog_kosten or None,
            katalog_marge=katalog_marge or None,
            katalog_verbrauch=katalog_verbrauch or None,
            katalog_bestand=katalog_bestand or None,
            logistik_mehrkosten_per_typ=log_mehr_map,
            logistik_einsparung_per_typ=log_einsp_map,
        )
    import uuid as _uuid
    st.session_state.ergebnis_id = _uuid.uuid4().hex
    # Artikelnummer + Roh-Palettenmaße aus Excel nachreichen
    for idx, zg in enumerate(res.get("zuordnung", [])):
        zg["artikelnummer"] = (artikel_lookup[idx]
                                if idx < len(artikel_lookup) else "")
        zg["verbrauchsdatum"] = (vbd_lookup[idx]
                                  if idx < len(vbd_lookup) else "")
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
                "tol_modus": modus,
                "tol_kurz_mm": int(p["tol_kurz_mm"]) if modus == "absolut" else None,
                "tol_lang_mm": int(p["tol_lang_mm"]) if modus == "absolut" else None,
                "tol_kurz_pct": float(p["tol_kurz_pct"]) if modus == "prozent" else None,
                "tol_lang_pct": float(p["tol_lang_pct"]) if modus == "prozent" else None,
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
        if p.get("tol_modus", "absolut") == "prozent":
            tol_zeilen = (
                f"<b>Toleranz-Modus:</b> Prozentual<br>"
                f"<b>max. Übermaß BREITE:</b> {float(p['tol_kurz_pct']):g} %<br>"
                f"<b>max. Übermaß LÄNGE:</b> {float(p['tol_lang_pct']):g} %<br>"
            )
        else:
            tol_zeilen = (
                f"<b>Toleranz-Modus:</b> Absolut<br>"
                f"<b>max. Übermaß BREITE:</b> {int(p['tol_kurz_mm'])} mm<br>"
                f"<b>max. Übermaß LÄNGE:</b> {int(p['tol_lang_mm'])} mm<br>"
            )
        st.markdown(
            f"<div style='font-size:13px;color:#374151;line-height:1.8;'>"
            f"{tol_zeilen}"
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
    # Modus-Anzeige aus result['parameter'] — single source of truth
    pk_real = rparam.get("tol_kurz_pct")
    pl_real = rparam.get("tol_lang_pct")
    if pk_real is not None or pl_real is not None:
        tol_anzeige = (f'Übermaß: BREITE {pk_real:g} % · '
                       f'LÄNGE {pl_real:g} %')
    else:
        tol_anzeige = (f'Übermaß: BREITE {int(rparam.get("tol_kurz_mm", 0))}mm · '
                       f'LÄNGE {int(rparam.get("tol_lang_mm", 0))}mm')
    st.markdown(
        f'<div style="background:#f8fafc;border:1px solid #e2e8f0;'
        f'border-radius:6px;padding:8px 12px;margin:8px 0 16px;'
        f'font-size:12px;color:#475569;">'
        f'⚙️ {tol_anzeige} · '
        f'Kombinieren = {"an" if kombi_real else "aus"} · '
        f'Sonder-Deckel = {deckel_txt} · '
        f'Coverage = einseitig · '
        f'ILP-Status = {res.get("status", "?")} · '
        f'<span style="color:{inv_color};font-weight:700;">{inv_text}</span>'
        f'</div>',
        unsafe_allow_html=True,
    )


def _erste_zuord_field(res: dict, kand: tuple, feld: str) -> str:
    """Liefert den ersten Wert eines Felds aus den Zuordnungen, die
    diesem Kandidaten (canonical kurz,lang) entsprechen."""
    target = f"{kand[1]}x{kand[0]}"
    for z in res.get("zuordnung", []):
        if z.get("typ") == "Standard" and z.get("ziel") == target:
            v = z.get(feld, "") or ""
            if v:
                return str(v)
    return ""


def _dashboard_workflow(res: dict, katalog_set: set) -> None:
    """Dashboard pro Paletten-Typ (Spec §6 + §10): Benoetigt / Bestand /
    Differenz / EK gesamt + Aktionen 'Bestellung getätigt' und
    'Als neue Größe übernehmen'. Idempotent per ergebnis_id."""
    erg_id = st.session_state.get("ergebnis_id")
    if not erg_id:
        return

    bn = res.get("bestand_nutzung", {}) or {}
    # Σ Menge pro Standard-Maß aus zuordnung (auch Maße ohne Katalog)
    from collections import defaultdict
    std_menge: dict[tuple, int] = defaultdict(int)
    sonder_menge: dict[tuple, int] = defaultdict(int)
    nz_menge = 0
    for z in res.get("zuordnung", []):
        typ = z.get("typ", "")
        menge = int(z.get("menge", 0))
        if typ == "Standard":
            try:
                a, b = z["ziel"].split("x")
                kand = (min(int(a), int(b)), max(int(a), int(b)))
                std_menge[kand] += menge
            except Exception:
                pass
        elif typ == "Sonder":
            try:
                a, b = z["ziel"].split("x")
                kand = (min(int(a), int(b)), max(int(a), int(b)))
                sonder_menge[kand] += menge
            except Exception:
                pass
        elif typ == "Nicht zuordenbar":
            nz_menge += menge

    if not std_menge and not sonder_menge:
        return

    card_open("📋 Dashboard — Aktionen pro Paletten-Typ (Spec §6 + §10)")

    rows = []
    for kand, menge in sorted(std_menge.items()):
        preise = katalog_modul.lookup_preise(kand[1], kand[0])
        bestand_aktuell = int(preise["bestand"]) if preise else 0
        ek = float(preise["einkaufspreis_eur"]) if preise else 0.0
        vk = float(preise["verkaufspreis_eur"]) if preise else 0.0
        diff = max(0, menge - bestand_aktuell)
        rows.append({
            "kand": kand,
            "typ": "Standard",
            "name": (preise.get("name", "") if preise else ""),
            "benoetigt": menge,
            "bestand": bestand_aktuell,
            "differenz": diff,
            "ek_gesamt": diff * ek,
            "vk_gesamt": menge * vk if vk > 0 else 0.0,
            "kat_id": preise["id"] if preise else None,
            "vollstaendig": (preise is not None and ek > 0 and vk > 0),
        })
    for kand, menge in sorted(sonder_menge.items()):
        preise = katalog_modul.lookup_preise(kand[1], kand[0])
        rows.append({
            "kand": kand,
            "typ": "Sonder",
            "name": (preise.get("name", "") if preise else "—"),
            "benoetigt": menge,
            "bestand": int(preise["bestand"]) if preise else 0,
            "differenz": menge - (int(preise["bestand"]) if preise else 0),
            "ek_gesamt": 0.0,
            "vk_gesamt": 0.0,
            "kat_id": preise["id"] if preise else None,
            "vollstaendig": False,
        })

    # Status-Spalte Render
    bestellt_set = st.session_state.get("bestellt_pro_kand", {})
    uebernommen_set = st.session_state.get("neue_sonder_uebernommen", {})
    for r in rows:
        key = (erg_id, r["kand"])
        r["bestellt"] = bool(bestellt_set.get(key))
        r["uebernommen"] = bool(uebernommen_set.get(key))

    # Tabelle
    df_disp = pd.DataFrame([
        {
            "Typ": r["typ"],
            "Name": r["name"],
            "Maß (mm)": f"{r['kand'][1]} × {r['kand'][0]}",
            "Benötigt": r["benoetigt"],
            "Bestand": r["bestand"],
            "Differenz": r["differenz"],
            "EK gesamt (€)": r["ek_gesamt"],
            "Status": (
                "✓ bestellt" if r["bestellt"]
                else ("➕ übernommen" if r["uebernommen"]
                      else ("⚠ EK/VK fehlt" if not r["vollstaendig"]
                            else "offen"))
            ),
        }
        for r in rows
    ])
    st.dataframe(
        df_disp, use_container_width=True, hide_index=True,
        column_config={
            "Benötigt": st.column_config.NumberColumn(format="%d"),
            "Bestand": st.column_config.NumberColumn(format="%d"),
            "Differenz": st.column_config.NumberColumn(format="%d"),
            "EK gesamt (€)": st.column_config.NumberColumn(format="%.2f €"),
        },
    )

    if nz_menge > 0:
        st.warning(
            f"⚠️ {nz_menge} Paletten in 'Nicht zuordenbar' — Toleranz "
            f"erweitern oder Sonderpaletten zulassen."
        )

    # Aktions-Buttons pro Zeile
    st.markdown("**Aktionen pro Typ**")
    for i, r in enumerate(rows):
        c1, c2, c3, c4 = st.columns([2, 1, 1.4, 1.4])
        c1.markdown(
            f"<div style='padding-top:6px;font-size:13px;'>"
            f"<b>{r['typ']}</b> · {r['kand'][1]} × {r['kand'][0]} mm — "
            f"{r['benoetigt']} benötigt / Bestand {r['bestand']} / "
            f"Differenz <b>{r['differenz']}</b></div>",
            unsafe_allow_html=True,
        )
        key = (erg_id, r["kand"])
        # "Bestellung getätigt" — nur fuer Maße mit Katalog-Eintrag.
        # Vor Anpassung: Modal-Form mit Pflichtfeldern (Spec §7).
        if r["kat_id"]:
            if r["bestellt"]:
                c2.success("✓ bestellt")
            else:
                if c2.button("📦 Bestellung", key=f"bes_{i}",
                              help="Bestand -= Menge, Verbrauch +1, "
                                   "Historie-Eintrag (Spec §7). Erst Pflicht"
                                   "felder eingeben."):
                    # Modal aktivieren: pflichtfelder werden weiter unten
                    # in einem Expander abgefragt.
                    st.session_state.bestellung_modal = {
                        "ergebnis_id": erg_id,
                        "kand": r["kand"],
                        "kat_id": r["kat_id"],
                        "benoetigt": r["benoetigt"],
                        # Vorbelegung aus der ersten Zuordnung dieser kand
                        "kunde": _erste_zuord_field(res, r["kand"], "name"),
                        "artikelnummer": _erste_zuord_field(
                            res, r["kand"], "artikelnummer"),
                        "auftragsnummer_aw": _erste_zuord_field(
                            res, r["kand"], "auftrag"),
                        "vbd": _erste_zuord_field(
                            res, r["kand"], "verbrauchsdatum"),
                    }
                    st.rerun()
        else:
            c2.caption("kein Katalog")

        # "Als neue Größe übernehmen" — fuer Sonder ohne Katalog
        if r["typ"] == "Sonder" and not r["kat_id"]:
            if r["uebernommen"]:
                c3.success("➕ angelegt")
            else:
                if c3.button("➕ neue Größe übernehmen", key=f"snd_{i}"):
                    nid = katalog_modul.als_sonder_uebernehmen(
                        r["kand"][1], r["kand"][0]
                    )
                    uebernommen_set[key] = nid
                    st.session_state.neue_sonder_uebernommen = uebernommen_set
                    st.success(
                        f"Neue Palettengröße {r['kand'][1]}×{r['kand'][0]} "
                        f"angelegt. Bitte EK und VK im Bestand nachtragen."
                    )
                    st.rerun()
        elif r["typ"] == "Sonder" and r["kat_id"]:
            c3.caption("bereits im Katalog")

        # Marge anzeigen wenn vorhanden
        if r["vollstaendig"]:
            marge = (r["vk_gesamt"] - r["benoetigt"]
                      * float(katalog_modul.lookup_preise(r['kand'][1],
                              r['kand'][0])['einkaufspreis_eur']))
            c4.metric("Marge gesamt", f"{marge:.2f} €",
                       label_visibility="visible")

    # === Bestellung-Modal (Spec §7 — Pflichtfelder vor Bestand-Aenderung) ===
    modal = st.session_state.get("bestellung_modal")
    if modal:
        st.markdown("---")
        card_open(f"📦 Bestellung bestätigen — "
                  f"{modal['kand'][1]} × {modal['kand'][0]} mm")
        st.caption(
            "Vor der Bestand-Anpassung müssen Kunde, Artikelnummer, AW und "
            "geplantes Verbrauchsdatum gesetzt sein. Die Werte werden im "
            "Historie-Eintrag persistent gespeichert."
        )
        with st.form(f"bestellung_form_{modal['kand']}"):
            mc1, mc2, mc3 = st.columns(3)
            with mc1:
                m_kunde = st.text_input("Kunde *",
                                          value=modal.get("kunde", ""))
                m_art = st.text_input("Artikelnummer *",
                                        value=modal.get("artikelnummer", ""))
            with mc2:
                m_aw = st.text_input("Auftragsnummer (AW) *",
                                       value=modal.get("auftragsnummer_aw", ""))
                m_menge = st.number_input(
                    "Menge *", min_value=1, max_value=1000000,
                    value=int(modal.get("benoetigt", 1)), step=1,
                )
            with mc3:
                from datetime import date as _date
                m_vbd_default = modal.get("vbd", "") or ""
                m_vbd = st.text_input(
                    "Geplantes Verbrauchsdatum * (YYYY-MM-DD)",
                    value=m_vbd_default,
                    help="Datum im ISO-Format YYYY-MM-DD.",
                )
                m_bd = st.text_input(
                    "Bestelldatum (YYYY-MM-DD)",
                    value=_date.today().isoformat(),
                )
            m_notiz = st.text_input("Notiz (optional)", value="")
            sb1, sb2 = st.columns([1, 1])
            confirm = sb1.form_submit_button(
                "✓ Bestellung bestätigen", type="primary",
                use_container_width=True,
            )
            cancel = sb2.form_submit_button(
                "✗ Abbrechen", use_container_width=True,
            )
            if confirm:
                pflicht_fehlt = []
                if not m_kunde.strip(): pflicht_fehlt.append("Kunde")
                if not m_art.strip(): pflicht_fehlt.append("Artikelnummer")
                if not m_aw.strip(): pflicht_fehlt.append("AW")
                if not m_vbd.strip(): pflicht_fehlt.append("Verbrauchsdatum")
                if pflicht_fehlt:
                    st.error(
                        f"Pflichtfelder fehlen: {', '.join(pflicht_fehlt)}"
                    )
                else:
                    erg = bestellungen_modul.bestellung_atomar(
                        katalog_modul=katalog_modul,
                        palette_id=modal["kat_id"],
                        menge=int(m_menge),
                        kunde=m_kunde.strip(),
                        artikelnummer=m_art.strip(),
                        auftragsnummer_aw=m_aw.strip(),
                        geplantes_verbrauchsdatum=m_vbd.strip(),
                        bestelldatum=m_bd.strip(),
                        ergebnis_id=st.session_state.get("ergebnis_id"),
                        notiz=m_notiz.strip(),
                    )
                    if erg["ok"]:
                        key = (modal["ergebnis_id"], modal["kand"])
                        bestellt_set[key] = True
                        st.session_state.bestellt_pro_kand = bestellt_set
                        st.session_state.bestellt_ergebnisse = \
                            st.session_state.get("bestellt_ergebnisse",
                                                  set()) | {modal["ergebnis_id"]}
                        st.session_state.bestellung_modal = None
                        st.success(
                            f"Bestellung gespeichert (id={erg['bestellung_id'][:8]}). "
                            f"Bestand reduziert."
                        )
                        st.rerun()
                    else:
                        st.error(f"Fehler: {erg['fehler']}")
            elif cancel:
                st.session_state.bestellung_modal = None
                st.rerun()
        card_close()

    card_close()


def seite_ergebnisse() -> None:
    if st.session_state.ergebnis is None:
        st.info("Erst optimieren.")
        return
    res = st.session_state.ergebnis

    kpi_uebersicht()

    # === Inline-Anpassung mit Modus-Umschalter (mm / %) ===
    card_open("🔁 Parameter anpassen und neu rechnen")
    p = st.session_state.params
    # Modus-Umschalter ueber den Eingaben
    modi = ["Absolut (mm)", "Prozentual (%)"]
    modi_keys = ["absolut", "prozent"]
    idx = 0 if p.get("tol_modus", "absolut") == "absolut" else 1
    sel = st.radio("Toleranz-Modus", modi, index=idx, horizontal=True,
                   key="erg_tol_modus")
    p["tol_modus"] = modi_keys[modi.index(sel)]

    c1, c2, c3, c4 = st.columns([1.2, 1.2, 1, 1.2])
    with c1:
        if p["tol_modus"] == "absolut":
            p["tol_kurz_mm"] = st.number_input(
                "max. Übermaß BREITE (mm)", min_value=0, max_value=2000,
                value=int(p["tol_kurz_mm"]), step=10, key="erg_tol_kurz_mm",
            )
            p["tol_lang_mm"] = st.number_input(
                "max. Übermaß LÄNGE (mm)", min_value=0, max_value=2000,
                value=int(p["tol_lang_mm"]), step=10, key="erg_tol_lang_mm",
            )
        else:
            p["tol_kurz_pct"] = st.number_input(
                "max. Übermaß BREITE (%)",
                min_value=0.0, max_value=100.0,
                value=float(p.get("tol_kurz_pct", 15)), step=1.0,
                format="%.1f", key="erg_tol_kurz_pct",
            )
            p["tol_lang_pct"] = st.number_input(
                "max. Übermaß LÄNGE (%)",
                min_value=0.0, max_value=100.0,
                value=float(p.get("tol_lang_pct", 10)), step=1.0,
                format="%.1f", key="erg_tol_lang_pct",
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

    # --- Score-Breakdown (alle 7 Gewichte sichtbar, Spec §7) ---
    bd = res.get("score_breakdown") or {}
    if bd:
        card_open(f"📊 Score-Breakdown — Gesamt {res.get('score', 0.0):.2f}")
        score_zeilen = [
            ("w1 · # Palettentypen", bd.get("w1_palettentypen", 0.0)),
            ("w2 · Σ Paletten (info)", bd.get("w2_gesamt_paletten", 0.0)),
            ("w3 · Verbrauchs-Bonus", bd.get("w3_verbrauch_bonus", 0.0)),
            ("w4 · Σ EK-Kosten", bd.get("w4_gesamtkosten_ek", 0.0)),
            ("w5 · Marge-Bonus", bd.get("w5_marge_bonus", 0.0)),
            ("w6 · Sonder-Penalty", bd.get("w6_sonder_penalty", 0.0)),
            ("w7 · Kombi-Penalty", bd.get("w7_kombi_penalty", 0.0)),
            ("w8 · Logistik-Mehrkosten", bd.get("w8_logistik_mehrkosten", 0.0)),
            ("w9 · Logistik-Einsparung",
             bd.get("w9_logistik_einsparung_bonus", 0.0)),
            ("BIG · # nicht zuordenbar", bd.get("slack_nicht_zuordenbar", 0.0)),
        ]
        df_score = pd.DataFrame(
            [{"Komponente": k, "Beitrag": float(v)} for k, v in score_zeilen]
        )
        st.dataframe(
            df_score, use_container_width=True, hide_index=True,
            column_config={
                "Beitrag": st.column_config.NumberColumn(format="%.3f"),
            },
        )
        n_nz = len(res.get("nicht_zuordenbar", []))
        if n_nz > 0:
            st.warning(
                f"⚠️ {n_nz} Auftrag/Aufträge konnten weder durch Standard "
                f"noch Sonder gedeckt werden (Sonderpaletten verboten oder "
                f"Toleranz zu eng). Siehe Filter 'Nicht zuordenbar'."
            )
        card_close()

    # --- Filter ---
    filter_opt = ["alle", "Standard", "Kombi", "Sonder", "Nicht zuordenbar"]
    aktiver_filter = p.get("ergebnis_filter", "alle")
    if aktiver_filter not in filter_opt:
        aktiver_filter = "alle"
    sel = st.radio(
        "🔍 Filter Detail-Tabelle",
        filter_opt,
        index=filter_opt.index(aktiver_filter),
        horizontal=True,
        key="erg_filter_in",
    )
    p["ergebnis_filter"] = sel

    def _passt_filter(typ: str) -> bool:
        if sel == "alle":
            return True
        if sel == "Standard":
            return typ == "Standard"
        if sel == "Kombi":
            return typ in ("Kombi-Stapel", "Kombi-Heterogen")
        if sel == "Sonder":
            return typ == "Sonder"
        if sel == "Nicht zuordenbar":
            return typ == "Nicht zuordenbar"
        return True

    if sel != "alle":
        # Gefilterte Kopie des Ergebnisses fuers Rendering
        res_gefiltert = dict(res)
        res_gefiltert["zuordnung"] = [
            z for z in res.get("zuordnung", []) if _passt_filter(z.get("typ", ""))
        ]
    else:
        res_gefiltert = res

    # --- Dashboard-Workflow (Spec §6 + §10): pro Standard
    # Benoetigt / Bestand / Differenz + "Bestellung getätigt"-Button.
    # Sonder ohne Katalog-Match: "Als neue Größe übernehmen"-Button.
    _dashboard_workflow(res, katalog_set)

    cl, cr = st.columns([2, 1])
    with cl:
        card_open(f"Detail-Zuordnung — {res['gesamt']} Maße "
                  f"({len(res['standards'])} Std + {len(res['sonder'])} Sonder)"
                  + (f" · Filter: {sel} ({len(res_gefiltert['zuordnung'])})"
                     if sel != "alle" else ""))
        st.markdown(
            f'<div style="max-height:560px;overflow:auto;">'
            f'{render_zuord_table(res_gefiltert, katalog_set)}</div>',
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

    # --- Compare-Modus: mit vs ohne Sonderpaletten ---
    card_open("🔬 Vergleich: mit / ohne Sonderpaletten")
    st.caption(
        "Rechnet zwei Szenarien mit den aktuellen Parametern: "
        "einmal mit Sonderpaletten erlaubt, einmal verboten. "
        "Zeigt Trade-off zwischen # Palettentypen und # nicht zuordenbaren "
        "Aufträgen."
    )
    if st.button("⚖️ Vergleich rechnen", key="cmp_run"):
        _run_vergleich()
    cmp = st.session_state.get("vergleich")
    if cmp:
        c1, c2 = st.columns(2)
        for col, key, titel in (
            (c1, "mit", "Mit Sonderpaletten"),
            (c2, "ohne", "Ohne Sonderpaletten (nur Katalog)"),
        ):
            r = cmp.get(key, {})
            with col:
                st.markdown(
                    f"<div style='font-size:14px;font-weight:700;color:#1e293b;'>"
                    f"{titel}</div>",
                    unsafe_allow_html=True,
                )
                st.metric("GESAMT", _fmt_int(r.get("gesamt", 0)))
                st.metric("Standards", _fmt_int(len(r.get("standards", []))))
                st.metric("Sonder", _fmt_int(len(r.get("sonder", []))))
                st.metric("Nicht zuordenbar",
                          _fmt_int(len(r.get("nicht_zuordenbar", []))))
                st.metric("Score", f"{r.get('score', 0.0):.2f}")
    card_close()

    # --- Export-Zeile: CSV + JSON ---
    rows = []
    for z in res["zuordnung"]:
        rows.append({
            "Auftrag": z.get("auftrag", ""),
            "Kunde": z.get("name", ""),
            "Artikelnummer": z.get("artikelnummer", ""),
            "Verbrauchsdatum": z.get("verbrauchsdatum", ""),
            "Paletten (Menge)": z.get("menge", 0),
            "Excel P-L": z.get("palette_L_excel", ""),
            "Excel P-B": z.get("palette_B_excel", ""),
            "Produkt L (= P-L - Aufschlag)": z.get("L", 0),
            "Produkt B (= P-B - Aufschlag)": z.get("B", 0),
            "Ziel": z.get("ziel", ""),
            "Typ": z.get("typ", ""),
        })
    csv = pd.DataFrame(rows).to_csv(index=False, sep=";", encoding="utf-8-sig").encode("utf-8-sig")

    json_export = {
        "datei_name": st.session_state.get("datei_name", ""),
        "zeitpunkt": datetime.now().isoformat(timespec="seconds"),
        "parameter": res.get("parameter", {}),
        "score": res.get("score", 0.0),
        "score_breakdown": res.get("score_breakdown", {}),
        "gesamt": res.get("gesamt", 0),
        "standards": [list(s) for s in res.get("standards", [])],
        "sonder": [list(s) for s in res.get("sonder", [])],
        "nicht_zuordenbar": res.get("nicht_zuordenbar", []),
        "zuordnung": rows,
    }
    json_bytes = json.dumps(json_export, ensure_ascii=False, indent=2,
                             default=str).encode("utf-8")

    ec1, ec2 = st.columns(2)
    ec1.download_button(
        "📥 Zuordnung als CSV exportieren",
        data=csv,
        file_name="paletten-mini-zuordnung.csv",
        mime="text/csv",
        use_container_width=True,
    )
    ec2.download_button(
        "📥 Vollständiges Ergebnis (JSON)",
        data=json_bytes,
        file_name="paletten-mini-ergebnis.json",
        mime="application/json",
        use_container_width=True,
    )


def _run_vergleich() -> None:
    """Rechnet zwei Szenarien (mit/ohne Sonder) mit aktuellen Params."""
    if st.session_state.import_dat is None:
        return
    p = st.session_state.params
    mit_mass = st.session_state.import_dat["mit_mass"]
    orders = [
        {"L": pal["laenge"], "B": pal["breite"], "menge": pal["anzahl"],
         "auftrag": pal["auftrag"], "name": pal["name"]}
        for pal in mit_mass
    ]
    kombi = bool(p.get("kombinieren", True))
    deckel = (int(p["sonder_deckel"])
              if p.get("sonder_deckel_aktiv") else None)
    modus = p.get("tol_modus", "absolut")
    if modus == "prozent":
        Tk_eff, Tl_eff = 99999, 99999
        Pk_eff = float(p.get("tol_kurz_pct", 15))
        Pl_eff = float(p.get("tol_lang_pct", 10))
    else:
        Tk_eff = int(p.get("tol_kurz_mm", 200))
        Tl_eff = int(p.get("tol_lang_mm", 400))
        Pk_eff, Pl_eff = None, None
    try:
        kat_masse = katalog_modul.aktive_masse()
    except Exception:
        kat_masse = []
    gewichte = {f"w{i}": float(p.get(f"w{i}", 0.0)) for i in range(1, 6)}
    gewichte["w1"] = float(p.get("w1", 1.0))
    gemeinsam = dict(
        tol_kurz_mm=Tk_eff, tol_lang_mm=Tl_eff,
        tol_kurz_pct=Pk_eff, tol_lang_pct=Pl_eff,
        max_kombi_teile=3 if kombi else 1,
        heterogen_fallback=kombi,
        sonder_deckel=deckel,
        zeitlimit_s=60,
        katalog=kat_masse,
        sonder_min_artikel=int(p.get("sonder_min_artikel", 0)),
        sonder_aufschlag_mm=int(p.get("sonder_aufschlag_mm", 0)),
        gewichte=gewichte,
    )
    with st.spinner("Vergleich rechnet …"):
        r_mit = optimiere(orders, sonder_erlaubt=True, **gemeinsam)
        r_ohne = optimiere(orders, sonder_erlaubt=False, **gemeinsam)
    st.session_state.vergleich = {"mit": r_mit, "ohne": r_ohne}


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
        c0a, c0b = st.columns([2, 1])
        with c0a:
            n_name = st.text_input("Name", value="", key="kat_new_name",
                                    placeholder="z.B. Europalette")
        with c0b:
            n_typ = st.selectbox("Typ", ["standard", "sonder", "kombi-teil"],
                                  index=0, key="kat_new_typ")
        c1, c2, c3, c4 = st.columns([1, 1, 1.2, 1.2])
        with c1:
            n_L = st.number_input("Länge (mm)", min_value=0, max_value=10000,
                                   value=1200, step=10, key="kat_new_L")
        with c2:
            n_B = st.number_input("Breite (mm)", min_value=0, max_value=10000,
                                   value=800, step=10, key="kat_new_B")
        with c3:
            n_hoehe = st.number_input("Höhe (mm, optional)", min_value=0,
                                       max_value=5000, value=0, step=5,
                                       key="kat_new_hoehe",
                                       help="0 = nicht angegeben.")
        with c4:
            n_ek = st.number_input("Einkaufspreis (€)", min_value=0.0,
                                    value=0.0, step=0.50, format="%.2f",
                                    key="kat_new_ek")
        c5, c6, c7, c8 = st.columns([1, 1, 1, 2])
        with c5:
            n_vk = st.number_input("Verkaufspreis (€)", min_value=0.0,
                                    value=0.0, step=0.50, format="%.2f",
                                    key="kat_new_vk")
        with c6:
            n_best = st.number_input("Bestand (Stk)", min_value=0,
                                      max_value=100000, value=0, step=1,
                                      key="kat_new_best",
                                      help="Aktuelle Lagermenge in Stück.")
        with c7:
            n_meld = st.number_input("Meldebestand (Stk)", min_value=0,
                                      max_value=100000, value=0, step=1,
                                      key="kat_new_meld",
                                      help="Warnung wenn Bestand ≤ Wert.")
        with c8:
            n_notiz = st.text_input("Notiz (optional)", value="",
                                     key="kat_new_notiz")
        # Validierung VK >= EK (Warnung, nicht hart)
        if n_vk > 0 and n_ek > 0 and n_vk < n_ek:
            st.warning("VK < EK — negative Marge. Wirklich speichern?")
        if st.button("Palette hinzufügen", type="primary",
                      use_container_width=True, key="kat_add_btn"):
            if n_L > 0 and n_B > 0:
                katalog_modul.neuer_eintrag(int(n_L), int(n_B),
                                            float(n_ek), float(n_vk),
                                            int(n_best), int(n_meld),
                                            n_notiz, aktiv=True,
                                            name=n_name,
                                            hoehe_mm=int(n_hoehe),
                                            typ=n_typ,
                                            quelle="manuell")
                st.success(f"Eintrag {int(max(n_L,n_B))}×{int(min(n_L,n_B))} "
                           f"hinzugefügt.")
                st.rerun()
            else:
                st.error("Länge und Breite müssen > 0 sein.")
    card_close()

    # === CSV-Import/Export (Spec §5) ===
    with st.expander("📂 CSV-Import / -Export", expanded=False):
        st.caption(
            "Spalten: `name;laenge;breite;hoehe;bestand;meldebestand;ek;vk;typ;notiz`. "
            "Trenner Semikolon oder Komma, UTF-8. Pflicht: name, laenge, "
            "breite, bestand."
        )
        c_imp, c_exp = st.columns(2)
        with c_imp:
            uploaded = st.file_uploader("CSV hochladen", type=["csv"],
                                          key="kat_csv_up")
            ersetzen = st.toggle("Bestehende Einträge ersetzen",
                                  value=False, key="kat_csv_ersetzen",
                                  help="ON = Katalog wird vorher geleert.")
            if uploaded and st.button("CSV importieren", key="kat_csv_imp_btn"):
                try:
                    text = uploaded.read().decode("utf-8", errors="replace")
                except Exception:
                    text = uploaded.read().decode("latin-1", errors="replace")
                erg = katalog_modul.aus_csv(text, ersetze_alles=ersetzen)
                if erg["importiert"] > 0:
                    st.success(f"{erg['importiert']} Einträge importiert.")
                if erg["fehler"]:
                    st.error(
                        f"{len(erg['fehler'])} Fehler:\n" +
                        "\n".join(f"• {f}" for f in erg["fehler"][:10])
                    )
                if erg["importiert"] > 0:
                    st.rerun()
        with c_exp:
            csv_text = katalog_modul.nach_csv()
            st.download_button(
                "📥 Katalog als CSV exportieren",
                data=csv_text.encode("utf-8"),
                file_name="palettenkatalog.csv",
                mime="text/csv",
                use_container_width=True,
            )
            st.caption(f"{len(eintraege)} Einträge bereit zum Export.")

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
            "Name": e.get("name", ""),
            "Typ": e.get("typ", "standard"),
            "Länge": e["L_mm"],
            "Breite": e["B_mm"],
            "Höhe": int(e.get("hoehe_mm", 0)) or "—",
            "Einkauf (€)": e.get("einkaufspreis_eur", 0.0),
            "Verkauf (€)": e.get("verkaufspreis_eur", 0.0),
            "Marge (€)": (e.get("verkaufspreis_eur", 0.0)
                          - e.get("einkaufspreis_eur", 0.0)),
            "Bestand": int(e.get("bestand", 0)),
            "Meldebestand": int(e.get("meldebestand", 0)),
            "Verbrauch": int(e.get("verbrauchshaeufigkeit", 0)),
            "Vollständig": "✓" if katalog_modul.vollstaendig(e) else "⚠️ EK/VK",
            "Status": ("⚠️ niedrig" if (int(e.get("meldebestand", 0)) > 0
                       and int(e.get("bestand", 0))
                       <= int(e.get("meldebestand", 0))) else "✓ ok"),
            "Quelle": e.get("quelle", "manuell"),
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
                     "Verbrauch":     st.column_config.NumberColumn(format="%d"),
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
    titel = (eintrag.get("name", "") or
              f"{eintrag['L_mm']}×{eintrag['B_mm']}")
    with st.expander(f"Bearbeiten: {titel}", expanded=False):
        c0a, c0b = st.columns([2, 1])
        with c0a:
            e_name = st.text_input("Name",
                                     value=eintrag.get("name", ""),
                                     key=f"kat_edit_name_{eintrag['id']}")
        with c0b:
            typ_opt = ["standard", "sonder", "kombi-teil"]
            e_typ = st.selectbox(
                "Typ", typ_opt,
                index=typ_opt.index(eintrag.get("typ", "standard"))
                       if eintrag.get("typ", "standard") in typ_opt else 0,
                key=f"kat_edit_typ_{eintrag['id']}",
            )
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
            e_hoehe = st.number_input("Höhe (mm)", min_value=0,
                                       max_value=5000,
                                       value=int(eintrag.get("hoehe_mm", 0)),
                                       step=5,
                                       key=f"kat_edit_hoehe_{eintrag['id']}")
        with c4:
            e_ek = st.number_input("Einkaufspreis (€)", min_value=0.0,
                                    value=float(eintrag.get("einkaufspreis_eur", 0.0)),
                                    step=0.50, format="%.2f",
                                    key=f"kat_edit_ek_{eintrag['id']}")
        c5, c6, c7 = st.columns([1.2, 1, 1])
        with c5:
            e_vk = st.number_input("Verkaufspreis (€)", min_value=0.0,
                                    value=float(eintrag.get("verkaufspreis_eur", 0.0)),
                                    step=0.50, format="%.2f",
                                    key=f"kat_edit_vk_{eintrag['id']}")
        with c6:
            e_best = st.number_input("Bestand (Stk)", min_value=-100000,
                                      max_value=100000,
                                      value=int(eintrag.get("bestand", 0)),
                                      step=1,
                                      key=f"kat_edit_best_{eintrag['id']}",
                                      help="Aktuelle Lagermenge.")
        with c7:
            e_meld = st.number_input("Meldebestand (Stk)", min_value=0,
                                      max_value=100000,
                                      value=int(eintrag.get("meldebestand", 0)),
                                      step=1,
                                      key=f"kat_edit_meld_{eintrag['id']}",
                                      help="Warnung wenn Bestand ≤ diesem Wert.")
        if e_vk > 0 and e_ek > 0 and e_vk < e_ek:
            st.warning("VK < EK — negative Marge.")
        e_notiz = st.text_input("Notiz", value=eintrag.get("notiz", ""),
                                 key=f"kat_edit_notiz_{eintrag['id']}")
        e_aktiv = st.toggle("Aktiv (wird vom Optimierer berücksichtigt)",
                             value=bool(eintrag.get("aktiv", True)),
                             key=f"kat_edit_aktiv_{eintrag['id']}")
        cs, cd = st.columns(2)
        if cs.button("💾 Speichern", type="primary",
                      use_container_width=True,
                      key=f"kat_save_{eintrag['id']}"):
            katalog_modul.update_eintrag(eintrag["id"],
                                          name=e_name,
                                          typ=e_typ,
                                          L_mm=int(e_L), B_mm=int(e_B),
                                          hoehe_mm=int(e_hoehe),
                                          einkaufspreis_eur=float(e_ek),
                                          verkaufspreis_eur=float(e_vk),
                                          bestand=int(max(0, e_best)),
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

    # Kritische Paletten (Reichweite + Ampel, Spec §9)
    try:
        krit_v = verbrauch_modul.kritische_paletten(
            katalog_modul=katalog_modul,
            bestellungen_modul=bestellungen_modul,
        )
    except Exception:
        krit_v = []
    if krit_v:
        kritisch_nur = [k for k in krit_v if k["kritisch"]]
        card_open(f"🚦 Verbrauchs-Ampel ({len(kritisch_nur)} kritisch von "
                  f"{len(krit_v)} aktiv)")
        rows = [{
            "Ampel": k["ampel"],
            "Name": k.get("name", "") or "—",
            "Palette": f"{k['L_mm']} × {k['B_mm']} mm",
            "Bestand": k["bestand"],
            "in Anlief.": k["bestand_bestellt"],
            "Ø Verbr./Tag": k["avg_pro_tag"],
            "Reichweite (T)": (round(k["reichweite_tage"], 1)
                                if k["reichweite_tage"] is not None
                                else "—"),
            "+ Anlief. (T)": (round(k["reichweite_inkl_anlieferung_tage"], 1)
                               if k["reichweite_inkl_anlieferung_tage"]
                                  is not None else "—"),
        } for k in krit_v]
        st.dataframe(pd.DataFrame(rows), use_container_width=True,
                     hide_index=True, height=min(360, 60 + 35 * len(rows)))
        st.caption("🟢 > 30 Tage · 🟡 14-30 · 🔴 < 14 oder leer · "
                    "⚫ kein Verbrauch erfasst")
        card_close()

    # Klassische Meldebestand-Warnung (Spec §5)
    try:
        krit = katalog_modul.kritische_bestaende()
    except Exception:
        krit = []
    if krit:
        card_open(f"⚠️ Meldebestand erreicht ({len(krit)})")
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
           "Historie aller Bestellungen → Tab 'Historie'"])


def seite_historie() -> None:
    """Historie aller bestätigten Bestellungen (Spec §7).
    Sortier-/filterbar; Status-Wechsel; CSV-Export."""
    alle_bes = bestellungen_modul.alle()
    card_open(f"📋 Bestellungs-Historie ({len(alle_bes)} Einträge)")
    if not alle_bes:
        st.info(
            "Noch keine Bestellungen. Eine Historie entsteht automatisch, "
            "sobald im **Ergebnisse**-Tab 'Bestellung getätigt' geklickt wird."
        )
        st.caption(f"Speicherort: {bestellungen_modul.pfad_str()}")
        card_close()
        return

    # === Aggregate (Spec §7) ===
    offene = [e for e in alle_bes if e.get("status") == "offen"]
    verbraucht = [e for e in alle_bes if e.get("status") == "verbraucht"]
    storniert = [e for e in alle_bes if e.get("status") == "storniert"]
    wert_offen = sum(int(e.get("menge", 0)) for e in offene)
    # Top-3 Kunden nach Σ Menge
    from collections import Counter
    kunden = Counter()
    for e in offene + verbraucht:
        k = (e.get("kunde", "") or "—").strip()
        kunden[k] += int(e.get("menge", 0))
    top3 = kunden.most_common(3)

    c1, c2, c3, c4 = st.columns([1, 1, 1, 2])
    c1.metric("Offen", len(offene))
    c2.metric("Verbraucht", len(verbraucht))
    c3.metric("Storniert", len(storniert))
    with c4:
        st.markdown(
            f"<div style='font-size:13px;color:#475569;'>"
            f"Σ Menge offen: <b>{wert_offen}</b><br>"
            f"Top-3 Kunden: " +
            (", ".join(f"{k} ({v})" for k, v in top3) if top3 else "—")
            + "</div>",
            unsafe_allow_html=True,
        )
    card_close()

    # === Filter ===
    f = st.session_state.historie_filter
    card_open("🔍 Filter")
    fc1, fc2, fc3, fc4, fc5 = st.columns([1, 1.2, 1.2, 1, 1])
    with fc1:
        f["status"] = st.selectbox(
            "Status",
            ["alle", "offen", "verbraucht", "storniert"],
            index=["alle", "offen", "verbraucht",
                    "storniert"].index(f.get("status", "alle")),
            key="hist_f_status",
        )
    with fc2:
        f["kunde"] = st.text_input(
            "Kunde enthält", value=f.get("kunde", ""),
            key="hist_f_kunde",
        )
    with fc3:
        f["aw"] = st.text_input(
            "AW enthält", value=f.get("aw", ""), key="hist_f_aw",
        )
    with fc4:
        f["datum_von"] = st.text_input(
            "von (YYYY-MM-DD)", value=f.get("datum_von", ""),
            key="hist_f_von",
        )
    with fc5:
        f["datum_bis"] = st.text_input(
            "bis (YYYY-MM-DD)", value=f.get("datum_bis", ""),
            key="hist_f_bis",
        )
    card_close()

    # Filterung
    def _passt(e: dict) -> bool:
        if f["status"] != "alle" and e.get("status") != f["status"]:
            return False
        if f["kunde"] and f["kunde"].lower() not in (e.get("kunde", "") or "").lower():
            return False
        if f["aw"] and f["aw"].lower() not in (e.get("auftragsnummer_aw", "") or "").lower():
            return False
        bd = e.get("bestelldatum", "")
        if f["datum_von"] and bd and bd < f["datum_von"]:
            return False
        if f["datum_bis"] and bd and bd > f["datum_bis"]:
            return False
        return True

    gefiltert = [e for e in alle_bes if _passt(e)]

    # === Tabelle ===
    card_open(f"Bestellungen ({len(gefiltert)} angezeigt)")

    # Berechnete Spalten: Tage bis Verbrauch + Wert
    from datetime import date
    heute = date.today()
    rows = []
    for e in gefiltert:
        snap = e.get("palette_typ_snapshot", {}) or {}
        # EK aus aktuellem Katalog (Snapshot hat keine Preise)
        ek = 0.0
        if e.get("palette_id"):
            preise = katalog_modul.lookup_preise(snap.get("L_mm", 0),
                                                   snap.get("B_mm", 0))
            if preise:
                ek = float(preise.get("einkaufspreis_eur", 0))
        vbd_str = e.get("geplantes_verbrauchsdatum", "")
        tage = ""
        try:
            from datetime import datetime as _dt
            vd = _dt.fromisoformat(vbd_str).date()
            tage = (vd - heute).days
        except Exception:
            pass
        rows.append({
            "id": e["id"],
            "Bestelldatum": e.get("bestelldatum", ""),
            "Status": e.get("status", ""),
            "Kunde": e.get("kunde", ""),
            "Artikel": e.get("artikelnummer", ""),
            "AW": e.get("auftragsnummer_aw", ""),
            "Palette": (
                f"{snap.get('name', '')} "
                f"{snap.get('L_mm', 0)}×{snap.get('B_mm', 0)}"
                + (f"×{snap.get('hoehe_mm', 0)}"
                    if snap.get("hoehe_mm") else "")
            ),
            "Menge": int(e.get("menge", 0)),
            "Verbrauchsdatum": vbd_str,
            "Tage bis V.": tage,
            "Wert (€)": (float(e.get("menge", 0)) * ek) if ek > 0 else None,
            "Erstellt": e.get("erstellt_am", "")[:16],
        })

    import pandas as _pd
    df = _pd.DataFrame(rows)
    if not df.empty:
        st.dataframe(
            df.drop(columns=["id"]),
            use_container_width=True, hide_index=True, height=420,
            column_config={
                "Menge": st.column_config.NumberColumn(format="%d"),
                "Tage bis V.": st.column_config.NumberColumn(format="%d"),
                "Wert (€)": st.column_config.NumberColumn(format="%.2f €"),
            },
        )

    # === Aktionen pro Zeile ===
    if gefiltert:
        st.markdown("**Status ändern pro Eintrag**")
        sel_idx = st.selectbox(
            "Eintrag wählen",
            options=range(len(gefiltert)),
            format_func=lambda i: (
                f"{gefiltert[i].get('bestelldatum', '?')} · "
                f"{gefiltert[i].get('auftragsnummer_aw', '?')} · "
                f"{gefiltert[i].get('artikelnummer', '?')} · "
                f"{gefiltert[i].get('menge', 0)} Stk · "
                f"{gefiltert[i].get('status', '?')}"
            ),
            key="hist_sel",
        )
        eintrag = gefiltert[sel_idx]
        cs1, cs2, cs3, cs4 = st.columns(4)
        if eintrag["status"] == "offen":
            if cs1.button("✓ Als verbraucht markieren",
                            use_container_width=True, key="hist_ok"):
                bestellungen_modul.update_status(eintrag["id"], "verbraucht")
                st.success("Status auf 'verbraucht' geändert.")
                st.rerun()
            if cs2.button("✗ Stornieren",
                            use_container_width=True, key="hist_storno"):
                bestellungen_modul.update_status(eintrag["id"], "storniert")
                st.success("Bestellung storniert.")
                st.rerun()
        elif eintrag["status"] in ("verbraucht", "storniert"):
            if cs1.button("↩ Auf 'offen' zurücksetzen",
                            use_container_width=True, key="hist_reopen"):
                bestellungen_modul.update_status(eintrag["id"], "offen")
                st.success("Status zurückgesetzt.")
                st.rerun()
        if cs3.button("🗑️ Löschen", use_container_width=True,
                       key="hist_del"):
            bestellungen_modul.loesche_eintrag(eintrag["id"])
            st.warning("Eintrag gelöscht.")
            st.rerun()
        # Bearbeiten (eingeschraenkt — nur status==offen)
        if eintrag["status"] == "offen":
            with st.expander("✎ Bearbeiten (nur bei Status 'offen')"):
                e_menge = st.number_input(
                    "Menge", min_value=1, max_value=100000,
                    value=int(eintrag.get("menge", 1)),
                    key=f"hist_edit_m_{eintrag['id']}",
                )
                e_aw = st.text_input(
                    "AW", value=eintrag.get("auftragsnummer_aw", ""),
                    key=f"hist_edit_aw_{eintrag['id']}",
                )
                e_bd = st.text_input(
                    "Bestelldatum (YYYY-MM-DD)",
                    value=eintrag.get("bestelldatum", ""),
                    key=f"hist_edit_bd_{eintrag['id']}",
                )
                e_vbd = st.text_input(
                    "Verbrauchsdatum (YYYY-MM-DD)",
                    value=eintrag.get("geplantes_verbrauchsdatum", ""),
                    key=f"hist_edit_vbd_{eintrag['id']}",
                )
                e_notiz = st.text_input(
                    "Notiz", value=eintrag.get("notiz", ""),
                    key=f"hist_edit_n_{eintrag['id']}",
                )
                if st.button("💾 Speichern", type="primary",
                              key=f"hist_save_{eintrag['id']}"):
                    bestellungen_modul.update_eintrag(
                        eintrag["id"],
                        menge=int(e_menge),
                        auftragsnummer_aw=e_aw,
                        bestelldatum=e_bd,
                        geplantes_verbrauchsdatum=e_vbd,
                        notiz=e_notiz,
                    )
                    st.success("Gespeichert.")
                    st.rerun()

    # === Export ===
    csv = bestellungen_modul.nach_csv()
    st.download_button(
        "📥 Historie als CSV exportieren",
        data=csv.encode("utf-8"),
        file_name="bestellungen.csv",
        mime="text/csv",
        use_container_width=True,
    )
    st.caption(f"Speicherort: {bestellungen_modul.pfad_str()}")
    card_close()


def seite_beschaffung() -> None:
    """Beschaffungs-Auftraege (Spec §10): PDF-Wizard, Wareneingang."""
    auftraege = procurement_modul.alle()
    card_open(f"📦 Beschaffungs-Aufträge ({len(auftraege)} gesamt)")
    st.markdown(
        '<div style="font-size:13px;color:#475569;margin-bottom:8px;">'
        'Bestellungen beim Lieferanten zum Auffüllen des Bestands. '
        'Beim Wareneingang wird der Bestand automatisch erhöht. '
        'Solange offen: Menge erscheint als "in Anlieferung".'
        '</div>',
        unsafe_allow_html=True,
    )

    # Wizard: neuer Auftrag
    with st.expander("➕ Neuer Beschaffungs-Auftrag (Wizard)",
                      expanded=not auftraege):
        wiz_paletten = katalog_modul.alle()
        if not wiz_paletten:
            st.info("Zuerst Paletten im Katalog anlegen.")
        else:
            ww1, ww2, ww3 = st.columns([2, 1, 1])
            with ww1:
                liefer = st.text_input("Lieferant",
                                         placeholder="z.B. Palettenwerk Müller GmbH",
                                         key="proc_liefer")
            with ww2:
                from datetime import date as _date, timedelta as _td
                plan = st.date_input(
                    "geplante Lieferung",
                    value=_date.today() + _td(days=14),
                    key="proc_plan",
                )
            with ww3:
                modus = st.selectbox(
                    "Buchungsmodus",
                    ["wareneingang", "sofort"],
                    help="wareneingang = Bestand erst bei Eingang erhöht. "
                         "sofort = direkt.",
                    key="proc_modus",
                )
            # Position-Form
            positionen_state = st.session_state.setdefault(
                "proc_pos_draft", [])
            with st.form("proc_neue_pos", clear_on_submit=True):
                pc1, pc2, pc3 = st.columns([3, 1, 1])
                with pc1:
                    pal_idx = st.selectbox(
                        "Palette",
                        options=range(len(wiz_paletten)),
                        format_func=lambda i: (
                            f"{wiz_paletten[i].get('name', '') or '—'} · "
                            f"{wiz_paletten[i]['L_mm']}×{wiz_paletten[i]['B_mm']}"
                        ),
                        key="proc_pal",
                    )
                with pc2:
                    pos_menge = st.number_input(
                        "Menge", min_value=1, max_value=100000,
                        value=10, step=1, key="proc_pos_menge",
                    )
                with pc3:
                    default_ek = float(wiz_paletten[pal_idx].get(
                        "einkaufspreis_eur", 0))
                    pos_ek = st.number_input(
                        "EK/Stk (€)", min_value=0.0, max_value=10000.0,
                        value=default_ek, step=0.50, format="%.2f",
                        key="proc_pos_ek",
                    )
                if st.form_submit_button("➕ Position hinzufügen",
                                             use_container_width=True):
                    positionen_state.append({
                        "palette_id": wiz_paletten[pal_idx]["id"],
                        "menge": int(pos_menge),
                        "ek_pro_stk_eur": float(pos_ek),
                        "label": (
                            f"{wiz_paletten[pal_idx]['L_mm']}×"
                            f"{wiz_paletten[pal_idx]['B_mm']}"
                        ),
                    })
            # Liste der aktuellen Positionen
            if positionen_state:
                st.markdown("**Aktuelle Positionen:**")
                dfp = pd.DataFrame([
                    {"Palette": p["label"], "Menge": p["menge"],
                     "EK/Stk (€)": p["ek_pro_stk_eur"],
                     "Σ (€)": p["menge"] * p["ek_pro_stk_eur"]}
                    for p in positionen_state
                ])
                st.dataframe(dfp, use_container_width=True, hide_index=True,
                             column_config={
                                 "Menge": st.column_config.NumberColumn(format="%d"),
                                 "EK/Stk (€)": st.column_config.NumberColumn(format="%.2f €"),
                                 "Σ (€)": st.column_config.NumberColumn(format="%.2f €"),
                             })
                bc1, bc2 = st.columns(2)
                if bc1.button("✓ Auftrag anlegen", type="primary",
                                use_container_width=True, key="proc_anlegen"):
                    erg = procurement_modul.neuer_auftrag(
                        katalog_modul=katalog_modul,
                        lieferant=liefer or "—",
                        positionen=positionen_state,
                        datum_geplant=plan.isoformat(),
                        buchungsmodus=modus,
                    )
                    if erg["ok"]:
                        st.success(
                            f"Auftrag angelegt: {erg['positionen']} Positionen, "
                            f"Σ {erg['summe_eur']:.2f} €."
                        )
                        st.session_state.proc_pos_draft = []
                        st.rerun()
                    else:
                        st.error("Auftrag konnte nicht angelegt werden.")
                if bc2.button("🗑️ Positionen leeren",
                                use_container_width=True, key="proc_clear"):
                    st.session_state.proc_pos_draft = []
                    st.rerun()
    card_close()

    if not auftraege:
        st.caption(f"Speicherort: {procurement_modul.pfad_str()}")
        return

    # Liste aller Auftraege
    card_open(f"Übersicht ({len(auftraege)})")
    rows = []
    for a in auftraege:
        rows.append({
            "id": a["id"],
            "Datum erstellt": a.get("datum_erstellt", "")[:10],
            "Lieferant": a.get("lieferant", ""),
            "Status": a.get("status", ""),
            "Positionen": len(a.get("positionen", [])),
            "Summe (€)": a.get("summe_eur", 0),
            "Modus": a.get("buchungsmodus", ""),
            "Geplant": a.get("datum_geplant", ""),
            "Wareneingang": a.get("datum_wareneingang", "—"),
        })
    df = pd.DataFrame(rows)
    st.dataframe(df.drop(columns=["id"]),
                  use_container_width=True, hide_index=True,
                  column_config={
                      "Summe (€)": st.column_config.NumberColumn(format="%.2f €"),
                  })
    # Aktionen
    sel = st.selectbox(
        "Auftrag wählen",
        options=range(len(auftraege)),
        format_func=lambda i: (
            f"{auftraege[i]['datum_erstellt'][:10]} · "
            f"{auftraege[i].get('lieferant', '—')} · "
            f"{auftraege[i]['status']} · "
            f"{auftraege[i].get('summe_eur', 0):.2f} €"
        ),
        key="proc_sel",
    )
    aktiv = auftraege[sel]
    ac1, ac2, ac3, ac4 = st.columns(4)
    if aktiv["status"] == "offen":
        if ac1.button("✓ Auf 'bestellt' setzen", use_container_width=True,
                       key="proc_bestellt"):
            procurement_modul.update_status(aktiv["id"], "bestellt",
                                              katalog_modul=katalog_modul)
            st.rerun()
    if aktiv["status"] in ("offen", "bestellt"):
        if ac2.button("📥 Wareneingang buchen", use_container_width=True,
                       type="primary", key="proc_eingang"):
            procurement_modul.update_status(aktiv["id"], "wareneingang",
                                              katalog_modul=katalog_modul)
            st.success("Wareneingang gebucht — Bestand erhöht.")
            st.rerun()
        if ac3.button("✗ Stornieren", use_container_width=True,
                       key="proc_storno"):
            procurement_modul.update_status(aktiv["id"], "storniert",
                                              katalog_modul=katalog_modul)
            st.warning("Storniert.")
            st.rerun()
    if ac4.button("🗑️ Löschen", use_container_width=True,
                    key="proc_del"):
        procurement_modul.loesche_eintrag(aktiv["id"])
        st.rerun()

    # PDF/Text-Export
    text = procurement_modul.als_text(aktiv)
    with st.expander("📄 Druckansicht (PDF-Vorlage als Text)"):
        st.code(text, language=None)
    st.download_button(
        "📥 Auftrag als Text-Datei",
        data=text.encode("utf-8"),
        file_name=f"beschaffung-{aktiv['id'][:8]}.txt",
        mime="text/plain",
        use_container_width=True,
    )
    st.caption(f"Speicherort: {procurement_modul.pfad_str()}")
    card_close()


def seite_wirtschaftlichkeit() -> None:
    """Wirtschaftlichkeits-Dashboard (Spec §11). 3 Logistik-Modi, alle
    Werte parallel persistiert (Spec §16 — Umschalten verliert nichts)."""
    cp = wirt_modul.lade_params()
    card_open("⚖️ Wirtschaftlichkeit + Logistikkosten (Spec §11)")
    st.caption(
        "Rechnet Einsparung durch Variantenreduktion gegen Mehrkosten "
        "von Transport + Lager. Kein Einfluss auf den Optimierer, "
        "wenn Toggle 'aktiv' OFF (Default) oder w8/w9 = 0."
    )

    # Toggle aktiv
    cp["aktiv"] = st.toggle(
        "Modul aktiv (in Score einbeziehen via w8/w9)",
        value=bool(cp.get("aktiv", False)),
        key="wirt_aktiv",
    )
    card_close()

    # --- Logistik-Modi (Spec §11.1): A / B / C ---
    card_open("Logistikkosten — Eingabemodus (Spec §11.1)")
    modi = ["A — Pauschal pro LKW", "B — Direkt pro Lademeter",
            "C — Pro m² × LKW-Breite"]
    modi_keys = ["A", "B", "C"]
    aktiv_modus = (cp.get("modus_logistik") or "A").upper()
    idx = modi_keys.index(aktiv_modus) if aktiv_modus in modi_keys else 0
    sel = st.radio(
        "Modus",
        modi,
        index=idx,
        horizontal=True,
        key="wirt_modus_in",
        help="Werte aller Modi bleiben parallel gespeichert — "
             "Umschalten verliert nichts (Spec §16).",
    )
    cp["modus_logistik"] = modi_keys[modi.index(sel)]

    # Pro Modus die Felder rendern, aber ALLE drei Wertfelder
    # weiterhin im State halten
    mc1, mc2, mc3 = st.columns([1.5, 1.5, 1.5])
    with mc1:
        cp["kosten_pro_lkw_eur"] = st.number_input(
            "A: Kosten/LKW (€)", min_value=0.0, max_value=20000.0,
            value=float(cp.get("kosten_pro_lkw_eur", 800.0)),
            step=10.0, format="%.2f", key="wirt_klkw",
            disabled=cp["modus_logistik"] != "A",
        )
        cp["lademeter_pro_lkw"] = st.number_input(
            "A: Lademeter/LKW", min_value=0.0, max_value=20.0,
            value=float(cp.get("lademeter_pro_lkw", 13.6)),
            step=0.1, format="%.1f", key="wirt_lmlkw",
            disabled=cp["modus_logistik"] != "A",
        )
    with mc2:
        cp["kosten_pro_lademeter_eur"] = st.number_input(
            "B: Kosten/Lademeter (€)", min_value=0.0, max_value=1000.0,
            value=float(cp.get("kosten_pro_lademeter_eur", 60.0)),
            step=1.0, format="%.2f", key="wirt_klm",
            disabled=cp["modus_logistik"] != "B",
        )
    with mc3:
        cp["kosten_pro_m2_eur"] = st.number_input(
            "C: Kosten/m² (€)", min_value=0.0, max_value=1000.0,
            value=float(cp.get("kosten_pro_m2_eur", 25.0)),
            step=1.0, format="%.2f", key="wirt_km2",
            disabled=cp["modus_logistik"] != "C",
        )

    # === Auto-Anzeige kosten_pro_lademeter ===
    kpl = wirt_modul.kosten_pro_lademeter(cp)
    ac1, ac2, ac3 = st.columns(3)
    ac1.metric("📐 Kosten / Lademeter (auto)",
                f"{kpl:.2f} €" if kpl > 0 else "— €")
    if cp["modus_logistik"] == "A":
        if float(cp["lademeter_pro_lkw"]) > 0:
            ac2.caption(
                f"= {cp['kosten_pro_lkw_eur']:.2f} € / "
                f"{cp['lademeter_pro_lkw']:.1f} Lademeter"
            )
    elif cp["modus_logistik"] == "C":
        ac2.caption(
            f"= {cp['kosten_pro_m2_eur']:.2f} €/m² × "
            f"{cp['lkw_breite_mm']/1000:.2f} m LKW-Breite"
        )
    # Validierung
    fehler = wirt_modul.validierung(cp)
    if fehler:
        for f in fehler:
            if f["art"] == "fehler":
                st.error(f"⛔ {f['text']}")
            elif f["art"] == "warnung":
                st.warning(f"⚠️ {f['text']}")
            else:
                st.info(f"ℹ️ {f['text']}")
    card_close()

    # --- LKW-Geometrie (alle Modi) ---
    card_open("LKW-Geometrie")
    tc1, tc2, tc3, tc4 = st.columns(4)
    with tc1:
        cp["lkw_laenge_mm"] = st.number_input(
            "Länge (mm)", min_value=1000, max_value=30000,
            value=int(cp.get("lkw_laenge_mm", 13620)), step=10,
            key="wirt_lkw_l",
        )
    with tc2:
        cp["lkw_breite_mm"] = st.number_input(
            "Breite (mm)", min_value=1000, max_value=5000,
            value=int(cp.get("lkw_breite_mm", 2450)), step=10,
            key="wirt_lkw_b",
        )
    with tc3:
        cp["lkw_hoehe_mm"] = st.number_input(
            "Höhe (mm)", min_value=1000, max_value=5000,
            value=int(cp.get("lkw_hoehe_mm", 2700)), step=10,
            key="wirt_lkw_h",
        )
    with tc4:
        cp["max_palettenstapel"] = st.number_input(
            "Max. Stapel", min_value=1, max_value=5,
            value=int(cp.get("max_palettenstapel", 2)), step=1,
            key="wirt_stapel",
        )
    cp["max_gewicht_kg"] = st.number_input(
        "Max. Gewicht (kg)", min_value=0, max_value=100000,
        value=int(cp.get("max_gewicht_kg", 24000)), step=100,
        key="wirt_gewicht",
    )
    card_close()

    card_open("Lager + Handling + Varianten")
    lc1, lc2, lc3, lc4 = st.columns(4)
    with lc1:
        cp["lagerkosten_pro_stellplatz_pro_tag_eur"] = st.number_input(
            "Lager €/Stellplatz/Tag", min_value=0.0, max_value=100.0,
            value=float(cp.get(
                "lagerkosten_pro_stellplatz_pro_tag_eur", 0.5)),
            step=0.05, format="%.2f", key="wirt_lag_tag",
        )
    with lc2:
        cp["avg_lagerdauer_tage"] = st.number_input(
            "Ø Lagerdauer (Tage)", min_value=0, max_value=365,
            value=int(cp.get("avg_lagerdauer_tage", 14)), step=1,
            key="wirt_lag_dauer",
        )
    with lc3:
        cp["handling_kosten_pro_palettentyp_eur"] = st.number_input(
            "Handling €/Typ", min_value=0.0, max_value=10000.0,
            value=float(cp.get("handling_kosten_pro_palettentyp_eur", 50)),
            step=10.0, format="%.2f", key="wirt_handl",
        )
    with lc4:
        cp["variantenkosten_pro_typ_eur"] = st.number_input(
            "Varianten €/Typ", min_value=0.0, max_value=10000.0,
            value=float(cp.get("variantenkosten_pro_typ_eur", 200)),
            step=10.0, format="%.2f", key="wirt_var",
        )
    p1, p2 = st.columns(2)
    with p1:
        cp["periode_tage"] = st.number_input(
            "Standard-Periode (Tage)",
            min_value=1, max_value=365,
            value=int(cp.get("periode_tage", 30)), step=1,
            help="Hochrechnung auf Jahr automatisch.",
            key="wirt_periode",
        )
    with p2:
        cp["paletten_pro_periode_manuell"] = st.number_input(
            "Cold-Start: Paletten/Periode (manuell)",
            min_value=0, max_value=1000000,
            value=int(cp.get("paletten_pro_periode_manuell", 0)),
            step=10, key="wirt_cold",
            help="Fallback wenn keine Verbrauchsdaten vorhanden.",
        )

    # Berechnungs-Variante (Spec §11.2)
    var_modi = ["flaeche (Variante 1, Default)",
                "laenge (Variante 2, nur bei Δbreite ≈ 0)"]
    var_keys = ["flaeche", "laenge"]
    aktiv_var = cp.get("berechnung_variante", "flaeche")
    var_idx = var_keys.index(aktiv_var) if aktiv_var in var_keys else 0
    var_sel = st.radio(
        "Δlademeter-Berechnungs-Variante",
        var_modi, index=var_idx, horizontal=True,
        key="wirt_var_sel",
        help="Variante 1 ist genauer (Δfläche). Variante 2 ist linear "
             "(nur Δlänge), nur sinnvoll wenn die Breite gleich bleibt.",
    )
    cp["berechnung_variante"] = var_keys[var_modi.index(var_sel)]

    if st.button("💾 Parameter speichern", type="primary",
                  use_container_width=True, key="wirt_save"):
        wirt_modul.speichere_params(cp)
        st.success("Cost-Parameter gespeichert.")
    card_close()

    # --- Live-Beispielrechnung (Spec §11.3) ---
    card_open("📐 Live-Beispielrechnung (Spec §11.3)")
    bc1, bc2, bc3 = st.columns(3)
    with bc1:
        bsp_dl = st.number_input(
            "Δlänge pro Palette (mm)", min_value=-1000, max_value=2000,
            value=100, step=10, key="bsp_dl",
            help="Negativer Wert = neue Palette kleiner als alt = Einsparung.",
        )
    with bc2:
        bsp_paletten = st.number_input(
            "Paletten / Periode", min_value=1, max_value=1000000,
            value=200, step=10, key="bsp_n",
        )
    with bc3:
        bsp_breite = st.number_input(
            "Palettenbreite (mm) — für Variante 2",
            min_value=400, max_value=3000, value=1200, step=10,
            key="bsp_b",
        )
    bsp = wirt_modul.beispielrechnung(
        cp, delta_laenge_pro_palette_mm=int(bsp_dl),
        paletten_pro_periode=int(bsp_paletten),
        palette_breite_mm=int(bsp_breite),
    )
    bm1, bm2, bm3, bm4 = st.columns(4)
    bm1.metric("Kosten/Lademeter",
                f"{bsp['kosten_pro_lademeter']:.2f} €")
    bm2.metric("Δlademeter",
                f"{bsp['delta_lademeter']:.2f} m",
                delta=f"{bsp['delta_laenge_gesamt_mm']:.0f} mm gesamt",
                delta_color="off")
    bm3.metric("Mehrkosten / Periode",
                f"{bsp['transport_mehrkosten_periode']:.2f} €",
                delta_color="inverse" if bsp_dl < 0 else "normal")
    bm4.metric("Hochrechnung Jahr",
                f"{bsp['transport_mehrkosten_jahr']:.2f} €")
    if bsp_dl < 0:
        st.success(
            f"💡 Δlänge negativ ({bsp_dl} mm) → neue Palette kleiner = "
            f"Einsparung von {abs(bsp['transport_mehrkosten_periode']):.2f} €/Periode."
        )
    card_close()

    # Vergleich rechnen — wenn ein Ergebnis vorliegt
    res = st.session_state.get("ergebnis")
    if res is None:
        st.info(
            "Nach einer Optimierung sehen Sie hier den Wirtschaftlichkeits-"
            "Vergleich (Status Quo vs. Standardisiert) mit Wasserfall-"
            "Effekt und Sensitivitäts-Analyse."
        )
        return

    # Status Quo = jede Last hat eigene Palette
    # Standardisiert = die optimierten Standards aus res
    dat = st.session_state.import_dat
    if not dat or not dat.get("mit_mass"):
        return

    # Mengen pro Typ (alt): jede Original-Palette als eigener Typ
    from collections import defaultdict
    alt_typen: dict[tuple, int] = defaultdict(int)
    for pal in dat["mit_mass"]:
        L, B = int(pal["laenge"]), int(pal["breite"])
        kand = (min(L, B), max(L, B))
        alt_typen[kand] += int(pal["anzahl"])

    # Mengen pro Typ (neu): aus zuordnung (Standard-Maße)
    neu_typen: dict[tuple, int] = defaultdict(int)
    for z in res.get("zuordnung", []):
        if z.get("typ") == "Standard":
            try:
                a, b = z["ziel"].split("x")
                neu_typen[(min(int(a), int(b)),
                            max(int(a), int(b)))] += int(z.get("menge", 0))
            except Exception:
                pass

    if not neu_typen:
        st.info("Standardisiertes Szenario hat keine Standards — nichts zu vergleichen.")
        return

    # EK-Lookup
    ek_lookup = {}
    for e in katalog_modul.alle():
        if e.get("aktiv", True) and float(e.get("einkaufspreis_eur", 0)) > 0:
            ek_lookup[(min(e["L_mm"], e["B_mm"]),
                       max(e["L_mm"], e["B_mm"]))] = float(
                e["einkaufspreis_eur"])

    alt_zustand = wirt_modul.baue_zustand(
        paletten_count_per_typ=alt_typen,
        zuordnungen=[
            {"typ": "Standard",
             "ziel": f"{max(p['laenge'], p['breite'])}x"
                      f"{min(p['laenge'], p['breite'])}",
             "L": int(p["laenge"]), "B": int(p["breite"]),
             "menge": int(p["anzahl"])}
            for p in dat["mit_mass"]
        ],
        ek_lookup=ek_lookup,
    )
    neu_zustand = wirt_modul.baue_zustand(
        paletten_count_per_typ=neu_typen,
        zuordnungen=res.get("zuordnung", []),
        ek_lookup=ek_lookup,
    )
    v = wirt_modul.vergleich(zustand_alt=alt_zustand, zustand_neu=neu_zustand,
                                cost_params=cp)

    # Vergleichstabelle (Spec §11.4)
    card_open("📊 Vergleichstabelle: Vorher vs. Nachher")
    zeilen = [
        ("Anzahl Palettentypen", v["typen_alt"], v["typen_neu"]),
        ("Gesamt Paletten", v["paletten_alt"], v["paletten_neu"]),
        ("Ø Leerflächen-Anteil",
         f"{v['leer_alt_anteil']*100:.1f} %",
         f"{v['leer_neu_anteil']*100:.1f} %"),
        ("LKW-Fahrten", v["fahrten_alt"], v["fahrten_neu"]),
        ("Transportkosten (€)", f"{v['transport_alt']:.0f}",
         f"{v['transport_neu']:.0f}"),
        ("Lagerkosten (€)", f"{v['lager_alt']:.0f}",
         f"{v['lager_neu']:.0f}"),
        ("Handling-Kosten (€)", f"{v['handling_alt']:.0f}",
         f"{v['handling_neu']:.0f}"),
        ("Variantenkosten (€)", f"{v['var_alt']:.0f}",
         f"{v['var_neu']:.0f}"),
    ]
    df_v = pd.DataFrame(zeilen, columns=["Kennzahl", "Vorher", "Nachher"])
    st.dataframe(df_v, use_container_width=True, hide_index=True)

    # KPIs Netto-Effekt + Top-Row (Spec §11.5)
    kc1, kc2, kc3, kc4 = st.columns(4)
    kc1.metric("Kosten / Lademeter",
                f"{v.get('kosten_pro_lademeter', 0):.2f} €")
    kc2.metric("Δlademeter / Periode",
                f"{v.get('delta_lademeter_periode', 0):.2f} m")
    kc3.metric("Transport-Mehrkosten",
                f"{v['transport_mehrkosten']:,.0f} €".replace(",", "."))
    kc4.metric("Netto-Effekt",
                f"{v['netto_periode']:,.0f} €".replace(",", "."))
    nc1, nc2 = st.columns(2)
    nc1.metric("Hochrechnung Jahr",
                f"{v['netto_jahr']:,.0f} €".replace(",", "."))
    nc2.metric("Periode (Tage)", v["periode_tage"])

    # Auslastungs-Hinweis (Spec §16)
    aus = wirt_modul.auslastung_lkw(
        paletten_count_per_typ=neu_typen, cp=cp,
    )
    if aus["auslastung"] > 0 and aus["auslastung"] < 0.5:
        st.info(
            f"🚚 LKW-Auslastung {aus['auslastung']:.0%} bei "
            f"{aus['fahrten_total']} Fahrt(en) — Mischladung empfohlen."
        )

    # Empfehlungstext
    text = wirt_modul.empfehlungstext(v)
    if v["netto_periode"] > 0:
        st.success(text)
    elif v["netto_periode"] < 0:
        st.warning(text)
    else:
        st.info(text)

    # Wasserfall-naher Effekt: Einsparungen vs Mehrkosten als Balken
    card_open("💧 Effekt-Aufschluesselung (Wasserfall)")
    wf = pd.DataFrame([
        {"Komponente": "Handling-Einsparung",
         "Effekt (€)": v["handling_einsparung"], "Art": "Einsparung"},
        {"Komponente": "Varianten-Einsparung",
         "Effekt (€)": v["var_einsparung"], "Art": "Einsparung"},
        {"Komponente": "Paletten-Kauf-Diff",
         "Effekt (€)": -v["palettenkauf_diff"], "Art": "Saldo"},
        {"Komponente": "Transport-Mehrkosten",
         "Effekt (€)": -v["transport_mehrkosten"], "Art": "Mehrkosten"},
        {"Komponente": "Lager-Mehrkosten",
         "Effekt (€)": -v["lager_mehrkosten"], "Art": "Mehrkosten"},
        {"Komponente": "Netto-Effekt",
         "Effekt (€)": v["netto_periode"], "Art": "Total"},
    ])
    st.bar_chart(wf.set_index("Komponente")["Effekt (€)"],
                  use_container_width=True)
    card_close()

    # Sensitivitaets-Analyse (Spec §11.5)
    card_open("🎚️ Sensitivitäts-Analyse")
    st.caption(
        "Slider verändern die wichtigsten Cost-Parameter live, ohne "
        "die Vergleichsdaten zu speichern. Break-Even wird unten "
        "angezeigt."
    )
    sc1, sc2, sc3 = st.columns(3)
    with sc1:
        if cp["modus_logistik"] == "A":
            sens_kf = st.slider("Kosten pro LKW (€)", 0.0, 5000.0,
                                  float(cp.get("kosten_pro_lkw_eur", 800)),
                                  step=10.0, key="sens_klkw")
        elif cp["modus_logistik"] == "B":
            sens_kf = st.slider("Kosten/Lademeter (€)", 0.0, 500.0,
                                  float(cp.get("kosten_pro_lademeter_eur", 60)),
                                  step=1.0, key="sens_klm")
        else:
            sens_kf = st.slider("Kosten/m² (€)", 0.0, 500.0,
                                  float(cp.get("kosten_pro_m2_eur", 25)),
                                  step=1.0, key="sens_km2")
    with sc2:
        sens_dauer = st.slider("Lagerdauer (Tage)", 0, 365,
                                int(cp.get("avg_lagerdauer_tage", 14)),
                                step=1, key="sens_dauer")
    with sc3:
        if cp["modus_logistik"] == "A":
            sens_lm = st.slider("Lademeter/LKW", 0.1, 20.0,
                                  float(cp.get("lademeter_pro_lkw", 13.6)),
                                  step=0.1, key="sens_lm")
        else:
            sens_lm = None
            st.caption("Lademeter/LKW nur in Modus A relevant.")
    cp_sens = dict(cp)
    if cp["modus_logistik"] == "A":
        cp_sens["kosten_pro_lkw_eur"] = sens_kf
        if sens_lm is not None:
            cp_sens["lademeter_pro_lkw"] = sens_lm
    elif cp["modus_logistik"] == "B":
        cp_sens["kosten_pro_lademeter_eur"] = sens_kf
    else:
        cp_sens["kosten_pro_m2_eur"] = sens_kf
    cp_sens["avg_lagerdauer_tage"] = sens_dauer
    v_sens = wirt_modul.vergleich(zustand_alt=alt_zustand,
                                       zustand_neu=neu_zustand,
                                       cost_params=cp_sens)
    sk1, sk2, sk3 = st.columns(3)
    sk1.metric("Kosten/Lademeter live",
                f"{v_sens.get('kosten_pro_lademeter', 0):.2f} €")
    sk2.metric("Netto live",
                f"{v_sens['netto_periode']:,.0f} €".replace(",", "."))
    be = wirt_modul.break_even_kosten_pro_lademeter(alt_zustand,
                                                          neu_zustand, cp)
    if be is not None:
        sk3.metric("Break-Even kpl",
                     f"{be:,.2f} €".replace(",", "."))
        st.info(
            f"💡 Ab Kosten/Lademeter > {be:.2f} € kippt das Ergebnis."
            .replace(",", ".")
        )
    else:
        sk3.metric("Break-Even", "—")
        st.info("💡 Δlademeter = 0 — Lademeter-Kosten haben keinen Einfluss.")

    # Szenario speichern
    ssc1, ssc2 = st.columns([2, 1])
    sz_name = ssc1.text_input("Szenario-Name", key="sens_name",
                                placeholder="z.B. 'Niedrige Frachtraten'")
    if ssc2.button("💾 Szenario speichern", use_container_width=True,
                    key="sens_save"):
        if sz_name.strip():
            wirt_modul.speichere_szenario(sz_name.strip(), cp_sens, v_sens)
            st.success(f"Szenario '{sz_name.strip()}' gespeichert.")
        else:
            st.warning("Name fehlt.")
    sz = wirt_modul.alle_szenarien()
    if sz:
        st.markdown("**Gespeicherte Szenarien:**")
        sz_rows = [
            {"Name": k, "Datum": v_["datum"][:16],
             "Netto (€)": v_["ergebnis"].get("netto_periode", 0),
             "Kosten/Fahrt": v_["params"].get("kosten_pro_fahrt_eur", 0),
             "Lagerdauer": v_["params"].get("avg_lagerdauer_tage", 0)}
            for k, v_ in sz.items()
        ]
        st.dataframe(pd.DataFrame(sz_rows), use_container_width=True,
                      hide_index=True,
                      column_config={
                          "Netto (€)": st.column_config.NumberColumn(format="%.0f €"),
                          "Kosten/Fahrt": st.column_config.NumberColumn(format="%.0f €"),
                      })
    card_close()


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
    "Beschaffung":           seite_beschaffung,
    "Historie":              seite_historie,
    "Wirtschaftlichkeit":    seite_wirtschaftlichkeit,
    "Kostenanalyse":         seite_kostenanalyse,
    "Stammdaten":            seite_stammdaten,
    "Berichte":              seite_berichte,
    "App-Einstellungen":     seite_app_einstellungen,
}
SEITEN[st.session_state.seite]()
