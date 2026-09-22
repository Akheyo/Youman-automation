/**
 * Fließtext für die Produktkarte: Teaser, Aufzählungspunkte, Anwendung,
 * Vorteile, FAQ.
 *
 * Die Produktkarten-Vorgabe verlangt 800–2000 Wörter. Aus Typenschild und
 * Maßen allein entsteht so ein Text nicht — er muss geschrieben werden.
 * Geschrieben wird er hier, aber NUR aus dem, was die Bilderkennung
 * tatsächlich gefunden hat.
 *
 * Das ist die heikelste Stelle der ganzen Kette. Ein Modell, das „flüssigen
 * Produkttext" liefern soll, erfindet bereitwillig Leistungsdaten,
 * Einsatzgebiete und Normen — und ein erfundenes Datenblatt in einer
 * Artikelbeschreibung ist eine falsche Zusicherung an den Käufer, kein
 * Stilproblem. Deshalb:
 *
 *   - Die Anweisung verbietet jede Zahl, die nicht in den Merkmalen steht.
 *   - `pruefeFliesstext` prüft den fertigen Text noch einmal maschinell auf
 *     Zahlen und Maßeinheiten, die nirgends herkommen, und wirft sie raus.
 *   - Bei LAPP (generisch) darf der Herstellername nirgends auftauchen; das
 *     wird nach dem Aufruf geprüft, nicht dem Modell überlassen.
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Erkennung } from '@/lib/erfassung/erkennung';
import { masseText, ZUSTAND_TEXT as ERKENNUNG_ZUSTAND_TEXT } from '@/lib/erfassung/erkennung';
import type { Zustand } from '@/lib/preis/regelwerk';
import { ZUSTAND_TEXT } from '@/lib/preis/regelwerk';
import { ANZAHL_BULLETS, MAX_BULLET_ZEICHEN, type FaqEintrag, type Fliesstext } from './texte';

// ---------------------------------------------------------------------------
// Form der Antwort
// ---------------------------------------------------------------------------

export const FliesstextSchema = z.object({
  teaser: z
    .string()
    .describe(
      'Zwei bis drei Sätze direkt unter der Überschrift: was es ist, für wen, in welchem Zustand. ' +
        'Sachlich, kein Werbedeutsch, keine Ausrufezeichen.',
    ),
  bullets: z
    .array(z.string())
    .describe(
      'Genau fünf kurze Punkte mit den wichtigsten Eigenschaften. Je höchstens 200 Zeichen. ' +
        'Nur Angaben, die in den übergebenen Daten stehen.',
    ),
  anwendung: z
    .string()
    .describe(
      'Wofür der Artikel üblicherweise eingesetzt wird — allgemein gehalten, wenn der genaue ' +
        'Einsatzzweck nicht aus den Daten hervorgeht. Ein bis zwei Absätze.',
    ),
  vorteile: z
    .string()
    .describe('Warum sich der Kauf dieses gebrauchten Stücks lohnt. Ein Absatz. Keine erfundenen Zusagen.'),
  faq: z
    .array(z.object({ frage: z.string(), antwort: z.string() }))
    .describe('Drei bis fünf Fragen, die ein Käufer wirklich stellt. Antworten aus den Daten, sonst ehrlich offen.'),
});

export type FliesstextRoh = z.infer<typeof FliesstextSchema>;

// ---------------------------------------------------------------------------
// Anweisung
// ---------------------------------------------------------------------------

const ANWEISUNG = `Du schreibst Artikelbeschreibungen für einen Händler, der gebrauchte Industrie- und
Gewerbeware verwertet und über eBay und einen eigenen Shop verkauft.

Grundlage ist ausschließlich das, was dir übergeben wird. Was dort nicht steht, existiert nicht.

Unverhandelbar:
- ERFINDE KEINE ZAHLEN. Keine Leistung in Watt, keine Spannung, kein Gewicht, keine Maße,
  keine Drehzahl, keine Norm, kein Baujahr — es sei denn, die Angabe steht wörtlich in den
  übergebenen Merkmalen. Der Käufer liest das als Zusicherung.
- Erfinde keine Ausstattung, kein Zubehör, keinen Lieferumfang.
- Behaupte keine Funktionsfähigkeit über den angegebenen Zustand hinaus. Kein "voll
  funktionsfähig", wenn das nicht dasteht. Kein "geprüft", wenn nichts von Prüfung steht.
- Wenn du etwas nicht weißt, sag es offen ("Der genaue Einsatzzweck geht aus den Angaben
  nicht hervor") oder lass es weg. Eine Lücke ist besser als eine Erfindung.
- Keine Preise, keine Lieferzeiten, keine Garantie- oder Gewährleistungsaussagen.
- Schreib auf Deutsch, sachlich, in ganzen Sätzen. Kein Werbedeutsch, keine Ausrufezeichen,
  keine Superlative ("Spitzenqualität", "unschlagbar", "perfekt").
- Sprich den Käufer mit "Sie" an.

Was du darfst: allgemein bekanntes Wissen über die Warengattung einbringen — wofür ein
Akkuschrauber oder ein Schaltschrank grundsätzlich verwendet wird. Das bleibt allgemein und
wird nicht als Eigenschaft DIESES Stücks ausgegeben.`;

// ---------------------------------------------------------------------------
// Was das Modell zu sehen bekommt
// ---------------------------------------------------------------------------

export interface FliesstextEingabe {
  erkennung: Erkennung;
  zustand: Zustand;
  /** Was der Mensch am Regal notiert hat. */
  notiz?: string | null;
  /** Bei LAPP: Hersteller und Produktlinie dürfen nirgends vorkommen. */
  generisch: boolean;
}

