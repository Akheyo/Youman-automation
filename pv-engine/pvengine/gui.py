"""Desktop-Oberfläche der PV-Planungs-Engine (Tkinter).

Eine „richtige" Software zum Anklicken: Fenster öffnen, Werte eintragen,
„Berechnen", Kennzahlen ablesen und PDF-Report speichern. Nutzt den
vorhandenen Rechenkern (pvlib) unverändert.

- Rechenlogik (`build_project`, `compute`, `format_results`) ist GUI-frei und
  damit auch ohne tkinter testbar.
- tkinter wird erst in `main()` / der App-Klasse importiert (Windows: mitgeliefert).

Start (mit Python):   python -m pvengine.gui
Als Windows-Programm:  PV-Planungs-Engine.exe (per CI gebaut, s. README)
"""
from __future__ import annotations

import os
import queue
import sys
import threading
from pathlib import Path

from .models import (
    BatterySpec,
    ConsumptionInput,
    EconomicsInput,
    InverterSpec,
    Location,
    ModuleSpec,
    ProjectInput,
    RoofPlane,
)
from .pipeline import run
from .report import render_pdf

APP_TITLE = "PV-Planungs-Engine"


# --------------------------------------------------------------------------
# GUI-freie Rechenlogik (testbar ohne tkinter)
# --------------------------------------------------------------------------
def build_project(v: dict) -> ProjectInput:
    """Baut ein ProjectInput aus den Formularwerten (Strings/Zahlen)."""
    def f(key, default=0.0):
        val = v.get(key, "")
        if val is None or str(val).strip() == "":
            return default
        return float(str(val).replace(",", "."))

    module_count = None
    if str(v.get("module_count", "")).strip():
        module_count = int(float(str(v["module_count"]).replace(",", ".")))

    roof = RoofPlane(
        tilt_deg=f("tilt", 35),
        azimuth_deg=f("azimuth", 180),
        area_m2=(f("area") or None) if not module_count else None,
        module_count=module_count,
    )
    return ProjectInput(
        project_name=str(v.get("project_name") or "PV-Anlage"),
        customer_name=str(v.get("customer_name") or ""),
        location=Location(
            address=str(v.get("address") or ""),
            latitude=f("lat", 51.84),
            longitude=f("lon", 6.86),
        ),
        roofs=[roof],
        module=ModuleSpec(pmpp_wp=f("module_wp", 440)),
        inverter=InverterSpec(pac_nom_w=f("inverter_kw", 8) * 1000),
        battery=BatterySpec(capacity_kwh=f("battery_kwh", 0)),
        consumption=ConsumptionInput(annual_kwh=f("consumption", 4500)),
        economics=EconomicsInput(electricity_price_ct_kwh=f("price", 35)),
        shading_loss_pct=f("shading", 2.9),
    )


def compute(v: dict, allow_network: bool):
    project = build_project(v)
    return run(project, allow_network=allow_network)


def format_results(res) -> str:
    s, e, lay = res.simulation, res.economics, res.layout
    de = lambda x: f"{x:,.0f}".replace(",", ".")  # noqa: E731
    lines = [
        f"Anlagenleistung:      {lay.kwp:.2f} kWp  ({lay.total_modules} Module)",
        f"Jahresertrag:         {de(s.annual_yield_kwh)} kWh",
        f"Spez. Ertrag:         {s.specific_yield_kwh_per_kwp:.0f} kWh/kWp",
        f"Performance Ratio:    {s.performance_ratio:.1f} %",
        f"Eigenverbrauch:       {s.self_consumption_pct:.0f} %",
        f"Autarkiegrad:         {s.autarky_pct:.0f} %",
        f"CO₂-Einsparung:       {s.co2_savings_t:.2f} t/Jahr",
        "",
        f"Investition:          {de(e.capex_eur)} €",
        f"Amortisation:         {e.payback_years} Jahre"
        if e.payback_years else "Amortisation:         > Laufzeit",
        f"Gewinn ({len(e.cashflow)} J):        {de(e.total_profit_20y_eur)} €",
        f"Rendite (ROI):        {e.roi_pct:.0f} %",
        f"Stromgestehungskosten:{e.lcoe_ct_kwh:.1f} ct/kWh",
        f"EEG-Vergütung:        {e.feed_in_ct_kwh:.2f} ct/kWh",
        "",
        f"Klimaquelle:          {s.climate_source}",
    ]
    return "\n".join(lines)


