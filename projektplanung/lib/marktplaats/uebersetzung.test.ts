import { describe, expect, it } from 'vitest';
import { PFLICHTSATZ_KUGELLAGER } from '@/lib/listing/markenregeln';
import { brauchtPflichtsatz, pruefeHerkunft, pruefeUebersetzung, sichereProduktregeln } from './uebersetzung';

describe('pruefeHerkunft', () => {
  it('laesst einen gewoehnlichen Artikel durch', () => {
    const { darfRaus } = pruefeHerkunft({
      hersteller: 'Bosch',
      titel: 'Bohrhammer GBH 2-26',
      beschreibung: 'Gebrauchter Bohrhammer, technisch in Ordnung.',
      zustand: 'gebraucht',
    });
    expect(darfRaus).toBe(true);
  });

  it('sperrt einen LAPP-Artikel, dessen Name im Text steht', () => {
    const { darfRaus, befunde } = pruefeHerkunft({
      hersteller: 'LAPP',
      titel: 'OELFLEX CLASSIC 110 5G1,5 Steuerleitung',
      beschreibung: 'Steuerleitung von LAPP, 5G1,5 mm2.',
      zustand: 'neu',
    });
    expect(darfRaus).toBe(false);
    expect(befunde.some((b) => b.regel === 'LAPP')).toBe(true);
  });

  it('sperrt neuwertige SKF-Ware ohne Pflichtsatz', () => {
    const { darfRaus, befunde } = pruefeHerkunft({
      hersteller: 'SKF',
      titel: 'SKF 6205 Rillenkugellager',
      beschreibung: 'Neues Rillenkugellager.',
      zustand: 'neu',
    });
    expect(darfRaus).toBe(false);
    expect(befunde.some((b) => b.regel === 'SKF/FAG')).toBe(true);
  });

  it('haelt einen langen Titel NICHT auf — Marktplaats kuerzt ihn ohnehin', () => {
    const { darfRaus } = pruefeHerkunft({
      hersteller: 'Bosch',
      titel: 'A'.repeat(120),
      beschreibung: 'Gebrauchtes Geraet.',
      zustand: 'gebraucht',
    });
    expect(darfRaus).toBe(true);
  });
});

describe('brauchtPflichtsatz', () => {
  it('gilt fuer neuwertige SKF- und FAG-Ware', () => {
    expect(brauchtPflichtsatz('SKF', 'neu')).toBe(true);
    expect(brauchtPflichtsatz('FAG', 'neu_versiegelt')).toBe(true);
  });

  it('gilt nicht fuer gebrauchte Ware und andere Hersteller', () => {
    expect(brauchtPflichtsatz('SKF', 'gebraucht')).toBe(false);
    expect(brauchtPflichtsatz('Bosch', 'neu')).toBe(false);
    expect(brauchtPflichtsatz(null, 'neu')).toBe(false);
  });
});

describe('sichereProduktregeln', () => {
  it('haengt den Pflichtsatz im deutschen Wortlaut an', () => {
    const { beschreibung, ergaenzt } = sichereProduktregeln('Nieuw kogellager.', {
      hersteller: 'SKF',
      zustand: 'neu',
    });
    expect(ergaenzt).toBe(true);
    expect(beschreibung).toContain(PFLICHTSATZ_KUGELLAGER);
  });

  it('haengt ihn nicht doppelt an', () => {
    const schon = `Nieuw kogellager.\n\n${PFLICHTSATZ_KUGELLAGER}`;
    const { beschreibung, ergaenzt } = sichereProduktregeln(schon, { hersteller: 'SKF', zustand: 'neu' });
    expect(ergaenzt).toBe(false);
    expect(beschreibung).toBe(schon);
  });

  it('laesst andere Artikel unberuehrt', () => {
    const { beschreibung, ergaenzt } = sichereProduktregeln('Gebruikte boorhamer.', {
      hersteller: 'Bosch',
      zustand: 'gebraucht',
    });
    expect(ergaenzt).toBe(false);
    expect(beschreibung).toBe('Gebruikte boorhamer.');
  });
});

describe('pruefeUebersetzung', () => {
  it('faengt einen LAPP-Namen ab, der die Uebersetzung ueberlebt hat', () => {
    const { darfRaus } = pruefeUebersetzung(
      { titel: 'OELFLEX CLASSIC 110 stuurkabel', beschreibung: 'Stuurkabel 5G1,5 mm2.' },
      { hersteller: 'LAPP', zustand: 'neu' },
    );
    expect(darfRaus).toBe(false);
  });

  it('verlangt den Defekt-Hinweis auch im niederlaendischen Titel', () => {
    const ohne = pruefeUebersetzung(
      { titel: 'Boorhamer Bosch GBH 2-26', beschreibung: 'Werkt niet meer.' },
      { hersteller: 'Bosch', zustand: 'defekt' },
    );
    expect(ohne.darfRaus).toBe(false);

    const mit = pruefeUebersetzung(
      { titel: 'Boorhamer Bosch GBH 2-26 defect', beschreibung: 'Werkt niet meer.' },
      { hersteller: 'Bosch', zustand: 'defekt' },
    );
    expect(mit.darfRaus).toBe(true);
  });

  it('laesst eine saubere Uebersetzung durch', () => {
    const { darfRaus } = pruefeUebersetzung(
      { titel: 'Boorhamer Bosch GBH 2-26', beschreibung: 'Gebruikte boorhamer, technisch in orde.' },
      { hersteller: 'Bosch', zustand: 'gebraucht' },
    );
    expect(darfRaus).toBe(true);
  });
});
