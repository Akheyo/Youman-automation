import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { alsProzent, jaNein, text, zahl, zahlOderNull, type Zeile } from './fields';
import type {
  Automation,
  AutomationStatus,
  AutomationUebersicht,
  Befehl,
  BefehlAktion,
  Durchlauf,
  FehlerSchwere,
  Kennzahlen24h,
  OffenerFehler,
  Profil,
  Rolle,
  Trendtag,
} from './types';
import { schwereRang } from './labels';

/** Datenbankfehler in einen Satz übersetzen, der weiterhilft. */
export function fehlerText(fehler: PostgrestError | null, was: string): string | null {
  if (!fehler) return null;
  const code = fehler.code ?? '';
  if (code === '42P01') {
    return `${was} ist in der Datenbank nicht vorhanden. Bitte bei Amanuel melden.`;
  }
  if (code === '42501' || fehler.message.toLowerCase().includes('row-level security')) {
    return `Für ${was} fehlen dir die Rechte. Wende dich an Amanuel, wenn du das brauchst.`;
  }
  if (code === 'PGRST301' || fehler.message.toLowerCase().includes('jwt')) {
    return 'Deine Anmeldung ist abgelaufen. Bitte melde dich neu an.';
  }
  if (fehler.message.toLowerCase().includes('failed to fetch')) {
    return 'Keine Verbindung zur Datenbank. Prüfe deine Internetverbindung.';
  }
  return `${was} konnte nicht geladen werden. ${fehler.message}`;
}

function pruefe<T>(daten: T | null, fehler: PostgrestError | null, was: string): T {
  if (fehler) throw new Error(fehlerText(fehler, was) ?? fehler.message);
  return (daten ?? []) as T;
}

/* ---------------- Kennzahlen und Trend ---------------- */

export async function ladeKennzahlen24h(): Promise<Kennzahlen24h> {
  const { data, error } = await supabase.from('v_dashboard_summary_24h').select('*').limit(1);
  const zeilen = pruefe<Zeile[]>(data as Zeile[], error, 'Die Übersicht der letzten 24 Stunden');
  const zeile = zeilen[0] ?? null;

  const erfolgreich = zahlOderNull(zeile, [
    'runs_success',
    'erfolgreich',
    'success_runs',
    'successful_runs',
    'erfolgreiche_durchlaeufe',
    'success',
  ]);
  const fehlerhaft = zahlOderNull(zeile, [
    'runs_error',
    'fehlerhaft',
    'error_runs',
    'failed_runs',
    'fehlerhafte_durchlaeufe',
    'errors',
    'error',
  ]);
  const laufend = zahlOderNull(zeile, [
    'runs_running',
    'laufend',
    'running_runs',
    'running',
    'laufende_durchlaeufe',
  ]);
  const gesamtGelesen = zahl(zeile, [
    'runs_total',
    'gesamt',
    'total_runs',
    'laeufe_gesamt',
    'durchlaeufe_gesamt',
    'total',
  ]);

  return {
    gesamt: gesamtGelesen ?? erfolgreich + fehlerhaft + laufend,
    erfolgreich,
    fehlerhaft,
    laufend,
  };
}

export async function ladeTrend14d(): Promise<Trendtag[]> {
  const { data, error } = await supabase.from('v_reliability_trend_14d').select('*');
  const zeilen = pruefe<Zeile[]>(data as Zeile[], error, 'Der Verlauf der letzten 14 Tage');

  const tage = zeilen.map((zeile) => {
    const tag = text(zeile, ['tag', 'day', 'datum', 'date', 'bucket', 'tag_datum']) ?? '';
    const gesamt = zahlOderNull(zeile, ['runs_total', 'gesamt', 'total_runs', 'total', 'anzahl', 'runs']);
    const erfolgreich = zahl(zeile, ['runs_success', 'erfolgreich', 'success_runs', 'successful_runs', 'success']);
    let quote = alsProzent(
      zahl(zeile, [
        'erfolgsquote',
        'success_rate',
        'quote',
        'rate',
        'zuverlaessigkeit',
        'reliability',
        'erfolg_prozent',
        'success_percent',
        'erfolgsquote_prozent',
      ]),
    );
    if (quote === null && erfolgreich !== null && gesamt > 0) quote = (erfolgreich / gesamt) * 100;
    return { tag, quote, gesamt } satisfies Trendtag;
  });

  return tage
    .filter((tag) => tag.tag)
    .sort((a, b) => new Date(a.tag).getTime() - new Date(b.tag).getTime())
    .slice(-14);
}

/* ---------------- Automationen ---------------- */

