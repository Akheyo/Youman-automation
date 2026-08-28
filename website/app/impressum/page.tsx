import { PageHead } from '@/components/PageHead'
import { CtaBand } from '@/components/Sections'
import { pageMetadata } from '@/lib/seo'
import { site } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Impressum',
  description: `Impressum und Anbieterkennzeichnung nach § 5 DDG für ${site.fullName}.`,
  path: '/impressum',
})

/**
 * PLATZHALTER — vor dem Livegang ausfüllen.
 * Ein unvollständiges Impressum ist in Deutschland abmahnfähig (§ 5 DDG).
 */
const provider = {
  name: 'TODO: Vor- und Nachname',
  street: 'TODO: Straße und Hausnummer',
  city: 'TODO: PLZ und Ort',
  vatId: 'TODO: USt-IdNr. oder Hinweis auf Kleinunternehmerregelung (§ 19 UStG)',
}

export default function ImpressumPage() {
  return (
    <>
      <PageHead crumb="Impressum" eyebrow="Rechtliches" title="Impressum" />

      <section className="section">
        <div className="container container--narrow prose">
          <h2>Angaben gemäß § 5 DDG</h2>
          <p>
            {provider.name}
            <br />
            {site.legalName}
            <br />
            {provider.street}
            <br />
            {provider.city}
          </p>

          <h2>Kontakt</h2>
          <p>
            Telefon: <a href={`tel:${site.phoneHref}`}>{site.phone}</a>
            <br />
            E-Mail: <a href={`mailto:${site.email}`}>{site.email}</a>
          </p>

          <h2>Umsatzsteuer</h2>
          <p>{provider.vatId}</p>

          <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
          <p>
            {provider.name}
            <br />
            {provider.street}
            <br />
            {provider.city}
          </p>

          <h2>Streitschlichtung</h2>
          <p>
            Die Europäische Kommission stellt eine Plattform zur
            Online-Streitbeilegung bereit:{' '}
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noopener noreferrer"
            >
              ec.europa.eu/consumers/odr
            </a>
            . Ich bin nicht verpflichtet und nicht bereit, an
            Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
            teilzunehmen.
          </p>

          <h2>Haftung für Inhalte</h2>
          <p>
            Als Diensteanbieter bin ich gemäß § 7 Abs. 1 DDG für eigene Inhalte auf
            diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10
            DDG bin ich als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder
            gespeicherte fremde Informationen zu überwachen oder nach Umständen zu
            forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
          </p>

          <h2>Haftung für Links</h2>
          <p>
            Diese Website enthält Links zu externen Websites Dritter, auf deren Inhalte
            ich keinen Einfluss habe. Für die Inhalte der verlinkten Seiten ist stets der
            jeweilige Anbieter oder Betreiber verantwortlich. Bei Bekanntwerden von
            Rechtsverletzungen entferne ich derartige Links umgehend.
          </p>

          <h2>Urheberrecht</h2>
          <p>
            Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
            unterliegen dem deutschen Urheberrecht. Beiträge Dritter sind als solche
            gekennzeichnet.
          </p>
        </div>
      </section>
      <CtaBand />
    </>
  )
}
