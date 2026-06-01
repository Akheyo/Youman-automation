"""Optimierungs-Tab: Parameter + Run-Button."""
from __future__ import annotations

import threading

import customtkinter as ctk

import theme as t
from widgets import Card
from state import get_state


class OptimierungTab(ctk.CTkFrame):
    def __init__(self, parent, app):
        super().__init__(parent, fg_color=t.BG_MAIN)
        self.app = app
        self.state = get_state()
        self._build()

    def _build(self) -> None:
        # Toleranz-Card
        tol = Card(self, "Toleranz (Übermaß in mm)")
        tol.pack(fill="x", pady=(0, t.PAD_L))
        tr = ctk.CTkFrame(tol.body, fg_color="transparent")
        tr.pack(fill="x")
        tr.grid_columnconfigure(1, weight=1)
        tr.grid_columnconfigure(3, weight=1)

        ctk.CTkLabel(tr, text="kurze Achse (Breite):",
                       font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=12),
                       text_color=t.TEXT_MEDIUM
                       ).grid(row=0, column=0, sticky="w", padx=(0, t.PAD_S))
        self._tol_kurz = ctk.CTkEntry(tr, width=100)
        self._tol_kurz.insert(0, str(self.state.tol_kurz_mm))
        self._tol_kurz.grid(row=0, column=1, sticky="w")

        ctk.CTkLabel(tr, text="lange Achse (Länge):",
                       font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=12),
                       text_color=t.TEXT_MEDIUM
                       ).grid(row=0, column=2, sticky="w",
                                padx=(t.PAD_L, t.PAD_S))
        self._tol_lang = ctk.CTkEntry(tr, width=100)
        self._tol_lang.insert(0, str(self.state.tol_lang_mm))
        self._tol_lang.grid(row=0, column=3, sticky="w")

        # Toggles
        tg = Card(self, "Modus")
        tg.pack(fill="x", pady=(0, t.PAD_L))
        self._sw_kombi = ctk.CTkSwitch(
            tg.body, text="Kombinieren erlaubt "
                              "(k-Stapel + heterogene Kombi)",
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=12),
        )
        if self.state.kombinieren:
            self._sw_kombi.select()
        self._sw_kombi.pack(anchor="w", pady=4)

        self._sw_sonder = ctk.CTkSwitch(
            tg.body, text="Sonderpaletten erlaubt",
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=12),
        )
        if self.state.sonder_erlaubt:
            self._sw_sonder.select()
        self._sw_sonder.pack(anchor="w", pady=4)

        # Run-Button
        run = ctk.CTkFrame(self, fg_color="transparent")
        run.pack(fill="x", pady=(0, t.PAD_L))
        self._b_run = ctk.CTkButton(
            run, text="▶  Optimierung starten",
            command=self._optimieren,
            fg_color=t.ACCENT, hover_color=t.ACCENT_DARK,
            text_color=t.PRIMARY,
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=16,
                               weight="bold"),
            height=50,
        )
        self._b_run.pack(fill="x")

        self._status = ctk.CTkLabel(
            self, text="ℹ Erst eine Excel-Datei importieren.",
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=12),
            text_color=t.TEXT_MEDIUM,
        )
        self._status.pack(anchor="w", pady=(t.PAD_S, 0))

    def on_show(self) -> None:
        dat = self.state.import_dat
        if not dat or not dat.get("mit_mass"):
            self._b_run.configure(state="disabled")
            self._status.configure(
                text="ℹ Erst eine Excel-Datei im Tab 'Datenimport' importieren.",
                text_color=t.TEXT_MEDIUM,
            )
        else:
            self._b_run.configure(state="normal")
            n = len(dat["mit_mass"])
            self._status.configure(
                text=f"✓ {n} Aufträge bereit — Klick auf 'Optimierung starten'.",
                text_color=t.GREEN,
            )

    def _optimieren(self) -> None:
        if not self.state.import_dat:
            return
        self._b_run.configure(state="disabled", text="⏳  Rechne…")
        self._status.configure(text="Optimierung läuft…",
                                  text_color=t.PRIMARY)
        # Thread, damit UI nicht einfriert
        threading.Thread(target=self._run_blocking, daemon=True).start()

    def _run_blocking(self) -> None:
        try:
            try:
                tk = int(self._tol_kurz.get())
            except ValueError:
                tk = 200
            try:
                tl = int(self._tol_lang.get())
            except ValueError:
                tl = 400
            self.state.tol_kurz_mm = tk
            self.state.tol_lang_mm = tl
            self.state.kombinieren = bool(self._sw_kombi.get())
            self.state.sonder_erlaubt = bool(self._sw_sonder.get())

            import engines
            orders = [
                {"L": p["laenge"], "B": p["breite"], "menge": p["anzahl"],
                  "auftrag": p["auftrag"], "name": p["name"]}
                for p in self.state.import_dat["mit_mass"]
            ]
            res = engines.optimierer_kern.optimiere(
                orders,
                tol_kurz_mm=tk, tol_lang_mm=tl,
                max_kombi_teile=3 if self.state.kombinieren else 1,
                heterogen_fallback=self.state.kombinieren,
                sonder_erlaubt=self.state.sonder_erlaubt,
                sonder_deckel=self.state.sonder_deckel,
            )
            self.state.ergebnis = res
            self.after(0, self._fertig, True, "")
        except Exception as exc:
            self.after(0, self._fertig, False, str(exc))

    def _fertig(self, ok: bool, msg: str) -> None:
        self._b_run.configure(state="normal", text="▶  Optimierung starten")
        if ok:
            r = self.state.ergebnis or {}
            self._status.configure(
                text=f"✓ Fertig: {r.get('gesamt', 0)} Maße "
                       f"({len(r.get('standards', []))} Std + "
                       f"{len(r.get('sonder', []))} Sonder) — "
                       f"Tab 'Ergebnisse' zeigt Details.",
                text_color=t.GREEN,
            )
            self.app.zeige_tab("Ergebnisse")
        else:
            self._status.configure(text=f"⚠ Fehler: {msg}",
                                       text_color=t.RED)
