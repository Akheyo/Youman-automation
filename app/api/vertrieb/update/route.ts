/**
 * POST /api/vertrieb/update
 *
 * Server-side proxy to the n8n "Vertrieb — API" workflow (POST /vertrieb-update).
 * Body: { id: string, status?: string, assignedTo?: string, notes?: string }
 * Updates the matching row (by ID) in the Google Sheet via n8n.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function updateUrl(): string | null {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/vertrieb-update`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body muss valides JSON sein.' }, { status: 400 });
  }

  const p = body as Record<string, unknown>;
  if (!p || typeof p.id !== 'string' || p.id.trim().length === 0) {
    return NextResponse.json({ error: 'Feld "id" ist erforderlich.' }, { status: 422 });
  }

  const url = updateUrl();
  if (!url) {
    return NextResponse.json(
      { error: 'Vertriebs-API ist nicht konfiguriert.', action: 'N8N_WEBHOOK_BASE_URL setzen.' },
      { status: 503 },
    );
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
      signal: ctl.signal,
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `n8n antwortete mit HTTP ${res.status}.` },
        { status: 502 },
      );
    }
    const data = await res.json().catch(() => ({ ok: true }));
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'n8n-Vertriebs-API nicht erreichbar.', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
