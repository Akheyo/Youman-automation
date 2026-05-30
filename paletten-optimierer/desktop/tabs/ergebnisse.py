"""Ergebnisse-Tab: KPIs + Standards-Tabelle + Zuordnungs-Tabelle."""
from __future__ import annotations

import tkinter as tk
from tkinter import ttk

import customtkinter as ctk

from .. import theme as t
from ..widgets import Card, KpiCard
from ..state import get_state


class ErgebnisseTab(ctk.CTkFrame):
    def __init__(self, parent, app):
        super().__init__(parent, fg_color=t.BG_MAIN)
        self.app = app
        self.state = get_state()
        self._build()

    def _build(self) -> None:
        # KPI-Reihe
        kpis = ctk.CTkFrame(self, fg_color="transparent")
        kpis.pack(fill="x", pady=(0, t.PAD_L))
        for i in range(4):
            kpis.grid_columnconfigure(i, weight=1, uniform="kpi")

        self.kpi_gesamt = KpiCard(kpis, "GESAMT (Std + Sonder)", "—", "")
        self.kpi_gesamt.grid(row=0, column=0, sticky="nsew",
                              padx=(0, t.PAD_S))
        self.kpi_std = KpiCard(kpis, "Standards", "—", "")
        self.kpi_std.grid(row=0, column=1, sticky="nsew", padx=t.PAD_S)
        self.kpi_son = KpiCard(kpis, "Sonder", "—", "")
        self.kpi_son.grid(row=0, column=2, sticky="nsew", padx=t.PAD_S)
        self.kpi_pal = KpiCard(kpis, "Paletten gesamt", "—", "Σ Menge")
        self.kpi_pal.grid(row=0, column=3, sticky="nsew",
                           padx=(t.PAD_S, 0))

        # Tabellen-Karte
        tab_card = Card(self, "Detail-Zuordnung")
        tab_card.pack(fill="both", expand=True)
        self._tree_container = tab_card.body

        # ttk-Treeview wird im on_show befüllt
        self._tree = None
        self._info = ctk.CTkLabel(
            self._tree_container,
            text="Noch keine Optimierung — Tab 'Optimierung' nutzen.",
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=12),
            text_color=t.TEXT_MEDIUM,
        )
        self._info.pack(pady=t.PAD_L)

    def on_show(self) -> None:
        res = self.state.ergebnis
        if not res:
            return

        self.kpi_gesamt.set_wert(str(res.get("gesamt", 0)))
        self.kpi_std.set_wert(str(len(res.get("standards", []))))
        self.kpi_son.set_wert(str(len(res.get("sonder", []))))
        sum_menge = sum(int(z.get("menge", 0)) for z in res.get("zuordnung", []))
        self.kpi_pal.set_wert(str(sum_menge))

        # Tabelle neu rendern
        for w in self._tree_container.winfo_children():
            w.destroy()
        self._tree = self._render_tabelle(self._tree_container, res)

    def _render_tabelle(self, parent, res: dict) -> ttk.Treeview:
        # ttk-Style anpassen
        style = ttk.Style()
        style.theme_use("default")
        style.configure(
            "Youman.Treeview",
            background="#ffffff", foreground=t.TEXT_DARK,
            fieldbackground="#ffffff", rowheight=24,
            font=(t.FONT_FAMILY[0], 11),
        )
        style.configure(
            "Youman.Treeview.Heading",
            background="#e2e8f0", foreground=t.PRIMARY,
            font=(t.FONT_FAMILY[0], 11, "bold"),
        )
        style.map("Youman.Treeview",
                   background=[("selected", t.BLUE)],
                   foreground=[("selected", "#ffffff")])

        wrap = ctk.CTkFrame(parent, fg_color="transparent")
        wrap.pack(fill="both", expand=True)
        wrap.grid_rowconfigure(0, weight=1)
        wrap.grid_columnconfigure(0, weight=1)

        cols = ("Auftrag", "Kunde", "Artikel", "L×B", "Menge",
                 "Ziel", "Typ")
        tree = ttk.Treeview(wrap, columns=cols, show="headings",
                              style="Youman.Treeview", height=18)
        for c, w in zip(cols, (110, 180, 110, 100, 70, 140, 130)):
            tree.heading(c, text=c)
            tree.column(c, width=w, anchor="w")

        for z in res.get("zuordnung", []):
            tree.insert("", "end", values=(
                z.get("auftrag", ""),
                (z.get("name", "") or "")[:30],
                z.get("artikelnummer", ""),
                f"{int(z.get('L', 0))}×{int(z.get('B', 0))}",
                int(z.get("menge", 0)),
                z.get("ziel", ""),
                z.get("typ", ""),
            ))

        scroll = ttk.Scrollbar(wrap, orient="vertical",
                                  command=tree.yview)
        tree.configure(yscrollcommand=scroll.set)
        tree.grid(row=0, column=0, sticky="nsew")
        scroll.grid(row=0, column=1, sticky="ns")
        return tree
