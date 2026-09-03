/**
 * Die Rechtstexte für das Impressum.
 *
 * ACHTUNG, bitte vor der ersten Veröffentlichung lesen:
 *
 * Diese Texte sind ein Entwurf nach dem in Deutschland üblichen Muster. Sie
 * sind KEINE Rechtsberatung und nicht anwaltlich geprüft. Sie decken den
 * Normalfall eines kleinen Dienstleisters ohne Onlineshop und ohne
 * nutzergenerierte Inhalte ab, also genau diese Website. Sobald hier
 * Waren verkauft, Kommentare veröffentlicht oder fremde Inhalte
 * eingebunden werden, gehört der Text auf den Prüfstand.
 *
 * Zwei Punkte, bei denen viele Impressen veraltet sind, und die hier
 * bewusst anders gelöst sind:
 *
 *   1. Es wird auf das DDG verwiesen, nicht auf das TMG. Das
 *      Telemediengesetz ist im Mai 2024 durch das Digitale-Dienste-Gesetz
 *      abgelöst worden. Die Haftungsregeln sind inhaltlich dieselben
 *      geblieben, sie stehen nur an anderer Stelle: § 7 Abs. 1 DDG statt
 *      § 7 Abs. 1 TMG, §§ 8 bis 10 DDG statt §§ 8 bis 10 TMG.
 *
 *   2. Es steht KEIN Verweis auf die OS-Plattform der EU darin. Die
 *      Europäische Kommission hat die Plattform zur Online-Streitbeilegung
 *      zum 20. Juli 2025 eingestellt. Der Link, der bis heute in sehr
 *      vielen Impressen steht, führt seither ins Leere, und ein toter
 *      Pflichtlink ist schlechter als keiner.
 *
 * Was hier eine Entscheidung ist und keine Rechtsfrage: die Teilnahme an
 * der Verbraucherschlichtung. Siehe den Schalter unten.
 */

/**
 * Nimmt youman freiwillig an einem Streitbeilegungsverfahren vor einer
 * Verbraucherschlichtungsstelle teil?
 *
 * `false` ist die Vorgabe und der Normalfall. Eine Pflicht zur Teilnahme
 * besteht nur für wenige Branchen, etwa Energieversorger und Banken; für
 * einen Softwaredienstleister besteht sie nicht. Wer nicht teilnimmt, muss
 * das aber nach § 36 Abs. 1 Nr. 1 VSBG ausdrücklich sagen, und genau
 * deshalb steht der Satz unten im Text.
 *
 * Die Angabe ist ohnehin nur gegenüber Verbrauchern relevant. Bei rein
 * gewerblichen Kunden greift das VSBG nicht, die Erklärung schadet dort
 * aber auch nicht.
 *
 * Auf `true` setzen, sobald eine Schlichtungsstelle benannt werden soll.
 * Dann muss ihr Name samt Anschrift und Website hier ergänzt und im Text
 * genannt werden, sonst ist die Angabe unvollständig.
 */
export const nimmtAnVerbraucherschlichtungTeil = false;

export type Rechtsabschnitt = {
  titel: string;
  absaetze: string[];
};

export const rechtstexte: Rechtsabschnitt[] = [
  {
    titel: 'Haftung für Inhalte',
    absaetze: [
      'Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach den §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.',
      'Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.',
    ],
  },
  {
    titel: 'Haftung für Links',
    absaetze: [
      'Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.',
      'Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist ohne konkrete Anhaltspunkte einer Rechtsverletzung jedoch nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.',
    ],
  },
  {
    titel: 'Urheberrecht',
    absaetze: [
      'Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors beziehungsweise Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.',
      'Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.',
    ],
  },
  {
    titel: 'Verbraucherstreitbeilegung',
    absaetze: nimmtAnVerbraucherschlichtungTeil
      ? [
          'Wir sind bereit, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. Zuständig ist die hier zu benennende Stelle.',
        ]
      : [
          'Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
        ],
  },
];
