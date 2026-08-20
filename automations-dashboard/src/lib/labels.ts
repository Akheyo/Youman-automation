import type { ZeichenName } from '../components/Icons';
import type {
  AutomationStatus,
  BefehlAktion,
  BefehlStatus,
  FehlerSchwere,
  FehlerStatus,
  Rolle,
  RunStatus,
} from './types';

/** Blau heißt in Ordnung, Gelb heißt hinschauen, Rot heißt kaputt. */
export type Ton = 'blau' | 'gelb' | 'rot' | 'leise';

export const automationText: Record<AutomationStatus, string> = {
  running: 'Läuft',
  stopped: 'Angehalten',
  paused: 'Pausiert',
  error: 'Hat ein Problem',
};

export const automationTon: Record<AutomationStatus, Ton> = {
  running: 'blau',
  stopped: 'leise',
  paused: 'gelb',
  error: 'rot',
};

export const durchlaufText: Record<RunStatus, string> = {
  running: 'Läuft gerade',
  success: 'Erfolgreich',
  error: 'Fehlgeschlagen',
  cancelled: 'Abgebrochen',
};

export const durchlaufTon: Record<RunStatus, Ton> = {
  running: 'blau',
  success: 'blau',
  error: 'rot',
  cancelled: 'leise',
};

export const schwereText: Record<FehlerSchwere, string> = {
  kritisch: 'Kritisch',
  hoch: 'Hoch',
  mittel: 'Mittel',
  niedrig: 'Niedrig',
};

export const schwereTon: Record<FehlerSchwere, Ton> = {
  kritisch: 'rot',
  hoch: 'rot',
  mittel: 'gelb',
  niedrig: 'blau',
};

export const schwereRang: Record<FehlerSchwere, number> = {
  kritisch: 0,
  hoch: 1,
  mittel: 2,
  niedrig: 3,
};

export const fehlerStatusText: Record<FehlerStatus, string> = {
  open: 'Offen',
  in_progress: 'Jemand kümmert sich',
  resolved: 'Erledigt',
};

export const aktionText: Record<BefehlAktion, string> = {
  start: 'Wieder anschalten',
  stop: 'Anhalten',
  run_now: 'Jetzt sofort starten',
  retry: 'Nochmal versuchen',
  cancel: 'Laufenden Durchlauf abbrechen',
};

/** Was in der Oberfläche steht, während der Auftrag noch offen ist. */
export const aktionWartet: Record<BefehlAktion, string> = {
  start: 'Wird wieder angeschaltet',
  stop: 'Wird angehalten',
  run_now: 'Start ist angefordert',
  retry: 'Wiederholung ist angefordert',
  cancel: 'Abbruch ist angefordert',
};

export const befehlStatusText: Record<BefehlStatus, string> = {
  pending: 'Wartet auf Ausführung',
  accepted: 'Angenommen',
  done: 'Ausgeführt',
  failed: 'Nicht ausgeführt',
};

export const befehlStatusTon: Record<BefehlStatus, Ton> = {
  pending: 'gelb',
  accepted: 'blau',
  done: 'blau',
  failed: 'rot',
};

export const rolleText: Record<Rolle, string> = {
  viewer: 'Zuschauen',
  operator: 'Steuern',
  admin: 'Alles, auch Zugänge',
};

export const rolleErklaerung: Record<Rolle, string> = {
  viewer: 'Sieht alles, steuert nichts.',
  operator: 'Sieht alles, darf steuern und Fehler abhaken.',
  admin: 'Darf zusätzlich Zugänge vergeben und entziehen.',
};

export const ausloeserText: Record<string, string> = {
  schedule: 'nach Zeitplan',
  manual: 'von Hand gestartet',
  retry: 'Wiederholung',
};

export function ausloeser(art: string | null | undefined): string {
  if (!art) return 'unbekannter Anlass';
  return ausloeserText[art] ?? art;
}

/* Farbe allein erzählt nichts. Zu jedem Zustand gehört ein eigenes Zeichen. */

export const automationZeichen: Record<AutomationStatus, ZeichenName> = {
  running: 'kreisel',
  stopped: 'stopp',
  paused: 'pause',
  error: 'warndreieck',
};

export const durchlaufZeichen: Record<RunStatus, ZeichenName> = {
  running: 'kreisel',
  success: 'haken',
  error: 'warndreieck',
  cancelled: 'stopp',
};

export const schwereZeichen: Record<FehlerSchwere, ZeichenName> = {
  kritisch: 'kritisch',
  hoch: 'warndreieck',
  mittel: 'warnkreis',
  niedrig: 'auskunft',
};

export const aktionZeichen: Record<BefehlAktion, ZeichenName> = {
  start: 'start',
  stop: 'pause',
  run_now: 'blitz',
  retry: 'wiederholen',
  cancel: 'stopp',
};

export const befehlStatusZeichen: Record<BefehlStatus, ZeichenName> = {
  pending: 'uhr',
  accepted: 'kreisel',
  done: 'haken',
  failed: 'warndreieck',
};

export const fehlerStatusZeichen: Record<FehlerStatus, ZeichenName> = {
  open: 'warnkreis',
  in_progress: 'hand',
  resolved: 'haken',
};

/**
 * Im audit_log stehen kurze Schlüssel. Hier werden sie zu Sätzen, die man
 * ohne Erklärung versteht.
 */
export function protokollAktionText(aktion: string | null | undefined): string {
  if (!aktion) return 'Änderung';
  const rollenTreffer = /^rolle_geaendert_zu_(viewer|operator|admin)$/.exec(aktion);
  if (rollenTreffer) return `Rechte geändert auf: ${rolleText[rollenTreffer[1] as Rolle]}`;
  const bekannt: Record<string, string> = {
    zugang_gegeben: 'Zugang gegeben',
    zugang_entzogen: 'Zugang entzogen',
    rolle_geaendert: 'Rechte geändert',
  };
  return bekannt[aktion] ?? aktion.replace(/_/g, ' ');
}
