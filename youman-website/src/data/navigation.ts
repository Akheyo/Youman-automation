export type NavChild = { label: string; href: string };

export type NavItem = {
  label: string;
  href: string;
  children?: NavChild[];
  /**
   * true = erscheint nur im Footer, nicht in der Hauptnavigation.
   *
   * Fuer Seiten, die einen Verweis brauchen, damit sie nicht ohne Verweis
   * dastehen, aber in der obersten Ebene zu prominent waeren.
   */
  nurFooter?: boolean;
};

/**
 * Hauptnavigation.
 *
 * "Pressemitteilungen" ist entfallen: ein Newsbereich, der nicht gepflegt
 * wird, schadet mehr als er nuetzt.
 */
export const mainNav: NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'Leistungen',
    href: '/leistungen',
    children: [
      { label: 'KI-Automationen', href: '/leistungen/ki-automationen' },
      { label: 'Chatbots', href: '/leistungen/chatbots' },
      { label: 'Webseiten', href: '/leistungen/webseiten' },
      { label: 'E-Commerce-Lösungen', href: '/leistungen/e-commerce' },
      { label: 'Individuelle Software', href: '/leistungen/individuelle-software' },
    ],
  },
  {
    label: 'Branchen',
    href: '/branchen',
    children: [
      { label: 'E-Commerce & Onlinehandel', href: '/branchen/e-commerce-und-onlinehandel' },
      { label: 'Spedition & Logistik', href: '/branchen/spedition-und-logistik' },
      { label: 'Produktion & Fertigung', href: '/branchen/produktion-und-fertigung' },
      { label: 'Großhandel & Distribution', href: '/branchen/grosshandel-und-distribution' },
      { label: 'Handwerk & Bau', href: '/branchen/handwerk-und-bau' },
      { label: 'Dienstleistung & Agenturen', href: '/branchen/dienstleistung-und-agenturen' },
    ],
  },
  { label: 'Referenzprojekte', href: '/case-studies' },
  { label: 'Fragen', href: '/fragen' },
  /*
   * Muensterland haengt unter "Ueber uns" statt in der obersten Ebene.
   *
   * Zwei Gruende. Erstens die Sache: Wo jemand sitzt, gehoert zu dem, wer
   * er ist, nicht daneben. Zweitens der Platz: Mit Muensterland als
   * eigenem Punkt hatte die oberste Ebene acht Eintraege, und "Ueber uns"
   * brach bei 1440 Bildpunkten auf zwei Zeilen um.
   *
   * Als Unterpunkt bleibt die Seite auf jeder Seite verlinkt. Vorher stand
   * sie nur in der Fusszeile und kam auf 25 eingehende Verweise, waehrend
   * jede Branchenseite 74 bekam. Fuer einen Anbieter, dessen staerkstes
   * Unterscheidungsmerkmal die Naehe ist, war das die falsche Gewichtung.
   */
  {
    label: 'Über uns',
    href: '/ueber-uns',
    children: [
      { label: 'Wer hinter youman steht', href: '/ueber-uns' },
      { label: 'Münsterland', href: '/muensterland' },
    ],
  },
  { label: 'Kontakt', href: '/kontakt' },
];

export const footerLegalNav: NavChild[] = [
  { label: 'Kontakt', href: '/kontakt' },
  { label: 'Impressum', href: '/impressum' },
  { label: 'Datenschutzerklärung', href: '/datenschutz' },
];
