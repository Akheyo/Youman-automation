"""Log-Seite: letzte Verarbeitungen, Fehler und Quellen-Status."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from core import mail_listener
from db import database


def render() -> None:
    st.title("📜 Logs & Status")

    listener = mail_listener.get_listener()
    st.markdown(f"**Mail-Listener:** {listener.status}")
    if listener.last_error:
        st.error(f"Letzter Fehler: {listener.last_error}")

    st.subheader("Quellen-Status (letzte Suchen)")
    statuses = database.list_source_status(limit=100)
    if statuses:
        st.dataframe(
            pd.DataFrame([
                {
                    "Zeit": (s["created_at"] or "")[:19].replace("T", " "),
                    "Quelle": s["source"],
                    "OK": "✅" if s["ok"] else "❌",
                    "Treffer": s["hit_count"],
                    "Dauer (ms)": s["duration_ms"],
                    "Fehler": s["error"] or "",
                }
                for s in statuses
            ]),
            use_container_width=True,
            hide_index=True,
        )
    else:
        st.info("Noch keine Suchläufe.")

    st.subheader("Verarbeitungs-Log")
    logs = database.list_logs(limit=300)
    if logs:
        st.dataframe(
            pd.DataFrame([
                {
                    "Zeit": (l["ts"] or "")[:19].replace("T", " "),
                    "Level": l["level"],
                    "Komponente": l["component"],
                    "Meldung": l["message"],
                }
                for l in logs
            ]),
            use_container_width=True,
            hide_index=True,
        )
    else:
        st.info("Noch keine Log-Einträge.")

    if st.button("🔄 Aktualisieren"):
        st.rerun()
