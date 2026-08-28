export type Rolle = 'admin' | 'operator' | 'viewer'

export type AutomationStatus = 'active' | 'paused' | 'error' | 'draft'
export type AusfuehrungStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled'
export type FehlerStatus = 'open' | 'acknowledged' | 'resolved'
export type Schwere = 'warning' | 'error' | 'critical'
export type Quelle = 'n8n' | 'cron' | 'python' | 'webhook' | 'extern' | 'manual'

export interface Nutzer {
  id: string
  email: string
  name: string
  role: Rolle
  is_active: boolean
  last_login_at: Date | null
  created_at: Date
}

export interface Automation {
  id: string
  key: string
  name: string
  description: string | null
  category: string | null
  source: Quelle
  status: AutomationStatus
  schedule_cron: string | null
  schedule_label: string | null
  owner: string | null
  config: Record<string, unknown>
  last_run_at: Date | null
  next_run_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface AutomationMitKennzahlen extends Automation {
  laeufe_24h: number
  fehler_24h: number
  offene_fehler: number
  erfolgsquote: number | null
  letzter_status: AusfuehrungStatus | null
  letzte_dauer_ms: number | null
}

export interface Ausführung {
  id: string
  automation_id: string
  status: AusfuehrungStatus
  trigger: 'schedule' | 'manual' | 'webhook' | 'retry'
  triggered_by: string | null
  started_at: Date
  finished_at: Date | null
  duration_ms: number | null
  items_processed: number
  input: Record<string, unknown>
  output: Record<string, unknown>
  error_message: string | null
  retry_of: string | null
  external_id: string | null
}

export interface AusfuehrungMitAutomation extends Ausführung {
  automation_name: string
  automation_key: string
  ausgeloest_von: string | null
}

export interface LogZeile {
  id: string
  execution_id: string
  ts: Date
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  data: Record<string, unknown> | null
}

export interface Fehler {
  id: string
  automation_id: string | null
  execution_id: string | null
  occurred_at: Date
  severity: Schwere
  code: string | null
  message: string
  stack: string | null
  context: Record<string, unknown>
  status: FehlerStatus
  acknowledged_by: string | null
  acknowledged_at: Date | null
  resolved_at: Date | null
  note: string | null
}

export interface FehlerMitAutomation extends Fehler {
  automation_name: string | null
  automation_key: string | null
  bearbeitet_von: string | null
}

export interface ProtokollEintrag {
  id: string
  at: Date
  user_name: string | null
  action: string
  target_type: string | null
  target_id: string | null
  target_name: string | null
  meta: Record<string, unknown>
}
