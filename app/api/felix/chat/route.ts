/**
 * POST /api/felix/chat
 *
 * "Felix" — the AI sales assistant, backed by OpenRouter (OpenAI-compatible API).
 * One chat, three roles via tools:
 *   - Felix  → find_companies      (Google Places, OSM fallback) — find businesses
 *   - Anna   → research_company    (read website + extract e-mail) — analyse a company
 *   - Paul   → send_pitch_email    (n8n + SMTP) — send an approved pitch e-mail
 *
 * Request body:  { messages: { role: "user" | "assistant", content: string }[] }
 * Response body: { reply: string, companies: CompanyResult[] }  (502/503 on error)
 *
 * Env: OPENROUTER_API_KEY (req), GOOGLE_MAPS_API_KEY (Places), FELIX_PITCH_WEBHOOK_URL
 * (n8n send webhook). Keys stay server-side — the browser never sees them.
 */

import { NextResponse } from 'next/server';
import { findCompaniesByIndustry, type CompanyResult } from '@/lib/felix/overpass-companies';
import { findCompaniesGoogle } from '@/lib/felix/places-companies';
import { researchCompany } from '@/lib/felix/research';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Any OpenRouter model slug (must support tool calling), override via FELIX_MODEL.
// Default kept on a widely-available model; e.g. "openai/gpt-4o",
// "anthropic/claude-3.7-sonnet", "google/gemini-2.0-flash-001".
const MODEL = process.env.FELIX_MODEL || 'openai/gpt-4o-mini';
const MAX_TOOL_ROUNDS = 5;