/**
 * Stellt die Datengrundlage zusammen, die das Modell sieht.
 *
 * Bewusst als Aufzählung und nicht als Fließtext: Was hier nicht steht, soll
 * im Ergebnis nicht auftauchen, und eine Liste macht sichtbarer als ein
 * Absatz, wie dünn die Grundlage manchmal ist.
 */
export function datengrundlage(e: FliesstextEingabe): string {
  const { erkennung: erk } = e;
  const zeilen: string[] = [];

  zeilen.push(`Warengattung: ${erk.artikelTyp}`);
  if (!e.generisch) {
    if (erk.hersteller) zeilen.push(`Hersteller: ${erk.hersteller}`);
    if (erk.modell) zeilen.push(`Modell: ${erk.modell}`);
    if (erk.modellnummer) zeilen.push(`Modellnummer: ${erk.modellnummer}`);
  }
  if (erk.baujahr) zeilen.push(`Baujahr: ${erk.baujahr}`);

  zeilen.push(`Zustand (verkauft als): ${ZUSTAND_TEXT[e.zustand]}`);
  zeilen.push(`Zustand laut Fotos: ${ERKENNUNG_ZUSTAND_TEXT[erk.zustand]}`);

  if (erk.schaeden.length > 0) zeilen.push(`Festgestellte Mängel: ${erk.schaeden.join('; ')}`);
  else zeilen.push('Festgestellte Mängel: keine sichtbaren');

  const notiz = (e.notiz ?? '').trim();
  if (notiz) zeilen.push(`Notiz aus dem Lager: ${notiz}`);

  if (erk.lieferumfang.length > 0) zeilen.push(`Lieferumfang: ${erk.lieferumfang.join(', ')}`);
  else zeilen.push('Lieferumfang: nicht dokumentiert');

  const merkmale = erk.merkmale.filter((m) => m.name && m.wert);
  if (merkmale.length > 0) {
    zeilen.push('Merkmale:');
    for (const m of merkmale) zeilen.push(`  - ${m.name}: ${m.wert}`);
  } else {
    zeilen.push('Merkmale: keine erfasst');
  }

  const masse = masseText(erk.masseCm);
  if (masse) zeilen.push(`Maße: ${masse}`);
  if (!erk.typenschildGefunden) zeilen.push('Kein lesbares Typenschild — Angaben entsprechend unsicher.');
  if (erk.unsicherheiten.length > 0) zeilen.push(`Unklar: ${erk.unsicherheiten.join('; ')}`);

  if (e.generisch) {
    zeilen.push(
      'WICHTIG: Herstellername und Produktlinie dürfen in keinem Wort vorkommen. ' +
        'Beschreibe den Artikel rein über Gattung und technische Eigenschaften.',
    );
  }

  return zeilen.join('\n');
}

// ---------------------------------------------------------------------------
// Nachkontrolle
// ---------------------------------------------------------------------------

/**
 * Zahlen mit Maßeinheit — also genau das, was als Zusicherung gelesen wird.
 * Reine Zahlen ohne Einheit („drei Schrauben") sind harmlos und bleiben.
 */
