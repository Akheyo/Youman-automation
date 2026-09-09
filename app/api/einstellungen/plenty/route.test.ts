/**
 * Testet die Einstellungs-Route.
 *
 * Anlass für den ersten Test: Die 401-Antwort lag zunächst als Modulkonstante
 * vor. Der Body einer Response ist aber ein Stream, der sich nur einmal lesen
 * lässt — ab dem zweiten Aufruf kam ein nacktes 401 ohne Begründung an. Der
 * Fehler fiel erst beim Ausprobieren auf, nicht beim Typecheck.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Kein angemeldeter Nutzer — so verhält sich die App mit aktivem Supabase. */
function ohneAnmeldung() {
  vi.doMock('@/lib/supabase/server', () => ({
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
  }));
}

describe('Einstellungs-Route', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.doUnmock('@/lib/supabase/server'));

  it('begründet die Abweisung auch beim wiederholten Aufruf', async () => {
    ohneAnmeldung();
    const { GET } = await import('./route');

    for (const durchgang of [1, 2, 3]) {
      const res = await GET();
      expect(res.status, `Durchgang ${durchgang}`).toBe(401);
      await expect(res.json(), `Durchgang ${durchgang}`).resolves.toEqual({ error: 'Bitte anmelden.' });
    }
  });

  it('weist auch PUT und DELETE mit Begründung ab', async () => {
    ohneAnmeldung();
    const { PUT, DELETE } = await import('./route');

    const put = await PUT(new Request('http://x/api', { method: 'PUT', body: '{}' }));
    expect(put.status).toBe(401);
    await expect(put.json()).resolves.toEqual({ error: 'Bitte anmelden.' });

    const del = await DELETE();
    expect(del.status).toBe(401);
    await expect(del.json()).resolves.toEqual({ error: 'Bitte anmelden.' });
  });
});
