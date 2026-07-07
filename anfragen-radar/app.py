"""Streamlit-Hauptdatei: Navigation + Start des Mail-Listener-Threads.

Wird über run.py (Endnutzer/Setup.exe) oder direkt mit
``streamlit run app.py`` (Entwicklung) gestartet.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Projektwurzel in den Pfad (nötig im PyInstaller-Bundle und bei
# `streamlit run` aus anderen Verzeichnissen)
sys.path.insert(0, str(Path(__file__).resolve().parent))

import streamlit as st

from core import logging_setup, mail_listener
from db import database

st.set_page_config(
    page_title="Anfragen-Radar",
    page_icon="📡",
    layout="wide",
)


@st.cache_resource
def _bootstrap() -> bool:
    """Einmal pro Server-Prozess: Logging, DB, Hintergrund-Listener."""
    logging_setup.setup()
    database.connect()
    mail_listener.get_listener()
    return True


_bootstrap()

from ui import detail, einstellungen, logseite, uebersicht  # noqa: E402

uebersicht_page = st.Page(uebersicht.render, title="Übersicht", icon="📋",
                          url_path="uebersicht", default=True)
detail_page = st.Page(detail.render, title="Anfrage-Detail", icon="🔍",
                      url_path="detail")
settings_page = st.Page(einstellungen.render, title="Einstellungen", icon="⚙️",
                        url_path="einstellungen")
log_page = st.Page(logseite.render, title="Logs", icon="📜", url_path="logs")

st.session_state["detail_page"] = detail_page

nav = st.navigation([uebersicht_page, detail_page, settings_page, log_page])
nav.run()
