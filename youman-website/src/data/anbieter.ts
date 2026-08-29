/**
 * Anbieterangaben für das Impressum (§ 5 DDG).
 *
 * Hier stehen ausschließlich Tatsachen: wer die Seite betreibt und wo diese
 * Personen erreichbar sind. Erklärungen mit rechtlicher Wirkung –
 * Haftungsausschluss, Urheberrechtshinweis, Bereitschaft zur
 * Verbraucherschlichtung nach § 36 VSBG – gehören nicht hierher und werden
 * nicht erzeugt. Sie stammen von der Rechtsberatung und werden als Text
 * eingesetzt.
 *
 * Zwei Ausbaustufen, ohne Eingriff in die Seite:
 *
 *   1. Jetzt: die betreibenden Personen unter ihrer Geschäftsbezeichnung.
 *      `rechtsform` bleibt leer, weil noch keine Gesellschaft besteht.
 *
 *   2. Sobald die GbR gegründet und das Gewerbe angemeldet ist:
 *      `rechtsform: 'GbR'` setzen. Bei Eintragung ins Gesellschaftsregister
 *      zusätzlich `registergericht` und `registernummer`, bei erteilter
 *      Umsatzsteuer-Identifikationsnummer `ustId`.
 *
 * Solange die Anschrift unvollständig ist, zeigt /impressum weiterhin den
 * gekennzeichneten Platzhalter und benennt dort, was fehlt. Ein halb
 * ausgefülltes Impressum wäre schlechter als ein ehrlich als unvollständig
 * markiertes.
 */

import { kontakt } from './kontakt';

export const anbieter = {
  /** Geschäftsbezeichnung, unter der die Seite auftritt. */
  bezeichnung: 'youman',

  /**
   * Rechtsform, sobald eine Gesellschaft besteht – z. B. 'GbR'.
   *
   * Bewusst noch leer: eine Gesellschaft, die es noch nicht gibt, darf im
   * Impressum nicht behauptet werden. Solange hier nichts steht, weist die
   * Seite die beiden Personen als Betreiber aus. Das ist zu jedem Zeitpunkt
   * richtig, egal wie die Gründung ausgeht.
   */
  rechtsform: null as string | null,

  /**
   * Die betreibenden bzw. vertretungsberechtigten Personen. Bei einer GbR
   * müssen alle Gesellschafter genannt werden, nicht nur eine Person.
   */
  personen: [
    { name: 'Amanuel Kheyo', telefon: '+49 155 67541365' },
  ],

  /** Ladungsfähige Anschrift – ein Postfach genügt nicht. */
  strasse: 'Dülmener Weg 86a',
  plz: '46325' as string | null,
  ort: 'Borken' as string | null,
  land: 'Deutschland',

  /** Zentrale Adresse; identisch mit der auf der Kontaktseite. */
  email: kontakt.email,

  /** Nur bei Eintragung ins Gesellschaftsregister (eGbR). */
  registergericht: null as string | null,
  registernummer: null as string | null,

  /** Umsatzsteuer-Identifikationsnummer nach § 27 a UStG, sofern erteilt. */
  ustId: null as string | null,

  /**
   * Inhaltlich verantwortlich nach § 18 Abs. 2 MStV. Relevant, sobald unter
   * den Pressemitteilungen redaktionelle Beiträge stehen. Leer lassen, solange
   * dort nur Platzhalter sind.
   */
  inhaltlichVerantwortlich: null as string | null,
};

/** Name samt Rechtsform, solange eine besteht. */
export const anbieterName = anbieter.rechtsform
  ? `${anbieter.bezeichnung} ${anbieter.rechtsform}`
  : anbieter.bezeichnung;

/** Was für eine brauchbare Anbieterkennzeichnung noch fehlt. */
export const anbieterLuecken = [
  anbieter.personen.length === 0 && 'Name der betreibenden Person(en)',
  !anbieter.strasse && 'Straße und Hausnummer',
  !anbieter.plz && 'Postleitzahl',
  !anbieter.ort && 'Ort',
  !anbieter.email && 'E-Mail-Adresse',
].filter((eintrag): eintrag is string => Boolean(eintrag));

export const anbieterVollstaendig = anbieterLuecken.length === 0;
