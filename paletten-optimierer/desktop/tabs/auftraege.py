"""Aufträge-Tab: Liste aller AWs."""
from __future__ import annotations

from tkinter import ttk, messagebox

import customtkinter as ctk

from .. import theme as t
from ..widgets import Card, KpiCard
from ..state import get_state


class AuftraegeTab(ctk.CTkFrame):
    def __init__(self, parent, app):
        super().__init__(parent, fg_color=t.BG_MAIN)
        self.app = app
        self.state = get_state()
        self._build()

    def _build(self) -> None:
        # KPIs
        kpis = ctk.CTkFrame(self, fg_color="transparent")
        kpis.pack(fill="x", pady=(0, t.PAD_L))
        for i in range(4):
            kpis.grid_columnconfigure(i, weight=1, uniform="kpi")

        self.k_offen = KpiCard(kpis, "🟢 Offen", "—", "")
        self.k_offen.grid(row=0, column=0, sticky="nsew", padx=(0, t.PAD_S))
        self.k_arb = KpiCard(kpis, "🟡 In Arbeit", "—", "")
        self.k_arb.grid(row=0, column=1, sticky="nsew", padx=t.PAD_S)
        self.k_abg = KpiCard(kpis, "✅ Abgeschlossen (30T)", "—", "")
        self.k_abg.grid(row=0, column=2, sticky="nsew", padx=t.PAD_S)
        self.k_st = KpiCard(kpis, "⚫ Storniert (30T)", "—", "")
        self.k_st.grid(row=0, column=3, sticky="nsew", padx=(t.PAD_S, 0))

        # Neuanlage
        neu = Card(self, "Neuen Auftrag manuell anlegen")
        neu.pack(fill="x", pady=(0, t.PAD_L))

        row1 = ctk.CTkFrame(neu.body, fg_color="transparent")
        row1.pack(fill="x", pady=(0, t.PAD_M))

        def feld(parent, label, breite=140):
            f = ctk.CTkFrame(parent, fg_color="transparent")
            f.pack(side="left", padx=(0, t.PAD_M))
            ctk.CTkLabel(
                f, text=label,
                font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=11),
                text_color=t.TEXT_MEDIUM, anchor="w",
            ).pack(anchor="w")
            e = ctk.CTkEntry(f, width=breite)
            e.pack(anchor="w")
            return e

        self._n_aw = feld(row1, "AW-Nummer (leer = auto)", 200)
        self._n_kunde = feld(row1, "Kunde", 200)
        self._n_artnr = feld(row1, "ArtikelNr", 140)
        self._n_menge = feld(row1, "Menge", 100)

        b = ctk.CTkButton(
            neu.body, text="➕  Auftrag anlegen", command=self._anlegen,
            fg_color=t.PRIMARY, hover_color=t.PRIMARY_LIGHT,
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=13, weight="bold"),
            height=36,
        )
        b.pack(anchor="w")

        # Liste
        liste = Card(self, "Aufträge")
        liste.pack(fill="both", expand=True)
        self._tree = self._build_tree(liste.body)

    def _build_tree(self, parent):
        style = ttk.Style()
        style.configure(
            "Auf.Treeview",
            background="#ffffff", foreground=t.TEXT_DARK,
            fieldbackground="#ffffff", rowheight=24,
            font=(t.FONT_FAMILY[0], 11),
        )
        style.configure(
            "Auf.Treeview.Heading",
            background="#e2e8f0", foreground=t.PRIMARY,
            font=(t.FONT_FAMILY[0], 11, "bold"),
        )

        wrap = ctk.CTkFrame(parent, fg_color="transparent")
        wrap.pack(fill="both", expand=True, pady=(0, t.PAD_S))
        wrap.grid_rowconfigure(0, weight=1)
        wrap.grid_columnconfigure(0, weight=1)

        cols = ("AW", "Kunde", "ArtikelNr", "Menge",
                 "Bestelldatum", "Verbrauchsdatum", "Status")
        tree = ttk.Treeview(wrap, columns=cols, show="headings",
                              style="Auf.Treeview", height=14)
        for c, w in zip(cols, (140, 180, 110, 80, 130, 130, 130)):
            tree.heading(c, text=c)
            tree.column(c, width=w, anchor="w")

        scroll = ttk.Scrollbar(wrap, orient="vertical",
                                  command=tree.yview)
        tree.configure(yscrollcommand=scroll.set)
        tree.grid(row=0, column=0, sticky="nsew")
        scroll.grid(row=0, column=1, sticky="ns")

        bb = ctk.CTkFrame(parent, fg_color="transparent")
        bb.pack(fill="x")
        ctk.CTkButton(
            bb, text="🗑  Markierte löschen", command=self._loeschen,
            fg_color=t.RED, hover_color="#b91c1c",
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=12),
            height=30, width=180,
        ).pack(side="left", padx=(0, t.PAD_S))
        ctk.CTkButton(
            bb, text="↻  Neu laden", command=self._refresh,
            fg_color="#475569", hover_color="#334155",
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=12),
            height=30, width=120,
        ).pack(side="left")
        return tree

    def _refresh(self) -> None:
        try:
            from .. import engines
            # KPIs
            s = engines.auftraege.stats()
            self.k_offen.set_wert(str(s.get("offen", 0)))
            self.k_arb.set_wert(str(s.get("in_arbeit", 0)))
            self.k_abg.set_wert(str(s.get("abgeschlossen_30T", 0)))
            self.k_st.set_wert(str(s.get("storniert_30T", 0)))
            # Liste
            for i in self._tree.get_children():
                self._tree.delete(i)
            for e in engines.auftraege.alle():
                icon, label = engines.auftraege.STATUS_BADGE.get(
                    e.get("status", "offen"), ("?", "?"))
                self._tree.insert("", "end", iid=e["id"], values=(
                    e.get("aw_nummer", ""),
                    (e.get("kunde", "") or "")[:30],
                    e.get("artikel_nummer", ""),
                    e.get("menge", 0),
                    e.get("bestelldatum", "") or "—",
                    e.get("verbrauchsdatum", "") or "—",
                    f"{icon} {label}",
                ))
        except Exception as exc:
            messagebox.showerror("Aufträge-Fehler", str(exc))

    def on_show(self) -> None:
        self._refresh()

    def _anlegen(self) -> None:
        try:
            from .. import engines
            erg = engines.auftraege.neuer_auftrag(
                aw_nummer=self._n_aw.get(),
                kunde=self._n_kunde.get(),
                artikel_nummer=self._n_artnr.get(),
                menge=int(self._n_menge.get() or 0),
                quelle="manuell",
            )
            if not erg["ok"]:
                messagebox.showerror("Anlegen fehlgeschlagen",
                                          erg["fehler"])
                return
            for e in (self._n_aw, self._n_kunde, self._n_artnr,
                       self._n_menge):
                e.delete(0, "end")
            self._refresh()
        except Exception as exc:
            messagebox.showerror("Anlegen fehlgeschlagen", str(exc))

    def _loeschen(self) -> None:
        sel = self._tree.selection()
        if not sel:
            return
        if not messagebox.askyesno(
                "Löschen",
                f"{len(sel)} Auftrag/Aufträge wirklich löschen?"):
            return
        try:
            from .. import engines
            for eid in sel:
                engines.auftraege.loesche_auftrag(eid)
            self._refresh()
        except Exception as exc:
            messagebox.showerror("Löschen fehlgeschlagen", str(exc))
