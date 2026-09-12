/**
 * Testet das Ordnen des Laufwegs.
 *
 * Der Fehler, der repariert wird: In Burlo stand unter H1/R6/EA die Folge
 * F16, F17, F18, F01, F02 … — neue Knoten wurden mit "letzte Position + 1"
 * hinten angehängt statt einsortiert. Der Kommissionierer läuft dann zu Fach
 * 16 und muss zu Fach 1 zurück.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findeDubletten, planeLaufweg, sortiereKnoten, vergleichsname, zerlegeName } from './laufweg';
import type { Knoten } from './lagerort-anlegen';

const k = (id: number, name: string, position: number, parentId = 100, dimensionId = 7): Knoten =>
  ({ id, name, position, parentId, dimensionId });

describe('zerlegeName', () => {
  it('trennt Vorsatz und Zahl', () => {
    expect(zerlegeName('F16')).toEqual({ vorsatz: 'F', zahl: 16 });
    expect(zerlegeName('F01')).toEqual({ vorsatz: 'F', zahl: 1 });
    expect(zerlegeName('H9')).toEqual({ vorsatz: 'H', zahl: 9 });
  });

  it('lässt Namen ohne Zahl ganz', () => {
    expect(zerlegeName('EA')).toEqual({ vorsatz: 'EA', zahl: null });
    expect(zerlegeName('HOF')).toEqual({ vorsatz: 'HOF', zahl: null });
    expect(zerlegeName('RKTL')).toEqual({ vorsatz: 'RKTL', zahl: null });
  });
});

describe('vergleichsname', () => {
  it('macht aus F1 und F01 denselben Schlüssel', () => {
    expect(vergleichsname('F1')).toBe(vergleichsname('F01'));
    expect(vergleichsname('F007')).toBe('F7');
  });

  it('lässt Namen ohne Zahl unverändert', () => {
    expect(vergleichsname('EBZ')).toBe('EBZ');
  });
});

describe('sortiereKnoten', () => {
  it('sortiert Zahlen als Zahlen, nicht als Text', () => {
    const namen = [k(1, 'F10', 1), k(2, 'F2', 2), k(3, 'F1', 3)]
      .sort(sortiereKnoten)
      .map((x) => x.name);
    expect(namen).toEqual(['F1', 'F2', 'F10']);
  });

  it('stellt HOF hinter H1 bis H9', () => {
    const namen = [k(1, 'HOF', 1), k(2, 'H9', 2), k(3, 'H1', 3)]
      .sort(sortiereKnoten)
      .map((x) => x.name);
    expect(namen).toEqual(['H1', 'H9', 'HOF']);
  });

  it('sortiert Ebenen alphabetisch: EA, EB, EBZ, EC', () => {
    const namen = [k(1, 'EC', 1), k(2, 'EBZ', 2), k(3, 'EA', 3), k(4, 'EB', 4)]
      .sort(sortiereKnoten)
      .map((x) => x.name);
    expect(namen).toEqual(['EA', 'EB', 'EBZ', 'EC']);
  });
});

describe('planeLaufweg', () => {
  it('repariert genau den Fall aus Burlo: F16, F17, F18 vor F01', () => {
    const knoten = [
      k(1, 'F16', 1), k(2, 'F17', 2), k(3, 'F18', 3),
      k(4, 'F01', 4), k(5, 'F02', 5), k(6, 'F03', 6),
    ];
    const { aenderungen } = planeLaufweg(knoten);
    const neu = new Map(aenderungen.map((a) => [a.name, a.neu]));

    expect(neu.get('F01')).toBe(1);
    expect(neu.get('F02')).toBe(2);
    expect(neu.get('F03')).toBe(3);
    expect(neu.get('F16')).toBe(4);
    expect(neu.get('F17')).toBe(5);
    expect(neu.get('F18')).toBe(6);
  });

  it('meldet nichts, wenn die Reihenfolge schon stimmt', () => {
    const knoten = [k(1, 'F01', 1), k(2, 'F02', 2), k(3, 'F03', 3)];
    expect(planeLaufweg(knoten).aenderungen).toHaveLength(0);
  });

  it('nummeriert je Elternknoten getrennt', () => {
    const knoten = [
      k(1, 'F02', 5, 100), k(2, 'F01', 9, 100),
      k(3, 'F02', 5, 200), k(4, 'F01', 9, 200),
    ];
    const { aenderungen, gruppen } = planeLaufweg(knoten);
    expect(gruppen).toBe(2);
    // In jeder Gruppe beginnt die Zählung wieder bei 1.
    expect(aenderungen.filter((a) => a.neu === 1).map((a) => a.parentId).sort()).toEqual([100, 200]);
  });

  it('vermischt Spalten nicht, auch bei denselben Eltern', () => {
    const knoten = [k(1, 'R2', 9, 100, 10), k(2, 'R1', 5, 100, 10), k(3, 'F01', 3, 100, 7)];
    expect(planeLaufweg(knoten).gruppen).toBe(2);
  });

  it('ist wiederholbar — der zweite Lauf ändert nichts mehr', () => {
    const knoten = [k(1, 'F16', 1), k(2, 'F01', 2)];
    for (const a of planeLaufweg(knoten).aenderungen) {
      const treffer = knoten.find((x) => x.id === a.id);
      if (treffer) treffer.position = a.neu;
    }
    expect(planeLaufweg(knoten).aenderungen).toHaveLength(0);
  });
});

describe('findeDubletten', () => {
  it('erkennt F1 neben F01 unter demselben Regal', () => {
    const d = findeDubletten([k(1, 'F01', 1), k(2, 'F1', 2), k(3, 'F02', 3)]);
    expect(d).toHaveLength(1);
    expect(d[0].schluessel).toBe('F1');
    expect(d[0].namen.sort()).toEqual(['F01', 'F1']);
    expect(d[0].ids.sort()).toEqual([1, 2]);
  });

  it('hält verschiedene Eltern auseinander', () => {
    expect(findeDubletten([k(1, 'F01', 1, 100), k(2, 'F1', 1, 200)])).toHaveLength(0);
  });

  it('meldet nichts bei eindeutigen Namen', () => {
    expect(findeDubletten([k(1, 'F01', 1), k(2, 'F02', 2), k(3, 'EA', 1, 100, 11)])).toHaveLength(0);
  });
});

describe('ordneLaufweg', () => {
  const KNOTEN = [
    { id: 3046, parentId: 0, dimensionId: 9, name: 'H1', position: 1 },
    { id: 3100, parentId: 3046, dimensionId: 10, name: 'R1', position: 1 },
    { id: 3110, parentId: 3100, dimensionId: 11, name: 'EA', position: 1 },
    { id: 3120, parentId: 3110, dimensionId: 7, name: 'F16', position: 1 },
    { id: 3121, parentId: 3110, dimensionId: 7, name: 'F01', position: 2 },
  ];

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

  function attrappe() {
    const geschrieben: Array<{ url: string; body: unknown }> = [];
    const antwort = (b: unknown) =>
      new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
    const fetchMock = async (url: string, init?: RequestInit) => {
      if (url.includes('/rest/login')) return antwort({ access_token: 't', expires_in: 3600, user_id: 1 });
      if (init?.method === 'PUT') {
        geschrieben.push({ url, body: init.body ? JSON.parse(String(init.body)) : null });
        return antwort({ ok: true });
      }
      if (url.includes('/locations/dimensions')) {
        return antwort({
          entries: [
            { id: 9, level: 1, name: 'Halle', shortcut: 'H' },
            { id: 10, level: 2, name: 'Regal', shortcut: 'R' },
            { id: 11, level: 3, name: 'Ebene', shortcut: 'E' },
            { id: 7, level: 4, name: 'Feld', shortcut: 'F' },
          ],
          isLastPage: true,
        });
      }
      if (url.includes('/locations/levels')) return antwort({ entries: KNOTEN, isLastPage: true });
      return antwort({ entries: [], isLastPage: true });
    };
    return { fetchMock, geschrieben };
  }

  it('schreibt im Probelauf nichts', async () => {
    const { fetchMock, geschrieben } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const { ordneLaufweg } = await import('./laufweg');
    const res = await ordneLaufweg({ warehouseId: 106 });

    expect(res.probelauf).toBe(true);
    expect(geschrieben).toHaveLength(0);
    expect(res.aenderungen).toHaveLength(2);
    expect(res.knoten).toBe(5);
  });

  it('schreibt nur die Position, nicht mehr', async () => {
    const { fetchMock, geschrieben } = attrappe();
    vi.stubGlobal('fetch', fetchMock);
    const { ordneLaufweg } = await import('./laufweg');
    const res = await ordneLaufweg({ warehouseId: 106, probelauf: false });

    expect(res.geschrieben).toBe(2);
    expect(res.fehler).toBe(0);
    // F01 muss auf 1, F16 auf 2.
    const nachId = new Map(geschrieben.map((g) => [Number(g.url.split('/').pop()?.split('?')[0]), g.body]));
    expect((nachId.get(3121) as { position: number }).position).toBe(1);
    expect((nachId.get(3120) as { position: number }).position).toBe(2);
    // Der Name bleibt, was er war — umbenannt wird nichts.
    expect((nachId.get(3121) as { name: string }).name).toBe('F01');
  });

  it('bricht ab, wenn die Struktur nur teilweise gelesen wurde', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      const antwort = (b: unknown, status = 200) =>
        new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
      if (url.includes('/rest/login')) return antwort({ access_token: 't', expires_in: 3600, user_id: 1 });
      if (url.includes('/locations/dimensions')) return antwort({ entries: [{ id: 7, level: 4, name: 'Feld', shortcut: 'F' }], isLastPage: true });
      // Immer eine volle Seite ohne Ende-Angabe: die Struktur bleibt unvollständig.
      if (url.includes('/locations/levels')) {
        return antwort({
          entries: Array.from({ length: 250 }, (_, i) => ({ id: i + 1, parentId: 0, dimensionId: 7, name: `F${i + 1}`, position: 1 })),
          isLastPage: false,
        });
      }
      return antwort({ entries: [] });
    });
    const { ordneLaufweg } = await import('./laufweg');
    const res = await ordneLaufweg({ warehouseId: 106, probelauf: false });

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/teilweise gelesen/);
  });
});

describe('Laufweg folgt dem Hallenplan, nicht der Zahlenreihe', () => {
  const halle = (id: number, name: string, position: number): Knoten =>
    ({ id, name, position, parentId: 0, dimensionId: 9 });
  const regal = (id: number, name: string, position: number, halleId: number): Knoten =>
    ({ id, name, position, parentId: halleId, dimensionId: 10 });

  it('ordnet die Hallen H3, H2, H1, H4, H5, H6', () => {
    const knoten = [
      halle(1, 'H1', 1), halle(2, 'H2', 2), halle(3, 'H3', 3),
      halle(4, 'H4', 4), halle(5, 'H5', 5), halle(6, 'H6', 6),
    ];
    const { aenderungen } = planeLaufweg(knoten);
    const platz = new Map(knoten.map((k) => [k.name, k.position]));
    for (const a of aenderungen) platz.set(a.name, a.neu);

    expect([...platz.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n))
      .toEqual(['H3', 'H2', 'H1', 'H4', 'H5', 'H6']);
  });

  it('hängt unbekannte Hallen hinten an, statt sie zu verschlucken', () => {
    const knoten = [halle(1, 'H1', 1), halle(2, 'HOF', 2), halle(3, 'H3', 3), halle(4, 'HWagen', 4)];
    const { aenderungen } = planeLaufweg(knoten);
    const platz = new Map(knoten.map((k) => [k.name, k.position]));
    for (const a of aenderungen) platz.set(a.name, a.neu);

    const folge = [...platz.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n);
    expect(folge.slice(0, 2)).toEqual(['H3', 'H1']);
    expect(folge.slice(2).sort()).toEqual(['HOF', 'HWagen']);
  });

  it('sortiert die Regale je Halle nach dem Plan', () => {
    // Halle 1 beginnt laut Plan bei den roten Fachbodenregalen R13 … R9.
    const knoten = [
      halle(100, 'H1', 1),
      regal(1, 'R1', 1, 100), regal(2, 'R5', 2, 100), regal(3, 'R13', 3, 100), regal(4, 'R9', 4, 100),
    ];
    const { aenderungen } = planeLaufweg(knoten);
    const platz = new Map(knoten.filter((k) => k.dimensionId === 10).map((k) => [k.name, k.position]));
    for (const a of aenderungen.filter((x) => x.dimensionId === 10)) platz.set(a.name, a.neu);

    expect([...platz.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n))
      .toEqual(['R13', 'R9', 'R1', 'R5']);
  });

  it('nimmt je Halle die eigene Reihenfolge', () => {
    // In H2 beginnt der Rundgang bei R6; R1 kommt spaet, R7 ganz am Ende.
    const knoten = [
      halle(200, 'H2', 1),
      regal(1, 'R1', 1, 200), regal(2, 'R6', 2, 200), regal(3, 'R7', 3, 200),
    ];
    const { aenderungen } = planeLaufweg(knoten);
    const platz = new Map([['R1', 1], ['R6', 2], ['R7', 3]]);
    for (const a of aenderungen) platz.set(a.name, a.neu);
    expect([...platz.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n))
      .toEqual(['R6', 'R1', 'R7']);
  });

  it('lässt Felder natürlich aufsteigend', () => {
    const knoten = [
      halle(100, 'H1', 1),
      regal(300, 'R1', 1, 100),
      { id: 400, name: 'EA', position: 1, parentId: 300, dimensionId: 11 },
      { id: 501, name: 'F16', position: 1, parentId: 400, dimensionId: 7 },
      { id: 502, name: 'F01', position: 2, parentId: 400, dimensionId: 7 },
    ];
    const neu = new Map(planeLaufweg(knoten).aenderungen.map((a) => [a.name, a.neu]));
    expect(neu.get('F01')).toBe(1);
    expect(neu.get('F16')).toBe(2);
  });

  it('dreht die Felder um, wo der Mann von hinten hereinkommt', () => {
    // H1/R6: Feld 18 liegt links, Feld 1 hinten durch — er laeuft rueckwaerts.
    const knoten = [
      halle(100, 'H1', 1),
      regal(300, 'R6', 1, 100),
      { id: 400, name: 'EA', position: 1, parentId: 300, dimensionId: 11 },
      { id: 501, name: 'F01', position: 1, parentId: 400, dimensionId: 7 },
      { id: 502, name: 'F18', position: 2, parentId: 400, dimensionId: 7 },
    ];
    const neu = new Map(planeLaufweg(knoten).aenderungen.map((a) => [a.name, a.neu]));
    expect(neu.get('F18')).toBe(1);
    expect(neu.get('F01')).toBe(2);
  });
});
