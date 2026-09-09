/**
 * PlentyONE-Zugang laden und speichern — aus der Datenbank, ersatzweise aus
 * den Umgebungsvariablen.
 *
 * Warum überhaupt beides: Bisher lagen die Zugangsdaten ausschließlich als
 * Umgebungsvariablen bei Vercel. Jede Änderung brauchte damit einen neuen
 * Deploy, und niemand außer dem Vercel-Konto-Inhaber konnte etwas umstellen.
 * Künftig steht der Zugang in der Oberfläche unter „Einstellungen".
 *
 * Die Rangfolge ist bewusst so herum:
 *
 *   Datenbank  schlägt  Umgebungsvariable
 *
 * Wer in der Oberfläche etwas einträgt, will damit etwas ändern — sonst hätte
 * er es gelassen. Die Umgebungsvariablen bleiben als Grundeinstellung liegen,
 * sodass eine leere Datenbank nichts kaputt macht und ein Zurücksetzen in der
 * Oberfläche wieder auf sie zurückfällt.
 *
 * Gelesen wird über den Service-Role-Key: Die Tabelle ist per RLS für alle
 * anderen gesperrt (siehe supabase/schema.sql).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { entschluessele, tresorBereit, verschluessele } from './tresor';

/** Der Zugang, wie ihn die Werkzeuge brauchen. */
export interface PlentyZugang {
  baseUrl: string;
  user: string;
  password: string;
  plentyId: number | null;
  warehouseId: number | null;
}

/** Woher ein Wert stammt — die Oberfläche macht das sichtbar. */
export type Quelle = 'datenbank' | 'umgebung' | 'leer';

export interface ZugangMitQuelle extends PlentyZugang {
  quelle: Quelle;
  /** Das gespeicherte Passwort war nicht entschlüsselbar (Schlüsselwechsel). */
  passwortUnlesbar: boolean;
  geaendertVon: string | null;
  geaendertAm: string | null;
}

interface Zeile {
  plenty_base_url: string | null;
  plenty_user: string | null;
  plenty_passwort_enc: string | null;
  plenty_id: number | null;
  plenty_warehouse_id: number | null;
  geaendert_von: string | null;
  geaendert_am: string | null;
}

/**
 * Kurzlebiger Zwischenspeicher.
 *
 * Ohne ihn läge vor jedem einzelnen Plenty-Aufruf eine Datenbankabfrage — bei
 * einem Lauf über hunderte Artikel sind das hunderte überflüssige Abfragen.
 * Zehn Sekunden sind kurz genug, dass eine Änderung in der Oberfläche
 * praktisch sofort greift, und lang genug, dass ein Durchlauf sie nur einmal
 * bezahlt.
 */
const CACHE_MS = 10_000;
let cache: { wert: ZugangMitQuelle; bis: number } | null = null;

/** Wirft den Zwischenspeicher weg — nach dem Speichern, damit es sofort greift. */
export function vergissZugang(): void {
  cache = null;
}

function ausUmgebung(): PlentyZugang {
  return {
    // Wie im Client: ein angehängtes "/rest" abschneiden, Plenty zeigt es mit an.
    baseUrl: (process.env.PLENTY_BASE_URL ?? '')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/rest$/i, '')
      .replace(/\/+$/, ''),
    user: (process.env.PLENTY_USER ?? '').trim(),
    password: process.env.PLENTY_PASSWORD ?? '',
    plentyId: process.env.PLENTY_ID ? Number(process.env.PLENTY_ID) : null,
    warehouseId: process.env.PLENTY_WAREHOUSE_ID ? Number(process.env.PLENTY_WAREHOUSE_ID) : null,
  };
}

/** Räumt eine eingegebene Basis-URL auf. */
export function normalisiereBaseUrl(roh: string): string {
  return (roh ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest$/i, '')
    .replace(/\/+$/, '');
}

/**
 * Der aktuell gültige Zugang. Wirft nie — ohne Datenbank oder ohne Tabelle
 * kommt einfach der Zugang aus den Umgebungsvariablen zurück.
 */
