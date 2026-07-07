"""Übersichtsseite: alle Anfragen mit Filtern und Volltextsuche."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from core import mail_listener
from db import database

STATUS_VALUES = ["Neu", "In Bearbeitung", "Erledigt", "Kein Treffer"]


def render() -> None:
    st.title("📡 Anfragen-Radar")
    st.caption("Maschinensucher Kategorie-Anfragen · Komplett Konzept Verwertungs GmbH")

    listener = mail_listener.get_listener()
    col_status, col_button = st.columns([3, 1])
    with col_status:
        st.info(f"Mail-Listener: **{listener.status}**"
                + (f" · letzter Fehler: {listener.last_error}" if listener.last_error else ""))
    with col_button:
        if st.button("📬 Postfach jetzt prüfen", use_container_width=True):
            listener.check_now()
            st.toast("Prüfung angestoßen – Ergebnis erscheint in Kürze.")

    col1, col2, col3 = st.columns(3)
    with col1:
        status = st.selectbox("Status", ["Alle"] + STATUS_VALUES)
    with col2:
        categories = database.list_categories()
        kategorie = st.selectbox("Kategorie", ["Alle"] + categories)
    with col3:
        text = st.text_input("Volltextsuche", placeholder="Firma, Modell, ID …")

    rows = database.list_requests(
        status=None if status == "Alle" else status,
        kategorie=None if kategorie == "Alle" else kategorie,
        text=text or None,
    )

    if not rows:
        st.warning("Keine Anfragen gefunden. Sobald eine Kategorie-Anfragen-Mail "
                   "eingeht, erscheint sie hier.")
        return

    df = pd.DataFrame([
        {
            "ID": r["public_id"],
            "Datum": (r["created_at"] or "")[:16].replace("T", " "),
            "Firma": r["firma"],
            "Land": r["land"],
            "Kategorie": r["kategorie"],
            "Anfrage zu": r["anfrage_zu"],
            "Status": r["status"],
            "Treffer": r["hit_count"],
        }
        for r in rows
    ])

    selection = st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        on_select="rerun",
        selection_mode="single-row",
    )
    selected_rows = selection.get("selection", {}).get("rows", [])
    if selected_rows:
        st.session_state["selected_request_id"] = rows[selected_rows[0]]["id"]
        st.switch_page(st.session_state["detail_page"])
