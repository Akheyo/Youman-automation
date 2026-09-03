/**
 * CSV-Import für Outreach-Kontakte.
 *
 * Gegenstück zu lib/sales/csv.ts (dort ist die Telefonnummer der Schlüssel,
 * hier die E-Mail-Adresse). Unbekannte Spalten gehen nicht verloren, sondern
 * landen als freie Platzhalter in `custom` — so kann jemand eine Spalte
 * "branche" mitliefern und in der Vorlage `{{branche}}` schreiben.
 */

import { isEmail } from './template';

export interface ParsedContact {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  website?: string;
  anlass?: string;
  custom: Record<string, string>;
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

type Field = 'email' | 'first_name' | 'last_name' | 'company' | 'website' | 'anlass' | 'full_name';

const COLS: Record<string, Field> = {
  email: 'email',
  mail: 'email',
  'e-mail': 'email',
  'e-mail-adresse': 'email',
  vorname: 'first_name',
  firstname: 'first_name',
  first_name: 'first_name',
  nachname: 'last_name',
  lastname: 'last_name',
  last_name: 'last_name',
  name: 'full_name',
  kontakt: 'full_name',
  ansprechpartner: 'full_name',
  contact: 'full_name',
  firma: 'company',
  company: 'company',
  unternehmen: 'company',
  website: 'website',
  webseite: 'website',
  url: 'website',
  domain: 'website',
  anlass: 'anlass',
  grund: 'anlass',
  notiz: 'anlass',
  notes: 'anlass',
};

/** Splittet "Anna Beispiel" in Vor- und Nachname. */
export function splitName(full: string): { first_name?: string; last_name?: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { first_name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

export function parseContactsCsv(text: string): ParsedContact[] {
  const lines = (text ?? '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const firstLine = lines[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const header = splitLine(firstLine, delim).map((h) => h.toLowerCase().replace(/^"|"$/g, ''));
  const hasHeader = header.some((h) => h in COLS);

  const rows = hasHeader ? lines.slice(1) : lines;
  const seen = new Set<string>();
  const out: ParsedContact[] = [];

  for (const line of rows) {
    const cells = splitLine(line, delim);
    const rec: Partial<Record<Field, string>> = {};
    const custom: Record<string, string> = {};

    if (hasHeader) {
      cells.forEach((val, i) => {
        if (!val) return;
        const col = header[i] ?? '';
        const field = COLS[col];
        if (field) rec[field] = val;
        else if (col) custom[col.replace(/\s+/g, '_')] = val;
      });
    } else {
      // Ohne Kopfzeile: [email, name, firma, website]
      rec.email = cells[0];
      rec.full_name = cells[1];
      rec.company = cells[2];
      rec.website = cells[3];
    }

    const email = (rec.email ?? '').toLowerCase();
    if (!isEmail(email) || seen.has(email)) continue;
    seen.add(email);

    const fromFull = rec.full_name ? splitName(rec.full_name) : {};
    out.push({
      email,
      first_name: rec.first_name ?? fromFull.first_name,
      last_name: rec.last_name ?? fromFull.last_name,
      company: rec.company,
      website: rec.website,
      anlass: rec.anlass,
      custom,
    });
  }
  return out;
}
