/**
 * Deutsche Zahlenformatierung: 1.533,00 €
 */

const EUR = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const EUR_NO_DECIMAL = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const PCT = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUM = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEuro(value: number | null | undefined, decimals = true): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return decimals ? EUR.format(value) : EUR_NO_DECIMAL.format(value);
}

export function formatProzent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return PCT.format(value / 100);
}

export function formatZahl(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return NUM.format(value);
}

export function formatDatum(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Parst eine deutsche Zahleneingabe ("1.533,50") in eine number.
 * Akzeptiert auch reine Zahlen ("1533.50" oder "1533") für Robustheit.
 */
export function parseGermanNumber(input: string): number | null {
  if (input == null) return null;
  const trimmed = input.trim();
  if (trimmed === '') return null;
  // Wenn sowohl . als auch , vorhanden — das letzte Trennzeichen ist Dezimal.
  const hasComma = trimmed.includes(',');
  const hasDot = trimmed.includes('.');
  let normalized = trimmed.replace(/\s/g, '').replace(/€/g, '');
  if (hasComma && hasDot) {
    // Annahme: deutsches Format 1.533,50 → Punkte sind Tausender, Komma ist Dezimal
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = normalized.replace(',', '.');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Heutiges Datum als ISO yyyy-mm-dd. */
export function heuteISO(): string {
  return new Date().toISOString().slice(0, 10);
}
