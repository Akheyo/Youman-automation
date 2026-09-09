import { describe, it, expect } from 'vitest';
import { bewerte, STANDARD_SCHWELLEN } from '@/lib/outreach/health';

describe('bewerte', () => {
  it('haelt bei kleinen Mengen still, auch wenn die Quote schlecht aussieht', () => {
    // 2 von 5 sind 40 % — aber statistisch bedeutungslos.
    const b = bewerte({ gesendet: 5, bounces: 2, abmeldungen: 0 });
    expect(b.stoppen).toBe(false);
  });

  it('stoppt bei zu vielen unzustellbaren Adressen', () => {
    const b = bewerte({ gesendet: 100, bounces: 6, abmeldungen: 0 });
    expect(b.stoppen).toBe(true);
    if (b.stoppen) expect(b.grund).toContain('unzustellbare');
  });

  it('laesst eine Bounce-Quote knapp unter der Schwelle durch', () => {
    // 4 von 100 = 4 %, genau auf der Schwelle — noch kein Stopp.
    expect(bewerte({ gesendet: 100, bounces: 4, abmeldungen: 0 }).stoppen).toBe(false);
    expect(bewerte({ gesendet: 100, bounces: 5, abmeldungen: 0 }).stoppen).toBe(true);
  });

  it('stoppt bei auffaellig vielen Abmeldungen', () => {
    const b = bewerte({ gesendet: 200, bounces: 0, abmeldungen: 8 });
    expect(b.stoppen).toBe(true);
    if (b.stoppen) expect(b.grund).toContain('Abmeldungen');
  });

  it('nennt die Bounce-Quote zuerst, wenn beide Werte kippen', () => {
    const b = bewerte({ gesendet: 100, bounces: 10, abmeldungen: 10 });
    expect(b.stoppen).toBe(true);
    if (b.stoppen) expect(b.grund).toContain('unzustellbare');
  });

  it('meldet saubere Kampagnen als unauffaellig', () => {
    const b = bewerte({ gesendet: 500, bounces: 3, abmeldungen: 2 });
    expect(b.stoppen).toBe(false);
    expect(b.quoten.bounce).toBeCloseTo(0.006, 3);
  });

  it('kommt mit null gesendeten Mails klar', () => {
    const b = bewerte({ gesendet: 0, bounces: 0, abmeldungen: 0 });
    expect(b.stoppen).toBe(false);
    expect(b.quoten.bounce).toBe(0);
  });

  it('laesst sich strenger einstellen', () => {
    const streng = { ...STANDARD_SCHWELLEN, maxBounceQuote: 0.01, mindestMenge: 10 };
    expect(bewerte({ gesendet: 100, bounces: 2, abmeldungen: 0 }, streng).stoppen).toBe(true);
  });
});
