/**
 * Testet die Suche nach alternativen Lagerplätzen gegen eine simulierte
 * Plenty-API.
 *
 * Der Kern der Prüfung: Das Werkzeug darf nichts schreiben, es muss die Lage
 * ehrlich benennen (nie verbucht ≠ verbucht, aber weg), und es darf keine
 * Plätze vorschlagen, die zur Größe des Artikels nicht passen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ANTWORT = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Ein Lager mit vier belegten Plätzen und benachbarten IDs. */
function attrappe(
  opts: {
    /** Lagerplatz je Varianten-ID. 0 = Standard-Lagerplatz, null = kein Bestand. */
    bestand?: Record<number, number | null>;
    /** Gewicht/Maße der gesuchten Variante. */
    masse?: Record<string, number>;
    /** Freitext der gesuchten Variante (kann einen Lagerplatz nennen). */
    text?: string;
    bewegungen?: boolean;
    /** Ob die Namenssuche einen gleichnamigen Artikel findet. */
    dublette?: boolean;
    /** Ob auf dem Soll-Platz ein Fremdartikel liegt. */
    fremdAufPlatz?: boolean;
  } = {},
) {
  const orte = [
    { id: 100, fullLabel: 'H1/R6/EA F05-K12' },
    { id: 101, fullLabel: 'H1/R6/EA F06-K12' },
    { id: 102, fullLabel: 'H1/R6/EA F04-K12' },
    { id: 200, fullLabel: 'H2/R3/EA F01-P16' },
    { id: 300, fullLabel: 'H3/R1/EB F09-0' },
  ];
  const bestand = opts.bestand ?? { 5000: 0, 4999: 100, 5001: 101 };
  const gerufen: string[] = [];
  const geschrieben: string[] = [];

  const fetchMock = async (url: string, init?: RequestInit) => {
    gerufen.push(url);
    // Der Login ist selbst ein POST und zaehlt nicht als Schreibzugriff.
    if (url.includes('/rest/login')) return ANTWORT({ access_token: 't', expires_in: 3600, user_id: 1 });
    if (init?.method && init.method !== 'GET') {
      geschrieben.push(`${init.method} ${url}`);
      return ANTWORT({ ok: true });
    }

    if (url.includes('/stock/movements')) {
      if (!opts.bewegungen) return ANTWORT({ error: 'nicht verfügbar' }, 404);
      const p = new URL(url).searchParams;
      // Abfrage zum Artikel selbst: seine Vergangenheit (lag mal auf 200).
      if (p.get('variationId') === '5000') {
        return ANTWORT({
          entries: [{ variationId: 5000, storageLocationId: 200, createdAt: '2026-03-02T09:00:00+01:00' }],
        });
      }
      // Abfrage übers Zeitfenster: was gleichzeitig gebucht wurde.
      return ANTWORT({
        entries: [
          { variationId: 5000, storageLocationId: 200, createdAt: '2026-03-02T09:00:00+01:00' },
          { variationId: 7777, storageLocationId: 300, createdAt: '2026-03-02T09:05:00+01:00' },
        ],
      });
    }
    if (url.includes('/rest/warehouses/locations/stock/')) {
      if (!opts.fremdAufPlatz) return ANTWORT({ entries: [] });
      return ANTWORT({ entries: [{ variationId: 5000 }, { variationId: 5003 }] });
    }
    if (url.includes('/stock/storageLocations')) {
      const id = Number(new URL(url).searchParams.get('variationId'));
      const ort = bestand[id];
      if (ort === null || ort === undefined) return ANTWORT({ entries: [] });
      return ANTWORT({ entries: [{ variationId: id, storageLocationId: ort, quantity: 3 }] });
    }
    if (url.includes('/rest/stockmanagement/warehouses')) {
      return ANTWORT({ entries: [{ id: 106, name: 'Hauptlager' }] });
    }
    if (url.includes('/locations')) {
      return ANTWORT({ entries: orte, isLastPage: true, totalsCount: orte.length });
    }
    if (url.includes('/images')) return ANTWORT([{ urlPreview: 'https://bild/x.jpg', position: 0 }]);
    if (url.includes('/descriptions')) return ANTWORT([{ description: opts.text ?? 'Ein Artikel' }]);

    if (url.includes('/rest/items/variations')) {
      const p = new URL(url).searchParams;
      // Es gibt nur diese Varianten — alles andere ist im Lager unbekannt.
      const bekannt = new Set([...Object.keys(bestand).map(Number), 4995, 4996, 4997, 4999, 5001, 5003, 6000, 7777]);
      const ids = (p.get('id') ?? '').split(',').map(Number).filter(Boolean);
      let gefragt: number[] = [];
      if (ids.length) gefragt = ids.filter((id) => bekannt.has(id));
      else if (p.get('numberExact') === 'ART-5000') gefragt = [5000];
      else if (p.has('name')) gefragt = opts.dublette ? [6000] : [];
      return ANTWORT({
        entries: gefragt.map((id) => ({
          id,
          itemId: 9000 + id,
          number: `ART-${id}`,
          name:
            id === 6000 || id === 5000
              ? 'Bosch Winkelschleifer GWS'
              : id === 4995
                ? 'Kabel' // zu unspezifisch für eine Namenssuche
                : `Artikel ${id}`,
          createdAt: id === 5003 ? '2026-05-20T11:00:00+01:00' : '2026-03-02T09:00:00+01:00',
          ...(id === 5000 ? (opts.masse ?? { weightG: 500, widthMM: 100, lengthMM: 100, heightMM: 100 }) : {}),
        })),
      });
    }
    return ANTWORT({ entries: [] });
  };
  return { fetchMock, gerufen, geschrieben };
}

