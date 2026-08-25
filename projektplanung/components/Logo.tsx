'use client';

import { useState } from 'react';
import styles from './logo.module.css';

/**
 * Komplett-Konzept-Logo.
 *
 * Bevorzugt die echte Bilddatei `public/logo.png` (einfach dort hochladen).
 * Fehlt sie, wird automatisch der Vektor-Nachbau in den Markenfarben angezeigt
 * (Gold-Dreieck + roter Marken-Ball + „KOMPLETT KONZEPT"-Schriftzug).
 */
export default function Logo({
  size = 'md',
  wordmark = true,
}: {
  size?: 'sm' | 'md' | 'lg';
  wordmark?: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);

  if (imgOk) {
    return (
      <span className={`${styles.logo} ${styles[size]}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Komplett Konzept"
          className={styles.img}
          onError={() => setImgOk(false)}
        />
      </span>
    );
  }

  // Fallback: Vektor-Nachbau
  return (
    <span className={`${styles.logo} ${styles[size]}`}>
      <svg className={styles.mark} viewBox="0 0 48 44" aria-hidden focusable="false">
        <polygon
          points="24,3 45,41 3,41"
          fill="#F2C200"
          stroke="#122A63"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
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
