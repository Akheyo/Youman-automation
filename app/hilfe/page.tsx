import Link from 'next/link';

export const metadata = {
  title: 'Hilfe & FAQ — Youman Automation',
  robots: { index: true, follow: true },
};

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Was macht Youman Automation?',
    a: (
      <>
        Youman ist dein KI-Vertriebsteam: <strong>Felix</strong> findet passende Firmen und schreibt Pitch-Mails,{' '}
        <strong>Lina</strong> ruft Leads per KI-Telefonie an, qualifiziert sie und bucht Termine direkt in deinen Kalender —
        inklusive automatischer Follow-ups.
      </>
    ),
  },
  {
    q: 'Ist KI-Telefonakquise in Deutschland erlaubt?',
    a: (
      <>
        B2B-Telefonakquise ist unter den Bedingungen des § 7 UWG zulässig (mutmaßliche Einwilligung / sachlicher Anlass).
        Lina gibt sich am Gesprächsanfang als KI zu erkennen (EU&nbsp;AI&nbsp;Act), übermittelt die echte Rufnummer und führt pro
        Lead einen dokumentierten „Anlass&ldquo;. Die rechtliche Verantwortung für die Kontaktaufnahme liegt beim Kunden — Details in
        den <Link href="/agb">AGB</Link>.
      </>
    ),
  },
  {
    q: 'Werden Gespräche aufgezeichnet?',
    a: (
      <>
        Nur wenn du es aktivierst. Bei aktiver Aufzeichnung weist Lina zu Beginn darauf hin (§&nbsp;201&nbsp;StGB). Du kannst die
        Aufzeichnung jederzeit ausschalten — dann wird nur ein Transkript erstellt.
      </>
    ),
  },
  {
    q: 'Woher kommen die Leads?',
    a: (
      <>
        Du bringst sie mit (manuell, CSV-Import oder Webhook) — oder lässt sie von Felix finden. Felix recherchiert echte Firmen
        und übergibt sie mit einem Klick an Lina.
      </>
    ),
  },
  {
    q: 'Wie sicher sind meine Daten?',
    a: (
      <>
        Hosting & Datenbank laufen in der EU, Zugriffe sind pro Konto streng getrennt. Welche Dienstleister wir einsetzen, steht
        transparent in der <Link href="/datenschutz">Datenschutzerklärung</Link>. Für deine Lead-Daten stellen wir einen AVV
        (Auftragsverarbeitung) bereit.
      </>
    ),
  },
  {
    q: 'Was kostet Youman Automation?',
    a: (
      <>
        Die aktuellen Tarife findest du auf der <Link href="/pricing">Preis-Seite</Link>. Abgerechnet wird monatlich über Stripe,
        jederzeit im Kundenkonto kündbar.
      </>
    ),
  },
  {
    q: 'Wie kündige ich?',
    a: <>Jederzeit selbst über das Stripe-Kundenportal in deinen <Link href="/einstellungen">Einstellungen → Abrechnung</Link>.</>,
  },
];

export default function HilfePage() {
  return (
    <main className="legal">
      <Link href="/" className="legal__back">← Zurück zur Startseite</Link>
      <h1>Hilfe &amp; häufige Fragen</h1>
      <p className="legal__lead">
        Kurze Antworten auf die wichtigsten Fragen. Nichts dabei? Schreib uns —{' '}
        <a href="mailto:infoall4youstore@gmail.com">infoall4youstore@gmail.com</a>.
      </p>

      {FAQ.map((item) => (
        <section key={item.q}>
          <h2>{item.q}</h2>
          <p>{item.a}</p>
        </section>
      ))}

      <h2>Kontakt &amp; Support</h2>
      <p>
        Fragen, Feedback oder ein Problem? Wir helfen gern:{' '}
        <a href="mailto:infoall4youstore@gmail.com">infoall4youstore@gmail.com</a>. Wir antworten in der Regel innerhalb von
        24&nbsp;Stunden (werktags).
      </p>
    </main>
  );
}