export async function ladeAutomationsUebersicht(): Promise<AutomationUebersicht[]> {
  const { data, error } = await supabase.from('v_automation_overview').select('*');
  const zeilen = pruefe<Zeile[]>(data as Zeile[], error, 'Die Automationsübersicht');

  return zeilen
    .map((zeile) => ({
      id: text(zeile, ['id', 'automation_id']) ?? '',
      name: text(zeile, ['name', 'automation_name', 'automation']) ?? 'Ohne Namen',
      category: text(zeile, ['category', 'kategorie']),
      status: (text(zeile, ['status', 'automation_status']) ?? 'stopped') as AutomationStatus,
      zuverlaessigkeit14d: alsProzent(
        zahl(zeile, [
          'zuverlaessigkeit_14d',
          'reliability_14d',
          'erfolgsquote_14d',
          'success_rate_14d',
          'reliability',
          'erfolgsquote',
          'success_rate',
        ]),
      ),
      offeneFehler: zahlOderNull(zeile, [
        'offene_fehler',
        'open_errors',
        'open_error_count',
        'fehler_offen',
        'offene_fehler_anzahl',
        'errors_open',
      ]),
      zustaendigId: text(zeile, ['responsible_id', 'zustaendig_id', 'verantwortlich_id']),
      zustaendigName: text(zeile, [
        'responsible_name',
        'zustaendig',
        'zustaendiger',
        'verantwortlich',
        'responsible_full_name',
        'responsible',
      ]),
      lastRunAt: text(zeile, ['last_run_at', 'zuletzt', 'letzter_lauf']),
      nextRunAt: text(zeile, ['next_run_at', 'naechster_lauf', 'naechste_ausfuehrung']),
      scheduleCron: text(zeile, ['schedule_cron', 'zeitplan', 'cron']),
      isActive: jaNein(zeile, ['is_active', 'aktiv'], true),
    }))
    .filter((eintrag) => eintrag.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export async function ladeAutomationen(): Promise<Automation[]> {
  const { data, error } = await supabase.from('automations').select('*').order('name');
  return pruefe<Automation[]>(data as Automation[], error, 'Die Automationen');
}

/* ---------------- Durchläufe ---------------- */

export async function ladeDurchlaeufe(automationId: string, grenze = 15): Promise<Durchlauf[]> {
  const { data, error } = await supabase
    .from('automation_runs')
    .select('*')
    .eq('automation_id', automationId)
    .order('started_at', { ascending: false })
    .limit(grenze);
  return pruefe<Durchlauf[]>(data as Durchlauf[], error, 'Die Durchläufe');
}

export async function ladeLetzteDurchlaeufe(grenze = 25): Promise<Durchlauf[]> {
  const { data, error } = await supabase
    .from('automation_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(grenze);
  return pruefe<Durchlauf[]>(data as Durchlauf[], error, 'Die Durchläufe');
}

export async function ladeLaufendeDurchlaeufe(): Promise<Durchlauf[]> {
  const { data, error } = await supabase
    .from('automation_runs')
    .select('*')
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(25);
  return pruefe<Durchlauf[]>(data as Durchlauf[], error, 'Die laufenden Durchläufe');
}

/* ---------------- Fehler ---------------- */

export async function ladeOffeneFehler(): Promise<OffenerFehler[]> {
  const { data, error } = await supabase.from('v_open_errors_ranked').select('*');
  const zeilen = pruefe<Zeile[]>(data as Zeile[], error, 'Die offenen Fehler');

  return zeilen.map((zeile) => ({
    ...(zeile as unknown as OffenerFehler),
    id: text(zeile, ['id', 'error_id']) ?? '',
    automation_id: text(zeile, ['automation_id']),
    run_id: text(zeile, ['run_id']),
    severity: (text(zeile, ['severity', 'schwere']) ?? 'mittel') as FehlerSchwere,
    title: text(zeile, ['title', 'titel']),
    message_readable: text(zeile, ['message_readable', 'meldung', 'klartext']),
    created_at: text(zeile, ['created_at', 'erstellt_am', 'aufgetreten_am']),
    automationName: text(zeile, ['automation_name', 'automation', 'name']),
  }));
}

export async function fehlerUebernehmen(fehlerId: string, benutzerId: string): Promise<void> {
  const { error } = await supabase
    .from('automation_errors')
    .update({
      status: 'in_progress',
      assigned_to: benutzerId,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: benutzerId,
    })
    .eq('id', fehlerId);
  if (error) throw new Error(fehlerText(error, 'Das Übernehmen des Fehlers') ?? error.message);
}

export async function fehlerErledigen(fehlerId: string, benutzerId: string): Promise<void> {
  const { error } = await supabase
    .from('automation_errors')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: benutzerId,
    })
    .eq('id', fehlerId);
  if (error) throw new Error(fehlerText(error, 'Das Abhaken des Fehlers') ?? error.message);
}

export function sortiereFehler(fehler: OffenerFehler[]): OffenerFehler[] {
  return [...fehler].sort((a, b) => {
    const rang = (schwereRang[a.severity] ?? 9) - (schwereRang[b.severity] ?? 9);
    if (rang !== 0) return rang;
    const zeitA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const zeitB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return zeitB - zeitA;
  });
}

/* ---------------- Steuerung ---------------- */

export interface BefehlWunsch {
  automationId: string;
  aktion: BefehlAktion;
  runId?: string | null;
  benutzerId: string;
}

/**
 * Ein Klick auf einen Steuerknopf schreibt nur eine Zeile in control_commands.
 * Ein späterer Worker arbeitet die ab. Die Oberfläche zeigt so lange, dass der
 * Auftrag eingetragen ist.
 */
export async function befehlSchreiben({ automationId, aktion, runId, benutzerId }: BefehlWunsch): Promise<Befehl> {
  const { data, error } = await supabase
    .from('control_commands')
    .insert({
      automation_id: automationId,
      run_id: runId ?? null,
      action: aktion,
      status: 'pending',
      requested_by: benutzerId,
    })
    .select('*')
    .single();
  if (error) throw new Error(fehlerText(error, 'Der Auftrag') ?? error.message);
  return data as Befehl;
}

export async function ladeBefehle(grenze = 100): Promise<Befehl[]> {
  const { data, error } = await supabase
    .from('control_commands')
    .select('*')
    .order('requested_at', { ascending: false })
    .limit(grenze);
  return pruefe<Befehl[]>(data as Befehl[], error, 'Das Protokoll der Steuerung');
}

export async function ladeOffeneBefehle(): Promise<Befehl[]> {
  const { data, error } = await supabase
    .from('control_commands')
    .select('*')
    .in('status', ['pending', 'accepted'])
    .order('requested_at', { ascending: false })
    .limit(100);
  return pruefe<Befehl[]>(data as Befehl[], error, 'Die offenen Aufträge');
}

/* ---------------- Menschen und Zugänge ---------------- */

export async function ladeProfile(): Promise<Profil[]> {
  const { data, error } = await supabase.from('profiles').select('id, full_name, email, role, active');
  const profile = pruefe<Profil[]>(data as Profil[], error, 'Die Zugänge');
  return [...profile].sort((a, b) =>
    (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? '', 'de'),
  );
}

export async function rolleSetzen(profilId: string, rolle: Rolle): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role: rolle }).eq('id', profilId);
  if (error) throw new Error(fehlerText(error, 'Die Änderung der Rechte') ?? error.message);
}

