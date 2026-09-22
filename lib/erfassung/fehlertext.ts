/**
 * Fehlermeldungen, die am Regal lesbar sind.
 *
 * Die Anthropic-API antwortet mit JSON, und das landete bisher roh in der
 * Oberfläche:
 *
 *   400 {"type":"error","error":{"type":"invalid_request_error","message":
 *   "Your credit balance is too low to access the Anthropic API. …"}}
 *
 * Wer mit dem Handy vor einem Regal steht, liest das nicht. Und selbst wer es
 * liest, weiß nicht, ob er etwas tun kann oder warten muss — dabei ist genau
 * das die einzige Frage, die in dem Moment zählt.
 *
 * Übersetzt werden nur Fälle, die WIRKLICH erkannt sind. Alles andere geht
 * unverändert durch: Eine unbekannte Meldung ungeschönt anzuzeigen ist besser,
 * als sie in ein freundliches „Es ist ein Fehler aufgetreten" zu verwandeln,
 * mit dem niemand etwas anfangen kann.
 */

export interface LesbarerFehler {
  /** Was los ist — ein Satz. */
  text: string;
  /** Was zu tun ist. Null, wenn nichts zu tun ist außer warten. */
  abhilfe: string | null;
  /** Hilft erneutes Versuchen? Dann lohnt der Knopf, sonst nicht. */
  nochmalSinnvoll: boolean;
}

interface Regel {
  passt: RegExp;
  text: string;
  abhilfe: string | null;
  nochmalSinnvoll: boolean;
}

const REGELN: Regel[] = [
  {
    // Der häufigste Fall im Betrieb, und der einzige, den man in zwei Minuten
    // selbst behebt.
    passt: /credit balance is too low|insufficient[_ ]credit/i,
    text: 'Das Guthaben des Anthropic-Kontos ist aufgebraucht.',
    abhilfe:
      'Unter console.anthropic.com → Plans & Billing Guthaben aufladen. Das ist ein eigenes Konto, ' +
      'getrennt vom Claude-Abo. Danach hier auf „Noch einmal auswerten".',
    nochmalSinnvoll: false,
  },
  {
    passt: /authentication[_ ]error|invalid x-api-key|401/i,
    text: 'Der Anthropic-Schlüssel wird nicht angenommen.',
    abhilfe: 'ANTHROPIC_API_KEY in Vercel prüfen — abgelaufen, gelöscht oder falsch eingetragen.',
    nochmalSinnvoll: false,
  },
  {
    passt: /rate[_ ]limit|429/i,
    text: 'Zu viele Anfragen in kurzer Zeit — Anthropic bremst gerade.',
    abhilfe: null,
    nochmalSinnvoll: true,
  },
  {
    passt: /overloaded|529/i,
    text: 'Anthropic ist gerade überlastet.',
    abhilfe: null,
    nochmalSinnvoll: true,
  },
  {
    passt: /timeout|timed out|aborted|ETIMEDOUT/i,
    text: 'Die Auswertung hat zu lange gebraucht und wurde abgebrochen.',
    abhilfe: 'Noch einmal versuchen. Bleibt es dabei, sind es vermutlich zu viele oder zu große Fotos.',
    nochmalSinnvoll: true,
  },
  {
    passt: /ANTHROPIC_API_KEY fehlt/i,
    text: 'Es ist kein Anthropic-Schlüssel hinterlegt.',
    abhilfe: 'ANTHROPIC_API_KEY in Vercel eintragen.',
    nochmalSinnvoll: false,
  },
  {
    passt: /HTTP 504|gateway timeout/i,
    text: 'Der Aufruf lief in die Zeitgrenze des Servers.',
    abhilfe: 'Noch einmal versuchen — der Zwischenstand bleibt erhalten.',
    nochmalSinnvoll: true,
  },
];

/**
 * Macht aus einer technischen Meldung eine, die weiterhilft.
 *
 * Wird nichts erkannt, bleibt der Urtext stehen — gekürzt, damit er die Zeile
 * nicht sprengt, aber nicht verfälscht.
 */
export function lesbarerFehler(roh: string | null | undefined): LesbarerFehler {
  const text = (roh ?? '').trim();
  if (!text) {
    return { text: 'Unbekannter Fehler.', abhilfe: null, nochmalSinnvoll: true };
  }

  for (const regel of REGELN) {
    if (regel.passt.test(text)) {
      return { text: regel.text, abhilfe: regel.abhilfe, nochmalSinnvoll: regel.nochmalSinnvoll };
    }
  }

  // Unbekannt: unverändert zeigen. Ein aufgehübschter Platzhalter wäre
  // schlimmer — dann steht da etwas Freundliches und niemand kommt weiter.
  return { text: text.length > 300 ? `${text.slice(0, 300)}…` : text, abhilfe: null, nochmalSinnvoll: true };
}

/** Der ganze Hinweis als ein Text — für Stellen, an denen nur eine Zeile passt. */
export function fehlerZeile(roh: string | null | undefined): string {
  const f = lesbarerFehler(roh);
  return f.abhilfe ? `${f.text} ${f.abhilfe}` : f.text;
}
