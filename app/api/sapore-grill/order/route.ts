/**
 * Bestellannahme fuer Sapore Grill.
 *
 * Der Browser schickt nur Artikel-IDs und Mengen — Preise, Liefergebuehr und
 * Mindestbestellwert rechnet der Server aus der eigenen Karte nach, damit eine
 * manipulierte Anfrage keine falschen Summen erzeugt.
 *
 * Zustellung der Bestellung: Ist `SAPORE_ORDER_WEBHOOK` gesetzt, geht die
 * Bestellung dorthin (z. B. n8n, Make, Bestell-Drucker). Ohne Webhook wird sie
 * protokolliert und die Bestellnummer trotzdem zurueckgegeben — die Seite bittet
 * den Gast dann um die telefonische Bestaetigung.
 */

import { NextResponse } from 'next/server';
import { BUSINESS, DELIVERY, findItem, formatPrice } from '@/lib/sapore/menu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  mode?: unknown;
  items?: unknown;
  customer?: unknown;
  time?: unknown;
  note?: unknown;
};

const MAX_ITEMS = 40;
const MAX_QTY = 99;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Bestellnummer der Form `SG-4193` — kurz genug, um sie vorzulesen. */
function orderNumber(): string {
  return `SG-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const mode = body.mode === 'liefern' ? 'liefern' : body.mode === 'abholen' ? 'abholen' : null;
  if (!mode) {
    return NextResponse.json(
      { ok: false, error: 'Bitte Lieferung oder Abholung wählen.' },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ITEMS) {
    return NextResponse.json({ ok: false, error: 'Der Warenkorb ist leer.' }, { status: 400 });
  }

  // Positionen gegen die eigene Karte pruefen und Summe serverseitig bilden.
  const lines: Array<{ id: string; name: string; qty: number; price: number; sum: number }> = [];
  for (const raw of body.items) {
    const entry = raw as { id?: unknown; qty?: unknown };
    const item = typeof entry.id === 'string' ? findItem(entry.id) : undefined;
    const qty = Number(entry.qty);
    if (!item || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return NextResponse.json(
        { ok: false, error: 'Eine Position der Bestellung ist nicht mehr verfügbar.' },
        { status: 400 },
      );
    }
    lines.push({ id: item.id, name: item.name, qty, price: item.price, sum: item.price * qty });
  }

  const subtotal = Math.round(lines.reduce((sum, line) => sum + line.sum, 0) * 100) / 100;

  const customer = (body.customer ?? {}) as Record<string, unknown>;
  const name = text(customer.name, 120);
  const phone = text(customer.phone, 40);
  const email = text(customer.email, 160);
  const street = text(customer.street, 160);
  const zip = text(customer.zip, 10);
  const city = text(customer.city, 80);

  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: 'Bitte einen Namen angeben.' }, { status: 400 });
  }
  if (!/^[\d\s+()/-]{6,}$/.test(phone)) {
    return NextResponse.json(
      { ok: false, error: 'Bitte eine erreichbare Telefonnummer angeben.' },
      { status: 400 },
    );
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Die E-Mail-Adresse ist ungültig.' }, { status: 400 });
  }

  let fee = 0;
  if (mode === 'liefern') {
    if (street.length < 4 || !/^\d{5}$/.test(zip) || city.length < 2) {
      return NextResponse.json(
        { ok: false, error: 'Für die Lieferung fehlt eine vollständige Adresse.' },
        { status: 400 },
      );
    }
    if (!DELIVERY.zips.includes(zip)) {
      return NextResponse.json(
        { ok: false, error: `Wir liefern derzeit nur nach ${DELIVERY.zips.join(', ')}.` },
        { status: 400 },
      );
    }
    if (subtotal < DELIVERY.minOrder) {
      return NextResponse.json(
        { ok: false, error: `Mindestbestellwert für Lieferung: ${formatPrice(DELIVERY.minOrder)}.` },
        { status: 400 },
      );
    }
    if (subtotal < DELIVERY.freeFrom) fee = DELIVERY.fee;
  }

  const order = {
    orderNo: orderNumber(),
    receivedAt: new Date().toISOString(),
    business: BUSINESS.name,
    mode,
    lines,
    subtotal,
    fee,
    total: Math.round((subtotal + fee) * 100) / 100,
    customer: { name, phone, email, street, zip, city },
    time: text(body.time, 20) || 'sofort',
    note: text(body.note, 500),
    eta: mode === 'liefern' ? DELIVERY.etaDelivery : DELIVERY.etaPickup,
  };

  const webhook = process.env.SAPORE_ORDER_WEBHOOK;
  if (webhook) {
    try {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        console.error('[sapore] Webhook antwortete mit', response.status);
      }
    } catch (error) {
      // Der Gast soll trotzdem eine Bestellnummer bekommen und anrufen koennen.
      console.error('[sapore] Webhook nicht erreichbar:', error);
    }
  } else {
    console.info('[sapore] Bestellung eingegangen (kein Webhook konfiguriert):', order.orderNo);
  }

  return NextResponse.json({
    ok: true,
    orderNo: order.orderNo,
    total: order.total,
    eta: order.eta,
    forwarded: Boolean(webhook),
  });
}