# --------------------------------------------------------------------------
# Tkinter-Oberfläche
# --------------------------------------------------------------------------
# (Felder: Schlüssel, Label, Default, Hinweis)
FIELDS = [
    ("project_name", "Projektname", "PV-Anlage", ""),
    ("customer_name", "Kunde", "", ""),
    ("address", "Adresse (optional, online)", "", "für PVGIS/Geocoding"),
    ("lat", "Breitengrad", "51.84", ""),
    ("lon", "Längengrad", "6.86", ""),
    ("tilt", "Dachneigung (°)", "35", "0=flach … 90=senkrecht"),
    ("azimuth", "Ausrichtung (°)", "180", "0=N 90=O 180=S 270=W"),
    ("area", "Dachfläche (m²)", "60", "leer lassen wenn Modulanzahl"),
    ("module_count", "Modulanzahl (optional)", "", "überschreibt Fläche"),
    ("module_wp", "Modulleistung (Wp)", "440", ""),
    ("inverter_kw", "Wechselrichter (kW)", "8", ""),
    ("battery_kwh", "Speicher (kWh)", "0", "0 = kein Speicher"),
    ("consumption", "Jahresverbrauch (kWh)", "4500", ""),
    ("price", "Strompreis (ct/kWh)", "35", ""),
    ("shading", "Verschattung (%)", "2.9", ""),
]


class PVEngineApp:
    def __init__(self, root):
        import tkinter as tk
        from tkinter import filedialog, messagebox, ttk

        self.tk = tk
        self.ttk = ttk
        self.filedialog = filedialog
        self.messagebox = messagebox
        self.root = root
        self._queue: queue.Queue = queue.Queue()
        self._last_result = None
        self.entries: dict = {}

        root.title(APP_TITLE)
        root.geometry("820x620")
        root.minsize(720, 560)

        main = ttk.Frame(root, padding=12)
        main.pack(fill="both", expand=True)
        main.columnconfigure(0, weight=0)
        main.columnconfigure(1, weight=1)
        main.rowconfigure(0, weight=1)

        # Eingaben links
        form = ttk.LabelFrame(main, text="Eingaben", padding=10)
        form.grid(row=0, column=0, sticky="nsw", padx=(0, 12))
        for i, (key, label, default, hint) in enumerate(FIELDS):
            ttk.Label(form, text=label).grid(row=i, column=0, sticky="w", pady=2)
            ent = ttk.Entry(form, width=16)
            ent.insert(0, default)
            ent.grid(row=i, column=1, sticky="ew", pady=2, padx=(8, 4))
            self.entries[key] = ent
            if hint:
                ttk.Label(form, text=hint, foreground="#888").grid(
                    row=i, column=2, sticky="w")

        self.online_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(form, text="PVGIS online nutzen (Internet)",
                        variable=self.online_var).grid(
            row=len(FIELDS), column=0, columnspan=3, sticky="w", pady=(8, 4))

        btns = ttk.Frame(form)
        btns.grid(row=len(FIELDS) + 1, column=0, columnspan=3, sticky="ew", pady=(6, 0))
        self.calc_btn = ttk.Button(btns, text="Berechnen", command=self.on_calc)
        self.calc_btn.pack(side="left")
        self.pdf_btn = ttk.Button(btns, text="PDF-Report speichern …",
                                  command=self.on_save_pdf, state="disabled")
        self.pdf_btn.pack(side="left", padx=8)

        # Ergebnisse rechts
        right = ttk.Frame(main)
        right.grid(row=0, column=1, sticky="nsew")
        right.rowconfigure(1, weight=1)
        right.columnconfigure(0, weight=1)
        ttk.Label(right, text="Ergebnis", font=("Segoe UI", 11, "bold")).grid(
            row=0, column=0, sticky="w")
        self.result = tk.Text(right, wrap="word", font=("Consolas", 11),
                              height=20, relief="solid", borderwidth=1)
        self.result.grid(row=1, column=0, sticky="nsew", pady=(4, 0))
        self.result.insert("1.0", "Werte eingeben und auf „Berechnen“ klicken.\n\n"
                           "Tipp: Offline rechnet die App mit synthetischem "
                           "NRW-Klima. Für echte Standortdaten „PVGIS online“ "
                           "aktivieren (Internet nötig).")
        self.result.configure(state="disabled")

        self.status = ttk.Label(root, text="Bereit", relief="sunken", anchor="w")
        self.status.pack(fill="x", side="bottom")

    # --- Aktionen ---
    def _set_status(self, text):
        self.status.configure(text=text)

    def _set_result(self, text):
        self.result.configure(state="normal")
        self.result.delete("1.0", "end")
        self.result.insert("1.0", text)
        self.result.configure(state="disabled")

    def _values(self) -> dict:
        return {k: e.get() for k, e in self.entries.items()}

    def on_calc(self):
        self.calc_btn.configure(state="disabled")
        self.pdf_btn.configure(state="disabled")
        self._set_status("Berechne … (kann ein paar Sekunden dauern)")
        values = self._values()
        online = self.online_var.get()

        def worker():
            try:
                res = compute(values, allow_network=online)
                self._queue.put(("ok", res))
            except Exception as exc:  # noqa: BLE001
                self._queue.put(("err", exc))

        threading.Thread(target=worker, daemon=True).start()
        self.root.after(100, self._poll)

    def _poll(self):
        try:
            kind, payload = self._queue.get_nowait()
        except queue.Empty:
            self.root.after(100, self._poll)
            return
        self.calc_btn.configure(state="normal")
        if kind == "err":
            self._set_status("Fehler bei der Berechnung")
            self.messagebox.showerror("Fehler", f"Berechnung fehlgeschlagen:\n{payload}")
            return
        self._last_result = payload
        self._set_result(format_results(payload))
        self.pdf_btn.configure(state="normal")
        src = payload.simulation.climate_source
        self._set_status("Fertig" + ("  (Offline-Synthese)" if src.startswith("fallback") else "  (PVGIS online)"))

    def on_save_pdf(self):
        if self._last_result is None:
            return
        name = (self._last_result.input.project_name or "pv-report").replace(" ", "_")
        path = self.filedialog.asksaveasfilename(
            defaultextension=".pdf", initialfile=f"{name}.pdf",
            filetypes=[("PDF-Datei", "*.pdf"), ("HTML-Datei", "*.html")])
        if not path:
            return
        self._set_status("Erzeuge Report …")
        try:
            out = render_pdf(self._last_result, path)
        except Exception as exc:  # noqa: BLE001
            self.messagebox.showerror("Fehler", f"Report konnte nicht erstellt werden:\n{exc}")
            self._set_status("Fehler beim Report")
            return
        self._set_status(f"Report gespeichert: {out}")
        if self.messagebox.askyesno("Fertig", f"Report gespeichert:\n{out}\n\nJetzt öffnen?"):
            _open_file(out)


