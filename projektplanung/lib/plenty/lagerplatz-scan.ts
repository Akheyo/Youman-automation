/**
 * Lagerplatz-Scan: geht die Artikel MIT BESTAND in PlentyONE durch und sucht in
 * ihren Texten nach Lagerplatz-Codes (z. B. "H6R5A7").
 *
 * NUR LESEND — dieser Scan verändert in Plenty nichts. Er erzeugt die Vorschau,
 * auf deren Grundlage die Lagerplätze später angelegt werden können.
 *
 * Treiber ist die Bestandsliste `/rest/stockmanagement/stock`, nicht der
 * Artikelstamm: Nur was tatsächlich im Lager liegt, braucht einen Lagerplatz.
 * Zu jeder Variante mit Bestand werden anschließend die Texte nachgeladen
 * (Variantennummer, Modell, Externe ID, Name, Beschreibung) und ausgewertet.
 *
 * Der Scan läuft in Häppchen: Ein Aufruf liest eine begrenzte Zahl Seiten bzw.
 * hört nach einem Zeitbudget auf und meldet über `naechsteSeite`, wo es
 * weitergeht. So läuft er auch in Serverless-Umgebungen mit kurzem Timeout
 * durch — die Oberfläche ruft einfach wiederholt auf.
 */

import { getPlentyConfig, plentyConfigured, plentyGet } from './client';
import { bewerteVariante, fasseZusammen, type Befund, type VariantenRohdaten, type Zusammenfassung } from '@/lib/lagerplatz/befund';

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Woher die Liste der zu prüfenden Varianten kommt. */
export type Quelle = 'bestand' | 'alle';

export interface ScanOptionen {
  /** 'bestand' (Standard): nur Artikel mit Bestand. 'alle': gesamter Artikelstamm. */
  quelle?: Quelle;
  /** Seite, ab der gelesen wird (1-basiert wie in Plenty). */
  startSeite?: number;
  /** Wie viele Seiten dieser Aufruf höchstens liest. */
  maxSeiten?: number;
  /** Zeilen pro Seite (Plenty erlaubt bis 250). */
  proSeite?: number;
  /** Zeitbudget in Millisekunden; danach wird sauber abgebrochen. */
  maxDauerMs?: number;
  /** Beschreibungen einzeln nachladen, wenn die Liste keine mitliefert. */
  texteNachladen?: boolean;
  /** Obergrenze für einzeln nachgeladene Beschreibungen pro Aufruf. */
  maxNachladungen?: number;
  /** Nur Varianten mit erkanntem Lagerplatz zurückgeben (kleinere Antwort). */
  nurMitTreffer?: boolean;
}

export interface ScanErgebnis {
  ok: boolean;
  konfiguriert: boolean;
  error: string | null;
  quelle: Quelle;
  /** Gelesene Zeilen der Ausgangsliste (Bestandszeilen bzw. Varianten). */
  gelesen: number;
  /** Varianten mit Bestand, die tatsächlich geprüft wurden. */
  geprueft: number;
  /** Bestandszeilen ohne Bestand (0 Stück), die übersprungen wurden. */
  ohneBestand: number;
  vonSeite: number;
  bisSeite: number;
  /** Nächste zu lesende Seite — null, wenn alles durch ist. */
  naechsteSeite: number | null;
  fertig: boolean;
  /** Gesamtzahl Zeilen laut Plenty, sofern die API sie mitliefert. */
  gesamtLautPlenty: number | null;
  befunde: Befund[];
  zusammenfassung: Zusammenfassung;
  /** Was der Scan über die API gelernt hat — hilft beim Nachvollziehen. */
  diagnose: string[];
  dauerMs: number;
}

interface PlentyListe<T> {
  entries?: T[];
  isLastPage?: boolean;
  lastPageNumber?: number;
  totalsCount?: number;
  page?: number;
}

interface PlentyBestand {
  variationId?: number;
  itemId?: number;
  warehouseId?: number;
  netStock?: number;
  physicalStock?: number;
  reservedStock?: number;
}

interface PlentyVariante {
  id: number;
  itemId: number;
  number?: string | null;
  model?: string | null;
  externalId?: string | null;
  name?: string | null;
  item?: { texts?: PlentyText[] } | null;
  variationDescription?: PlentyText[] | null;
}

