import 'server-only'

/**
 * Schlanker PlentyONE-Zugang: anmelden und lesen. Mehr braucht das Dashboard
 * nicht — es schreibt nichts nach Plenty zurück.
 *
 * Der Ablauf ist der dokumentierte: POST /rest/login liefert ein Token, das
 * anschließend als Bearer mitgeht. Das Token wird gehalten, bis es abläuft;
 * ein Abgleich über hunderte Seiten meldet sich sonst hunderte Male an.
 *
 * Fehler werden mit Pfad und Antwortanfang gemeldet. "HTTP 401" allein hat
 * schon einmal einen halben Tag gekostet — die Antwort von Plenty sagt
 * meistens genau, was fehlt (Recht, Mandant, abgelaufenes Token).
 */

export interface PlentyConfig {
  baseUrl: string
  user: string
  password: string
}

export function plentyConfig(): PlentyConfig {
  return {
    baseUrl: (process.env.PLENTY_BASE_URL ?? '').trim().replace(/\/+$/, ''),
    user: (process.env.PLENTY_USER ?? '').trim(),
    password: process.env.PLENTY_PASSWORD ?? '',
  }
}

export function plentyEingerichtet(cfg = plentyConfig()): boolean {
  return Boolean(cfg.baseUrl && cfg.user && cfg.password)
}

let token: string | null = null
let tokenBis = 0

function tokenVerwerfen(): void {
  token = null
  tokenBis = 0
}

async function anmelden(cfg: PlentyConfig): Promise<string> {
  const jetzt = Date.now()
  if (token && jetzt < tokenBis) return token

  const res = await fetch(`${cfg.baseUrl}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: cfg.user, password: cfg.password }),
  })
  const roh = await res.text()
  if (!res.ok) {
    throw new Error(`Plenty-Login fehlgeschlagen (HTTP ${res.status}): ${roh.slice(0, 200)}`)
  }

  let daten: { access_token?: string; accessToken?: string; expires_in?: number }
  try {
    daten = JSON.parse(roh)
  } catch {
    throw new Error(
      `Plenty-Login: keine gültige JSON-Antwort (HTTP ${res.status}). PLENTY_BASE_URL muss die REST-Basis sein, ` +
        `ohne "/rest" am Ende. Antwortanfang: "${roh.slice(0, 160)}"`,
    )
  }

  const neu = daten.access_token ?? daten.accessToken
  if (!neu) throw new Error('Plenty-Login: Antwort enthielt kein access_token.')

  token = neu
  tokenBis = jetzt + (Number(daten.expires_in ?? 3600) - 60) * 1000
  return neu
}

/** Eine Leseanfrage. Bei abgelaufenem Token wird genau einmal neu angemeldet. */
export async function plentyGet<T>(pfad: string, cfg = plentyConfig()): Promise<T> {
  if (!plentyEingerichtet(cfg)) {
    throw new Error('PlentyONE ist nicht eingerichtet (PLENTY_BASE_URL / PLENTY_USER / PLENTY_PASSWORD).')
  }

  const anfrage = async (): Promise<Response> => {
    const t = await anmelden(cfg)
    return fetch(`${cfg.baseUrl}${pfad}`, {
      headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
      cache: 'no-store',
    })
  }

  let res = await anfrage()
  if (res.status === 401) {
    tokenVerwerfen()
    res = await anfrage()
  }

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Plenty GET ${pfad} → HTTP ${res.status}${text ? `: ${text.slice(0, 300)}` : ''}`)
  }
  if (!text) return null as unknown as T

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Plenty GET ${pfad}: Antwort kein gültiges JSON. Anfang: "${text.slice(0, 160)}"`)
  }
}

/** Seitenweise Antwort, wie Plenty sie liefert. */
export interface PlentyListe<T> {
  entries?: T[]
  page?: number
  isLastPage?: boolean
  lastPageNumber?: number
  totalsCount?: number
}
