"""Dashboard-Tab: 4 KPIs + Schnellzugriffs-Buttons + Top-5-Optimierungen."""
from __future__ import annotations

import customtkinter as ctk

import theme as t
from widgets import KpiCard, Card
from state import get_state


class DashboardTab(ctk.CTkFrame):
    def __init__(self, parent, app):
        super().__init__(parent, fg_color=t.BG_MAIN)
        self.app = app
        self.state = get_state()
        self._build()

    def _build(self) -> None:
        # KPI-Reihe
        kpi_row = ctk.CTkFrame(self, fg_color="transparent")
        kpi_row.pack(fill="x", pady=(0, t.PAD_L))
        for i in range(4):
            kpi_row.grid_columnconfigure(i, weight=1, uniform="kpi")

        self.kpi_offen = KpiCard(kpi_row, "Offene Aufträge",
                                    wert="—", delta="")
        self.kpi_offen.grid(row=0, column=0, sticky="nsew", padx=(0, t.PAD_S))

        self.kpi_kat = KpiCard(kpi_row, "Paletten im Katalog",
                                  wert="—", delta="")
        self.kpi_kat.grid(row=0, column=1, sticky="nsew",
                           padx=t.PAD_S)

        self.kpi_opt = KpiCard(kpi_row, "Letzte Optimierung",
                                  wert="—", delta="")
        self.kpi_opt.grid(row=0, column=2, sticky="nsew", padx=t.PAD_S)

        self.kpi_best = KpiCard(kpi_row, "Gesamtbestand",
                                   wert="—", delta="Stk")
        self.kpi_best.grid(row=0, column=3, sticky="nsew",
                            padx=(t.PAD_S, 0))

        # Schnellzugriff
        sz = Card(self, "Schnellzugriff")
        sz.pack(fill="x", pady=(0, t.PAD_L))

        btn_row = ctk.CTkFrame(sz.body, fg_color="transparent")
        btn_row.pack(fill="x")
        for i in range(3):
            btn_row.grid_columnconfigure(i, weight=1, uniform="b")

        b_imp = ctk.CTkButton(
            btn_row, text="📥  Excel importieren",
            command=lambda: self.app.zeige_tab("Datenimport"),
            fg_color=t.PRIMARY, hover_color=t.PRIMARY_LIGHT,
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=14, weight="bold"),
            height=44,
        )
        b_imp.grid(row=0, column=0, sticky="ew", padx=(0, t.PAD_S))

        b_opt = ctk.CTkButton(
            btn_row, text="↻  Optimierung starten",
            command=lambda: self.app.zeige_tab("Optimierung"),
            fg_color=t.ACCENT, hover_color=t.ACCENT_DARK,
            text_color=t.PRIMARY,
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=14, weight="bold"),
            height=44,
        )
        b_opt.grid(row=0, column=1, sticky="ew", padx=t.PAD_S)

        b_neu = ctk.CTkButton(
            btn_row, text="➕  Auftrag manuell anlegen",
            command=lambda: self.app.zeige_tab("Aufträge"),
            fg_color=t.BG_MAIN, hover_color="#e2e8f0",
            text_color=t.PRIMARY,
            border_width=1, border_color=t.BORDER_MEDIUM,
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=14, weight="bold"),
            height=44,
        )
        b_neu.grid(row=0, column=2, sticky="ew", padx=(t.PAD_S, 0))

        # Letzte 5 Optimierungen
        letzte = Card(self, "Letzte 5 Optimierungen")
        letzte.pack(fill="both", expand=True)
        self._opt_list = ctk.CTkLabel(
            letzte.body,
            text="Noch keine Optimierungen — Excel importieren und "
                 "Optimierung starten.",
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=12),
            text_color=t.TEXT_MEDIUM, anchor="w", justify="left",
        )
        self._opt_list.pack(fill="x", anchor="w")

    def on_show(self) -> None:
        """Live-Refresh KPIs + Liste."""
        try:
            import engines
            # Offene Auftraege
            auf_stats = engines.auftraege.stats()
            self.kpi_offen.set_wert(str(auf_stats.get("offen", 0)))
            self.kpi_offen.set_delta(
                f"{auf_stats.get('in_arbeit', 0)} in Arbeit"
            )
            # Katalog
            kat_alle = engines.katalog.alle()
            self.kpi_kat.set_wert(str(len(kat_alle)))
            self.kpi_kat.set_delta(
                f"{sum(1 for e in kat_alle if e.get('auto_standard'))} "
                f"Auto-Standards"
            )
            sum_best = sum(int(e.get("bestand", 0) or 0) for e in kat_alle)
            self.kpi_best.set_wert(str(sum_best))
            # Letzte Optimierung
            v = engines.import_verlauf.alle()
            opt_v = [e for e in v if e.get("optimierung")]
            if opt_v:
                opt = opt_v[0]["optimierung"]
                datum = (opt_v[0].get("datum", "") or "")[:10]
                self.kpi_opt.set_wert(f"{opt.get('standards', 0)} Std")
                self.kpi_opt.set_delta(datum)
                # Liste
                zeilen = []
                for e in opt_v[:5]:
                    o = e["optimierung"]
                    zeilen.append(
                        f"  · {(e.get('datum') or '')[:16].replace('T', ' ')}  "
                        f"{(e.get('datei_name', '') or '—')[:30]:30s}  "
                        f"Std: {o.get('standards', 0):>3}  "
                        f"Son: {o.get('sonder', 0):>3}  "
                        f"Σ: {o.get('gesamt', 0):>3}"
                    )
                self._opt_list.configure(text="\n".join(zeilen))
            else:
                self.kpi_opt.set_wert("—")
                self.kpi_opt.set_delta("")
        except Exception as exc:
            # KPIs sind nice-to-have, App nicht crashen
            self.kpi_offen.set_delta(f"err: {exc}")