// Die Reihenfolge ist keine Kosmetik: Alternativen greifen von links, also
// muss „mm²" vor „mm" und „mm" vor „m" stehen. Sonst bliebe aus „1,5 mm²"
// nur „1,5 mm" übrig, und die Angabe wäre plötzlich eine andere.
const EINHEIT =
  '(?:U\\/min|mm²|mm2|qmm|kHz|kWh|kW|kV|mA|rpm|bar|Zoll|Nm|PS|Hz|°C|mm|cm|dm|km|ml|kg|m|g|t|l|W|V|A|°|%|")';
// Am Ende kein \b: Nach „%", „°" oder „\"" gibt es keine Wortgrenze, die
// Angabe soll aber trotzdem gefunden werden.
const ZAHL_MIT_EINHEIT = new RegExp(`\\b\\d+(?:[.,]\\d+)?\\s*${EINHEIT}(?!\\w)`, 'gi');

/** Vergleichbare Form einer Zahlenangabe: „1,5 mm²" und „1.5mm2" sind dasselbe. */
function normalisiereAngabe(roh: string): string {
  return roh
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/mm2$/, 'mm²')
    .replace(/qmm$/, 'mm²')
    .replace(/rpm$/, 'u/min');
}

/**
 * Sammelt alle Zahlenangaben, die durch die Daten gedeckt sind.
 *
 * Gedeckt heißt: Sie stehen in den Merkmalen, den Maßen, dem Lieferumfang,
 * den Schäden, dem Modellnamen oder der Notiz. Alles andere hat das Modell
 * dazuerfunden.
 */
export function gedeckteAngaben(e: FliesstextEingabe): Set<string> {
  const { erkennung: erk } = e;
  const quellen = [
    erk.artikelTyp,
    erk.titel,
    erk.modell ?? '',
    erk.modellnummer ?? '',
    erk.baujahr ? String(erk.baujahr) : '',
    // Jede Länge einzeln mit Einheit: In „60 x 40 x 20 cm" steht die Einheit
    // nur hinten, ein Text über „60 cm Breite" wäre sonst nicht gedeckt.
    [erk.masseCm?.laenge, erk.masseCm?.breite, erk.masseCm?.hoehe]
      .filter((w): w is number => typeof w === 'number' && Number.isFinite(w))
      .map((w) => `${w} cm`)
      .join(' '),
    e.notiz ?? '',
    ...erk.schaeden,
    ...erk.lieferumfang,
    ...erk.merkmale.map((m) => `${m.name} ${m.wert}`),
    ...erk.suchbegriffe,
  ].join(' \n ');

  const treffer = new Set<string>();
  for (const roh of quellen.match(ZAHL_MIT_EINHEIT) ?? []) treffer.add(normalisiereAngabe(roh));
  return treffer;
}

export interface Befund {
  /** Zahlenangaben im Text, die in den Daten nicht vorkommen. */
  erfundeneAngaben: string[];
  /** Herstellername trotz generischer Vorgabe (LAPP). */
  markeVerraten: string[];
}

/**
 * Prüft einen erzeugten Text gegen die Datengrundlage.
 *
 * Absichtlich stumpf und nicht klug: Es geht nicht darum, jeden Fehler zu
 * finden, sondern die eine Sorte Fehler zuverlässig zu fangen, die teuer
 * wird — eine Zahl mit Einheit, die niemand gemessen hat.
 */
export function pruefeFliesstext(text: string, e: FliesstextEingabe): Befund {
  const gedeckt = gedeckteAngaben(e);
  const erfunden: string[] = [];
  for (const roh of text.match(ZAHL_MIT_EINHEIT) ?? []) {
    if (!gedeckt.has(normalisiereAngabe(roh))) erfunden.push(roh.trim());
  }

  const markeVerraten: string[] = [];
  if (e.generisch) {
    const verboten = [e.erkennung.hersteller, e.erkennung.modell].filter(
      (w): w is string => Boolean(w && w.trim().length >= 3),
    );
    for (const wort of verboten) {
      if (new RegExp(wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text)) markeVerraten.push(wort);
    }
  }

  return { erfundeneAngaben: [...new Set(erfunden)], markeVerraten };
}

/** Alle Textteile eines Fließtextes am Stück — für die Prüfung. */
export function fliesstextAlsText(f: Fliesstext): string {
  return [
    f.teaser ?? '',
    ...(f.bullets ?? []),
    f.anwendung ?? '',
    f.vorteile ?? '',
    ...(f.faq ?? []).flatMap((q) => [q.frage, q.antwort]),
  ].join('\n');
}

