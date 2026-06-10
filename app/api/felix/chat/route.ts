/**
 * POST /api/felix/chat
 *
 * "Felix" — the AI lead scout, backed by OpenRouter (OpenAI-compatible API).
 * Runs a tool-use loop: the model interprets the request, calls `find_companies`
 * (OpenStreetMap via Overpass) to pull businesses by region + industry, reasons
 * about WHAT each company does (sales agency? runs acquisition? retail? craft?)
 * and how relevant it is, then answers in the chat.
 *
 * Request body:  { messages: { role: "user" | "assistant", content: string }[] }
 * Response body: { reply: string, companies: CompanyResult[] }  (502/503 on error)
 *
 * Requires OPENROUTER_API_KEY. The browser never sees the key — server-side only.
 */

import { NextResponse } from 'next/server';
import { findCompanies, type CompanyResult } from '@/lib/felix/overpass-companies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Any OpenRouter model slug (must support tool calling), override via FELIX_MODEL.
// Default kept on a widely-available model; e.g. "openai/gpt-4o",
// "anthropic/claude-3.7-sonnet", "google/gemini-2.0-flash-001".
const MODEL = process.env.FELIX_MODEL || 'openai/gpt-4o-mini';
const MAX_TOOL_ROUNDS = 5;

const SYSTEM_PROMPT = `Du bist „Felix", der KI-Lead-Scout von Youman Automation. Du hilfst dem Vertrieb, in ganz Deutschland passende Unternehmen zu finden und einzuschätzen.

Datenquelle: Du hast ein Werkzeug \`find_companies\`, das Betriebe aus OpenStreetMap nach Verwaltungsgebiet (Stadt, Landkreis, Regierungsbezirk) und Branche liefert — inklusive Adresse, Telefon, Website-Status und beschreibenden OSM-Tags.

So arbeitest du:
- Wenn die Person eine Region und/oder Branche nennt, rufe \`find_companies\` auf. Übersetze die Branche selbst in einen passenden OSM-Filter (osm_selector), z. B.:
  Friseur → shop=hairdresser · Restaurant → amenity=restaurant · Bäckerei → shop=bakery · Versicherung → office=insurance · Immobilien → office=estate_agent · Steuerberater → office=tax_advisor · Anwalt → office=lawyer · Werbe-/Marketingagentur → office=advertising_agency · Vertrieb/Agentur/Unternehmen allgemein → office=company · Handwerk (z. B. Tischler) → craft=carpenter · Autohaus → shop=car · Fitnessstudio → leisure=fitness_centre.
  Wenn unklar, wähle den naheliegendsten Filter und sag dazu, welchen du genommen hast.
- Fehlt Region ODER Branche, frage kurz nach (eine Frage, nicht mehrere).
- Für Kaltakquise ist \`without_website: true\` oft wertvoll (Betriebe ohne Website = klarer Mehrwert für Web/Automation-Angebote).

WICHTIG — Einschätzung des Geschäfts: Lies die beschreibenden Tags (descriptors) jedes Treffers und ordne ein, WAS die Firma macht. Sag pro relevantem Treffer in einem Halbsatz, worum es sich handelt. Erkenne und kennzeichne dabei besonders:
- Vertriebs-/Verkaufsagenturen, Call-Center, Marketing-/Werbeagenturen, Makler — also Firmen, die selbst Akquise/Vertrieb betreiben. Markiere sie klar (z. B. „⚑ betreibt selbst Vertrieb/Akquise"), weil das für unsere Ansprache relevant ist (Partner oder Wettbewerber statt klassischer Kunde).
- Betriebe ohne Website als heiße Leads für Web-/Automationsangebote.
Wenn die Tags zu dünn für eine sichere Einordnung sind, sag das ehrlich statt zu raten.

Stil: Deutsch, knapp und konkret. Fasse Ergebnisse als kurze Liste mit den wichtigsten Feldern (Name, Ort, Telefon, Website ja/nein, Einschätzung). Erfinde niemals Firmen, Adressen oder Telefonnummern — nutze ausschließlich, was das Werkzeug liefert.`;

