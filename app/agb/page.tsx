import Link from 'next/link';

export const metadata = {
  title: 'AGB — Youman Automation',
  robots: { index: true, follow: true },
};

export default function AGBPage() {
  return (
    <main className="legal">
      <Link href="/" className="legal__back">← Zurück zur Startseite</Link>
      <h1>Allgemeine Geschäftsbedingungen (AGB)</h1>
      <p className="legal__notice">
        ⚠️ <strong>Entwurf.</strong> Diese AGB sind eine Grundlage für ein B2B-SaaS-Angebot und
        müssen vor dem Launch von einer Anwält:in (IT-/Wettbewerbsrecht) geprüft und an dein
        Unternehmen angepasst werden.
      </p>
      <p className="legal__updated">Stand: Juni 2026</p>

      <h2>§ 1 Geltungsbereich &amp; Vertragspartner</h2>
      <p>
        Diese AGB gelten für die Nutzung der SaaS-Anwendung „Youman Automation&ldquo; von [Firmenname]
        („Anbieter&ldquo;). Das Angebot richtet sich <strong>ausschließlich an Unternehmer</strong> im
        Sinne des § 14 BGB; Verbraucher sind von der Nutzung ausgeschlossen. Mit der Registrierung
        bestätigt der Kunde, als Unternehmer zu handeln.
      </p>

      <h2>§ 2 Leistungsbeschreibung</h2>
      <p>
        Youman Automation stellt KI-gestützte Vertriebsfunktionen bereit, u. a. die Recherche von
        Unternehmen, das Erstellen und den Versand von E-Mail-Anschreiben sowie KI-gestützte
        ausgehende Telefonanrufe mit Terminbuchung. Der konkrete Funktionsumfang richtet sich nach
        dem gewählten Tarif. Der Anbieter entwickelt die Leistung laufend weiter.
      </p>

      <h2>§ 3 Tarife, Preise &amp; Zahlung</h2>
      <p>
        Es gelten die zum Zeitpunkt der Buchung auf der Preisseite angegebenen Tarife und
        Nutzungskontingente. Die Abrechnung erfolgt im Voraus über den Zahlungsdienstleister
        Stripe. Preise verstehen sich zzgl. gesetzlicher Umsatzsteuer. Verbrauchte Kontingente
        werden zu Beginn jeder Abrechnungsperiode zurückgesetzt.
      </p>

      <h2>§ 4 Pflichten &amp; Verantwortung des Kunden</h2>
      <p>
        Der Kunde ist allein verantwortlich für die rechtmäßige Nutzung der Anwendung. Er sichert
        insbesondere zu:
      </p>
      <ul>
        <li>
          Telefon- und E-Mail-Werbung nur im Rahmen des <strong>§ 7 UWG</strong> durchzuführen,
          d. h. die erforderlichen Einwilligungen bzw. die mutmaßliche Einwilligung sicherzustellen.
        </li>
        <li>
          Gesprächsaufzeichnungen nur mit Einwilligung der angerufenen Person zu erstellen
          (§ 201 StGB).
        </li>
        <li>
          beim Einsatz der KI-Telefonie offenzulegen, dass es sich um eine KI handelt.
        </li>
        <li>
          die datenschutzrechtliche Verantwortung für eingestellte Lead-Daten zu tragen; hierfür
          wird ein separater AVV (Art. 28 DSGVO) geschlossen.
        </li>
      </ul>
      <p>
        Der Kunde stellt den Anbieter von Ansprüchen Dritter frei, die aus einer rechtswidrigen
        Nutzung der Anwendung durch den Kunden resultieren.
      </p>

      <h2>§ 5 Verfügbarkeit</h2>
      <p>
        Der Anbieter bemüht sich um eine hohe Verfügbarkeit, schuldet jedoch keine bestimmte
        Verfügbarkeit, soweit nicht gesondert vereinbart. Wartungsfenster und Störungen bei
        Drittanbietern (z. B. Telefonie, KI-Modelle) können die Nutzung vorübergehend einschränken.
      </p>

      <h2>§ 6 Haftung</h2>
      <p>
        Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie für Schäden
        aus der Verletzung des Lebens, des Körpers oder der Gesundheit. Bei einfacher
        Fahrlässigkeit haftet der Anbieter nur bei Verletzung wesentlicher Vertragspflichten
        (Kardinalpflichten) und begrenzt auf den vertragstypisch vorhersehbaren Schaden. Eine
        Haftung für die durch KI erzeugten Inhalte oder den Vertriebserfolg wird ausgeschlossen.
      </p>

      <h2>§ 7 Laufzeit &amp; Kündigung</h2>
      <p>
        Der Vertrag läuft auf die im Tarif angegebene Periode (z. B. monatlich) und verlängert
        sich automatisch, sofern er nicht zum Ende der jeweiligen Periode gekündigt wird. Die
        Kündigung ist jederzeit über das Kundenkonto (Stripe-Kundenportal) möglich.
      </p>

      <h2>§ 8 Änderungen der AGB</h2>
      <p>
        Der Anbieter kann diese AGB mit angemessener Vorankündigung ändern. Widerspricht der Kunde
        nicht innerhalb der mitgeteilten Frist, gelten die Änderungen als angenommen.
      </p>

      <h2>§ 9 Schlussbestimmungen</h2>
      <p>
        Es gilt deutsches Recht. Gerichtsstand ist – soweit zulässig – der Sitz des Anbieters.
        Sollte eine Bestimmung unwirksam sein, bleibt der übrige Vertrag wirksam.
      </p>
    </main>
  );
}
