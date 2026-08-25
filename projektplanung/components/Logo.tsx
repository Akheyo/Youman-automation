'use client';

import { useEffect, useState } from 'react';
import styles from './logo.module.css';

/**
 * Komplett-Konzept-Logo.
 *
 * tone="dark"  → für helle Flächen: nutzt die echte `public/logo.png`, sonst
 *                der Vektor-Nachbau mit dunklem Schriftzug.
 * tone="light" → für dunkle Flächen (z. B. Navy-Panel): immer der Vektor-
 *                Nachbau mit weißem Schriftzug (das Original-PNG ist dunkel).
 */
export default function Logo({
  size = 'md',
  wordmark = true,
  tone = 'dark',
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  wordmark?: boolean;
  tone?: 'dark' | 'light';
}) {
  // Standard: Vektor-Nachbau. Die echte /logo.png wird nur eingeblendet, wenn
  // sie tatsächlich existiert (Vorab-Ladeprüfung) – so gibt es kein kurzes
  // „kaputtes Bild"-Flackern, wenn noch kein Logo hochgeladen wurde.
  const [imgOk, setImgOk] = useState(false);
  useEffect(() => {
    if (tone !== 'dark') return;
    const probe = new window.Image();
    probe.onload = () => setImgOk(true);
    probe.src = '/logo.png';
  }, [tone]);

  if (tone === 'dark' && imgOk) {
    return (
      <span className={`${styles.logo} ${styles[size]}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Komplett Konzept" className={styles.img} />
      </span>
    );
  }

  return (
    <span className={`${styles.logo} ${styles[size]} ${tone === 'light' ? styles.light : ''}`}>
      <svg className={styles.mark} viewBox="0 0 48 44" aria-hidden focusable="false">
        <polygon points="24,3 45,41 3,41" fill="#F2C200" stroke="#122A63" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="24" cy="24" r="4.6" fill="#D92D20" />
      </svg>
      {wordmark && (
        <span className={styles.words}>
          <span className={styles.line1}>KOMPLETT</span>
          <span className={styles.line2}>KONZEPT</span>
        </span>
      )}
    </span>
  );
}