/**
 * Entfernt die Sätze, in denen erfundene Zahlenangaben stehen.
 *
 * Nicht die Zahl allein: „Die Leistung beträgt ." wäre schlimmer als der
 * ganze Satz weniger. Ein Absatz, der danach leer ist, fällt weg — die
 * Produktkarte lässt leere Abschnitte ohnehin aus.
 */
export function entferneErfundeneSaetze(text: string, erfunden: string[]): string {
  if (erfunden.length === 0) return text;
  const muster = erfunden.map((a) => normalisiereAngabe(a));
  const saetze = text.split(/(?<=[.!?])\s+/);
  const behalten = saetze.filter((satz) => {
    const drin = satz.match(ZAHL_MIT_EINHEIT) ?? [];
    return !drin.some((a) => muster.includes(normalisiereAngabe(a)));
  });
  return behalten.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Putzt einen erzeugten Fließtext.
 *
 * Erfundene Angaben fliegen raus, Bullets werden auf Länge gebracht, und was
 * danach leer ist, wird zu null — die Produktkarte lässt leere Abschnitte
 * weg, statt eine Überschrift ohne Inhalt zu setzen.
 */
export function bereinigeFliesstext(roh: FliesstextRoh, e: FliesstextEingabe): { text: Fliesstext; befund: Befund } {
  const befund = pruefeFliesstext(fliesstextAlsText(roh), e);
  const putz = (s: string): string => entferneErfundeneSaetze(s ?? '', befund.erfundeneAngaben).trim();
  const leerZuNull = (s: string): string | null => (s.length > 0 ? s : null);

  const bullets = (roh.bullets ?? [])
    .map((b) => putz(b))
    .filter((b) => b.length > 0)
    .slice(0, ANZAHL_BULLETS)
    .map((b) => b.slice(0, MAX_BULLET_ZEICHEN));

  const faq: FaqEintrag[] = (roh.faq ?? [])
    .map((q) => ({ frage: (q.frage ?? '').trim(), antwort: putz(q.antwort ?? '') }))
    .filter((q) => q.frage.length > 0 && q.antwort.length > 0);

  return {
    text: {
      teaser: leerZuNull(putz(roh.teaser ?? '')),
      bullets,
      anwendung: leerZuNull(putz(roh.anwendung ?? '')),
      vorteile: leerZuNull(putz(roh.vorteile ?? '')),
      faq,
    },
    befund,
  };
}

// ---------------------------------------------------------------------------
// Der Aufruf
// ---------------------------------------------------------------------------

export interface FliesstextErgebnis {
  text: Fliesstext;
  befund: Befund;
  modell: string;
  verbrauch: { eingabe: number; ausgabe: number };
}

export function anthropicKonfiguriert(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/**
 * Schreibt den Fließtext für einen Artikel.
 *
 * Kommt die Marke trotz generischer Vorgabe durch (LAPP), gibt es keinen
 * Text: Lieber eine Produktkarte ohne Fließtext als eine, die wir nicht
 * veröffentlichen dürfen.
 */
export async function schreibeFliesstext(e: FliesstextEingabe): Promise<FliesstextErgebnis> {
  if (!anthropicKonfiguriert()) {
    throw new Error('ANTHROPIC_API_KEY fehlt — ohne ihn entsteht kein Fließtext.');
  }

  const client = new Anthropic();
  const modell = 'claude-opus-5';

  const antwort = await client.messages.parse({
    model: modell,
    max_tokens: 8000,
    system: ANWEISUNG,
    output_config: { format: zodOutputFormat(FliesstextSchema), effort: 'medium' },
    messages: [
      {
        role: 'user',
        content:
          'Schreib die Produktkarten-Texte für diesen Artikel. Das ist die vollständige Datengrundlage:\n\n' +
          datengrundlage(e),
      },
    ],
  });

  if (antwort.stop_reason === 'refusal') throw new Error('Die Texterstellung wurde abgelehnt.');
  if (!antwort.parsed_output) throw new Error('Der Fließtext kam nicht in der erwarteten Form zurück.');

  const { text, befund } = bereinigeFliesstext(antwort.parsed_output, e);

  if (befund.markeVerraten.length > 0) {
    throw new Error(
      `Der Text nennt trotz Vorgabe ${befund.markeVerraten.join(', ')} — bei dieser Marke darf das nirgends stehen.`,
    );
  }

  return {
    text,
    befund,
    modell,
    verbrauch: { eingabe: antwort.usage.input_tokens, ausgabe: antwort.usage.output_tokens },
  };
}
