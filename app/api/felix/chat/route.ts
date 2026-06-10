/**
 * POST /api/felix/chat
 *
 * "Felix" — the AI lead scout. Runs a Claude (claude-opus-4-8) tool-use loop:
 * the model interprets the user's request, calls `find_companies` (OpenStreetMap
 * via Overpass) to pull businesses by region + industry, reasons about WHAT each
 * company does (sales agency? does it run acquisition? retail? craft?) and how
 * relevant it is, then answers in the chat.
 *
 * Request body:  { messages: { role: "user" | "assistant", content: string }[] }
 * Response body: { reply: string, companies: CompanyResult[] }  (502/503 on error)
 *
 * Requires ANTHROPIC_API_KEY. The browser never sees the key — this runs server-side.
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { findCompanies, type CompanyResult } from '@/lib/felix/overpass-companies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.FELIX_MODEL || 'claude-opus-4-8';
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

const FIND_COMPANIES_TOOL: Anthropic.Tool = {
  name: 'find_companies',
  description:
    'Findet reale Unternehmen/Betriebe in Deutschland aus OpenStreetMap nach Verwaltungsgebiet und Branche. Gibt Name, Adresse, Telefon, Website-Status und beschreibende OSM-Tags zurück. Nutze es immer, wenn der Nutzer Firmen in einer Region/Branche sucht — rate Firmendaten niemals selbst.',
  input_schema: {
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
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function describe(c: CompanyResult): string {
  const tags = c.descriptors.length ? c.descriptors.join('; ') : 'keine Tags';
  return `- ${c.name} | ${c.address || 'Adresse unbekannt'} | Tel: ${c.phone || '—'} | Website: ${
    c.hasWebsite ? c.website || 'ja' : 'KEINE'
  } | Tags: ${tags}`;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'Felix ist nicht konfiguriert.',
        action: 'ANTHROPIC_API_KEY in den Umgebungsvariablen setzen.',
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
  const history: ChatMessage[] = Array.isArray(rawMessages)
    ? (rawMessages as ChatMessage[]).filter(
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

  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  const collected: CompanyResult[] = [];
  let reply = '';

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      // `thinking`/adaptive params can outpace installed SDK types — pass through.
      const params = {
        model: MODEL,
        max_tokens: 8000,
        thinking: { type: 'adaptive' },
        system: SYSTEM_PROMPT,
        tools: [FIND_COMPANIES_TOOL],
        messages,
      } as unknown as Anthropic.MessageCreateParamsNonStreaming;

      const msg = await client.messages.create(params);

      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      if (text) reply = text;

      if (msg.stop_reason !== 'tool_use') break;

      // Preserve the full assistant turn (incl. thinking + tool_use blocks).
      messages.push({
        role: 'assistant',
        content: msg.content as unknown as Anthropic.ContentBlockParam[],
      });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of msg.content) {
        if (block.type !== 'tool_use' || block.name !== 'find_companies') continue;
        const input = block.input as Partial<{
          area: string;
          osm_selector: string;
          without_website: boolean;
          limit: number;
        }>;
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
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: summary,
          is_error: Boolean(result.error),
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 401) return NextResponse.json({ error: 'Anthropic-API-Key ungültig.' }, { status: 502 });
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
