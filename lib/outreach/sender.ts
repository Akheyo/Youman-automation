/**
 * Transport für Outreach-Mails. Zwei Wege, in dieser Reihenfolge:
 *
 *   1. SMTP direkt aus der App (SMTP_HOST/USER/PASS) — der Normalfall. Paul
 *      verschickt über dein eigenes Postfach, so wie es etablierte
 *      Outreach-Werkzeuge auch tun.
 *   2. Ein Webhook (OUTREACH_WEBHOOK_URL, ersatzweise FELIX_PITCH_WEBHOOK_URL),
 *      der die fertige Mail entgegennimmt und zustellt — für alle, die den
 *      Versand über n8n, Make oder einen eigenen Dienst bündeln wollen.
 *
 * Jede Mail bekommt hier zwei Pflichtbestandteile angehängt: den Abmeldelink
 * im Text und den List-Unsubscribe-Header. Ohne beides ist Kaltakquise per
 * Mail weder rechtlich sauber noch zustellbar.
 */

import { smtpConfigured, smtpSettings, smtpFrom, sendViaSmtp, erklaereSmtpFehler } from './smtp';

export interface OutreachMail {
  to: string;
  subject: string;
  /** Reiner Text, so wie im Editor geschrieben. */
  body: string;
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  company?: string | null;
  /** Absolute URL zum Abmelden (Bestaetigungsseite, ohne Login). */
  unsubscribeUrl?: string | null;
  /** Endpunkt fuer die Ein-Klick-Abmeldung aus dem Postfach (List-Unsubscribe). */
  oneClickUrl?: string | null;
  /** Kopfzeilen für den Thread-Anschluss beim Nachfassen. */
  inReplyTo?: string | null;
  /** Zählpixel für die Öffnungsmessung. Nur gesetzt, wenn die Kampagne misst. */
  trackingPixelUrl?: string | null;
}

export type SendResult = { ok: true; messageId?: string } | { ok: false; error: string };

export function webhookUrl(): string {
  return (process.env.OUTREACH_WEBHOOK_URL || process.env.FELIX_PITCH_WEBHOOK_URL || '').trim();
}

/** Welcher Weg greift gerade? */
export function transportKind(): 'smtp' | 'webhook' | 'keiner' {
  if (smtpConfigured()) return 'smtp';
  if (webhookUrl()) return 'webhook';
  return 'keiner';
}