interface PlentyText {
  lang?: string;
  name?: string | null;
  name1?: string | null;
  name2?: string | null;
  name3?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  metaDescription?: string | null;
  technicalData?: string | null;
}

/** Zusammengefasster Bestand einer Variante über alle Lager hinweg. */
interface Bestandssumme {
  variationId: number;
  itemId: number | null;
  netto: number;
  physisch: number;
  lager: Set<number>;
}

// ---------------------------------------------------------------------------
// „with"-Parameter aushandeln
// ---------------------------------------------------------------------------

/**
 * Je nach PlentyONE-Ausbaustufe kennt /rest/items/variations unterschiedliche
 * `with`-Werte. Statt einen zu raten, probiert der Scan sie einmal der Reihe
 * nach durch und merkt sich den ersten, der durchgeht.
 */
const WITH_KANDIDATEN = ['item,variationDescription', 'variationDescription', 'item', ''];
let gemerktesWith: string | null = null;
/** Ob /rest/items/variations mehrere IDs auf einmal filtern kann. */
let batchFilterMoeglich: boolean | null = null;

function mitWith(pfad: string, withParam: string): string {
  if (!withParam) return pfad;
  return `${pfad}${pfad.includes('?') ? '&' : '?'}with=${withParam}`;
}

function variantenPfad(seite: number, proSeite: number, withParam: string): string {
  return mitWith(`/rest/items/variations?itemsPerPage=${proSeite}&page=${seite}`, withParam);
}

async function handleWithAus(diagnose: string[]): Promise<string> {
  if (gemerktesWith !== null) return gemerktesWith;
  for (const kandidat of WITH_KANDIDATEN) {
    try {
      await plentyGet<PlentyListe<PlentyVariante>>(variantenPfad(1, 1, kandidat));
      gemerktesWith = kandidat;
      diagnose.push(kandidat ? `Varianten werden mit „with=${kandidat}" gelesen.` : 'Varianten werden ohne „with" gelesen.');
      return kandidat;
    } catch (err) {
      const msg = (err as Error).message;
      // Nur bei „Parameter nicht verstanden" weiterprobieren; echte Fehler
      // (Login, Rechte, Netz) sollen sofort sichtbar werden.
      if (!/HTTP (400|422|500)/.test(msg)) throw err;
      diagnose.push(`„with=${kandidat || '(ohne)'}" wird nicht unterstützt – nächste Variante wird probiert.`);
    }
  }
  gemerktesWith = '';
  return '';
}

// ---------------------------------------------------------------------------
// Texte einsammeln
// ---------------------------------------------------------------------------

/** Fügt alle brauchbaren Textfelder eines Plenty-Textblocks zusammen. */
function textAus(texte: PlentyText[] | null | undefined): string {
  if (!Array.isArray(texte)) return '';
  const teile: string[] = [];
  for (const t of texte) {
    for (const feld of [t.name, t.name1, t.name2, t.name3, t.description, t.shortDescription, t.technicalData, t.metaDescription]) {
      if (typeof feld === 'string' && feld.trim()) teile.push(feld);
    }
  }
  return teile.join('\n');
}

/** Der sprechendste Name einer Variante, sofern die API einen mitliefert. */
function nameAus(v: PlentyVariante): string | null {
  const kandidaten = [v.name, v.variationDescription?.[0]?.name, v.item?.texts?.[0]?.name1, v.item?.texts?.[0]?.name];
  return kandidaten.find((k) => typeof k === 'string' && k.trim()) ?? null;
}

/** Macht aus einer Plenty-Variante die Rohdaten für die Auswertung. */
function rohdatenAus(v: PlentyVariante, bestand?: Bestandssumme, lagerNamen?: Map<number, string>): VariantenRohdaten {
  const beschreibung = [textAus(v.item?.texts), textAus(v.variationDescription)].filter(Boolean).join('\n');
  return {
    variationId: Number(v.id),
    itemId: Number(v.itemId),
    nummer: v.number ?? null,
    modell: v.model ?? null,
    externeId: v.externalId ?? null,
    name: nameAus(v),
    beschreibung: beschreibung || null,
    bestand: bestand ? bestand.netto : null,
    bestandPhysisch: bestand ? bestand.physisch : null,
    lager: bestand
      ? [...bestand.lager].map((id) => lagerNamen?.get(id) ?? `Lager ${id}`).join(', ') || null
      : null,
  };
}

