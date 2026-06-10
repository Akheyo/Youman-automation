'use client';

/** Public pricing page. Free → signup; paid → Stripe Checkout (login required). */

import { useState } from 'react';
import Link from 'next/link';
import { PLANS, type PlanId } from '@/lib/plans';
import styles from './pricing.module.css';

export default function PricingPage() {
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(plan: PlanId) {
    setError(null);
    setBusy(plan);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        window.location.href = `/signup?redirect=/pricing`;
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || 'Checkout konnte nicht gestartet werden.');
    } catch {
      setError('Netzwerkfehler. Bitte erneut versuchen.');
    } finally {
      setBusy(null);
    }
  }

  const order: PlanId[] = ['free', 'starter', 'pro'];

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>Y</span> Youman Automation
        </Link>
        <Link href="/login" className={styles.loginLink}>
          Anmelden
        </Link>
      </header>

      <div className={styles.hero}>
        <h1>Dein KI-Vertriebsteam – zum Festpreis</h1>
        <p>Felix findet Firmen, Anna analysiert sie, Paul schreibt &amp; sendet den Pitch. Wähle deinen Tarif.</p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.grid}>
        {order.map((id) => {
          const plan = PLANS[id];
          const highlight = id === 'starter';
          return (
            <div key={id} className={`${styles.card} ${highlight ? styles.highlight : ''}`}>
              {highlight && <div className={styles.badge}>Beliebt</div>}
              <div className={styles.planName}>{plan.name}</div>
              <div className={styles.price}>{plan.priceLabel}</div>
              <ul className={styles.features}>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {id === 'free' ? (
                <Link href="/signup" className={`${styles.cta} ${styles.ctaOutline}`}>
                  Kostenlos starten
                </Link>
              ) : (
                <button className={styles.cta} disabled={busy === id} onClick={() => subscribe(id)}>
                  {busy === id ? 'Weiter zu Stripe…' : 'Abonnieren'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className={styles.foot}>
        Alle Preise zzgl. USt. Monatlich kündbar. Schon Kunde? <Link href="/dashboard">Zum Dashboard</Link>
      </p>
    </div>
  );
}
