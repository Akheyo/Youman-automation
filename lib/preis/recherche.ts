/**
 * Preisrecherche: aus den Suchaufträgen werden Marktangebote.
 *
 * Gesucht wird mit Claude und dessen Websuche, nicht über eine Händler-API.
 * Der Grund ist nüchtern: Es gibt keine Schnittstelle, die gebrauchte
 * Industrieware quer über eBay, Herstellerseiten und Restpostenhändler
 * zurückgibt. Was hier passiert, ist genau das, was bisher ein Mensch gemacht
 * hat — nachsehen, was der Artikel woanders kostet.
 *
 * Zwei Dinge macht das Modul ausdrücklich NICHT:
 *
 *   - Es rechnet keinen Preis aus. Das machen `quellen.ts` (welche Stufe
 *     zählt) und `regelwerk.ts` (was wir verlangen). Hier wird nur gesammelt.
 *   - Es bewertet keine Treffer weich. Ein Angebot ohne Preis, ohne Land oder
 *     ohne Quelle ist kein Angebot und fliegt raus, statt mit Annahmen
 *     aufgefüllt zu werden.
 *
 * Die Leiter wird von oben abgearbeitet und beim ersten brauchbaren Ergebnis
 * abgebrochen (SOP 1 und 2): Ein Treffer auf die exakte Nummer ist mehr wert
 * als zehn auf die Baureihe.
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Erkennung } from '@/lib/erfassung/erkennung';
import { baueSuchauftraege, type Herleitung, type Suchauftrag } from './recherche-kern';
import { stufenGuete, waehleQuellen, type MarktAngebot, type Quellenwahl } from './quellen';
import {
  aufZustandUmrechnen,
  lohntListing,
  preisBestimmen,
  type Lohnbefund,
  type PreisErgebnis,
  type Zustand,
} from './regelwerk';

// ---------------------------------------------------------------------------
// Was die Suche zurückgeben soll
// ---------------------------------------------------------------------------

const AngebotSchema = z.object({
  preis: z.number().describe('Artikelpreis ohne Versand, brutto, in Euro. Bereits umgerechnet, falls nötig.'),
  versand: z.number().describe('Versandkosten des Anbieters in Euro. 0 bei versandkostenfrei.'),
  versandUnbekannt: z
    .boolean()
    .describe('Wahr, wenn die Versandkosten nicht auf der Seite standen und 0 nur eine Annahme wäre.'),
  land: z.string().describe('Ländercode des Anbieters, z. B. DE, AT, CH.'),
  plattform: z.enum(['ebay', 'netz']).describe('eBay oder sonstiges Angebot im freien Netz.'),
  originalWaehrung: z.string().nullable().describe('Ursprungswährung, falls nicht EUR. Sonst null.'),
  zustand: z
    .enum(['neu', 'gebraucht', 'defekt', 'unbekannt'])
    .describe('Zustand des GEFUNDENEN Angebots — nicht unserer.'),
  bestand: z.number().nullable().describe('Wie viele Stück der Anbieter hat, falls angegeben.'),
  titel: z.string().describe('Der Angebotstitel, damit nachprüfbar ist, ob es derselbe Artikel ist.'),
  url: z.string().describe('Die Adresse des Angebots.'),
  passgenauigkeit: z
    .enum(['exakt', 'baureihe', 'aehnlich'])
    .describe('Exakt dasselbe Produkt, dieselbe Baureihe oder nur ein technisch ähnliches.'),
});

const SuchergebnisSchema = z.object({
  angebote: z.array(AngebotSchema),
  bemerkungen: z
    .array(z.string())
    .describe('Was bei der Suche auffiel: Marktlage, Verfügbarkeit, Zweifel an der Vergleichbarkeit.'),
});

export type Suchergebnis = z.infer<typeof SuchergebnisSchema>;
export type GefundenesAngebot = z.infer<typeof AngebotSchema>;

// ---------------------------------------------------------------------------
// Anweisung
// ---------------------------------------------------------------------------

const ANWEISUNG = `Du recherchierst Marktpreise für einen Händler, der gebrauchte Industrieware verkauft.

Du bekommst einen Suchbegriff. Finde damit laufende oder kürzlich beendete ANGEBOTE für
dieses Produkt und gib sie strukturiert zurück.

Regeln:
- Nur echte Angebote, die du auf einer Seite gesehen hast. Keine Schätzungen, keine
  Listenpreise aus dem Gedächtnis, keine "üblicherweise kostet so etwas".
- Zu jedem Angebot gehört die Adresse. Ohne Adresse kein Angebot.
- Preise in Euro. Steht der Preis in einer anderen Währung, rechne um und trag die
  Ursprungswährung ein.
- Versandkosten gehören dazu. Stehen sie nicht auf der Seite, setz versandUnbekannt auf
  wahr und versand auf 0 — rate nicht.
- Der Zustand ist der des GEFUNDENEN Angebots. Ob neu oder gebraucht, entscheidet, wie
  der Preis später umgerechnet wird — also sorgfältig.
- passgenauigkeit ehrlich setzen: "exakt" nur, wenn Hersteller UND Typennummer
  übereinstimmen. Sonst "baureihe" oder "aehnlich".
- Findest du nichts, gib eine leere Liste zurück. Eine leere Liste ist ein brauchbares
  Ergebnis; erfundene Angebote sind es nicht.
- Achte auf Angebote aus Deutschland zuerst. Trag bei jedem Angebot das Land ein.
- Notiere in bemerkungen, wenn dir etwas auffällt: nur ein einziger Anbieter, sehr
  unterschiedliche Preise, Ware offenbar selten, Angebot steht schon lange.`;

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

/**
 * Was als Vergleichsangebot durchgeht.
 *
 * Streng, und zwar an der Stelle, an der es wehtut: Ein Angebot ohne
 * belastbare Versandkosten wird NICHT mit 0 € angesetzt. eBay sortiert nach
 * Preis plus Versand — ein unterschätzter Versand beim Mitbewerber führt
 * direkt dazu, dass wir uns zu billig einsortieren.
 */