/** Arbeitet eine Liste in kleinen Gruppen parallel ab (schont die API). */
async function inGruppen<T, R>(werte: T[], groesse: number, fn: (wert: T) => Promise<R>): Promise<R[]> {
  const ergebnis: R[] = [];
  for (let i = 0; i < werte.length; i += groesse) {
    ergebnis.push(...(await Promise.all(werte.slice(i, i + groesse).map(fn))));
  }
  return ergebnis;
}

/** Zerteilt eine Liste in Stücke fester Größe. */
function stuecke<T>(werte: T[], groesse: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < werte.length; i += groesse) out.push(werte.slice(i, i + groesse));
  return out;
}

// ---------------------------------------------------------------------------
// Varianten zu bekannten IDs laden
// ---------------------------------------------------------------------------

/**
 * Holt die Variantendaten zu einer Menge IDs. Bevorzugt wird gebündelt gefragt
 * (`?id=1,2,3`); ignoriert die Plenty-Instanz diesen Filter, merkt sich der
 * Scan das und fragt ab dann einzeln.
 */
async function ladeVarianten(
  ids: number[],
  withParam: string,
  diagnose: string[],
): Promise<Map<number, PlentyVariante>> {
  const out = new Map<number, PlentyVariante>();
  if (!ids.length) return out;

  if (batchFilterMoeglich !== false) {
    let gescheitert = false;
    for (const gruppe of stuecke(ids, 50)) {
      try {
        const pfad = mitWith(`/rest/items/variations?id=${gruppe.join(',')}&itemsPerPage=${gruppe.length}`, withParam);
        const res = await plentyGet<PlentyListe<PlentyVariante>>(pfad);
        const eintraege = res?.entries ?? [];
        const erwartet = new Set(gruppe);
        // Liefert Plenty auch nicht angefragte Varianten, wurde der Filter
        // ignoriert – dann ist das Ergebnis unbrauchbar.
        if (!eintraege.every((e) => erwartet.has(Number(e.id)))) {
          gescheitert = true;
          break;
        }
        for (const e of eintraege) out.set(Number(e.id), e);
      } catch {
        gescheitert = true;
        break;
      }
    }
    if (!gescheitert) {
      if (batchFilterMoeglich === null) diagnose.push('Varianten werden gebündelt geladen (50 je Abruf).');
      batchFilterMoeglich = true;
      return out;
    }
    batchFilterMoeglich = false;
    out.clear();
    diagnose.push('Diese Plenty-Instanz filtert nicht nach mehreren IDs – die Varianten werden einzeln geladen (langsamer).');
  }

  const einzeln = await inGruppen(ids, 5, async (id) => {
    try {
      const pfad = mitWith(`/rest/items/variations?id=${id}&itemsPerPage=1`, withParam);
      const res = await plentyGet<PlentyListe<PlentyVariante>>(pfad);
      return res?.entries?.[0] ?? null;
    } catch {
      return null;
    }
  });
  for (const v of einzeln) if (v?.id) out.set(Number(v.id), v);
  return out;
}

/** Beschreibungen einzeln nachladen, wo die Liste keine mitgeliefert hat. */
async function ladeBeschreibungenNach(
  roh: VariantenRohdaten[],
  befunde: Befund[],
  budget: number,
): Promise<number> {
  const offen = roh
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => befunde[i].status === 'kein-treffer' && !r.beschreibung)
    .slice(0, budget);
  if (!offen.length) return 0;

  const nachgeladen = await inGruppen(offen, 5, async ({ r, i }) => {
    try {
      const texte = await plentyGet<PlentyText[] | PlentyListe<PlentyText>>(
        `/rest/items/${r.itemId}/variations/${r.variationId}/descriptions`,
      );
      const liste = Array.isArray(texte) ? texte : (texte?.entries ?? []);
      return { i, text: textAus(liste) };
    } catch {
      return { i, text: '' };
    }
  });

  for (const { i, text } of nachgeladen) {
    if (!text) continue;
    roh[i].beschreibung = text;
    befunde[i] = bewerteVariante(roh[i]);
  }
  return offen.length;
}

