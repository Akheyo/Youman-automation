import type { BildKey } from './images';

export type Branche = {
  slug: string;
  title: string;
  /** Kurzzeile für Übersicht und Karten. */
  teaser: string;
  /**
   * Einordnung der Branche. Bewusst allgemein gehalten: konkrete Painpoints
   * aus adept&-Projekten liegen für diese Branche noch nicht vor.
   */
  intro: string;
  /**
   * Konkrete operative Problemstellungen dieser Branche, in der Sprache der
   * Betroffenen. Sie sind der eigentliche Grund, warum jemand die Seite
   * liest: Wer sein eigenes Problem wiedererkennt, liest weiter.
   *
   * Es werden hier keine erfunden. Fehlt die Liste, entfällt der Abschnitt
   * ersatzlos – ein allgemein gehaltener Painpoint ist schlechter als
   * keiner, weil er die konkreten mit entwertet.
   */
  painpoints?: string[];
  /** Slugs aus funktionen.ts, die für diese Branche typischerweise greifen. */
  funktionen: string[];
  /**
   * true = für diese Branche liegen noch keine freigegebenen Inhalte vor.
   * Die Seite zeigt dann einen unmissverständlich markierten Platzhalter.
   */
  platzhalter: boolean;
  /** Slug einer Referenz aus news.ts, falls vorhanden. */
  referenz?: string;
  /** Schlüssel aus dem Bildregister. */
  bild?: BildKey;
};

export const branchen: Branche[] = [
  {
    slug: 'fertigung-und-maschinenbau',
    bild: 'maschinenbau',
    title: 'Fertigung und Maschinenbau',
    teaser: 'Variantenreiche Fertigung planbar machen – ohne das ERP zu ersetzen.',
    intro:
      'In der variantenreichen Fertigung entstehen die teuersten Entscheidungen selten im ERP-System, sondern daneben: in Excel-Listen, Zurufen und Erfahrungswissen einzelner Personen. adept& bildet genau diese operative Logik als Modul ab und bindet es an das bestehende System an.',
    funktionen: ['produktion-und-feinplanung', 'supply-chain-und-materialsteuerung', 'reporting-und-operative-transparenz'],
    platzhalter: false,
  },
  {
    slug: 'logistik-und-versand',
    bild: 'logistik',
    title: 'Logistik & Versand',
    teaser: 'Verpackungs-, Paletten- und Versandlogik direkt am Auftragseingang.',
    intro:
      'Zwischen Auftragseingang und Versandentscheidung liegt in logistikintensiven Betrieben häufig eine Lücke, die manuell geschlossen wird. adept& digitalisiert diese Entscheidungslogik und führt die Ergebnisse in den bestehenden Prozess zurück – so umgesetzt bei der Drahtmüller GmbH.',
    funktionen: ['logistik-und-versandsteuerung', 'supply-chain-und-materialsteuerung', 'systemintegration-und-erp-anbindung'],
    platzhalter: false,
    referenz: 'drahtmueller-palettenoptimierung',
  },
  {
    slug: 'konsumgueter-und-handel',
    bild: 'handel',
    title: 'Konsumgüter und Handel',
    teaser: 'Inhalte für diese Branche werden derzeit erarbeitet.',
    intro: '',
    funktionen: ['reporting-und-operative-transparenz', 'systemintegration-und-erp-anbindung'],
    platzhalter: true,
  },
  {
    slug: 'e-commerce-und-autohandel',
    // Vorläufig das Versandzentrum aus dem Bildregister: es zeigt Kartons auf
    // einer Förderstrecke und trifft damit die Versandseite. Ein Motiv, das
    // auch den Fahrzeughandel abbildet, gibt es noch nicht.
    bild: 'versandzentrum',
    title: 'E-Commerce & Autohandel',
    teaser: 'Artikelpflege, Listings und Retouren automatisiert – angebunden an Ihren Bestand.',
    intro:
      'Im Onlinehandel entsteht der Aufwand selten beim Verkaufen, sondern davor und danach: Artikeldaten für jeden Kanal einzeln pflegen, Listings je Marktplatz neu aufbauen, Retouren wieder in den Bestand bringen. adept& bildet genau diese Abläufe als Modul ab und hängt sie an das System, das die Bestände führt. Im Fahrzeughandel gilt dieselbe Logik eine Ebene größer – für Inserate, Standzeiten und den Status eines Fahrzeugs.',
    painpoints: [
      'Artikeldaten werden für jeden Kanal von Hand gepflegt. Eine Preisänderung oder ein neues Foto bedeutet dieselbe Arbeit drei- oder viermal.',
      'Ein neues Produkt online zu stellen dauert länger, als es sollte: Texte, Merkmale, Kategorien und Bilder werden je Marktplatz neu zusammengesucht und in dessen Format gebracht.',
      'Jeder Marktplatz verlangt eigene Pflichtfelder und Kategoriebäume. Was bei einem Kanal durchgeht, wird beim nächsten abgelehnt.',
      'Bestände in Shop, Marktplatz und Lager laufen auseinander. Verkauft wird Ware, die nicht mehr da ist – Storno, Nachbestellung und eine schlechtere Bewertung inklusive.',
      'Retouren laufen neben dem System. Wareneingang, Zustandsprüfung und Wiedereinlagerung hängen nicht am Bestand, und die Ware fehlt im Verkauf, obwohl sie im Regal steht.',
      'Ob eine Retoure zurück in den Verkauf geht, als B-Ware neu gelistet oder abgeschrieben wird, entscheidet Erfahrung statt einer hinterlegten Regel.',
      'Was ein Auftrag am Ende wirklich eingebracht hat – nach Verpackung, Versand, Retoure und Marktplatzgebühr –, steht nirgends zusammen.',
      'Im Fahrzeughandel dasselbe eine Ebene größer: Inserate liegen in mehreren Börsen, ein verkauftes Fahrzeug steht tagelang weiter online, und Standzeit sowie gebundenes Kapital je Fahrzeug sind nicht auf Knopfdruck sichtbar.',
    ],
    funktionen: ['systemintegration-und-erp-anbindung', 'logistik-und-versandsteuerung', 'reporting-und-operative-transparenz'],
    platzhalter: false,
  },
  {
    slug: 'automobil-und-zulieferer',
    bild: 'automobil',
    title: 'Automobil und Zulieferer',
    teaser: 'Termintreue und Materialverfügbarkeit über die gesamte Lieferkette.',
    intro:
      'Zulieferbetriebe arbeiten unter engen Abruf- und Termintreue-Vorgaben. Kritisch ist dabei weniger das Fehlen von Daten als deren Zusammenführung zu einer belastbaren Entscheidung. adept& bündelt Auftrags-, Material- und Kapazitätsdaten in einer Oberfläche und synchronisiert sie automatisch mit dem ERP-System.',
    funktionen: ['produktion-und-feinplanung', 'supply-chain-und-materialsteuerung', 'systemintegration-und-erp-anbindung'],
    platzhalter: false,
  },
];

export const brancheBySlug = (slug: string) => branchen.find((b) => b.slug === slug);
