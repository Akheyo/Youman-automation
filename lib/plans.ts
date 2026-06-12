/**
 * Subscription plans and their monthly usage limits.
 *
 * `searches` = company lookups (Felix), `emails` = pitch e-mails sent (Paul).
 * Stripe price IDs are read from env so they can differ per environment.
 */

export type PlanId = 'free' | 'starter' | 'pro';

export interface Plan {
  id: string;
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

const UNLIMITED_VALUE = 1_000_000_000;

/** Internal "owner" plan — effectively no limits. Not purchasable. */
export const UNLIMITED_PLAN: Plan = {
  id: 'unlimited',
  name: 'Unbegrenzt',
  priceLabel: '—',
  searches: UNLIMITED_VALUE,
  emails: UNLIMITED_VALUE,
  calls: UNLIMITED_VALUE,
  features: ['Unbegrenzte Nutzung (Owner)'],
};

/** True when a plan carries the unlimited/owner allowance. */
export function isUnlimited(plan: Plan): boolean {
  return plan.id === 'unlimited' || plan.searches >= UNLIMITED_VALUE;
}

// Accounts that always get the unlimited plan and skip all quota checks.
// Built-in owner(s) plus anything in the OWNER_EMAILS env (comma-separated).
const BUILTIN_OWNER_EMAILS = ['infoall4youstore@gmail.com'];

export function ownerEmails(): string[] {
  const fromEnv = (process.env.OWNER_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...BUILTIN_OWNER_EMAILS, ...fromEnv];
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ownerEmails().includes(email.toLowerCase());
}

export function planFor(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) ?? 'free'] ?? PLANS.free;
}

/** Plan for a specific user — owners always get the unlimited plan. */
export function planForUser(opts: { plan?: string | null; email?: string | null }): Plan {
  if (isOwnerEmail(opts.email)) return UNLIMITED_PLAN;
  return planFor(opts.plan);
}

/** Map a Stripe price ID back to a plan (used by the billing webhook). */
export function planByPriceId(priceId: string | null | undefined): PlanId {
  if (priceId && priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId && priceId === process.env.STRIPE_PRICE_STARTER) return 'starter';
  return 'free';
}
