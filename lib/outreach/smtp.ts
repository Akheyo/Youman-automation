/**
 * SMTP-Versand — Paul verschickt über dein eigenes Postfach.
 *
 * Das ist der Weg, den etablierte Outreach-Werkzeuge gehen: nicht über einen
 * Massenversand-Dienst, sondern über ein echtes Postfach (Google Workspace,
 * Microsoft 365 oder ein eigener Mailserver). Zwei Gründe:
 *
 *   1. Transaktions-Anbieter wie Postmark, Resend oder SendGrid verbieten
 *      Kaltakquise in ihren Nutzungsbedingungen. Ein gesperrtes Konto mitten
 *      in der Kampagne ist teurer als jede Zeitersparnis.
 *   2. Eine Mail aus einem normalen Postfach sieht für den Empfänger aus wie
 *      Post von einem Menschen — weil sie genau das ist.
 *
 * Nodemailer wird erst beim Senden geladen, damit es nicht in Bundles landet,
 * die nur wissen wollen, ob SMTP überhaupt eingerichtet ist.
 */

/** Wie in lib/systemcheck: lose genug, um in Tests eine Umgebung zu bauen. */
export type Env = Record<string, string | undefined>;

export interface SmtpSettings {
  host: string;
  port: number;
  /** true = TLS von Anfang an (Port 465), false = STARTTLS (Port 587). */
  secure: boolean;
  user: string;
  pass: string;
}

/** Liest die SMTP-Zugangsdaten aus der Umgebung. Null, wenn unvollständig. */
export function smtpSettings(env: Env = process.env): SmtpSettings | null {
  const host = (env.SMTP_HOST ?? '').trim();
  const user = (env.SMTP_USER ?? '').trim();
  const pass = (env.SMTP_PASS ?? '').trim();
  if (!host || !user || !pass) return null;

  const rawPort = Number(env.SMTP_PORT);
  const port = Number.isFinite(rawPort) && rawPort > 0 ? Math.round(rawPort) : 587;
  // Ohne ausdrückliche Angabe: Port 465 heißt TLS, alles andere STARTTLS.
  const secureRaw = (env.SMTP_SECURE ?? '').trim().toLowerCase();
  const secure = secureRaw ? secureRaw === 'true' || secureRaw === '1' : port === 465;

  return { host, port, secure, user, pass };
}

export function smtpConfigured(env: Env = process.env): boolean {
  return smtpSettings(env) !== null;
}

/**
 * Standard-Absenderadresse. Greift, wenn eine Kampagne keine eigene gesetzt
 * hat. Muss zum angemeldeten Postfach passen oder von ihm versendet werden
 * dürfen — sonst schreibt der Mailserver sie um oder weist die Mail ab.
 */
export function smtpFrom(env: Env = process.env): string {
  return (env.SMTP_FROM ?? '').trim();
}

export type VerifyResult = { ok: true } | { ok: false; error: string };

/**
 * Prüft nur die Anmeldung am Postfach, ohne eine Mail zu verschicken.
 * Damit lässt sich vor der ersten Kampagne klären, ob die Zugangsdaten
 * stimmen — der häufigste Stolperstein beim Einrichten.
 */
export async function verifySmtp(settings: SmtpSettings, timeoutMs = 15_000): Promise<VerifyResult> {
  try {
    const nodemailer = (await import('nodemailer')).default;
    const transport = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.user, pass: settings.pass },
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
    });
    await transport.verify();
    transport.close();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: erklaereSmtpFehler(err instanceof Error ? err.message : String(err)) };
  }
}

export interface SmtpMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  from?: string;
  replyTo?: string | null;
  headers?: Record<string, string>;
  inReplyTo?: string | null;
}

export type SmtpResult = { ok: true; messageId?: string } | { ok: false; error: string };

/**
 * Verschickt eine Mail über das hinterlegte Postfach.
 *
 * Die Absenderadresse muss zum angemeldeten Postfach passen — Google und
 * Microsoft schreiben sie sonst still um oder weisen die Mail ab. Fehlt sie,
 * wird der SMTP-Benutzer verwendet.
 */
export async function sendViaSmtp(mail: SmtpMail, settings: SmtpSettings, timeoutMs = 20_000): Promise<SmtpResult> {
  try {
    const nodemailer = (await import('nodemailer')).default;
    const transport = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.user, pass: settings.pass },
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
    });

    const info = await transport.sendMail({
      from: mail.from || settings.user,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      replyTo: mail.replyTo || undefined,
      headers: mail.headers,
      inReplyTo: mail.inReplyTo || undefined,
      references: mail.inReplyTo || undefined,
    });

    // Nach dem Senden die Verbindung schliessen — auf Serverless bleibt sonst
    // ein offener Socket zurueck, bis die Instanz eingefroren wird.
    transport.close();

    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Übersetzt die häufigsten SMTP-Fehler in einen Satz, der sagt, was zu tun ist.
 * Die Rohmeldungen der Mailserver sind für Nichttechniker unbrauchbar.
 */
export function erklaereSmtpFehler(fehler: string): string {
  const f = fehler.toLowerCase();
  if (f.includes('invalid login') || f.includes('535') || f.includes('authentication')) {
    return 'Anmeldung am Postfach abgelehnt. Bei Google Workspace und Microsoft 365 brauchst du ein App-Passwort — das normale Kontopasswort funktioniert nicht.';
  }
  if (f.includes('enotfound') || f.includes('getaddrinfo')) {
    return 'Der Mailserver ist unter dieser Adresse nicht erreichbar. Bitte SMTP_HOST prüfen.';
  }
  if (f.includes('etimedout') || f.includes('timeout')) {
    return 'Der Mailserver hat nicht geantwortet. Meist ist der Port falsch: 465 mit TLS oder 587 mit STARTTLS.';
  }
  if (f.includes('self signed') || f.includes('certificate')) {
    return 'Das Zertifikat des Mailservers wurde nicht akzeptiert. Bitte Host und Port prüfen.';
  }
  if (f.includes('550') || f.includes('relay')) {
    return 'Der Mailserver hat die Zustellung verweigert. Häufig passt die Absenderadresse nicht zum angemeldeten Postfach.';
  }
  if (f.includes('recipient') || f.includes('553')) {
    return 'Die Empfängeradresse wurde abgelehnt.';
  }
  return fehler;
}
