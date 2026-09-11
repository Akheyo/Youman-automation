import { describe, it, expect } from 'vitest';
import { baueBericht, hatInhalt, type BerichtDaten, type BerichtKontakt } from '@/lib/outreach/tagesbericht';

const tim: BerichtKontakt = {
  vorname: 'Tim',
  nachname: 'Kaldeuer',
  firma: 'August Schmits GmbH',
  email: 'tim@asmetal.de',
  schritt: 1,
  zeitpunkt: '2026-09-11T08:15:00Z',
  anzahl: 3,
};
const markus: BerichtKontakt = { ...tim, vorname: 'Markus', nachname: 'Baier', firma: 'Baier Drehteile', email: 'm@baier.de', schritt: 2, anzahl: 1 };
const ohneNamen: BerichtKontakt = { ...tim, vorname: null, nachname: null, firma: null, email: 'info@firma.de', anzahl: undefined };

function daten(over: Partial<BerichtDaten> = {}): BerichtDaten {
  return {
    datum: new Date('2026-09-11T16:00:00Z'),
    empfaenger: 'mmk2005@web.de',
    kampagnen: [
      {
        name: 'Maschinenbau NRW',
        status: 'aktiv',
        gesendet: 12,
        fehler: 0,
        bounces: 1,
        offen: 300,
        geoeffnet: [tim, markus],
        geantwortet: [markus],
        abgemeldet: [],
      },
    ],
    kapazitaet: { erlaubt: 25, verbraucht: 12 },
    cockpitUrl: 'https://coldoutreach-sigma.vercel.app/outreach',
    ...over,
  };
}

describe('hatInhalt', () => {
  it('schweigt, wenn nichts passiert ist', () => {
    const leer = daten({ kampagnen: [{ name: 'x', status: 'aktiv', gesendet: 0, fehler: 0, bounces: 0, offen: 5, geoeffnet: [], geantwortet: [], abgemeldet: [] }] });
    expect(hatInhalt(leer)).toBe(false);
  });

  it('berichtet, sobald etwas gesendet, geoeffnet oder angehalten wurde', () => {
    expect(hatInhalt(daten())).toBe(true);
    const nurStopp = daten({ kampagnen: [{ name: 'x', status: 'pausiert', paused_reason: 'Zu viele Bounces', gesendet: 0, fehler: 0, bounces: 0, offen: 5, geoeffnet: [], geantwortet: [], abgemeldet: [] }] });
    expect(hatInhalt(nurStopp)).toBe(true);
  });
});

describe('baueBericht', () => {
  it('nennt im Betreff das Wichtigste: Antworten vor Oeffnungen vor Versand', () => {
    expect(baueBericht(daten()).subject).toBe('Paul: 1 Antwort heute');
    const nurOffen = daten({ kampagnen: [{ ...daten().kampagnen[0]!, geantwortet: [] }] });
    expect(baueBericht(nurOffen).subject).toBe('Paul: 2 Öffnungen, 12 gesendet');
    const nurVersand = daten({ kampagnen: [{ ...daten().kampagnen[0]!, geantwortet: [], geoeffnet: [] }] });
    expect(baueBericht(nurVersand).subject).toBe('Paul: 12 gesendet, noch keine Reaktion');
  });

  it('stellt einen ausgeloesten Schutzschalter ueber alles andere', () => {
    const d = daten({ kampagnen: [{ ...daten().kampagnen[0]!, status: 'pausiert', paused_reason: 'Zu viele unzustellbare Adressen (6 %).' }] });
    const b = baueBericht(d);
    expect(b.subject).toBe('Paul: Kampagne angehalten — Maschinenbau NRW');
    expect(b.text).toContain('wurde angehalten: Zu viele unzustellbare Adressen');
    expect(b.html).toContain('wurde angehalten');
  });

  it('listet namentlich, wer geoeffnet hat — mit Firma, Uhrzeit, Schritt und Zaehler', () => {
    const b = baueBericht(daten());
    expect(b.text).toContain('Geöffnet (2):');
    expect(b.text).toContain('Tim Kaldeuer (August Schmits GmbH) — 10:15 Uhr, Schritt 1, 3×');
    expect(b.text).toContain('Markus Baier (Baier Drehteile) — 10:15 Uhr, Schritt 2');
    // Einmal geoeffnet: kein Zaehler.
    expect(b.text).not.toContain('Schritt 2, 1×');
  });

  it('stellt Antworten vor die Oeffnungen — das ist der Teil, auf den man reagiert', () => {
    const b = baueBericht(daten());
    expect(b.text.indexOf('Geantwortet (1):')).toBeLessThan(b.text.indexOf('Geöffnet (2):'));
  });

  it('faellt bei Kontakten ohne Namen auf die Adresse zurueck', () => {
    const d = daten({ kampagnen: [{ ...daten().kampagnen[0]!, geoeffnet: [ohneNamen], geantwortet: [] }] });
    expect(baueBericht(d).text).toContain('info@firma.de — 10:15 Uhr, Schritt 1');
  });

  it('haengt Summen, Postfach-Kapazitaet und Cockpit-Link an', () => {
    const b = baueBericht(daten());
    expect(b.text).toContain('Gesendet 12 · Fehler 0 · Unzustellbar 1 · Noch offen 300');
    expect(b.text).toContain('Postfach heute: 12 von 25 erlaubten Mails');
    expect(b.text).toContain('Cockpit: https://coldoutreach-sigma.vercel.app/outreach');
    expect(b.html).toContain('href="https://coldoutreach-sigma.vercel.app/outreach"');
  });

  it('entschaerft HTML in Namen und Firmen', () => {
    const boese = { ...tim, firma: '<script>x</script> GmbH' };
    const d = daten({ kampagnen: [{ ...daten().kampagnen[0]!, geoeffnet: [boese], geantwortet: [] }] });
    const b = baueBericht(d);
    expect(b.html).not.toContain('<script>');
    expect(b.html).toContain('&lt;script&gt;');
  });

  it('kommt ohne Kapazitaet und ohne Cockpit-Link aus', () => {
    const b = baueBericht(daten({ kapazitaet: null, cockpitUrl: null }));
    expect(b.text).not.toContain('Postfach heute');
    expect(b.text).not.toContain('Cockpit:');
  });
});
