# Shamoun — PV*SOL-Validierungsreport

- Klimaquelle: **fallback (Offline-Synthese, NRW-Klimamittel)**
- ⚠ **Offline-Synthese benutzt** — PVGIS nicht erreichbar. Klima-abhängige KPIs (spez. Ertrag, Erträge) sind nur indikativ; auch Eigenverbrauch/Autarkie hängen über die stündliche Erzeugungsform am Klima. Belastbar nur online.
- Anlage: 15.30 kWp, 34 Module


## Ertrag / Generator

| KPI | Soll | Ist | Abw. | Status |
|---|---:|---:|---:|:--:|
| Spez. Jahresertrag | 933.84 kWh/kWp | 856.4 kWh/kWp | -8.3% | FAIL |
| Performance Ratio | 91.09 % | 91.73 % | +0.7% | PASS |
| Ertragsminderung Schatten | 2.9 % | 2.9 % | +0.0% | PASS |
| PV-Energie AC m. Batterie | 13944 kWh | 12926 kWh | -7.3% | FAIL |
| Netzeinspeisung | 10063 kWh | 8838.3 kWh | -12.2% | FAIL |

## Eigenverbrauch / Autarkie (Dispatch)

| KPI | Soll | Ist | Abw. | Status |
|---|---:|---:|---:|:--:|
| Eigenverbrauch gesamt | 3881 kWh | 4087.7 kWh | +5.3% | PASS |
| Eigenverbrauchsanteil | 27.8 % | 31.2 % | +12.2% | PASS |
| Autarkiegrad | 86.1 % | 90.7 % | +5.3% | PASS |
| Netzbezug (Deckung) | 625 kWh | 418.3 kWh | -33.1% | PASS |
| Vermiedene CO₂ | 5223 kg | 4980 kg | -4.7% | PASS |

## Batterie-Detail

| KPI | Soll | Ist | Abw. | Status |
|---|---:|---:|---:|:--:|
| Batterieladung (PV) | 2516 kWh | 2210.6 kWh | -12.1% | FAIL |
| Batterie→Verbrauch | 2166 kWh | 2033.8 kWh | -6.1% | PASS |
| Batterie→Netz | 170 kWh | 0 kWh | — | ℹ︎ |
| Verluste Laden/Entladen | 159 kWh | 176.9 kWh | — | ℹ︎ |
| Zyklen/Jahr (Vollzyklen) | 0 /a | 147.4 /a | — | ℹ︎ |

## Diagnose

- **PR (klima-unabhängig)** trifft den Sollwert → der Verluststack/das Temperatur-/DC-/AC-Modell ist plausibel. *Nicht* nachträglich getunt.
- **Klima-abhängige KPIs** (spez. Ertrag, AC-Energie, Einspeisung, Batterieladung) weichen ab, solange Offline-Synthese statt echtem PVGIS läuft — das ist eine Daten-, keine Modellfrage. Online erneut prüfen.
- **Eigenverbrauch/Autarkie** liegen über dem Soll. Erwartete Richtung: das **H0-Standardprofil** (kein reales Messprofil) und die **1h-Auflösung** überschätzen den zeitlichen Match systematisch. Bewusst **nur directional** geprüft, nicht auf den Sollwert getunt.
- **Dispatch-Logik korrekt:** Energiebilanz schließt exakt (Erzeugung 13102.9 = Eigenverbr 4087.7 + Einspeisung 8838.3 + Batt-Verluste 176.9; Last = Eigenverbr + Netzbezug 418.3).
- **Batterie→Netz = 0:** reine Eigenverbrauchsstrategie bei 1h-Auflösung. Der Soll-Wert (170 kWh) stammt aus Sub-Stunden-Dynamik bzw. EMS-Strategie. Eine optionale Batterie→Netz-Entladung ist als Capability vorhanden (`BatterySpec.allow_grid_discharge`), wird hier aber NICHT zur Kalibrierung benutzt.
- **Zyklen/Jahr:** ~147.4 Vollzyklen/a (≈ 0.40/Tag) — plausibel. Der PV*SOL-Wert „3,0 %“ ist eine andere Metrik (Einheit klären).
