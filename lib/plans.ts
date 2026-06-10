/**
 * Subscription plans and their monthly usage limits.
 *
 * `searches` = company lookups (Felix), `emails` = pitch e-mails sent (Paul).
 * Stripe price IDs are read from env so they can differ per environment.
 */

export type PlanId = 'free' | 'starter' | 'pro';

export interface Plan {
  id: PlanId;
  name: string;
  priceLabel: string;
  searches: number;
  emails: number;
  calls: number;
  stripePriceId?: string;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceLabel: '0 €',
    searches: 10,
    emails: 5,
    calls: 5,
    features: ['10 Firmensuchen / Monat', '5 Pitch-Mails / Monat', '5 KI-Anrufe / Monat', 'Felix, Anna, Paul & Lina'],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceLabel: '29 €/Monat',
    searches: 300,
    emails: 150,
    calls: 100,
    stripePriceId: process.env.STRIPE_PRICE_STARTER,
    features: ['300 Firmensuchen / Monat', '150 Pitch-Mails / Monat', '100 KI-Anrufe / Monat', 'Lead-Historie', 'E-Mail-Support'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceLabel: '79 €/Monat',
    searches: 2000,
    emails: 1000,
    calls: 500,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    features: ['2.000 Firmensuchen / Monat', '1.000 Pitch-Mails / Monat', '500 KI-Anrufe / Monat', 'Lead-Historie', 'Priorisierter Support'],
  },
};

export function planFor(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) ?? 'free'] ?? PLANS.free;
}

/** Map a Stripe price ID back to a plan (used by the billing webhook). */
export function planByPriceId(priceId: string | null | undefined): PlanId {
  if (priceId && priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId && priceId === process.env.STRIPE_PRICE_STARTER) return 'starter';
  return 'free';
}
