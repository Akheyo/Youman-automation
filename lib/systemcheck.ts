/**
 * Systemcheck — was ist eingerichtet, was fehlt noch?
 *
 * Beim Livegang ist die häufigste Frage nicht "wie deploye ich", sondern
 * "warum passiert nichts". Fast immer fehlt eine Umgebungsvariable oder das
 * Datenbankschema wurde nie eingespielt. Diese Datei sammelt beides an einer
 * Stelle: pro Baustein ein Ergebnis mit klarem nächsten Schritt.
 *
 * Bewusst nur Ja/Nein. Werte von Schlüsseln und Webhook-URLs tauchen nirgends
 * auf — weder in der Antwort noch im Protokoll.
 */

export type CheckLevel = 'pflicht' | 'outreach' | 'optional';

export interface Check {
  id: string;
  label: string;
  ok: boolean;
  /** Was der Zustand bedeutet — eine Zeile, ohne Fachjargon. */
  detail: string;
  /** Nächster Schritt, wenn es nicht ok ist. */
  hint?: string;
  level: CheckLevel;
  /** Umgebungsvariablen, an denen dieser Baustein hängt. */
  vars?: string[];
}

export interface CheckGroup {
  level: CheckLevel;
  title: string;
  subtitle: string;
  checks: Check[];
}

export type Env = Record<string, string | undefined>;

/** Gesetzt heißt: vorhanden und nicht nur Leerzeichen. */
export function isSet(env: Env, name: string): boolean {
  return (env[name] ?? '').trim().length > 0;
}

function allSet(env: Env, names: string[]): boolean {
  return names.every((n) => isSet(env, n));
}

/**
 * Ergebnis der Schema-Prüfung: welche Tabellen ließen sich abfragen.
 * `null` heißt "konnte nicht geprüft werden" (keine Datenbankverbindung).
 */
export interface SchemaProbe {
  missing: string[];
  checked: number;
}

/** Tabellen, ohne die Paul nicht arbeiten kann. */
export const OUTREACH_TABLES = [
  'outreach_campaigns',
  'outreach_steps',
  'outreach_contacts',
  'outreach_events',
  'outreach_suppression',
];

