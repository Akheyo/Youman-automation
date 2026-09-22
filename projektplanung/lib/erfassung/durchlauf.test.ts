import { describe, expect, it } from 'vitest';
import { darfWeiterlaufen, erledigt, fehlgeschlagen, fortschritt, naechsterSchritt } from './durchlauf';

const Z = '2026-09-22T10:00:00Z';

describe('naechsterSchritt', () => {
  it('beginnt beim Erkennen', () => {
    expect(naechsterSchritt({})).toBe('erkennen');
  });

  it('geht der Reihe nach weiter', () => {
    expect(naechsterSchritt({ erkannt_am: Z })).toBe('preis');
    expect(naechsterSchritt({ erkannt_am: Z, preis_am: Z })).toBe('listing');
    expect(naechsterSchritt({ erkannt_am: Z, preis_am: Z, listing_am: Z })).toBe('plenty');
  });

  it('meldet fertig, wenn alles steht', () => {
    expect(naechsterSchritt({ erkannt_am: Z, preis_am: Z, listing_am: Z, plenty_am: Z })).toBe('fertig');
  });

  it('ueberspringt einen fehlgeschlagenen Schritt nicht', () => {
    // Ohne Preis kein Listing — sonst stuende der Artikel fuer 0,00 Euro im Shop.
    expect(naechsterSchritt({ erkannt_am: Z, preis_fehler: 'nichts gefunden' })).toBe('preis');
  });

  it('laesst einen Fehler den Schritt nicht blockieren, wenn er trotzdem lief', () => {
    expect(naechsterSchritt({ erkannt_am: Z, preis_am: Z, preis_fehler: 'nur zwei Angebote' })).toBe('listing');
  });
});

describe('erledigt und fehlgeschlagen', () => {
  it('unterscheidet erledigt von fehlgeschlagen', () => {
    expect(erledigt({ preis_am: Z }, 'preis')).toBe(true);
    expect(fehlgeschlagen({ preis_am: Z }, 'preis')).toBe(false);
    expect(fehlgeschlagen({ preis_fehler: 'x' }, 'preis')).toBe(true);
  });
});

describe('fortschritt', () => {
  it('zaehlt die erledigten Schritte', () => {
    expect(fortschritt({ erkannt_am: Z, preis_am: Z }).erledigteSchritte).toBe(2);
  });

  it('nennt den Grund, wenn es haengt', () => {
    // „haengt" ohne Grund war schon einmal die Rueckmeldung an jemanden,
    // der vor dem Regal stand.
    const f = fortschritt({ erkannt_am: Z, preis_fehler: 'Keine Vergleichsangebote gefunden.' });
    expect(f.text).toContain('Keine Vergleichsangebote gefunden.');
    expect(f.fehler).toBe('Keine Vergleichsangebote gefunden.');
  });

  it('zaehlt den laufenden Schritt mit', () => {
    expect(fortschritt({ erkannt_am: Z }).text).toContain('(2/4)');
  });

  it('meldet fertig ohne Fehler', () => {
    const f = fortschritt({ erkannt_am: Z, preis_am: Z, listing_am: Z, plenty_am: Z });
    expect(f.fertig).toBe(true);
    expect(f.fehler).toBeNull();
    expect(f.text).toContain('fertig');
  });
});

describe('darfWeiterlaufen', () => {
  it('haelt nach drei erfolglosen Anlaeufen an', () => {
    expect(darfWeiterlaufen(0)).toBe(true);
    expect(darfWeiterlaufen(2)).toBe(true);
    expect(darfWeiterlaufen(3)).toBe(false);
  });

  it('behandelt fehlende Angabe als null Versuche', () => {
    expect(darfWeiterlaufen(null)).toBe(true);
  });
});
