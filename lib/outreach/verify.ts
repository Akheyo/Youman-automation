/**
 * Adressprüfung vor dem Versand.
 *
 * Jede unzustellbare Adresse ist ein Bounce, und Bounces sind die schnellste
 * Art, den Ruf einer Absenderdomain zu ruinieren. Ein großer Teil davon lässt
 * sich vorher erkennen, ohne eine einzige Mail zu verschicken: Wenn die Domain
 * gar keinen Mailserver benennt (kein MX-Eintrag im DNS), kann dort niemand
 * Post empfangen. Tippfehler wie "gmial.com" fallen so sofort auf.
 *
 * Was das NICHT prüft: ob das Postfach hinter einer gültigen Domain wirklich
 * existiert. Dafür müsste man beim Mailserver anklopfen, was die meisten
 * Anbieter als Missbrauch werten. Der MX-Test ist die Grenze dessen, was sich
 * sauber machen lässt — er nimmt erfahrungsgemäß den größten Teil der Bounces
 * vorweg.
 */

import { isEmail } from './template';

export type MxStatus = 'ok' | 'kein_mx' | 'ungeprueft' | 'syntax';

/** Domainteil einer Adresse, klein geschrieben. */
export function domainVon(email: string): string {
  const at = (email ?? '').lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).trim().toLowerCase();
}

/**
 * Prüft eine einzelne Domain auf MX-Einträge.
 * Fehler beim Nachschlagen führen zu 'ungeprueft', nie zum Ausschluss — ein
 * DNS-Aussetzer darf keine gültige Adresse verwerfen.
 */
export async function pruefeDomain(domain: string, timeoutMs = 5_000): Promise<MxStatus> {
  if (!domain) return 'syntax';
  try {
    const dns = await import('node:dns/promises');
    const abbruch = new Promise<'ungeprueft'>((resolve) => setTimeout(() => resolve('ungeprueft'), timeoutMs));
    const nachschlagen = dns
      .resolveMx(domain)
      .then((eintraege) => (eintraege && eintraege.length > 0 ? ('ok' as const) : ('kein_mx' as const)))
      .catch((err: NodeJS.ErrnoException) => {
        // NXDOMAIN und "keine Daten" sind echte Befunde, alles andere ist
        // eine Störung auf unserer Seite.
        if (err?.code === 'ENOTFOUND' || err?.code === 'ENODATA') return 'kein_mx' as const;
        return 'ungeprueft' as const;
      });
    return await Promise.race([nachschlagen, abbruch]);
  } catch {
    return 'ungeprueft';
  }
}

export interface GeprueftAdresse {
  email: string;
  status: MxStatus;
}

/**
 * Prüft eine Liste von Adressen. Domains werden nur einmal nachgeschlagen —
 * bei einem Import mit 500 Kontakten aus 80 Firmen sind das 80 Abfragen statt
 * 500.
 */
export async function pruefeAdressen(emails: string[], timeoutMs = 5_000): Promise<GeprueftAdresse[]> {
  const proDomain = new Map<string, Promise<MxStatus>>();
  const ergebnisse: GeprueftAdresse[] = [];

  for (const email of emails) {
    if (!isEmail(email)) {
      ergebnisse.push({ email, status: 'syntax' });
      continue;
    }
    const domain = domainVon(email);
    if (!proDomain.has(domain)) proDomain.set(domain, pruefeDomain(domain, timeoutMs));
    ergebnisse.push({ email, status: await proDomain.get(domain)! });
  }
  return ergebnisse;
}

/** Adressen, die sicher nicht zustellbar sind — die gehören nicht importiert. */
export function istAussichtslos(status: MxStatus): boolean {
  return status === 'kein_mx' || status === 'syntax';
}