export function collectChecks(env: Env, schema: SchemaProbe | null): CheckGroup[] {
  const supabase = allSet(env, ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
  const serviceRole = isSet(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const appUrl = isSet(env, 'APP_URL');
  const sender = isSet(env, 'OUTREACH_WEBHOOK_URL') || isSet(env, 'FELIX_PITCH_WEBHOOK_URL');
  const eigenerVersand = isSet(env, 'OUTREACH_WEBHOOK_URL');

  const pflicht: Check[] = [
    {
      id: 'supabase',
      label: 'Datenbank & Login',
      ok: supabase,
      detail: supabase
        ? 'Supabase ist verbunden. Anmeldung und Datenhaltung laufen.'
        : 'Ohne Supabase gibt es keinen Login und keine gespeicherten Kampagnen.',
      hint: 'Supabase-Projekt anlegen, dann Project URL und anon key als Variablen setzen.',
      level: 'pflicht',
      vars: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    },
    {
      id: 'service_role',
      label: 'Service-Role-Schlüssel',
      ok: serviceRole,
      detail: serviceRole
        ? 'Hintergrundaufgaben dürfen auf die Datenbank zugreifen.'
        : 'Ohne ihn laufen Versand-Cron, Abmeldelink und Antwort-Webhook nicht — alles, was ohne angemeldeten Nutzer passiert.',
      hint: 'Supabase → Project Settings → API → service_role key. Gehört nur auf den Server, nie in den Browser.',
      level: 'pflicht',
      vars: ['SUPABASE_SERVICE_ROLE_KEY'],
    },
    {
      id: 'app_url',
      label: 'Öffentliche Adresse der App',
      ok: appUrl,
      detail: appUrl
        ? 'Abmeldelinks und Zählpixel bekommen eine gültige Adresse.'
        : 'Ohne sie kann kein Abmeldelink erzeugt werden — und ohne Abmeldelink darf keine Kaltakquise-Mail raus.',
      hint: 'Die Adresse, unter der die App erreichbar ist, z. B. https://app.deine-domain.de — ohne Schrägstrich am Ende.',
      level: 'pflicht',
      vars: ['APP_URL'],
    },
  ];

  const outreach: Check[] = [
    {
      id: 'schema',
      label: 'Datenbankschema eingespielt',
      ok: schema !== null && schema.missing.length === 0,
      detail:
        schema === null
          ? 'Konnte nicht geprüft werden — dafür müssen Datenbank und Service-Role-Schlüssel stehen.'
          : schema.missing.length === 0
            ? `Alle ${schema.checked} Outreach-Tabellen sind vorhanden.`
            : `Es fehlen: ${schema.missing.join(', ')}.`,
      hint: 'supabase/schema.sql komplett im Supabase-SQL-Editor ausführen. Das ist gefahrlos wiederholbar.',
      level: 'outreach',
    },
    {
      id: 'sender',
      label: 'Versandweg',
      ok: sender,
      detail: sender
        ? eigenerVersand
          ? 'Eigener Outreach-Webhook ist gesetzt.'
          : 'Läuft über den Felix-Pitch-Webhook. Funktioniert, ein eigener Endpunkt ist aber sauberer.'
        : 'Es lässt sich texten, importieren und Vorschau ansehen — aber nichts verschicken.',
      hint: 'OUTREACH_WEBHOOK_URL auf einen Webhook setzen, der die Mail per SMTP zustellt. Details in SETUP-PAUL.md.',
      level: 'outreach',
      vars: ['OUTREACH_WEBHOOK_URL'],
    },
    {
      id: 'cron',
      label: 'Versand-Scheduler geschützt',
      ok: isSet(env, 'CRON_SECRET'),
      detail: isSet(env, 'CRON_SECRET')
        ? 'Nur Aufrufe mit dem Geheimnis lösen einen Versandlauf aus.'
        : 'Der Scheduler ist offen erreichbar — jeder könnte einen Versandlauf auslösen.',
      hint: 'CRON_SECRET auf eine lange Zufallszeichenfolge setzen. Vercel Cron schickt sie danach automatisch mit.',
      level: 'outreach',
      vars: ['CRON_SECRET'],
    },
  ];

  const optional: Check[] = [
    {
      id: 'felix',
      label: 'Felix — Lead-Suche',
      ok: isSet(env, 'OPENROUTER_API_KEY'),
      detail: isSet(env, 'OPENROUTER_API_KEY') ? 'Der Chat-Agent ist einsatzbereit.' : 'Der Chat unter /felix bleibt inaktiv.',
      hint: 'OPENROUTER_API_KEY von openrouter.ai. Für Firmendaten zusätzlich GOOGLE_MAPS_API_KEY.',
      level: 'optional',
      vars: ['OPENROUTER_API_KEY', 'GOOGLE_MAPS_API_KEY'],
    },
    {
      id: 'lina',
      label: 'Lina — Telefon-Agent',
      ok: allSet(env, ['VAPI_API_KEY', 'VAPI_PHONE_NUMBER_ID']),
      detail: allSet(env, ['VAPI_API_KEY', 'VAPI_PHONE_NUMBER_ID'])
        ? 'Ausgehende KI-Anrufe sind möglich.'
        : 'Anrufe sind aus. Paul funktioniert davon unabhängig.',
      hint: 'Schlüssel und Nummern-ID aus dem Vapi-Dashboard.',
      level: 'optional',
      vars: ['VAPI_API_KEY', 'VAPI_PHONE_NUMBER_ID'],
    },
    {
      id: 'google',
      label: 'Google Kalender',
      ok: allSet(env, ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']),
      detail: allSet(env, ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'])
        ? 'Lina kann Termine selbst eintragen.'
        : 'Terminbuchung im Kalender ist aus.',
      hint: 'OAuth-Client in der Google Cloud Console anlegen, Calendar API aktivieren.',
      level: 'optional',
      vars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'],
    },
    {
      id: 'stripe',
      label: 'Abrechnung',
      ok: isSet(env, 'STRIPE_SECRET_KEY'),
      detail: isSet(env, 'STRIPE_SECRET_KEY')
        ? 'Abos lassen sich buchen.'
        : 'Kein Bezahlvorgang. Für den eigenen Betrieb nicht nötig.',
      hint: 'Erst relevant, wenn Sie die App an Kunden verkaufen.',
      level: 'optional',
      vars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    },
    {
      id: 'sentry',
      label: 'Fehler-Monitoring',
      ok: isSet(env, 'NEXT_PUBLIC_SENTRY_DSN'),
      detail: isSet(env, 'NEXT_PUBLIC_SENTRY_DSN') ? 'Fehler landen in Sentry.' : 'Fehler sieht nur, wer ins Server-Log schaut.',
      hint: 'Empfehlenswert, sobald echte Kampagnen laufen.',
      level: 'optional',
      vars: ['NEXT_PUBLIC_SENTRY_DSN'],
    },
  ];

  return [
    {
      level: 'pflicht',
      title: 'Ohne das läuft nichts',
      subtitle: 'Diese drei müssen grün sein, bevor die erste Mail rausgeht.',
      checks: pflicht,
    },
    {
      level: 'outreach',
      title: 'Cold-Outreach',
      subtitle: 'Was Paul zum Arbeiten braucht.',
      checks: outreach,
    },
    {
      level: 'optional',
      title: 'Der Rest',
      subtitle: 'Nützlich, aber nicht nötig, um zu starten.',
      checks: optional,
    },
  ];
}

/** Kurzfassung fürs Seitenende: kann jetzt versendet werden? */
export function versandBereit(groups: CheckGroup[]): boolean {
  const relevant = groups.filter((g) => g.level !== 'optional');
  return relevant.every((g) => g.checks.every((c) => c.ok || c.id === 'cron'));
}
