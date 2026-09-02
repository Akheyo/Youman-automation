'use client';

/**
 * Bildplatz mit beschreibendem Platzhalter.
 *
 * Liegt unter `src` ein Bild, wird es gezeigt. Fehlt es, erscheint stattdessen
 * ein ruhiger Platzhalter, der benennt welches Motiv hier hingehoert und unter
 * welchem Pfad es abgelegt wird — so bleibt das Layout vollstaendig, solange die
 * echten Fotos des Betriebs fehlen.
 *
 * Der `complete`-Test nach dem Mounten faengt den Fall ab, dass das Bild schon
 * vor der Hydration mit 404 geantwortet hat und `onError` nie feuert.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './sapore.module.css';
import { IconCamera } from './Icons';

type Props = {
  src: string;
  /** Alternativtext — beschreibt das Motiv, nicht die Rolle im Layout. */
  alt: string;
  /** Welches Motiv hier hingehoert; steht im Platzhalter. */
  need: string;
  /** Empfohlenes Format, z. B. "Querformat, ca. 1600×1200 px". */
  hint?: string;
  ratio?: string;
  priority?: boolean;
  className?: string;
};

export default function Figure({
  src,
  alt,
  need,
  hint = 'JPG oder WebP, mindestens 1600 px breit',
  ratio = '4 / 3',
  priority = false,
  className = '',
}: Props) {
  const ref = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'fail'>('loading');

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete) setStatus(img.naturalWidth > 0 ? 'ok' : 'fail');
  }, []);

  return (
    <div className={`${styles.figure} ${className}`} style={{ aspectRatio: ratio }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={alt}
        className={styles.figureImg}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setStatus('ok')}
        onError={() => setStatus('fail')}
        style={{ display: status === 'ok' ? 'block' : 'none' }}
      />
      {status !== 'ok' ? (
        <div className={styles.figurePh} role="img" aria-label={alt}>
          <IconCamera className={styles.figurePhIcon} />
          <p className={styles.figurePhNeed}>{need}</p>
          <p className={styles.figurePhPath}>
            Ablegen unter <code>public{src}</code>
          </p>
          <p className={styles.figurePhHint}>{hint}</p>
        </div>
      ) : null}
    </div>
  );
}
