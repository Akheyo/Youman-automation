import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseContactsXlsx, xlsxAlsCsv, istExcelDatei } from '@/lib/outreach/xlsx';
import { ersteUrl } from '@/lib/outreach/csv';

/** Baut eine Excel-Datei im Aufbau einer typischen Lead-Liste. */
async function bauDatei(kopf: string[], zeilen: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('leads');
  ws.addRow(kopf);
  for (const z of zeilen) ws.addRow(z);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const KOPF = ['Name', 'Position', 'E-Mail', 'Telefon', 'Firmenname', 'Branche', 'Ort', 'Beschreibung', 'Quelle'];

const ZEILE = [
  'Tim Kaldeuer',
  'Geschäftsführer, Kaufmännischer Vertrieb',
  'tim.kaldeuer@asmetal.de',
  '+49 2104 9298-24',
  'August Schmits GmbH & Co. KG (ASMetal)',
  'Automobil & Zulieferer',
  'Mettmann',
  'Hersteller von Stanz- und Biegeteilen; Prozessdigitalisierung liegt nahe.',
  'https://www.asmetal.de/kontakt/ | https://www.asmetal.de/unternehmen/',
];

describe('istExcelDatei', () => {
  it('erkennt Excel an der Endung', () => {
    expect(istExcelDatei('leads.xlsx')).toBe(true);
    expect(istExcelDatei('Leads.XLSM')).toBe(true);
    expect(istExcelDatei('leads.csv')).toBe(false);
    expect(istExcelDatei('')).toBe(false);
  });
});

describe('ersteUrl', () => {
  it('nimmt die erste von mehreren Adressen', () => {
    expect(ersteUrl('https://a.de/kontakt/ | https://a.de/ueber-uns/')).toBe('https://a.de/kontakt/');
  });

  it('kommt mit einer einzelnen Adresse und mit Leerwerten klar', () => {
    expect(ersteUrl('https://a.de')).toBe('https://a.de');
    expect(ersteUrl('')).toBe('');
  });

  it('erkennt auch Adressen ohne Protokoll', () => {
    expect(ersteUrl('www.firma.de; firma.de')).toBe('www.firma.de');
  });
});

describe('parseContactsXlsx', () => {
  it('ordnet die Spalten einer Lead-Liste den Kontaktfeldern zu', async () => {
    const kontakte = await parseContactsXlsx(await bauDatei(KOPF, [ZEILE]));
    expect(kontakte).toHaveLength(1);
    expect(kontakte[0]).toMatchObject({
      email: 'tim.kaldeuer@asmetal.de',
      first_name: 'Tim',
      last_name: 'Kaldeuer',
      company: 'August Schmits GmbH & Co. KG (ASMetal)',
      // Aus "Quelle" wird die erste Adresse.
      website: 'https://www.asmetal.de/kontakt/',
    });
    expect(kontakte[0]!.anlass).toContain('Stanz-');
  });

  it('macht aus unbekannten Spalten freie Platzhalter', async () => {
    const kontakte = await parseContactsXlsx(await bauDatei(KOPF, [ZEILE]));
    expect(kontakte[0]!.custom).toEqual({
      position: 'Geschäftsführer, Kaufmännischer Vertrieb',
      telefon: '+49 2104 9298-24',
      branche: 'Automobil & Zulieferer',
      ort: 'Mettmann',
    });
  });

  it('vertraegt Semikolon und Anfuehrungszeichen in Zellen', async () => {
    const zeile = [...ZEILE];
    zeile[4] = 'Muster; und "Sohn" GmbH';
    const kontakte = await parseContactsXlsx(await bauDatei(KOPF, [zeile]));
    expect(kontakte[0]!.company).toBe('Muster; und "Sohn" GmbH');
  });

  it('ueberspringt leere Zeilen und Zeilen ohne gueltige Adresse', async () => {
    const ohneMail = [...ZEILE];
    ohneMail[2] = '';
    const kaputt = [...ZEILE];
    kaputt[2] = 'keine-adresse';
    const kontakte = await parseContactsXlsx(await bauDatei(KOPF, [ZEILE, ohneMail, kaputt, []]));
    expect(kontakte.map((k) => k.email)).toEqual(['tim.kaldeuer@asmetal.de']);
  });

  it('entfernt Dubletten ueber die Adresse', async () => {
    const zweite = [...ZEILE];
    zweite[2] = 'TIM.KALDEUER@asmetal.de';
    const kontakte = await parseContactsXlsx(await bauDatei(KOPF, [ZEILE, zweite]));
    expect(kontakte).toHaveLength(1);
  });

  it('liest mehrere Zeilen', async () => {
    const zweite = [...ZEILE];
    zweite[0] = 'Markus Baier';
    zweite[2] = 'm.baier@baier-drehteile.de';
    const kontakte = await parseContactsXlsx(await bauDatei(KOPF, [ZEILE, zweite]));
    expect(kontakte.map((k) => k.first_name)).toEqual(['Tim', 'Markus']);
  });
});

describe('xlsxAlsCsv', () => {
  it('setzt die Kopfzeile an den Anfang', async () => {
    const csv = await xlsxAlsCsv(await bauDatei(KOPF, [ZEILE]));
    expect(csv.split('\n')[0]).toBe('Name;Position;E-Mail;Telefon;Firmenname;Branche;Ort;Beschreibung;Quelle');
  });

  it('gibt bei einer Datei ohne Blattinhalt nichts zurueck', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('leer');
    expect(await xlsxAlsCsv(Buffer.from(await wb.xlsx.writeBuffer()))).toBe('');
  });
});
