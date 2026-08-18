import type { BildKey } from './images';

export type Funktion = {
  slug: string;
  title: string;
  /** Kurzzeile für Übersichtsseiten. Erscheint NICHT im Dropdown. */
  teaser: string;
  /** Die im Briefing genannten Bausteine. */
  bausteine: string[];
  /** Schlüssel aus dem Bildregister. */
  bild?: BildKey;
};

/**
 * Quelle: Briefing "Wie die Website aussehen soll", Abschnitt "Funktionen dropdown".
 * Im Dropdown werden ausschließlich die Titel angezeigt – die Bausteine sind
 * Inhalt der jeweiligen Unterseite.
 */
export const funktionen: Funktion[] = [
  {
    slug: 'produktion-und-feinplanung',
    bild: 'halle',
    title: 'Produktion & Feinplanung',
    teaser:
      'Planungsstände, die den tatsächlichen Fertigungsablauf abbilden – statt einer Planung, die im Tagesgeschäft sofort veraltet.',
    bausteine: [
      'Feinplanungstools',
      'Leitstände',
      'Automatische Umplanung',
      'OEE-Dashboards',
      'KPI-Ansichten für Schichtleitung und Werksleitung',
    ],
  },
  {
    slug: 'logistik-und-versandsteuerung',
    bild: 'paletten',
    title: 'Logistik & Versandsteuerung',
    teaser:
      'Von der Verpackungsentscheidung bis zur Versandpriorität: operative Logik, die direkt am ERP hängt.',
    bausteine: [
      'Paletten- und Verpackungslogik',
      'Versandsteuerung',
      'Priorisierungstools',
      'Dispositions-Dashboards',
      'ERP-integrierte Logistikoberflächen',
    ],
  },
  {
    slug: 'supply-chain-und-materialsteuerung',
    bild: 'material',
    title: 'Supply Chain & Materialsteuerung',
    teaser:
      'Engpässe früh sichtbar machen und Materialverzüge durchrechnen, bevor sie den Plan umwerfen.',
    bausteine: [
      'Engpass- und Priorisierungstools',
      'Bedarfs- und Verfügbarkeitsübersichten',
      'Szenario-Logiken für Materialverzüge',
    ],
  },
  {
    slug: 'reporting-und-operative-transparenz',
    bild: 'reporting',
    title: 'Reporting & operative Transparenz',
    teaser:
      'Kennzahlen für die Rolle, die sie braucht – mit Drill-down bis auf die einzelne Maschine.',
    bausteine: [
      'Produktions- und Logistik-KPI-Cockpits',
      'Rollenbasierte Reporting-Oberflächen',
      'Drill-downs bis auf Maschinen-, Auftrags- oder Materialebene',
    ],
  },
  {
    slug: 'systemintegration-und-erp-anbindung',
    bild: 'oberflaeche',
    title: 'Systemintegration & ERP-Anbindung',
    teaser:
      'Kundenspezifische Module ohne Systemablösung – angebunden an das, was bereits läuft.',
    bausteine: [
      'API-basierte Anbindung an ERP-, SAP- und TMS-Systeme',
      'Entwicklung kundenspezifischer Module ohne Systemablösung',
    ],
  },
];

export const funktionBySlug = (slug: string) => funktionen.find((f) => f.slug === slug);
