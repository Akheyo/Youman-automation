/**
 * Excel-Dateien als Kontaktquelle.
 *
 * Lead-Listen kommen in der Praxis als .xlsx, nicht als CSV. Statt bei jedem
 * Import den Umweg über "Speichern unter → CSV" zu verlangen, liest Paul die
 * Datei direkt und übergibt sie an denselben Zeilenleser wie eine CSV-Datei —
 * damit gilt für beide Wege dieselbe Spaltenerkennung.
 *
 * Gelesen wird nur das erste Blatt. Mehrere Blätter in einer Lead-Liste sind
 * selten und wären eine Einladung, versehentlich die falschen Leute
 * anzuschreiben.
 */

import { parseContactsCsv, type ParsedContact } from './csv';

/** Obergrenze, damit eine versehentlich riesige Datei nicht den Server blockiert. */
const MAX_ZEILEN = 20_000;

function alsText(wert: unknown): string {
  if (wert == null) return '';
  if (typeof wert === 'string') return wert;
  if (typeof wert === 'number' || typeof wert === 'boolean') return String(wert);
  if (wert instanceof Date) return wert.toISOString().slice(0, 10);
  // ExcelJS liefert Formeln und Rich-Text als Objekt.
  const o = wert as { text?: unknown; result?: unknown; richText?: { text?: string }[]; hyperlink?: string };
  if (typeof o.text === 'string') return o.text;
  if (Array.isArray(o.richText)) return o.richText.map((t) => t.text ?? '').join('');
  if (o.result != null) return alsText(o.result);
  if (typeof o.hyperlink === 'string') return o.hyperlink;
  return '';
}

/** Maskiert ein Feld fuer CSV, damit Semikolon und Zeilenumbruch nicht trennen. */
function feld(wert: string): string {
  const t = wert.replace(/\r?\n/g, ' ').trim();
  return /[";]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/**
 * Wandelt eine Excel-Datei in CSV-Text um (Semikolon-getrennt, erste Zeile
 * als Kopf). Der Umweg über CSV ist Absicht: so gibt es genau eine Stelle,
 * an der Spaltennamen erkannt werden.
 */
export async function xlsxAlsCsv(daten: Buffer | ArrayBuffer): Promise<string> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  // ExcelJS erwartet einen Buffer; die Typen der beiden Pakete decken sich
  // nicht exakt, der Inhalt schon.
  await wb.xlsx.load(daten as never);

  const ws = wb.worksheets[0];
  if (!ws) return '';

  const zeilen: string[] = [];
  let spaltenAnzahl = 0;

  ws.eachRow({ includeEmpty: false }, (row, nummer) => {
    if (nummer > MAX_ZEILEN) return;
    // row.values ist 1-basiert, Index 0 ist immer leer.
    const werte = (row.values as unknown[]).slice(1).map(alsText);
    if (nummer === 1) spaltenAnzahl = werte.length;
    // Auf die Breite der Kopfzeile bringen, damit Spalten nicht verrutschen.
    while (werte.length < spaltenAnzahl) werte.push('');
    if (werte.every((w) => w.trim() === '')) return;
    zeilen.push(werte.slice(0, spaltenAnzahl || werte.length).map(feld).join(';'));
  });

  return zeilen.join('\n');
}

/** Excel-Datei direkt zu Kontakten — Spaltenerkennung wie bei CSV. */
export async function parseContactsXlsx(daten: Buffer | ArrayBuffer): Promise<ParsedContact[]> {
  return parseContactsCsv(await xlsxAlsCsv(daten));
}

/** Erkennt am Dateinamen, ob der Excel-Weg genommen werden muss. */
export function istExcelDatei(name: string): boolean {
  return /\.(xlsx|xlsm|xltx)$/i.test((name ?? '').trim());
}