export function brauchbar(a: GefundenesAngebot): boolean {
  if (!Number.isFinite(a.preis) || a.preis <= 0) return false;
  if (!a.url || !/^https?:\/\//i.test(a.url)) return false;
  if (!a.land || a.land.trim().length < 2) return false;
  if (a.versandUnbekannt) return false;
  if (!Number.isFinite(a.versand) || a.versand < 0) return false;
  if (a.passgenauigkeit === 'aehnlich') return false;
  return true;
}

/**
 * Übersetzt ein gefundenes Angebot in ein Marktangebot — auf UNSEREN Zustand
 * umgerechnet.
 *
 * Das ist der Schritt, den die Regel „wenn unser Artikel gebraucht ist und es
 * gibt online nur neue, dann 60–65 %" verlangt. Er passiert hier und nicht
 * erst bei der Preisbildung, weil `preisBestimmen` bereits umgerechnete
 * Angebote erwartet.
 */
export function alsMarktangebot(
  a: GefundenesAngebot,
  unser: Zustand,
  gravierendeSchaeden: boolean,
): MarktAngebot | null {
  const fremd: Zustand | null =
    a.zustand === 'neu' ? 'neu' : a.zustand === 'gebraucht' ? 'gebraucht' : a.zustand === 'defekt' ? 'defekt' : null;
  // Unbekannter Zustand lässt sich nicht umrechnen. Ihn als „gebraucht"
  // durchzuwinken wäre die bequeme Annahme — und bei einem Neuangebot läge
  // unser Preis dann um 35–40 % daneben.
  if (!fremd) return null;

  const umgerechnet = aufZustandUmrechnen(a.preis, fremd, unser, { gravierendeSchaeden });
  if (!Number.isFinite(umgerechnet) || umgerechnet <= 0) return null;

  return {
    preis: umgerechnet,
    versand: a.versand,
    bestand: a.bestand ?? null,
    quelle: a.url,
    land: a.land.trim().toUpperCase(),
    plattform: a.plattform,
    originalWaehrung: a.originalWaehrung,
  };
}

// ---------------------------------------------------------------------------
// Ein Suchlauf
// ---------------------------------------------------------------------------

export function anthropicKonfiguriert(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** Wie viele Websuchen ein einzelner Suchauftrag auslösen darf. */
export const MAX_SUCHEN_JE_AUFTRAG = 6;

/** Führt einen einzelnen Suchauftrag aus. */
export async function sucheAngebote(auftrag: Suchauftrag): Promise<Suchergebnis> {
  const client = new Anthropic();

  const antwort = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 8000,
    system: ANWEISUNG,
    tools: [
      {
        type: 'web_search_20260318',
        name: 'web_search',
        max_uses: MAX_SUCHEN_JE_AUFTRAG,
        user_location: { type: 'approximate', country: 'DE' },
      },
    ],
    output_config: { format: zodOutputFormat(SuchergebnisSchema), effort: 'medium' },
    messages: [
      {
        role: 'user',
        content:
          `Such nach Angeboten für: ${auftrag.begriff}\n\n` +
          `Zweck: ${auftrag.erklaerung}\n` +
          'Suche zuerst auf eBay Deutschland, dann im freien Netz. Gib alle Angebote zurück, die du findest.',
      },
    ],
  });

  if (antwort.stop_reason === 'refusal') throw new Error('Die Preisrecherche wurde abgelehnt.');
  if (!antwort.parsed_output) throw new Error('Die Preisrecherche kam nicht in der erwarteten Form zurück.');
  return antwort.parsed_output;
}

