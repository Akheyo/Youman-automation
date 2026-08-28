import Image from 'next/image'
import { bilder, type Bild, type BildKey } from '@/lib/bilder'

type Props = {
  bild: BildKey
  /** Randlos über die volle Breite, etwa im Hero. */
  priority?: boolean
  className?: string
  /** sizes für next/image — bestimmt, welche Auflösung geladen wird. */
  sizes?: string
  /**
   * Füllt den umgebenden Rahmen, statt ein eigenes Seitenverhältnis zu
   * erzwingen. Nötig überall dort, wo die Höhe vom Layout kommt — sonst
   * rechnet das Seitenverhältnis auf schmalen Displays eine Breite aus,
   * die über den Bildschirm hinausragt.
   */
  fuellt?: boolean
}

/**
 * Eine Bildstelle. Liegt eine Datei vor, wird sie ausgeliefert; sonst erscheint
 * ein markierter Platzhalter, der Motiv, Seitenverhältnis und empfohlene Breite
 * nennt.
 *
 * In beiden Fällen reserviert der Rahmen das Seitenverhältnis, damit beim
 * Nachrüsten echter Bilder nichts springt.
 */
export function Figure({ bild, priority, className, sizes = '100vw', fuellt }: Props) {
  // `satisfies` im Register behält die engen Literaltypen; die Annotation
  // hier weitet sie auf Bild, damit das optionale `datei` sichtbar ist.
  const eintrag: Bild = bilder[bild]
  const stil = fuellt
    ? { position: 'absolute' as const, inset: 0 }
    : { aspectRatio: eintrag.verhaeltnis.replace('/', ' / ') }

  if (eintrag.datei) {
    return (
      <div className={['figure', className].filter(Boolean).join(' ')} style={stil}>
        <Image
          src={eintrag.datei}
          alt={eintrag.alt}
          fill
          sizes={sizes}
          priority={priority}
          style={{ objectFit: 'cover' }}
        />
      </div>
    )
  }

  return (
    <div
      className={['figure', 'figure--leer', className].filter(Boolean).join(' ')}
      style={stil}
      role="img"
      aria-label={`Platzhalter für ein Bild: ${eintrag.alt}`}
    >
      <div className="figure__hinweis" aria-hidden="true">
        <span className="figure__marke">Bild fehlt</span>
        <p className="figure__motiv">{eintrag.motiv}</p>
        <p className="figure__masse">
          {eintrag.verhaeltnis.replace('/', ':')} · ab {eintrag.breite} px breit · WebP
        </p>
      </div>
    </div>
  )
}
