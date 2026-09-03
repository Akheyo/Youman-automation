/**
 * Der Warenkorb ist die Stelle, an der Geld verloren geht, wenn sie falsch ist.
 * Diese Tests halten die Zusagen fest, auf die sich der Rest verlaesst.
 */

import { describe, it, expect } from 'vitest';
import { rechne, KorbFehler } from '@/lib/warenkorb';

const lieferungBorken = { strasse: 'Brinkstr. 42', plz: '46325', ort: 'Borken' };

describe('rechne', () => {
  it('rechnet Preise aus der Speisekarte, nicht aus der Anfrage', () => {
    // Der Angreifer schmuggelt einen eigenen Preis in den Posten.
    const r = rechne({
      posten: [{ artikelId: 'pizza-margherita', menge: 2, preis: 1 } as never],
      abholart: 'abholung',
    });
    expect(r.warenwert).toBe(1500); // 2 × 7,50 €, nicht 2 Cent
    expect(r.summe).toBe(1500);
  });

  it('zaehlt Extras zum Einzelpreis', () => {
    const r = rechne({
      posten: [{ artikelId: 'pizza-margherita', menge: 1, extras: ['gross', 'salami'] }],
      abholart: 'abholung',
    });
    expect(r.posten[0].einzelpreis).toBe(750 + 450 + 150);
    expect(r.posten[0].bezeichnung).toContain('Familiengröße');
  });

  it('weist Extras ab, die es am Artikel nicht gibt', () => {
    expect(() =>
      rechne({ posten: [{ artikelId: 'pasta-bolognese', menge: 1, extras: ['gross'] }], abholart: 'abholung' }),
    ).toThrow(KorbFehler);
  });

  it('haelt den Mindestbestellwert des Liefergebiets ein', () => {
    // Heiden verlangt 20 €, eine Margherita sind 7,50 €.
    expect(() =>
      rechne({
        posten: [{ artikelId: 'pizza-margherita', menge: 1 }],
        abholart: 'lieferung',
        adresse: { strasse: 'Musterweg 1', plz: '46359', ort: 'Heiden' },
      }),
    ).toThrow(/Mindestbestellwert/);
  });

  it('liefert nicht in Orte ausserhalb des Gebiets', () => {
    expect(() =>
      rechne({
        posten: [{ artikelId: 'pizza-margherita', menge: 4 }],
        abholart: 'lieferung',
        adresse: { strasse: 'Musterweg 1', plz: '48143', ort: 'Münster' },
      }),
    ).toThrow(/liefern wir leider nicht/);
  });

  it('berechnet in Borken keine Liefergebuehr ab 20 Euro', () => {
    const r = rechne({
      posten: [{ artikelId: 'pizza-margherita', menge: 3 }], // 22,50 €
      abholart: 'lieferung',
      adresse: lieferungBorken,
    });
    expect(r.warenwert).toBe(2250);
    expect(r.liefergebuehr).toBe(0);
  });

  it('deckelt das Trinkgeld und laesst negative Werte nicht durch', () => {
    const hoch = rechne({ posten: [{ artikelId: 'cola-05', menge: 1 }], abholart: 'abholung', trinkgeld: 999_999 });
    expect(hoch.trinkgeld).toBe(2000);

    const negativ = rechne({ posten: [{ artikelId: 'cola-05', menge: 1 }], abholart: 'abholung', trinkgeld: -500 });
    expect(negativ.trinkgeld).toBe(0);
    expect(negativ.summe).toBe(290);
  });

  it('weist unsinnige Mengen ab', () => {
    for (const menge of [0, -3, 2.5, 999]) {
      expect(() => rechne({ posten: [{ artikelId: 'cola-05', menge }], abholart: 'abholung' })).toThrow(KorbFehler);
    }
  });

  it('verlangt bei Lieferung eine vollstaendige Adresse', () => {
    expect(() =>
      rechne({
        posten: [{ artikelId: 'pizza-margherita', menge: 4 }],
        abholart: 'lieferung',
        adresse: { strasse: '', plz: '46325', ort: 'Borken' },
      }),
    ).toThrow(/Lieferadresse/);
  });

  it('reicht die Allergene bis in die Bestellzeile durch', () => {
    const r = rechne({ posten: [{ artikelId: 'pizza-tonno', menge: 1 }], abholart: 'abholung' });
    expect(r.posten[0].allergene).toContain('Fisch');
  });
});