// ---------------------------------------------------------------------------
// Der ganze Lauf
// ---------------------------------------------------------------------------

export interface RechercheEingabe {
  erkennung: Erkennung;
  /** Unser Zustand — bestimmt, wie fremde Preise umgerechnet werden. */
  zustand: Zustand;
  gravierendeSchaeden?: boolean;
  /** Unsere eigenen Versandkosten laut Versandprofil. */
  unserVersand: number;
  bestand: number;
  generisch?: boolean;
  /** Obergrenze für die Zahl der Suchläufe — jeder kostet Zeit und Geld. */
  maxAuftraege?: number;
}

export interface RechercheErgebnis {
  preis: PreisErgebnis;
  quellen: Quellenwahl;
  lohnt: Lohnbefund;
  herleitung: Herleitung;
  /** Alle Angebote, die durch den Filter kamen. */
  angebote: MarktAngebot[];
  /** Was die Suche nebenbei bemerkt hat. */
  bemerkungen: string[];
}

/** Ab so vielen brauchbaren Angeboten wird nicht weiter gekürzt (SOP 2). */
export const GENUG_ANGEBOTE = 3;

/** Standard-Obergrenze für Suchläufe je Artikel. */
export const MAX_AUFTRAEGE = 4;

/**
 * Recherchiert den Preis für einen Artikel.
 *
 * Abgebrochen wird, sobald eine Sprosse genug Angebote geliefert hat. Weiter
 * zu kürzen, wenn die exakte Nummer schon drei Treffer hatte, verwässert das
 * Ergebnis nur — die Baureihe enthält immer auch die größeren und kleineren
 * Modelle.
 */
export async function recherchiere(e: RechercheEingabe): Promise<RechercheErgebnis> {
  if (!anthropicKonfiguriert()) {
    throw new Error('ANTHROPIC_API_KEY fehlt — ohne ihn gibt es keine Preisrecherche.');
  }

  const auftraege = baueSuchauftraege(e.erkennung, { generisch: e.generisch }).slice(
    0,
    e.maxAuftraege ?? MAX_AUFTRAEGE,
  );

  const gesammelt: MarktAngebot[] = [];
  const bemerkungen: string[] = [];
  const versuche: Herleitung['versuche'] = [];
  let letzteGuete: Suchauftrag['guete'] = 'niedrig';

  for (const auftrag of auftraege) {
    let ergebnis: Suchergebnis;
    try {
      ergebnis = await sucheAngebote(auftrag);
    } catch (fehler) {
      // Ein gescheiterter Suchlauf beendet nicht die Recherche: Die nächste
      // Sprosse kann trotzdem etwas finden, und ein Preis von der Baureihe ist
      // besser als gar keiner.
      versuche.push({
        begriff: auftrag.begriff,
        treffer: 0,
        erklaerung: `${auftrag.erklaerung} (Suche fehlgeschlagen: ${(fehler as Error).message})`,
      });
      continue;
    }

    const durchgekommen = ergebnis.angebote
      .filter(brauchbar)
      .map((a) => alsMarktangebot(a, e.zustand, e.gravierendeSchaeden === true))
      .filter((a): a is MarktAngebot => a !== null);

    versuche.push({ begriff: auftrag.begriff, treffer: durchgekommen.length, erklaerung: auftrag.erklaerung });
    bemerkungen.push(...ergebnis.bemerkungen);
    gesammelt.push(...durchgekommen);

    if (durchgekommen.length > 0) letzteGuete = auftrag.guete;
    if (gesammelt.length >= GENUG_ANGEBOTE) break;
  }

  const quellen = waehleQuellen(gesammelt);
  const preis = preisBestimmen({ angebote: quellen.angebote, unserVersand: e.unserVersand });
  const lohnt = lohntListing(preis.ebay, e.bestand);

  // Die schlechtere der beiden Güten zählt: Ein exakter Treffer aus Tschechien
  // ist nicht verlässlicher als die Quelle, aus der er stammt.
  const quellGuete = stufenGuete(quellen.stufe);
  const rang = { hoch: 2, mittel: 1, niedrig: 0 } as const;
  const guete = rang[quellGuete] <= rang[letzteGuete] ? quellGuete : letzteGuete;

  return {
    preis,
    quellen,
    lohnt,
    angebote: quellen.angebote,
    bemerkungen,
    herleitung: {
      versuche,
      quelle: quellen.stufe ? quellen.begruendung.find((z) => z.includes('diese Stufe')) ?? null : null,
      guete,
      zeilen: [...quellen.begruendung, ...preis.begruendung, lohnt.begruendung].filter(Boolean),
    },
  };
}
