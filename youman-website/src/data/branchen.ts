/**
 * Die sechs Branchen von youman.
 *
 * Gegliedert danach, welche Arbeit dort taeglich anfaellt, nicht nach
 * Wirtschaftszweig-Systematik. Die Einteilung ist eine Abkuerzung fuer
 * Leser, keine Grenze: gearbeitet wird auch ausserhalb.
 *
 * Die Problemstellungen sind benannte Fachprobleme, keine Aussagen ueber
 * konkrete Projekte. Deshalb ohne Zahlen und ohne Erfolgsbehauptung. Was
 * ein Projekt gebracht hat, steht ausschliesslich in den Referenzprojekten,
 * wo es belegt ist.
 */

import eCommerce from '../assets/img/branche-e-commerce-und-onlinehandel.png';
import spedition from '../assets/img/branche-spedition-und-logistik.png';
import produktion from '../assets/img/branche-produktion-und-fertigung.png';
import grosshandel from '../assets/img/branche-grosshandel-und-distribution.png';
import handwerk from '../assets/img/branche-handwerk-und-bau.png';
import dienstleistung from '../assets/img/branche-dienstleistung-und-agenturen.png';

export type Branche = {
  slug: string;
  title: string;
  /** Was auf dem Bild zu dieser Branche zu sehen sein soll, solange keines vorliegt. */
  bildhinweis: string;
  /** Das Motiv. Steht hier und nicht in der Seite, damit es an allen Stellen dasselbe ist. */
  bild: ImageMetadata;
  /** Bildbeschreibung: was zu sehen ist, nicht die Wiederholung des Titels. */
  bildAlt: string;
  /** Kurzzeile fuer Uebersicht und Kacheln. */
  teaser: string;
  /** Titel fuer die Suche, wo der Branchenname allein zu wenig traegt. */
  seoTitel?: string;
  /** Beschreibung fuer die Suche. */
  seoBeschreibung?: string;
  /** Einordnung der Branche auf der Unterseite. */
  intro: string;
  /** Typische Problemstellungen in der Sprache der Betroffenen. */
  painpoints: string[];
  /** Slugs aus leistungen.ts, die hier typischerweise greifen. */
  leistungen: string[];
  /**
   * Die Systeme, die in dieser Branche üblicherweise laufen.
   *
   * Das ist Marktwissen, keine Aussage über eigene Projekte: Diese
   * Programme sind in der jeweiligen Branche verbreitet, das lässt sich
   * nachprüfen. Es steht hier, weil eine Branchenseite ohne einen einzigen
   * Systemnamen austauschbar ist. Wer in seinem Betrieb eines davon
   * einsetzt, erkennt sofort, ob hier jemand seine Welt kennt.
   *
   * Keine Behauptung über Erfahrung damit. Wo youman ein System
   * tatsächlich angebunden hat, steht das in den Referenzprojekten und
   * nirgends sonst.
   */
  systeme: { name: string; was: string }[];
  /**
   * Ein typischer Ablauf der Branche, aufgelöst in seine Übergaben.
   *
   * Der Punkt sind die Übergabestellen: Dort geht Information verloren,
   * dort wird abgetippt, dort entsteht die Arbeit, um die es auf dieser
   * Seite geht. Ein Ablauf ohne benannte Übergaben wäre eine Aufzählung.
   */
  ablauf: { titel: string; einleitung: string; schritte: { schritt: string; uebergabe: string }[] };
  /** Slug eines Referenzprojekts aus caseStudies.ts, falls vorhanden. */
  referenz?: string;
  /** Einleitender Halbsatz, an den im Fliesstext der Verweis angehaengt wird. */
  referenzHinweis?: string;
};

