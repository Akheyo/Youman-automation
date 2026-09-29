import { beforeEach, describe, expect, it } from 'vitest';
import { itemIdAus, lerneTitelgrenze, titelGrenze, vergissTitelgrenze } from './client';
import { leseFehler } from './fehler';
import { TITEL_VORGABE } from './anzeige';

describe('itemIdAus', () => {
  it('liest die Anzeigen-ID aus dem Location-Header', () => {
    expect(itemIdAus('/v2/advertisements/m1372')).toBe('m1372');
    expect(itemIdAus('https://api.marktplaats.nl/v2/advertisements/m1372')).toBe('m1372');
  });

  it('haelt Query und Fragment aus der ID heraus', () => {
    expect(itemIdAus('/v2/advertisements/m1372?x=1')).toBe('m1372');
    expect(itemIdAus('/v2/advertisements/m1372#bild')).toBe('m1372');
  });

  it('gibt null zurueck, wenn nichts Brauchbares im Header steht', () => {
    expect(itemIdAus(null)).toBeNull();
    expect(itemIdAus('')).toBeNull();
    expect(itemIdAus('/v2/users/17')).toBeNull();
  });
});

describe('Titelgrenze', () => {
  beforeEach(() => vergissTitelgrenze());

  it('faengt mit der Vorgabe an', () => {
    expect(titelGrenze()).toBe(TITEL_VORGABE);
  });

  it('lernt die Grenze aus der Fehlerantwort der API', () => {
    const befund = leseFehler(
      400,
      JSON.stringify({ fieldErrors: [{ fieldName: 'title', code: 'input-too-long', value: '45' }] }),
    );
    expect(lerneTitelgrenze(befund)).toBe(45);
    expect(titelGrenze()).toBe(45);
  });

  it('laesst die Grenze stehen, wenn der Fehler nichts darueber sagt', () => {
    lerneTitelgrenze(leseFehler(400, JSON.stringify({ code: 'validation-failure' })));
    expect(titelGrenze()).toBe(TITEL_VORGABE);
  });
});
