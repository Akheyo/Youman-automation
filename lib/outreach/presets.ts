/**
 * Startsequenz für neue Kampagnen.
 *
 * Bewusst kurz und ohne Werbesprache: Kaltakquise-Mails werden gelesen, wenn
 * sie nach einem Menschen klingen, einen konkreten Anlass nennen und eine
 * einzige, kleine Frage stellen. Die Vorlagen sind ein Startpunkt zum
 * Überschreiben, kein fertiger Verkaufstext.
 *
 * Ab Schritt 2 bleibt der Betreff leer — dann hängt Paul das Follow-up als
 * "Re: ..." an den bestehenden Verlauf.
 */

export interface SequenceStep {
  step_no: number;
  delay_days: number;
  subject: string;
  body: string;
}

export const STARTER_SEQUENCE: SequenceStep[] = [
  {
    step_no: 1,
    delay_days: 0,
    subject: 'Kurze Frage zu {{firma}}',
    body: `Hallo {{vorname|zusammen}},

ich bin über {{firma}} gestolpert — {{anlass|Ihr Bereich passt genau zu dem, womit wir sonst arbeiten}}.

Wir helfen Unternehmen wie Ihrem dabei, [Ihr Nutzen in einem Satz]. Bei vergleichbaren Betrieben sind daraus [konkretes Ergebnis] geworden.

Wäre ein kurzer Austausch nächste Woche für Sie interessant? 15 Minuten reichen, um zu sehen, ob das überhaupt zu Ihnen passt.

Viele Grüße`,
  },
  {
    step_no: 2,
    delay_days: 3,
    subject: '',
    body: `Hallo {{vorname|zusammen}},

ich schiebe meine Mail von letzter Woche noch einmal nach oben — erfahrungsgemäß geht so etwas im Tagesgeschäft schnell unter.

Falls das Thema gerade nicht dran ist, sagen Sie einfach kurz Bescheid, dann hake ich es ab.

Viele Grüße`,
  },
  {
    step_no: 3,
    delay_days: 6,
    subject: '',
    body: `Hallo {{vorname|zusammen}},

letzte Nachricht von mir zu diesem Thema — ich will nicht nerven.

Wenn {{firma}} später einmal an dem Punkt ist, melden Sie sich gern. Ich lasse Sie ansonsten in Ruhe.

Viele Grüße`,
  },
];
