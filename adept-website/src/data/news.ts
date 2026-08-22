import type { BildKey } from './images';

export type NewsItem = {
  slug: string;
  title: string;
  /** ISO-Datum. null, solange kein freigegebenes Datum vorliegt. */
  date: string | null;
  kicker: string;
  excerpt: string;
  href: string;
  /** true = Blindtext-Kachel, bis Inhalte geliefert werden. */
  platzhalter: boolean;
  /** Schlüssel aus dem Bildregister. */
  bild?: BildKey;
};

/**
 * Pressemitteilungen: Meldungen und Beiträge.
 *
 * Case Studies stehen NICHT hier, sondern in `caseStudies.ts`. Eine Case Study
 * belegt, was das Unternehmen kann; eine Meldung berichtet, was es gerade tut.
 * Solange beides in einer Liste stand, ging der einzige belastbare Beleg
 * zwischen leeren Platzhalter-Kacheln unter.
 *
 * Es werden keine Themen, Daten oder Zahlen erfunden: was noch nicht vorliegt,
 * bleibt ein sichtbar gekennzeichneter Platzhalter.
 */
export const news: NewsItem[] = [
  {
    slug: 'logistik-2026-kostendruck-automatisierung',
    title: 'Logistik 2026: Kostendruck als Treiber für pragmatische Automatisierung',
    // Datum der Veröffentlichung auf dieser Seite, nicht das der Quellen.
    date: '2026-08-19',
    kicker: 'Branche',
    excerpt:
      'Nicht fehlende Technologie ist das Problem, sondern der Einsatz ohne Kosten-Nutzen-Rechnung. Was aktuelle Branchenanalysen für produktionsnahe und logistikintensive Betriebe bedeuten.',
    href: '/news/logistik-2026-kostendruck-automatisierung',
    platzhalter: false,
    bild: 'versandzentrum',
  },
  {
    slug: 'erp-insellosungen-anbinden',
    date: '2026-08-21',
    kicker: 'Praxis',
    excerpt:
      'Der Wunsch nach einem sauberen Neuanfang ist verständlich und selten die günstigste Antwort. Woran sich vor dem Projekt erkennen lässt, ob eine Anbindung reicht.',
    title: 'ERP-Insellösungen anbinden statt das System wechseln',
    href: '/news/erp-insellosungen-anbinden',
    platzhalter: false,
    bild: 'erp-bausteine',
  },
  {
    slug: 'tabelle-neben-dem-erp',
    date: '2026-08-21',
    kicker: 'Praxis',
    excerpt:
      'Fast jeder Betrieb führt Tabellen neben dem ERP. Sie gelten als Provisorium und zeigen ziemlich genau, wo eine Lösung fehlt.',
    title: 'Die Tabelle neben dem ERP',
    href: '/news/tabelle-neben-dem-erp',
    platzhalter: false,
    bild: 'digitaler-zwilling',
  },
];
