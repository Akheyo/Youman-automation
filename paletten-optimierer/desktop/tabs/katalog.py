"""Katalog-Tab: Palettenliste + CRUD."""
from __future__ import annotations

from tkinter import ttk, messagebox

import customtkinter as ctk

from .. import theme as t
from ..widgets import Card
from ..state import get_state


class KatalogTab(ctk.CTkFrame):
    def __init__(self, parent, app):
        super().__init__(parent, fg_color=t.BG_MAIN)
        self.app = app
        self.state = get_state()
        self._build()

    def _build(self) -> None:
        # Neue Palette anlegen
        neu = Card(self, "Neue Palette anlegen")
        neu.pack(fill="x", pady=(0, t.PAD_L))

        row1 = ctk.CTkFrame(neu.body, fg_color="transparent")
        row1.pack(fill="x", pady=(0, t.PAD_S))

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

        self._n_name = feld(row1, "Name", 200)
        self._n_L = feld(row1, "Länge (mm)", 110)
        self._n_B = feld(row1, "Breite (mm)", 110)
        self._n_H = feld(row1, "Höhe (mm, opt.)", 130)

        row2 = ctk.CTkFrame(neu.body, fg_color="transparent")
        row2.pack(fill="x", pady=(0, t.PAD_M))

        self._n_ek = feld(row2, "EK Lieferant (€)", 140)
        self._n_mat = feld(row2, "Eigenfert. Material (€)", 160)
        self._n_lohn = feld(row2, "Eigenfert. Lohn (€)", 140)
        self._n_best = feld(row2, "Bestand (Stk)", 130)

        b = ctk.CTkButton(
            neu.body, text="➕  Hinzufügen",
            command=self._anlegen,
            fg_color=t.PRIMARY, hover_color=t.PRIMARY_LIGHT,
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=13, weight="bold"),
            height=36,
        )
        b.pack(anchor="w", pady=(0, 0))

        # Liste
        liste = Card(self, "Vorhandene Paletten")
        liste.pack(fill="both", expand=True)
        self._liste_body = liste.body
        self._tree = self._build_tree(self._liste_body)

    def _build_tree(self, parent):
        style = ttk.Style()
        style.configure(
            "Kat.Treeview",
            background="#ffffff", foreground=t.TEXT_DARK,
            fieldbackground="#ffffff", rowheight=24,
            font=(t.FONT_FAMILY[0], 11),
        )
        style.configure(
            "Kat.Treeview.Heading",
            background="#e2e8f0", foreground=t.PRIMARY,
            font=(t.FONT_FAMILY[0], 11, "bold"),
        )

        wrap = ctk.CTkFrame(parent, fg_color="transparent")
        wrap.pack(fill="both", expand=True, pady=(0, t.PAD_S))
        wrap.grid_rowconfigure(0, weight=1)
        wrap.grid_columnconfigure(0, weight=1)

        cols = ("Name", "L", "B", "H", "EK Lief.",
                 "Eigenfert.", "Δ Lief-Eig", "Bestand", "Auto-Std")
        tree = ttk.Treeview(wrap, columns=cols, show="headings",
                              style="Kat.Treeview", height=14)
        for c, w in zip(cols, (160, 70, 70, 70, 90, 100, 100, 90, 80)):
            tree.heading(c, text=c)
            tree.column(c, width=w, anchor="w")

        scroll = ttk.Scrollbar(wrap, orient="vertical",
                                  command=tree.yview)
        tree.configure(yscrollcommand=scroll.set)
        tree.grid(row=0, column=0, sticky="nsew")
        scroll.grid(row=0, column=1, sticky="ns")

        # Aktion-Buttons
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
            for i in self._tree.get_children():
                self._tree.delete(i)
            for e in engines.katalog.alle():
                ek = float(e.get("ek_lieferant_eur",
                                    e.get("einkaufspreis_eur", 0)) or 0)
                eigen = (float(e.get("selbstfertigung_material_eur", 0) or 0)
                          + float(e.get("selbstfertigung_lohn_eur", 0) or 0))
                self._tree.insert("", "end", iid=e["id"], values=(
                    (e.get("name", "") or "—")[:25],
                    e.get("L_mm", 0),
                    e.get("B_mm", 0),
                    e.get("hoehe_mm", 0) or "",
                    f"{ek:.2f} €" if ek > 0 else "—",
                    f"{eigen:.2f} €" if eigen > 0 else "—",
                    f"{ek - eigen:+.2f} €" if (ek > 0 and eigen > 0) else "—",
                    int(e.get("bestand", 0)),
                    "🟢" if e.get("auto_standard") else "—",
                ))
        except Exception as exc:
            messagebox.showerror("Katalog-Fehler", f"Liste konnte nicht "
                                  f"geladen werden:\n{exc}")

    def on_show(self) -> None:
        self._refresh()

    def _anlegen(self) -> None:
        try:
            from .. import engines
            L = int(self._n_L.get() or 0)
            B = int(self._n_B.get() or 0)
            H = int(self._n_H.get() or 0) if self._n_H.get() else 0
            if L <= 0 or B <= 0:
                messagebox.showwarning("Validierung",
                                            "Länge + Breite müssen > 0 sein.")
                return
            # Duplikat-Check
            dup = engines.katalog.finde_duplikat(L, B, H)
            if dup:
                if not messagebox.askyesno(
                        "Duplikat",
                        f"Diese Palette existiert bereits als "
                        f"'{dup.get('name', '—') or '—'}'. Trotzdem anlegen?"):
                    return
            engines.katalog.neuer_eintrag(
                L, B,
                float(self._n_ek.get() or 0), 0.0,
                int(self._n_best.get() or 0), 0,
                "", aktiv=True,
                name=self._n_name.get() or "",
                hoehe_mm=H,
                typ="standard", quelle="manuell",
                ek_lieferant_eur=float(self._n_ek.get() or 0),
                selbstfertigung_material_eur=float(self._n_mat.get() or 0),
                selbstfertigung_lohn_eur=float(self._n_lohn.get() or 0),
            )
            # Reset Inputs
            for e in (self._n_name, self._n_L, self._n_B, self._n_H,
                       self._n_ek, self._n_mat, self._n_lohn, self._n_best):
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
                f"{len(sel)} Eintrag/Einträge wirklich löschen?"):
            return
        try:
            from .. import engines
            for eid in sel:
                engines.katalog.loesche_eintrag(eid)
            self._refresh()
        except Exception as exc:
            messagebox.showerror("Löschen fehlgeschlagen", str(exc))
