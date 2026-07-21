/**
 * Central German formatting helpers for document rendering.
 * Numbers → "1.234,56", dates → "TT.MM.JJJJ".
 */

const DECIMAL_FORMAT = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const INTEGER_FORMAT = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

/** Formats a number as German decimal with two fraction digits (1234.5 → "1.234,50"). */
export function formatGermanNumber(value: number): string {
  return DECIMAL_FORMAT.format(value);
}

/** Formats a date (Date or ISO string) as TT.MM.JJJJ. Invalid input → empty string. */
export function formatGermanDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getFullYear()}`;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Applies German formatting to a single placeholder value:
 * numbers → decimal format, ISO-date strings → TT.MM.JJJJ, Dates → TT.MM.JJJJ,
 * null/undefined → undefined (caller treats as missing), everything else → String(value).
 */
export function formatValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    // Quantities stay whole ("2"), amounts should be pre-formatted as strings
    // by the caller when two decimals are mandatory (formatGermanNumber).
    return Number.isInteger(value) ? INTEGER_FORMAT.format(value) : formatGermanNumber(value);
  }
  if (value instanceof Date) return formatGermanDate(value);
  if (typeof value === "string" && ISO_DATE_RE.test(value.trim())) {
    const formatted = formatGermanDate(value.trim());
    if (formatted) return formatted;
  }
  return String(value);
}
