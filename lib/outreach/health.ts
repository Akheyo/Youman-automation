/**
 * Schutzschalter für die Zustellbarkeit.
 *
 * Eine Domain verbrennt selten mit einem Knall, sondern schleichend: die
 * Bounce-Quote steigt, die Beschwerden häufen sich, und irgendwann landet
 * alles im Spam — auch die normale Geschäftspost. Bis das jemandem auffällt,
 * ist der Schaden angerichtet und braucht Monate zum Heilen.
 *
 * Deshalb rechnet diese Datei nach jedem Versandlauf nach und hält die
 * Kampagne an, wenn die Werte kippen. Lieber eine Kampagne zu früh gestoppt
 * als eine Domain zu spät.
 *
 * Die Schwellen orientieren sich an dem, was Google und Microsoft in ihren
 * Absender-Richtlinien als tolerierbar nennen; sie liegen bewusst darunter.
 */

export interface Zaehlwerk {
  gesendet: number;
  bounces: number;
  abmeldungen: number;
}

export interface Schwellen {
  /** Ab so vielen Mails wird überhaupt bewertet — vorher ist alles Rauschen. */
  mindestMenge: number;
  /** Anteil unzustellbarer Adressen, ab dem gestoppt wird. */
  maxBounceQuote: number;
  /** Anteil Abmeldungen, ab dem gestoppt wird. */
  maxAbmeldeQuote: number;
}

export const STANDARD_SCHWELLEN: Schwellen = {
  mindestMenge: 20,
  // Google nennt 5 % als Grenze für "schlecht"; wir greifen bei 4 % ein.
  maxBounceQuote: 0.04,
  // Über 2 % Abmeldungen heißt: die Liste oder der Text passen nicht.
  maxAbmeldeQuote: 0.02,
};

export type Befund =
  | { stoppen: false; quoten: { bounce: number; abmeldung: number } }
  | { stoppen: true; grund: string; quoten: { bounce: number; abmeldung: number } };

function prozent(anteil: number): string {
  return `${Math.round(anteil * 1000) / 10} %`;
}

/**
 * Bewertet eine Kampagne. Gibt zurück, ob sie angehalten werden sollte, und
 * formuliert den Grund so, dass er im Cockpit ohne Übersetzung verständlich
 * ist.
 */
export function bewerte(z: Zaehlwerk, schwellen: Schwellen = STANDARD_SCHWELLEN): Befund {
  const gesendet = Math.max(0, z.gesendet);
  const bounce = gesendet > 0 ? z.bounces / gesendet : 0;
  const abmeldung = gesendet > 0 ? z.abmeldungen / gesendet : 0;
  const quoten = { bounce, abmeldung };

  // Bei kleinen Mengen sagt eine Quote nichts: zwei Bounces von fünf Mails
  // sind 40 %, aber kein Befund.
  if (gesendet < schwellen.mindestMenge) return { stoppen: false, quoten };

  if (bounce > schwellen.maxBounceQuote) {
    return {
      stoppen: true,
      grund: `Zu viele unzustellbare Adressen (${prozent(bounce)}). Das schadet dem Ruf deiner Absenderdomain. Bitte die Liste prüfen, bevor es weitergeht.`,
      quoten,
    };
  }

  if (abmeldung > schwellen.maxAbmeldeQuote) {
    return {
      stoppen: true,
      grund: `Ungewöhnlich viele Abmeldungen (${prozent(abmeldung)}). Meist passt die Zielgruppe nicht zum Text. Bitte Sequenz und Liste ansehen.`,
      quoten,
    };
  }

  return { stoppen: false, quoten };
}
