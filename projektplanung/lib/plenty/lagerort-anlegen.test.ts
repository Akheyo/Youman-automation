/**
 * Testet das Anlegen von Lagerorten gegen eine simulierte Plenty-API.
 *
 * Die wichtigsten Zusagen, die hier abgesichert werden:
 *   - Im Probelauf wird nichts geschrieben.
 *   - Was es schon gibt, wird erkannt und nicht noch einmal angelegt.
 *   - Vorhandene Struktur-Knoten werden wiederverwendet, fehlende einmal
 *     angelegt und danach von den Geschwistern mitbenutzt.
 *   - Zweck, Status und die Schreibweise der Namen werden abgelesen, nicht
 *     erfunden.
 *   - Ist die Liste der vorhandenen Lagerorte unvollständig, wird gar nicht
 *     geschrieben — sonst entstehen Dubletten.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { istSchreiblimit, nameMitStellen, schreibweisen, stellenAus, zerlegeCode } from './lagerort-anlegen';

const ANTWORT = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

interface AttrappeOpts {
  orte?: Array<{ id: number; fullLabel: string; purposeKey?: string; statusKey?: string }>;
  knoten?: Array<{ id: number; parentId: number; dimensionId: number; name: string; position: number }>;
  dimensionen?: Array<{ id: number; level: number; name: string; shortcut: string }>;
  /** Liefert für die Lagerortliste absichtlich keine letzte Seite. */
  unvollstaendig?: boolean;
  /** Lässt jeden POST auf einen Lagerort scheitern. */
  anlegenFehler?: boolean;
}

/** Plenty-Attrappe; sammelt alle schreibenden Aufrufe zum Nachprüfen. */
function attrappe(opts: AttrappeOpts = {}) {
  const orte = opts.orte ?? [
    { id: 8619, fullLabel: 'H1/R8/EA F15-K10', purposeKey: 'pickup', statusKey: 'active' },
    { id: 4397, fullLabel: 'H1/R1/EB F12-0', purposeKey: 'pickup', statusKey: 'active' },
  ];
  const dimensionen = opts.dimensionen ?? [
    { id: 11, level: 1, name: 'Halle', shortcut: 'H' },
    { id: 12, level: 2, name: 'Regal', shortcut: 'R' },
    { id: 13, level: 3, name: 'Ebene', shortcut: 'E' },
    { id: 14, level: 4, name: 'Feld', shortcut: 'F' },
  ];
  // Vorhandene Struktur: Halle 1 › Regal 8 › Ebene A › Feld 15.
  const knoten = opts.knoten ?? [
    { id: 100, parentId: 0, dimensionId: 11, name: '1', position: 1 },
    { id: 200, parentId: 100, dimensionId: 12, name: '8', position: 1 },
    { id: 300, parentId: 200, dimensionId: 13, name: 'A', position: 1 },
    { id: 400, parentId: 300, dimensionId: 14, name: '15', position: 1 },
  ];

  const geschrieben: Array<{ url: string; body: Record<string, unknown> }> = [];
  let naechsteId = 900;

  const fetchMock = async (url: string, init?: RequestInit) => {
    if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });

    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      geschrieben.push({ url, body });
      if (url.includes('/locations/levels')) return ANTWORT({ id: (naechsteId += 1), ...body });
      if (opts.anlegenFehler) return ANTWORT({ error: 'abgelehnt' }, 400);
      return ANTWORT({ id: (naechsteId += 1), ...body });
    }

    if (url.includes('/locations/dimensions')) return ANTWORT({ entries: dimensionen });
    if (url.includes('/locations/levels')) return ANTWORT({ entries: knoten });
    if (url.includes('/locations')) {
      return ANTWORT({ entries: orte, isLastPage: !opts.unvollstaendig, totalsCount: orte.length });
    }
    return ANTWORT({ entries: [] });
  };

  return { fetchMock, geschrieben };
}

async function lade() {
  return (await import('./lagerort-anlegen')).legeLagerorteAn;
}

