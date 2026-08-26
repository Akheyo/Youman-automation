/**
 * Reine, testbare Geschäftslogik der Projektplanung (ohne Netzwerk/DB).
 */

/** Ein Projekt-Datensatz, wie ihn das Formular liefert. */
/** Erlaubte Auftragstypen. */
export const ORDER_TYPES = ['Demontage', 'Warenankauf', 'Auktion'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export interface ProjektInput {
  company: string; // Firmenname, z. B. "Bosch GmbH"
  location: string; // Ort, z. B. "Esslingen"
  contactInternal?: string; // Ansprechpartner intern
  contactExternal?: string; // Ansprechpartner extern
  notes?: string; // Anmerkungen / Randnotizen
  orderType?: string; // Auftragstyp (Demontage | Warenankauf | Auktion)
}

/** Normalisiert/validiert den Auftragstyp; gibt null zurück, wenn ungültig/leer. */
export function normalizeOrderType(value?: string): OrderType | null {
  const match = ORDER_TYPES.find((t) => t.toLowerCase() === (value ?? '').trim().toLowerCase());
  return match ?? null;
}

/**
 * Baut den Namen der Plenty-Unterkategorie: "Firma Ort".
 * Beispiel: ("Bosch GmbH", "Esslingen") → "Bosch GmbH Esslingen".
 */
export function buildCategoryName(company: string, location: string): string {
  const c = company.trim().replace(/\s+/g, ' ');
  const l = location.trim().replace(/\s+/g, ' ');
  return [c, l].filter(Boolean).join(' ');
}

/**
 * Baut den Artikelnamen. Enthält Firma, Ort und das Datum, damit ein Projekt
 * im Plenty-Backend sofort erkennbar ist.
 */
export function buildItemName(input: ProjektInput, date: Date): string {
  const datum = formatDateDE(date);
  // Format: "Firma Ort Datum", z. B. "Bosch Essen 26.08.2023"
  return `${buildCategoryName(input.company, input.location)} ${datum}`;
}

/**
 * Baut die Artikelbeschreibung (Klartext) mit allen Projektdaten.
 */
export function buildItemDescription(input: ProjektInput, date: Date): string {
  const lines = [
    `Firma: ${input.company.trim()}`,
    `Ort: ${input.location.trim()}`,
    `Datum: ${formatDateDE(date)}`,
  ];
  if (input.orderType?.trim()) lines.push(`Auftragstyp: ${input.orderType.trim()}`);
  if (input.contactInternal?.trim()) lines.push(`Ansprechpartner intern: ${input.contactInternal.trim()}`);
  if (input.contactExternal?.trim()) lines.push(`Ansprechpartner extern: ${input.contactExternal.trim()}`);
  if (input.notes?.trim()) lines.push(`Anmerkungen: ${input.notes.trim()}`);
  return lines.join('\n');
}

/** URL-tauglicher Slug für Plenty (nameUrl der Kategorie). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'projekt';
}

/** Deutsches Datum TT.MM.JJJJ. */
export function formatDateDE(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${date.getFullYear()}`;
}

/** Validiert das Formular. Gibt eine Fehlermeldung zurück oder null. */
export function validateProjekt(input: Partial<ProjektInput>): string | null {
  if (!input.company || input.company.trim().length < 2) {
    return 'Bitte einen Firmennamen angeben.';
  }
  if (!input.location || input.location.trim().length < 2) {
    return 'Bitte einen Ort angeben.';
  }
  return null;
}
