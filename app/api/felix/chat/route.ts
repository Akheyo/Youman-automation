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
import type { SupabaseClient } from '@supabase/supabase-js';
import { findCompaniesByIndustry, type CompanyResult } from '@/lib/felix/overpass-companies';
import { findCompaniesGoogle } from '@/lib/felix/places-companies';
import { researchCompany } from '@/lib/felix/research';
import { createClient } from '@/lib/supabase/server';
import { planForUser, isOwnerEmail, PLANS } from '@/lib/plans';

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
- Wenn die Person eine Region und/oder Branche nennt, rufe \`find_companies\` mit \`area\` (Ort) und \`industry\` (Branche/Tätigkeit in normalen Worten, z. B. „Dachdecker", „Friseure", „Werbeagenturen") auf.
- Fehlt Ort ODER Branche, frage kurz nach (eine Frage, nicht mehrere).
- Für Kaltakquise ist \`without_website: true\` oft wertvoll (Betriebe ohne Website = klarer Mehrwert für Web/Automation-Angebote).

ZIELGRUPPE FREI INTERPRETIEREN (sehr wichtig): Der Nutzer beschreibt seine Zielgruppe oft NICHT als saubere Branche, sondern als Tätigkeit oder als Bedarf. Übersetze JEDE solche Beschreibung selbstständig in ein oder mehrere konkrete, suchbare Stichworte und rufe damit \`find_companies\` auf — frag NICHT zurück „welche Branche meinst du", sondern leite es ab und nenne dem Nutzer kurz, was du gewählt hast.
- Tätigkeitsbeschreibung → passendes Stichwort. Beispiele: „Agenturen, die Vertrieb machen" → \`industry: "Vertriebsagentur"\` (ggf. zusätzlich „Werbeagentur", „Leadagentur", „Callcenter"); „Firmen, die Webseiten bauen" → „Webdesign-Agentur".
- Bedarfsbeschreibung (WER würde das Angebot des Nutzers brauchen?) → leite 2–4 passende Zielbranchen ab und such sie NACHEINANDER mit mehreren \`find_companies\`-Aufrufen. Beispiele: „Firmen, die Akquise-Mails schreiben könnten / von Kaltakquise profitieren" → z. B. „Werbeagentur", „Unternehmensberatung", „IT-Dienstleister", „Personaldienstleister"; „Betriebe, die eine Website bräuchten" → relevante Handwerks-/Dienstleistungsbranchen mit \`without_website: true\`.
- Sag dem Nutzer in einem Satz, welche Stichworte/Branchen du gesucht hast, fasse die Treffer zusammen und biete an, weitere Branchen zu ergänzen oder eine andere Region zu nehmen.
- \`industry\` darf also ein Branchen-Begriff ODER eine Tätigkeit sein. Halte den Begriff kurz und suchbar (kein ganzer Satz).

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
      'Findet reale Unternehmen/Betriebe in Deutschland nach Ort und Branche/Tätigkeit. Gibt Name, Adresse, Telefon, Website-Status und Branchen-Typen zurück. Nutze es immer, wenn der Nutzer Firmen sucht — auch wenn er die Zielgruppe als Tätigkeit ("Agenturen, die Vertrieb machen") oder als Bedarf ("Firmen, die Akquise-Mails brauchen könnten") beschreibt: übersetze das selbst in passende Stichworte und rufe das Werkzeug ggf. mehrfach für mehrere Branchen auf. Rate Firmendaten niemals selbst.',
    parameters: {
      type: 'object',
      properties: {
        area: {
          type: 'string',
          description: 'Ort: Stadt ("Dortmund"), Landkreis ("Kreis Borken") oder Region ("Münsterland").',
        },
        industry: {
          type: 'string',
          description:
            'Branche ODER Tätigkeit als kurzes, suchbares Stichwort (kein ganzer Satz), z. B. "Dachdecker", "Friseure", "Werbeagentur", "Vertriebsagentur", "Unternehmensberatung", "IT-Dienstleister". Beschreibt der Nutzer eine Tätigkeit/Bedarf, wandle das vorher in ein solches Stichwort um.',
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

/**
 * Atomically check + charge one monthly credit. Returns true when allowed.
 * Fails open if the RPC errors (e.g. schema not yet applied) so paying users
 * are never hard-blocked by an infra hiccup.
 */
async function consumeQuota(sb: SupabaseClient, kind: 'search' | 'email', limit: number): Promise<boolean> {
  const { data, error } = await sb.rpc('consume_quota', { p_kind: kind, p_limit: limit });
  if (error) return true;
  return data === true;
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

  // SaaS gate: when Supabase is configured, require a login and load the plan.
  // When it is not configured, the app runs open (legacy mode) so nothing breaks.
  const sb = createClient();
  let userId: string | null = null;
  let owner = false;
  let plan = PLANS.free;
  if (sb) {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Bitte melde dich an, um Felix zu nutzen.', action: 'login' }, { status: 401 });
    }
    userId = user.id;
    owner = isOwnerEmail(user.email);
    const { data: prof } = await sb.from('profiles').select('plan').eq('id', user.id).single();
    plan = planForUser({ plan: prof?.plan, email: user.email });
  }

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
          if (sb && userId && !owner && !(await consumeQuota(sb, 'search', plan.searches))) {
            resultText = `LIMIT_ERREICHT: Der ${plan.name}-Tarif erlaubt ${plan.searches} Firmensuchen pro Monat, das ist aufgebraucht. Sag dem Nutzer freundlich, dass das Monatslimit erreicht ist und er auf der Preis-Seite (/pricing) upgraden kann. Führe KEINE Suche aus.`;
          } else {
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
          }
        } else if (fnName === 'research_company') {
          const r = await researchCompany(String(args.website || ''), String(args.name || ''));
          resultText = r.ok
            ? `Website gelesen (${r.pages.join(', ')}).\nGefundene E-Mails: ${
                r.emails.length ? r.emails.join(', ') : 'keine'
              }\n\nWebsite-Text (Auszug):\n${r.text}`
            : `Fehler: ${r.error}`;
        } else if (fnName === 'send_pitch_email') {
          if (sb && userId && !owner && !(await consumeQuota(sb, 'email', plan.emails))) {
            resultText = `LIMIT_ERREICHT: Der ${plan.name}-Tarif erlaubt ${plan.emails} Pitch-Mails pro Monat, das ist aufgebraucht. Sag dem Nutzer freundlich, dass das Limit erreicht ist und er auf /pricing upgraden kann. Sende KEINE Mail.`;
          } else {
            const sent = await sendPitchEmail({
              to: String(args.to || ''),
              subject: String(args.subject || ''),
              body: String(args.body || ''),
              company: String(args.company || ''),
            });
            resultText = sent.ok ? `E-Mail erfolgreich an ${String(args.to || '')} gesendet.` : `Fehler: ${sent.error}`;
            if (sent.ok && sb && userId) {
              await sb.from('sent_emails').insert({
                user_id: userId,
                to_email: String(args.to || ''),
                subject: String(args.subject || ''),
                company: String(args.company || ''),
              });
            }
          }
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
