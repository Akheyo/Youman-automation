"""Einstellungen: IMAP, API-Keys, Quellen-Schalter, Test-Buttons.
Alle Werte werden lokal verschlüsselt gespeichert (core/config.py)."""
from __future__ import annotations

import streamlit as st

from core import config
import sources as source_registry


def render() -> None:
    st.title("⚙️ Einstellungen")
    cfg = config.load()

    # -------------------------------------------------------------- IMAP
    st.subheader("E-Mail-Postfach (IMAP)")
    with st.form("imap_form"):
        col1, col2 = st.columns(2)
        with col1:
            host = st.text_input("Host", value=cfg["imap"]["host"])
            user = st.text_input("Benutzer", value=cfg["imap"]["user"])
            folder = st.text_input("Ordner", value=cfg["imap"]["folder"])
        with col2:
            port = st.number_input("Port", value=int(cfg["imap"]["port"]), step=1)
            password = st.text_input("Passwort", value=cfg["imap"]["password"],
                                     type="password")
            use_ssl = st.checkbox("SSL/TLS", value=cfg["imap"]["ssl"])
        mark_seen = st.checkbox(
            "Verarbeitete Mails als gelesen markieren (sonst strikt read-only)",
            value=cfg["imap"]["mark_seen"],
        )
        sender_filter = st.text_input(
            "Absender-Filter (nur diese Mails verarbeiten)",
            value=cfg["sender_filter"],
        )
        subject_filter = st.text_input(
            "Betreff-Filter (muss enthalten sein; leer = alle)",
            value=cfg["subject_filter"],
        )
        if st.form_submit_button("Speichern"):
            config.update({
                "imap": {
                    "host": host.strip(), "port": int(port), "user": user.strip(),
                    "password": password, "ssl": use_ssl, "folder": folder.strip() or "INBOX",
                    "mark_seen": mark_seen,
                },
                "sender_filter": sender_filter.strip(),
                "subject_filter": subject_filter.strip(),
            })
            st.success("IMAP-Einstellungen gespeichert.")

    if st.button("📡 IMAP-Verbindung testen"):
        from core import mail_listener
        _run_test(mail_listener.test_connection)

    st.divider()

    # ---------------------------------------------------------- Anthropic
    st.subheader("Anthropic API (Anfrage-Analyse)")
    with st.form("anthropic_form"):
        api_key = st.text_input("API-Key", value=cfg["anthropic"]["api_key"],
                                type="password")
        model = st.text_input("Modell", value=cfg["anthropic"]["model"])
        rerank = st.checkbox("Treffer zusätzlich per LLM nachbewerten (mehr API-Kosten)",
                             value=cfg["anthropic"]["llm_rerank"])
        if st.form_submit_button("Speichern"):
            config.update({"anthropic": {"api_key": api_key.strip(), "model": model.strip(),
                                         "llm_rerank": rerank}})
            st.success("Anthropic-Einstellungen gespeichert.")

    if st.button("🤖 Anthropic testen"):
        def _test_llm() -> str:
            from core import llm
            result = llm.analyze_request("Test", "Testmaschine 123", "Hallo, Test.")
            if not result["suchbegriffe"]["exakt"]:
                raise RuntimeError("Keine Suchbegriffe erhalten.")
            return f"OK, Modell antwortet. Beispiel-Begriff: {result['suchbegriffe']['exakt'][0]}"
        _run_test(_test_llm)

    st.divider()

    # ------------------------------------------------------------- Plenty
    st.subheader("PlentyONE (eigener Bestand)")
    with st.form("plenty_form"):
        base_url = st.text_input("Basis-URL", value=cfg["plenty"]["base_url"])
        col1, col2 = st.columns(2)
        with col1:
            p_user = st.text_input("Benutzer", value=cfg["plenty"]["user"])
        with col2:
            p_pass = st.text_input("Passwort", value=cfg["plenty"]["password"],
                                   type="password")
        if st.form_submit_button("Speichern"):
            config.update({"plenty": {"base_url": base_url.strip(), "user": p_user.strip(),
                                      "password": p_pass}})
            st.success("Plenty-Einstellungen gespeichert.")

    if st.button("🏭 Plenty testen"):
        from sources.own_stock import PlentySource
        _run_test(PlentySource().test_connection)

    st.divider()

    # ----------------------------------------------------- Maschinensucher
    st.subheader("Maschinensucher-API")
    with st.form("ms_form"):
        ms_base = st.text_input("API-Basis-URL", value=cfg["maschinensucher"]["api_base"])
        ms_key = st.text_input("API-Key", value=cfg["maschinensucher"]["api_key"],
                               type="password")
        dealer = st.text_input("Händler-ID (optional)",
                               value=cfg["maschinensucher"]["dealer_id"])
        if st.form_submit_button("Speichern"):
            config.update({"maschinensucher": {"api_base": ms_base.strip(),
                                               "api_key": ms_key.strip(),
                                               "dealer_id": dealer.strip()}})
            st.success("Maschinensucher-Einstellungen gespeichert.")

    if st.button("🔧 MS-API testen"):
        from sources.own_stock import OwnMaschinensucherSource
        _run_test(OwnMaschinensucherSource().test_connection)

    st.divider()

    # ----------------------------------------------------------- Websuche
    st.subheader("Websuche (freies Netz)")
    with st.form("websearch_form"):
        provider = st.selectbox(
            "Anbieter", ["duckduckgo", "brave", "serpapi"],
            index=["duckduckgo", "brave", "serpapi"].index(cfg["websearch"]["provider"]),
            help="DuckDuckGo braucht keinen Key (HTML-Fallback).",
        )
        ws_key = st.text_input("API-Key (für Brave/SerpAPI)",
                               value=cfg["websearch"]["api_key"], type="password")
        if st.form_submit_button("Speichern"):
            config.update({"websearch": {"provider": provider, "api_key": ws_key.strip()}})
            st.success("Websuche-Einstellungen gespeichert.")

    st.divider()

    # ------------------------------------------------------------ Quellen
    st.subheader("Suchquellen an/aus")
    switches = dict(cfg["sources_enabled"])
    changed = False
    for source in source_registry.ALL_SOURCES:
        value = st.toggle(source.label, value=switches.get(source.key, True),
                          key=f"src_{source.key}")
        if value != switches.get(source.key, True):
            switches[source.key] = value
            changed = True
    if changed:
        config.update({"sources_enabled": switches})
        st.toast("Quellen-Einstellungen gespeichert.")

    st.divider()

    # -------------------------------------------------------- App beenden
    st.subheader("App beenden")
    st.caption(
        "Die App läuft unsichtbar im Hintergrund weiter (Mail-Überwachung), "
        "auch wenn dieser Browser-Tab geschlossen wird. Hier lässt sie sich "
        "komplett beenden."
    )
    if st.button("🛑 Anfragen-Radar beenden", type="secondary"):
        st.warning("Anfragen-Radar wird beendet – dieser Tab kann geschlossen werden.")
        import os as _os
        import threading as _threading

        # kleiner Aufschub, damit die Meldung den Browser noch erreicht
        _threading.Timer(1.0, lambda: _os._exit(0)).start()


def _run_test(func) -> None:
    with st.spinner("Teste …"):
        try:
            message = func()
            st.success(message)
        except Exception as exc:
            st.error(f"Fehlgeschlagen: {exc}")
