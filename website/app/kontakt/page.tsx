import { ContactForm } from '@/components/ContactForm'
import { Figure } from '@/components/Figure'
import { Icon } from '@/components/Icon'
import { PageHead } from '@/components/PageHead'
import { Reveal } from '@/components/Reveal'
import { JsonLd, breadcrumbJsonLd, pageMetadata } from '@/lib/seo'
import { site } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Kontakt',
  description: `Anfrage für KI-Automation, Chatbot, Website oder E-Commerce-Integration. Antwort innerhalb von ${site.responseTime}, Erstgespräch kostenlos.`,
  path: '/kontakt',
})

export default function KontaktPage() {
  return (
    <>
      <PageHead
        crumb="Kontakt"
        eyebrow="Kontakt"
        title="Sprechen wir über Ihr Vorhaben"
        lead={`Beschreiben Sie Ihr Vorhaben in ein paar Sätzen. Sie bekommen innerhalb von ${site.responseTime} eine konkrete Einschätzung — kostenlos und unverbindlich.`}
      />

      <section className="section">
        <div className="container">
          <div className="split">
            <Reveal>
              <h2 className="section-title" style={{ fontSize: 'var(--t-xl)' }}>
                Direkter Draht
              </h2>
              <p className="lead" style={{ marginTop: 'var(--s-4)' }}>
                Wenn Ihnen ein Anruf oder eine kurze Nachricht lieber ist als ein Formular
                — auch gut.
              </p>

              <ul className="contact-list">
                <li className="contact-item">
                  <Icon name="mail" size={18} />
                  <div>
                    <p className="contact-item__label">E-Mail</p>
                    <a href={`mailto:${site.email}`} className="contact-item__value">
                      {site.email}
                    </a>
                  </div>
                </li>
                <li className="contact-item">
                  <Icon name="phone" size={18} />
                  <div>
                    <p className="contact-item__label">Telefon &amp; WhatsApp</p>
                    <a href={`tel:${site.phoneHref}`} className="contact-item__value">
                      {site.phone}
                    </a>
                  </div>
                </li>
                <li className="contact-item">
                  <Icon name="clock" size={18} />
                  <div>
                    <p className="contact-item__label">Antwortzeit</p>
                    <p className="contact-item__value">
                      Innerhalb von {site.responseTime}
                    </p>
                  </div>
                </li>
                <li className="contact-item">
                  <Icon name="pin" size={18} />
                  <div>
                    <p className="contact-item__label">Standort</p>
                    <p className="contact-item__value">{site.location}</p>
                  </div>
                </li>
              </ul>

              <p style={{ marginTop: 'var(--s-6)' }}>
                <a
                  href={site.whatsapp}
                  className="btn btn--ghost"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Auf WhatsApp schreiben
                  <Icon name="arrow" size={16} />
                </a>
              </p>

              <div style={{ marginTop: 'var(--s-7)' }}>
                <Figure bild="kontakt" sizes="(min-width: 940px) 40vw, 100vw" />
              </div>
            </Reveal>

            <Reveal index={1}>
              <h2 className="section-title" style={{ fontSize: 'var(--t-xl)' }}>
                Anfrage senden
              </h2>
              <p className="lead" style={{ marginTop: 'var(--s-4)', marginBottom: 'var(--s-6)' }}>
                Je konkreter Sie beschreiben, was heute manuell läuft, desto genauer wird
                meine Antwort.
              </p>
              <ContactForm />
            </Reveal>
          </div>
        </div>
      </section>

      <JsonLd data={breadcrumbJsonLd([{ name: 'Kontakt', path: '/kontakt' }])} />
    </>
  )
}
