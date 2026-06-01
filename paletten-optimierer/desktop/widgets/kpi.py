"""KPI-Karte: großer Wert, kleines Label, optionaler Delta-Text."""
from __future__ import annotations

import customtkinter as ctk

import theme as t


class KpiCard(ctk.CTkFrame):
    """Kleiner Card-Variante fuer KPIs."""

    def __init__(self, parent, label: str, wert: str = "—",
                 delta: str = "", click_cmd=None, **kwargs):
        super().__init__(parent, fg_color=t.BG_CARD,
                          corner_radius=t.CARD_RADIUS, **kwargs)
        self._click_cmd = click_cmd

        inner = ctk.CTkFrame(self, fg_color="transparent")
        inner.pack(fill="both", expand=True, padx=t.PAD_M, pady=t.PAD_M)

        self._label = ctk.CTkLabel(
            inner, text=label,
            font=ctk.CTkFont(family=t.FONT_FAMILY[0],
                               size=t.FONT_CAPTION_SIZE),
            text_color=t.TEXT_MEDIUM, anchor="w",
        )
        self._label.pack(fill="x")

        self._wert = ctk.CTkLabel(
            inner, text=str(wert),
            font=ctk.CTkFont(family=t.FONT_FAMILY[0],
                               size=t.FONT_KPI_SIZE, weight="bold"),
            text_color=t.PRIMARY, anchor="w",
        )
        self._wert.pack(fill="x", pady=(2, 0))

        self._delta = ctk.CTkLabel(
            inner, text=delta,
            font=ctk.CTkFont(family=t.FONT_FAMILY[0],
                               size=t.FONT_CAPTION_SIZE),
            text_color=t.TEXT_LIGHT, anchor="w",
        )
        self._delta.pack(fill="x")

        if click_cmd:
            self.bind("<Button-1>", lambda e: click_cmd())
            for c in (inner, self._label, self._wert, self._delta):
                c.bind("<Button-1>", lambda e: click_cmd())
            self.configure(cursor="hand2")

    def set_wert(self, wert: str) -> None:
        self._wert.configure(text=str(wert))

    def set_delta(self, delta: str) -> None:
        self._delta.configure(text=delta)
