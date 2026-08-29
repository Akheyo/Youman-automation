export const site = {
  name: 'youman',
  /**
   * Untertitel aus der Wortmarke. Steht im Logo unter dem Namen und
   * beschreibt in drei Woertern, worum es geht.
   */
  claim: 'AI & Software',
  /**
   * Titel der Startseite in der Suche. Steht getrennt vom Namen, weil ein
   * Firmenname allein kein Suchwort ist: niemand sucht nach einer Marke, die
   * er noch nicht kennt. Der Titel ist die staerkste einzelne Angabe einer
   * Seite, und die Startseite ist die staerkste Seite.
   *
   * Aufbau: die drei gesuchten Begriffe zuerst, dann die Marke.
   * 54 Zeichen, damit Google ihn nicht abschneidet.
   */
  startseitenTitel: 'KI-Automation, Chatbots und Software | youman',
  /** Beschreibung der Startseite in der Suche. */
  startseitenBeschreibung:
    'youman baut KI-Automationen, Chatbots, Webseiten, E-Commerce-Lösungen und individuelle Software. Wir analysieren den Ablauf und bauen, was dort fehlt.',
  gruendungsjahr: '2026',
  subclaim: 'Wir automatisieren, was jeden Tag Zeit kostet.',
  description:
    'youman verbindet KI-Automation mit individueller Softwareentwicklung: Chatbots, Webseiten, E-Commerce-Lösungen und Software, die auf den tatsächlichen Ablauf passt.',
} as const;

/**
 * Die Arbeitsweise in drei Schritten. Bewusst kurz gehalten: sie erscheint
 * auf mehreren Seiten und soll dort nicht den Platz des eigentlichen
 * Inhalts einnehmen.
 */
export const prozess = [
  {
    step: '01',
    title: 'Analyse',
    description:
      'Wir sehen uns den Ablauf an, um den es geht, und die Stellen, an denen von Hand nachgeholfen wird.',
  },
  {
    step: '02',
    title: 'Konzept',
    description:
      'Was automatisiert wird, was bewusst beim Menschen bleibt, und woran am Ende erkennbar ist, ob es trägt.',
  },
  {
    step: '03',
    title: 'Umsetzung',
    description:
      'Gebaut wird in kurzen Schritten, an einer Stelle eingesetzt und erweitert, sobald sie dort trägt.',
  },
  {
    step: '04',
    title: 'Betrieb',
    description:
      'Einführung im Alltag, Einweisung der Beteiligten, danach Anpassung an das, was sich im Betrieb zeigt.',
  },
] as const;
