import type { Vehicle } from '@/types';
import { generateId } from './db';

/**
 * Beispieldatensatz aus dem Original-Sheet:
 * VW Polo, EK 4.750 €, VK 7.500 €, Kosten 778 €
 * → Gewinnanteil 1.533 €, Marge 32,27 %
 */
export function createPoloSeed(): Vehicle {
  const now = new Date().toISOString();
  return {
    id: 'polo-demo',
    marke: 'VW',
    modell: 'Polo',
    erstzulassung: '2014-05-01',
    km: 132000,
    fin: 'WVWZZZ6RZEY000000',
    kennzeichenIntern: 'POLO-001',
    notizen: 'Beispieldatensatz aus Originalkalkulation. Demonstration der Differenzbesteuerung.',
    ankaufsdatum: '2024-10-01',
    ankaufspreis: 4750,
    kosten: [
      {
        id: generateId(),
        kategorie: 'gebuehren',
        bezeichnung: 'Gebühren + Transport',
        betrag: 579,
        datum: '2024-10-02',
      },
      {
        id: generateId(),
        kategorie: 'ersatzteil',
        bezeichnung: 'Radio neu',
        betrag: 89,
        datum: '2024-10-05',
      },
      {
        id: generateId(),
        kategorie: 'reparatur',
        bezeichnung: 'Radioeinbau',
        betrag: 50,
        datum: '2024-10-05',
      },
      {
        id: generateId(),
        kategorie: 'aufbereitung',
        bezeichnung: 'Aufbereitung',
        betrag: 50,
        datum: '2024-10-08',
      },
      {
        id: generateId(),
        kategorie: 'anzeige',
        bezeichnung: 'Mobile.de Anzeige',
        betrag: 10,
        datum: '2024-10-10',
      },
    ],
    arbeitsstunden: [],
    stundensatz: 50,
    verkaufsdatum: '2024-12-01',
    verkaufspreis: 7500,
    kaeufer: 'Beispiel-Käufer',
    status: 'verkauft',
    erstelltAm: now,
    geaendertAm: now,
  };
}
