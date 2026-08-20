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
    slug: 'platzhalter-3',
    title: 'Platzhalter: Thema folgt',
    date: null,
    kicker: 'Platzhalter',
    excerpt:
      'Diese Kachel ist noch nicht befüllt. Inhalt, Titel und Bild werden nachgeliefert.',
    href: '/news',
    platzhalter: true,
  },
  {
    slug: 'platzhalter-4',
    title: 'Platzhalter: Thema folgt',
    date: null,
    kicker: 'Platzhalter',
    excerpt:
      'Diese Kachel ist noch nicht befüllt. Inhalt, Titel und Bild werden nachgeliefert.',
    href: '/news',
    platzhalter: true,
  },
];
