import Link from 'next/link'
import { HeroAnimation } from './HeroAnimation'
import { HeroVideo } from './HeroVideo'
import { Icon } from './Icon'
import { Logo } from './Logo'
import { videoQuellen } from '@/lib/dateien'

/**
 * Hero über die volle Breite: Video im Hintergrund, darüber mittig die
 * Wortmarke, ein Satz zur Einordnung und ein Knopf.
 *
 * Der Satz ist die h1 — nicht die Wortmarke. Eine Überschrift, die nur den
 * Firmennamen wiederholt, sagt weder Suchmaschinen noch Besuchern, worum es
 * geht.
 */
export function HeroVoll({
  satz,
  knopf = { href: '/kontakt', label: 'Kontakt aufnehmen' },
}: {
  satz: string
  knopf?: { href: string; label: string }
}) {
  return (
    <section className="hero-voll" aria-labelledby="hero-title">
      <div className="hero-voll__medium">
        {/* Liegt eine Videodatei vor, hat sie Vorrang. Sonst zeichnet der
            Code die Bewegung selbst — das ist besser als ein leerer Kasten
            und kostet ein paar Kilobyte statt mehrerer Megabyte. */}
        <HeroVideo
          video="hero"
          quellen={videoQuellen('hero')}
          ersatzbild={<HeroAnimation />}
          fuellt
        />
      </div>

      <div className="container hero-voll__inhalt">
        <Logo size="lg" className="hero-voll__marke" />

        <h1 className="hero-voll__satz" id="hero-title">
          {satz}
        </h1>

        <Link href={knopf.href} className="btn btn--invert hero-voll__knopf">
          {knopf.label}
          <Icon name="arrow" size={16} />
        </Link>
      </div>
    </section>
  )
}
