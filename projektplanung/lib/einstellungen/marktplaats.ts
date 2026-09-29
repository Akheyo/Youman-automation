/**
 * Marktplaats-Zugang laden und speichern.
 *
 * Aufgebaut wie der PlentyONE-Zugang nebenan (`plenty.ts`) und aus demselben
 * Grund: Datenbank schlägt Umgebungsvariable, damit eine Änderung sofort gilt
 * und keinen Deploy braucht. Das Client-Secret liegt verschlüsselt (AES-256-GCM,
 * `tresor.ts`) und wird nie an den Browser ausgeliefert.
 *
 * Marktplaats hat zwei Umgebungen, und sie unterscheiden sich in beiden
 * Adressen — Anmeldung und API. Sie stehen deshalb als Paar hier und nicht
 * verstreut im Client: Wer versehentlich die Produktions-API mit
 * Sandbox-Zugangsdaten anspricht, bekommt einen 401 und sucht den Fehler bei
 * den Zugangsdaten.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { entschluessele, tresorBereit, verschluessele } from './tresor';

/** Anmeldung und API je Umgebung, laut Marktplaats-Dokumentation. */
export const UMGEBUNGEN = {
  produktion: {
    authUrl: 'https://auth.marktplaats.nl/accounts/oauth/token',
    apiUrl: 'https://api.marktplaats.nl',
  },
  sandbox: {
    authUrl: 'https://auth.demo.qa-mp.so/accounts/oauth/token',
    // Die Sandbox-API-Adresse steht nicht in der öffentlichen Dokumentation.
    // Sie kommt mit den Zugangsdaten und wird deshalb eingetragen, nicht geraten.
    apiUrl: '',
  },
} as const;

export type Umgebung = keyof typeof UMGEBUNGEN;

export interface MarktplaatsZugang {
  clientId: string;
  clientSecret: string;
  umgebung: Umgebung;
  /** Leer = die Vorgabe der gewählten Umgebung. */
  apiUrl: string;
  authUrl: string;
  /** Standort der Anzeigen, niederländische PLZ (Form 1234AB). */
  postleitzahl: string;
  /** Pauschale Versandkosten in Euro. Null = keine Angabe in der Anzeige. */
  versandEuro: number | null;
}

export type Quelle = 'datenbank' | 'umgebung' | 'leer';

export interface ZugangMitQuelle extends MarktplaatsZugang {
  quelle: Quelle;
  secretUnlesbar: boolean;
  geaendertVon: string | null;
  geaendertAm: string | null;
}

interface Zeile {
  marktplaats_client_id: string | null;
  marktplaats_secret_enc: string | null;
  marktplaats_umgebung: string | null;
  marktplaats_api_url: string | null;
  marktplaats_plz: string | null;
  marktplaats_versand_cent: number | null;
  geaendert_von: string | null;
  geaendert_am: string | null;
}

const CACHE_MS = 10_000;
let cache: { wert: ZugangMitQuelle; bis: number } | null = null;

export function vergissZugang(): void {
  cache = null;
}

function istUmgebung(wert: string | null | undefined): wert is Umgebung {
  return wert === 'produktion' || wert === 'sandbox';
}

function ausUmgebungsvariablen(): MarktplaatsZugang {
  const umgebung: Umgebung = process.env.MARKTPLAATS_UMGEBUNG === 'sandbox' ? 'sandbox' : 'produktion';
  return {
    clientId: (process.env.MARKTPLAATS_CLIENT_ID ?? '').trim(),
    clientSecret: process.env.MARKTPLAATS_CLIENT_SECRET ?? '',
    umgebung,
    apiUrl: (process.env.MARKTPLAATS_API_URL ?? '').trim().replace(/\/+$/, ''),
    authUrl: (process.env.MARKTPLAATS_AUTH_URL ?? '').trim(),
    postleitzahl: (process.env.MARKTPLAATS_PLZ ?? '').trim().toUpperCase().replace(/\s+/g, ''),
    versandEuro: process.env.MARKTPLAATS_VERSAND_EUR ? Number(process.env.MARKTPLAATS_VERSAND_EUR) : null,
  };
}

/** Füllt leere Adressen mit der Vorgabe der gewählten Umgebung. */
export function mitVorgaben(z: MarktplaatsZugang): MarktplaatsZugang {
  const vorgabe = UMGEBUNGEN[z.umgebung];
  return {
    ...z,
    apiUrl: (z.apiUrl || vorgabe.apiUrl).replace(/\/+$/, ''),
    authUrl: z.authUrl || vorgabe.authUrl,
  };
}

/** Vollständig heißt: Anmeldung und Standort sind da. Ohne beides geht keine Anzeige. */
export function zugangVollstaendig(z: MarktplaatsZugang): boolean {
  return Boolean(z.clientId && z.clientSecret && z.apiUrl && z.authUrl && z.postleitzahl);
}

