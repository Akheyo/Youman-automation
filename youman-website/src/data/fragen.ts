/**
 * Häufige Fragen und ihre Antworten.
 *
 * Die Regel für diese Datei ist dieselbe wie überall sonst auf der Seite:
 * Hier steht nur, was durch den übrigen Auftritt gedeckt ist. Keine Preise,
 * keine Laufzeiten in Wochen, keine Zusage zur Antwortzeit. Wo etwas nicht
 * feststeht, sagt die Antwort das, statt eine Zahl zu erfinden.
 *
 * Warum es diese Seite gibt: Ein Interessent stellt sechs oder sieben
 * Fragen, bevor er anfragt. Die Antworten darauf standen bisher verteilt
 * über fünf Seiten, meist in einem Nebensatz. Wer sie sucht, findet sie so
 * nicht, und ein KI-gestütztes Suchsystem, das eine dieser Fragen
 * beantworten will, findet keine Passage zum Zitieren.
 *
 * `antwort` ist die Kurzfassung, die auch in die strukturierten Daten geht.
 * `ergaenzung` steht nur auf der Seite und trägt den Rest.
 */

export type Frage = {
  frage: string;
  /** Die Antwort in zwei bis vier Sätzen. Geht so in die Auszeichnung. */
  antwort: string;
  /** Was darüber hinaus dazugehört. Steht nur im sichtbaren Text. */
  ergaenzung?: string;
};

export const fragen: Frage[] = [
  {
    frage: 'Muss unser bestehendes System dafür abgelöst werden?',
    antwort:
      'Nein. Was gebaut wird, hängt am vorhandenen System und ersetzt es nicht. Buchhaltung, Lager und Stammdaten bleiben, wo sie sind. Dazu kommt genau das Stück, das bisher von Hand erledigt wurde, angebunden über eine Schnittstelle.',
    ergaenzung:
      'Beide abgeschlossenen Referenzprojekte sind so gebaut: Bei der Drahtmüller GmbH blieb das ERP-System führend und bekam ein Modul für die Palettenlogik daneben. Bei A&B SolarEnergy blieben die vorhandene Datenbank und Lexware Office bestehen und wurden miteinander verbunden.',
  },
  {
    frage: 'Was kostet eine Automation oder ein eigenes Modul?',
    antwort:
      'Das hängt daran, wie die vorhandenen Systeme aussehen und wie viel davon dokumentiert ist. Eine Preisliste würde für keinen der Fälle stimmen. In einem Gespräch von einer halben Stunde lässt sich die Größenordnung klären, und zwar bevor irgendetwas beauftragt wird.',
    ergaenzung:
      'Der Aufwand liegt selten dort, wo er vermutet wird. Ein Ablauf mit klaren Regeln und sauberen Daten ist schnell gebaut. Aufwendig wird es, wenn die Regeln nur im Kopf einzelner Personen stehen und erst herausgearbeitet werden müssen. Genau das zeigt sich im ersten Gespräch.',
  },
  {
    frage: 'Wie lange dauert so ein Projekt?',
    antwort:
      'Eine belastbare Angabe dazu gibt es erst nach der Analyse. Gebaut wird in kurzen Schritten: an einer Stelle einsetzen, dort prüfen, ob es trägt, dann erweitern. Der erste einsetzbare Stand kommt dadurch früher als bei einem Vorhaben, das erst am Ende fertig wird.',
    ergaenzung:
      'Was sich vorab sagen lässt: Nach dem zweiten der vier Schritte, also nach Analyse und Konzept, wissen Sie, ob sich das Vorhaben lohnt. Diese Entscheidung fällt bewusst, bevor der aufwendige Teil beginnt.',
  },
  {
    frage: 'Worin unterscheidet sich ein Chatbot von einer KI-Automation?',
    antwort:
      'Ein Chatbot antwortet jemandem, der fragt. Eine KI-Automation erledigt Arbeit, ohne dass jemand fragt. Der Chatbot greift auf hinterlegte Unterlagen zu und gibt Auskunft; die Automation liest Dokumente aus, sortiert Anfragen vor oder überträgt Angaben zwischen Systemen.',
    ergaenzung:
      'In der Praxis kommen beide oft zusammen vor. Ein Chatbot ohne Anbindung an den tatsächlichen Bestand gibt Auskünfte, die niemand geprüft hat. Sinnvoll wird er erst, wenn er sieht, was das System weiß.',
  },
  {
    frage: 'Was passiert, wenn die Automation einen Fall nicht sicher entscheiden kann?',
    antwort:
      'Für jeden Ablauf wird vorher festgelegt, ab wann nicht mehr automatisch entschieden wird. Unsichere Fälle gehen an eine Person, nicht ins Nichts. Diese Grenze ist Teil des Konzepts und keine Nachbesserung.',
    ergaenzung:
      'Ohne diese Festlegung entscheidet eine Automation irgendwann Fälle, die sie nicht entscheiden sollte, und das fällt erst beim Kunden auf. Bei einem Chatbot gilt dasselbe: Für heikle Themen wird festgelegt, dass er nicht selbst antwortet, sondern das Gespräch mit dem bisherigen Verlauf übergibt.',
  },
  {
    frage: 'Arbeitet ihr nur im Münsterland?',
    antwort:
      'Nein. youman sitzt in Borken und arbeitet im gesamten deutschsprachigen Raum. Die Nähe zählt an zwei Stellen: bei der Analyse im Betrieb und bei der Einführung im Alltag. Entwicklung und Abstimmung laufen ohnehin zum größten Teil aus der Ferne.',
    ergaenzung:
      'Für ein reines Schnittstellenprojekt ohne Prozessanalyse ist der Standort zweitrangig. Wer einen Anbieter sucht, sollte ihn nach dem Verständnis für seinen Ablauf auswählen, nicht nach der Entfernung.',
  },
  {
    frage: 'Lohnt sich das auch für einen kleinen Betrieb?',
    antwort:
      'Die Frage ist nicht die Betriebsgröße, sondern wie oft ein Vorgang vorkommt. Eine Aufgabe, die täglich zwanzig Minuten kostet, summiert sich unabhängig davon, ob zehn oder zweihundert Personen im Betrieb arbeiten. Umgekehrt lohnt sich ein Vorgang, der dreimal im Jahr auftritt, auch in einem großen Betrieb selten.',
    ergaenzung:
      'Ein guter Anhaltspunkt ist die Behelfslösung: Wo eine gewachsene Tabelle neben dem System läuft, an der ein Teil des Tagesgeschäfts hängt, steckt fast immer die Beschreibung einer fehlenden Software.',
  },
  {
    frage: 'Was braucht ihr von uns, damit es losgehen kann?',
    antwort:
      'Für die erste Nachricht reichen vier Angaben: welches System im Einsatz ist, an welcher Stelle es klemmt, wer im Betrieb damit arbeitet, und ob es dafür schon eine Behelfslösung gibt. Kein Lastenheft, keine Anforderungsliste.',
    ergaenzung:
      'Herauszufinden, wie die Lösung aussehen soll, ist unsere Aufgabe und nicht Ihre Vorleistung. Ein Satz wie „die Versandpapiere entstehen jeden Morgen von Hand aus zwei Listen“ sagt mehr als eine Seite Prozessbeschreibung.',
  },
];
