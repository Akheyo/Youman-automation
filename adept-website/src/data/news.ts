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
 * Die vier Kacheln der Sektion "Aktuelle Themen" auf der Startseite.
 *
 * Belastbar ist bislang ausschließlich die Case Study Drahtmüller. Die übrigen
 * drei Kacheln sind bewusst als Platzhalter markiert und werden auf der Seite
 * auch sichtbar als solche ausgewiesen – es werden keine Themen, Daten oder
 * Zahlen erfunden.
 */
export const news: NewsItem[] = [
  {
    slug: 'drahtmueller-palettenoptimierung',
    bild: 'paletten',
    title: 'Palettenoptimierung bei der Drahtmüller GmbH',
    date: null,
    kicker: 'Case Study',
    excerpt:
      '2.556 aktive Palettentypen, jede Entscheidung ein Einzelfall: Wie ein Modul im adept&-Gerüst die Palettenlogik an das ERP-System anbindet – ohne Systemablösung.',
    href: '/news/drahtmueller-palettenoptimierung',
    platzhalter: false,
  },
  {
    slug: 'platzhalter-2',
    title: 'Platzhalter – Thema folgt',
    date: null,
    kicker: 'Platzhalter',
    excerpt:
      'Diese Kachel ist noch nicht befüllt. Inhalt, Titel und Bild werden nachgeliefert.',
    href: '/news',
    platzhalter: true,
  },
  {
    slug: 'platzhalter-3',
    title: 'Platzhalter – Thema folgt',
    date: null,
    kicker: 'Platzhalter',
    excerpt:
      'Diese Kachel ist noch nicht befüllt. Inhalt, Titel und Bild werden nachgeliefert.',
    href: '/news',
    platzhalter: true,
  },
  {
    slug: 'platzhalter-4',
    title: 'Platzhalter – Thema folgt',
    date: null,
    kicker: 'Platzhalter',
    excerpt:
      'Diese Kachel ist noch nicht befüllt. Inhalt, Titel und Bild werden nachgeliefert.',
    href: '/news',
    platzhalter: true,
  },
];
