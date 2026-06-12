import Link from 'next/link';

export const metadata = {
  title: 'Impressum — Youman Automation',
  robots: { index: true, follow: true },
};

export default function ImpressumPage() {
  return (
    <main className="legal">
      <Link href="/" className="legal__back">← Zurück zur Startseite</Link>
      <h1>Impressum</h1>
      <p className="legal__notice">
        ⚠️ <strong>Entwurf.</strong> Bitte alle <code>[Platzhalter]</code> mit den echten
        Unternehmensdaten ausfüllen und vor dem Launch rechtlich prüfen lassen.
      </p>

      <h2>Angaben gemäß § 5 DDG</h2>
      <dl>
        <dt>Unternehmen</dt>
        <dd>[Firmenname / Rechtsform, z. B. Youman Automation GmbH]</dd>
        <dt>Anschrift</dt>
        <dd>[Straße Nr.], [PLZ Ort]</dd>
        <dt>Vertreten durch</dt>
        <dd>[Vor- und Nachname der/des Geschäftsführer:in]</dd>
      </dl>

      <h2>Kontakt</h2>
      <dl>
        <dt>Telefon</dt>
        <dd>[Telefonnummer]</dd>
        <dt>E-Mail</dt>
        <dd><a href="mailto:[kontakt@youman-automation.com]">[kontakt@youman-automation.com]</a></dd>
      </dl>

      <h2>Registereintrag</h2>
      <dl>
        <dt>Registergericht</dt>
        <dd>[Amtsgericht …]</dd>
        <dt>Registernummer</dt>
        <dd>[HRB …]</dd>
      </dl>

      <h2>Umsatzsteuer-ID</h2>
      <p>
        Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:
        {' '}[DE…]
      </p>

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>[Vor- und Nachname], [Anschrift wie oben]</p>

      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Youman Automation richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB.
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </main>
  );
}