async function suche(mock: ReturnType<typeof attrappe>, eingabe = '5000', opts: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', mock.fetchMock);
  const { sucheAlternativePlaetze } = await import('./suche');
  return sucheAlternativePlaetze({ eingabe, warehouseId: 106, ...opts });
}

describe('sucheAlternativePlaetze', () => {
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

  it('schreibt nichts in Plenty', async () => {
    const mock = attrappe();
    await suche(mock);
    expect(mock.geschrieben).toEqual([]);
  });

  it('meldet ohne Konfiguration, statt zu werfen', async () => {
    delete process.env.PLENTY_BASE_URL;
    const mock = attrappe();
    const res = await suche(mock);
    expect(res.konfiguriert).toBe(false);
    expect(res.error).toMatch(/nicht eingerichtet/);
  });

  it('meldet einen unbekannten Artikel als Fehler statt als leeres Ergebnis', async () => {
    const mock = attrappe();
    const res = await suche(mock, '123456789');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/kein Artikel gefunden/);
  });

  it('findet den Artikel auch über die Variantennummer', async () => {
    const mock = attrappe();
    const res = await suche(mock, 'ART-5000');
    expect(res.ok).toBe(true);
    expect(res.gesucht?.variationId).toBe(5000);
  });

  it('unterscheidet „nie eingeräumt" von „verbucht"', async () => {
    const nie = await suche(attrappe({ bestand: { 5000: 0 } }));
    expect(nie.lage).toBe('nur-standardplatz');
    expect(nie.lageText).toMatch(/Wareneingang/);

    vi.resetModules();
    const verbucht = await suche(attrappe({ bestand: { 5000: 100 } }));
    expect(verbucht.lage).toBe('verbucht');
  });

  it('meldet fehlenden Bestand eigens', async () => {
    const res = await suche(attrappe({ bestand: { 5000: null } }));
    expect(res.lage).toBe('ohne-bestand');
    expect(res.lageText).toMatch(/verkauft/);
  });

  it('schlägt die Plätze der ID-Nachbarn vor', async () => {
    const res = await suche(attrappe());
    const codes = res.kandidaten.map((k) => k.code);
    expect(codes).toContain('H1/R6/EA F05-K12'); // Nachbar 4999
    expect(codes).toContain('H1/R6/EA F06-K12'); // Nachbar 5001
    expect(res.nachbarn.map((n) => n.variationId)).toEqual(expect.arrayContaining([4999, 5001]));
  });

  it('überspringt Lücken im Nummernkreis, statt abzubrechen', async () => {
    const res = await suche(attrappe(), '5000', { idSpanne: 2 });
    expect(res.nachbarn.map((n) => n.variationId)).not.toContain(5002);
    expect(res.ok).toBe(true);
  });

  it('liest den Lagerplatz aus dem eigenen Text und stellt ihn nach oben', async () => {
    const res = await suche(attrappe({ text: 'Zuletzt gesehen H3R1B9', bestand: { 5000: null } }));
    expect(res.kandidaten[0].code).toBe('H3/R1/EB F09-0');
    expect(res.kandidaten[0].belege[0].signal).toBe('eigener-text');
  });

  it('lädt zu jedem Nachbarn ein Bild für die Sichtprüfung', async () => {
    const res = await suche(attrappe());
    expect(res.nachbarn.every((n) => n.bildUrl === 'https://bild/x.jpg')).toBe(true);
  });

  it('wertet Plätze ab, die zur Größe nicht passen', async () => {
    // Eine 80-kg-Maschine gehört nicht in Kleinteilkiste K12.
    const res = await suche(attrappe({ masse: { weightG: 80_000, widthMM: 1200, lengthMM: 800, heightMM: 900 } }));
    const kiste = res.kandidaten.find((k) => k.code === 'H1/R6/EA F05-K12');
    expect(res.gesucht?.klasse).toBe('grossteil');
    expect(kiste?.einwaende.join(' ')).toMatch(/Kleinteilkiste/);
  });

  it('schlägt die Fächer daneben vor, aber nur vorhandene', async () => {
    const res = await suche(attrappe());
    const codes = res.kandidaten.map((k) => k.code);
    expect(codes).toContain('H1/R6/EA F04-K12'); // existiert als Lagerort 102
    expect(codes).not.toContain('H1/R6/EA F07-K12'); // gibt es nicht
  });

  it('nimmt Artikel aus demselben Einlagerungsfenster auf', async () => {
    const res = await suche(attrappe({ bewegungen: true }));
    expect(res.einlagerung.map((k) => k.variationId)).toContain(7777);
    const eingelagert = res.kandidaten.find((k) => k.code === 'H3/R1/EB F09-0');
    expect(eingelagert?.belege.some((b) => b.signal === 'einlagerung')).toBe(true);
  });

  it('läuft weiter, wenn es keine Bewegungsdaten gibt', async () => {
    const res = await suche(attrappe({ bewegungen: false }));
    expect(res.ok).toBe(true);
    expect(res.diagnose.join(' ')).toMatch(/Bestandsbewegungen/);
  });

  it('gibt den Laufzettel nach Laufweg sortiert aus', async () => {
    const res = await suche(attrappe());
    const hallen = res.laufzettel.map((k) => k.segment?.halle ?? 99);
    expect(hallen).toEqual([...hallen].sort((a, b) => a - b));
  });

  it('liest aus den Warenbewegungen, wo der Artikel früher lag', async () => {
    const res = await suche(attrappe({ bewegungen: true, bestand: { 5000: null } }));
    const frueher = res.kandidaten.find((k) => k.code === 'H2/R3/EA F01-P16');
    expect(frueher?.belege.some((b) => b.signal === 'historie')).toBe(true);
  });

  it('findet den gleichnamigen Artikel und nimmt seinen Platz auf', async () => {
    const res = await suche(attrappe({ dublette: true, bestand: { 5000: null, 6000: 300 } }));
    expect(res.dubletten.map((d) => d.variationId)).toContain(6000);
    const platz = res.kandidaten.find((k) => k.code === 'H3/R1/EB F09-0');
    expect(platz?.belege.some((b) => b.signal === 'namensdublette')).toBe(true);
  });

  it('sucht nicht nach zu unspezifischen Namen', async () => {
    // Ein Name wie "Kabel" träfe das halbe Lager — dann lieber gar nicht suchen.
    const mock = attrappe({ dublette: true });
    vi.stubGlobal('fetch', mock.fetchMock);
    const { sucheAlternativePlaetze } = await import('./suche');
    await sucheAlternativePlaetze({ eingabe: '4995', warehouseId: 106 }); // heißt nur "Kabel"
    expect(mock.gerufen.some((u) => u.includes('name='))).toBe(false);
  });

  it('lässt sich die Namenssuche abschalten', async () => {
    const mock = attrappe({ dublette: true });
    vi.stubGlobal('fetch', mock.fetchMock);
    const { sucheAlternativePlaetze } = await import('./suche');
    const res = await sucheAlternativePlaetze({ eingabe: '5000', warehouseId: 106, mitNamenssuche: false });
    expect(res.dubletten).toEqual([]);
  });

  it('wertet den gleichen Anlagetag als eigenen Hinweis', async () => {
    const res = await suche(attrappe());
    const platz = res.kandidaten.find((k) => k.code === 'H1/R6/EA F05-K12');
    expect(platz?.belege.some((b) => b.signal === 'anlagedatum')).toBe(true);
  });

  it('wertet einen abweichenden Anlagetag nicht als Hinweis', async () => {
    // 5003 wurde Monate später angelegt — gleiche Lieferung ausgeschlossen.
    const res = await suche(attrappe({ bestand: { 5000: 0, 5003: 300 } }), '5000', { idSpanne: 3 });
    const platz = res.kandidaten.find((k) => k.code === 'H3/R1/EB F09-0');
    expect(platz?.belege.some((b) => b.signal === 'anlagedatum')).toBe(false);
  });

  it('zeigt, wer sonst auf dem Soll-Platz liegt', async () => {
    const res = await suche(attrappe({ bestand: { 5000: 100 }, fremdAufPlatz: true }));
    expect(res.aufDemSollplatz.map((k) => k.variationId)).toContain(5003);
  });

  it('liest die Lagerortliste nicht bei jeder Suche neu', async () => {
    // Die Liste zu lesen kostet je nach Lagergröße zwanzig und mehr Abrufe.
    // Sie ändert sich nur beim Anlegen von Lagerorten — sie jedes Mal neu zu
    // holen war der größte Zeitfresser der Suche.
    const mock = attrappe();
    vi.stubGlobal('fetch', mock.fetchMock);
    const { sucheAlternativePlaetze } = await import('./suche');

    await sucheAlternativePlaetze({ eingabe: '5000', warehouseId: 106 });
    const nachErstem = mock.gerufen.filter((u) => u.includes('/locations')).length;
    expect(nachErstem).toBeGreaterThan(0);

    await sucheAlternativePlaetze({ eingabe: '5000', warehouseId: 106 });
    expect(mock.gerufen.filter((u) => u.includes('/locations')).length).toBe(nachErstem);
  });

  it('fragt Bilder nicht mehrfach ab', async () => {
    const mock = attrappe();
    vi.stubGlobal('fetch', mock.fetchMock);
    const { sucheAlternativePlaetze } = await import('./suche');

    await sucheAlternativePlaetze({ eingabe: '5000', warehouseId: 106 });
    const nachErstem = mock.gerufen.filter((u) => u.includes('/images')).length;
    expect(nachErstem).toBeGreaterThan(0);

    await sucheAlternativePlaetze({ eingabe: '5000', warehouseId: 106 });
    expect(mock.gerufen.filter((u) => u.includes('/images')).length).toBe(nachErstem);
  });

  it('lädt Beschreibungstexte nur, wo sie auch ausgewertet werden', async () => {
    // Für die ID-Nachbarn kostete der Textabruf je einen Aufruf, ohne dass das
    // Ergebnis in die Bewertung einging.
    const mock = attrappe();
    vi.stubGlobal('fetch', mock.fetchMock);
    const { sucheAlternativePlaetze } = await import('./suche');
    await sucheAlternativePlaetze({ eingabe: '5000', warehouseId: 106, idSpanne: 5 });

    // Nur der gesuchte Artikel selbst — nicht seine zehn Nachbarn.
    expect(mock.gerufen.filter((u) => u.includes('/descriptions')).length).toBe(1);
  });

  it('lässt sich die ID-Spanne vorgeben', async () => {
    const eng = await suche(attrappe(), '5000', { idSpanne: 1 });
    expect(eng.nachbarn.length).toBeLessThanOrEqual(2);
  });
});
