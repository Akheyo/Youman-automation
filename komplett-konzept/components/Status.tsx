import type { AusfuehrungStatus, AutomationStatus, FehlerStatus, Schwere } from '@/lib/types'

type Ton = 'ok' | 'fehler' | 'warn' | 'laeuft' | 'neutral'

function Plakette({ ton, text }: { ton: Ton; text: string }) {
  return (
    <span className={`status status--${ton}`}>
      <span className="status__punkt" />
      {text}
    </span>
  )
}

const AUTOMATION: Record<AutomationStatus, { ton: Ton; text: string }> = {
  active: { ton: 'ok', text: 'Aktiv' },
  paused: { ton: 'neutral', text: 'Pausiert' },
  error: { ton: 'fehler', text: 'Gestört' },
  draft: { ton: 'neutral', text: 'Entwurf' },
}

const AUSFUEHRUNG: Record<AusfuehrungStatus, { ton: Ton; text: string }> = {
  queued: { ton: 'neutral', text: 'Wartet' },
  running: { ton: 'laeuft', text: 'Läuft' },
  success: { ton: 'ok', text: 'Erfolgreich' },
  failed: { ton: 'fehler', text: 'Fehlgeschlagen' },
  cancelled: { ton: 'neutral', text: 'Abgebrochen' },
}

const FEHLER: Record<FehlerStatus, { ton: Ton; text: string }> = {
  open: { ton: 'fehler', text: 'Offen' },
  acknowledged: { ton: 'warn', text: 'In Arbeit' },
  resolved: { ton: 'ok', text: 'Erledigt' },
}

const SCHWERE: Record<Schwere, { ton: Ton; text: string }> = {
  warning: { ton: 'warn', text: 'Warnung' },
  error: { ton: 'fehler', text: 'Fehler' },
  critical: { ton: 'fehler', text: 'Kritisch' },
}

export const AutomationStatusPlakette = ({ status }: { status: AutomationStatus }) => (
  <Plakette {...(AUTOMATION[status] ?? AUTOMATION.draft)} />
)
export const LaufStatusPlakette = ({ status }: { status: AusfuehrungStatus }) => (
  <Plakette {...(AUSFUEHRUNG[status] ?? AUSFUEHRUNG.queued)} />
)
export const FehlerStatusPlakette = ({ status }: { status: FehlerStatus }) => (
  <Plakette {...(FEHLER[status] ?? FEHLER.open)} />
)
export const SchwerePlakette = ({ severity }: { severity: Schwere }) => (
  <Plakette {...(SCHWERE[severity] ?? SCHWERE.error)} />
)

export const QUELLE_LABEL: Record<string, string> = {
  n8n: 'n8n',
  cron: 'Zeitplan',
  python: 'Python',
  webhook: 'Webhook',
  extern: 'Extern',
  manual: 'Manuell',
}

export const AUSLOESER_LABEL: Record<string, string> = {
  schedule: 'Zeitplan',
  manual: 'Manuell',
  webhook: 'Webhook',
  retry: 'Wiederholung',
}
