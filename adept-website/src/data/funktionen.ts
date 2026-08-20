import type { BildKey } from './images';

export type Baustein = {
  titel: string;
  /**
   * Kurze, sachliche Erläuterung. Sie erscheint erst beim Aufklappen.
   *
   * Bewusst ohne Gedankenstriche und ohne Umgangssprache: die Texte stehen
   * auf einer Seite, die technische Entscheider lesen.
   */
  text: string;
};

export type Funktion = {
  slug: string;
  title: string;
  /** Kurzzeile für Übersichtsseiten. Erscheint NICHT im Dropdown. */
  teaser: string;
  /** Die im Briefing genannten Bausteine, jeweils mit Erläuterung. */
  bausteine: Baustein[];
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
    bild: 'feinplanung',
    title: 'Produktion & Feinplanung',
    teaser:
      'Planungsstände, die den tatsächlichen Fertigungsablauf abbilden, statt einer Planung, die im Tagesgeschäft sofort veraltet.',
    bausteine: [
      {
        titel: 'Feinplanungstools',
        text: 'Aufträge werden auf Maschinen und Schichten verteilt. Rüstzeiten, verfügbare Kapazität und zugesagte Termine gehen dabei in die Berechnung ein.',
      },
      {
        titel: 'Leitstände',
        text: 'Eine zentrale Oberfläche zeigt den aktuellen Stand der Fertigung. Änderungen werden dort eingetragen und wirken sofort auf den Plan.',
      },
      {
        titel: 'Automatische Umplanung',
        text: 'Bei Störungen, Eilaufträgen oder Materialverzug berechnet das System einen neuen Plan und weist aus, welche Termine davon betroffen sind.',
      },
      {
        titel: 'OEE-Dashboards',
        text: 'Verfügbarkeit, Leistung und Qualität je Anlage in einer Ansicht, berechnet aus den Daten des bestehenden Systems.',
      },
      {
        titel: 'KPI-Ansichten für Schichtleitung und Werksleitung',
        text: 'Getrennte Ansichten je Rolle. Die Schichtleitung sieht den laufenden Tag, die Werksleitung die Entwicklung über Wochen und Monate.',
      },
    ],
  },
  {
    slug: 'logistik-und-versandsteuerung',
    bild: 'versandsteuerung',
    title: 'Logistik & Versandsteuerung',
    teaser:
      'Von der Verpackungsentscheidung bis zur Versandpriorität: operative Logik, die direkt am ERP hängt.',
    bausteine: [
      {
        titel: 'Paletten- und Verpackungslogik',
        text: 'Aus Abmessungen und Mengen eines Auftrags berechnet das System, welche Ladungsträger benötigt werden und welche davon bereits im Sortiment sind.',
      },
      {
        titel: 'Versandsteuerung',
        text: 'Sendungen werden nach Termin, Route und Auslastung zusammengestellt und an den bestehenden Versandprozess übergeben.',
      },
      {
        titel: 'Priorisierungstools',
        text: 'Aufträge werden nach hinterlegten Regeln in eine Reihenfolge gebracht, etwa nach Liefertermin, Kundenzusage oder Auslastung der Verladung.',
      },
      {
        titel: 'Dispositions-Dashboards',
        text: 'Offene Aufträge, verfügbare Kapazität und anstehende Sendungen stehen in einer Ansicht, aus der heraus disponiert wird.',
      },
      {
        titel: 'ERP-integrierte Logistikoberflächen',
        text: 'Die Bedienoberfläche liegt in adept&, die Daten bleiben im ERP-System. Beide Seiten werden automatisch abgeglichen.',
      },
    ],
  },
  {
    slug: 'supply-chain-und-materialsteuerung',
    bild: 'material',
    title: 'Supply Chain & Materialsteuerung',
    teaser:
      'Engpässe früh sichtbar machen und Materialverzüge durchrechnen, bevor sie den Plan umwerfen.',
    bausteine: [
      {
        titel: 'Engpass- und Priorisierungstools',
        text: 'Das System erkennt, welche Materialien knapp werden, und ordnet die betroffenen Aufträge nach hinterlegten Regeln.',
      },
      {
        titel: 'Bedarfs- und Verfügbarkeitsübersichten',
        text: 'Geplanter Bedarf und verfügbarer Bestand stehen einander gegenüber, über einen frei wählbaren Zeitraum.',
      },
      {
        titel: 'Szenario-Logiken für Materialverzüge',
        text: 'Vor der Entscheidung wird durchgerechnet, wie sich eine verspätete Lieferung auf Termine und Folgeaufträge auswirkt.',
      },
    ],
  },
  {
    slug: 'reporting-und-operative-transparenz',
    bild: 'reporting',
    title: 'Reporting & operative Transparenz',
    teaser:
      'Kennzahlen für die Rolle, die sie braucht, mit Drill-down bis auf die einzelne Maschine.',
    bausteine: [
      {
        titel: 'Produktions- und Logistik-KPI-Cockpits',
        text: 'Die wesentlichen Kennzahlen aus Fertigung und Logistik auf einer Seite, laufend aus dem bestehenden System aktualisiert.',
      },
      {
        titel: 'Rollenbasierte Reporting-Oberflächen',
        text: 'Jede Rolle sieht die Kennzahlen, die für ihre Entscheidungen nötig sind, und nicht die der anderen.',
      },
      {
        titel: 'Drill-downs bis auf Maschinen-, Auftrags- oder Materialebene',
        text: 'Von der aggregierten Zahl bis zum einzelnen Datensatz, ohne die Oberfläche zu wechseln oder eine Liste zu exportieren.',
      },
    ],
  },
  {
    slug: 'systemintegration-und-erp-anbindung',
    bild: 'oberflaeche',
    title: 'Systemintegration & ERP-Anbindung',
    teaser:
      'Kundenspezifische Module ohne Systemablösung, angebunden an das, was bereits läuft.',
    bausteine: [
      {
        titel: 'API-basierte Anbindung an ERP-, SAP- und TMS-Systeme',
        text: 'Der Datenaustausch läuft über die Schnittstellen des bestehenden Systems, in beide Richtungen und ohne manuelles Zutun.',
      },
      {
        titel: 'Entwicklung kundenspezifischer Module ohne Systemablösung',
        text: 'Das vorhandene System bleibt führend. Ergänzt wird ausschließlich der Teil, den es nicht abdeckt.',
      },
    ],
  },
];

export const funktionBySlug = (slug: string) => funktionen.find((f) => f.slug === slug);