const SYSTEM_PROMPT = `Du bist „Felix", der KI-Lead-Scout von Youman Automation. Du hilfst dem Vertrieb, in ganz Deutschland passende Unternehmen zu finden und einzuschätzen.

Du arbeitest in einem Dreierteam — gib jeder Antwort die richtige Stimme:
- Felix = Suche & Koordination (Firmen finden, allgemeine Fragen).
- Anna = Firmen-Analyse (Website lesen, einschätzen).
- Paul = Pitch-Text schreiben & Versand.

FORMAT — IMMER einhalten: Schreibe als allererste Zeile deiner Antwort NUR eines dieser Kürzel, je nachdem, WER gerade spricht: \`@FELIX\`, \`@ANNA\` oder \`@PAUL\`. Erst ab der nächsten Zeile folgt die eigentliche Nachricht (ohne das Kürzel zu wiederholen). Beispiel:
@ANNA
Ich habe die Website von … angeschaut: …

Datenquelle: Du hast ein Werkzeug \`find_companies\`, das echte Betriebe nach Ort (Stadt, Landkreis, Region) und Branche liefert — mit Name, Adresse, Telefon, Website-Status und Branchen-Typen.

So arbeitest du:
- Wenn die Person eine Region und/oder Branche nennt, rufe \`find_companies\` mit \`area\` (Ort) und \`industry\` (Branche in normalen Worten, z. B. „Dachdecker", „Friseure", „Werbeagenturen") auf.
- Fehlt Ort ODER Branche, frage kurz nach (eine Frage, nicht mehrere).
- Für Kaltakquise ist \`without_website: true\` oft wertvoll (Betriebe ohne Website = klarer Mehrwert für Web/Automation-Angebote).

WICHTIG — Einschätzung des Geschäfts: Lies die Branchen-Typen/Tags (descriptors) jedes Treffers und ordne ein, WAS die Firma macht. Sag pro relevantem Treffer in einem Halbsatz, worum es sich handelt. Erkenne und kennzeichne dabei besonders:
- Vertriebs-/Verkaufsagenturen, Call-Center, Marketing-/Werbeagenturen, Makler — also Firmen, die selbst Akquise/Vertrieb betreiben. Markiere sie klar (z. B. „⚑ betreibt selbst Vertrieb/Akquise"), weil das für unsere Ansprache relevant ist (Partner oder Wettbewerber statt klassischer Kunde).
- Betriebe ohne Website als heiße Leads für Web-/Automationsangebote.
Wenn die Tags zu dünn für eine sichere Einordnung sind, sag das ehrlich statt zu raten.

Stil: Deutsch, knapp und konkret. Fasse Ergebnisse als kurze Liste mit den wichtigsten Feldern (Name, Ort, Telefon, Website ja/nein, Einschätzung). Erfinde niemals Firmen, Adressen oder Telefonnummern — nutze ausschließlich, was das Werkzeug liefert.

Fehlerfall: Gibt \`find_companies\` einen Text zurück, der mit "Fehler:" beginnt, nenne dem Nutzer diesen genauen Fehlertext wörtlich (zum Debuggen). Bei 0 Treffern sag klar, dass es in dem Gebiet für diese Branche keine Einträge gibt, und schlag eine größere/andere Region oder eine andere Branche vor — paraphrasiere das nicht als allgemeines „Datenquellen-Problem".

Nach der Trefferliste kann der Nutzer EINE Firma auswählen (per Name) und um eine Analyse oder einen Pitch bitten.

Rolle „Anna" (Analyse): Will der Nutzer eine Firma analysieren (z. B. „Analysiere X im Hinblick auf …"), rufe \`research_company\` mit Name und Website der Firma (aus den find_companies-Ergebnissen) auf. Nutze den zurückgegebenen Website-Text und schätze die Firma exakt nach der Vorgabe des Nutzers ein. Ist die Vorgabe unklar, frag kurz nach. Hat die Firma keine/keine erreichbare Website, sag das ehrlich und arbeite mit den vorhandenen Daten. \`research_company\` liefert auch gefundene E-Mail-Adressen — merke sie dir für den Pitch.

Rolle „Paul" (Pitch & Versand): Will der Nutzer einen Sales-Pitch, schreibe eine kurze, persönliche Verkaufs-E-Mail auf Deutsch (klarer Bezug zur Analyse, konkreter Mehrwert, freundlicher Call-to-Action, kein Spam, keine erfundenen Fakten). Zeige sie ZUERST als ENTWURF im Chat: Empfänger, Betreff, Text. Schlage die gefundene E-Mail als Empfänger vor; ist keine bekannt, frage den Nutzer nach der Adresse.

ABSOLUT WICHTIG: Rufe \`send_pitch_email\` NUR auf, wenn der Nutzer den Entwurf ausdrücklich freigegeben hat (z. B. „senden", „ja, abschicken"). Sende niemals ungefragt. Nach dem Versand bestätige kurz, an wen gesendet wurde.`;

const FIND_COMPANIES_TOOL = {
  type: 'function' as const,
  function: {
    name: 'find_companies',
    description:
      'Findet reale Unternehmen/Betriebe in Deutschland nach Ort und Branche. Gibt Name, Adresse, Telefon, Website-Status und Branchen-Typen zurück. Nutze es immer, wenn der Nutzer Firmen in einer Region/Branche sucht — rate Firmendaten niemals selbst.',
    parameters: {
      type: 'object',
      properties: {
        area: {
          type: 'string',
          description: 'Ort: Stadt ("Dortmund"), Landkreis ("Kreis Borken") oder Region ("Münsterland").',
        },
        industry: {
          type: 'string',
          description: 'Branche in normalen Worten, z. B. "Dachdecker", "Friseure", "Restaurants", "Werbeagenturen".',
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
      required: ['area', 'industry'],
    },
  },
};

const RESEARCH_COMPANY_TOOL = {
  type: 'function' as const,
  function: {
    name: 'research_company',
    description:
      'Liest die Website einer Firma (inkl. Impressum/Kontakt) und liefert Text zur Analyse sowie gefundene Kontakt-E-Mail-Adressen. Nutze es, wenn der Nutzer eine bestimmte Firma analysieren lassen oder einen Pitch dafür will.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Firmenname.' },
        website: { type: 'string', description: 'Website-URL der Firma (aus den find_companies-Ergebnissen).' },
      },
      required: ['name', 'website'],
    },
  },
};

