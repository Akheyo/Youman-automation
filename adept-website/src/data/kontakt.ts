/**
 * Kontaktdaten und Formularanbindung an einer Stelle.
 *
 * Alle Werte lassen sich über Umgebungsvariablen setzen, damit sie nicht im
 * Code stehen müssen. In GitHub: Settings → Secrets and variables → Actions →
 * Variables. Der Workflow reicht sie an den Build weiter.
 *
 * Ohne gesetzten Wert bleibt das jeweilige Feld leer und die Seite weist die
 * Stelle sichtbar als Platzhalter aus – es wird nichts erfunden.
 */

const ausUmgebung = (name: string, vorgabe: string | null = null): string | null => {
  const wert = process.env[name]?.trim();
  return wert ? wert : vorgabe;
};

/**
 * Terminbuchung über Google Kalender. Vom Kunden geliefert und öffentlich –
 * deshalb als Vorgabe hier statt als Variable. Die Umgebungsvariable
 * KONTAKT_TERMINLINK überschreibt sie weiterhin.
 */
const TERMINLINK = 'https://calendar.app.google/y5qSCJaxnksqtutT7';

export const kontakt = {
  email: ausUmgebung('KONTAKT_EMAIL'),
  telefon: ausUmgebung('KONTAKT_TELEFON'),
  terminlink: ausUmgebung('KONTAKT_TERMINLINK', TERMINLINK),

  /**
   * Adresse, an die das Formular sendet.
   *
   * GitHub Pages liefert nur statische Dateien und kann selbst nichts
   * entgegennehmen; ein externer Dienst übernimmt das. Erprobt mit:
   *
   *   Formspree   https://formspree.io/f/<id>
   *   Web3Forms   https://api.web3forms.com/submit  (zusätzlich Zugangsschlüssel)
   *
   * Beide sind für kleine Mengen kostenlos und beide antworten auf einen
   * POST mit JSON, was die Rückmeldung ohne Seitenwechsel möglich macht.
   */
  formularEndpunkt: ausUmgebung('FORMULAR_ENDPUNKT'),

  /**
   * Nur für Web3Forms: der Zugangsschlüssel wandert als verstecktes Feld mit.
   * Bei Formspree leer lassen.
   */
  formularSchluessel: ausUmgebung('FORMULAR_SCHLUESSEL'),
} as const;

export const hatKontaktdaten = Boolean(
  kontakt.email || kontakt.telefon || kontakt.terminlink,
);
