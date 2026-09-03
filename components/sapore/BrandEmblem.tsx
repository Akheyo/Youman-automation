'use client';

/**
 * Zeigt das Wappen des Betriebs aus `public/sapore/logo.webp`; fehlt die Datei,
 * springt die nachgebaute SVG-Fassung ein, damit die Seite nie ohne Marke
 * dasteht.
 *
 * WebP statt PNG: dasselbe Bild wiegt so rund 47 statt 535 KB. Das Wappen laedt
 * auf jeder Seite mit — bei Gaesten im Mobilfunknetz macht das den Unterschied,
 * und Ladezeit zaehlt bei Google mit.
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
        src="/sapore/logo.webp"
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
