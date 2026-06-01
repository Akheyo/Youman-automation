"""Card-Container mit Header + gelber Vertikallinie (Youman-Stil)."""
from __future__ import annotations

import customtkinter as ctk

import theme as t


class Card(ctk.CTkFrame):
    """Weiße Card mit:
       - gelber Vertikallinie links (4 px breit)
       - schwarzer Caps-Header oben
       - Inhalt darunter über self.body als CTkFrame
    """

    def __init__(self, parent, titel: str = "", **kwargs):
        super().__init__(
            parent, fg_color=t.BG_CARD,
            corner_radius=t.CARD_RADIUS, **kwargs,
        )
        # Linke gelbe Linie
        self._line = ctk.CTkFrame(self, fg_color=t.ACCENT,
                                     width=4, corner_radius=0)
        self._line.pack(side="left", fill="y")

        # Container für Header + Body
        self._inner = ctk.CTkFrame(self, fg_color="transparent")
        self._inner.pack(side="left", fill="both", expand=True,
                          padx=(t.PAD_M, t.PAD_M),
                          pady=(t.PAD_M, t.PAD_M))

        if titel:
            self._header = ctk.CTkLabel(
                self._inner,
                text=titel.upper(),
                font=ctk.CTkFont(family=t.FONT_FAMILY[0],
                                   size=t.FONT_HEADER_SIZE, weight="bold"),
                text_color=t.TEXT_DARK,
                anchor="w",
            )
            self._header.pack(fill="x", pady=(0, t.PAD_M))

        # Body — Inhalt wird hier hinein gepackt
        self.body = ctk.CTkFrame(self._inner, fg_color="transparent")
        self.body.pack(fill="both", expand=True)

    def set_titel(self, titel: str) -> None:
        if hasattr(self, "_header"):
            self._header.configure(text=titel.upper())
