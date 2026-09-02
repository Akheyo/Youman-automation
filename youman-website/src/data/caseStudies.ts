import drahtmueller from '../assets/img/referenz-drahtmueller.png';
import absolar from '../assets/img/referenz-absolar.png';

export type CaseStudy = {
  slug: string;
  /** Überschrift auf Kachel und Detailseite. */
  title: string;
  /** Name des Kunden, wie er genannt werden darf. */
  kunde: string;
  branche: string;
  /**
   * Abschluss des Projekts als ISO-Datum. Das Jahr allein genügt und ist
   * nach ISO 8601 gültig; Google nimmt es als datePublished an.
   *
   * null, solange kein freigegebenes Datum vorliegt. Ein geschätztes
   * Datum wäre schlechter als keines, weil es an genau der Stelle steht,
   * an der Aktualität geprüft wird.
   */
  date: string | null;
  excerpt: string;
  href: string;
  /** Was auf dem Bild zu diesem Projekt zu sehen sein soll, solange keines vorliegt. */
  bildhinweis: string;
  /** Das Motiv. Hier ein Schema des Ablaufs, kein Foto. */
  bild: ImageMetadata;
  /** Bildbeschreibung: der Ablauf in Worten, damit er auch ohne das Bild ankommt. */
  bildAlt: string;
  /**
   * Die eine Zahl, die den Fall trägt. Nur setzen, wenn sie belegt ist –
   * lieber keine Zahl als eine geschätzte.
   */
  kennzahl?: { wert: string; beschreibung: string };
  /**
   * Slugs aus leistungen.ts, um die es in diesem Projekt tatsächlich ging.
   *
   * Daraus entsteht der Verweis in die Gegenrichtung: Die Leistungsseite
   * zeigt das Projekt, das dort einschlägig ist. Vorher hingen die beiden
   * Referenzseiten mit vier und fünf eingehenden Verweisen am Rand der
   * Seite, während die Kontaktseite 189 bekam. Ausgerechnet die einzigen
   * Seiten, die etwas belegen statt zu behaupten, waren am schlechtesten
   * angebunden.
   *
   * Zugeordnet wird nur, was aus der Projektunterlage hervorgeht.
   */
  leistungen: string[];
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
    date: '2026',
    excerpt:
      '2.556 aktive Palettentypen, jede Entscheidung ein Einzelfall: Wie ein Modul von youman die Palettenlogik an das ERP-System anbindet, ohne Systemablösung.',
    href: '/case-studies/drahtmueller-palettenoptimierung',
    bildhinweis: 'Gitterroste in Transportgestellen',
    bild: drahtmueller,
    bildAlt:
      'Schema des Ablaufs: Auftragsdaten mit Maßen und Mengen laufen in die Palettenlogik, die zwischen Standard und Sonderbau entscheidet und den Bedarf je Typ an das weiterhin führende ERP-System zurückgibt.',
    kennzahl: {
      wert: '2.556',
      beschreibung: 'verschiedene Palettentypen waren im aktiven Einsatz',
    },
    // Ein eigenes Modul am bestehenden ERP, und darin eine Regel, die die
    // Zuordnung selbst entscheidet. Beides ist in der Unterlage belegt.
    leistungen: ['individuelle-software', 'ki-automationen'],
  },
  {
    slug: 'absolar-warenwirtschaft',
    title: 'Warenwirtschaftssystem für Solarprojekte',
    kunde: 'A&B SolarEnergy',
    branche: 'Photovoltaik',
    date: '2026',
    excerpt:
      'Angebote in Lexware Office, Lagerdaten in einer eigenen Datenbank, Baustellenplanung daneben: Wie aus drei getrennten Ständen ein durchgängiger Prozess von der Anfrage bis zur Baustelle wurde.',
    href: '/case-studies/absolar-warenwirtschaft',
    // Kein Photovoltaik-Motiv im Register. "logistik" trifft den Kern des
    // Falls – Lager und Materialfluss – bis ein passendes Bild vorliegt.
    bildhinweis: 'Lager und Kommissionierung',
    bild: absolar,
    bildAlt:
      'Schema des Ablaufs: Aus einem Angebot in Lexware Office entsteht bei Annahme automatisch ein Projekt, daraus wird der Materialbedarf abgeleitet und an die Baustelle weitergegeben.',
    // Ein Warenwirtschaftssystem, gebaut für einen Ablauf, den kein
    // Standardprogramm abbildet. Kein Shop im Spiel, deshalb nicht unter
    // E-Commerce geführt.
    leistungen: ['individuelle-software'],
  },
];

/**
 * Alle Referenzprojekte, in denen eine bestimmte Leistung vorkommt.
 *
 * Gebraucht auf den Leistungsseiten, damit dort das Projekt steht, das die
 * Leistung tatsächlich belegt, statt einer weiteren Beschreibung.
 */
export const referenzenZurLeistung = (slug: string) =>
  caseStudies.filter((fall) => fall.leistungen.includes(slug));

/** Die übrigen Referenzprojekte, für den Querverweis am Ende einer Fallseite. */
export const andereReferenzen = (slug: string) =>
  caseStudies.filter((fall) => fall.slug !== slug);

export const caseStudyNach = (slug: string) => caseStudies.find((c) => c.slug === slug);
