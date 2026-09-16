/**
 * Ablage der Artikelfotos im Supabase-Storage.
 *
 * WARUM SIGNIERTE UPLOAD-URLS statt Upload über eine eigene API-Route:
 * Serverless-Funktionen auf Vercel nehmen nur rund 4,5 MB Anfrage-Körper an.
 * Ein Handyfoto in voller Auflösung liegt darüber. Ginge der Upload durch die
 * App, müssten die Bilder vorher kleingerechnet werden — also genau der
 * Qualitätsverlust, wegen dem wir WhatsApp aus der Kette geworfen haben.
 * Der Browser lädt deshalb direkt zum Storage; die App vergibt nur die
 * Erlaubnis dafür und schreibt mit, was hochgeladen wurde.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export const BILDER_BUCKET = 'artikelfotos';

/** Wie lange eine Ansichts-URL gilt. Kurz — sie wird bei jedem Aufruf neu erzeugt. */
export const ANSICHT_TTL = 60 * 60; // 1 Stunde

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Service-Role-Client oder eine Meldung, die sagt, was zu tun ist. */
export function adminOderFehler(): { admin: Admin } | { fehler: string } {
  const admin = createAdminClient();
  if (!admin) {
    return { fehler: 'SUPABASE_SERVICE_ROLE_KEY fehlt — ohne ihn lassen sich keine Fotos ablegen.' };
  }
  return { admin };
}

/** Legt den Bucket bei Bedarf an. Existiert er schon, passiert nichts. */
export async function bucketSicherstellen(admin: Admin): Promise<void> {
  try {
    await admin.storage.createBucket(BILDER_BUCKET, { public: false });
  } catch {
    /* existiert bereits – ignorieren */
  }
}

/**
 * Erlaubnis für genau einen Upload an genau diesen Pfad.
 * Der Browser lädt damit direkt hoch, ohne Zugangsdaten zu sehen.
 */
export async function uploadErlaubnis(
  admin: Admin,
  pfad: string,
): Promise<{ token: string; url: string } | { fehler: string }> {
  await bucketSicherstellen(admin);
  const { data, error } = await admin.storage.from(BILDER_BUCKET).createSignedUploadUrl(pfad);
  if (error || !data) return { fehler: error?.message ?? 'Upload-Erlaubnis fehlgeschlagen.' };
  return { token: data.token, url: data.signedUrl };
}

/** Signierte Leselinks für mehrere Pfade auf einmal (für Vorschaubilder). */
export async function ansichtsLinks(admin: Admin, pfade: string[]): Promise<Record<string, string>> {
  if (pfade.length === 0) return {};
  const { data, error } = await admin.storage.from(BILDER_BUCKET).createSignedUrls(pfade, ANSICHT_TTL);
  if (error || !data) return {};
  const karte: Record<string, string> = {};
  for (const eintrag of data) {
    if (eintrag.path && eintrag.signedUrl) karte[eintrag.path] = eintrag.signedUrl;
  }
  return karte;
}

/**
 * Entfernt Dateien. Fehler werden bewusst geschluckt: Eine verwaiste Datei im
 * Storage ist ein Schönheitsfehler, ein abgebrochenes Löschen eines Artikels
 * wäre einer im Ablauf.
 */
export async function bilderEntfernen(admin: Admin, pfade: string[]): Promise<void> {
  if (pfade.length === 0) return;
  try {
    await admin.storage.from(BILDER_BUCKET).remove(pfade);
  } catch {
    /* verwaiste Datei – nicht schlimm genug, um den Ablauf zu stoppen */
  }
}
