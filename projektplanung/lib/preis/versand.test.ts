import { describe, expect, it } from 'vitest';
import { PAKET_GRENZE_KG, versandkosten } from './versand';

describe('versandkosten', () => {
  it('nimmt die Staffel bis 5 und bis 10 kg', () => {
    expect(versandkosten(0.4).kosten).toBe(7.9);
    expect(versandkosten(5).kosten).toBe(7.9);
    expect(versandkosten(5.1).kosten).toBe(9.9);
    expect(versandkosten(10).kosten).toBe(9.9);
  });

  it('ignoriert die Packklasse unter 10 kg', () => {
    // Dort gibt es nur einen Satz — sperrig oder nicht aendert nichts.
    expect(versandkosten(3, 'schwierig').kosten).toBe(7.9);
    expect(versandkosten(9, 'sperrig').kosten).toBe(9.9);
  });

  it('staffelt ueber 10 kg nach Sperrigkeit', () => {
    expect(versandkosten(25, 'normal').kosten).toBe(14.9);
    expect(versandkosten(25, 'sperrig').kosten).toBe(19.9);
    expect(versandkosten(25, 'schwierig').kosten).toBe(29.9);
  });

  it('schickt alles ueber 30 kg zur Spedition', () => {
    const befund = versandkosten(PAKET_GRENZE_KG + 1);
    expect(befund.kosten).toBeNull();
    expect(befund.spedition).toBe(true);
    expect(befund.begruendung).toMatch(/Spedition/);
  });

  it('schaetzt ohne Gewicht NICHT', () => {
    // Ein geratenes Gewicht wird ueber die Preisformel zu einem falschen
    // Verkaufspreis — und das faellt niemandem auf.
    for (const wert of [null, undefined, 0, -3, Number.NaN]) {
      const befund = versandkosten(wert as number | null);
      expect(befund.kosten).toBeNull();
      expect(befund.spedition).toBe(false);
      expect(befund.begruendung).toMatch(/Gewicht unbekannt/);
    }
  });

  it('begruendet, wie es gerechnet hat', () => {
    expect(versandkosten(25, 'sperrig').begruendung).toMatch(/bis 30 kg, sperrig/);
  });
});
