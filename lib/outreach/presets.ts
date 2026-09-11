/**
 * Sequenz-Vorlagen.
 *
 * Kaltakquise-Mails werden gelesen, wenn sie nach einem Menschen klingen,
 * einen konkreten Anlass nennen und eine einzige, kleine Frage stellen.
 * Jedes Nachfassen bringt einen neuen Winkel, nie „ich wollte nur nachhaken".
 * Abstände 0 / 3 / 7 / 14 Tage; die letzte Mail ist ein echter Abschied,
 * und der wird eingehalten.
 *
 * Ab Schritt 2 bleibt der Betreff leer. Dann hängt Paul das Follow-up als
 * "Re: ..." an den bestehenden Verlauf, so wie ein Mensch nachfasst.
 *
 * Anrede: "Guten Tag {{vorname}} {{nachname}},". Die einzige Form, die ohne
 * Anredegeschlecht respektvoll bleibt. Fehlt der Name, hält Paul den Kontakt
 * an, statt "Guten Tag ," zu verschicken.
 */

export interface SequenceStep {
  step_no: number;
  delay_days: number;
  subject: string;
  body: string;
}

export interface Vorlage {
  id: string;
  name: string;
  /** Ein Satz: wofür diese Sequenz gedacht ist. */
  beschreibung: string;
  steps: SequenceStep[];
}

/** Signatur mit den Pflichtangaben für Geschäftspost. */
export const SIGNATUR_VORLAGE = `Amanuel Kheyo
youman | Automatisierung für den Mittelstand
Karl-Leisner-Straße 6 · 46325 Borken
+49 155 67541365 · youman-automation.de`;

const ANREDE = 'Guten Tag {{vorname}} {{nachname}},';

/** Gemeinsamer dritter Schritt: das Beispiel aus dem Münsterland. */
const BEISPIEL_DRAHTMUELLER = `${ANREDE}

ein Beispiel aus dem Münsterland: Ein Drahthersteller hatte 2.556 verschiedene Palettentypen im Einsatz, und bei jedem Auftrag hat jemand von Hand entschieden, welche passt. Das ERP war nicht das Problem. Es fehlte die Logik davor.

Heute liest ein Modul den Auftrag, unterscheidet Standard- und Sonderpaletten und rechnet den Bedarf. Das ERP blieb, wie es war.

Wenn es bei {{firma}} eine Stelle gibt, an der täglich jemand dasselbe entscheidet: Das ist genau die Art Aufgabe.`;

/** Gemeinsamer Abschied: Zahl als Antwort, echte Grenze, Ruhe danach. */
const ABSCHIED = `${ANREDE}

ich habe Ihnen jetzt dreimal geschrieben und will nicht lästig werden. Das hier ist die letzte Mail von mir.

Damit es einfach bleibt, reicht eine Zahl als Antwort:

1 = Ja, schauen wir uns den Ablauf an
2 = Später, melden Sie sich in drei Monaten
3 = Kein Bedarf, bitte nicht mehr schreiben

Ich nehme im Monat nur eine Handvoll dieser Analysen an, weil ich sie selbst mache. Ohne Antwort lasse ich Sie in Ruhe.`;

