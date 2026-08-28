import { PageHead } from '@/components/PageHead'
import { pageMetadata } from '@/lib/seo'
import { site } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Datenschutzerklärung',
  description: `Informationen zur Verarbeitung personenbezogener Daten auf ${site.url} nach Art. 13 DSGVO.`,
  path: '/datenschutz',
})

/** PLATZHALTER — vor dem Livegang durch die echten Angaben ersetzen. */
const controller = {
  name: 'TODO: Vor- und Nachname',
  street: 'TODO: Straße und Hausnummer',
  city: 'TODO: PLZ und Ort',
  host: 'TODO: Hosting-Anbieter samt Anschrift (z. B. Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA)',
}

export default function DatenschutzPage() {
  return (
    <>
      <PageHead
        crumb="Datenschutz"
        eyebrow="Rechtliches"
        title="Datenschutzerklärung"
        lead="Diese Website kommt ohne Tracking, ohne Werbe-Cookies und ohne Analyse-Dienste aus."
      />

      <section className="section">
        <div className="container container--narrow prose">
          <h2>1. Verantwortliche Stelle</h2>
          <p>
            {controller.name}
            <br />
            {site.legalName}
            <br />
            {controller.street}
            <br />
            {controller.city}
            <br />
            E-Mail: <a href={`mailto:${site.email}`}>{site.email}</a>
          </p>

          <h2>2. Grundsatz</h2>
          <p>
            Diese Website setzt keine Cookies, bindet keine externen Schriftarten oder
            Skripte von Drittanbietern ein und nutzt keine Analyse- oder
            Tracking-Dienste. Schriften werden mit der Seite ausgeliefert, es findet
            keine Verbindung zu Google Fonts statt.
          </p>

          <h2>3. Server-Logfiles</h2>
          <p>
            Beim Aufruf der Website werden durch den Hosting-Anbieter automatisch
            Informationen erfasst, die dein Browser übermittelt: Browsertyp und -version,
            verwendetes Betriebssystem, Referrer-URL, Uhrzeit der Anfrage und die
            IP-Adresse in gekürzter Form. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
            — das berechtigte Interesse am technisch fehlerfreien Betrieb der Website.
            Diese Daten werden nicht mit anderen Datenquellen zusammengeführt.
          </p>

          <h2>4. Hosting</h2>
          <p>{controller.host}</p>
          <p>
            Mit dem Anbieter besteht ein Vertrag über die Auftragsverarbeitung nach
            Art. 28 DSGVO.
          </p>

          <h2>5. Kontaktaufnahme</h2>
          <p>
            Das Kontaktformular auf dieser Website überträgt keine Daten an einen Server.
            Es öffnet lediglich eine vorbereitete Nachricht in deinem eigenen
            E-Mail-Programm. Erst mit dem Absenden dieser E-Mail erhalte ich deine
            Angaben.
          </p>
          <p>
            Wenn du mich per E-Mail, Telefon oder WhatsApp kontaktierst, verarbeite ich
            deine Angaben zur Bearbeitung der Anfrage. Rechtsgrundlage ist Art. 6 Abs. 1
            lit. b DSGVO bei vorvertraglichen Maßnahmen, sonst Art. 6 Abs. 1 lit. f
            DSGVO. Die Daten werden gelöscht, sobald sie für den Zweck nicht mehr
            erforderlich sind und keine gesetzlichen Aufbewahrungsfristen entgegenstehen.
          </p>

          <h2>6. WhatsApp</h2>
          <p>
            Der WhatsApp-Link führt zu einem Dienst der WhatsApp Ireland Limited. Erst
            wenn du den Link anklickst, entsteht eine Verbindung zu deren Servern. Es
            gelten die Datenschutzbestimmungen von WhatsApp. Wenn du das vermeiden
            möchtest, nutze stattdessen E-Mail oder Telefon.
          </p>

          <h2>7. Deine Rechte</h2>
          <ul>
            <li>Auskunft über die verarbeiteten Daten (Art. 15 DSGVO)</li>
            <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
            <li>Löschung (Art. 17 DSGVO)</li>
            <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
            <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
          </ul>
          <p>
            Für die Ausübung genügt eine formlose Nachricht an{' '}
            <a href={`mailto:${site.email}`}>{site.email}</a>. Unabhängig davon steht dir
            ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde zu (Art. 77
            DSGVO).
          </p>

          <h2>8. SSL-/TLS-Verschlüsselung</h2>
          <p>
            Diese Seite nutzt aus Sicherheitsgründen eine TLS-Verschlüsselung. Eine
            verschlüsselte Verbindung erkennst du am <code>https://</code> in der
            Adresszeile deines Browsers.
          </p>

          <h2>9. Aktualität</h2>
          <p>
            Diese Datenschutzerklärung wird angepasst, sobald sich die Verarbeitung auf
            dieser Website ändert — etwa bei Einführung eines serverseitigen
            Kontaktformulars.
          </p>
        </div>
      </section>
    </>
  )
}
