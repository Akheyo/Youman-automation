/**
 * Deutsche Artikeltexte auf Niederländisch.
 *
 * Marktplaats.nl kennt genau ein Locale: `nl-NL`. Deutsche Texte dort
 * einzustellen ist technisch erlaubt und praktisch wertlos — gesucht wird auf
 * Niederländisch, und wer „Hydraulikpumpe" einstellt, wird von niemandem
 * gefunden, der „hydraulische pomp" eintippt.
 *
 * WARUM HIER EIN MODELL UND NICHT EINE TABELLE: Anders als bei den Listings
 * (siehe `lib/listing/texte.ts`, wo bewusst zusammengesetzt statt generiert
 * wird) gibt es hier nichts zu formatieren — es gibt etwas zu übersetzen, und
 * das ist genau die Aufgabe, für die ein Sprachmodell taugt. Die Regeln, die
 * nicht verhandelbar sind, stehen trotzdem nicht im Prompt, sondern als
 * Prüfung davor und danach: `markenregeln.ts` sperrt, was nicht raus darf.
 *
 * DIE TEURE STELLE: Ein Pflichtsatz, dessen Fehlen laut Hersteller bis zu
 * 10.000 € kostet, darf nicht davon abhängen, ob ein Modell ihn diesmal
 * stehen lässt. Er wird deshalb nach der Übersetzung im Wortlaut wieder
 * eingesetzt (`sichereProduktregeln`) — deutsch, wie ihn der Hersteller
 * vorschreibt.
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import {
  darfVeroeffentlichen,
  istLappArtikel,
  KUGELLAGER_HERSTELLER,
  PFLICHTSATZ_KUGELLAGER,
  pruefeListing,
  type Befund,
} from '@/lib/listing/markenregeln';
import type { Zustand } from '@/lib/preis/regelwerk';
import { kuerzeTitel } from './anzeige';

export const UebersetzungSchema = z.object({
  titel: z
    .string()
    .describe('Niederländischer Titel. Sachlich, ohne Werbesprache. Hersteller und Typbezeichnung bleiben unverändert.'),
  beschreibung: z
    .string()
    .describe('Niederländische Beschreibung. Absätze bleiben erhalten, Maße und Zahlen unverändert.'),
});

export type UebersetzterText = z.infer<typeof UebersetzungSchema>;

const ANWEISUNG = `Je vertaalt advertentieteksten voor tweedehands industriële goederen van het Duits naar het Nederlands, voor Marktplaats.nl.

Regels:
- Vertaal zakelijk en nuchter. Geen reclametaal, geen uitroeptekens, geen toevoegingen.
- Merknamen, typeaanduidingen, model- en artikelnummers, normen (DIN, ISO) en maten blijven ONVERANDERD staan.
- Getallen, eenheden en technische waarden blijven exact hetzelfde. Reken niets om.
- Voeg NIETS toe wat niet in de brontekst staat. Verzin geen eigenschappen, geen staat, geen leveringsomvang.
- Ontbreekt er iets in de brontekst, laat het dan ook in de vertaling weg.
- Zinnen die letterlijk voorgeschreven zijn (juridische verplichte zinnen) laat je ONVERTAALD in het Duits staan.
- De titel is kort en zoekbaar: producttype, merk, type, belangrijkste kenmerk.`;

export function anthropicKonfiguriert(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export interface UebersetzungEingabe {
  titel: string;
  beschreibung: string;
  /** Titelgrenze von Marktplaats, so wie der Client sie kennt. */
  maxTitel: number;
}

export interface UebersetzungErgebnis extends UebersetzterText {
  modell: string;
  verbrauch: { eingabe: number; ausgabe: number };
}

/**
 * Übersetzt Titel und Beschreibung.
 *
 * Beide in einem Aufruf: Der Titel ist die Kurzform der Beschreibung, und
 * getrennt übersetzt driften die Begriffe auseinander — in der Beschreibung
 * „boorhamer", im Titel „klopboormachine", und die Anzeige widerspricht sich
 * selbst.
 */
export async function uebersetze(e: UebersetzungEingabe): Promise<UebersetzungErgebnis> {
  if (!anthropicKonfiguriert()) {
    throw new Error('ANTHROPIC_API_KEY fehlt — ohne ihn lässt sich nicht übersetzen.');
  }

  const client = new Anthropic();
  const modell = 'claude-opus-5';

  const antwort = await client.messages.parse({
    model: modell,
    max_tokens: 4000,
    system: ANWEISUNG,
    output_config: {
      format: zodOutputFormat(UebersetzungSchema),
      // Übersetzen ist keine Schlussfolgerung. Die niedrige Stufe reicht und
      // hält den Durchlauf über zehntausende Artikel bezahlbar.
      effort: 'low',
    },
    messages: [
      {
        role: 'user',
        content: `Titel (Duits):\n${e.titel}\n\nBeschrijving (Duits):\n${e.beschreibung}`,
      },
    ],
  });

  if (antwort.stop_reason === 'refusal') {
    throw new Error('Die Übersetzung wurde abgelehnt.');
  }
  if (!antwort.parsed_output) {
    throw new Error('Die Übersetzung kam nicht in der erwarteten Form zurück.');
  }

  return {
    titel: kuerzeTitel(antwort.parsed_output.titel, e.maxTitel),
    beschreibung: antwort.parsed_output.beschreibung.trim(),
    modell,
    verbrauch: { eingabe: antwort.usage.input_tokens, ausgabe: antwort.usage.output_tokens },
  };
}

