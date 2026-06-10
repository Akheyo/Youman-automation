'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './landing.module.css';

/**
 * Image slot with a descriptive placeholder. Shows the photo at `src` if it
 * loads; otherwise a branded placeholder explains exactly which photo belongs
 * here and under which path to save it. Uses a mount check so a missing image
 * that 404s before hydration still shows the placeholder reliably.
 */
export default function HeroImage({ src, alt, need }: { src: string; alt: string; need?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'fail'>('loading');
  const local = src.startsWith('/');

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete) setStatus(img.naturalWidth > 0 ? 'ok' : 'fail');
  }, []);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={alt}
        className={styles.heroPhoto}
        loading="eager"
        onLoad={() => setStatus('ok')}
        onError={() => setStatus('fail')}
        style={{ display: status === 'ok' ? 'block' : 'none' }}
      />
      {status !== 'ok' && (
        <div className={styles.phBox} role="img" aria-label={alt}>
          <div className={styles.phCamera}>📷</div>
          <div className={styles.phTitle}>Bild hier einsetzen</div>
          {need && <div className={styles.phNeed}>{need}</div>}
          {local && (
            <div className={styles.phPath}>
              Datei ablegen unter: <code>public{src}</code>
            </div>
          )}
          <div className={styles.phHint}>Querformat, ca. 1100×900 px, JPG/PNG</div>
        </div>
      )}
    </>
  );
}
