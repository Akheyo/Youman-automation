/**
 * Testet das Laden und Speichern des Plenty-Zugangs.
 *
 * Die entscheidenden Punkte:
 *   - Ein unvollständiger Datensatz darf einen funktionierenden Zugang aus den
 *     Umgebungsvariablen NICHT verdrängen. Sonst legt ein halbes Speichern
 *     alle Werkzeuge für alle Kollegen lahm.
 *   - Ohne Datenbank muss alles weiterlaufen wie bisher.
 *   - Das Passwort landet verschlüsselt in der Datenbank, nie im Klartext.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Simuliert die Supabase-Tabelle „einstellungen". */
function supabaseAttrappe(zeile: Record<string, unknown> | null, opts: { fehler?: string } = {}) {
  const geschrieben: Array<Record<string, unknown>> = [];
  const client = {
    from() {
      return {
        select() {
          const fehler = opts.fehler ? { message: opts.fehler } : null;
          return {
            eq() {
              return {
                maybeSingle: async () => (fehler ? { data: null, error: fehler } : { data: zeile, error: null }),
              };
            },
            // Fuer die Existenzpruefung der Tabelle.
            limit: async () => (fehler ? { data: null, error: fehler } : { data: [], error: null }),
          };
        },
        async upsert(werte: Record<string, unknown>) {
          geschrieben.push(werte);
          return { error: opts.fehler ? { message: opts.fehler } : null };
        },
        update(werte: Record<string, unknown>) {
          geschrieben.push(werte);
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  };
  return { client, geschrieben };
}

async function modul(zeile: Record<string, unknown> | null, opts: { fehler?: string } = {}) {
  const attrappe = supabaseAttrappe(zeile, opts);
  vi.doMock('@/lib/supabase/admin', () => ({ createAdminClient: () => attrappe.client }));
  const m = await import('./plenty');
  m.vergissZugang();
  return { ...m, geschrieben: attrappe.geschrieben };
}

describe('Plenty-Zugang', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.EINSTELLUNGEN_SCHLUESSEL = 'test-schluessel';
  });
  afterEach(() => {
    vi.doUnmock('@/lib/supabase/admin');
    for (const k of ['EINSTELLUNGEN_SCHLUESSEL', 'PLENTY_BASE_URL', 'PLENTY_USER', 'PLENTY_PASSWORD', 'PLENTY_ID']) {
      delete process.env[k];
    }
  });

  it('nimmt die Umgebungsvariablen, wenn nichts gespeichert ist', async () => {
    process.env.PLENTY_BASE_URL = 'https://alt.plentymarkets-cloud01.com';
    process.env.PLENTY_USER = 'alt';
    process.env.PLENTY_PASSWORD = 'altgeheim';
    const { ladeZugang } = await modul(null);
    const z = await ladeZugang();
    expect(z.quelle).toBe('umgebung');
    expect(z.user).toBe('alt');
  });

  it('lässt die Datenbank die Umgebungsvariablen überstimmen', async () => {
    process.env.PLENTY_BASE_URL = 'https://alt.plentymarkets-cloud01.com';
    process.env.PLENTY_USER = 'alt';
    process.env.PLENTY_PASSWORD = 'altgeheim';
    const { verschluessele } = await import('./tresor');
    const { ladeZugang } = await modul({
      plenty_base_url: 'https://neu.plentymarkets-cloud01.com',
      plenty_user: 'neu',
      plenty_passwort_enc: verschluessele('neugeheim'),
      plenty_id: 3,
      plenty_warehouse_id: 106,
      geaendert_von: 'chef@firma.de',
      geaendert_am: '2026-09-09T10:00:00Z',
    });
    const z = await ladeZugang();
    expect(z.quelle).toBe('datenbank');
    expect(z.baseUrl).toBe('https://neu.plentymarkets-cloud01.com');
    expect(z.user).toBe('neu');
    expect(z.password).toBe('neugeheim');
    expect(z.warehouseId).toBe(106);
    expect(z.geaendertVon).toBe('chef@firma.de');
  });

  it('lässt einen halben Datensatz den funktionierenden Zugang nicht kaputtmachen', async () => {
    process.env.PLENTY_BASE_URL = 'https://alt.plentymarkets-cloud01.com';
    process.env.PLENTY_USER = 'alt';
    process.env.PLENTY_PASSWORD = 'altgeheim';
    // URL gespeichert, aber kein Passwort — darf nicht greifen.
    const { ladeZugang } = await modul({ plenty_base_url: 'https://neu.example.com', plenty_user: null });
    const z = await ladeZugang();
    expect(z.quelle).toBe('umgebung');
    expect(z.baseUrl).toBe('https://alt.plentymarkets-cloud01.com');
    expect(z.password).toBe('altgeheim');
  });

  it('meldet ein unlesbares Passwort, statt es zu verschweigen', async () => {
    const { ladeZugang } = await modul({
      plenty_base_url: 'https://neu.example.com',
      plenty_user: 'neu',
      plenty_passwort_enc: 'v1:kaputt:kaputt:kaputt:kaputt',
    });
    const z = await ladeZugang();
    expect(z.passwortUnlesbar).toBe(true);
    expect(z.quelle).not.toBe('datenbank');
  });

  it('läuft weiter, wenn die Tabelle noch fehlt', async () => {
    process.env.PLENTY_BASE_URL = 'https://alt.example.com';
    process.env.PLENTY_USER = 'alt';
    process.env.PLENTY_PASSWORD = 'altgeheim';
    const { ladeZugang } = await modul(null, { fehler: 'relation "einstellungen" does not exist' });
    const z = await ladeZugang();
    expect(z.quelle).toBe('umgebung');
  });

  it('meldet „leer", wenn es weder Datenbank- noch Umgebungswerte gibt', async () => {
    const { ladeZugang } = await modul(null);
    expect((await ladeZugang()).quelle).toBe('leer');
  });

  it('speichert das Passwort verschlüsselt, nie im Klartext', async () => {
    const { speichereZugang, geschrieben } = await modul(null);
    const res = await speichereZugang({
      baseUrl: 'https://neu.plentymarkets-cloud01.com',
      user: 'neu',
      passwort: 'streng-geheim',
      von: 'chef@firma.de',
    });
    expect(res.ok).toBe(true);
    const satz = JSON.stringify(geschrieben[0]);
    expect(satz).not.toContain('streng-geheim');
    expect(String(geschrieben[0].plenty_passwort_enc)).toMatch(/^v1:/);
    expect(geschrieben[0].geaendert_von).toBe('chef@firma.de');
  });

  it('lässt das gespeicherte Passwort stehen, wenn keines mitgeschickt wird', async () => {
    const { speichereZugang, geschrieben } = await modul(null);
    await speichereZugang({ baseUrl: 'https://neu.example.com', user: 'neu' });
    expect(geschrieben[0]).not.toHaveProperty('plenty_passwort_enc');
  });

  it('erklärt eine fehlende Tabelle statt den rohen Fehler durchzureichen', async () => {
    const { speichereZugang } = await modul(null, { fehler: 'relation "public.einstellungen" does not exist' });
    const res = await speichereZugang({ baseUrl: 'https://a.example.com', user: 'u', passwort: 'p' });
    expect(res.ok).toBe(false);
    expect(res.fehler).toMatch(/schema\.sql/);
  });

  it('meldet die Tabelle als vorhanden, wenn sie sich abfragen lässt', async () => {
    const { pruefeTabelle } = await modul(null);
    expect(await pruefeTabelle()).toBe('vorhanden');
  });

  it('erkennt, wenn das Schema im falschen Projekt liegt', async () => {
    // Genau der Fall, den die Einstellungsseite sichtbar machen soll: Das SQL
    // wurde ausgeführt — nur in einem anderen Supabase-Projekt.
    const { pruefeTabelle } = await modul(null, { fehler: 'relation "public.einstellungen" does not exist' });
    expect(await pruefeTabelle()).toBe('fehlt');
  });

  it('behauptet bei einer unklaren Störung nichts', async () => {
    const { pruefeTabelle } = await modul(null, { fehler: 'connection reset by peer' });
    expect(await pruefeTabelle()).toBe('unbekannt');
  });

  it('schneidet ein angehängtes /rest von der Basis-URL ab', async () => {
    const { normalisiereBaseUrl } = await modul(null);
    expect(normalisiereBaseUrl('https://a.example.com/rest/')).toBe('https://a.example.com');
    expect(normalisiereBaseUrl('  https://a.example.com//  ')).toBe('https://a.example.com');
  });
});
