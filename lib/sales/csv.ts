/**
 * Tiny dependency-free CSV parser for lead imports.
 *
 * Accepts comma- or semicolon-separated files (German Excel uses ';'). The
 * header row is matched loosely so common column names map to lead fields.
 */

export interface ParsedLead {
  name?: string;
  company?: string;
  phone: string;
  website?: string;
  email?: string;
  notes?: string;
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

const COLS: Record<string, keyof ParsedLead> = {
  name: 'name',
  kontakt: 'name',
  ansprechpartner: 'name',
  contact: 'name',
  firma: 'company',
  company: 'company',
  unternehmen: 'company',
  telefon: 'phone',
  phone: 'phone',
  nummer: 'phone',
  tel: 'phone',
  number: 'phone',
  website: 'website',
  webseite: 'website',
  url: 'website',
  email: 'email',
  mail: 'email',
  'e-mail': 'email',
  notes: 'notes',
  notiz: 'notes',
  notizen: 'notes',
  analyse: 'notes',
};

export function parseLeadsCsv(text: string): ParsedLead[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const firstLine = lines[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const header = splitLine(firstLine, delim).map((h) => h.toLowerCase());

  // Detect whether the first row is a header (contains a known column word).
  const hasHeader = header.some((h) => h in COLS);
  const map: (keyof ParsedLead | null)[] = header.map((h) => COLS[h] ?? null);

  const rows = hasHeader ? lines.slice(1) : lines;
  const out: ParsedLead[] = [];

  for (const line of rows) {
    const cells = splitLine(line, delim);
    const lead: Partial<ParsedLead> = {};
    if (hasHeader) {
      cells.forEach((val, i) => {
        const field = map[i];
        if (field && val) lead[field] = val;
      });
    } else {
      // No header: assume [name, company, phone, website, email]
      lead.name = cells[0] || undefined;
      lead.company = cells[1] || undefined;
      lead.phone = cells[2] || cells[0] || '';
      lead.website = cells[3] || undefined;
      lead.email = cells[4] || undefined;
    }
    const phone = (lead.phone ?? '').replace(/[^\d+]/g, '');
    if (phone.length >= 6) out.push({ ...lead, phone });
  }
  return out;
}
