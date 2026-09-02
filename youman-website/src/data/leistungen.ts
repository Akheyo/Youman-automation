/**
 * Die Leistungen von youman.
 *
 * Ersetzt die frueheren "Funktionen", die auf ERP-Module zugeschnitten waren.
 * Gegliedert nach dem, was jemand sucht, nicht nach dem, was intern
 * zusammengehoert: Wer einen Chatbot braucht, sucht nach einem Chatbot.
 *
 * Es steht hier nichts, wofuer es keine Seite gibt. Ein Eintrag ohne Inhalt
 * dahinter waere eine Behauptung.
 */

import kiAutomationen from '../assets/img/leistung-ki-automationen.png';
import chatbots from '../assets/img/leistung-chatbots.png';
import webseiten from '../assets/img/leistung-webseiten.png';
import eCommerce from '../assets/img/leistung-e-commerce.png';
import individuelleSoftware from '../assets/img/leistung-individuelle-software.png';

export type Baustein = {
  titel: string;
  /** Kurze, sachliche Erlaeuterung. Erscheint erst beim Aufklappen. */
  text: string;
};

export type Leistung = {
  slug: string;
  title: string;
  /** Was auf dem Bild zu dieser Leistung zu sehen sein soll, solange keines vorliegt. */
  bildhinweis: string;
  /** Das Motiv. Steht hier und nicht in der Seite, damit es an allen Stellen dasselbe ist. */
  bild: ImageMetadata;
  /**
   * Bildbeschreibung. Sie ist das, was statt des Bildes gehoert wird, und
   * das Einzige, was eine Suchmaschine ueber den Inhalt erfaehrt. Deshalb
   * beschreibt sie, was zu sehen ist, und wiederholt nicht den Titel.
   */
  bildAlt: string;
  /** Kurzzeile fuer Uebersichten und Kacheln. */
  teaser: string;
  /** Titel fuer die Suche, wo der Bereichsname allein zu wenig traegt. */
  seoTitel?: string;
  /** Beschreibung fuer die Suche. */
  seoBeschreibung?: string;
  /** Einleitung auf der Unterseite. */
  intro: string;
  /** Was in diesem Bereich konkret gebaut wird. */
  bausteine: Baustein[];
  /**
   * Typische Problemstellungen, in der Sprache der Betroffenen. Sie stehen
   * VOR den Bausteinen: erst das Problem, dann die Antwort.
   *
   * Es sind benannte Fachprobleme, keine Aussagen ueber konkrete Projekte,
   * deshalb ohne Zahlen und ohne Erfolgsbehauptung.
   */
  painpoints: string[];
};

