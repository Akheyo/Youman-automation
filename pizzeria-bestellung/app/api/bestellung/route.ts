/**
 * Bestellung aufgeben.
 *
 * POST /api/bestellung  →  { url } zum Stripe-Checkout
 *
 * Ablauf:
 *   1. Warenkorb serverseitig nachrechnen (Preise kommen nie aus dem Browser)
 *   2. Oeffnungszeiten pruefen
 *   3. Bestellung mit Status `offen` speichern
 *   4. Stripe-Checkout-Session anlegen — mit `capture_method: 'manual'`
 *
 * Zur manuellen Buchung: der Betrag wird beim Bezahlen nur reserviert, nicht
 * eingezogen. Erst wenn die Kueche die Bestellung annimmt, wird gebucht
 * (`/api/bestellung/[id]/annehmen`). Lehnt sie ab, wird die Reservierung
 * freigegeben und es fliesst ueberhaupt kein Geld — kein Erstattungsvorgang,
 * keine Gebuehr, keine Rueckfrage vom Gast. Fuer einen Lieferdienst, der
 * abends auch mal absagen muss, ist das der entscheidende Unterschied.
 *
 * Achtung: Bei manueller Buchung bietet Stripe nur Zahlarten an, die eine
 * getrennte Autorisierung koennen (Karten, Apple Pay, Google Pay). Ob PayPal
 * und Klarna fuer euer Konto dazugehoeren, vor dem Livegang im Dashboard
 * pruefen — sonst fallen sie im Checkout stillschweigend weg.
 */

import { NextResponse } from 'next/server';
import { getStripe, stripeKonfiguriert, shopUrl } from '@/lib/stripe';
import { db, dbKonfiguriert } from '@/lib/db';
import { rechne, KorbFehler, type BestellEingang } from '@/lib/warenkorb';
import { nimmtBestellungenAn, naechsteOeffnung } from '@/lib/oeffnungszeiten';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Wie lange der Gast im Checkout Zeit hat, bevor die Session verfaellt. */
const CHECKOUT_MINUTEN = 30;

interface Eingang extends BestellEingang {
  name?: string;
  telefon?: string;
  email?: string;
}

export async function POST(request: Request) {
  if (!stripeKonfiguriert() || !dbKonfiguriert()) {
    return NextResponse.json({ fehler: 'Online-Bezahlung ist noch nicht eingerichtet.' }, { status: 503 });
  }

  if (!nimmtBestellungenAn()) {
    return NextResponse.json({ fehler: `Wir haben gerade geschlossen. ${naechsteOeffnung()}` }, { status: 409 });
  }

  const eingang = (await request.json().catch(() => null)) as Eingang | null;
  if (!eingang) return NextResponse.json({ fehler: 'Bestellung konnte nicht gelesen werden.' }, { status: 400 });

  const name = (eingang.name ?? '').trim();
  const telefon = (eingang.telefon ?? '').trim();
  if (name.length < 2) return NextResponse.json({ fehler: 'Bitte gib deinen Namen an.' }, { status: 400 });
  if (telefon.replace(/\D/g, '').length < 6) {
    return NextResponse.json({ fehler: 'Bitte gib eine Telefonnummer an, unter der wir dich erreichen.' }, { status: 400 });
  }

  let rechnung;
  try {
    rechnung = rechne(eingang);
  } catch (err) {
    if (err instanceof KorbFehler) return NextResponse.json({ fehler: err.message }, { status: 400 });
    throw err;
  }

  const sql = db();
  const { data: bestellung, error } = await sql
    .from('bestellungen')
    .insert({
      status: 'offen',
      abholart: eingang.abholart,
      name,
      telefon,
      email: eingang.email?.trim() || null,
      strasse: eingang.adresse?.strasse?.trim() || null,
      plz: eingang.adresse?.plz?.trim() || null,
      ort: eingang.adresse?.ort?.trim() || null,
      hinweis: eingang.hinweis?.trim()?.slice(0, 500) || null,
      warenwert: rechnung.warenwert,
      liefergebuehr: rechnung.liefergebuehr,
      trinkgeld: rechnung.trinkgeld,
      summe: rechnung.summe,
    })
    .select('id, nummer')
    .single();

  if (error || !bestellung) {
    return NextResponse.json({ fehler: 'Bestellung konnte nicht gespeichert werden.' }, { status: 500 });
  }

  const { error: postenFehler } = await sql.from('bestell_posten').insert(
    rechnung.posten.map((p) => ({
      bestellung_id: bestellung.id,
      artikel_id: p.artikelId,
      bezeichnung: p.bezeichnung,
      menge: p.menge,
      einzelpreis: p.einzelpreis,
      gesamt: p.gesamt,
      mwst_gruppe: p.mwst,
      allergene: p.allergene,
    })),
  );
  if (postenFehler) {
    await sql.from('bestellungen').delete().eq('id', bestellung.id);
    return NextResponse.json({ fehler: 'Bestellung konnte nicht gespeichert werden.' }, { status: 500 });
  }

  // Preise sind Bruttopreise inkl. MwSt — so verlangt es die Preisangabenverordnung.
  const positionen = rechnung.posten.map((p) => ({
    quantity: p.menge,
    price_data: {
      currency: 'eur',
      unit_amount: p.einzelpreis,
      product_data: { name: p.bezeichnung },
    },
  }));
  if (rechnung.liefergebuehr > 0) {
    positionen.push({
      quantity: 1,
      price_data: { currency: 'eur', unit_amount: rechnung.liefergebuehr, product_data: { name: 'Liefergebühr' } },
    });
  }
  if (rechnung.trinkgeld > 0) {
    positionen.push({
      quantity: 1,
      price_data: { currency: 'eur', unit_amount: rechnung.trinkgeld, product_data: { name: 'Trinkgeld' } },
    });
  }

  const basis = shopUrl(request);
  const session = await getStripe().checkout.sessions.create(
    {
      mode: 'payment',
      line_items: positionen,
      customer_email: eingang.email?.trim() || undefined,
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_MINUTEN * 60,
      payment_intent_data: {
        capture_method: 'manual',
        description: `Bestellung #${bestellung.nummer} — Pizzeria Borken`,
        metadata: { bestellung_id: bestellung.id },
      },
      metadata: { bestellung_id: bestellung.id, nummer: String(bestellung.nummer) },
      success_url: `${basis}/bestellung/${bestellung.id}`,
      cancel_url: `${basis}/warenkorb?abgebrochen=1`,
    },
    // Ein Doppelklick auf "Jetzt bezahlen" darf keine zweite Session erzeugen.
    { idempotencyKey: `checkout-${bestellung.id}` },
  );

  await sql.from('bestellungen').update({ stripe_session_id: session.id }).eq('id', bestellung.id);

  return NextResponse.json({ url: session.url, bestellung: bestellung.id });
}
