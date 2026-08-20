/** Zustände, wie sie in der Datenbank stehen. */
export type AutomationStatus = 'running' | 'stopped' | 'error' | 'paused';
export type RunStatus = 'running' | 'success' | 'error' | 'cancelled';
export type FehlerSchwere = 'kritisch' | 'hoch' | 'mittel' | 'niedrig';
export type FehlerStatus = 'open' | 'in_progress' | 'resolved';
export type BefehlAktion = 'start' | 'stop' | 'run_now' | 'retry' | 'cancel';
export type BefehlStatus = 'pending' | 'accepted' | 'done' | 'failed';
export type Rolle = 'viewer' | 'operator' | 'admin';

export interface Profil {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Rolle;
  active: boolean;
}

export interface Automation {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: AutomationStatus;
  responsible_id: string | null;
  schedule_cron: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  n8n_workflow_id: string | null;
  n8n_instance: string | null;
  is_active: boolean;
}

export interface Durchlauf {
  id: string;
  automation_id: string;
  status: RunStatus;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  items_total: number | null;
  items_success: number | null;
  items_failed: number | null;
  triggered_by: string | null;
  trigger_type: string | null;
  error_message_readable: string | null;
  error_message_raw: string | null;
  raw_log_url: string | null;
}

export interface Fehler {
  id: string;
  automation_id: string | null;
  run_id: string | null;
  severity: FehlerSchwere;
  status: FehlerStatus;
  title: string | null;
  message_readable: string | null;
  assigned_to: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string | null;
}

export interface Befehl {
  id: string;
  automation_id: string | null;
  run_id: string | null;
  action: BefehlAktion;
  status: BefehlStatus;
  requested_by: string | null;
  requested_at: string | null;
  processed_at: string | null;
}

/** Kennzahlen der letzten 24 Stunden, aus v_dashboard_summary_24h. */
export interface Kennzahlen24h {
  gesamt: number;
  erfolgreich: number;
  fehlerhaft: number;
  laufend: number;
}

/** Ein Tag aus v_reliability_trend_14d. */
export interface Trendtag {
  tag: string;
  quote: number | null;
  gesamt: number;
}

/** Eine Zeile aus v_automation_overview. */
export interface AutomationUebersicht {
  id: string;
  name: string;
  category: string | null;
  status: AutomationStatus;
  zuverlaessigkeit14d: number | null;
  offeneFehler: number;
  zustaendigId: string | null;
  zustaendigName: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  scheduleCron: string | null;
  isActive: boolean;
}

/** Eine Zeile aus v_open_errors_ranked. */
export interface OffenerFehler extends Fehler {
  automationName: string | null;
}
