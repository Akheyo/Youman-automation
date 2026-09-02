/**
 * Kuechenansicht — Daten fuer das Geraet im Laden.
 *
 * GET   liefert die offenen Bestellungen (und die zuletzt abgeschlossenen).
 * PATCH setzt den Status einer Bestellung.
 *
 * Zugang ueber einen gemeinsamen Token (`SAPORE_KITCHEN_TOKEN`), den das Tablet
 * einmal eingibt und danach lokal behaelt. Bewusst kein Login: im Laden soll
 * niemand Passwoerter tippen. Der Token gehoert entsprechend nur auf Geraete im
 * Laden — wer ihn hat, sieht Namen, Telefonnummern und Adressen der Gaeste.
 * Bestellungen werden ausschliesslich hier serverseitig gelesen; die Tabelle
 * selbst ist per RLS fuer alle anderen Wege gesperrt.
 */

import { NextResponse } from 'next/server';
import {
  listOpenOrders,
  listRecentClosed,
  setOrderStatus,
  type OrderStatus,
} from '@/lib/sapore/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUS: OrderStatus[] = ['neu', 'in_arbeit', 'fertig', 'abgeschlossen', 'storniert'];

/** Zeitkonstanter Vergleich, damit der Token nicht Zeichen fuer Zeichen erratbar ist. */
function tokenMatches(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function authorized(request: Request): boolean {
  const expected = process.env.SAPORE_KITCHEN_TOKEN;
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  return given.length > 0 && tokenMatches(given, expected);
}

function unauthorized(): NextResponse {
  const configured = Boolean(process.env.SAPORE_KITCHEN_TOKEN);
  return NextResponse.json(
    {
      ok: false,
      error: configured
        ? 'Falscher Zugangscode.'
        : 'Es ist noch kein Zugangscode eingerichtet (SAPORE_KITCHEN_TOKEN).',
    },
    { status: 401 },
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorized(request)) return unauthorized();

  const open = await listOpenOrders();
  if (open === null) {
    return NextResponse.json(
      { ok: false, error: 'Die Datenbank ist noch nicht eingerichtet.' },
      { status: 503 },
    );
  }
  const closed = (await listRecentClosed()) ?? [];

  return NextResponse.json({ ok: true, open, closed, serverTime: new Date().toISOString() });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  if (!authorized(request)) return unauthorized();

  let body: { id?: unknown; status?: unknown };
  try {
    body = (await request.json()) as { id?: unknown; status?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : '';
  const status = body.status as OrderStatus;
  if (!id || !VALID_STATUS.includes(status)) {
    return NextResponse.json({ ok: false, error: 'Unbekannte Bestellung oder Status.' }, { status: 400 });
  }

  const ok = await setOrderStatus(id, status);
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'Status konnte nicht geändert werden.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
