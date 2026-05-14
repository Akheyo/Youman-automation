/**
 * Vercel Edge Function für Cloud-Sync zwischen DAEV-Margin-Tool-Installationen.
 *
 * Endpoints:
 *   GET  /api/data?code=XYZ → liefert gespeicherte Daten (oder {exists:false})
 *   PUT  /api/data?code=XYZ → speichert neue Daten (Body: JSON)
 *
 * Authentifizierung: ausschließlich über den Sync-Code (24 alphanumerische Zeichen).
 * Wer den Code hat, kann lesen/schreiben. Brute-Force ist mit 32^24 ≈ 10^36
 * Kombinationen infeasibel.
 */

import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const MAX_BODY_BYTES = 1_000_000; // 1 MB Limit pro Sync-Code
const TTL_SECONDS = 60 * 60 * 24 * 365; // 1 Jahr, jedes PUT verlängert

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function isValidCode(code: string | null): code is string {
  return typeof code === 'string' && /^[A-Z0-9-]{8,40}$/i.test(code);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!isValidCode(code)) {
    return json({ error: 'Ungültiger Sync-Code.' }, 400);
  }
  const key = `sync:${code.toUpperCase()}`;

  if (req.method === 'GET') {
    const entry = await kv.get(key);
    if (!entry) return json({ exists: false }, 200);
    return json({ exists: true, ...(entry as Record<string, unknown>) }, 200);
  }

  if (req.method === 'PUT') {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return json({ error: 'Daten überschreiten die Größenbeschränkung.' }, 413);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: 'Ungültiges JSON.' }, 400);
    }
    const updatedAt = new Date().toISOString();
    await kv.set(key, { updatedAt, payload: parsed }, { ex: TTL_SECONDS });
    return json({ ok: true, updatedAt }, 200);
  }

  return json({ error: 'Methode nicht erlaubt.' }, 405);
}
