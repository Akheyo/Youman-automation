/**
 * Subscription plans and their monthly usage limits.
 *
 * `searches` = company lookups (Felix), `emails` = pitch e-mails sent (Paul).
 * Stripe price IDs are read from env so they can differ per environment.
 */

export type PlanId = 'free' | 'starter' | 'pro' | 'scale';

export interface Plan {
  id: string;
  name: string;
  priceLabel: string;
  tagline?: string;
  popular?: boolean;
  searches: number;
  emails: number;
  calls: number;
  stripePriceId?: string;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Test',
    priceLabel: '0 €',
    tagline: 'Unverbindlich ausprobieren',
    searches: 25,
    emails: 15,
    calls: 10,
    features: ['25 Firmensuchen / Monat', '15 Pitch-Mails / Monat', '10 KI-Anrufe / Monat', 'Felix, Anna, Paul & Lina', 'Ohne Kreditkarte starten'],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceLabel: '99 €/Monat',
    tagline: 'Für Solo & Einstieg',
    searches: 500,
    emails: 250,
    calls: 150,
    stripePriceId: process.env.STRIPE_PRICE_STARTER,
    features: ['500 Firmensuchen / Monat', '250 Pitch-Mails / Monat', '150 KI-Anrufe / Monat', '1 Agenten-Profil', 'Lead-Historie', 'E-Mail-Support'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceLabel: '299 €/Monat',
    tagline: 'Für wachsende Teams',
    popular: true,
    searches: 2500,
    emails: 1500,
    calls: 600,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    features: ['2.500 Firmensuchen / Monat', '1.500 Pitch-Mails / Monat', '600 KI-Anrufe / Monat', 'Kampagnen + Follow-up-Engine', 'Reporting-Dashboard', 'Priorisierter Support'],
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    priceLabel: '799 €/Monat',
    tagline: 'Für Agenturen & Vertriebe',
    searches: 8000,
    emails: 5000,
    calls: 2000,
    stripePriceId: process.env.STRIPE_PRICE_SCALE,
    features: ['8.000 Firmensuchen / Monat', '5.000 Pitch-Mails / Monat', '2.000 KI-Anrufe / Monat', 'Unbegrenzte Agenten-Profile', 'Warm Transfer + Webhooks', 'Dedizierter Ansprechpartner'],
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
  if (priceId && priceId === process.env.STRIPE_PRICE_SCALE) return 'scale';
  if (priceId && priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId && priceId === process.env.STRIPE_PRICE_STARTER) return 'starter';
  return 'free';
}
