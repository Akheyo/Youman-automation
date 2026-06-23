# Shamoun — PV*SOL-Validierungsreport

- Klimaquelle: **fallback (Offline-Synthese, NRW-Klimamittel)**
- ⚠ **Offline-Synthese benutzt** — PVGIS nicht erreichbar. Klima-abhängige KPIs nur indikativ. Belastbar nur online.
- Anlage: 15.30 kWp, 34 Module


## Ertrag / Generator

| KPI | Soll | Ist | Abw. | Tol. | Gate | Status |
|---|---:|---:|---:|:--:|:--:|:--:|
| Spez. Jahresertrag | 933.84 kWh/kWp | 856.4 kWh/kWp | -8.3% | ±5% | 🔒 | FAIL |
| Performance Ratio | 91.09 % | 91.73 % | +0.7% | ±2pp | 🔒 | PASS |
| Ertragsminderung Schatten | 2.9 % | 2.9 % | +0.0% | ±0.1% |  | PASS |
| PV-Energie AC m. Batterie | 13944 kWh | 12926 kWh | -7.3% | ±5% | 🔒 | FAIL |
| Netzeinspeisung | 10063 kWh | 8838.3 kWh | -12.2% | ±5% | 🔒 | FAIL |

## Eigenverbrauch / Autarkie (directional)

| KPI | Soll | Ist | Abw. | Tol. | Gate | Status |
|---|---:|---:|---:|:--:|:--:|:--:|
| Eigenverbrauch gesamt | 3881 kWh | 4087.7 kWh | +5.3% | ±8% |  | PASS |
| Eigenverbrauchsanteil | 27.8 % | 31.2 % | +12.2% | ±8pp |  | PASS |
| Autarkiegrad | 86.1 % | 90.7 % | +5.3% | ±8pp |  | PASS |
| Netzbezug (Deckung) | 625 kWh | 418.3 kWh | -33.1% | ±50% |  | PASS |
| Vermiedene CO₂ | 5223 kg | 4980 kg | -4.7% | ±10% |  | PASS |

## Batterie-Detail (directional)

| KPI | Soll | Ist | Abw. | Tol. | Gate | Status |
|---|---:|---:|---:|:--:|:--:|:--:|
| Batterieladung (PV) | 2516 kWh | 2210.6 kWh | -12.1% | ±10% |  | FAIL |
| Batterie→Verbrauch | 2166 kWh | 2033.8 kWh | -6.1% | ±10% |  | PASS |
| Batterie→Netz | 170 kWh | 0 kWh | — | — |  | ℹ︎ |
| Verluste Laden/Entladen | 159 kWh | 176.9 kWh | — | — |  | ℹ︎ |
| Zyklenbelastung | 3 % | 2.67 % | -11.0% | ±1.5pp |  | PASS |
| Zyklen/Jahr (Vollzyklen) | 0 /a | 160.2 /a | — | — |  | ℹ︎ |

## Diagnose

- **PR (klima-unabhängig)** ist das Maß für den Verlust-/Temp-/DC-/AC-Stack → Ist 91.73 % vs Soll 91,09 %. *Nicht* getunt.
- **Klima-abhängige Gate-KPIs** (spez. Ertrag, AC-Energie, Einspeisung): offline indikativ — online erneut prüfen.
- **Eigenverbrauch/Autarkie** (directional): H0-Standardprofil (kein reales Messprofil) + 1h-Auflösung überschätzen den zeitlichen Match systematisch. Bewusst nicht auf den Sollwert getunt.
- **Dispatch-Energiebilanz:** schließt exakt ✅ (Erzeugung 13102.9 = Eigenverbr 4087.7 + Einspeisung 8838.3 + Batt-Verluste 176.9).
- **Batterie→Netz:** reine Eigenverbrauchsstrategie ⇒ 0 bei 1h. Optionale Capability `BatterySpec.allow_grid_discharge` vorhanden, NICHT zur Kalibrierung benutzt.
- **Zyklenbelastung:** 2.67 % (= 160.2 Vollzyklen/a ÷ 6000 rated) vs PV*SOL 3,0 %. Definition jetzt angeglichen (Ladedurchsatz/Kapazität ÷ rated_cycles).
