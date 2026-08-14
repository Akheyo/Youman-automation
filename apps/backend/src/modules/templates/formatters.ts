/**
 * Central formatting helpers for document rendering.
 *
 * Deutsch: Zahlen → "1.234,56", Datum → "TT.MM.JJJJ".
 * Englisch: Zahlen → "1,234.56", Datum → "14 August 2026".
 *
 * Das englische Datum wird bewusst mit ausgeschriebenem Monat gesetzt: "08/14"
 * und "14/08" bedeuten dies- und jenseits des Atlantiks Verschiedenes, und ein
 * Angebot ist kein Ort für Datumsrätsel.
 */
import type { QuoteLanguage } from "@youman/shared";

const NUMBER_FORMATS: Record<QuoteLanguage, { decimal: Intl.NumberFormat; integer: Intl.NumberFormat }> = {
  de: {
    decimal: new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    integer: new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }),
  },
  en: {
    decimal: new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    integer: new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }),
  },
};

const EN_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** Formats a number with two fraction digits in the given language. */
export function formatNumber(value: number, language: QuoteLanguage = "de"): string {
  return (NUMBER_FORMATS[language] ?? NUMBER_FORMATS.de).decimal.format(value);
}

/** German decimal format – kept for callers that are German by definition. */
export function formatGermanNumber(value: number): string {
  return formatNumber(value, "de");
}

/** Formats a date (Date or ISO string) for the given language. Invalid input → empty string. */
export function formatDate(value: Date | string, language: QuoteLanguage = "de"): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (language === "en") return EN_DATE_FORMAT.format(date);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getFullYear()}`;
}

/** Formats a date as TT.MM.JJJJ. */
export function formatGermanDate(value: Date | string): string {
  return formatDate(value, "de");
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Applies formatting to a single placeholder value:
 * numbers → decimal format, ISO-date strings and Dates → localised date,
 * null/undefined → undefined (caller treats as missing), everything else → String(value).
 */
export function formatValue(value: unknown, language: QuoteLanguage = "de"): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    // Quantities stay whole ("2"), amounts should be pre-formatted as strings
    // by the caller when two decimals are mandatory (formatNumber).
    const formats = NUMBER_FORMATS[language] ?? NUMBER_FORMATS.de;
    return Number.isInteger(value) ? formats.integer.format(value) : formatNumber(value, language);
  }
  if (value instanceof Date) return formatDate(value, language);
  if (typeof value === "string" && ISO_DATE_RE.test(value.trim())) {
    const formatted = formatDate(value.trim(), language);
    if (formatted) return formatted;
  }
  return String(value);
}
