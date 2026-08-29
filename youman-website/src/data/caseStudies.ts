import type { BildKey } from './images';

export type CaseStudy = {
  slug: string;
  /** Überschrift auf Kachel und Detailseite. */
  title: string;
  /** Name des Kunden, wie er genannt werden darf. */
  kunde: string;
  branche: string;
  /** ISO-Datum. null, solange kein freigegebenes Datum vorliegt. */
  date: string | null;
  excerpt: string;
  href: string;
  bild: BildKey;
  /**
   * Die eine Zahl, die den Fall trägt. Nur setzen, wenn sie belegt ist –
   * lieber keine Zahl als eine geschätzte.
   */
  kennzahl?: { wert: string; beschreibung: string };
};

/**
 * Case Studies – abgeschlossene Kundenprojekte.
 *
 * Bewusst getrennt von `news.ts`: eine Case Study belegt, was das Unternehmen
 * kann, eine Meldung berichtet, was es gerade tut. Beides in einer Liste zu
 * führen hat dazu geführt, dass der einzige belastbare Beleg zwischen drei
 * leeren Platzhalter-Kacheln stand.
 *
 * Quellen: die beiden gelieferten Case-Study-Unterlagen zu Drahtmüller und ABSolar.
 * Nicht enthalten: Einsparungs- und Prozentangaben, die dort nicht stehen,
 * sowie Kundenstimmen – dafür liegt nichts Freigegebenes vor.
 */
export const caseStudies: CaseStudy[] = [
  {
    slug: 'drahtmueller-palettenoptimierung',
    title: 'Palettenoptimierung bei der Drahtmüller GmbH',
    kunde: 'Drahtmüller GmbH / Lichtgitter-Gruppe',
    branche: 'Fertigung und Logistik',
    date: null,
    excerpt:
      '2.556 aktive Palettentypen, jede Entscheidung ein Einzelfall: Wie ein Modul von youman die Palettenlogik an das ERP-System anbindet, ohne Systemablösung.',
    href: '/case-studies/drahtmueller-palettenoptimierung',
    bild: 'gitter',
    kennzahl: {
      wert: '2.556',
      beschreibung: 'verschiedene Palettentypen waren im aktiven Einsatz',
    },
  },
  {
    slug: 'absolar-warenwirtschaft',
    title: 'Warenwirtschaftssystem für Solarprojekte',
    kunde: 'A&B SolarEnergy',
    branche: 'Photovoltaik',
    date: null,
    excerpt:
      'Angebote in Lexware Office, Lagerdaten in einer eigenen Datenbank, Baustellenplanung daneben: Wie aus drei getrennten Ständen ein durchgängiger Prozess von der Anfrage bis zur Baustelle wurde.',
    href: '/case-studies/absolar-warenwirtschaft',
    // Kein Photovoltaik-Motiv im Register. "logistik" trifft den Kern des
    // Falls – Lager und Materialfluss – bis ein passendes Bild vorliegt.
    bild: 'logistik',
  },
];

export const caseStudyNach = (slug: string) => caseStudies.find((c) => c.slug === slug);
