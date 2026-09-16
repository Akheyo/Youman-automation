/**
 * Bilderkennung: Was liegt da eigentlich auf dem Tisch?
 *
 * Alle Fotos EINES Artikels gehen in EINEN Aufruf. Das ist der Kern: Erst im
 * Zusammenhang ergibt sich aus Übersicht, Typenschild und Detailaufnahme ein
 * Gerät — einzeln ausgewertet sieht man dreimal etwas Metallisches.
 *
 * Die Bilder werden als signierte Links übergeben, nicht als Base64. Fünf
 * Handyfotos in voller Auflösung sprengen sonst die Größe einer einzelnen
 * Anfrage, und kleinrechnen wollen wir sie nicht — an der Auflösung hängt, ob
 * die Modellnummer auf dem Typenschild lesbar ist.
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

/** Formate, die die Bildauswertung lesen kann. HEIC gehört nicht dazu. */
export const LESBARE_TYPEN = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

export function istLesbar(contentType: string | null | undefined, pfad?: string | null): boolean {
  const typ = (contentType ?? '').toLowerCase().split(';')[0].trim();
  if (typ) return LESBARE_TYPEN.includes(typ);
  // Kein Content-Type überliefert – dann entscheidet die Endung.
  return /\.(jpe?g|png|webp|gif)$/i.test(pfad ?? '');
}

// ---------------------------------------------------------------------------
// Was herauskommen soll
// ---------------------------------------------------------------------------

/**
 * Jedes Feld darf „unbekannt" sein.
 *
 * Das ist keine Bequemlichkeit, sondern die wichtigste Regel hier: Eine
 * geratene Modellnummer sieht aus wie eine echte, und die Preisrecherche baut
 * später darauf auf. Lieber eine Lücke, die jemand füllt, als eine Angabe, der
 * niemand widerspricht.
 */
export const ErkennungSchema = z.object({
  artikelTyp: z.string().describe('Was ist das? Kurz und allgemein, z. B. "Akkuschrauber", "Bürodrehstuhl".'),
  titel: z.string().describe('Kurzer, sachlicher Titel: Hersteller + Modell + Typ. Ohne Werbesprache.'),
  hersteller: z.string().nullable(),
  modell: z.string().nullable(),
  modellnummer: z.string().nullable().describe('Exakt wie auf dem Typenschild. Nur wenn wirklich lesbar.'),
  seriennummer: z.string().nullable(),
  baujahr: z.string().nullable(),

  zustand: z
    .enum(['neuwertig', 'gebraucht_gut', 'gebraucht_spuren', 'stark_gebraucht', 'defekt', 'unbekannt'])
    .describe('Gesamteindruck nach den Fotos.'),

  schaeden: z
    .array(z.string())
    .describe('Jeder sichtbare Mangel einzeln und knapp, z. B. "Kratzer auf der Gehäuseoberseite".'),

  lieferumfang: z.array(z.string()).describe('Was mit auf den Fotos liegt: Kabel, Koffer, Zubehör.'),
  merkmale: z
    .array(z.object({ name: z.string(), wert: z.string() }))
    .describe('Technische Angaben vom Typenschild oder Gehäuse: Spannung, Leistung, Maße, Material, Farbe.'),

  masseCm: z
    .object({ laenge: z.number().nullable(), breite: z.number().nullable(), hoehe: z.number().nullable() })
    .nullable()
    .describe('Nur wenn ein Maßstab im Bild ist oder Maße aufgedruckt sind. Sonst null statt schätzen.'),

  typenschildGefunden: z.boolean().describe('Ist auf einem der Fotos ein lesbares Typenschild oder Etikett?'),
  suchbegriffe: z
    .array(z.string())
    .describe('2 bis 5 Begriffe, mit denen man dieses Teil im Warenwirtschaftssystem suchen würde.'),

  sicherheit: z.enum(['hoch', 'mittel', 'niedrig']),
  unsicherheiten: z.array(z.string()).describe('Was aus den Fotos nicht sicher hervorgeht.'),

  bilder: z
    .array(
      z.object({
        nummer: z.number().describe('Die Bildnummer aus der Aufgabenstellung.'),
        rolle: z.enum(['uebersicht', 'typenschild', 'schaden', 'detail', 'unbrauchbar']),
        beschreibung: z.string(),
      }),
    )
    .describe('Je Foto: wofür es taugt.'),
});

export type Erkennung = z.infer<typeof ErkennungSchema>;

export const ZUSTAND_TEXT: Record<Erkennung['zustand'], string> = {
  neuwertig: 'neuwertig',
  gebraucht_gut: 'gebraucht, guter Zustand',
  gebraucht_spuren: 'gebraucht, Gebrauchsspuren',
  stark_gebraucht: 'stark gebraucht',
  defekt: 'defekt',
  unbekannt: 'Zustand unklar',
};

// ---------------------------------------------------------------------------
// Notiz
// ---------------------------------------------------------------------------

/** Kopfzeile des maschinellen Teils. Daran wird er beim Neuschreiben erkannt. */
const MARKE = '— Aus den Fotos erkannt —';

