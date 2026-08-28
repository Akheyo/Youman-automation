import Link from 'next/link'
import { Figure } from './Figure'
import { Reveal } from './Reveal'
import type { BildKey } from '@/lib/bilder'

/* ============================================================
   Vier wiederkehrende Sektionsmuster.
   ============================================================ */

/**
 * Einleitungsband: Label, große Überschrift links, Blocksatz rechts,
 * darunter eine Linie und eine Reihe von Sprungmarken.
 */
export function IntroBand({
  label,
  titel,
  text,
  links,
}: {
  label: string
  titel: string
  text: string
  links: { href: string; label: string }[]
}) {
  return (
    <section className="intro-band" aria-labelledby="intro-band-title">
      <div className="container">
        <Reveal className="intro-band__kopf">
          <p className="label">{label}</p>
          <div className="intro-band__satz">
            <h2 className="intro-band__titel" id="intro-band-title">
              {titel}
            </h2>
            <p className="intro-band__text">{text}</p>
          </div>
        </Reveal>

        <Reveal index={1}>
          <ul className="intro-band__links">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="intro-band__link">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

/**
 * Überschrift links, nummeriertes Raster rechts. Die Zellen teilen sich
 * Haarlinien, damit das Raster als Fläche und nicht als Kartenstapel liest.
 */
export function SplitRaster({
  label,
  titel,
  aktion,
  eintraege,
}: {
  label: string
  titel: string
  aktion?: { href: string; label: string }
  eintraege: { nummer: string; titel: string; text: string; href?: string }[]
}) {
  return (
    <section className="split-raster" aria-labelledby="split-raster-title">
      <div className="container split-raster__inner">
        <Reveal>
          <p className="label">{label}</p>
          <h2 className="split-raster__titel" id="split-raster-title">
            {titel}
          </h2>
          {aktion ? (
            <Link href={aktion.href} className="btn-linie">
              {aktion.label}
            </Link>
          ) : null}
        </Reveal>

        <Reveal index={1} as="ul" className="raster">
          {eintraege.map((e) => (
            <li className="raster__zelle" key={e.nummer}>
              <span className="raster__nummer">{e.nummer}</span>
              <h3 className="raster__titel">
                {e.href ? (
                  <Link href={e.href} className="raster__link">
                    {e.titel}
                  </Link>
                ) : (
                  e.titel
                )}
              </h3>
              <p className="raster__text">{e.text}</p>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

/**
 * Bildband über die volle Breite, abgedunkelt, mit Text darüber.
 */
export function AussageBand({
  bild,
  zeilen,
  text,
}: {
  bild: BildKey
  /** Jede Zeile steht als eigener Satz — der Umbruch ist Teil der Aussage. */
  zeilen: string[]
  text: string
}) {
  return (
    <section className="aussage" aria-labelledby="aussage-title">
      <div className="aussage__bild">
        <Figure bild={bild} sizes="100vw" fuellt />
      </div>

      <div className="container aussage__inhalt">
        <Reveal>
          <h2 className="aussage__titel" id="aussage-title">
            {zeilen.map((z) => (
              <span key={z}>{z}</span>
            ))}
          </h2>
          <p className="aussage__text">{text}</p>
        </Reveal>
      </div>
    </section>
  )
}

/**
 * Liste von Bereichen mit Pfeil. Beim Überfahren tritt der Eintrag mit
 * kräftigem Rahmen und hartem Versatzschatten aus der Fläche heraus.
 */
export function BereichsListe({
  label,
  eintraege,
  titel,
}: {
  label: string
  titel?: string
  eintraege: { href: string; label: string }[]
}) {
  return (
    <section className="bereiche" aria-labelledby="bereiche-title">
      <div className="container">
        <Reveal>
          <p className="label" id="bereiche-title">
            {titel ?? label}
          </p>
        </Reveal>

        <Reveal index={1} as="ul" className="bereiche__liste">
          {eintraege.map((e) => (
            <li className="bereiche__zelle" key={e.href}>
              <Link href={e.href} className="bereiche__link">
                <span>{e.label}</span>
                <svg
                  className="bereiche__pfeil"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </Link>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
