# PV-Planungs-Engine

Eigene Software, die den PV\*SOL-Report (Ertragsprognose, Wirtschaftlichkeit,
Modulbelegung, Stückliste) **selbst erzeugt** — ohne Fremdsoftware zu wrappen.
Simulationskern auf Basis von [pvlib](https://pvlib-python.readthedocs.io/),
REST-API mit FastAPI, Report als HTML→PDF (WeasyPrint).

Umgesetzt nach dem internen Architektur-Plan (`PVEngineArchitektur.md`). Der
Output gehört vollständig dir, beliebig viele Kunden parallel.

> Liegt bewusst als **eigenständiges Python-Projekt** neben dem Next.js-Sales-Tool
> (`Youman-automation`) und ist davon technisch entkoppelt.

---

## Schnellstart

```bash
cd pv-engine
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # + optional: pip install weasyprint

# CLI — Offline (synthetisches NRW-Klima, ohne Internet)
python -m pvengine.cli --offline --area 60 --consumption 4500 --battery 10 \
    --pdf output/report.pdf

# CLI — Online (echte PVGIS-Klimadaten + Geocoding)
python -m pvengine.cli --address "Mölndalstraße 8, 46325 Borken" \
    --tilt 35 --azimuth 180 --area 60 --consumption 4500 --pdf output/report.pdf

# Aus JSON-Projektdatei
python -m pvengine.cli --json examples/projekt_borken.json --pdf output/report.pdf

# REST-API
uvicorn pvengine.api:app --reload      # http://localhost:8000/docs
```

In Python:

```python
from pvengine import ProjectInput, run_and_report
from pvengine.models import RoofPlane, ConsumptionInput, BatterySpec

project = ProjectInput(
    roofs=[RoofPlane(tilt_deg=35, azimuth_deg=180, area_m2=60)],
    consumption=ConsumptionInput(annual_kwh=4500),
    battery=BatterySpec(capacity_kwh=10),
)
result, pdf_path = run_and_report(project, "output/report.pdf")
print(result.simulation.specific_yield_kwh_per_kwp, result.economics.payback_years)
```

---

## Architektur — modulare Pipeline

```
Adresse/Dach  ──►  Geometrie  ──►  Modul-Layout  ──►  E-Auslegung
                                                          │
Klimadaten ───────────────────────────►  SIMULATION  ◄────┘
Lastprofil ───────────────────────────►  (pvlib)
                                              │
                                              ▼
                                        Wirtschaftlichkeit  ──►  Report (PDF)
```

Jede Report-Seite = eine Komponente, einzeln testbar.

| Komp. | Datei | Aufgabe (Report-Seiten) | Status |
|---|---|---|---|
| A Geometrie | `geometry.py` | Standort/Geocoding, Dachflächen, Polygon→Fläche (S. 6–8, 20–22) | ✅ |
| B Modul-Layout | `layout.py` | Modulanzahl + Belegung pro Dach, Stückliste (S. 20–22, 26) | ✅ (Rechteck-Packing) |
| C E-Auslegung | `electrical.py` | String-Sizing, WR-Verschaltung, DC/AC (S. 9, 23–25) | ✅ |
| D Simulation | `simulation.py` | pvlib: Sonnenstand, Hay&Davies, Temperatur, DC/AC, Batterie (S. 3, 11–14) | ✅ |
| E Lastprofil | `loadprofile.py` | BDEW-H0 + E-Auto/Wärmepumpe (S. 5) | ✅ |
| F Wirtschaftlichkeit | `economics.py` | EEG, 20-J-Cashflow, LCOE, IRR, Amortisation (S. 4, 15–17) | ✅ |
| G 3D / Shading | — | 3D-Dach, Nahverschattung, Horizont (S. 2, 9) | 🔲 Phase 4 (Three.js, separat) |
| H Report | `report.py` + `templates/report.html` | HTML→PDF im PV\*SOL-Look | ✅ |

Unterstützende Module: `climate.py` (PVGIS-TMY + Offline-Fallback),
`battery.py` (Dispatch), `charts.py` (matplotlib), `config.py` (Konstanten/EEG),
`models.py` (Pydantic-Datenverträge), `pipeline.py` (Orchestrator),
`api.py` (FastAPI), `cli.py` (Kommandozeile).

---

## Datenquellen

| Was | Quelle | Status |
|---|---|---|
| Klima/Einstrahlung (TMY) | PVGIS-API (EU JRC) | ✅ online, Offline-Fallback eingebaut |
| Geocoding | Nominatim (OSM) | ✅ online |
| Dachgeometrie (auto) | LoD2/LiDAR / Google Solar | 🔲 Schnittstelle `RoofPlane.polygon` vorbereitet (Phase 4) |
| Modul-/WR-Datenbank | manuell (`ModuleSpec`/`InverterSpec`) | ✅ |

**Offline-Fallback:** Ist PVGIS nicht erreichbar (z. B. Firewall), erzeugt
`climate.py` einen deterministischen, physikalisch plausiblen TMY aus
pvlib-Clear-Sky + monatlichen NRW-Einstrahlungs-/Diffus-/Temperaturmitteln.
Er ist im Report **klar als Fallback gekennzeichnet** und nie für belastbare
Angebote gedacht.

---

## Phasenplan (aus dem Architektur-Plan)

- **Phase 1 — Verkaufbarer Kern** ✅ Dach manuell → pvlib-Ertrag → Wirtschaftlichkeit → PDF
- **Phase 2 — Eigenverbrauch & Batterie** ✅ Lastprofil + Batterie-Dispatch → Autarkie/Deckung
- **Phase 3 — Modul-Layout & Stückliste** ✅ Auto-Belegung (Rechteck), Modulanzahl je Dach
- **Phase 4 — 3D & Nahverschattung** 🔲 Three.js/SolarScope, Horizontprofil (Schnittstelle `RoofPlane.horizon` da)
- **Phase 5 — Volle Report-Parität** 🟡 Schalt-/Strangplan-Grafiken offen; Kennzahlen/Tabellen vorhanden

---

## Tests & Kalibrierung

```bash
pip install pytest
python -m pytest                          # 20 Tests, deterministisch, offline
python examples/shamoun_calibration.py --offline   # Abgleich gegen Referenz-Report
```

Kalibrierung gegen den Shamoun-PV\*SOL-Report (Zielwerte: spez. Ertrag
933,84 kWh/kWp, PR 91,09 %, Verschattung 2,9 %). Offline-Synthese erreicht
PR 91,7 % (+0,7 %) und spez. Ertrag ~973 kWh/kWp; die exakte Ertrags­kalibrierung
läuft **online** über echte PVGIS-Daten. Der Verluststack ist in `config.py`
zentral konfigurierbar.

---

## Knackpunkte (ehrlich, aus dem Plan)

- **Validierung:** Diese Zahlen sind nicht zertifiziert (anders als PV\*SOL für
  GEG/Förderanträge). Für interne Verkaufsangebote ok — der Report weist das aus.
- **EEG-Sätze** sind in `config.py` **datiert** hinterlegt (`EEG_FEED_IN_RATES`),
  nie undatiert hartkodiert. Bei Gesetzesänderung dort eine Stützstelle ergänzen.
- **3D-Shading** ist der eigentliche Aufwand (Phase 4) — die Engine nimmt heute
  eine Verschattungs-Pauschale (`shading_loss_pct`) bzw. ein Horizontprofil entgegen.
- **Genauigkeit:** mit `examples/shamoun_calibration.py` gegen echte Reports
  gegenrechnen, Verluststack in `config.py` nachziehen.

## Lizenz

Proprietär (Youman / A&B Solarenergy).
