export type NavChild = {
  label: string;
  href: string;
};

export type NavItem = {
  label: string;
  href: string;
  children?: NavChild[];
  /**
   * true = erscheint nur im Footer, nicht in der Hauptnavigation.
   *
   * Fuer Seiten, die einen Verweis brauchen, damit sie nicht ohne Verweis
   * dastehen, aber in der obersten Ebene zu prominent waeren. Die
   * Regionalseite ist so ein Fall: adept& arbeitet im gesamten DACH-Raum,
   * und ein Ortsname neben "Branchen" und "Funktionen" wuerde das Gegenteil
   * nahelegen.
   */
  nurFooter?: boolean;
};

/**
 * Hauptnavigation.
 *
 * Das Briefing nennt: Branchen · Funktionen · News · Über uns · Kontakt,
 * Dropdown nur bei "Branchen" und "Funktionen".
 *
 * Abweichung: "Case Studies" ist dazugekommen. Als das Briefing entstand, gab
 * es einen einzigen Fall, der unter News lief. Inzwischen sind es zwei mit
 * eigener Übersichtsseite – ohne Navigationspunkt wären sie nur über die
 * Startseite erreichbar. Die Zeile lässt sich ersatzlos streichen, wenn die
 * Navigation dem Briefing wortgleich folgen soll.
 */
export const mainNav: NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'Branchen',
    href: '/branchen',
    children: [
      { label: 'Fertigung und Maschinenbau', href: '/branchen/fertigung-und-maschinenbau' },
      { label: 'Logistik & Versand', href: '/branchen/logistik-und-versand' },
      { label: 'E-Commerce & Onlinehandel', href: '/branchen/onlinehandel' },
      { label: 'Automobil und Zulieferer', href: '/branchen/automobil-und-zulieferer' },
    ],
  },
  {
    label: 'Funktionen',
    href: '/funktionen',
    children: [
      { label: 'Produktion & Feinplanung', href: '/funktionen/produktion-und-feinplanung' },
      { label: 'Logistik & Versandsteuerung', href: '/funktionen/logistik-und-versandsteuerung' },
      { label: 'Supply Chain & Materialsteuerung', href: '/funktionen/supply-chain-und-materialsteuerung' },
      { label: 'Reporting & operative Transparenz', href: '/funktionen/reporting-und-operative-transparenz' },
      { label: 'Systemintegration & ERP-Anbindung', href: '/funktionen/systemintegration-und-erp-anbindung' },
    ],
  },
  { label: 'Referenzprojekte', href: '/case-studies' },
  { label: 'News', href: '/news' },
  { label: 'Über uns', href: '/ueber-uns' },
  { label: 'Münsterland', href: '/muensterland', nurFooter: true },
  { label: 'Kontakt', href: '/kontakt' },
];

export const footerLegalNav: NavChild[] = [
  { label: 'Kontakt', href: '/kontakt' },
  { label: 'Impressum', href: '/impressum' },
  { label: 'Datenschutzerklärung', href: '/datenschutz' },
];
