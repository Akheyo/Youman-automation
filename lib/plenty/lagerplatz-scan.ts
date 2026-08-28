/**
 * Lagerplatz-Scan: liest Varianten aus PlentyONE und sucht in ihren Texten
 * nach Lagerplatz-Codes (z. B. "H6R5A7").
 *
 * NUR LESEND — dieser Scan verändert in Plenty nichts. Er erzeugt die Vorschau,
 * auf deren Grundlage die Lagerplätze später angelegt werden können.
 *
 * Der Scan läuft in Häppchen: Ein Aufruf liest eine begrenzte Zahl Seiten bzw.
 * hört nach einem Zeitbudget auf und meldet über `naechsteSeite`, wo es
 * weitergeht. So läuft er auch in Serverless-Umgebungen mit kurzem Timeout
 * durch — die Oberfläche ruft einfach wiederholt auf.
 */

import { getPlentyConfig, plentyConfigured, plentyGet } from './client';
import { bewerteVariante, fasseZusammen, type Befund, type Zusammenfassung } from '@/lib/lagerplatz/befund';

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export interface ScanOptionen {
  /** Seite, ab der gelesen wird (1-basiert wie in Plenty). */
  startSeite?: number;
  /** Wie viele Seiten dieser Aufruf höchstens liest. */
  maxSeiten?: number;
  /** Varianten pro Seite (Plenty erlaubt bis 250). */
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
  /** Gelesene Varianten in diesem Aufruf. */
  gelesen: number;
  vonSeite: number;
  bisSeite: number;
  /** Nächste zu lesende Seite — null, wenn alles durch ist. */
  naechsteSeite: number | null;
  fertig: boolean;
  /** Gesamtzahl Varianten laut Plenty, sofern die API sie mitliefert. */
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

interface PlentyVariante {
  id: number;
  itemId: number;
  number?: string | null;
  model?: string | null;
  externalId?: string | null;
  name?: string | null;
  item?: { texts?: PlentyText[] } | null;
  variationDescription?: PlentyText[] | null;
  descriptions?: PlentyText[] | null;
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

function pfad(seite: number, proSeite: number, withParam: string): string {
  const w = withParam ? `&with=${withParam}` : '';
  return `/rest/items/variations?itemsPerPage=${proSeite}&page=${seite}${w}`;
}

async function handleWithAus(diagnose: string[]): Promise<string> {
  if (gemerktesWith !== null) return gemerktesWith;
  for (const kandidat of WITH_KANDIDATEN) {
    try {
      await plentyGet<PlentyListe<PlentyVariante>>(pfad(1, 1, kandidat));
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
  const kandidaten = [
    v.name,
    v.variationDescription?.[0]?.name,
    v.item?.texts?.[0]?.name1,
    v.item?.texts?.[0]?.name,
  ];
  return kandidaten.find((k) => typeof k === 'string' && k.trim()) ?? null;
}

/** Arbeitet eine Liste in kleinen Gruppen parallel ab (schont die API). */
async function inGruppen<T, R>(werte: T[], groesse: number, fn: (wert: T) => Promise<R>): Promise<R[]> {
  const ergebnis: R[] = [];
  for (let i = 0; i < werte.length; i += groesse) {
    ergebnis.push(...(await Promise.all(werte.slice(i, i + groesse).map(fn))));
  }
  return ergebnis;
}

// ---------------------------------------------------------------------------
// Hauptlauf
// ---------------------------------------------------------------------------

export async function scanneLagerplaetze(opts: ScanOptionen = {}): Promise<ScanErgebnis> {
  const start = Date.now();
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
    gelesen: 0,
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
  let gesamt: number | null = null;
  let fertig = false;
  let textNachladungen = 0;
  let listeLiefertTexte = false;

  try {
    const withParam = await handleWithAus(diagnose);

    while (seite < startSeite + maxSeiten) {
      if (Date.now() - start > maxDauerMs) {
        diagnose.push('Zeitbudget erreicht – der Scan wird beim nächsten Aufruf fortgesetzt.');
        break;
      }

      const res = await plentyGet<PlentyListe<PlentyVariante>>(pfad(seite, proSeite, withParam));
      const eintraege = res?.entries ?? [];
      if (typeof res?.totalsCount === 'number') gesamt = res.totalsCount;
      letzteSeite = seite;
      gelesen += eintraege.length;

      const roh = eintraege.map((v) => {
        const beschreibung = [textAus(v.item?.texts), textAus(v.variationDescription)].filter(Boolean).join('\n');
        if (beschreibung) listeLiefertTexte = true;
        return {
          variationId: Number(v.id),
          itemId: Number(v.itemId),
          nummer: v.number ?? null,
          modell: v.model ?? null,
          externeId: v.externalId ?? null,
          name: nameAus(v),
          beschreibung: beschreibung || null,
        };
      });

      const befunde = roh.map(bewerteVariante);

      // Beschreibungen einzeln nachladen — nur für Varianten, bei denen bisher
      // nichts gefunden wurde und die Liste keinen Text mitgeliefert hat.
      if (opts.texteNachladen && textNachladungen < maxNachladungen) {
        const offen = befunde
          .map((b, i) => ({ b, i }))
          .filter(({ b, i }) => b.status === 'kein-treffer' && !roh[i].beschreibung)
          .slice(0, maxNachladungen - textNachladungen);

        if (offen.length) {
          const nachgeladen = await inGruppen(offen, 5, async ({ b, i }) => {
            try {
              const texte = await plentyGet<PlentyText[] | PlentyListe<PlentyText>>(
                `/rest/items/${b.itemId}/variations/${b.variationId}/descriptions`,
              );
              const liste = Array.isArray(texte) ? texte : (texte?.entries ?? []);
              return { i, text: textAus(liste) };
            } catch {
              return { i, text: '' };
            }
          });
          textNachladungen += offen.length;
          for (const { i, text } of nachgeladen) {
            if (!text) continue;
            roh[i].beschreibung = text;
            befunde[i] = bewerteVariante(roh[i]);
          }
        }
      }

      alle.push(...befunde);

      if (res?.isLastPage || eintraege.length === 0 || (res?.lastPageNumber && seite >= res.lastPageNumber)) {
        fertig = true;
        break;
      }
      seite += 1;
    }
  } catch (err) {
    return {
      ...leer,
      ok: false,
      bisSeite: letzteSeite,
      gelesen,
      naechsteSeite: letzteSeite >= startSeite ? letzteSeite + 1 : startSeite,
      befunde: alle,
      zusammenfassung: fasseZusammen(alle),
      error: (err as Error).message,
      dauerMs: Date.now() - start,
    };
  }

  if (opts.texteNachladen && textNachladungen) {
    diagnose.push(`${textNachladungen} Beschreibung(en) einzeln nachgeladen.`);
  } else if (!listeLiefertTexte) {
    diagnose.push(
      'Die Variantenliste liefert keine Beschreibungstexte mit. Für Lagerplätze, die nur in der Beschreibung stehen, „Beschreibungen nachladen" einschalten.',
    );
  }

  return {
    ok: true,
    konfiguriert: true,
    error: null,
    gelesen,
    vonSeite: startSeite,
    bisSeite: letzteSeite,
    naechsteSeite: fertig ? null : letzteSeite + 1,
    fertig,
    gesamtLautPlenty: gesamt,
    befunde: opts.nurMitTreffer ? alle.filter((b) => b.code) : alle,
    zusammenfassung: fasseZusammen(alle),
    diagnose,
    dauerMs: Date.now() - start,
  };
}
