import Link from 'next/link';

export const metadata = {
  title: 'Datenschutzerklärung — A&B Solarenergy PV-Konfigurator',
};

export default function PrivacyPage() {
  return (
    <main className="legal">
      <Link href="/" className="legal__back">← Zurück zum Konfigurator</Link>
      <h1>Datenschutzerklärung — PV-Konfigurator</h1>
      <p>
        Stand: April 2026. Diese Erklärung gilt ausschließlich für den
        PV-Konfigurator. Für die Hauptwebsite gilt die Datenschutzerklärung von
        A&amp;B Solarenergy unter <a href="https://www.ab-solarenergy.de/datenschutz">ab-solarenergy.de/datenschutz</a>.
      </p>

      <h2>1. Verantwortlicher</h2>
      <p>A&amp;B Solarenergy, Borken (Nordrhein-Westfalen).</p>

      <h2>2. Erhobene Daten</h2>
      <ul>
        <li>Adresse, Geokoordinaten (lat/lng)</li>
        <li>Stromverbrauch (kWh/Jahr), Strompreis (ct/kWh)</li>
        <li>Add-on-Auswahl (Speicher, Wallbox, Wärmepumpe)</li>
        <li>Bei Lead-Anfrage: Name, Telefon, E-Mail, optionale Nachricht</li>
      </ul>

      <h2>3. Externe Dienste</h2>
      <ul>
        <li>
          <strong>Mapbox Geocoding</strong> (mapbox.com): Adress-Autocomplete. Übermittelt:
          Suchbegriffe.
        </li>
        <li>
          <strong>OpenStreetMap Overpass API</strong> (overpass-api.de et al.): Gebäude-Footprints.
          Übermittelt: lat/lng der Adresse.
        </li>
        <li>
          <strong>NRW LANUK Solarkataster</strong> (wfs.nrw.de): Dachsegmente. Übermittelt:
          lat/lng der Adresse.
        </li>
        <li>
          <strong>EU JRC PVGIS</strong> (re.jrc.ec.europa.eu): Ertragsberechnung. Übermittelt:
          lat/lng, kWp, Tilt, Azimuth.
        </li>
        <li>
          <strong>Cesium Ion</strong> (cesium.com): 3D-Terrain. Übermittelt: Bounding-Box-Anfragen.
        </li>
        <li>
          <strong>Cloudflare R2</strong> (cloudflarestorage.com): NRW LoD2 3D-Tiles. Übermittelt:
          Tile-Anfragen.
        </li>
      </ul>

      <h2>4. Lead-Verarbeitung</h2>
      <p>
        Beim Klick auf &bdquo;Persönliches Angebot anfordern&ldquo; werden Ihre Kontaktdaten zusammen mit
        der Konfiguration an A&amp;B Solarenergy übermittelt. Rechtsgrundlage: Art. 6 Abs. 1
        lit. a DSGVO (Einwilligung). Die Daten werden ausschließlich zur Bearbeitung Ihrer
        Anfrage verwendet. Speicherdauer bei Vertragsabschluss: gesetzliche
        Aufbewahrungspflichten (10&nbsp;Jahre). Bei Nicht-Zustandekommen: Löschung nach
        spätestens 12&nbsp;Monaten.
      </p>

      <h2>5. Ihre Rechte</h2>
      <p>
        Sie haben jederzeit Anspruch auf Auskunft, Berichtigung, Löschung, Einschränkung der
        Verarbeitung und Datenübertragbarkeit. Kontakt: <a href="mailto:datenschutz@ab-solarenergy.de">datenschutz@ab-solarenergy.de</a>.
      </p>

      <h2>6. Cookies / Tracking</h2>
      <p>
        Der Konfigurator setzt keine Tracking-Cookies. Es findet kein Profiling und keine
        Übermittlung an Analytics-Anbieter ohne explizite Einwilligung statt.
      </p>
    </main>
  );
}