export async function zugangSetzen(profilId: string, aktiv: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ active: aktiv }).eq('id', profilId);
  if (error) throw new Error(fehlerText(error, 'Die Änderung des Zugangs') ?? error.message);
}

/**
 * Der Protokolleintrag ist die zweite Hälfte jeder Zugangsänderung. Welche
 * Spalten audit_log genau hat, entscheidet die Datenbank. Deshalb werden
 * mehrere übliche Formen versucht, von der ausführlichsten zur einfachsten.
 */
export async function protokollSchreiben(eintrag: {
  akteurId: string;
  zielId: string;
  aktion: string;
  vorher?: unknown;
  nachher?: unknown;
}): Promise<boolean> {
  const versuche: Record<string, unknown>[] = [
    {
      actor_id: eintrag.akteurId,
      target_id: eintrag.zielId,
      action: eintrag.aktion,
      details: { vorher: eintrag.vorher ?? null, nachher: eintrag.nachher ?? null },
    },
    {
      actor_id: eintrag.akteurId,
      target_id: eintrag.zielId,
      action: eintrag.aktion,
    },
    {
      user_id: eintrag.akteurId,
      target_user_id: eintrag.zielId,
      action: eintrag.aktion,
    },
    {
      action: eintrag.aktion,
    },
  ];

  for (const werte of versuche) {
    const { error } = await supabase.from('audit_log').insert(werte);
    if (!error) return true;
    // 42703 = Spalte gibt es nicht, PGRST204 = Spalte im Schema unbekannt.
    if (error.code !== '42703' && error.code !== 'PGRST204') return false;
  }
  return false;
}

export async function ladeProtokoll(grenze = 100): Promise<Zeile[]> {
  const { data, error } = await supabase.from('audit_log').select('*').limit(grenze);
  if (error) return [];
  return (data ?? []) as Zeile[];
}
