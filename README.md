# DAEV Margin Tool

Lokales Web-Tool für DAEV Autoservice. Erfasst pro Fahrzeug Einkauf, Kosten,
Arbeitsstunden und Verkauf — und berechnet **Gewinnanteil und Marge unter
Berücksichtigung der Differenzbesteuerung (§25a UStG)**.

## Features

- **Fahrzeug-Verwaltung**: Stammdaten + Notizen
- **Differenzbesteuerung-Logik**: MwSt fällt nur auf den Bruttogewinn an, nicht
  auf den vollen Verkaufspreis
- **Alle Werte aus dem Original-Sheet sichtbar**: EK, VK, Bruttogewinn,
  Steuer-Faktor 119 %, MwSt-Anteil in €, Nettogewinn, jede Kostenkategorie
  einzeln (Transport, Reparatur, Service, Ersatzteil, Aufbereitung, Anzeige,
  Gebühren, Sonstiges), Arbeitsstunden, Gewinnanteil in € und Marge in %
- **Kostenpositionen** in 8 Kategorien
- **Arbeitsstunden** mit konfigurierbarem Stundensatz
- **Live-Berechnung** in Anlegen/Bearbeiten — Gewinnanteil und Marge
  aktualisieren sich beim Tippen
- **Übersicht** mit Filter (Alle / Im Bestand / Verkauft), Suche und
  Portfolio-Summen
- **Marge-Ampel**: grün ≥ 20 %, gelb 10–20 %, rot < 10 %
- **Deutsches Format**: 1.533,00 € — alle Eingaben akzeptieren beides
  (`1533`, `1533,50`, `1.533,50`)
- **Mobile-tauglich** für die Werkstatt
- **Datenhaltung**: LocalStorage des Browsers — nichts verlässt den Rechner.

## Setup

```bash
npm install
npm run dev
```

Dann <http://localhost:5173> im Browser öffnen. Beim ersten Start fragt die App,
ob der Beispieldatensatz "VW Polo" geladen werden soll.

### Production-Build

```bash
npm run build
npm run preview     # zum lokalen Test des Builds
```

Der Build landet als statische Dateien in `dist/` und kann auf jedem
beliebigen Webserver gehostet werden — kein Backend nötig.

## Tests

```bash
npm test            # einmalig
npm run test:watch  # während der Entwicklung
```

Die Berechnung ist durch Unit-Tests abgesichert. Insbesondere wird der
**VW-Polo-Referenzdatensatz** aus dem Original-Sheet exakt verifiziert:

| Größe                | Wert            |
| -------------------- | --------------- |
| Einkaufspreis (EK)   | 4.750 €         |
| Verkaufspreis (VK)   | 7.500 €         |
| Bruttogewinn         | 2.750 €         |
| Steuer-Faktor        | 119 %           |
| MwSt (19 %)          | 439,08 €        |
| Nettogewinn          | 2.310,92 €      |
| Kostensumme          | 778 €           |
| **Gewinnanteil**     | **1.533 €**     |
| **Marge auf EK**     | **32,27 %**     |

## Berechnungslogik

Aus `src/lib/calculations.ts`:

```ts
const MWST_SATZ = 0.19;

bruttogewinn = verkaufspreis - ankaufspreis;
nettogewinn  = bruttogewinn / (1 + MWST_SATZ);     // §25a UStG
mwstBetrag   = bruttogewinn - nettogewinn;

kostenSumme        = summe(kosten);
arbeitskostenSumme = summe(arbeitsstunden) * stundensatz;

gewinnanteil = nettogewinn - kostenSumme - arbeitskostenSumme;
margePct     = (gewinnanteil / ankaufspreis) * 100;
```

**Achtung**: Diese Logik gilt für Händler, die nach §25a UStG abrechnen. Falls
ein Fahrzeug regelbesteuert verkauft wird, würde sich die Berechnung ändern.

## Projektstruktur

```
src/
├── App.tsx                    # Routing/Shell mit Header und Modals
├── main.tsx                   # React-Entry
├── store.tsx                  # Context-Store + LocalStorage-Sync
├── styles.css                 # Tailwind + Komponenten-Klassen
├── types/index.ts             # Datenmodell (Vehicle, KostenPosition etc.)
├── lib/
│   ├── calculations.ts        # Differenzbesteuerung, Margen, Portfolio-Aggregation
│   ├── calculations.test.ts   # Verifikation inkl. VW-Polo-Beispiel
│   ├── format.ts              # Deutsches Zahlen-/Datumsformat, parseGermanNumber
│   ├── format.test.ts
│   ├── db.ts                  # LocalStorage-Persistenz
│   └── seed.ts                # VW-Polo-Demo-Datensatz
└── components/
    ├── VehicleList.tsx        # Übersichts-Tabelle mit Filtern
    ├── VehicleForm.tsx        # Anlegen/Bearbeiten mit Live-Berechnung
    ├── VehicleDetail.tsx      # Detail-Ansicht
    ├── VerkaufModal.tsx       # "Verkauf erfassen"-Dialog
    ├── KennzahlenPanel.tsx    # Komplette Kalkulation wie im Excel-Sheet
    ├── MoneyInput.tsx         # €-Eingabefeld mit deutscher Formatierung
    └── Dialog.tsx             # Modal-Wrapper
```

## Datensicherheit

- Daten liegen ausschließlich im LocalStorage des verwendeten Browsers.
- **Browser-Cache leeren = Datenverlust**. In den Einstellungen kann der
  Demo-Datensatz nachgeladen oder alle Daten gelöscht werden.

## Lizenz

Privat.