describe('zerlegeCode', () => {
  it('zerlegt einen Platz mit Kiste', () => {
    expect(zerlegeCode('H1/R7/EC F16-K04')).toMatchObject({
      halle: 1,
      regal: '7',
      ebene: 'C',
      fach: '16',
      bezeichnung: 'K04',
    });
  });

  it('zerlegt einen Stellplatz ohne Kiste', () => {
    expect(zerlegeCode('H2/R7/EA F07-0')).toMatchObject({ halle: 2, regal: '7', ebene: 'A', bezeichnung: '0' });
  });

  it('lehnt einen Platz ohne Ebene ab, statt eine zu erfinden', () => {
    // Kleinteillager-Schreibweise ohne Ebene: "Halle 1, Regal 5 KTL, Fach 15".
    expect(zerlegeCode('H1R5KTL15')).toBeNull();
  });

  it('lehnt Text ohne erkennbaren Platz ab', () => {
    expect(zerlegeCode('Bohrmaschine, blau')).toBeNull();
  });
});

describe('stellenAus / nameMitStellen', () => {
  it('erkennt aufgefüllte Zahlen an der führenden Null', () => {
    expect(stellenAus(['07', '15', '21'])).toBe(2);
    expect(nameMitStellen('7', 2)).toBe('07');
  });

  it('füllt nicht auf, wenn der Bestand es nicht tut', () => {
    expect(stellenAus(['7', '15', 'A'])).toBe(0);
    expect(nameMitStellen('7', 0)).toBe('7');
  });

  it('lässt Namen mit Buchstaben unangetastet', () => {
    expect(nameMitStellen('8KTL', 2)).toBe('8KTL');
  });
});

describe('schreibweisen', () => {
  it('bietet Zahlen mit und ohne führende Null an', () => {
    expect(schreibweisen('02')).toEqual(['02', '2', '002']);
    expect(schreibweisen('2')).toEqual(['2', '02', '002']);
  });

  it('lässt Namen mit Buchstaben unangetastet', () => {
    expect(schreibweisen('8KTL')).toEqual(['8KTL']);
    expect(schreibweisen('A')).toEqual(['A']);
  });
});

describe('istSchreiblimit', () => {
  it('erkennt die Schreibbremse von PlentyONE', () => {
    expect(istSchreiblimit(new Error('Plenty POST … → HTTP 429: short period write limit reached'))).toBe(true);
    expect(istSchreiblimit(new Error('HTTP 400: ungueltig'))).toBe(false);
  });
});