/** Der aktuell gültige Zugang. Wirft nie. */
export async function ladeZugang(opts: { frisch?: boolean } = {}): Promise<ZugangMitQuelle> {
  if (!opts.frisch && cache && Date.now() < cache.bis) return cache.wert;

  const umgebung = ausUmgebungsvariablen();
  const fallback = (): ZugangMitQuelle => ({
    ...mitVorgaben(umgebung),
    quelle: umgebung.clientId && umgebung.clientSecret ? 'umgebung' : 'leer',
    secretUnlesbar: false,
    geaendertVon: null,
    geaendertAm: null,
  });

  const supabase = createAdminClient();
  if (!supabase) return merke(fallback());

  let zeile: Zeile | null = null;
  try {
    const { data, error } = await supabase
      .from('einstellungen')
      .select(
        'marktplaats_client_id, marktplaats_secret_enc, marktplaats_umgebung, marktplaats_api_url, marktplaats_plz, marktplaats_versand_cent, geaendert_von, geaendert_am',
      )
      .eq('id', 1)
      .maybeSingle();
    // Fehlt die Tabelle oder die Spalte noch, gelten weiter die
    // Umgebungsvariablen — das Schema nachzuziehen ist ein eigener Schritt.
    if (error) return merke(fallback());
    zeile = (data as Zeile | null) ?? null;
  } catch {
    return merke(fallback());
  }

  if (!zeile) return merke(fallback());

  const clientId = (zeile.marktplaats_client_id ?? '').trim();
  const secret = zeile.marktplaats_secret_enc ? entschluessele(zeile.marktplaats_secret_enc) : null;
  const secretUnlesbar = Boolean(zeile.marktplaats_secret_enc) && secret === null;
  // Wie beim Plenty-Zugang: nur ein vollständiges Paar verdrängt die
  // Umgebungsvariablen. Ein halb ausgefülltes Formular darf einen laufenden
  // Abgleich nicht lahmlegen.
  const vollstaendig = Boolean(clientId && secret);

  const gewaehlt = istUmgebung(zeile.marktplaats_umgebung) ? zeile.marktplaats_umgebung : umgebung.umgebung;

  return merke({
    ...mitVorgaben({
      clientId: vollstaendig ? clientId : umgebung.clientId,
      clientSecret: vollstaendig ? secret! : umgebung.clientSecret,
      umgebung: gewaehlt,
      apiUrl: (zeile.marktplaats_api_url ?? '').trim() || (gewaehlt === umgebung.umgebung ? umgebung.apiUrl : ''),
      authUrl: gewaehlt === umgebung.umgebung ? umgebung.authUrl : '',
      postleitzahl: (zeile.marktplaats_plz ?? '').trim().toUpperCase().replace(/\s+/g, '') || umgebung.postleitzahl,
      versandEuro:
        typeof zeile.marktplaats_versand_cent === 'number'
          ? zeile.marktplaats_versand_cent / 100
          : umgebung.versandEuro,
    }),
    quelle: vollstaendig ? 'datenbank' : fallback().quelle,
    secretUnlesbar,
    geaendertVon: zeile.geaendert_von,
    geaendertAm: zeile.geaendert_am,
  });
}

function merke(wert: ZugangMitQuelle): ZugangMitQuelle {
  cache = { wert, bis: Date.now() + CACHE_MS };
  return wert;
}

export interface Speicherwunsch {
  clientId?: string | null;
  /** Klartext. Leer/undefined lässt das gespeicherte Secret unberührt. */
  clientSecret?: string | null;
  umgebung?: Umgebung | null;
  apiUrl?: string | null;
  postleitzahl?: string | null;
  versandEuro?: number | null;
  von?: string | null;
}

export interface Speicherergebnis {
  ok: boolean;
  fehler: string | null;
}

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
  if (wunsch.clientId !== undefined) felder.marktplaats_client_id = (wunsch.clientId ?? '').trim() || null;
  if (wunsch.umgebung !== undefined) felder.marktplaats_umgebung = wunsch.umgebung ?? null;
  if (wunsch.apiUrl !== undefined) felder.marktplaats_api_url = (wunsch.apiUrl ?? '').trim().replace(/\/+$/, '') || null;
  if (wunsch.postleitzahl !== undefined) {
    felder.marktplaats_plz = (wunsch.postleitzahl ?? '').trim().toUpperCase().replace(/\s+/g, '') || null;
  }
  if (wunsch.versandEuro !== undefined) {
    // In Cent ablegen: Marktplaats rechnet in Cent, und eine Kommazahl in der
    // Datenbank käme irgendwann als 6.949999999999999 zurück.
    felder.marktplaats_versand_cent =
      typeof wunsch.versandEuro === 'number' && Number.isFinite(wunsch.versandEuro)
        ? Math.round(wunsch.versandEuro * 100)
        : null;
  }

  if (wunsch.clientSecret) {
    if (!tresorBereit()) {
      return {
        ok: false,
        fehler:
          'Es fehlt ein Schlüssel zum Verschlüsseln (EINSTELLUNGEN_SCHLUESSEL oder SUPABASE_SERVICE_ROLE_KEY). Ohne ihn wird das Client-Secret nicht gespeichert.',
      };
    }
    felder.marktplaats_secret_enc = verschluessele(wunsch.clientSecret);
  }

  const { error } = await supabase.from('einstellungen').upsert(felder, { onConflict: 'id' });
  vergissZugang();
  if (error) {
    return {
      ok: false,
      fehler: /relation .* does not exist|schema cache|column .* does not exist/i.test(error.message)
        ? 'Die Marktplaats-Spalten fehlen — bitte supabase/schema.sql im SQL-Editor ausführen.'
        : `Speichern fehlgeschlagen: ${error.message}`,
    };
  }
  return { ok: true, fehler: null };
}
