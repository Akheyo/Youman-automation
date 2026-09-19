import { describe, expect, it } from 'vitest';
import {
  PFLICHTSATZ_KUGELLAGER,
  darfVeroeffentlichen,
  istLappArtikel,
  pruefeListing,
  type ListingEntwurf,
} from './markenregeln';

function entwurf(teil: Partial<ListingEntwurf> = {}): ListingEntwurf {
  return {
    hersteller: 'Bosch',
    titel1: 'Bosch GSR 18V-55 Akkuschrauber',
    beschreibung: 'Gebrauchter Akkuschrauber in gutem Zustand.',
    zustand: 'gebraucht',
    ...teil,
  };
}

describe('SKF und FAG', () => {
  it('sperrt, wenn der Pflichtsatz fehlt', () => {
    const befunde = pruefeListing(entwurf({ hersteller: 'SKF', zustand: 'neu' }));
    expect(darfVeroeffentlichen(befunde)).toBe(false);
    expect(befunde.some((b) => b.meldung.includes('10.000'))).toBe(true);
  });

  it('laesst es durch, wenn der Pflichtsatz drinsteht', () => {
    const befunde = pruefeListing(
      entwurf({ hersteller: 'FAG', zustand: 'neu', beschreibung: `Kugellager. ${PFLICHTSATZ_KUGELLAGER}` }),
    );
    expect(darfVeroeffentlichen(befunde)).toBe(true);
  });

  it('erkennt den Satz auch mit anderen Zeichen', () => {
    // Beim Kopieren werden Bindestrich und Anfuehrungszeichen gern ersetzt.
    const befunde = pruefeListing(
      entwurf({
        hersteller: 'SKF',
        zustand: 'neu',
        beschreibung: 'Neu Sonstiges - original verpackt. Laut Hersteller duerfen wir nicht NEU schreiben.',
      }),
    );
    expect(darfVeroeffentlichen(befunde)).toBe(true);
  });

  it('verbietet den Zustand "Neu" bei SKF', () => {
    const befunde = pruefeListing(
      entwurf({ hersteller: 'SKF', zustand: 'neu_versiegelt', beschreibung: PFLICHTSATZ_KUGELLAGER }),
    );
    expect(darfVeroeffentlichen(befunde)).toBe(false);
    expect(befunde.some((b) => b.meldung.includes('Neu: Sonstige'))).toBe(true);
  });

  it('laesst gebrauchte SKF-Ware in Ruhe', () => {
    expect(darfVeroeffentlichen(pruefeListing(entwurf({ hersteller: 'SKF', zustand: 'gebraucht' })))).toBe(true);
  });
});

describe('LAPP', () => {
  it('erkennt LAPP an der Produktlinie', () => {
    expect(istLappArtikel(null, ['ÖLFLEX CLASSIC 110 Steuerleitung'])).toBe(true);
    expect(istLappArtikel('LAPP', ['Kabel'])).toBe(true);
    expect(istLappArtikel('Bosch', ['Bohrmaschine'])).toBe(false);
  });

  it('sperrt, wenn der Herstellername im Text steht', () => {
    const befunde = pruefeListing(
      entwurf({ hersteller: 'LAPP', titel1: 'LAPP ÖLFLEX Steuerleitung 5G1,5' }),
    );
    expect(darfVeroeffentlichen(befunde)).toBe(false);
    expect(befunde.some((b) => b.regel === 'LAPP' && b.schwere === 'sperre')).toBe(true);
  });

  it('laesst die Produktlinie durch, warnt aber', () => {
    // Das Dokument verbietet nur den Herstellernamen. Ohne Linienbezeichnung
    // waere ein Kabellisting unauffindbar — deshalb Hinweis statt Sperre.
    const befunde = pruefeListing(entwurf({ hersteller: null, titel1: 'ÖLFLEX CLASSIC 110 5G1,5 Steuerleitung' }));
    expect(darfVeroeffentlichen(befunde)).toBe(true);
    expect(befunde.some((b) => b.schwere === 'warnung' && b.regel === 'LAPP')).toBe(true);
  });

  it('haelt LAPP nicht in unbeteiligten Woertern fuer einen Treffer', () => {
    expect(istLappArtikel('Klappe', ['Klappenkasten'])).toBe(false);
  });
});

describe('Defekte Ware', () => {
  it('verlangt "defekt" in Titel und Beschreibung', () => {
    const befunde = pruefeListing(entwurf({ zustand: 'defekt' }));
    expect(befunde.filter((b) => b.regel === 'Defekt')).toHaveLength(2);
  });

  it('ist zufrieden, wenn beides dasteht', () => {
    const befunde = pruefeListing(
      entwurf({ zustand: 'defekt', titel1: 'Bosch GSR 18V-55 defekt', beschreibung: 'Motor defekt, Ersatzteilspender.' }),
    );
    expect(darfVeroeffentlichen(befunde)).toBe(true);
  });
});

describe('Titellaengen', () => {
  it('sperrt einen zu langen Titel 1', () => {
    const befunde = pruefeListing(entwurf({ titel1: 'A'.repeat(61) }));
    expect(befunde.some((b) => b.regel === 'Titellänge')).toBe(true);
  });

  it('erlaubt Titel 2 und 3 bis 80 Zeichen', () => {
    expect(darfVeroeffentlichen(pruefeListing(entwurf({ titel2: 'A'.repeat(80) })))).toBe(true);
    expect(darfVeroeffentlichen(pruefeListing(entwurf({ titel3: 'A'.repeat(81) })))).toBe(false);
  });
});
