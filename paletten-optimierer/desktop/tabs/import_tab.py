"""Datenimport-Tab: nativer File-Picker → Excel parsen → Diagnose."""
from __future__ import annotations

import io
from pathlib import Path
from tkinter import filedialog

import customtkinter as ctk

import theme as t
from widgets import Card
from state import get_state


class ImportTab(ctk.CTkFrame):
    def __init__(self, parent, app):
        super().__init__(parent, fg_color=t.BG_MAIN)
        self.app = app
        self.state = get_state()
        self._build()

    def _build(self) -> None:
        # Top-Karte: Datei wählen + Importieren
        card = Card(self, "Datenimport")
        card.pack(fill="x", pady=(0, t.PAD_L))

        info = ctk.CTkLabel(
            card.body,
            text="Excel-Datei (.xlsx) auswählen — der Import liest "
                 "Spalten Auftrag, Kunde, Artikelnummer, P-Länge, P-Breite, "
                 "Menge, Verbrauchsdatum (Header dynamisch erkannt).",
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=12),
            text_color=t.TEXT_MEDIUM,
            anchor="w", justify="left", wraplength=900,
        )
        info.pack(fill="x", pady=(0, t.PAD_M))

        row = ctk.CTkFrame(card.body, fg_color="transparent")
        row.pack(fill="x")

        self._pfad_var = ctk.StringVar(value="Keine Datei gewählt")
        self._pfad_lbl = ctk.CTkLabel(
            row, textvariable=self._pfad_var,
            font=ctk.CTkFont(family="Consolas", size=11),
            text_color=t.TEXT_MEDIUM, anchor="w",
            fg_color="#f1f5f9", corner_radius=4,
            padx=10, pady=8,
        )
        self._pfad_lbl.pack(side="left", fill="x", expand=True,
                              padx=(0, t.PAD_M))

        b_pick = ctk.CTkButton(
            row, text="📂  Datei wählen…",
            command=self._datei_picker,
            fg_color=t.PRIMARY, hover_color=t.PRIMARY_LIGHT,
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=13, weight="bold"),
            height=36, width=160,
        )
        b_pick.pack(side="left", padx=(0, t.PAD_S))

        self._b_imp = ctk.CTkButton(
            row, text="📥  Importieren",
            command=self._import_starten,
            fg_color=t.ACCENT, hover_color=t.ACCENT_DARK,
            text_color=t.PRIMARY,
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=13, weight="bold"),
            height=36, width=160,
            state="disabled",
        )
        self._b_imp.pack(side="left")

        self._datei_pfad: Path | None = None

        # Diagnose-Karte
        self._diag_card = Card(self, "Import-Diagnose")
        self._diag_card.pack(fill="both", expand=True)
        self._diag_lbl = ctk.CTkLabel(
            self._diag_card.body,
            text="Noch keine Datei importiert.",
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=12),
            text_color=t.TEXT_MEDIUM, anchor="nw", justify="left",
        )
        self._diag_lbl.pack(fill="both", expand=True, anchor="nw")

    def _datei_picker(self) -> None:
        pfad = filedialog.askopenfilename(
            title="Excel-Datei wählen",
            filetypes=[("Excel", "*.xlsx *.xls"), ("Alle", "*.*")],
        )
        if not pfad:
            return
        self._datei_pfad = Path(pfad)
        self._pfad_var.set(str(self._datei_pfad))
        self._b_imp.configure(state="normal")

    def _import_starten(self) -> None:
        if not self._datei_pfad:
            return
        try:
            import engines
            with open(self._datei_pfad, "rb") as f:
                roh = f.read()
            dat = engines.import_excel.importiere(io.BytesIO(roh))
        except Exception as exc:
            self._diag_lbl.configure(
                text=f"⚠ Fehler beim Import:\n{exc}",
                text_color=t.RED,
            )
            return

        self.state.import_dat = dat
        self.state.import_datei_name = self._datei_pfad.name

        # Verlauf-Eintrag
        try:
            import engines
            engines.import_verlauf.neuer_eintrag(
                datei_pfad=str(self._datei_pfad), ergebnis=dat,
                datei_bytes=roh,
            )
            engines.auftraege.upsert_aus_excel(dat.get("mit_mass", []))
        except Exception:
            pass

        # Diagnose
        mit_n = len(dat.get("mit_mass", []))
        ohne_n = len(dat.get("ohne_mass", []))
        pal_summe = dat.get("paletten_gesamt", 0) or sum(
            p["anzahl"] for p in dat.get("mit_mass", []))
        unique = dat.get("unique_normalisierte_masse", 0)
        header = dat.get("header_zeile", "?")
        text = (
            f"✓ Datei importiert: {self._datei_pfad.name}\n\n"
            f"  Header in Datei-Zeile:  {header}\n"
            f"  Datenzeilen:            {dat.get('datenzeilen_gesamt', mit_n + ohne_n)}\n"
            f"  Aufträge mit Maß:       {mit_n}\n"
            f"  Aufträge ohne Maß:      {ohne_n}\n"
            f"  Paletten gesamt:        {pal_summe}\n"
            f"  Unique normalisiert:    {unique}\n\n"
            f"  → Jetzt im Tab 'Optimierung' Parameter setzen und Optimierung starten."
        )
        self._diag_lbl.configure(text=text, text_color=t.TEXT_DARK)
