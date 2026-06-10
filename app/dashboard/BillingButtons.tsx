'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PlanId } from '@/lib/plans';
import styles from './dashboard.module.css';

export default function BillingButtons({ hasSubscription, planId }: { hasSubscription: boolean; planId: PlanId }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || 'Kundenportal nicht verfügbar.');
    } catch {
      setError('Netzwerkfehler.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.billing}>
      {error && <div className={styles.error}>{error}</div>}
      {hasSubscription ? (
        <button className={styles.manageBtn} onClick={openPortal} disabled={busy}>
          {busy ? 'Öffne Kundenportal…' : 'Abo verwalten / kündigen'}
        </button>
      ) : (
        <Link href="/pricing" className={styles.upgradeBtn}>
          {planId === 'free' ? 'Auf bezahlten Tarif upgraden' : 'Tarif ändern'}
        </Link>
      )}
      <Link href="/pricing" className={styles.plansLink}>
        Alle Tarife ansehen
      </Link>
    </div>
  );
}
