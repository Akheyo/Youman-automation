'use client';

/**
 * Zeigt das Wappen des Betriebs. Liegt `public/sapore/logo.png` vor, wird die
 * echte Datei genommen; fehlt sie, springt die nachgebaute SVG-Fassung ein.
 * So traegt die Seite von Anfang an eine Marke und wird automatisch besser,
 * sobald die Originaldatei abgelegt ist.
 */

import { useEffect, useRef, useState } from 'react';
import { BrandMark } from './Icons';

export default function BrandEmblem({ className, alt }: { className?: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete) setOk(img.naturalWidth > 0);
  }, []);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src="/sapore/logo.png"
        alt={alt}
        className={className}
        loading="eager"
        decoding="async"
        onLoad={() => setOk(true)}
        onError={() => setOk(false)}
        style={{ display: ok ? 'block' : 'none' }}
      />
      {ok !== true ? <BrandMark className={className} /> : null}
    </>
  );
}