export function outreachConfigured(): boolean {
  return transportKind() !== 'keiner';
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Der Abmeldehinweis, der unter jede Mail kommt (Text-Variante). */
export function unsubscribeLine(url: string): string {
  return `Kein Interesse an weiteren Nachrichten? Einmal hier klicken, dann schreibe ich Ihnen nicht wieder: ${url}`;
}

/** Text-Body inkl. Abmeldehinweis. */
export function buildText(mail: OutreachMail): string {
  const base = (mail.body ?? '').trimEnd();
  if (!mail.unsubscribeUrl) return base;
  return `${base}\n\n—\n${unsubscribeLine(mail.unsubscribeUrl)}`;
}

/** Schlichtes HTML — bewusst ohne Bilder, Tracking-Pixel und Layout-Tabellen. */
export function buildHtml(mail: OutreachMail): string {
  const body = escapeHtml((mail.body ?? '').trimEnd());
  const footer = mail.unsubscribeUrl
    ? `<p style="margin-top:22px;padding-top:12px;border-top:1px solid #e5e0f0;color:#6b6b7b;font-size:12px">Kein Interesse an weiteren Nachrichten? <a href="${escapeHtml(
        mail.unsubscribeUrl,
      )}" style="color:#6d28d9">Hier abmelden</a> — dann schreibe ich Ihnen nicht wieder.</p>`
    : '';
  // Das Zählpixel kommt ganz zum Schluss: wird es blockiert, fehlt am Ende der
  // Mail nichts Sichtbares.
  const pixel = mail.trackingPixelUrl
    ? `<img src="${escapeHtml(mail.trackingPixelUrl)}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">`
    : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1b1733"><div style="white-space:pre-wrap">${body}</div>${footer}${pixel}</div>`;
}

/**
 * Baut die Absenderzeile ("Max Muster <max@firma.de>").
 *
 * Hat die Kampagne keine eigene Adresse, greift SMTP_FROM — so muss die
 * Absenderadresse nur einmal zentral stimmen und nicht in jeder Kampagne
 * nachgepflegt werden.
 */
export function fromHeader(mail: OutreachMail): string | undefined {
  const email = (mail.fromEmail ?? '').trim() || smtpFrom();
  const name = (mail.fromName ?? '').trim();
  if (!email) return name || undefined;
  return name ? `${name} <${email}>` : email;
}

/**
 * Stellt eine Mail über den Versand-Webhook zu.
 * Netzwerkfehler werden als `{ ok: false }` zurückgegeben, nicht geworfen —
 * der Aufrufer (Queue) protokolliert sie am Kontakt und macht weiter.
 */
export async function sendOutreachMail(mail: OutreachMail, timeoutMs = 20_000): Promise<SendResult> {
  const kind = transportKind();
  if (kind === 'keiner') {
    return { ok: false, error: 'Versand nicht konfiguriert (SMTP_HOST/SMTP_USER/SMTP_PASS oder OUTREACH_WEBHOOK_URL fehlen).' };
  }

  const to = (mail.to ?? '').trim();
  if (!/^[^@\s,;]+@[^@\s,;]+\.[a-zA-Z]{2,}$/.test(to)) return { ok: false, error: `Ungültige Empfängeradresse: "${to}".` };
  if (!(mail.subject ?? '').trim()) return { ok: false, error: 'Betreff fehlt.' };

  const headers: Record<string, string> = {};
  if (mail.oneClickUrl) {
    // RFC 8058: der Header zeigt auf den Endpunkt, der ein POST direkt
    // ausfuehrt — das Postfach meldet ab, ohne dass jemand klicken muss.
    headers['List-Unsubscribe'] = `<${mail.oneClickUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  } else if (mail.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${mail.unsubscribeUrl}>`;
  }
  if (mail.inReplyTo) {
    headers['In-Reply-To'] = mail.inReplyTo;
    headers['References'] = mail.inReplyTo;
  }

  if (kind === 'smtp') {
    const settings = smtpSettings()!;
    const res = await sendViaSmtp(
      {
        to,
        subject: mail.subject.trim(),
        text: buildText(mail),
        html: buildHtml(mail),
        from: fromHeader(mail),
        replyTo: mail.replyTo,
        headers,
        inReplyTo: mail.inReplyTo,
      },
      settings,
      timeoutMs,
    );
    // Rohe SMTP-Meldungen sind unlesbar — in Klartext übersetzen, damit im
    // Cockpit steht, was zu tun ist.
    return res.ok ? res : { ok: false, error: erklaereSmtpFehler(res.error) };
  }

  const url = webhookUrl();
  const payload = {
    to,
    subject: mail.subject.trim(),
    html: buildHtml(mail),
    text: buildText(mail),
    from: fromHeader(mail),
    fromName: mail.fromName ?? undefined,
    fromEmail: mail.fromEmail ?? undefined,
    replyTo: mail.replyTo ?? undefined,
    company: mail.company ?? '',
    headers,
  };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    if (!res.ok) return { ok: false, error: `Versand-Webhook antwortete mit HTTP ${res.status}.` };
    const data = (await res.json().catch(() => ({}))) as { messageId?: string; message_id?: string };
    return { ok: true, messageId: data.messageId ?? data.message_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/** Absolute URL der Abmeldeseite für einen Kontakt-Token. */
export function unsubscribeUrlFor(token: string): string | null {
  const base = (process.env.APP_URL || '').replace(/\/$/, '');
  if (!base || !token) return null;
  return `${base}/abmelden/${token}`;
}

/** Endpunkt für die Ein-Klick-Abmeldung aus dem Postfach (RFC 8058). */
export function oneClickUrlFor(token: string): string | null {
  const base = (process.env.APP_URL || '').replace(/\/$/, '');
  if (!base || !token) return null;
  return `${base}/api/outreach/unsubscribe?token=${encodeURIComponent(token)}`;
}