def _open_file(path: Path):
    path = str(path)
    try:
        if sys.platform.startswith("win"):
            os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            os.system(f'open "{path}"')
        else:
            import webbrowser
            webbrowser.open(f"file://{path}")
    except Exception:  # noqa: BLE001
        pass


def _selftest() -> int:
    """Prüft den (ggf. gefrorenen) Bundle: rechnet offline + erzeugt Report.

    Fängt fehlende pvlib-Datendateien/Templates im .exe-Build ab. Schreibt das
    Ergebnis in eine Marker-Datei (im --windowed-Bundle ist stdout/stderr None),
    Exit-Code 0/1 signalisiert Erfolg.
    """
    import tempfile
    import traceback

    marker = Path(tempfile.gettempdir()) / "pvengine_selftest.txt"
    try:
        v = {"tilt": "35", "azimuth": "180", "area": "60", "battery_kwh": "10"}
        res = compute(v, allow_network=False)
        assert res.layout.kwp > 0, "Layout leer"
        assert res.simulation.annual_yield_kwh > 0, "kein Ertrag"
        out = Path(tempfile.gettempdir()) / "pvengine_selftest_report.pdf"
        render_pdf(res, out)
        marker.write_text(
            f"OK {res.simulation.specific_yield_kwh_per_kwp} kWh/kWp\n",
            encoding="utf-8",
        )
        return 0
    except Exception:  # noqa: BLE001
        try:
            marker.write_text("FAIL\n" + traceback.format_exc(), encoding="utf-8")
        except Exception:  # noqa: BLE001
            pass
        return 1


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if "--selftest" in argv:
        return _selftest()

    import tkinter as tk

    root = tk.Tk()
    try:
        from tkinter import ttk
        ttk.Style().theme_use("clam")
    except Exception:  # noqa: BLE001
        pass
    PVEngineApp(root)
    root.mainloop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