export const branchen: Branche[] = [
  {
    slug: 'e-commerce-und-onlinehandel',
    bild: eCommerce,
    bildAlt:
      'Packtisch in einem Versandlager: Kartons mit Versandetiketten, Handscanner, Etikettendrucker und ein Bildschirm mit der Bestellübersicht, an der Wand ein DHL-Schild.',
    bildhinweis: 'Versandvorbereitung im Lager',
    title: 'E-Commerce & Onlinehandel',
    teaser: 'Bestände, Preise und Bestellungen über alle Kanäle synchron, ohne nächtliche Handarbeit.',
    seoTitel: 'KI und Automation für den Onlinehandel',
    seoBeschreibung:
      'Artikelpflege, Bestandsabgleich und Retouren über Shop und Marktplätze: wo bei Shopware, JTL und Amazon Arbeit hängen bleibt und was davon automatisierbar ist.',
    intro:
      'Im Onlinehandel entsteht der Aufwand selten beim Verkaufen, sondern davor und danach. Artikeldaten wollen für jeden Kanal einzeln gepflegt werden, Bestände laufen zwischen Shop, Marktplatz und Lager auseinander, und Retouren kommen zurück, ohne dass jemand sie im Bestand nachträgt. Das sind keine Softwareprobleme, sondern Ablaufprobleme, die sich mit Software lösen lassen.',
    painpoints: [
      'Eine Preisänderung bedeutet dieselbe Arbeit in drei oder vier Systemen.',
      'Jeder Marktplatz verlangt eigene Pflichtfelder. Was bei einem durchgeht, wird beim nächsten abgelehnt.',
      'Verkauft wird Ware, die nicht mehr da ist, weil der Bestand zu spät aktualisiert wurde.',
      'Kundenanfragen zu Lieferstatus und Rückgabe kommen jeden Tag neu und werden jeden Tag neu von Hand beantwortet.',
      'Was ein Auftrag nach Verpackung, Versand, Retoure und Gebühren eingebracht hat, steht nirgends zusammen.',
    ],
    systeme: [
      { name: 'Shopware, Shopify oder WooCommerce', was: 'der eigene Shop, meist die führende Quelle für Artikeldaten' },
      { name: 'JTL-Wawi oder plentymarkets', was: 'Warenwirtschaft, oft mit eigener Logik für Bestände und Retouren' },
      { name: 'Amazon SP-API und eBay', was: 'Marktplätze mit je eigenen Pflichtfeldern und Kategoriebäumen' },
      { name: 'DHL, DPD, GLS über deren Versandschnittstellen', was: 'Labelerzeugung und Sendungsverfolgung' },
    ],
    ablauf: {
      titel: 'Von der Bestellung bis zur Retoure',
      einleitung:
        'Der Verkauf selbst ist der kürzeste Teil. Aufwand entsteht an den Übergaben davor und danach, und zwar jedes Mal an denselben vier Stellen.',
      schritte: [
        {
          schritt: 'Artikel anlegen und in die Kanäle bringen',
          uebergabe:
            'Jeder Kanal verlangt andere Pflichtfelder: Amazon eine Browse Node, eBay eine Kategorie-ID, der eigene Shop womöglich beides nicht. Wer einmal pflegt und dreimal überträgt, hat drei Stände.',
        },
        {
          schritt: 'Bestellung kommt herein',
          uebergabe:
            'Sie liegt zuerst beim Kanal, nicht in der Warenwirtschaft. Zwischen Eingang und Bestandsbuchung vergeht Zeit, und genau in dieser Lücke wird Ware verkauft, die schon weg ist.',
        },
        {
          schritt: 'Kommissionieren und versenden',
          uebergabe:
            'Das Versandlabel entsteht aus Adressdaten, die aus dem Kanal kommen, und aus Gewichten, die aus der Warenwirtschaft kommen. Stimmt eines von beidem nicht, fällt es erst beim Dienstleister auf.',
        },
        {
          schritt: 'Retoure kommt zurück',
          uebergabe:
            'Die Ware steht im Wareneingang, der Bestand kennt sie nicht. Ob sie zurück in den Verkauf geht, als B-Ware gelistet oder abgeschrieben wird, entscheidet meist eine Person nach Augenmaß.',
        },
      ],
    },
    leistungen: ['e-commerce', 'ki-automationen', 'chatbots'],
  },
  {
    slug: 'spedition-und-logistik',
    bild: spedition,
    bildAlt:
      'Lkw mit geöffneter Plane an der Verladerampe, davor palettierte Ware auf einem Hubwagen, daneben ein Bildschirm mit Tourenliste und Karte.',
    bildhinweis: 'Lkw an der Verladerampe',
    title: 'Spedition & Logistik',
    teaser: 'Aufträge, Statusmeldungen und Papiere fließen zwischen Auftraggeber, Fahrer und System.',
    seoTitel: 'Automation für Spedition und Logistik',
    seoBeschreibung:
      'Auftragsannahme, Statusmeldungen und Frachtpapiere automatisiert statt per Telefonkette. Vom EDIFACT-Auftrag bis zum Ablieferbeleg, mit den üblichen Bruchstellen.',
    intro:
      'In der Logistik ist die Ware selten das Problem, die Information über die Ware schon. Aufträge kommen in fünf Formaten, Statusmeldungen laufen über Anrufe, und Papiere entstehen an einer Stelle, an der jemand von Hand abtippt, was woanders längst digital vorliegt. Jede dieser Übergaben ist eine Stelle, an der etwas verloren geht.',
    painpoints: [
      'Aufträge kommen per Mail, PDF, Portal und Telefon, und jemand überträgt sie in ein einziges System.',
      'Der Auftraggeber fragt nach dem Stand, und die Antwort entsteht über eine Kette von Anrufen.',
      'Frachtpapiere werden aus Angaben zusammengesetzt, die schon dreimal irgendwo stehen.',
      'Abweichungen fallen erst auf, wenn jemand zufällig hinschaut, nicht wenn sie entstehen.',
      'Ob eine Tour pünktlich war, lässt sich nachträglich nicht sagen, weil der zugesagte Termin nirgends festgehalten wurde.',
    ],
    systeme: [
      { name: 'Transportmanagement wie CarLo, TIS oder Winsped', was: 'Auftragsverwaltung und Tourenplanung' },
      { name: 'EDIFACT-Nachrichten, vor allem IFTMIN und IFTSTA', was: 'Auftrag und Statusmeldung zwischen Auftraggeber und Spediteur' },
      { name: 'ATLAS', was: 'die Zollabwicklung, sobald eine Sendung die EU verlässt oder erreicht' },
      { name: 'Telematik von Webfleet, Trimble oder dem Fahrzeughersteller', was: 'Position, Fahrzeiten und Ankunftsprognose' },
    ],
    ablauf: {
      titel: 'Von der Auftragsannahme bis zum Ablieferbeleg',
      einleitung:
        'Die Ware macht selten Probleme. Die Information über die Ware schon, und immer an denselben Übergaben.',
      schritte: [
        {
          schritt: 'Auftrag kommt an',
          uebergabe:
            'Mal als EDIFACT-Nachricht aus dem System des Auftraggebers, mal als PDF im Postfach, mal als Anruf. Nur die erste Form landet ohne Abtippen im eigenen System.',
        },
        {
          schritt: 'Tour planen und disponieren',
          uebergabe:
            'Der Plan entsteht aus Aufträgen, Fahrzeugen und Lenkzeiten. Ändert sich einer der drei, ändert sich der Plan, und die Fahrer erfahren es über einen Anruf statt über das System.',
        },
        {
          schritt: 'Status melden',
          uebergabe:
            'Der Auftraggeber will wissen, wo die Sendung ist. Die Telematik weiß es, das Transportmanagement weiß es womöglich auch, aber die Statusnachricht schreibt trotzdem jemand von Hand.',
        },
        {
          schritt: 'Ablieferbeleg zurückführen',
          uebergabe:
            'Der Beleg entsteht auf Papier oder als Foto auf dem Telefon des Fahrers. Bis er als Anhang an der Rechnung hängt, hat ihn mindestens eine Person angefasst.',
        },
      ],
    },
    leistungen: ['ki-automationen', 'individuelle-software', 'chatbots'],
  },
  {
    slug: 'produktion-und-fertigung',
    bild: produktion,
    bildAlt:
      'Fertigungshalle mit einer eingehausten Montageanlage, davor ein Arbeitsplatz mit Bildschirm, Scanner und Materialkisten.',
    bildhinweis: 'Fertigungshalle im Betrieb',
    title: 'Produktion & Fertigung',
    teaser: 'Aufträge, Rückmeldungen und Materialbedarf ohne Zettelwirtschaft zwischen Halle und Büro.',
    seoTitel: 'Software und Automation für die Fertigung',
    seoBeschreibung:
      'Planung, Rückmeldungen und Materialbedarf digital statt auf Zetteln. Individuelle Software und Automation für produzierende Betriebe von youman.',
    intro:
      'Zwischen Halle und Büro liegt in vielen Betrieben eine Lücke, die mit Papier gefüllt wird. Der Plan hängt aus, Rückmeldungen kommen auf Zetteln zurück, und was tatsächlich passiert ist, weiß man am Monatsende ungefähr. Diese Lücke lässt sich schließen, ohne die vorhandene Systemlandschaft anzutasten.',
    painpoints: [
      'Geplant wird tatsächlich in einer Tabelle auf einem einzelnen Rechner, nicht im System.',
      'Eine Eilbestellung kommt herein, und was sie an anderer Stelle verschiebt, zeigt sich erst, wenn dort etwas zu spät kommt.',
      'Rückmeldungen aus der Fertigung werden auf Zetteln notiert und später eingetippt, wenn überhaupt.',
      'Stillstände und Nacharbeit tauchen in keiner Kalkulation auf. Was ein Teil gekostet hat, weiß man erst beim Nachrechnen.',
      'Schichtleitung und Werksleitung schauen auf verschiedene Zahlen, weil sich jede ihre eigene Auswertung gebaut hat.',
    ],
    systeme: [
      { name: 'ERP wie SAP, proALPHA, abas oder Infor', was: 'Aufträge, Stücklisten, Beschaffung' },
      { name: 'MES und Betriebsdatenerfassung', was: 'was in der Halle tatsächlich passiert, Stückzahlen, Störungen, Rüstzeiten' },
      { name: 'CAD und CAM', was: 'Geometrie und Fertigungsprogramme, oft die eigentliche Quelle der Maße' },
      { name: 'Messmittel und Prüfprotokolle', was: 'Qualitätsdaten, häufig noch auf Papier oder in einer Tabelle' },
    ],
    ablauf: {
      titel: 'Vom Auftrag bis zur Rückmeldung',
      einleitung:
        'Zwischen Büro und Halle liegt in vielen Betrieben eine Lücke, die mit Papier gefüllt wird. Sie hat vier erkennbare Stellen.',
      schritte: [
        {
          schritt: 'Auftrag einplanen',
          uebergabe:
            'Das ERP kennt Termin und Menge. Die tatsächliche Reihenfolge entsteht danach, oft in einer Tabelle auf einem einzelnen Rechner, weil dort Rüstzeiten und Maschinenbelegung zusammenkommen.',
        },
        {
          schritt: 'Material bereitstellen',
          uebergabe:
            'Der Bedarf steht in der Stückliste, der Bestand im Lager. Was reserviert ist und was verfügbar, unterscheidet sich, und die Differenz merkt jemand erst an der Maschine.',
        },
        {
          schritt: 'Fertigen und rückmelden',
          uebergabe:
            'Stückzahl, Ausschuss und Stillstand werden auf einem Zettel notiert und später eingetippt, wenn überhaupt. Was nicht rückgemeldet wird, taucht in keiner Nachkalkulation auf.',
        },
        {
          schritt: 'Prüfen und dokumentieren',
          uebergabe:
            'Das Prüfprotokoll entsteht neben dem System. Bei einer Reklamation muss es jemand suchen, statt es zum Auftrag zu öffnen.',
        },
      ],
    },
    leistungen: ['individuelle-software', 'ki-automationen'],
    referenz: 'drahtmueller-palettenoptimierung',
    referenzHinweis:
      'Wie sich eine solche Sonderlogik abbilden lässt, ohne die vorhandene Systemlandschaft anzutasten, zeigt das Projekt',
  },
  {
    slug: 'grosshandel-und-distribution',
    bild: grosshandel,
    bildAlt:
      'Gang in einem Hochregallager mit palettierter Ware, davor ein Kommissionierwagen und ein Packtisch mit Bildschirm und Etikettendrucker.',
    bildhinweis: 'Hochregallager',
    title: 'Großhandel & Distribution',
    teaser: 'Artikeldaten, Preislisten und Kundenbestellungen laufen durch, statt in Postfächern zu warten.',
    seoTitel: 'Automation für Großhandel und Distribution',
    seoBeschreibung:
      'Bestellungen, Preislisten und Artikeldaten automatisiert erfassen statt aus Mails abzutippen. Von der EDI-Bestellung bis zur elektronischen Rechnung nach ZUGFeRD.',
    intro:
      'Im Großhandel kommt die Bestellung selten in dem Format, in dem sie gebraucht wird. Sie kommt als Mail, als PDF, als Tabelle im Anhang, gelegentlich als Foto. Am Ende sitzt jemand und überträgt sie. Das ist die Stelle, an der sich am schnellsten etwas ändern lässt, weil die Regeln dahinter klar sind, sobald man sie einmal aufschreibt.',
    painpoints: [
      'Bestellungen kommen in jedem denkbaren Format und werden von Hand ins System übertragen.',
      'Kundenspezifische Preise und Staffeln stehen in einer Liste neben dem System. Wer sie nicht kennt, rechnet falsch.',
      'Artikeldaten von Lieferanten kommen in deren Struktur und werden für die eigene neu aufgebaut.',
      'Verfügbarkeitsauskünfte kosten jedes Mal einen Blick in zwei Systeme.',
      'Bestand ist da, aber längst reserviert. Verfügbar und vorhanden werden verwechselt, und die Zusage platzt.',
    ],
    systeme: [
      { name: 'ERP wie Sage, SAP Business One oder Microsoft Dynamics', was: 'Artikel, Preise, Aufträge, Lager' },
      { name: 'EDI mit ORDERS, DESADV und INVOIC', was: 'Bestellung, Lieferavis und Rechnung im Austausch mit größeren Kunden' },
      { name: 'BMEcat und ETIM', was: 'Artikeldaten und Klassifizierung, wie Lieferanten sie liefern' },
      { name: 'ZUGFeRD oder XRechnung', was: 'die elektronische Rechnung, seit 2025 im B2B verpflichtend zu empfangen' },
    ],
    ablauf: {
      titel: 'Von der Bestellung bis zur Rechnung',
      einleitung:
        'Die Bestellung kommt selten in dem Format, in dem sie gebraucht wird. Was danach passiert, hängt an vier Übergaben.',
      schritte: [
        {
          schritt: 'Bestellung erfassen',
          uebergabe:
            'Als EDI-Nachricht läuft sie durch. Als Mail, PDF, Tabelle im Anhang oder Foto sitzt jemand davor und überträgt sie. Die Regeln dafür sind klar, sobald man sie einmal aufschreibt.',
        },
        {
          schritt: 'Preis bestimmen',
          uebergabe:
            'Kundenspezifische Preise und Staffeln stehen oft in einer Liste neben dem System. Wer sie nicht kennt, rechnet falsch, und die Differenz fällt erst bei der Rechnungsprüfung auf.',
        },
        {
          schritt: 'Verfügbarkeit zusagen',
          uebergabe:
            'Bestand ist da, aber längst reserviert. Verfügbar und vorhanden werden verwechselt, weil zwei Systeme gefragt werden müssen, um die Antwort zu bekommen.',
        },
        {
          schritt: 'Liefern und abrechnen',
          uebergabe:
            'Lieferavis und Rechnung entstehen aus Angaben, die schon dreimal irgendwo stehen. Beim elektronischen Format entscheidet ein einziges falsches Feld darüber, ob die Rechnung angenommen wird.',
        },
      ],
    },
    leistungen: ['ki-automationen', 'e-commerce', 'individuelle-software'],
  },
  {
    slug: 'handwerk-und-bau',
    bild: handwerk,
    bildAlt:
      'Innenausbau im Rohbau: auf einem Arbeitstisch liegt ein Bauplan mit einem Tablet darauf, dahinter Ständerwerk, Leiter und Kappsäge.',
    bildhinweis: 'Werkstatt oder Baustelle',
    title: 'Handwerk & Bau',
    teaser: 'Anfragen, Aufmaße und Rechnungen laufen mit, statt abends im Büro nachgearbeitet zu werden.',
    seoTitel: 'Digitalisierung für Handwerk und Bau',
    seoBeschreibung:
      'Anfragen, Aufmaße, Nachträge und Rechnungen ohne Büroabend: Wo im Handwerk Arbeit hängen bleibt, welche Systeme dort laufen und was sich davon automatisieren lässt.',
    intro:
      'Die Arbeit auf der Baustelle ist selten das Problem. Das Problem ist der Abend danach, an dem Aufmaße abgetippt, Nachträge zusammengesucht und Rechnungen geschrieben werden. Was auf der Baustelle ohnehin festgehalten wird, muss dafür nur einmal an der richtigen Stelle landen.',
    painpoints: [
      'Anfragen kommen über Telefon, Mail und Formular, und keine Liste zeigt, welche noch offen ist.',
      'Aufmaße entstehen auf Papier und werden abends ein zweites Mal erfasst.',
      'Nachträge werden mündlich vereinbart und tauchen bei der Abrechnung nicht mehr auf.',
      'Zwischen Angebot, Auftrag und Rechnung liegen drei getrennte Stände derselben Zahlen.',
      'Wer wann auf welcher Baustelle war, lässt sich nachträglich nur über Erinnerung klären.',
    ],
    systeme: [
      { name: 'Handwerkersoftware wie Streit, pds, Label oder TopKontor', was: 'Angebot, Auftrag, Aufmaß, Rechnung' },
      { name: 'GAEB-Dateien', was: 'Leistungsverzeichnisse im Austausch mit Architekten und öffentlichen Auftraggebern' },
      { name: 'DATEV oder Lexware', was: 'die Buchhaltung, meist beim Steuerberater und getrennt vom Rest' },
      { name: 'Zeiterfassung auf dem Telefon', was: 'wer wann auf welcher Baustelle war, oft die einzige digitale Spur' },
    ],
    ablauf: {
      titel: 'Von der Anfrage bis zur Schlussrechnung',
      einleitung:
        'Die Arbeit auf der Baustelle ist selten das Problem. Der Abend danach ist es, und dafür gibt es vier Gründe.',
      schritte: [
        {
          schritt: 'Anfrage aufnehmen',
          uebergabe:
            'Sie kommt über Telefon, Mail oder Formular. Ohne eine Liste, die alle drei zusammenführt, hängt die Nachfassung daran, ob jemand daran denkt.',
        },
        {
          schritt: 'Aufmaß nehmen',
          uebergabe:
            'Auf der Baustelle entsteht es auf Papier. Abends wird es ein zweites Mal erfasst. Bei einem Leistungsverzeichnis nach GAEB muss es zusätzlich in dessen Struktur passen.',
        },
        {
          schritt: 'Nachträge vereinbaren',
          uebergabe:
            'Sie werden mündlich abgesprochen, auf der Baustelle, zwischen Tür und Angel. Was nicht am selben Tag festgehalten wird, taucht bei der Abrechnung nicht mehr auf.',
        },
        {
          schritt: 'Abrechnen',
          uebergabe:
            'Zwischen Angebot, Auftrag und Rechnung liegen drei getrennte Stände derselben Zahlen. Welcher stimmt, klärt sich beim Nachrechnen, nicht vorher.',
        },
      ],
    },
    leistungen: ['individuelle-software', 'ki-automationen', 'webseiten'],
  },
  {
    slug: 'dienstleistung-und-agenturen',
    bild: dienstleistung,
    bildAlt:
      'Besprechungsraum mit zwei Laptops und Notizblöcken, an der Wand ein Bildschirm mit einem Ablaufdiagramm von der Anfrage bis zur Datenbank, daneben ein Flipchart.',
    bildhinweis: 'Besprechung am Bildschirm',
    title: 'Dienstleistung & Agenturen',
    teaser: 'Leads, Angebote und Projektabläufe automatisiert, damit abrechenbare Zeit abrechenbar bleibt.',
    seoTitel: 'Automation für Dienstleister und Agenturen',
    seoBeschreibung:
      'Leads, Angebote, Projektabläufe und Zeiterfassung automatisiert, damit abrechenbare Zeit nicht in Verwaltung verschwindet. Lösungen von youman.',
    intro:
      'Bei Dienstleistern ist Zeit das Produkt, und genau davon verschwindet der größte Teil in Verwaltung. Angebote werden aus alten Angeboten zusammengebaut, Zeiten am Freitag rekonstruiert, und Projektstände existieren in drei Köpfen unterschiedlich. Das ist der Bereich, in dem Automation am direktesten auf den Umsatz durchschlägt.',
    painpoints: [
      'Anfragen kommen an, und die Nachfassung hängt daran, ob jemand daran denkt.',
      'Angebote entstehen durch Kopieren älterer Angebote, samt der Fehler darin.',
      'Zeiten werden am Ende der Woche aus dem Gedächtnis nachgetragen und sind entsprechend ungenau.',
      'Der Projektstand ist in drei Köpfen unterschiedlich, und keiner davon steht schriftlich.',
      'Wie viel eine Kundenbeziehung nach allem Aufwand tatsächlich eingebracht hat, weiß niemand.',
    ],
    systeme: [
      { name: 'CRM wie HubSpot, Pipedrive oder Zoho', was: 'Anfragen, Angebote, Nachfassung' },
      { name: 'Projekt- und Zeiterfassung wie Jira, Asana, Harvest oder Clockify', was: 'was tatsächlich gearbeitet wurde' },
      { name: 'Lexware Office, sevDesk oder DATEV', was: 'Rechnung und Buchhaltung' },
      { name: 'Google Workspace oder Microsoft 365', was: 'Dokumente und Kalender, oft die eigentliche Ablage' },
    ],
    ablauf: {
      titel: 'Vom Erstkontakt bis zur Rechnung',
      einleitung:
        'Bei Dienstleistern ist Zeit das Produkt. Genau davon verschwindet der größte Teil an vier Übergaben.',
      schritte: [
        {
          schritt: 'Anfrage aufnehmen',
          uebergabe:
            'Sie landet im Postfach einer Person, nicht im System. Ob nachgefasst wird, hängt daran, ob diese Person daran denkt und Zeit hat.',
        },
        {
          schritt: 'Angebot schreiben',
          uebergabe:
            'Meistens durch Kopieren eines älteren Angebots, samt der Fehler darin. Die Kalkulation dahinter steht in einer Tabelle, die niemand außer dem Ersteller versteht.',
        },
        {
          schritt: 'Arbeiten und Zeiten erfassen',
          uebergabe:
            'Die Zeiten werden am Freitag aus dem Gedächtnis nachgetragen. Was dabei verloren geht, wird nie abgerechnet und taucht in keiner Auswertung auf.',
        },
        {
          schritt: 'Abrechnen und auswerten',
          uebergabe:
            'Die Rechnung entsteht aus Zeiten, das Ergebnis aus Rechnung minus Aufwand. Solange die Zeiten ungenau sind, ist auch das Ergebnis eine Schätzung.',
        },
      ],
    },
    leistungen: ['ki-automationen', 'webseiten', 'individuelle-software'],
    referenz: 'absolar-warenwirtschaft',
    referenzHinweis:
      'Dass sich getrennte Datenstände zu einem durchgängigen Prozess zusammenführen lassen, zeigt das Projekt',
  },
];

export const brancheBySlug = (slug: string) => branchen.find((b) => b.slug === slug);
