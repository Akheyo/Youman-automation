/**
 * Was wir über den Stand bei Marktplaats wissen.
 *
 * Eine eigene Tabelle, kein Feld in Plenty. Der Grund ist der Eigentümer der
 * Angabe: Die Anzeigen-ID (`m1372`) gehört Marktplaats, nicht dem
 * Warenwirtschaftssystem — und ein Abgleich, der sie in ein Plenty-Freitextfeld
 * schreibt, hinterlässt genau die Zustände, die die Lagerplatz-Auswertung in
 * diesem Projekt mühsam wieder auseinandersortiert hat.
 *
 * Sie trägt außerdem die **Übersetzung**. Ein Text wird einmal übersetzt und
 * dann behalten: Bei zehntausenden Artikeln ist jede erneute Übersetzung
 * bezahlte Arbeit für dasselbe Ergebnis. Neu übersetzt wird erst, wenn sich
 * der deutsche Quelltext ändert — dafür steht sein Fingerabdruck mit in der
 * Zeile.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type SpiegelStatus = 'online' | 'offline' | 'wartet' | 'gesperrt' | 'fehler';

export interface SpiegelZeile {
  variationId: number;
  itemId: number | null;
  /** Die Anzeigen-ID bei Marktplaats. Null, solange nichts online ist. */
  mpItemId: string | null;
  /** Fingerabdruck der zuletzt übertragenen Anzeige. */
  fingerabdruck: string | null;
  /** Fingerabdruck des deutschen Quelltextes, zu dem die Übersetzung gehört. */
  quellFingerabdruck: string | null;
  titelNl: string | null;
  beschreibungNl: string | null;
  status: SpiegelStatus;
  fehler: string | null;
}

interface Zeile {
  variation_id: number;
  item_id: number | null;
  mp_item_id: string | null;
  fingerabdruck: string | null;
  quell_fingerabdruck: string | null;
  titel_nl: string | null;
  beschreibung_nl: string | null;
  status: string | null;
  fehler: string | null;
}

function ausZeile(z: Zeile): SpiegelZeile {
  return {
    variationId: Number(z.variation_id),
    itemId: z.item_id ?? null,
    mpItemId: z.mp_item_id ?? null,
    fingerabdruck: z.fingerabdruck ?? null,
    quellFingerabdruck: z.quell_fingerabdruck ?? null,
    titelNl: z.titel_nl ?? null,
    beschreibungNl: z.beschreibung_nl ?? null,
    status: (z.status as SpiegelStatus) ?? 'wartet',
    fehler: z.fehler ?? null,
  };
}

/**
 * Fingerabdruck des deutschen Quelltextes.
 *
 * Nur Titel und Beschreibung — der Preis ändert sich häufig und hat auf die
 * Übersetzung keinen Einfluss. Wäre er enthalten, würde jede Preispflege das
 * halbe Sortiment neu übersetzen.
 */
export function quellFingerabdruck(titel: string, beschreibung: string): string {
  const t = (titel ?? '').trim();
  const b = (beschreibung ?? '').trim();
  return `${t.length}:${t}|${b.length}:${b.slice(0, 60)}:${b.slice(-60)}`;
}

/**
 * Muss neu übersetzt werden?
 *
 * Ja, wenn noch keine Übersetzung da ist oder der deutsche Text sich geändert
 * hat. Sonst nicht — und das ist der Unterschied zwischen einem Lauf, der
 * einmal Übersetzungskosten verursacht, und einem, der sie jede Nacht erneut
 * verursacht.
 */
export function brauchtUebersetzung(quelle: string, zeile: SpiegelZeile | undefined | null): boolean {
  if (!zeile) return true;
  if (!zeile.titelNl || !zeile.beschreibungNl) return true;
  return zeile.quellFingerabdruck !== quelle;
}

/** Holt die bekannten Zeilen zu einer Gruppe von Varianten. */
export async function ladeSpiegel(variationIds: number[]): Promise<Map<number, SpiegelZeile>> {
  const map = new Map<number, SpiegelZeile>();
  const supabase = createAdminClient();
  if (!supabase || !variationIds.length) return map;

  // In Blöcken abfragen: Eine `in`-Liste mit zehntausend Werten sprengt die
  // URL-Länge von PostgREST.
  for (let i = 0; i < variationIds.length; i += 200) {
    const block = variationIds.slice(i, i + 200);
    try {
      const { data, error } = await supabase
        .from('marktplaats_anzeigen')
        .select('variation_id, item_id, mp_item_id, fingerabdruck, quell_fingerabdruck, titel_nl, beschreibung_nl, status, fehler')
        .in('variation_id', block);
      if (error) return map;
      for (const z of (data ?? []) as Zeile[]) map.set(Number(z.variation_id), ausZeile(z));
    } catch {
      return map;
    }
  }
  return map;
}

/** Schreibt eine Zeile fort. Fehlende Felder bleiben unverändert. */
export async function schreibeSpiegel(zeile: Partial<SpiegelZeile> & { variationId: number }): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;

  const felder: Record<string, unknown> = {
    variation_id: zeile.variationId,
    geaendert_am: new Date().toISOString(),
  };
  if (zeile.itemId !== undefined) felder.item_id = zeile.itemId;
  if (zeile.mpItemId !== undefined) felder.mp_item_id = zeile.mpItemId;
  if (zeile.fingerabdruck !== undefined) felder.fingerabdruck = zeile.fingerabdruck;
  if (zeile.quellFingerabdruck !== undefined) felder.quell_fingerabdruck = zeile.quellFingerabdruck;
  if (zeile.titelNl !== undefined) felder.titel_nl = zeile.titelNl;
  if (zeile.beschreibungNl !== undefined) felder.beschreibung_nl = zeile.beschreibungNl;
  if (zeile.status !== undefined) felder.status = zeile.status;
  if (zeile.fehler !== undefined) felder.fehler = zeile.fehler;

  try {
    await supabase.from('marktplaats_anzeigen').upsert(felder, { onConflict: 'variation_id' });
  } catch {
    // Der Abgleich darf an der Buchführung nicht scheitern. Was hier
    // verlorengeht, holt der nächste Lauf nach — schlimmstenfalls wird eine
    // Anzeige einmal unnötig aktualisiert.
  }
}

export interface Bestandsaufnahme {
  gesamt: number;
  online: number;
  wartet: number;
  gesperrt: number;
  fehler: number;
}

/** Zählt, wie es um das Sortiment bei Marktplaats steht. */
export async function zaehleSpiegel(): Promise<Bestandsaufnahme | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('marktplaats_anzeigen').select('status');
    if (error) return null;
    const aufnahme: Bestandsaufnahme = { gesamt: 0, online: 0, wartet: 0, gesperrt: 0, fehler: 0 };
    for (const z of (data ?? []) as Array<{ status: string | null }>) {
      aufnahme.gesamt += 1;
      if (z.status === 'online') aufnahme.online += 1;
      else if (z.status === 'gesperrt') aufnahme.gesperrt += 1;
      else if (z.status === 'fehler') aufnahme.fehler += 1;
      else if (z.status === 'wartet') aufnahme.wartet += 1;
    }
    return aufnahme;
  } catch {
    return null;
  }
}
