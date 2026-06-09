/**
 * GET /api/vertrieb/leads
 *
 * Server-side proxy to the n8n "Vertrieb — API" workflow (GET /vertrieb-leads).
 * Keeps the n8n webhook URL server-side and avoids CORS in the browser.
 * Returns { leads: [...], count, byStatus, byRep, reps, generatedAt }.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function leadsUrl(): string | null {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/vertrieb-leads`;
}

export async function GET() {
  const url = leadsUrl();
  if (!url) {
    return NextResponse.json(
      {
        error: 'Vertriebs-API ist nicht konfiguriert.',
        action: 'N8N_WEBHOOK_BASE_URL in den Umgebungsvariablen setzen (z. B. https://DEINE-instanz.app.n8n.cloud/webhook).',
        leads: [],
      },
      { status: 503 },
    );
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctl.signal });
    if (!res.ok) {
      return NextResponse.json(
        { error: `n8n antwortete mit HTTP ${res.status}.`, action: 'Workflow "A&B Vertrieb — API" in n8n aktiv?', leads: [] },
        { status: 502 },
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'n8n-Vertriebs-API nicht erreichbar.', detail: err instanceof Error ? err.message : String(err), leads: [] },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
