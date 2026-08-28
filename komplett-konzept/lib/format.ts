// Einheitliche Darstellung von Zeiten, Dauern und Zahlen - immer deutsch,
// immer Europe/Berlin, damit Server und Browser dasselbe anzeigen.
const ZONE = 'Europe/Berlin'

const dfDatumZeit = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
  timeZone: ZONE,
})

const dfZeit = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: ZONE,
})

const dfDatum = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONE,
})

export function datumZeit(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return dfDatumZeit.format(new Date(d))
}

export function nurZeit(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return dfZeit.format(new Date(d))
}

export function nurDatum(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return dfDatum.format(new Date(d))
}

/** "vor 3 Min", "vor 2 Std", "in 12 Min" */
export function relativeZeit(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const ms = new Date(d).getTime() - Date.now()
  const zukunft = ms > 0
  const s = Math.abs(ms) / 1000

  const teil = (wert: number, einheit: string) =>
    (zukunft ? 'in ' : 'vor ') + Math.round(wert) + ' ' + einheit

  if (s < 45) return zukunft ? 'gleich' : 'gerade eben'
  if (s < 5400) return teil(s / 60, 'Min')
  if (s < 172800) return teil(s / 3600, 'Std')
  return teil(s / 86400, 'Tagen')
}

/** 1234 -> "1,2 s", 65000 -> "1:05 min" */
export function dauer(roh: number | null | undefined): string {
  const ms = alsZahl(roh)
  if (ms === null) return '—'
  if (ms < 1000) return ms + ' ms'
  if (ms < 60_000) return (ms / 1000).toFixed(1).replace('.', ',') + ' s'
  const min = Math.floor(ms / 60_000)
  const sek = Math.round((ms % 60_000) / 1000)
  return min + ':' + String(sek).padStart(2, '0') + ' min'
}

export function zahl(n: number | null | undefined): string {
  const w = alsZahl(n)
  if (w === null) return '—'
  return new Intl.NumberFormat('de-DE').format(w)
}

export function prozent(n: number | null | undefined, stellen = 0): string {
  const w = alsZahl(n)
  if (w === null) return '—'
  return w.toFixed(stellen).replace('.', ',') + ' %'
}

/** Postgres liefert numeric-Werte als Text - hier einmal zentral einfangen. */
function alsZahl(n: unknown): number | null {
  if (n === null || n === undefined || n === '') return null
  const w = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(w) ? w : null
}
