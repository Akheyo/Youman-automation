/**
 * Stripe-Client fuer den Bestellshop.
 *
 * Wirft erst, wenn Stripe tatsaechlich benutzt wird — so laesst sich der Shop
 * lokal ohne Schluessel starten und die Speisekarte ansehen.
 */

import Stripe from 'stripe';

export function stripeKonfiguriert(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY fehlt.');
  if (!cached) cached = new Stripe(process.env.STRIPE_SECRET_KEY);
  return cached;
}

/** Basis-URL fuer die Rueckleitung aus dem Stripe-Checkout. */
export function shopUrl(req: Request): string {
  return process.env.NEXT_PUBLIC_SHOP_URL || new URL(req.url).origin || 'http://localhost:3000';
}
