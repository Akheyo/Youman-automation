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
  /** Was auf dem Bild zu diesem Projekt zu sehen sein soll, solange keines vorliegt. */
  bildhinweis: string;
  /**
   * Die eine Zahl, die den Fall trägt. Nur setzen, wenn sie belegt ist –
   * lieber keine Zahl als eine geschätzte.
   */
  kennzahl?: { wert: string; beschreibung: string };
};

/**
 * Case Studies – abgeschlossene Kundenprojekte.
 *
 * Die einzigen Seiten, die belegen statt behaupten. Entsprechend streng ist,
 * was hier stehen darf: nur Angaben aus den Projektunterlagen.
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
    bildhinweis: 'Gitterroste in Transportgestellen',
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
    bildhinweis: 'Lager und Kommissionierung',
  },
];

export const caseStudyNach = (slug: string) => caseStudies.find((c) => c.slug === slug);
