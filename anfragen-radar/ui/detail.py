"""Detailansicht einer Anfrage: Kontaktdaten, Übersetzung, Suchbegriffe
(editierbar), Trefferliste als Cards, Status & Notizen."""
from __future__ import annotations

import json

import streamlit as st

from core import pipeline
from db import database
from ui.uebersicht import STATUS_VALUES

COLLAPSE_AFTER = 15


def render() -> None:
    request_id = st.session_state.get("selected_request_id")
    rows = database.list_requests()
    if not rows:
        st.info("Noch keine Anfragen vorhanden.")
        return

    options = {f'{r["public_id"]} · {r["firma"] or "?"} · {r["anfrage_zu"] or r["kategorie"] or ""}': r["id"]
               for r in rows}
    labels = list(options.keys())
    default_index = 0
    if request_id in options.values():
        default_index = list(options.values()).index(request_id)
    choice = st.selectbox("Anfrage", labels, index=default_index)
    request_id = options[choice]
    st.session_state["selected_request_id"] = request_id

    req = database.get_request(request_id)
    if req is None:
        st.error("Anfrage nicht gefunden.")
        return

    st.title(f"{req['public_id']}")
    st.caption(f"Eingegangen: {(req['created_at'] or '')[:16].replace('T', ' ')} UTC")

    # ------------------------------------------------------------ Kontakt
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Kontakt")
        st.markdown(
            f"**Firma:** {req['firma'] or '–'}  \n"
            f"**Name:** {req['name'] or '–'}  \n"
            f"**Ort:** {req['ort'] or '–'}  \n"
            f"**Land:** {req['land'] or '–'}  \n"
            f"**Telefon:** {req['telefon'] or '–'}  \n"
            f"**E-Mail (Relay):** `{req['email_relay'] or '–'}`"
        )
    with col2:
        st.subheader("Anfrage")
        st.markdown(
            f"**Kategorie:** {req['kategorie'] or '–'}  \n"
            f"**Anfrage zu:** {req['anfrage_zu'] or '–'}  \n"
            f"**Sprache:** {req['sprache'] or '–'}"
        )
        new_status = st.selectbox(
            "Status", STATUS_VALUES,
            index=STATUS_VALUES.index(req["status"]) if req["status"] in STATUS_VALUES else 0,
        )
        if new_status != req["status"]:
            database.update_request(request_id, status=new_status)
            st.toast(f"Status → {new_status}")

    # ------------------------------------------------------------ Nachricht
    st.subheader("Nachricht")
    msg_col1, msg_col2 = st.columns(2)
    with msg_col1:
        st.markdown("**Original**")
        st.text(req["nachricht"] or "–")
    with msg_col2:
        st.markdown("**Deutsche Übersetzung**")
        st.text(req["nachricht_de"] or "– (noch nicht analysiert)")

    # ------------------------------------------------------- Anforderungen
    anforderungen = {}
    try:
        anforderungen = json.loads(req.get("anforderungen_json") or "{}")
    except json.JSONDecodeError:
        pass
    if anforderungen:
        st.subheader("Extrahierte Anforderungen")
        st.markdown(
            f"**Maschinentyp:** {anforderungen.get('maschinentyp') or '–'}  \n"
            f"**Referenz:** {anforderungen.get('referenz_hersteller') or ''} "
            f"{anforderungen.get('referenz_modell') or ''}  \n"
            f"**Budget:** {anforderungen.get('budget') or '–'}"
        )
        for a in anforderungen.get("anforderungen") or []:
            st.markdown(f"- {a}")

    # -------------------------------------------------------- Suchbegriffe
    st.subheader("Suchbegriffe")
    terms = {"exakt": [], "funktional": []}
    try:
        terms.update(json.loads(req.get("suchbegriffe_json") or "{}"))
    except json.JSONDecodeError:
        pass
    term_col1, term_col2 = st.columns(2)
    with term_col1:
        exakt_text = st.text_area(
            "Exakte Suche (eine pro Zeile)",
            value="\n".join(terms.get("exakt") or []),
            height=100,
        )
    with term_col2:
        funktional_text = st.text_area(
            "Funktionale Suche (eine pro Zeile)",
            value="\n".join(terms.get("funktional") or []),
            height=100,
        )

    running_key = f"search_running_{request_id}"
    if st.button("🔄 Erneut suchen", type="primary",
                 disabled=st.session_state.get(running_key, False)):
        new_terms = {
            "exakt": [t.strip() for t in exakt_text.split("\n") if t.strip()],
            "funktional": [t.strip() for t in funktional_text.split("\n") if t.strip()],
        }
        database.update_request(
            request_id, suchbegriffe_json=json.dumps(new_terms, ensure_ascii=False)
        )
        st.session_state[running_key] = True
        with st.spinner("Suche läuft (alle Quellen, parallel) …"):
            try:
                pipeline.run_search_for_request(request_id)
            finally:
                st.session_state[running_key] = False
        st.rerun()

    # ------------------------------------------------------------- Treffer
    hits = database.list_hits(request_id)
    statuses = database.list_source_status(request_id)
    failed = [s for s in statuses if not s["ok"]]

    st.subheader(f"Treffer ({len(hits)})")
    if failed:
        with st.expander(f"⚠️ {len(failed)} Quelle(n) mit Fehlern"):
            for s in failed:
                st.markdown(f"- **{s['source']}**: {s['error']}")

    if not hits:
        st.info("Keine Treffer. Suchbegriffe anpassen und „Erneut suchen“ klicken.")
    else:
        visible = hits[:COLLAPSE_AFTER]
        rest = hits[COLLAPSE_AFTER:]
        for hit in visible:
            _hit_card(hit)
        if rest:
            with st.expander(f"Weitere {len(rest)} Treffer anzeigen"):
                for hit in rest:
                    _hit_card(hit)

    # -------------------------------------------------------------- Notizen
    st.subheader("Notizen (Vertrieb)")
    notes = st.text_area("Notizen", value=req["notizen"] or "", height=120,
                         label_visibility="collapsed")
    if st.button("💾 Notizen speichern"):
        database.update_request(request_id, notizen=notes)
        st.toast("Notizen gespeichert.")


def _hit_card(hit: dict) -> None:
    with st.container(border=True):
        cols = st.columns([1, 4]) if hit.get("image_url") else [None, st.container()]
        if hit.get("image_url"):
            with cols[0]:
                st.image(hit["image_url"], use_container_width=True)
        with cols[1]:
            badge = "🟢 **EIGENER BESTAND** · " if hit["own_stock"] else ""
            st.markdown(f"{badge}**[{hit['title']}]({hit['url']})**")
            meta = " · ".join(filter(None, [
                f"💶 {hit['price']}" if hit.get("price") else None,
                f"📍 {hit['location']}" if hit.get("location") else None,
                f"Score {hit['score']:.0f}" if hit.get("score") is not None else None,
            ]))
            source_line = f"`{hit['source']}`" + (f" · {meta}" if meta else "")
            st.markdown(source_line)
            if hit.get("match_reason"):
                st.caption(hit["match_reason"])
