/**
 * Postfach-Pool: mehrere Absender, Rotation und Anwärmen.
 *
 * Ein einzelnes Postfach hat eine harte Obergrenze — bei Google Workspace rund
 * 500 Empfänger am Tag, bei den meisten Providern deutlich weniger. Wer mehr
 * verschicken will, braucht mehrere Postfächer, am besten auf mehreren
 * Domains. Genau das ist der Unterschied zwischen "geht noch" und "Domain
 * verbrannt": nicht ein Postfach härter treten, sondern die Last verteilen.
 *
 * Konfiguriert wird über nummerierte Variablen, damit niemand JSON in ein
 * Vercel-Feld tippen muss:
 *
 *   SMTP_HOST / SMTP_USER / SMTP_PASS / SMTP_FROM      → Postfach 1
 *   SMTP_2_HOST / SMTP_2_USER / SMTP_2_PASS / ...      → Postfach 2
 *   SMTP_3_...                                          → Postfach 3, usw.
 *
 * Ohne Nummer bleibt alles wie bisher — ein Postfach, kein Umbau nötig.
 */

import type { Env } from './smtp';
import { type SmtpSettings } from './smtp';

/** Mehr als das sucht der Pool nicht — irgendwo ist Schluss. */
const MAX_POSTFAECHER = 20;

export interface Mailbox {
  /** Stabiler Name in Protokoll und Auswertung, z. B. "info@firma.de". */
  id: string;
  settings: SmtpSettings;
  /** Absenderadresse dieses Postfachs. */
  from: string;
  /** Harte Obergrenze am Tag, unabhängig vom Anwärmen. */
  dailyMax: number;
}

function zahl(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

/** Liest ein Postfach unter dem gegebenen Präfix ("SMTP" oder "SMTP_2"). */
function lesePostfach(env: Env, praefix: string, standardMax: number): Mailbox | null {
  const host = (env[`${praefix}_HOST`] ?? '').trim();
  const user = (env[`${praefix}_USER`] ?? '').trim();
  const pass = (env[`${praefix}_PASS`] ?? '').trim();
  if (!host || !user || !pass) return null;

  const port = zahl(env[`${praefix}_PORT`], 587);
  const secureRaw = (env[`${praefix}_SECURE`] ?? '').trim().toLowerCase();
  const secure = secureRaw ? secureRaw === 'true' || secureRaw === '1' : port === 465;
  const from = (env[`${praefix}_FROM`] ?? '').trim() || user;

  return {
    id: from.toLowerCase(),
    settings: { host, port, secure, user, pass },
    from,
    dailyMax: zahl(env[`${praefix}_DAILY_MAX`], standardMax),
  };
}

/**
 * Alle eingerichteten Postfächer, in der Reihenfolge ihrer Nummerierung.
 * Postfach 1 trägt kein Kürzel, damit bestehende Installationen unverändert
 * weiterlaufen.
 */
export function mailboxes(env: Env = process.env): Mailbox[] {
  const standardMax = zahl(env.SMTP_DAILY_MAX, 200);
  const out: Mailbox[] = [];

  const erstes = lesePostfach(env, 'SMTP', standardMax);
  if (erstes) out.push(erstes);

  for (let i = 2; i <= MAX_POSTFAECHER; i++) {
    const weiteres = lesePostfach(env, `SMTP_${i}`, standardMax);
    if (weiteres) out.push(weiteres);
  }
  return out;
}

// ---------------------------------------------------------------------------
//  Anwärmen
// ---------------------------------------------------------------------------

export interface WarmupConfig {
  /** Erlaubte Mails am ersten Tag. */
  start: number;
  /** Um so viel steigt die Erlaubnis pro Tag. */
  step: number;
}

export function warmupConfig(env: Env = process.env): WarmupConfig {
  return { start: zahl(env.SMTP_WARMUP_START, 15), step: zahl(env.SMTP_WARMUP_STEP, 10) };
}

/**
 * Wie viele Mails darf dieses Postfach heute noch verschicken?
 *
 * Ein frisches Postfach, das am ersten Tag 200 Mails ausstößt, wird als Spam
 * eingestuft — daran scheitern die meisten ersten Kampagnen, nicht am Text.
 * Deshalb wächst die Erlaubnis über die Tage, gezählt ab der ersten Mail, die
 * dieses Postfach je verschickt hat.
 *
 * `tageSeitStart` = 0 am ersten Sendetag.
 */
export function tagesErlaubnis(mailbox: Mailbox, tageSeitStart: number, cfg: WarmupConfig): number {
  const tage = Math.max(0, Math.floor(tageSeitStart));
  const erlaubt = cfg.start + cfg.step * tage;
  return Math.max(0, Math.min(mailbox.dailyMax, erlaubt));
}

/** Volle Tage zwischen zwei Zeitpunkten, nie negativ. */
export function tageSeit(start: Date | string | null | undefined, jetzt: Date = new Date()): number {
  if (!start) return 0;
  const s = start instanceof Date ? start : new Date(start);
  if (Number.isNaN(s.getTime())) return 0;
  const diff = jetzt.getTime() - s.getTime();
  return diff <= 0 ? 0 : Math.floor(diff / (24 * 60 * 60 * 1000));
}

export interface MailboxAuslastung {
  /** Wie viele Mails sind heute schon aus diesem Postfach raus? */
  heute: number;
  /** Wann hat dieses Postfach zum ersten Mal gesendet? Null = noch nie. */
  ersterVersand: string | null;
}

export interface Auswahl {
  mailbox: Mailbox;
  /** Wie viele Mails dürfen aus diesem Postfach jetzt noch raus? */
  rest: number;
}

/**
 * Wählt das Postfach, das heute am wenigsten gearbeitet hat und noch Luft hat.
 *
 * Gleichmäßig verteilen statt eines nach dem anderen auszureizen: ein Postfach
 * mit gleichbleibendem Tagesvolumen sieht für Spamfilter normal aus, eines mit
 * Ausschlägen nicht.
 */
export function waehleMailbox(
  pool: Mailbox[],
  auslastung: Record<string, MailboxAuslastung>,
  cfg: WarmupConfig,
  jetzt: Date = new Date(),
): Auswahl | null {
  let beste: Auswahl | null = null;
  let wenigste = Number.POSITIVE_INFINITY;

  for (const mb of pool) {
    const stand = auslastung[mb.id] ?? { heute: 0, ersterVersand: null };
    const erlaubt = tagesErlaubnis(mb, tageSeit(stand.ersterVersand, jetzt), cfg);
    const rest = erlaubt - stand.heute;
    if (rest <= 0) continue;
    if (stand.heute < wenigste) {
      wenigste = stand.heute;
      beste = { mailbox: mb, rest };
    }
  }
  return beste;
}

/** Gesamte Tageskapazität des Pools — für die Anzeige im Cockpit. */
export function poolKapazitaet(
  pool: Mailbox[],
  auslastung: Record<string, MailboxAuslastung>,
  cfg: WarmupConfig,
  jetzt: Date = new Date(),
): { erlaubt: number; verbraucht: number } {
  let erlaubt = 0;
  let verbraucht = 0;
  for (const mb of pool) {
    const stand = auslastung[mb.id] ?? { heute: 0, ersterVersand: null };
    erlaubt += tagesErlaubnis(mb, tageSeit(stand.ersterVersand, jetzt), cfg);
    verbraucht += stand.heute;
  }
  return { erlaubt, verbraucht };
}