/** Lagernamen für die Anzeige — fehlende Rechte sind kein Grund zum Abbruch. */
async function ladeLagerNamen(diagnose: string[]): Promise<Map<number, string>> {
  const namen = new Map<number, string>();
  try {
    const res = await plentyGet<PlentyListe<{ id?: number; name?: string }> | Array<{ id?: number; name?: string }>>(
      '/rest/stockmanagement/warehouses?itemsPerPage=250',
    );
    const eintraege = Array.isArray(res) ? res : (res?.entries ?? []);
    for (const w of eintraege) if (w?.id) namen.set(Number(w.id), w.name ?? `Lager ${w.id}`);
  } catch {
    diagnose.push('Lagernamen konnten nicht gelesen werden – es werden die Lager-IDs angezeigt.');
  }
  return namen;
}

// ---------------------------------------------------------------------------
// Hauptlauf
// ---------------------------------------------------------------------------

export async function scanneLagerplaetze(opts: ScanOptionen = {}): Promise<ScanErgebnis> {
  const start = Date.now();
  const quelle: Quelle = opts.quelle === 'alle' ? 'alle' : 'bestand';
  const startSeite = Math.max(1, Math.floor(opts.startSeite ?? 1));
  const maxSeiten = Math.max(1, Math.floor(opts.maxSeiten ?? 8));
  const proSeite = Math.min(250, Math.max(1, Math.floor(opts.proSeite ?? 100)));
  const maxDauerMs = Math.max(5_000, Math.floor(opts.maxDauerMs ?? 45_000));
  const maxNachladungen = Math.max(0, Math.floor(opts.maxNachladungen ?? 150));
  const diagnose: string[] = [];

  const leer: ScanErgebnis = {
    ok: false,
    konfiguriert: plentyConfigured(),
    error: null,
    quelle,
    gelesen: 0,
    geprueft: 0,
    ohneBestand: 0,
    vonSeite: startSeite,
    bisSeite: startSeite - 1,
    naechsteSeite: startSeite,
    fertig: false,
    gesamtLautPlenty: null,
    befunde: [],
    zusammenfassung: fasseZusammen([]),
    diagnose,
    dauerMs: 0,
  };

  if (!plentyConfigured(getPlentyConfig())) {
    return {
      ...leer,
      naechsteSeite: null,
      error: 'PlentyONE ist nicht konfiguriert (PLENTY_BASE_URL / PLENTY_USER / PLENTY_PASSWORD fehlen).',
      dauerMs: Date.now() - start,
    };
  }

  const alle: Befund[] = [];
  let seite = startSeite;
  let letzteSeite = startSeite - 1;
  let gelesen = 0;
  let geprueft = 0;
  let ohneBestand = 0;
  let gesamt: number | null = null;
  let fertig = false;
  let nachladungen = 0;
  let listeLiefertTexte = false;
  let nichtGeladen = 0;

  const zwischenstand = (): ScanErgebnis => ({
    ...leer,
    gelesen,
    geprueft,
    ohneBestand,
    bisSeite: letzteSeite,
    naechsteSeite: letzteSeite >= startSeite ? letzteSeite + 1 : startSeite,
    gesamtLautPlenty: gesamt,
    befunde: alle,
    zusammenfassung: fasseZusammen(alle),
    dauerMs: Date.now() - start,
  });

  try {
    const withParam = await handleWithAus(diagnose);
    const lagerNamen = quelle === 'bestand' ? await ladeLagerNamen(diagnose) : new Map<number, string>();

    while (seite < startSeite + maxSeiten) {
      if (Date.now() - start > maxDauerMs) {
        diagnose.push('Zeitbudget erreicht – der Scan wird beim nächsten Aufruf fortgesetzt.');
        break;
      }

      let roh: VariantenRohdaten[] = [];
      let letzteSeiteErreicht = false;

      if (quelle === 'bestand') {
        // --- Bestandsliste: nur was im Lager liegt ---------------------------
        const res = await plentyGet<PlentyListe<PlentyBestand>>(
          `/rest/stockmanagement/stock?itemsPerPage=${proSeite}&page=${seite}`,
        );
        const zeilen = res?.entries ?? [];
        if (typeof res?.totalsCount === 'number') gesamt = res.totalsCount;
        gelesen += zeilen.length;
        letzteSeiteErreicht = Boolean(res?.isLastPage) || zeilen.length === 0 || (Boolean(res?.lastPageNumber) && seite >= Number(res?.lastPageNumber));

        // Bestandszeilen je Variante zusammenfassen (ein Artikel kann in
        // mehreren Lagern liegen).
        const summen = new Map<number, Bestandssumme>();
        for (const z of zeilen) {
          const variationId = Number(z?.variationId);
          if (!Number.isFinite(variationId) || variationId <= 0) continue;
          const netto = Number(z?.netStock ?? 0) || 0;
          const physisch = Number(z?.physicalStock ?? 0) || 0;
          if (netto <= 0 && physisch <= 0) {
            ohneBestand += 1;
            continue;
          }
          const vorhanden = summen.get(variationId);
          if (vorhanden) {
            vorhanden.netto += netto;
            vorhanden.physisch += physisch;
            if (z?.warehouseId) vorhanden.lager.add(Number(z.warehouseId));
          } else {
            summen.set(variationId, {
              variationId,
              itemId: Number.isFinite(Number(z?.itemId)) ? Number(z?.itemId) : null,
              netto,
              physisch,
              lager: new Set(z?.warehouseId ? [Number(z.warehouseId)] : []),
            });
          }
        }

        const ids = [...summen.keys()];
        const varianten = await ladeVarianten(ids, withParam, diagnose);
        for (const id of ids) {
          const v = varianten.get(id);
          if (!v) {
            nichtGeladen += 1;
            continue;
          }
          roh.push(rohdatenAus(v, summen.get(id), lagerNamen));
        }
      } else {
        // --- Gesamter Artikelstamm ------------------------------------------
        const res = await plentyGet<PlentyListe<PlentyVariante>>(variantenPfad(seite, proSeite, withParam));
        const eintraege = res?.entries ?? [];
        if (typeof res?.totalsCount === 'number') gesamt = res.totalsCount;
        gelesen += eintraege.length;
        letzteSeiteErreicht = Boolean(res?.isLastPage) || eintraege.length === 0 || (Boolean(res?.lastPageNumber) && seite >= Number(res?.lastPageNumber));
        roh = eintraege.map((v) => rohdatenAus(v));
      }

      letzteSeite = seite;
      if (roh.some((r) => r.beschreibung)) listeLiefertTexte = true;
      geprueft += roh.length;

      const befunde = roh.map(bewerteVariante);
      if (opts.texteNachladen && nachladungen < maxNachladungen) {
        nachladungen += await ladeBeschreibungenNach(roh, befunde, maxNachladungen - nachladungen);
      }
      alle.push(...befunde);

      if (letzteSeiteErreicht) {
        fertig = true;
        break;
      }
      seite += 1;
    }
  } catch (err) {
    return { ...zwischenstand(), ok: false, error: (err as Error).message };
  }

  if (nichtGeladen) {
    diagnose.push(`${nichtGeladen} Variante(n) mit Bestand konnten nicht geladen werden (gelöscht oder keine Leseberechtigung).`);
  }
  if (opts.texteNachladen && nachladungen) {
    diagnose.push(`${nachladungen} Beschreibung(en) einzeln nachgeladen.`);
  } else if (!listeLiefertTexte && geprueft > 0) {
    diagnose.push(
      'Die Variantenliste liefert keine Beschreibungstexte mit. Für Lagerplätze, die nur in der Beschreibung stehen, „Beschreibungen nachladen" einschalten.',
    );
  }

  return {
    ...zwischenstand(),
    ok: true,
    error: null,
    naechsteSeite: fertig ? null : letzteSeite + 1,
    fertig,
    befunde: opts.nurMitTreffer ? alle.filter((b) => b.code) : alle,
    diagnose,
  };
}
