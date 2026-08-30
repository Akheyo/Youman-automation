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

export type Branche = {
  slug: string;
  title: string;
  /** Was auf dem Bild zu dieser Branche zu sehen sein soll, solange keines vorliegt. */
  bildhinweis: string;
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
  /** Slug eines Referenzprojekts aus caseStudies.ts, falls vorhanden. */
  referenz?: string;
  /** Einleitender Halbsatz, an den im Fliesstext der Verweis angehaengt wird. */
  referenzHinweis?: string;
};

export const branchen: Branche[] = [
  {
    slug: 'e-commerce-und-onlinehandel',
    bildhinweis: 'Versandvorbereitung im Lager',
    title: 'E-Commerce & Onlinehandel',
    teaser: 'Bestände, Preise und Bestellungen über alle Kanäle synchron, ohne nächtliche Handarbeit.',
    seoTitel: 'KI und Automation für den Onlinehandel',
    seoBeschreibung:
      'Artikelpflege, Bestandsabgleich, Retouren und Kundenanfragen automatisiert, über Shop und Marktplätze hinweg. Lösungen von youman.',
    intro:
      'Im Onlinehandel entsteht der Aufwand selten beim Verkaufen, sondern davor und danach. Artikeldaten wollen für jeden Kanal einzeln gepflegt werden, Bestände laufen zwischen Shop, Marktplatz und Lager auseinander, und Retouren kommen zurück, ohne dass jemand sie im Bestand nachträgt. Das sind keine Softwareprobleme, sondern Ablaufprobleme, die sich mit Software lösen lassen.',
    painpoints: [
      'Eine Preisänderung bedeutet dieselbe Arbeit in drei oder vier Systemen.',
      'Jeder Marktplatz verlangt eigene Pflichtfelder. Was bei einem durchgeht, wird beim nächsten abgelehnt.',
      'Verkauft wird Ware, die nicht mehr da ist, weil der Bestand zu spät aktualisiert wurde.',
      'Kundenanfragen zu Lieferstatus und Rückgabe kommen jeden Tag neu und werden jeden Tag neu von Hand beantwortet.',
      'Was ein Auftrag nach Verpackung, Versand, Retoure und Gebühren eingebracht hat, steht nirgends zusammen.',
    ],
    leistungen: ['e-commerce', 'ki-automationen', 'chatbots'],
  },
  {
    slug: 'spedition-und-logistik',
    bildhinweis: 'Lkw an der Verladerampe',
    title: 'Spedition & Logistik',
    teaser: 'Aufträge, Statusmeldungen und Papiere fließen zwischen Auftraggeber, Fahrer und System.',
    seoTitel: 'Automation für Spedition und Logistik',
    seoBeschreibung:
      'Auftragsannahme, Statusmeldungen und Frachtpapiere automatisiert statt per Telefonkette. Individuelle Lösungen von youman.',
    intro:
      'In der Logistik ist die Ware selten das Problem, die Information über die Ware schon. Aufträge kommen in fünf Formaten, Statusmeldungen laufen über Anrufe, und Papiere entstehen an einer Stelle, an der jemand von Hand abtippt, was woanders längst digital vorliegt. Jede dieser Übergaben ist eine Stelle, an der etwas verloren geht.',
    painpoints: [
      'Aufträge kommen per Mail, PDF, Portal und Telefon, und jemand überträgt sie in ein einziges System.',
      'Der Auftraggeber fragt nach dem Stand, und die Antwort entsteht über eine Kette von Anrufen.',
      'Frachtpapiere werden aus Angaben zusammengesetzt, die schon dreimal irgendwo stehen.',
      'Abweichungen fallen erst auf, wenn jemand zufällig hinschaut, nicht wenn sie entstehen.',
      'Ob eine Tour pünktlich war, lässt sich nachträglich nicht sagen, weil der zugesagte Termin nirgends festgehalten wurde.',
    ],
    leistungen: ['ki-automationen', 'individuelle-software', 'chatbots'],
  },
  {
    slug: 'produktion-und-fertigung',
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
    leistungen: ['individuelle-software', 'ki-automationen'],
    referenz: 'drahtmueller-palettenoptimierung',
    referenzHinweis:
      'Wie sich eine solche Sonderlogik abbilden lässt, ohne die vorhandene Systemlandschaft anzutasten, zeigt das Projekt',
  },
  {
    slug: 'grosshandel-und-distribution',
    bildhinweis: 'Hochregallager',
    title: 'Großhandel & Distribution',
    teaser: 'Artikeldaten, Preislisten und Kundenbestellungen laufen durch, statt in Postfächern zu warten.',
    seoTitel: 'Automation für Großhandel und Distribution',
    seoBeschreibung:
      'Bestellungen, Preislisten und Artikeldaten automatisiert erfassen und weitergeben, statt sie aus Mails abzutippen. Lösungen von youman.',
    intro:
      'Im Großhandel kommt die Bestellung selten in dem Format, in dem sie gebraucht wird. Sie kommt als Mail, als PDF, als Tabelle im Anhang, gelegentlich als Foto. Am Ende sitzt jemand und überträgt sie. Das ist die Stelle, an der sich am schnellsten etwas ändern lässt, weil die Regeln dahinter klar sind, sobald man sie einmal aufschreibt.',
    painpoints: [
      'Bestellungen kommen in jedem denkbaren Format und werden von Hand ins System übertragen.',
      'Kundenspezifische Preise und Staffeln stehen in einer Liste neben dem System. Wer sie nicht kennt, rechnet falsch.',
      'Artikeldaten von Lieferanten kommen in deren Struktur und werden für die eigene neu aufgebaut.',
      'Verfügbarkeitsauskünfte kosten jedes Mal einen Blick in zwei Systeme.',
      'Bestand ist da, aber längst reserviert. Verfügbar und vorhanden werden verwechselt, und die Zusage platzt.',
    ],
    leistungen: ['ki-automationen', 'e-commerce', 'individuelle-software'],
  },
  {
    slug: 'handwerk-und-bau',
    bildhinweis: 'Werkstatt oder Baustelle',
    title: 'Handwerk & Bau',
    teaser: 'Anfragen, Aufmaße und Rechnungen laufen mit, statt abends im Büro nachgearbeitet zu werden.',
    seoTitel: 'Digitalisierung für Handwerk und Bau',
    seoBeschreibung:
      'Anfragen, Aufmaße, Nachträge und Rechnungen ohne Büroabend. Software und Automation für Handwerksbetriebe von youman.',
    intro:
      'Die Arbeit auf der Baustelle ist selten das Problem. Das Problem ist der Abend danach, an dem Aufmaße abgetippt, Nachträge zusammengesucht und Rechnungen geschrieben werden. Was auf der Baustelle ohnehin festgehalten wird, muss dafür nur einmal an der richtigen Stelle landen.',
    painpoints: [
      'Anfragen kommen über Telefon, Mail und Formular, und keine Liste zeigt, welche noch offen ist.',
      'Aufmaße entstehen auf Papier und werden abends ein zweites Mal erfasst.',
      'Nachträge werden mündlich vereinbart und tauchen bei der Abrechnung nicht mehr auf.',
      'Zwischen Angebot, Auftrag und Rechnung liegen drei getrennte Stände derselben Zahlen.',
      'Wer wann auf welcher Baustelle war, lässt sich nachträglich nur über Erinnerung klären.',
    ],
    leistungen: ['individuelle-software', 'ki-automationen', 'webseiten'],
  },
  {
    slug: 'dienstleistung-und-agenturen',
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
    leistungen: ['ki-automationen', 'webseiten', 'individuelle-software'],
    referenz: 'absolar-warenwirtschaft',
    referenzHinweis:
      'Dass sich getrennte Datenstände zu einem durchgängigen Prozess zusammenführen lassen, zeigt das Projekt',
  },
];

export const brancheBySlug = (slug: string) => branchen.find((b) => b.slug === slug);