// ---------------------------------------------------------------------------
// Die Sperren — vor und nach der Übersetzung
// ---------------------------------------------------------------------------

export interface Artikeltexte {
  hersteller: string | null;
  titel: string;
  beschreibung: string;
  zustand: Zustand;
}

/**
 * Darf dieser Artikel überhaupt nach Marktplaats?
 *
 * Dieselbe Prüfung wie vor jeder anderen Veröffentlichung. Sie hier zu
 * überspringen hieße, über einen zweiten Kanal genau das zu veröffentlichen,
 * wogegen `markenregeln.ts` gebaut wurde — die Vorschrift gilt nicht nur für
 * eBay, sie gilt für den Artikel.
 *
 * Die Titellängen von eBay (60/80) prüft `pruefeListing` mit; für Marktplaats
 * sind sie unerheblich, weil der Titel dort ohnehin gekürzt wird. Befunde zur
 * Titellänge werden deshalb aussortiert — alles andere bleibt eine Sperre.
 */
export function pruefeHerkunft(t: Artikeltexte): { befunde: Befund[]; darfRaus: boolean } {
  const befunde = pruefeListing({
    hersteller: t.hersteller,
    titel1: t.titel.slice(0, 60),
    beschreibung: t.beschreibung,
    zustand: t.zustand,
  }).filter((b) => b.regel !== 'Titellänge');
  return { befunde, darfRaus: darfVeroeffentlichen(befunde) };
}

/** Steht der Pflichtsatz für Kugellager an? */
export function brauchtPflichtsatz(hersteller: string | null | undefined, zustand: Zustand): boolean {
  const h = (hersteller ?? '').toUpperCase();
  const istKugellager = KUGELLAGER_HERSTELLER.some((marke) => new RegExp(`\\b${marke}\\b`).test(h));
  return istKugellager && (zustand === 'neu' || zustand === 'neu_versiegelt');
}

/**
 * Setzt nach der Übersetzung wieder her, was wörtlich dastehen muss.
 *
 * Der Pflichtsatz ist vom Hersteller im Wortlaut vorgeschrieben. Eine
 * niederländische Fassung wäre eine andere Zusage — und ein Modell, das ihn
 * „diesmal" stehen lässt, ist keine Sicherung. Fehlt er, wird er angehängt.
 */
export function sichereProduktregeln(
  beschreibung: string,
  opts: { hersteller: string | null; zustand: Zustand },
): { beschreibung: string; ergaenzt: boolean } {
  if (!brauchtPflichtsatz(opts.hersteller, opts.zustand)) {
    return { beschreibung, ergaenzt: false };
  }
  if (beschreibung.includes(PFLICHTSATZ_KUGELLAGER)) {
    return { beschreibung, ergaenzt: false };
  }
  return { beschreibung: `${beschreibung.trim()}\n\n${PFLICHTSATZ_KUGELLAGER}`, ergaenzt: true };
}

/**
 * Prüft den übersetzten Text noch einmal auf die LAPP-Sperre.
 *
 * Warum doppelt: Die Sperre greift am deutschen Text. Eine Übersetzung soll
 * Eigennamen unverändert lassen — genau deshalb kann sie einen Namen
 * durchreichen, der im Quelltext an einer Stelle stand, die die erste Prüfung
 * nicht als Herstellerangabe gelesen hat. Der zweite Blick kostet nichts und
 * deckt den Fall ab, in dem es teuer wird.
 */
export function pruefeUebersetzung(
  nl: { titel: string; beschreibung: string },
  opts: { hersteller: string | null; zustand: Zustand },
): { befunde: Befund[]; darfRaus: boolean } {
  const texte = [nl.titel, nl.beschreibung];
  const befunde: Befund[] = [];

  if (istLappArtikel(opts.hersteller, texte)) {
    befunde.push({
      schwere: 'sperre',
      regel: 'LAPP',
      meldung:
        'Im übersetzten Text steht ein LAPP-Name oder eine LAPP-Produktlinie. Der Artikel muss generisch beschrieben werden.',
    });
  }

  if (brauchtPflichtsatz(opts.hersteller, opts.zustand) && !nl.beschreibung.includes(PFLICHTSATZ_KUGELLAGER)) {
    befunde.push({
      schwere: 'sperre',
      regel: 'SKF/FAG',
      meldung: 'Der Pflichtsatz fehlt im übersetzten Text.',
    });
  }

  if (opts.zustand === 'defekt' && !/defect|kapot|defekt/i.test(nl.titel)) {
    befunde.push({
      schwere: 'sperre',
      regel: 'Defekt',
      meldung: 'Der Titel nennt den Defekt nicht („defect").',
    });
  }

  return { befunde, darfRaus: darfVeroeffentlichen(befunde) };
}
