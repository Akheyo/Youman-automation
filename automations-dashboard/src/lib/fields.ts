/**
 * Die fertigen Views liegen in Supabase und werden hier gelesen, nicht neu
 * berechnet. Weil die Spaltennamen der Views nicht in jedem Fall vorher
 * feststehen, holt sich die Oberfläche jeden Wert über eine kleine Liste
 * möglicher Namen. Passt keiner, bleibt der Wert leer und die Oberfläche sagt
 * das ehrlich, statt eine falsche Zahl zu zeigen.
 */

export type Zeile = Record<string, unknown>;

export function feld(zeile: Zeile | null | undefined, namen: string[]): unknown {
  if (!zeile) return undefined;
  for (const name of namen) {
    const wert = zeile[name];
    if (wert !== undefined && wert !== null) return wert;
  }
  return undefined;
}

export function zahl(zeile: Zeile | null | undefined, namen: string[]): number | null {
  const wert = feld(zeile, namen);
  if (wert === undefined) return null;
  const n = typeof wert === 'number' ? wert : Number(wert);
  return Number.isFinite(n) ? n : null;
}

export function zahlOderNull(zeile: Zeile | null | undefined, namen: string[]): number {
  return zahl(zeile, namen) ?? 0;
}

export function text(zeile: Zeile | null | undefined, namen: string[]): string | null {
  const wert = feld(zeile, namen);
  if (wert === undefined) return null;
  return String(wert);
}

export function jaNein(zeile: Zeile | null | undefined, namen: string[], vorgabe = true): boolean {
  const wert = feld(zeile, namen);
  if (wert === undefined) return vorgabe;
  if (typeof wert === 'boolean') return wert;
  return String(wert) === 'true';
}

/**
 * Erfolgsquoten kommen je nach View als Anteil (0 bis 1) oder als Prozentwert
 * (0 bis 100). Beides wird hier auf Prozent gebracht.
 */
export function alsProzent(wert: number | null): number | null {
  if (wert === null) return null;
  if (!Number.isFinite(wert)) return null;
  if (wert <= 1 && wert >= 0) return wert * 100;
  return wert;
}