export const VORLAGEN: Vorlage[] = [
  {
    id: 'stunden',
    name: 'Zwei Stunden am Tag',
    beschreibung: 'Rechnet die Zeit in Kapazität um: nicht was gespart wird, sondern was die freie Zeit erwirtschaftet.',
    steps: [
      {
        step_no: 1,
        delay_days: 0,
        subject: 'zwei stunden am tag',
        body: `${ANREDE}

zwei Stunden am Tag, an denen jemand Daten zwischen zwei Systemen überträgt, sind im Jahr rund 440 Stunden. Das ist eine Viertelstelle, die nichts herstellt und nichts verkauft.

Die Lohnkosten dafür sehen Sie in der Buchhaltung. Was Sie nirgends sehen: In diesen 440 Stunden schreibt niemand ein Angebot, ruft niemand einen Kunden zurück, klärt niemand eine Reklamation.

Ich baue diese Übertragung weg. Nicht mit einem neuen System, sondern mit dem, was bei {{firma}} schon läuft.

Wie viele Stunden wären es bei Ihnen? Drei Sätze von Ihnen, und ich rechne es Ihnen aus.`,
      },
      {
        step_no: 2,
        delay_days: 3,
        subject: '',
        body: `${ANREDE}

noch ein Gedanke zu der Rechnung von neulich.

Eine Aufgabe, die automatisch läuft, nimmt keinen Urlaub, wird nicht krank und kündigt nicht. Sie muss nicht eingearbeitet werden, und sie arbeitet auch im August.

Der eigentliche Punkt ist aber nicht, was sie ersetzt. Sondern was Ihre Leute in der frei gewordenen Zeit tun, und das ist fast immer mehr wert als die Stunde, die Sie einsparen.

Bei welcher Aufgabe wäre das bei {{firma}} am deutlichsten?`,
      },
      { step_no: 3, delay_days: 7, subject: '', body: BEISPIEL_DRAHTMUELLER },
      { step_no: 4, delay_days: 14, subject: '', body: ABSCHIED },
    ],
  },
  {
    id: 'beobachtung',
    name: 'Eine Beobachtung',
    beschreibung: 'Erstmail über Neugier: Branche und Ort als Anlass, eine kurze Frage nach dem Ablauf. Funktioniert für jede Branche.',
    steps: [
      {
        step_no: 1,
        delay_days: 0,
        subject: 'eine beobachtung zu {{firma}}',
        body: `${ANREDE}

{{firma}} ist mir aufgefallen. {{branche}}, {{ort}}: genau die Art Betrieb, mit der ich arbeite. Aufträge kommen per Mail, PDF und Telefon, und dazwischen hält jemand zwei Systeme von Hand auf Stand.

Das ist kein Vorwurf, das ist der Normalfall. Nur taucht diese Stelle in keiner Kalkulation auf, und deshalb bleibt sie.

Ich baue dort die Verbindung, ohne dass ein System ersetzt wird.

Wäre ein kurzer Blick auf Ihren Ablauf interessant? Zwanzig Minuten am Bildschirm reichen, um zu sehen, ob sich das lohnt.`,
      },
      {
        step_no: 2,
        delay_days: 3,
        subject: '',
        body: `${ANREDE}

ein anderer Gedanke: Zwei Stunden am Tag, in denen jemand Daten zwischen zwei Systemen hält, sind im Jahr rund 440 Stunden. Eine Viertelstelle, die nichts herstellt und nichts verkauft.

Wenn Sie mir in drei Sätzen beschreiben, wo das bei {{firma}} passiert, rechne ich es Ihnen aus. Kostenlos, ohne Verpflichtung. Wenn nichts Nennenswertes herauskommt, sage ich das auch.`,
      },
      { step_no: 3, delay_days: 7, subject: '', body: BEISPIEL_DRAHTMUELLER },
      { step_no: 4, delay_days: 14, subject: '', body: ABSCHIED },
    ],
  },
  {
    id: 'besuch',
    name: 'Besuch vor Ort',
    beschreibung: 'Nur für Betriebe im Umkreis: Nähe als Argument, Termin in der Halle statt am Bildschirm.',
    steps: [
      {
        step_no: 1,
        delay_days: 0,
        subject: 'besuch in {{ort}}',
        body: `${ANREDE}

ich sitze in Borken, {{ort}} ist für mich keine Reise. Ich baue für Betriebe wie {{firma}} die Verbindung zwischen Systemen, die dasselbe wissen müssten: Auftrag und Lager, Angebot und Projekt, Shop und Warenwirtschaft.

Am Bildschirm versteht man so einen Ablauf nur zur Hälfte. Deshalb komme ich lieber vorbei: eine Stunde im Betrieb, danach wissen wir beide, ob sich etwas lohnt.

Passt ein Termin in den nächsten Wochen? Ich richte mich nach Ihrem Betrieb.`,
      },
      {
        step_no: 2,
        delay_days: 3,
        subject: '',
        body: `${ANREDE}

falls ein Besuch gerade nicht passt: Es geht auch kleiner. Sie beschreiben mir in drei Sätzen den Ablauf, der bei {{firma}} am meisten Handarbeit macht, und ich rechne Ihnen aus, wie viele Stunden im Jahr darin stecken. Kostenlos.

Das Angebot mit dem Besuch bleibt daneben bestehen.`,
      },
      { step_no: 3, delay_days: 7, subject: '', body: BEISPIEL_DRAHTMUELLER },
      { step_no: 4, delay_days: 14, subject: '', body: ABSCHIED },
    ],
  },
];

export function vorlage(id: string): Vorlage | undefined {
  return VORLAGEN.find((v) => v.id === id);
}

/**
 * Startsequenz für neue Kampagnen anderer Nutzer: bewusst neutral und mit
 * sichtbaren Lücken, damit niemand einen fremden Pitch verschickt.
 */
export const STARTER_SEQUENCE: SequenceStep[] = [
  {
    step_no: 1,
    delay_days: 0,
    subject: 'Kurze Frage zu {{firma}}',
    body: `Hallo {{vorname|zusammen}},

ich bin über {{firma}} gestolpert. {{anlass|Ihr Bereich passt genau zu dem, womit wir sonst arbeiten}}.

Wir helfen Unternehmen wie Ihrem dabei, [Ihr Nutzen in einem Satz]. Bei vergleichbaren Betrieben sind daraus [konkretes Ergebnis] geworden.

Wäre ein kurzer Austausch nächste Woche für Sie interessant? 15 Minuten reichen, um zu sehen, ob das überhaupt zu Ihnen passt.

Viele Grüße`,
  },
  {
    step_no: 2,
    delay_days: 3,
    subject: '',
    body: `Hallo {{vorname|zusammen}},

ich schiebe meine Mail von letzter Woche noch einmal nach oben. Erfahrungsgemäß geht so etwas im Tagesgeschäft schnell unter.

Falls das Thema gerade nicht dran ist, sagen Sie einfach kurz Bescheid, dann hake ich es ab.

Viele Grüße`,
  },
  {
    step_no: 3,
    delay_days: 6,
    subject: '',
    body: `Hallo {{vorname|zusammen}},

letzte Nachricht von mir zu diesem Thema, ich will nicht nerven.

Wenn {{firma}} später einmal an dem Punkt ist, melden Sie sich gern. Ich lasse Sie ansonsten in Ruhe.

Viele Grüße`,
  },
];
