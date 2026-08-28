/**
 * Fragen und Antworten.
 *
 * Nach Themen gruppiert, weil eine Liste aus zwanzig Fragen niemand liest.
 * Die Formulierungen orientieren sich daran, wie Menschen tatsächlich suchen
 * ("Was kostet …", "Muss ich …", "Wie lange …") — das ist der eigentliche
 * SEO-Hebel, nicht die Menge.
 *
 * Jede Antwort steht sichtbar auf der Seite. FAQ-Auszeichnung für
 * strukturierte Daten ist nur dort zulässig, wo das auch so ist.
 */

export type FaqGruppe = {
  slug: string
  titel: string
  /** Kurze Einordnung über der Gruppe. */
  intro?: string
  fragen: { q: string; a: string }[]
}

export const faqGruppen: FaqGruppe[] = [
  {
    slug: 'kosten-und-ablauf',
    titel: 'Kosten und Ablauf',
    fragen: [
      {
        q: 'Was kostet eine Automatisierung?',
        a: 'Das hängt vom Umfang ab, nicht von einer Preisliste. Eine einzelne Automatisierung — etwa Bestellungen aus E-Mails auslesen und ins System schreiben — beginnt bei rund 300 bis 500 €. Ein KI-Chatbot mit eigener Wissensbasis oder eine vollständige Marktplatzanbindung liegt darüber. Im Erstgespräch bekommen Sie einen festen Preis, keine Schätzung mit Stundenzettel.',
      },
      {
        q: 'Wie lange dauert ein Automatisierungsprojekt?',
        a: 'Eine abgegrenzte Automatisierung ist oft in ein bis drei Tagen fertig. Ein Chatbot mit Wissensbasis oder eine Systemanbindung braucht in der Regel ein bis drei Wochen. Entscheidend ist selten die Entwicklung, sondern wie schnell wir an Testzugänge und Beispieldaten kommen.',
      },
      {
        q: 'Arbeiten Sie mit Festpreis oder nach Aufwand?',
        a: 'Festpreis, wo der Umfang klar ist — das ist der Normalfall. Sie wissen vorab, was es kostet und wann es fertig ist. Nach Aufwand arbeiten wir nur bei laufender Betreuung oder wenn sich der Umfang bewusst offen halten soll.',
      },
      {
        q: 'Lohnt sich das für ein kleines Unternehmen?',
        a: 'Häufig gerade dann. Je kleiner der Betrieb, desto stärker fällt Verwaltungszeit ins Gewicht, weil sie von Leuten erledigt wird, die sonst produktiv wären. Ein Richtwert: Wenn ein Ablauf wöchentlich mehr als zwei Stunden kostet und sich wiederholt, rechnet sich die Automatisierung meist im ersten Jahr. Wenn nicht, sagen wir das im Erstgespräch.',
      },
      {
        q: 'Was passiert im kostenlosen Erstgespräch?',
        a: 'Sie beschreiben den Ablauf, der Sie stört. Wir stellen Rückfragen zu Systemen, Mengen und Ausnahmen und sagen Ihnen, was sich automatisieren lässt, was es ungefähr kostet und in welcher Reihenfolge es sinnvoll ist. Danach bekommen Sie ein schriftliches Angebot oder eine Absage mit Begründung.',
      },
    ],
  },
  {
    slug: 'technik-und-systeme',
    titel: 'Technik und Systeme',
    fragen: [
      {
        q: 'Muss ich mein ERP oder Shopsystem wechseln?',
        a: 'Nein, und das ist selten sinnvoll. Die Automatisierung setzt auf das bestehende System auf und spricht mit ihm über die vorhandene Schnittstelle. Ein Systemwechsel ist ein eigenes Projekt mit eigenem Risiko — und fast immer die teurere Antwort auf ein Problem, das daneben liegt.',
      },
      {
        q: 'Was ist, wenn mein System keine Schnittstelle hat?',
        a: 'Dann gibt es meistens trotzdem einen Weg: Datei-Import und -Export, direkter Datenbankzugriff, EDI oder im Zweifel eine Bedienung der Oberfläche durch Automatisierung. Was in Ihrem Fall möglich ist, klären wir vor dem Angebot — nicht danach.',
      },
      {
        q: 'Was ist der Unterschied zwischen Make.com, n8n und eigenem Code?',
        a: 'Make.com und n8n sind Werkzeuge, in denen Abläufe zusammengeklickt werden. Sie sind schnell aufgesetzt und für viele Fälle völlig ausreichend. n8n lässt sich zusätzlich selbst hosten, was bei sensiblen Daten den Ausschlag geben kann. Eigener Code lohnt sich, wenn die Logik komplex wird oder große Datenmengen anfallen. Meistens ist die Antwort eine Mischung.',
      },
      {
        q: 'Wie zuverlässig ist eine KI beim Auslesen von Dokumenten?',
        a: 'Gut genug, um die Arbeit zu übernehmen, aber nicht gut genug, um unbeaufsichtigt zu buchen. Deshalb bekommt jede erkannte Angabe eine Sicherheitsbewertung: Eindeutiges läuft durch, Unsicheres wird zur Prüfung vorgelegt. Das ist schneller als Abtippen und sicherer als blindes Vertrauen.',
      },
      {
        q: 'Was passiert, wenn eine Automatisierung ausfällt?',
        a: 'Fehlgeschlagene Vorgänge kommen in eine Warteschlange und werden mit wachsendem Abstand wiederholt. Bleibt es dabei, geht eine Meldung an Sie — mit dem konkreten Vorgang, nicht nur mit einer Fehlernummer. Ziel ist, dass Sie von einem Ausfall erfahren, bevor Ihre Kunden es tun.',
      },
    ],
  },
  {
    slug: 'zusammenarbeit',
    titel: 'Zusammenarbeit',
    fragen: [
      {
        q: 'Muss ich technisches Wissen mitbringen?',
        a: 'Nein. Sie beschreiben das Problem und das gewünschte Ergebnis in normaler Sprache, wir kümmern uns um die Technik. Am Ende bekommen Sie eine Lösung, die funktioniert, plus eine Übergabe, die auch jemand ohne IT-Hintergrund versteht.',
      },
      {
        q: 'Gehört mir am Ende der Code?',
        a: 'Ja. Was für Sie entwickelt wurde, gehört Ihnen — inklusive Zugängen, Dokumentation und der Möglichkeit, damit zu einem anderen Dienstleister zu gehen. Es gibt keine Konstruktion, die Sie an uns bindet.',
      },
      {
        q: 'Können wir später selbst Anpassungen vornehmen?',
        a: 'In vielen Fällen ja. Abläufe in Make.com oder n8n lassen sich mit etwas Einarbeitung selbst ändern; bei der Übergabe zeigen wir, wo was liegt. Bei eigenem Code brauchen Sie jemanden, der programmieren kann — das ist dann aber nicht an uns gebunden.',
      },
      {
        q: 'Gibt es Unterstützung nach dem Projekt?',
        a: 'Ja, und ohne Ticket-System. Fragen, kleine Anpassungen und Erweiterungen laufen direkt per E-Mail oder Telefon. Für Systeme, die im Tagesgeschäft kritisch sind, lässt sich eine feste Betreuung vereinbaren.',
      },
      {
        q: 'Arbeiten Sie auch außerhalb Deutschlands?',
        a: 'Die Zusammenarbeit läuft ohnehin überwiegend aus der Ferne, insofern spielt der Ort selten eine Rolle. Schwerpunkt sind Deutschland, Österreich und die Schweiz — vor allem, weil Abstimmung in der eigenen Sprache und in derselben Zeitzone einfach schneller geht.',
      },
    ],
  },
  {
    slug: 'daten-und-sicherheit',
    titel: 'Daten und Sicherheit',
    fragen: [
      {
        q: 'Wo werden meine Daten verarbeitet?',
        a: 'Das entscheiden wir gemeinsam vor dem Projekt, nicht hinterher. Wo es geht, laufen Verarbeitung und Speicherung in der EU. Bei Sprachmodellen sind je nach Anbieter auch Verarbeitungsorte außerhalb der EU möglich — dann sagen wir es vorher und zeigen die Alternativen, etwa selbst gehostete Modelle oder Anbieter mit EU-Rechenzentren.',
      },
      {
        q: 'Ist ein KI-Chatbot mit der DSGVO vereinbar?',
        a: 'Ja, wenn er richtig aufgesetzt ist. Dazu gehören ein Auftragsverarbeitungsvertrag mit dem Modellanbieter, ein Hinweis für Nutzende, eine begrenzte Speicherdauer der Verläufe und die Entscheidung, welche Daten den Bot überhaupt erreichen. Diese Punkte klären wir im Projekt, statt sie später nachzuschieben.',
      },
      {
        q: 'Lernt das Sprachmodell aus unseren Daten?',
        a: 'Bei den Geschäftskonditionen der gängigen Anbieter werden übermittelte Inhalte nicht für das Training verwendet. Welche Zusage konkret gilt, hängt vom Anbieter und Vertrag ab — das prüfen wir für Ihren Fall und halten es schriftlich fest, statt es zu behaupten.',
      },
      {
        q: 'Wer hat Zugriff auf unsere Systeme?',
        a: 'So wenige wie möglich und nur so lange wie nötig. Zugänge werden auf das für das Projekt Notwendige beschränkt und nach Abschluss zurückgegeben oder deaktiviert. Wo Ihr Haus ein eigenes Rechtemanagement hat, arbeiten wir darin statt daneben.',
      },
    ],
  },
]

/** Flache Liste für strukturierte Daten und Auszüge. */
export const alleFragen = faqGruppen.flatMap((g) => g.fragen)

export function faqGruppe(slug: string) {
  return faqGruppen.find((g) => g.slug === slug)
}