const SEND_PITCH_TOOL = {
  type: 'function' as const,
  function: {
    name: 'send_pitch_email',
    description:
      'Versendet eine fertige Pitch-E-Mail an die Firma. NUR aufrufen, nachdem der Nutzer den Entwurf ausdrücklich freigegeben hat.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Empfänger-E-Mail-Adresse.' },
        subject: { type: 'string', description: 'Betreff der E-Mail.' },
        body: { type: 'string', description: 'E-Mail-Text (reiner Text, deutsche Verkaufsmail).' },
        company: { type: 'string', description: 'Firmenname (für Bestätigung).' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
};

const TOOLS = [FIND_COMPANIES_TOOL, RESEARCH_COMPANY_TOOL, SEND_PITCH_TOOL];

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
        tools: TOOLS,
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Paul's sender: POSTs the approved pitch to the n8n SMTP webhook. */
async function sendPitchEmail(args: {
  to: string;
  subject: string;
  body: string;
  company?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.FELIX_PITCH_WEBHOOK_URL;
  if (!url) return { ok: false, error: 'Versand nicht konfiguriert (FELIX_PITCH_WEBHOOK_URL fehlt).' };
  const to = (args.to || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: `Ungültige Empfänger-Adresse: "${to}".` };

  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">${escapeHtml(
    args.body || '',
  )}</div>`;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject: args.subject || '', html, company: args.company || '' }),
      signal: ctl.signal,
    });
    if (!res.ok) return { ok: false, error: `Versand-Webhook antwortete mit HTTP ${res.status}.` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
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
        const fnName = call.function?.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function?.arguments || '{}');
        } catch {
          /* leave empty → the tool returns a validation error */
        }
        let resultText: string;

        if (fnName === 'find_companies') {
          const area = String(args.area || '');
          const industry = String(args.industry || '');
          const withoutWebsite = Boolean(args.without_website);
          const max = typeof args.limit === 'number' ? args.limit : undefined;
          const googleKey = process.env.GOOGLE_MAPS_API_KEY;
          const result = googleKey
            ? await findCompaniesGoogle({ area, industry, without_website: withoutWebsite, limit: max }, googleKey)
            : await findCompaniesByIndustry(area, industry, withoutWebsite, max);
          collected.push(...result.companies);
          resultText = result.error
            ? `Fehler: ${result.error}`
            : `${result.companies.length} Treffer:\n${result.companies.map(describe).join('\n') || '(keine)'}`;
        } else if (fnName === 'research_company') {
          const r = await researchCompany(String(args.website || ''), String(args.name || ''));
          resultText = r.ok
            ? `Website gelesen (${r.pages.join(', ')}).\nGefundene E-Mails: ${
                r.emails.length ? r.emails.join(', ') : 'keine'
              }\n\nWebsite-Text (Auszug):\n${r.text}`
            : `Fehler: ${r.error}`;
        } else if (fnName === 'send_pitch_email') {
          const sent = await sendPitchEmail({
            to: String(args.to || ''),
            subject: String(args.subject || ''),
            body: String(args.body || ''),
            company: String(args.company || ''),
          });
          resultText = sent.ok ? `E-Mail erfolgreich an ${String(args.to || '')} gesendet.` : `Fehler: ${sent.error}`;
        } else {
          resultText = `Unbekanntes Werkzeug: ${fnName}`;
        }

        messages.push({ role: 'tool', tool_call_id: call.id, content: resultText });
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

  // Pull the leading @FELIX/@ANNA/@PAUL tag off the reply → who is speaking.
  let speaker: 'felix' | 'anna' | 'paul' = 'felix';
  const tag = reply.match(/^\s*@?(felix|anna|paul)\b[ \t]*[:.)\-–—]*[ \t]*\n?/i);
  if (tag) {
    speaker = tag[1]!.toLowerCase() as 'felix' | 'anna' | 'paul';
    reply = reply.slice(tag[0].length).trimStart();
  }

  return NextResponse.json({
    reply: reply || 'Ich habe dazu leider keine Antwort gefunden.',
    speaker,
    companies,
  });
}