describe('legeLagerorteAn', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.PLENTY_BASE_URL = 'https://test.plentymarkets-cloud01.com';
    process.env.PLENTY_USER = 'api';
    process.env.PLENTY_PASSWORD = 'geheim';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PLENTY_BASE_URL;
    delete process.env.PLENTY_USER;
    delete process.env.PLENTY_PASSWORD;
  });

  it('schreibt im Probelauf nichts', async () => {
    const { fetchMock, geschrieben } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const legeLagerorteAn = await lade();
    const res = await legeLagerorteAn(['H1/R8/EA F16-K01'], { warehouseId: 106 });

    expect(res.probelauf).toBe(true);
    expect(geschrieben).toHaveLength(0);
    expect(res.geplant).toBe(1);
    expect(res.angelegt).toBe(0);
    expect(res.zeilen[0].status).toBe('geplant');
  });

  it('erkennt vorhandene Lagerorte und legt sie nicht erneut an', async () => {
    const { fetchMock, geschrieben } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const legeLagerorteAn = await lade();
    const res = await legeLagerorteAn(['H1/R8/EA F15-K10'], { warehouseId: 106, probelauf: false });

    expect(res.vorhanden).toBe(1);
    expect(res.angelegt).toBe(0);
    expect(res.zeilen[0].id).toBe(8619);
    expect(geschrieben).toHaveLength(0);
  });

  it('legt einen Lagerort unter vorhandener Struktur an, ohne neue Knoten', async () => {
    const { fetchMock, geschrieben } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const legeLagerorteAn = await lade();
    const res = await legeLagerorteAn(['H1/R8/EA F15-K11'], { warehouseId: 106, probelauf: false });

    expect(res.angelegt).toBe(1);
    expect(res.neueKnoten).toBe(0);
    expect(geschrieben).toHaveLength(1);
    expect(geschrieben[0].url).toContain('/rest/warehouses/locations');
    expect(geschrieben[0].body).toMatchObject({
      levelId: 400,
      label: 'K11',
      purposeKey: 'pickup',
      statusKey: 'active',
    });
  });

  it('legt fehlende Knoten an und benutzt sie für die Geschwister mit', async () => {
    const { fetchMock, geschrieben } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const legeLagerorteAn = await lade();
    const res = await legeLagerorteAn(
      ['H1/R8/EA F16-K01', 'H1/R8/EA F16-K02', 'H1/R8/EA F16-K03'],
      { warehouseId: 106, probelauf: false },
    );

    expect(res.angelegt).toBe(3);
    // Nur ein einziger neuer Knoten: das Feld 16. Halle, Regal und Ebene standen.
    expect(res.neueKnoten).toBe(1);
    const knotenAufrufe = geschrieben.filter((g) => g.url.includes('/locations/levels'));
    expect(knotenAufrufe).toHaveLength(1);
    expect(knotenAufrufe[0].body).toMatchObject({ parentId: 300, dimensionId: 14, name: '16' });
  });

  it('übernimmt die Schreibweise der vorhandenen Knoten', async () => {
    const { fetchMock, geschrieben } = attrappe({
      knoten: [
        { id: 100, parentId: 0, dimensionId: 11, name: '1', position: 1 },
        { id: 200, parentId: 100, dimensionId: 12, name: '8', position: 1 },
        { id: 300, parentId: 200, dimensionId: 13, name: 'A', position: 1 },
        // Das vorhandene Feld ist aufgefüllt — das neue muss es auch sein.
        { id: 400, parentId: 300, dimensionId: 14, name: '07', position: 1 },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);
    const legeLagerorteAn = await lade();
    await legeLagerorteAn(['H1/R8/EA F09-K01'], { warehouseId: 106, probelauf: false });

    const knotenAufruf = geschrieben.find((g) => g.url.includes('/locations/levels'));
    expect(knotenAufruf?.body).toMatchObject({ name: '09' });
  });

  it('schreibt nicht, wenn die Liste der vorhandenen Lagerorte unvollständig ist', async () => {
    const { fetchMock, geschrieben } = attrappe({ unvollstaendig: true });
    vi.stubGlobal('fetch', fetchMock);
    const legeLagerorteAn = await lade();
    const res = await legeLagerorteAn(['H1/R8/EA F16-K01'], { warehouseId: 106, probelauf: false });

    expect(res.ok).toBe(false);
    expect(res.error).toContain('nicht vollständig');
    expect(geschrieben).toHaveLength(0);
  });

  it('überspringt unbrauchbare Zeilen, statt zu raten', async () => {
    const { fetchMock, geschrieben } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const legeLagerorteAn = await lade();
    const res = await legeLagerorteAn(['Kein Lagerplatz', 'H1/R8/EA F16-K01'], {
      warehouseId: 106,
      probelauf: false,
    });

    expect(res.uebersprungen).toBe(1);
    expect(res.angelegt).toBe(1);
    expect(res.zeilen[0].status).toBe('uebersprungen');
  });

  it('hält die Obergrenze ein und meldet den Rest als offen', async () => {
    const { fetchMock } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const legeLagerorteAn = await lade();
    const res = await legeLagerorteAn(
      ['H1/R8/EA F16-K01', 'H1/R8/EA F16-K02', 'H1/R8/EA F16-K03'],
      { warehouseId: 106, probelauf: false, maxAnlagen: 2 },
    );

    expect(res.angelegt).toBe(2);
    expect(res.offen).toBe(1);
    expect(res.naechsterIndex).toBe(2);
  });

  it('vermerkt einen Fehler je Zeile, statt den Lauf abzubrechen', async () => {
    const { fetchMock } = attrappe({ anlegenFehler: true });
    vi.stubGlobal('fetch', fetchMock);
    const legeLagerorteAn = await lade();
    const res = await legeLagerorteAn(['H1/R8/EA F15-K11', 'H1/R8/EA F15-K12'], {
      warehouseId: 106,
      probelauf: false,
    });

    expect(res.fehler).toBe(2);
    expect(res.angelegt).toBe(0);
    expect(res.ok).toBe(true);
    expect(res.zeilen[0].hinweis).toContain('400');
  });

  it('liest alle Seiten der vorhandenen Lagerorte, nicht nur die erste', async () => {
    // 12.000 Lagerorte sind rund 50 Seiten. Wird nur die erste gelesen, gilt
    // alles Weitere als fehlend — und wird ein zweites Mal angelegt.
    const seite1 = Array.from({ length: 250 }, (_, i) => ({
      id: 1000 + i,
      fullLabel: `H1/R8/EA F${String((i % 40) + 1).padStart(2, '0')}-K${String((i % 30) + 1).padStart(2, '0')}`,
      purposeKey: 'pickup',
      statusKey: 'active',
    }));
    const seite2 = [{ id: 7777, fullLabel: 'H1/R8/EA F16-K01', purposeKey: 'pickup', statusKey: 'active' }];
    const geschrieben: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
      if (init?.method === 'POST') {
        geschrieben.push(url);
        return ANTWORT({ id: 4242 });
      }
      if (url.includes('/locations/dimensions')) {
        return ANTWORT({
          entries: [
            { id: 11, level: 1, name: 'Halle', shortcut: 'H' },
            { id: 12, level: 2, name: 'Regal', shortcut: 'R' },
            { id: 13, level: 3, name: 'Ebene', shortcut: 'E' },
            { id: 14, level: 4, name: 'Feld', shortcut: 'F' },
          ],
          isLastPage: true,
        });
      }
      if (url.includes('/locations/levels')) {
        return ANTWORT({
          entries: [
            { id: 100, parentId: 0, dimensionId: 11, name: '1', position: 1 },
            { id: 200, parentId: 100, dimensionId: 12, name: '8', position: 1 },
            { id: 300, parentId: 200, dimensionId: 13, name: 'A', position: 1 },
            { id: 400, parentId: 300, dimensionId: 14, name: '16', position: 1 },
          ],
          isLastPage: true,
        });
      }
      const seite = Number(new URL(url, 'https://x').searchParams.get('page') ?? 1);
      return ANTWORT({
        entries: seite === 1 ? seite1 : seite2,
        isLastPage: seite >= 2,
        lastPageNumber: 2,
      });
    });

    const legeLagerorteAn = await lade();
    const res = await legeLagerorteAn(['H1/R8/EA F16-K01'], { warehouseId: 106, probelauf: false });

    expect(res.bestehende).toBe(251);
    expect(res.vorhanden).toBe(1);
    expect(res.angelegt).toBe(0);
    expect(geschrieben).toHaveLength(0);
  });

  it('schreibt nicht, wenn die Struktur des Lagers unvollständig lesbar ist', async () => {
    // Wird ein vorhandener Knoten übersehen, entsteht ein zweites Feld
    // gleichen Namens. Deshalb ist das ein harter Abbruch, kein Hinweis.
    const geschrieben: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
      if (init?.method === 'POST') {
        geschrieben.push(url);
        return ANTWORT({ id: 1 });
      }
      if (url.includes('/locations/dimensions')) {
        return ANTWORT({
          entries: [
            { id: 11, level: 1, name: 'Halle', shortcut: 'H' },
            { id: 12, level: 2, name: 'Regal', shortcut: 'R' },
            { id: 13, level: 3, name: 'Ebene', shortcut: 'E' },
            { id: 14, level: 4, name: 'Feld', shortcut: 'F' },
          ],
          isLastPage: true,
        });
      }
      if (url.includes('/locations/levels')) {
        // Volle Seiten, und laut Plenty gibt es mehr, als wir holen dürfen.
        return ANTWORT({
          entries: Array.from({ length: 250 }, (_, i) => ({
            id: 5000 + i, parentId: 0, dimensionId: 11, name: String(i), position: i,
          })),
          isLastPage: false,
          lastPageNumber: 500,
        });
      }
      return ANTWORT({
        entries: [{ id: 1, fullLabel: 'H1/R8/EA F15-K10', purposeKey: 'pickup', statusKey: 'active' }],
        isLastPage: true,
      });
    });

    const legeLagerorteAn = await lade();
    const res = await legeLagerorteAn(['H1/R8/EA F16-K01'], { warehouseId: 106, probelauf: false });

    expect(res.ok).toBe(false);
    expect(res.error).toContain('Struktur');
    expect(geschrieben).toHaveLength(0);
  });

  it('findet ein vorhandenes Feld auch in der anderen Schreibweise', async () => {
    // Der Kern des Dublettenproblems: Plenty führt "F2" und "F02" nebeneinander.
    // Wird nur nach "02" gesucht, entsteht ein zweites Feld daneben.
    const { fetchMock, geschrieben } = attrappe({
      knoten: [
        { id: 100, parentId: 0, dimensionId: 11, name: '1', position: 1 },
        { id: 200, parentId: 100, dimensionId: 12, name: '8', position: 1 },
        { id: 300, parentId: 200, dimensionId: 13, name: 'A', position: 1 },
        // Das vorhandene Feld heißt "2" — der gesuchte Code sagt "F02".
        { id: 400, parentId: 300, dimensionId: 14, name: '2', position: 1 },
      ],
      orte: [{ id: 1, fullLabel: 'H1/R8/EA F2-K10', purposeKey: 'pickup', statusKey: 'active' }],
    });
    vi.stubGlobal('fetch', fetchMock);
    const legeLagerorteAn = await lade();
    const res = await legeLagerorteAn(['H1/R8/EA F02-K11'], { warehouseId: 106, probelauf: false });

    expect(res.neueKnoten).toBe(0);
    expect(geschrieben.filter((g) => g.url.includes('/locations/levels'))).toHaveLength(0);
    expect(geschrieben[0].body).toMatchObject({ levelId: 400, label: 'K11' });
  });

  it('legt ein neues Feld in der Schreibweise seiner Geschwister an', async () => {
    const { fetchMock, geschrieben } = attrappe({
      knoten: [
        { id: 100, parentId: 0, dimensionId: 11, name: '1', position: 1 },
        { id: 200, parentId: 100, dimensionId: 12, name: '8', position: 1 },
        { id: 300, parentId: 200, dimensionId: 13, name: 'A', position: 1 },
        // Die Geschwister sind aufgefüllt — das neue Feld muss es auch sein.
        { id: 400, parentId: 300, dimensionId: 14, name: '02', position: 1 },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);
    const legeLagerorteAn = await lade();
    await legeLagerorteAn(['H1/R8/EA F03-K01'], { warehouseId: 106, probelauf: false });

    const knoten = geschrieben.find((g) => g.url.includes('/locations/levels'));
    expect(knoten?.body).toMatchObject({ name: '03' });
  });

  it('wiederholt einen Schreibzugriff, den PlentyONE ausgebremst hat', async () => {
    let versuche = 0;
    const geschrieben: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
      if (init?.method === 'POST') {
        versuche += 1;
        // Der erste Versuch läuft in die Schreibbremse, der zweite geht durch.
        if (versuche === 1) return ANTWORT({ error: 'short period write limit reached' }, 429);
        geschrieben.push(url);
        return ANTWORT({ id: 5555 });
      }
      if (url.includes('/locations/dimensions')) {
        return ANTWORT({
          entries: [
            { id: 11, level: 1, name: 'Halle', shortcut: 'H' },
            { id: 12, level: 2, name: 'Regal', shortcut: 'R' },
            { id: 13, level: 3, name: 'Ebene', shortcut: 'E' },
            { id: 14, level: 4, name: 'Feld', shortcut: 'F' },
          ],
          isLastPage: true,
        });
      }
      if (url.includes('/locations/levels')) {
        return ANTWORT({
          entries: [
            { id: 100, parentId: 0, dimensionId: 11, name: '1', position: 1 },
            { id: 200, parentId: 100, dimensionId: 12, name: '8', position: 1 },
            { id: 300, parentId: 200, dimensionId: 13, name: 'A', position: 1 },
            { id: 400, parentId: 300, dimensionId: 14, name: '15', position: 1 },
          ],
          isLastPage: true,
        });
      }
      return ANTWORT({
        entries: [{ id: 1, fullLabel: 'H1/R8/EA F15-K10', purposeKey: 'pickup', statusKey: 'active' }],
        isLastPage: true,
      });
    });

    const legeLagerorteAn = await lade();
    const res = await legeLagerorteAn(['H1/R8/EA F15-K11'], { warehouseId: 106, probelauf: false });

    expect(res.angelegt).toBe(1);
    expect(res.fehler).toBe(0);
    expect(res.schreiblimit).toBe(false);
    expect(geschrieben).toHaveLength(1);
  }, 15_000);

  it('legt denselben Code in einer Liste nur einmal an', async () => {
    const { fetchMock, geschrieben } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const legeLagerorteAn = await lade();
    const res = await legeLagerorteAn(['H1/R8/EA F16-K01', 'H1/R8/EA F16-K01'], {
      warehouseId: 106,
      probelauf: false,
    });

    expect(res.angelegt).toBe(1);
    expect(res.vorhanden).toBe(1);
    expect(geschrieben.filter((g) => g.url.endsWith('/rest/warehouses/locations') || g.url.includes('/rest/warehouses/locations?')).length)
      .toBe(1);
  });
});
