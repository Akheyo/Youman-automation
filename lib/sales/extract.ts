/**
 * Phase B — structured post-call extraction.
 *
 * Sends the call transcript through an LLM (OpenRouter) and returns a
 * normalised outcome plus the key sales variables Lina should capture. Used by
 * the Vapi end-of-call webhook. Server-only.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type CallOutcome =
  | 'termin'
  | 'qualifiziert'
  | 'rueckruf'
  | 'kein_interesse'
  | 'mailbox'
  | 'nicht_erreicht'
  | 'erreicht';

export const CALL_OUTCOMES: CallOutcome[] = [
  'termin',
  'qualifiziert',
  'rueckruf',
  'kein_interesse',
  'mailbox',
  'nicht_erreicht',
  'erreicht',
];

export interface ExtractedCall {
  outcome: CallOutcome;
  budget: string | null;
  bedarf: string | null;
  entscheider: boolean | null;
  naechster_schritt: string | null;
}

function isOutcome(v: unknown): v is CallOutcome {
  return typeof v === 'string' && (CALL_OUTCOMES as string[]).includes(v);
}

/**
 * Returns structured data, or null when extraction isn't possible (no API key,
 * empty transcript, or the model failed). Callers should fall back gracefully.
 */
export async function extractCallData(
  transcript: string,
  summary: string,
  fallbackOutcome?: CallOutcome,
): Promise<ExtractedCall | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const text = `${summary}\n\n${transcript}`.trim();
  if (!apiKey || !text) return null;

  const model = process.env.FELIX_MODEL || 'openai/gpt-4o-mini';
  const system =
    'Du extrahierst strukturierte Vertriebsdaten aus dem Transkript eines deutschen Verkaufs-Telefonats. ' +
    'Antworte AUSSCHLIESSLICH mit einem JSON-Objekt mit genau diesen Feldern:\n' +
    '- "outcome": einer von ["termin","qualifiziert","rueckruf","kein_interesse","mailbox","nicht_erreicht","erreicht"]. ' +
    '"termin" = Termin vereinbart; "qualifiziert" = Interesse/Bedarf erkennbar, aber kein Termin; "rueckruf" = Rückruf gewünscht; ' +
    '"kein_interesse" = klar abgelehnt; "mailbox" = nur Anrufbeantworter; "nicht_erreicht" = niemand erreicht; "erreicht" = gesprochen, aber unklar.\n' +
    '- "budget": kurzer Text oder null (genanntes Budget/Preisrahmen).\n' +
    '- "bedarf": kurzer Text oder null (welcher Bedarf/Schmerzpunkt).\n' +
    '- "entscheider": true/false/null (war die erreichte Person Entscheider:in?).\n' +
    '- "naechster_schritt": kurzer Text oder null (vereinbarter nächster Schritt).\n' +
    'Erfinde nichts. Wenn etwas nicht im Transkript steht, nutze null.';

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25_000);
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Lina Post-Call Extraction (Youman Automation)',
    };
    if (process.env.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL;

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text.slice(0, 12000) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 400,
      }),
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as
      | { choices?: { message?: { content?: string } }[] }
      | null;
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Some models wrap JSON in prose — grab the first {...} block.
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) return null;
      parsed = JSON.parse(m[0]);
    }

    const outcome = isOutcome(parsed.outcome) ? parsed.outcome : fallbackOutcome ?? 'erreicht';
    const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

    return {
      outcome,
      budget: str(parsed.budget),
      bedarf: str(parsed.bedarf),
      entscheider: bool(parsed.entscheider),
      naechster_schritt: str(parsed.naechster_schritt),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
