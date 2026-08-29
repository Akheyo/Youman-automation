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

/*
 * Freigegebene Kontaktdaten. Sie stehen ohnehin öffentlich auf der Seite und
 * gehören später ins Impressum – als Vorgabe hier hinterlegt, damit dafür
 * nichts eingerichtet werden muss. Die jeweilige Umgebungsvariable
 * überschreibt sie weiterhin.
 */
const EMAIL = 'info@youman-automation.com';
const TELEFON = '+49 155 67541365';
const TERMINLINK = 'https://calendar.app.google/y5qSCJaxnksqtutT7';

/**
 * Web3Forms nimmt die Anfrage entgegen. Die Adresse ist bei allen Konten
 * dieselbe; unterschieden wird über den Zugangsschlüssel.
 */
const ENDPUNKT = 'https://api.web3forms.com/submit';

/**
 * Zugangsschlüssel für Web3Forms.
 *
 * Er steht hier im Klartext, und das ist kein Versehen: Web3Forms arbeitet
 * im Browser, der Schlüssel landet also ohnehin im ausgelieferten HTML und
 * ist damit für jeden lesbar, der die Seite aufruft. Ihn in ein Secret zu
 * legen würde daran nichts ändern – es sähe nur sicherer aus.
 *
 * Der wirksame Schutz liegt woanders: In den Web3Forms-Einstellungen ist die
 * Domain hinterlegt, von der gesendet werden darf. Wird der Schlüssel
 * missbraucht, lässt er sich dort in einer Minute austauschen; dann greift
 * FORMULAR_SCHLUESSEL als Variable, ohne dass diese Zeile angefasst wird.
 */
const SCHLUESSEL = 'c069cea1-cb4a-4239-bdf7-598361f989d5';

export const kontakt = {
  email: ausUmgebung('KONTAKT_EMAIL', EMAIL),
  telefon: ausUmgebung('KONTAKT_TELEFON', TELEFON),
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
  formularEndpunkt: ausUmgebung('FORMULAR_ENDPUNKT', ENDPUNKT),

  /**
   * Nur für Web3Forms: der Zugangsschlüssel wandert als verstecktes Feld mit.
   * Bei Formspree leer lassen.
   */
  formularSchluessel: ausUmgebung('FORMULAR_SCHLUESSEL', SCHLUESSEL),
} as const;

export const hatKontaktdaten = Boolean(
  kontakt.email || kontakt.telefon || kontakt.terminlink,
);

/**
 * Web3Forms weist jede Anfrage ohne gültigen Zugangsschlüssel ab. Solange er
 * fehlt, bleibt das Formular deshalb ausgeblendet: ein sichtbares Formular,
 * dessen Absenden zuverlässig fehlschlägt, ist schlechter als ein ehrlicher
 * Hinweis. Bei Formspree steckt die Kennung in der Adresse, dort entfällt
 * die Prüfung.
 */
export const istWeb3Forms = kontakt.formularEndpunkt?.includes('web3forms.com') ?? false;

const brauchtSchluessel = istWeb3Forms;

export const formularBereit = Boolean(
  kontakt.formularEndpunkt && (!brauchtSchluessel || kontakt.formularSchluessel),
);
