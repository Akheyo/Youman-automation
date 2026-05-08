import { describe, expect, it } from 'vitest';
import {
  berechneKennzahlen,
  berechnePortfolio,
  margenAmpel,
  summeKosten,
} from './calculations';
import type { Vehicle, KostenPosition } from '@/types';

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'test',
    marke: 'Test',
    modell: 'Test',
    ankaufsdatum: '2025-01-01',
    ankaufspreis: 0,
    kosten: [],
    arbeitsstunden: [],
    stundensatz: 50,
    status: 'im_bestand',
    erstelltAm: '2025-01-01T00:00:00.000Z',
    geaendertAm: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function k(
  kategorie: KostenPosition['kategorie'],
  bezeichnung: string,
  betrag: number,
): KostenPosition {
  return { id: `${kategorie}-${bezeichnung}`, kategorie, bezeichnung, betrag, datum: '2025-01-15' };
}

describe('Differenzbesteuerung — VW Polo Referenzbeispiel', () => {
  // Aus dem Original-Sheet:
  // EK 4.750 €, VK 7.500 €
  // Bruttogewinn 2.750 €, Nettogewinn 2.310,92 € (gerundet 2.311 €)
  // Kosten: 579 + 89 + 50 + 50 + 10 = 778 €
  // Gewinnanteil = 2.311 − 778 = 1.533 €
  // Marge = 1.533 / 4.750 = 32,27 %
  const polo = makeVehicle({
    id: 'polo',
    marke: 'VW',
    modell: 'Polo',
    ankaufsdatum: '2024-10-01',
    ankaufspreis: 4750,
    verkaufsdatum: '2024-12-01',
    verkaufspreis: 7500,
    status: 'verkauft',
    kosten: [
      k('gebuehren', 'Gebühren + Transport', 579),
      k('ersatzteil', 'Radio neu', 89),
      k('reparatur', 'Radioeinbau', 50),
      k('aufbereitung', 'Aufbereitung', 50),
      k('anzeige', 'Mobile.de Anzeige', 10),
    ],
    arbeitsstunden: [],
    stundensatz: 50,
  });

  const kennzahlen = berechneKennzahlen(polo);

  it('Bruttogewinn = VK − EK = 2.750 €', () => {
    expect(kennzahlen.bruttogewinn).toBe(2750);
  });

  it('Nettogewinn = Bruttogewinn / 1,19 ≈ 2.310,92 €', () => {
    expect(kennzahlen.nettogewinn).not.toBeNull();
    expect(kennzahlen.nettogewinn!).toBeCloseTo(2310.924369747899, 6);
  });

  it('MwSt-Anteil ≈ 439,08 €', () => {
    expect(kennzahlen.mwstBetrag).not.toBeNull();
    expect(kennzahlen.mwstBetrag!).toBeCloseTo(439.0756302521008, 6);
  });

  it('Kostensumme = 778 €', () => {
    expect(kennzahlen.kostenSumme).toBe(778);
  });

  it('Gewinnanteil ≈ 1.533 € (gerundet auf ganze Euro)', () => {
    expect(kennzahlen.gewinnanteil).not.toBeNull();
    expect(Math.round(kennzahlen.gewinnanteil!)).toBe(1533);
  });

  it('Marge ≈ 32,27 % bezogen auf EK', () => {
    expect(kennzahlen.margePct).not.toBeNull();
    expect(kennzahlen.margePct!).toBeCloseTo(32.27, 1);
  });

  it('Standzeit zwischen Ankauf und Verkauf = 61 Tage (Okt-Dez)', () => {
    expect(kennzahlen.standzeitTage).toBe(61);
  });
});

describe('Kosten-Aggregation', () => {
  it('summeKosten ignoriert NaN', () => {
    const liste: KostenPosition[] = [
      k('transport', 'a', 100),
      k('reparatur', 'b', 200),
      k('reparatur', 'c', Number.NaN),
    ];
    expect(summeKosten(liste)).toBe(300);
  });

  it('kostenNachKategorie summiert pro Kategorie', () => {
    const v = makeVehicle({
      ankaufspreis: 1000,
      kosten: [
        k('reparatur', 'a', 100),
        k('reparatur', 'b', 200),
        k('transport', 'c', 50),
      ],
    });
    const kz = berechneKennzahlen(v);
    expect(kz.kostenNachKategorie.reparatur).toBe(300);
    expect(kz.kostenNachKategorie.transport).toBe(50);
    expect(kz.kostenNachKategorie.anzeige).toBe(0);
  });
});

