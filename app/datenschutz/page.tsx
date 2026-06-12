import Link from 'next/link';

export const metadata = {
  title: 'Datenschutzerklärung — Youman Automation',
  robots: { index: true, follow: true },
};

export default function DatenschutzPage() {
  return (
    <main className="legal">
      <Link href="/" className="legal__back">← Zurück zur Startseite</Link>
      <h1>Datenschutzerklärung</h1>
      <p className="legal__notice">
        ⚠️ <strong>Entwurf.</strong> Diese Erklärung listet die tatsächlich eingesetzten
        Dienste auf. Bitte <code>[Platzhalter]</code> ausfüllen und vor dem Launch von einer
        Datenschutz-Fachkraft / Anwält:in prüfen lassen — insbesondere die Abschnitte zur
        KI-Telefonie und zum Drittlandtransfer.
      </p>
      <p className="legal__updated">Stand: Juni 2026</p>

      <h2>1. Verantwortlicher</h2>
      <p>
        [Firmenname], [Straße Nr.], [PLZ Ort]. E-Mail:
        {' '}<a href="mailto:[datenschutz@youman-automation.com]">[datenschutz@youman-automation.com]</a>.
      </p>

      <h2>2. Überblick &amp; Rollen</h2>
      <p>
        Youman Automation ist eine SaaS-Anwendung für Unternehmen (B2B). Wir verarbeiten
        Daten in zwei Rollen:
      </p>
      <ul>
        <li>
          <strong>Als Verantwortliche</strong> für die Daten unserer Kund:innen
          (Account-, Vertrags- und Abrechnungsdaten).
        </li>
        <li>
          <strong>Als Auftragsverarbeiter</strong> für die Daten, die unsere Kund:innen in
          die Anwendung einstellen oder über sie verarbeiten (z. B. Kontaktdaten von Leads,
          Gesprächsmitschnitte). Hierfür schließen wir mit jeder Kundin / jedem Kunden einen
          Auftragsverarbeitungsvertrag (AVV) gem. Art. 28 DSGVO. Verantwortlich für diese
          Daten bleibt der jeweilige Kunde.
        </li>
      </ul>

      <h2>3. Verarbeitete Daten &amp; Zwecke</h2>
      <ul>
        <li><strong>Account/Login:</strong> Name, E-Mail-Adresse, Passwort (gehasht). Zweck: Bereitstellung des Nutzerkontos. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</li>
        <li><strong>Abrechnung:</strong> Plan, Zahlungs- und Rechnungsdaten (über Stripe). Rechtsgrundlage: Art. 6 Abs. 1 lit. b und lit. c DSGVO.</li>
        <li><strong>Nutzungsdaten:</strong> Anzahl Suchen, E-Mails, Anrufe (Limit-Verwaltung). Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</li>
        <li><strong>Lead-Daten (im Auftrag des Kunden):</strong> Firmen-/Kontaktdaten, Telefonnummern, E-Mail-Adressen, Notizen, Anruf-Transkripte und -Mitschnitte. Verantwortlich ist der Kunde.</li>
        <li><strong>Server-Logs:</strong> IP-Adresse, Zeitstempel, technische Daten zur Auslieferung und Sicherheit. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.</li>
      </ul>

      <h2>4. Eingesetzte Dienste / Auftragsverarbeiter</h2>
      <p>
        Mit den folgenden Anbietern bestehen Auftragsverarbeitungsverträge. Anbieter mit Sitz
        bzw. Datenverarbeitung in den USA stützen den Transfer auf die EU-Standardvertrags­klauseln
        (SCC) und ggf. das EU-US Data Privacy Framework.
      </p>
      <ul>
        <li><strong>Vercel Inc.</strong> (USA) — Hosting/Auslieferung der Anwendung (Region Frankfurt).</li>
        <li><strong>Supabase</strong> — Authentifizierung &amp; Datenbank (EU-Region).</li>
        <li><strong>Stripe</strong> (USA/Irland) — Zahlungsabwicklung &amp; Abo-Verwaltung.</li>
        <li><strong>OpenRouter / zugrunde liegende KI-Modelle</strong> (USA) — Sprachverarbeitung des Agenten „Felix&ldquo; (Firmensuche, Textentwürfe).</li>
        <li><strong>Vapi</strong> (USA) — KI-gestützte ausgehende Telefonie des Agenten „Lina&ldquo;; verarbeitet Telefonnummern, Sprachsignal und Transkripte.</li>
        <li><strong>Google (Google Ireland/LLC)</strong> — Google Places API (Firmensuche) und Google Calendar API (Terminbuchung, nur nach ausdrücklicher Verbindung durch den Kunden).</li>
        <li><strong>n8n</strong> — Workflow-Automatisierung für den Mailversand der Pitch-Mails.</li>
        <li><strong>[E-Mail-Versanddienst, z. B. eigener SMTP/Resend]</strong> — Versand transaktionaler E-Mails.</li>
      </ul>

      <h2>5. KI-Telefonie &amp; Gesprächsmitschnitte</h2>
      <p>
        Der Agent „Lina&ldquo; führt im Auftrag des Kunden ausgehende Telefonanrufe. Zu Beginn jedes
        Anrufs wird darauf hingewiesen, dass es sich um eine <strong>KI</strong> handelt und
        ob das Gespräch <strong>aufgezeichnet</strong> wird. Eine Aufzeichnung erfolgt nur mit
        Einwilligung der angerufenen Person (§ 201 StGB, Art. 6 Abs. 1 lit. a DSGVO). Die
        Verantwortung für die Zulässigkeit der Kontaktaufnahme (insb. § 7 UWG) trägt der Kunde
        als Verantwortlicher.
      </p>

      <h2>6. Speicherdauer</h2>
      <p>
        Account- und Vertragsdaten werden für die Dauer des Vertrags und anschließend im Rahmen
        gesetzlicher Aufbewahrungsfristen (handels-/steuerrechtlich bis zu 10 Jahre) gespeichert.
        Im Auftrag verarbeitete Lead-Daten werden gemäß den Weisungen des Kunden bzw. dem AVV
        gelöscht.
      </p>

      <h2>7. Ihre Rechte</h2>
      <p>
        Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
        Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) sowie
        das Recht auf Beschwerde bei einer Aufsichtsbehörde. Kontakt:
        {' '}<a href="mailto:[datenschutz@youman-automation.com]">[datenschutz@youman-automation.com]</a>.
      </p>

      <h2>8. Cookies / Tracking</h2>
      <p>
        Wir setzen nur technisch notwendige Cookies (z. B. Login-Session). Nicht notwendige
        Cookies oder Analyse-Dienste werden erst nach Ihrer Einwilligung gesetzt.
      </p>
    </main>
  );
}
