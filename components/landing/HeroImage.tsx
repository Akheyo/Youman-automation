'use client';

import { useState } from 'react';
import styles from './landing.module.css';

/**
 * Hero photo with a graceful, on-brand fallback. If the external photo fails to
 * load, we show a glassy "Lina ruft an"-Karte über einem Verlauf — so the hero
 * never renders an empty/broken box.
 */
export default function HeroImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={styles.heroFallback} aria-hidden>
        <div className={styles.fbCall}>
          <div className={styles.fbAvatar}>📞</div>
          <div className={styles.fbName}>Lina ruft an…</div>
          <div className={styles.fbSub}>+49 · KI-Telefonassistent</div>
          <div className={styles.fbBooked}>✓ Termin gebucht – Di, 14:30 Uhr</div>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={styles.heroPhoto} loading="eager" onError={() => setFailed(true)} />
  );
}