describe('Arbeitsstunden', () => {
  it('multipliziert Stunden mit Stundensatz', () => {
    const v = makeVehicle({
      ankaufspreis: 5000,
      stundensatz: 60,
      arbeitsstunden: [
        { id: '1', beschreibung: 'Inspektion', stunden: 2, datum: '2025-01-10' },
        { id: '2', beschreibung: 'Reifenwechsel', stunden: 1.5, datum: '2025-01-11' },
      ],
    });
    const kz = berechneKennzahlen(v);
    expect(kz.arbeitsstundenSumme).toBe(3.5);
    expect(kz.arbeitskostenSumme).toBe(210);
  });

  it('zieht Arbeitskosten vom Gewinnanteil ab', () => {
    const v = makeVehicle({
      ankaufspreis: 5000,
      verkaufspreis: 7000,
      status: 'verkauft',
      verkaufsdatum: '2025-02-01',
      stundensatz: 50,
      arbeitsstunden: [{ id: '1', beschreibung: 'Reparatur', stunden: 4, datum: '2025-01-10' }],
    });
    const kz = berechneKennzahlen(v);
    // Bruttogewinn 2000, Netto 2000/1.19 = 1680.67, minus 200 Arbeitskosten = 1480.67
    expect(kz.gewinnanteil!).toBeCloseTo(1680.6722689 - 200, 4);
  });
});

describe('Im Bestand (kein VK)', () => {
  it('liefert null für VK-abhängige Kennzahlen', () => {
    const v = makeVehicle({ ankaufspreis: 5000, kosten: [k('transport', 't', 200)] });
    const kz = berechneKennzahlen(v);
    expect(kz.bruttogewinn).toBeNull();
    expect(kz.nettogewinn).toBeNull();
    expect(kz.mwstBetrag).toBeNull();
    expect(kz.gewinnanteil).toBeNull();
    expect(kz.margePct).toBeNull();
    // Aber Kosten und Aufwand sind weiterhin korrekt
    expect(kz.kostenSumme).toBe(200);
    expect(kz.gesamtaufwand).toBe(5200);
  });
});

describe('margenAmpel', () => {
  it('grün ≥ 20%', () => {
    expect(margenAmpel(20)).toBe('gruen');
    expect(margenAmpel(45)).toBe('gruen');
  });
  it('gelb 10–20%', () => {
    expect(margenAmpel(10)).toBe('gelb');
    expect(margenAmpel(19.99)).toBe('gelb');
  });
  it('rot < 10%', () => {
    expect(margenAmpel(9.99)).toBe('rot');
    expect(margenAmpel(-5)).toBe('rot');
  });
  it('neutral bei null', () => {
    expect(margenAmpel(null)).toBe('neutral');
  });
});

describe('berechnePortfolio', () => {
  it('aggregiert Bestand + Verkauf korrekt', () => {
    const polo = makeVehicle({
      id: 'polo',
      ankaufspreis: 4750,
      verkaufspreis: 7500,
      verkaufsdatum: '2024-12-01',
      status: 'verkauft',
      kosten: [
        k('gebuehren', 'Gebühren + Transport', 579),
        k('ersatzteil', 'Radio neu', 89),
        k('reparatur', 'Radioeinbau', 50),
        k('aufbereitung', 'Aufbereitung', 50),
        k('anzeige', 'Mobile.de Anzeige', 10),
      ],
    });
    const golf = makeVehicle({ id: 'golf', ankaufspreis: 8000, status: 'im_bestand' });
    const portfolio = berechnePortfolio([polo, golf]);

    expect(portfolio.anzahl).toBe(2);
    expect(portfolio.anzahlImBestand).toBe(1);
    expect(portfolio.anzahlVerkauft).toBe(1);
    expect(portfolio.summeAnkauf).toBe(12750);
    expect(portfolio.summeVerkauf).toBe(7500);
    expect(Math.round(portfolio.summeGewinnanteil)).toBe(1533);
    expect(portfolio.durchschnittsMargePct!).toBeCloseTo(32.27, 1);
  });

  it('liefert null Marge wenn nichts verkauft', () => {
    const v = makeVehicle({ ankaufspreis: 5000 });
    const p = berechnePortfolio([v]);
    expect(p.durchschnittsMargePct).toBeNull();
  });
});
