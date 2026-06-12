'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './dashboard.module.css';

export type OnboardingStep = {
  id: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
  done: boolean;
};

export default function Onboarding({ steps }: { steps: OnboardingStep[] }) {
  // Start hidden to avoid a flash before we can read localStorage.
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(localStorage.getItem('ym_onb_dismissed') === '1');
  }, []);

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  if (hidden || allDone) return null;

  function dismiss() {
    localStorage.setItem('ym_onb_dismissed', '1');
    setHidden(true);
  }

  return (
    <section className={styles.onbCard}>
      <button className={styles.onbDismiss} onClick={dismiss} aria-label="Ausblenden">
        ×
      </button>
      <div className={styles.onbHead}>
        <span className={styles.onbTitle}>🚀 Erste Schritte</span>
        <span className={styles.onbProgress}>
          {doneCount}/{steps.length} erledigt
        </span>
      </div>
      <div className={styles.onbSteps}>
        {steps.map((s) => (
          <div key={s.id} className={`${styles.onbStep} ${s.done ? styles.onbStepDone : ''}`}>
            <span className={styles.onbCheck}>{s.done ? '✓' : ''}</span>
            <div className={styles.onbStepText}>
              <div className={styles.onbStepTitle}>{s.title}</div>
              <div className={styles.onbStepDesc}>{s.desc}</div>
            </div>
            {!s.done && (
              <Link href={s.href} className={styles.onbCta}>
                {s.cta}
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