export const leistungen: Leistung[] = [
  {
    slug: 'ki-automationen',
    bild: kiAutomationen,
    bildAlt:
      'Laptop auf einem Schreibtisch, darauf ein Automationswerkzeug mit einem E-Commerce-Bestellprozess: Bestellung speichern, Zahlung prüfen, Lagerbestand prüfen, Versandlabel erstellen, Bestätigung senden.',
    bildhinweis: 'Arbeitsplatz, an dem ein Ablauf durchläuft',
    title: 'KI-Automationen',
    teaser: 'Wiederkehrende Arbeit, die heute Menschen erledigen, läuft künftig von selbst.',
    seoTitel: 'KI-Automation für Mittelstand und Industrie',
    seoBeschreibung:
      'Automatisierte Bearbeitung von Anfragen, Dokumenten und Datenpflege. youman baut KI-Automationen, die an Ihre bestehenden Systeme angebunden sind.',
    intro:
      'Die meiste Arbeit, die sich automatisieren lässt, sieht nicht nach Technik aus. Sie sieht aus wie jemand, der morgens Mails sortiert, Daten von einem Formular in ein System überträgt oder aus fünf Dokumenten dieselben drei Angaben heraussucht. Genau dort setzen wir an, und zwar an dem Ablauf, den Sie tatsächlich haben, nicht an einem gedachten.',
    painpoints: [
      'Anfragen werden von Hand vorsortiert, bevor überhaupt jemand inhaltlich darauf antwortet.',
      'Angaben aus Mails, PDFs oder Formularen werden abgetippt, obwohl sie schon digital vorliegen.',
      'Immer dieselben Auskünfte werden mehrmals täglich gegeben, weil sie nirgends abrufbar stehen.',
      'Eine Aufgabe hängt an einer einzigen Person. Ist sie nicht da, bleibt der Vorgang liegen.',
      'Niemand weiß, wie viel Zeit diese Handgriffe zusammen im Monat kosten, weil sie nirgends erfasst sind.',
    ],
    bausteine: [
      {
        titel: 'Dokumente auslesen und einordnen',
        text: 'Rechnungen, Lieferscheine, Bestellungen und Formulare werden gelesen, die relevanten Angaben herausgezogen und dorthin geschrieben, wo sie hingehören.',
      },
      {
        titel: 'Anfragen vorsortieren und beantworten',
        text: 'Eingehende Nachrichten werden nach Anliegen sortiert, weitergeleitet und, wo es sich sicher entscheiden lässt, direkt beantwortet.',
      },
      {
        titel: 'Abläufe zwischen Systemen verbinden',
        text: 'Was heute per Export und Import wandert, läuft künftig ohne Zutun. Auslöser, Regeln und Ausnahmen werden vorher festgelegt.',
      },
      {
        titel: 'Übergabe an den Menschen',
        text: 'Für jeden Fall wird bestimmt, ab wann nicht mehr automatisch entschieden wird. Unsichere Fälle landen bei einer Person statt im Nichts.',
      },
    ],
  },
  {
    slug: 'chatbots',
    bild: chatbots,
    bildAlt:
      'Chatfenster im Browser. Auf die Frage, wie sich ein Prozess automatisieren lässt, antwortet der Assistent mit fünf nummerierten Schritten und bietet drei Anschlussfragen an.',
    bildhinweis: 'Chatfenster im laufenden Gespräch',
    title: 'Chatbots',
    teaser: 'Auskunft rund um die Uhr, auf Grundlage Ihrer eigenen Unterlagen.',
    seoTitel: 'Chatbots für Website und Kundenservice',
    seoBeschreibung:
      'Chatbots, die auf Ihren eigenen Unterlagen antworten statt zu raten, mit sauberer Übergabe an Mitarbeitende. Entwickelt und angebunden von youman.',
    intro:
      'Ein Chatbot ist nur so gut wie das, was er weiß. Deshalb bauen wir keinen, der allgemeine Antworten gibt, sondern einen, der auf Ihren Unterlagen arbeitet: Produktdaten, Preislisten, Anleitungen, Öffnungszeiten, Rückgaberegeln. Und wir legen fest, wann er schweigt und stattdessen weiterleitet.',
    painpoints: [
      'Dieselben Fragen kommen jeden Tag, und jede kostet dieselbe Antwortzeit erneut.',
      'Außerhalb der Bürozeiten bekommt niemand eine Auskunft, obwohl die Antwort längst irgendwo steht.',
      'Ein vorhandener Bot erfindet Antworten, sobald er etwas nicht weiß, und das fällt erst beim Kunden auf.',
      'Es gibt keinen sauberen Übergang vom Bot zum Menschen, das Gespräch beginnt bei null.',
      'Was die Leute tatsächlich fragen, wird nirgends ausgewertet.',
    ],
    bausteine: [
      {
        titel: 'Antworten aus Ihren Unterlagen',
        text: 'Der Bot greift auf hinterlegte Dokumente und Daten zu und belegt, woher eine Auskunft stammt, statt sie zu erfinden.',
      },
      {
        titel: 'Grenzen und Übergabe',
        text: 'Für heikle Themen wird festgelegt, dass nicht selbst geantwortet wird. Das Gespräch geht mit Verlauf an eine Person über.',
      },
      {
        titel: 'Anbindung an Bestand und Aufträge',
        text: 'Wo es Sinn ergibt, sieht der Bot den tatsächlichen Stand: Verfügbarkeit, Lieferstatus, offene Vorgänge.',
      },
      {
        titel: 'Auswertung der Gespräche',
        text: 'Welche Fragen kommen wie oft, wo bricht es ab, was wurde nicht beantwortet. Daraus entstehen die nächsten Verbesserungen.',
      },
    ],
  },
  {
    slug: 'webseiten',
    bild: webseiten,
    bildAlt:
      'Dieselbe Unternehmensseite nebeneinander auf einem Laptop und einem Tablet, davor ein Skizzenblock mit dem Aufbau der Seite.',
    bildhinweis: 'Dieselbe Seite auf mehreren Geräten',
    title: 'Webseiten',
    teaser: 'Schnell, barrierefrei und auffindbar. Kein Baukasten, kein Ladebalken.',
    seoTitel: 'Webseiten entwickeln lassen, schnell und auffindbar',
    seoBeschreibung:
      'Webseiten ohne Baukasten: kurze Ladezeiten, sauberer Aufbau für Suchmaschinen, barrierefrei nach WCAG 2.1. Gemessen wird vor der Übergabe, nicht behauptet.',
    intro:
      'Die meisten Webseiten scheitern nicht am Aussehen, sondern an drei Dingen: Sie laden zu langsam, sie sind für Suchmaschinen schlecht lesbar, und mit Tastatur oder Screenreader sind sie kaum bedienbar. Das sind messbare Größen, keine Geschmacksfragen, und wir messen sie vor der Übergabe.',
    painpoints: [
      'Die Seite braucht Sekunden bis zum ersten Bild, und Besucher sind vorher weg.',
      'Sie wird nicht gefunden, weil Titel und Struktur nie dafür gemacht wurden.',
      'Auf dem Handy verrutscht das Layout oder es lässt sich seitlich schieben.',
      'Jede Änderung kostet einen Termin bei der Agentur, weil niemand sonst herankommt.',
      'Mit Tastatur allein ist die Seite nicht bedienbar, und das schließt einen Teil der Besucher aus.',
    ],
    bausteine: [
      {
        titel: 'Kurze Ladezeiten',
        text: 'Ausgeliefert werden fertige Seiten statt einer Anwendung, die sich erst im Browser zusammenbaut. Gemessen wird an den Core Web Vitals.',
      },
      {
        titel: 'Auffindbarkeit von Anfang an',
        text: 'Titel, Beschreibungen, Überschriftenstruktur und strukturierte Daten entstehen mit der Seite, nicht nachträglich.',
      },
      {
        titel: 'Barrierefreiheit',
        text: 'Geprüft gegen WCAG 2.1 A und AA: Kontraste, Tastaturbedienung, Beschriftungen, Fokus. Automatisiert bei jeder Änderung.',
      },
      {
        titel: 'Pflegbar ohne uns',
        text: 'Inhalte liegen an einer Stelle und sind ohne Programmierkenntnisse änderbar. Wer weiterarbeiten will, kann das.',
      },
    ],
  },
  {
    slug: 'e-commerce',
    bild: eCommerce,
    bildAlt:
      'Produktseite eines Onlineshops auf einem Laptop, daneben ein Einkaufswagen mit Paketen und ein Telefon mit derselben Artikelübersicht.',
    bildhinweis: 'Kommissionierung und Versandvorbereitung',
    title: 'E-Commerce-Lösungen',
    teaser: 'Artikel, Bestände und Bestellungen laufen über alle Kanäle synchron.',
    seoTitel: 'E-Commerce-Lösungen und Marktplatz-Anbindung',
    seoBeschreibung:
      'Artikelpflege, Bestandsabgleich und Retouren über Shop und Marktplätze hinweg automatisiert. Anbindung an Amazon, eBay und Ihr Warenwirtschaftssystem.',
    intro:
      'Im Onlinehandel entsteht der Aufwand selten beim Verkaufen, sondern davor und danach: Artikeldaten für jeden Kanal einzeln pflegen, Listings je Marktplatz neu aufbauen, Retouren wieder in den Bestand bringen. Wir kennen die gängigen Marktplätze aus der Praxis, darunter Amazon und eBay, und wissen, an welchen Eigenheiten dort Arbeit hängen bleibt.',
    painpoints: [
      'Artikeldaten werden für jeden Kanal von Hand gepflegt. Eine Preisänderung bedeutet dieselbe Arbeit drei- oder viermal.',
      'Jeder Marktplatz verlangt eigene Pflichtfelder und Kategorien. Was bei einem durchgeht, wird beim nächsten abgelehnt.',
      'Bestände in Shop, Marktplatz und Lager laufen auseinander. Verkauft wird Ware, die nicht mehr da ist.',
      'Retouren laufen neben dem System. Die Ware steht im Wareneingang und fehlt trotzdem im Verkauf.',
      'Was ein Auftrag nach Verpackung, Versand, Retoure und Gebühren wirklich eingebracht hat, steht nirgends zusammen.',
    ],
    bausteine: [
      {
        titel: 'Artikeldaten an einer Stelle',
        text: 'Gepflegt wird einmal, verteilt wird automatisch. Je Kanal werden die dort geforderten Felder und Formate erzeugt.',
      },
      {
        titel: 'Bestände synchron halten',
        text: 'Verkäufe, Wareneingänge und Reservierungen wirken auf alle Kanäle, ohne dass jemand nachträgt.',
      },
      {
        titel: 'Retouren mit hinterlegter Regel',
        text: 'Ob eine Retoure zurück in den Verkauf geht, als B-Ware gelistet oder abgeschrieben wird, entscheidet eine Regel statt Erfahrung.',
      },
      {
        titel: 'Auswertung je Auftrag',
        text: 'Erlös nach allen Kosten, sichtbar je Artikel, Kanal und Zeitraum.',
      },
    ],
  },
  {
    slug: 'individuelle-software',
    bild: individuelleSoftware,
    bildAlt:
      'Bildschirm mit einer Projektübersicht: Projekte mit Kunde, Status und Fortschritt, daneben eine Aufgabenliste und die Details eines ausgewählten Projekts.',
    bildhinweis: 'Bildschirm mit einer eigenen Anwendung',
    title: 'Individuelle Software',
    teaser: 'Für den Ablauf, für den es kein fertiges Programm gibt.',
    seoTitel: 'Individuelle Software entwickeln lassen',
    seoBeschreibung:
      'Software für Abläufe, die kein Standardprogramm abbildet. Angebunden an ERP, Warenwirtschaft oder Datenbank, ohne das Bestehende abzulösen. Entwickelt von youman.',
    intro:
      'In fast jedem Betrieb gibt es eine Datei, die nicht im Handbuch steht und an der trotzdem ein Teil des Tagesgeschäfts hängt. Sie ist entstanden, weil jemand eine Aufgabe erledigen musste, für die es keine Vorlage gab. Was darin steckt, ist die Beschreibung einer fehlenden Software, und genau die bauen wir.',
    painpoints: [
      'Der eigentliche Prozess passt nicht in den Standard, also läuft er daneben in einer Tabelle.',
      'Die Regeln dieser Tabelle kennt nur die Person, die sie gebaut hat. Prüfen oder übergeben lässt sich das nicht.',
      'Was in der Behelfslösung passiert, kommt in keiner Auswertung vor.',
      'Vorhandene Software könnte es, aber nur mit einer Anpassung, die beim nächsten Update wieder wegfällt.',
      'Eine Ablösung des ganzen Systems steht im Raum, obwohl nur ein Vorgang das Problem ist.',
    ],
    bausteine: [
      {
        titel: 'Regeln sichtbar machen',
        text: 'Zuerst wird aufgeschrieben, was heute im Kopf entschieden wird. Das ist der Teil der Arbeit, der am meisten bringt.',
      },
      {
        titel: 'Anbindung statt Ablösung',
        text: 'Das neue Modul hängt am bestehenden System und ersetzt es nicht. Buchhaltung und Stammdaten bleiben, wo sie sind.',
      },
      {
        titel: 'Oberfläche für den Alltag',
        text: 'Gebaut für die Personen, die täglich damit arbeiten, nicht für eine Präsentation.',
      },
      {
        titel: 'Auswertbar von Anfang an',
        text: 'Was das Modul entscheidet, wird festgehalten. Damit ist zum ersten Mal messbar, was vorher Erfahrung war.',
      },
    ],
  },
];

export const leistungNachSlug = (slug: string) => leistungen.find((l) => l.slug === slug);

/**
 * Hinweis unter jeder Leistungsuebersicht.
 *
 * Ausdruecklich gewuenscht: Wer etwas sucht, das hier nicht steht, soll nicht
 * den Eindruck bekommen, es sei ausgeschlossen. Die Liste ist eine Auswahl
 * des Ueblichen, keine abschliessende Aufzaehlung.
 */
export const anfrageHinweis =
  'Diese fünf Bereiche decken das meiste ab, was angefragt wird. Sie sind aber keine abschließende Liste: Wenn Ihr Vorhaben hier nicht auftaucht, fragen Sie einfach an. Wir sagen Ihnen ehrlich, ob wir die Richtigen dafür sind.';