export async function ladeZugang(opts: { frisch?: boolean } = {}): Promise<ZugangMitQuelle> {
  if (!opts.frisch && cache && Date.now() < cache.bis) return cache.wert;

  const umgebung = ausUmgebung();
  const fallback = (): ZugangMitQuelle => ({
    ...umgebung,
    quelle: umgebung.baseUrl && umgebung.user && umgebung.password ? 'umgebung' : 'leer',
    passwortUnlesbar: false,
    geaendertVon: null,
    geaendertAm: null,
  });

  const supabase = createAdminClient();
  if (!supabase) return merke(fallback());

  let zeile: Zeile | null = null;
  try {
    const { data, error } = await supabase
      .from('einstellungen')
      .select('plenty_base_url, plenty_user, plenty_passwort_enc, plenty_id, plenty_warehouse_id, geaendert_von, geaendert_am')
      .eq('id', 1)
      .maybeSingle();
    // Fehlt die Tabelle noch (Schema nicht eingespielt), ist das kein Drama —
    // dann gelten weiter die Umgebungsvariablen.
    if (error) return merke(fallback());
    zeile = (data as Zeile | null) ?? null;
  } catch {
    return merke(fallback());
  }

  if (!zeile) return merke(fallback());

  const baseUrl = normalisiereBaseUrl(zeile.plenty_base_url ?? '');
  const user = (zeile.plenty_user ?? '').trim();
  const passwort = zeile.plenty_passwort_enc ? entschluessele(zeile.plenty_passwort_enc) : null;
  const passwortUnlesbar = Boolean(zeile.plenty_passwort_enc) && passwort === null;

  // Nur wenn der Datensatz vollständig ist, verdrängt er die Umgebung. Ein
  // halb ausgefüllter Datensatz darf einen funktionierenden Zugang aus den
  // Umgebungsvariablen nicht lahmlegen.
  const vollstaendig = Boolean(baseUrl && user && passwort);

  return merke({
    baseUrl: vollstaendig ? baseUrl : umgebung.baseUrl,
    user: vollstaendig ? user : umgebung.user,
    password: vollstaendig ? passwort! : umgebung.password,
    // Lager und Mandant dürfen einzeln gesetzt werden, auch ohne Zugangsdaten.
    plentyId: zeile.plenty_id ?? umgebung.plentyId,
    warehouseId: zeile.plenty_warehouse_id ?? umgebung.warehouseId,
    quelle: vollstaendig ? 'datenbank' : fallback().quelle,
    passwortUnlesbar,
    geaendertVon: zeile.geaendert_von,
    geaendertAm: zeile.geaendert_am,
  });
}

function merke(wert: ZugangMitQuelle): ZugangMitQuelle {
  cache = { wert, bis: Date.now() + CACHE_MS };
  return wert;
}

/** Was gespeichert werden soll. Fehlende Felder bleiben unverändert. */
export interface Speicherwunsch {
  baseUrl?: string | null;
  user?: string | null;
  /** Klartext. Leer/undefined lässt das gespeicherte Passwort unberührt. */
  passwort?: string | null;
  plentyId?: number | null;
  warehouseId?: number | null;
  /** E-Mail des Nutzers, der speichert — die einzige Spur bei geteiltem Zugang. */
  von?: string | null;
}

export interface Speicherergebnis {
  ok: boolean;
  fehler: string | null;
}

/**
 * Schreibt die Einstellungen. Das Passwort wird verschlüsselt abgelegt; ein
 * leer gelassenes Feld lässt das bisherige stehen, damit niemand es beim
 * Ändern der URL versehentlich löscht.
 */
export async function speichereZugang(wunsch: Speicherwunsch): Promise<Speicherergebnis> {
  const supabase = createAdminClient();
  if (!supabase) {
    return {
      ok: false,
      fehler:
        'Supabase ist nicht eingerichtet (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen) — ohne Datenbank lässt sich nichts speichern.',
    };
  }

  const felder: Record<string, unknown> = {
    id: 1,
    geaendert_am: new Date().toISOString(),
    geaendert_von: wunsch.von ?? null,
  };
  if (wunsch.baseUrl !== undefined) felder.plenty_base_url = normalisiereBaseUrl(wunsch.baseUrl ?? '') || null;
  if (wunsch.user !== undefined) felder.plenty_user = (wunsch.user ?? '').trim() || null;
  if (wunsch.plentyId !== undefined) felder.plenty_id = wunsch.plentyId;
  if (wunsch.warehouseId !== undefined) felder.plenty_warehouse_id = wunsch.warehouseId;

  if (wunsch.passwort) {
    if (!tresorBereit()) {
      return {
        ok: false,
        fehler:
          'Es fehlt ein Schlüssel zum Verschlüsseln (EINSTELLUNGEN_SCHLUESSEL oder SUPABASE_SERVICE_ROLE_KEY). Ohne ihn wird das Passwort nicht gespeichert.',
      };
    }
    felder.plenty_passwort_enc = verschluessele(wunsch.passwort);
  }

  const { error } = await supabase.from('einstellungen').upsert(felder, { onConflict: 'id' });
  vergissZugang();
  if (error) {
    return {
      ok: false,
      fehler: /relation .* does not exist|schema cache/i.test(error.message)
        ? 'Die Tabelle „einstellungen" fehlt — bitte supabase/schema.sql im SQL-Editor ausführen.'
        : `Speichern fehlgeschlagen: ${error.message}`,
    };
  }
  return { ok: true, fehler: null };
}

/** Löscht den gespeicherten Zugang; danach gelten wieder die Umgebungsvariablen. */
export async function verwerfeZugang(): Promise<Speicherergebnis> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, fehler: 'Supabase ist nicht eingerichtet.' };
  const { error } = await supabase
    .from('einstellungen')
    .update({
      plenty_base_url: null,
      plenty_user: null,
      plenty_passwort_enc: null,
      geaendert_am: new Date().toISOString(),
    })
    .eq('id', 1);
  vergissZugang();
  return error ? { ok: false, fehler: error.message } : { ok: true, fehler: null };
}
