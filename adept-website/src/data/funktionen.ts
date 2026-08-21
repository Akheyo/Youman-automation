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
  /**
   * Typische Problemstellungen dieses Funktionsbereichs, in der Sprache der
   * Betroffenen. Sie stehen VOR den Bausteinen: erst das Problem, dann die
   * Antwort. Wer sein eigenes Problem oben wiedererkennt, liest den Rest.
   *
   * Es sind allgemein bekannte Fachprobleme, keine Aussagen ueber konkrete
   * adept&-Projekte. Deshalb ohne Zahlen, ohne Kundennamen und ohne
   * Erfolgsbehauptung: was ein Projekt gebracht hat, steht ausschliesslich
   * in den Referenzprojekten, wo es belegt ist.
   */
  painpoints?: string[];
  /** Schlüssel aus dem Bildregister. */
  bild?: BildKey;
  /** Slug eines Referenzprojekts aus caseStudies.ts. */
  referenz?: string;
  /**
   * Halbsatz, an den im Fliesstext der Verweis auf das Referenzprojekt
   * angehaengt wird. Je Funktion eigen formuliert, damit er nicht wie ein
   * wiederholter Baustein wirkt.
   */
  referenzHinweis?: string;
};

/**
 * Quelle: Briefing "Wie die Website aussehen soll", Abschnitt "Funktionen dropdown".
 * Im Dropdown werden ausschließlich die Titel angezeigt – die Bausteine sind
 * Inhalt der jeweiligen Unterseite.
 */
export const funktionen: Funktion[] = [
  {
    slug: 'produktion-und-feinplanung',
    painpoints: [
      'Der Plan aus dem ERP steht auf dem Papier, geplant wird aber in einer Tabelle auf dem Rechner des Fertigungsleiters. Fällt er aus, weiß niemand, warum die Reihenfolge so ist, wie sie ist.',
      'Eine Eilbestellung kommt herein und die Umplanung läuft über Zuruf. Was sie an anderer Stelle verschiebt, zeigt sich erst, wenn dort etwas zu spät kommt.',
      'Rüstzeiten hängen an der Reihenfolge, die Reihenfolge entsteht aber nach Liefertermin. Dass zwei ähnliche Aufträge hintereinander eine Umrüstung sparen, sieht nur, wer die Maschine kennt.',
      'Stillstände werden auf einem Zettel notiert und später eingetippt, wenn überhaupt. Woran die Woche tatsächlich gehangen hat, lässt sich am Monatsende nicht mehr rekonstruieren.',
      'Schichtleitung und Werksleitung schauen auf verschiedene Zahlen, weil sich jede ihre eigene Auswertung gebaut hat. Die Diskussion dreht sich dann um die Zahl statt um das Problem.',
    ],
    referenz: 'drahtmueller-palettenoptimierung',
    referenzHinweis:
      'Ein abgeschlossenes Beispiel für genau diese Art von Sonderlogik im Fertigungsalltag ist das Projekt',
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
    painpoints: [
      'Welche Verpackung zu welchem Auftrag passt, weiß der Kollege im Versand. Ist er nicht da, wird geschätzt, und es geht zu viel Luft oder zu wenig Schutz mit.',
      'Sonderpaletten und Kundenvorgaben stehen in einer Liste neben dem System. Wer sie nicht kennt, packt nach Standard, und die Ware kommt beanstandet zurück.',
      'Kommissioniert wird in der Reihenfolge des Auftragseingangs statt nach Abholzeit der Spedition. Nachmittags steht fertige Ware herum, während anderes hektisch fertig wird.',
      'Was eine Sendung an Fracht gekostet hat, steht erst mit der Rechnung fest. Ob sie sich gelohnt hat, sieht man Wochen später.',
      'Der Dispositionsstand hängt an Zurufen und Mails. Wer wissen will, was heute noch rausgeht, muss durch die Halle laufen.',
    ],
    referenz: 'drahtmueller-palettenoptimierung',
    referenzHinweis:
      'Wie weit eine solche Verpackungs- und Palettenlogik im Einzelfall reicht, zeigt das Projekt',
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
    painpoints: [
      'Ein Material fehlt, und welche Aufträge daran hängen, findet man erst heraus, wenn man sie einzeln durchgeht.',
      'Der Lieferant meldet zwei Wochen Verzug. Was das für die Zusagen an Kunden bedeutet, lässt sich nicht durchrechnen, sondern nur schätzen.',
      'Sicherheitsbestände wurden einmal festgelegt und seitdem nicht angefasst. Von manchem liegt zu viel im Lager, von dem, was regelmäßig hakt, zu wenig.',
      'Bei knappem Material entscheidet, wer zuerst fragt, statt welcher Auftrag der wichtigere ist.',
      'Bestand ist im System vorhanden, aber längst für etwas anderes reserviert. Verfügbar und vorhanden werden verwechselt, und die Zusage platzt.',
    ],
    referenz: 'absolar-warenwirtschaft',
    referenzHinweis:
      'Was es bedeutet, Lagerdaten und Bedarfe aus getrennten Ständen zusammenzuführen, steht im Projekt',
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
    painpoints: [
      'Der Monatsbericht entsteht, indem jemand drei Tage lang Zahlen aus mehreren Systemen zusammenträgt. Bis er fertig ist, ist er alt.',
      'Jede Abteilung bringt eigene Zahlen mit ins Meeting. Die erste halbe Stunde geht dafür drauf, sich zu einigen, welche davon stimmt.',
      'Eine Kennzahl fällt auf, aber woran es liegt, ist nicht nachvollziehbar. Man sieht das Ergebnis, nicht den Auftrag, die Maschine oder das Material dahinter.',
      'Auswertungen liegen als Tabellen auf einzelnen Rechnern. Wer sie gebaut hat, ist die einzige Person, die sie ändern kann.',
      'Die Geschäftsführung bekommt dieselbe Ansicht wie die Schichtleitung, und keiner von beiden findet darin, was er sucht.',
    ],
    referenz: 'absolar-warenwirtschaft',
    referenzHinweis:
      'Wie fehlende Übersicht im Tagesgeschäft entsteht und wodurch sie sich beheben ließ, beschreibt das Projekt',
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
    painpoints: [
      'Daten wandern per Export und Import zwischen zwei Systemen. Jemand macht das morgens von Hand, und wenn er krank ist, macht es niemand.',
      'Dasselbe Feld wird an drei Stellen gepflegt. Welche Version stimmt, hängt davon ab, wen man fragt.',
      'Eine Anpassung wurde als Sonderentwicklung ins ERP gebaut. Beim nächsten Update ist offen, ob sie das übersteht.',
      'Der Prozess, um den es eigentlich geht, passt nicht in den Standard. Also läuft er daneben, in Tabellen, und lässt sich nicht auswerten.',
      'Für jede Auswertung über Systemgrenzen hinweg braucht es jemanden, der beide Systeme kennt. Davon gibt es genau eine Person.',
    ],
    referenz: 'absolar-warenwirtschaft',
    referenzHinweis:
      'Ein Fall, in dem drei getrennte Systeme zu einem durchgängigen Prozess verbunden wurden, ist das Projekt',
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
