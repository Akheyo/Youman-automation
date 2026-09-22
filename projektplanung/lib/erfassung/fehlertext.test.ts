import { describe, expect, it } from 'vitest';
import { fehlerZeile, lesbarerFehler } from './fehlertext';

const GUTHABEN =
  '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low ' +
  'to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."},' +
  '"request_id":"req_011CfJfBMbPGxMeyT3GKZtg2"}';

describe('lesbarerFehler', () => {
  it('macht aus dem JSON-Brocken einen Satz', () => {
    const f = lesbarerFehler(GUTHABEN);
    expect(f.text).toBe('Das Guthaben des Anthropic-Kontos ist aufgebraucht.');
    expect(f.abhilfe).toContain('Plans & Billing');
    expect(f.text).not.toContain('{');
  });

  it('sagt, wenn erneutes Versuchen nichts bringt', () => {
    // Ohne Guthaben hilft kein zweiter Anlauf — der Knopf waere eine Luege.
    expect(lesbarerFehler(GUTHABEN).nochmalSinnvoll).toBe(false);
  });

  it('erkennt einen abgelehnten Schluessel', () => {
    const f = lesbarerFehler('401 {"error":{"type":"authentication_error"}}');
    expect(f.text).toContain('Schlüssel');
    expect(f.nochmalSinnvoll).toBe(false);
  });

  it('erkennt die Bremse und empfiehlt Geduld', () => {
    const f = lesbarerFehler('HTTP 429 rate_limit_error');
    expect(f.nochmalSinnvoll).toBe(true);
    expect(f.abhilfe).toBeNull();
  });

  it('erkennt eine Ueberlastung', () => {
    expect(lesbarerFehler('529 overloaded_error').text).toContain('überlastet');
  });

  it('erkennt einen Abbruch wegen Zeit', () => {
    expect(lesbarerFehler('Request timed out').text).toContain('zu lange');
    expect(lesbarerFehler('Plenty GET /rest/x → HTTP 504').text).toContain('Zeitgrenze');
  });

  it('erkennt den fehlenden Schluessel', () => {
    expect(lesbarerFehler('ANTHROPIC_API_KEY fehlt — ohne ihn gibt es keine Preisrecherche.').abhilfe).toContain(
      'Vercel',
    );
  });

  it('laesst Unbekanntes unveraendert stehen', () => {
    // Ein aufgehuebschter Platzhalter waere schlimmer: Dann steht da etwas
    // Freundliches und niemand kommt weiter.
    const f = lesbarerFehler('Plenty POST /rest/items → HTTP 422: unit missing');
    expect(f.text).toContain('unit missing');
    expect(f.abhilfe).toBeNull();
  });

  it('kuerzt einen sehr langen Urtext', () => {
    expect(lesbarerFehler('x'.repeat(900)).text.length).toBeLessThanOrEqual(301);
  });

  it('kommt mit gar keiner Meldung zurecht', () => {
    expect(lesbarerFehler(null).text).toBe('Unbekannter Fehler.');
    expect(lesbarerFehler('   ').text).toBe('Unbekannter Fehler.');
  });
});

describe('fehlerZeile', () => {
  it('haengt die Abhilfe an', () => {
    expect(fehlerZeile(GUTHABEN)).toContain('aufgebraucht');
    expect(fehlerZeile(GUTHABEN)).toContain('console.anthropic.com');
  });

  it('bleibt ohne Abhilfe bei einem Satz', () => {
    expect(fehlerZeile('529 overloaded_error')).toBe('Anthropic ist gerade überlastet.');
  });
});
