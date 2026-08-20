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