const FIND_COMPANIES_TOOL = {
  type: 'function' as const,
  function: {
    name: 'find_companies',
    description:
      'Findet reale Unternehmen/Betriebe in Deutschland aus OpenStreetMap nach Verwaltungsgebiet und Branche. Gibt Name, Adresse, Telefon, Website-Status und beschreibende OSM-Tags zurück. Nutze es immer, wenn der Nutzer Firmen in einer Region/Branche sucht — rate Firmendaten niemals selbst.',
    parameters: {
      type: 'object',
      properties: {
        area: {
          type: 'string',
          description:
            'Verwaltungsgebiet, exakt wie in OSM benannt: Stadt ("Dortmund"), Landkreis ("Kreis Borken") oder Regierungsbezirk ("Münster").',
        },
        osm_selector: {
          type: 'string',
          description:
            'OSM-Tag-Filter "key=value", z. B. shop=hairdresser, amenity=restaurant, office=insurance, office=company, craft=carpenter.',
        },
        without_website: {
          type: 'boolean',
          description: 'Nur Betriebe ohne hinterlegte Website zurückgeben (gut für Kaltakquise). Standard: false.',
        },
        limit: {
          type: 'integer',
          description: 'Maximale Trefferzahl (1–60, Standard 30).',
        },
      },
      required: ['area', 'osm_selector'],
    },
  },
};

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface OpenRouterResponse {
  choices?: { message: ChatCompletionMessage; finish_reason: string }[];
  error?: { message?: string };
}

interface ClientMessage {
  role: 'user' | 'assistant';
  content: string;
}

function describe(c: CompanyResult): string {
  const tags = c.descriptors.length ? c.descriptors.join('; ') : 'keine Tags';
  return `- ${c.name} | ${c.address || 'Adresse unbekannt'} | Tel: ${c.phone || '—'} | Website: ${
    c.hasWebsite ? c.website || 'ja' : 'KEINE'
  } | Tags: ${tags}`;
}

async function callOpenRouter(
  apiKey: string,
  messages: ChatCompletionMessage[],
): Promise<ChatCompletionMessage> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Title': 'Felix Lead-Scout (Youman Automation)',
  };
  if (process.env.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools: [FIND_COMPANIES_TOOL],
        tool_choice: 'auto',
        max_tokens: 2000,
      }),
      signal: ctl.signal,
    });
    const data = (await res.json().catch(() => ({}))) as OpenRouterResponse;
    if (!res.ok || data.error) {
      const msg = data.error?.message || `HTTP ${res.status}`;
      const err = new Error(msg) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error('Leere Antwort von OpenRouter.');
    return message;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'Felix ist nicht konfiguriert.',
        action: 'OPENROUTER_API_KEY in den Umgebungsvariablen setzen.',
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body muss valides JSON sein.' }, { status: 400 });
  }

  const rawMessages = (body as { messages?: unknown })?.messages;
  const history: ClientMessage[] = Array.isArray(rawMessages)
    ? (rawMessages as ClientMessage[]).filter(
        (m) =>
          m &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string' &&
          m.content.trim().length > 0,
      )
    : [];

  if (history.length === 0) {
    return NextResponse.json({ error: 'Keine Nachrichten übergeben.' }, { status: 422 });
  }

  const messages: ChatCompletionMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const collected: CompanyResult[] = [];
  let reply = '';

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const message = await callOpenRouter(apiKey, messages);
      if (typeof message.content === 'string' && message.content.trim()) {
        reply = message.content.trim();
      }

      const toolCalls = message.tool_calls || [];
      if (toolCalls.length === 0) break;

      // Echo the assistant turn (with its tool_calls) before sending results.
      messages.push({
        role: 'assistant',
        content: message.content ?? '',
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        if (call.function?.name !== 'find_companies') {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: `Unbekanntes Werkzeug: ${call.function?.name}`,
          });
          continue;
        }
        let input: Partial<{ area: string; osm_selector: string; without_website: boolean; limit: number }> = {};
        try {
          input = JSON.parse(call.function.arguments || '{}');
        } catch {
          /* leave input empty → findCompanies returns a validation error */
        }
        const result = await findCompanies({
          area: String(input.area || ''),
          osm_selector: String(input.osm_selector || ''),
          without_website: Boolean(input.without_website),
          limit: typeof input.limit === 'number' ? input.limit : undefined,
        });
        collected.push(...result.companies);
        const summary = result.error
          ? `Fehler: ${result.error}`
          : `${result.companies.length} Treffer:\n${result.companies.map(describe).join('\n') || '(keine)'}`;
        messages.push({ role: 'tool', tool_call_id: call.id, content: summary });
      }
    }
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 401) return NextResponse.json({ error: 'OpenRouter-API-Key ungültig.' }, { status: 502 });
    if (status === 429)
      return NextResponse.json({ error: 'Rate-Limit erreicht — bitte kurz warten.' }, { status: 429 });
    return NextResponse.json(
      { error: 'Felix ist gerade nicht erreichbar.', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  // Dedupe collected companies by OSM id for the UI cards.
  const seen = new Set<string>();
  const companies = collected.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  return NextResponse.json({
    reply: reply || 'Ich habe dazu leider keine Antwort gefunden.',
    companies,
  });
}
