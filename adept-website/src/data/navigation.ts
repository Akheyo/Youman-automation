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
  { label: 'Über uns', href: '/ueber-uns' },
  { label: 'Münsterland', href: '/muensterland', nurFooter: true },
  { label: 'Kontakt', href: '/kontakt' },
];

export const footerLegalNav: NavChild[] = [
  { label: 'Kontakt', href: '/kontakt' },
  { label: 'Impressum', href: '/impressum' },
  { label: 'Datenschutzerklärung', href: '/datenschutz' },
];