/**
 * Setzt die Notiz aus dem, was ein Mensch geschrieben hat, und dem, was die
 * Erkennung gefunden hat.
 *
 * Die menschliche Notiz steht oben und wird NIE überschrieben. Wer am Regal
 * „Fernbedienung fehlt" eintippt, weiß etwas, das auf keinem Foto zu sehen
 * ist — das ist die wertvollere Angabe. Der maschinelle Teil hängt darunter
 * und wird bei jeder neuen Erkennung ersetzt, damit er sich nicht stapelt.
 */
export function notizZusammensetzen(bisher: string | null | undefined, erkennung: Erkennung): string {
  const menschlich = (bisher ?? '').split(MARKE)[0].trim();

  const zeilen: string[] = [MARKE, `Zustand: ${ZUSTAND_TEXT[erkennung.zustand]}`];
  if (erkennung.schaeden.length > 0) {
    zeilen.push('Schäden:');
    for (const schaden of erkennung.schaeden) zeilen.push(`· ${schaden}`);
  } else {
    zeilen.push('Schäden: keine sichtbaren');
  }
  if (erkennung.lieferumfang.length > 0) {
    zeilen.push(`Lieferumfang: ${erkennung.lieferumfang.join(', ')}`);
  }
  if (!erkennung.typenschildGefunden) {
    zeilen.push('Kein lesbares Typenschild auf den Fotos — Modellnummer fehlt.');
  }
  if (erkennung.unsicherheiten.length > 0) {
    zeilen.push(`Unklar: ${erkennung.unsicherheiten.join('; ')}`);
  }

  const maschinell = zeilen.join('\n');
  return menschlich ? `${menschlich}\n\n${maschinell}` : maschinell;
}

// ---------------------------------------------------------------------------
// Der Aufruf
// ---------------------------------------------------------------------------

const ANWEISUNG = `Du wertest Fotos von Gebrauchtware aus, die eine Verwertungsfirma weiterverkauft.
Die Fotos entstehen am Regal, in Eile, bei schlechtem Licht.

Deine Aufgabe: aus allen Fotos ZUSAMMEN erkennen, was das für ein Gegenstand ist.

Regeln:
- Rate nicht. Was du nicht sicher lesen kannst, ist null oder "unbekannt".
  Eine erfundene Modellnummer richtet mehr Schaden an als eine fehlende, weil
  darauf die Preisrecherche aufbaut.
- Modell- und Seriennummern nur, wenn du sie tatsächlich im Bild liest —
  Zeichen für Zeichen, nicht aus dem Zusammenhang ergänzt.
- Schäden vollständig und nüchtern benennen: Kratzer, Rost, Risse, fehlende
  Teile, Verschmutzung, Verformung. Untertreiben hilft niemandem; die Ware
  wird mit diesen Angaben verkauft.
- Beim Zustand vom Sichtbaren ausgehen, nicht vom Erwartbaren.
- Der Titel ist sachlich: Hersteller, Modell, Gerätetyp. Keine Werbesprache,
  keine Ausrufezeichen.
- Antworte auf Deutsch.`;

export interface ErkennungsBild {
  nummer: number;
  url: string;
}

export interface ErkennungsErgebnis {
  erkennung: Erkennung;
  modell: string;
  verbrauch: { eingabe: number; ausgabe: number };
}

export function anthropicKonfiguriert(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** Wertet die Fotos eines Artikels aus. Wirft mit lesbarer Meldung, wenn es nicht geht. */
export async function erkenneArtikel(bilder: ErkennungsBild[]): Promise<ErkennungsErgebnis> {
  if (!anthropicKonfiguriert()) {
    throw new Error('ANTHROPIC_API_KEY fehlt — ohne ihn kann nichts erkannt werden.');
  }
  if (bilder.length === 0) throw new Error('Keine auswertbaren Bilder vorhanden.');

  const client = new Anthropic();
  const modell = 'claude-opus-5';

  const inhalt: Anthropic.ContentBlockParam[] = [];
  for (const bild of bilder) {
    inhalt.push({ type: 'text', text: `Bild ${bild.nummer}:` });
    inhalt.push({ type: 'image', source: { type: 'url', url: bild.url } });
  }
  inhalt.push({
    type: 'text',
    text: `Das sind alle ${bilder.length} Fotos desselben Gegenstands. Werte sie zusammen aus.`,
  });

  const antwort = await client.messages.parse({
    model: modell,
    max_tokens: 8000,
    system: ANWEISUNG,
    output_config: {
      format: zodOutputFormat(ErkennungSchema),
      // Bewusst nicht die hoechste Stufe: Die Auswertung laeuft als
      // Serverless-Funktion gegen eine 60-Sekunden-Wand, und ein Abbruch nach
      // 60 Sekunden kostet Geld UND liefert nichts. Wenn sich zeigt, dass
      // Modellnummern zu oft danebenliegen, ist das hier die Stellschraube.
      effort: 'medium',
    },
    messages: [{ role: 'user', content: inhalt }],
  });

  if (antwort.stop_reason === 'refusal') {
    throw new Error('Die Auswertung wurde abgelehnt. Bitte die Fotos prüfen.');
  }
  if (!antwort.parsed_output) {
    throw new Error('Die Auswertung kam nicht in der erwarteten Form zurück.');
  }

  return {
    erkennung: antwort.parsed_output,
    modell,
    verbrauch: { eingabe: antwort.usage.input_tokens, ausgabe: antwort.usage.output_tokens },
  };
}
