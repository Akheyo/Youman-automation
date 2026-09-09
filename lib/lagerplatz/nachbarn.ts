/**
 * Alternative Lagerplätze finden, wenn ein Artikel nicht am erwarteten Platz
 * liegt — die reine Logik, ohne PlentyONE.
 *
 * Der Kern: Ein Artikel verschwindet selten zufällig. Er liegt fast immer dort,
 * wo etwas anderes liegt, das mit ihm zusammen ins Lager kam oder mit ihm
 * zusammen eingeräumt wurde. Diese Datei sammelt die Regeln dafür:
 *
 *   1. Nachbarschaft der Artikel-IDs — was zusammen angelegt wurde, wurde
 *      meist zusammen eingelagert.
 *   2. Nachbarschaft im Regal — der häufigste Einräumfehler ist „ein Fach
 *      daneben", nicht „ganz woanders".
 *   3. Nachbarschaft in der Zeit — wer eine Palette am Stück einräumt, verteilt
 *      sie über wenige benachbarte Plätze.
 *   4. Größenklasse als Gegenprobe — eine 80-kg-Maschine liegt nicht in
 *      Kiste 71. Das ersetzt den Blick aufs Artikelbild durch eine Rechnung
 *      (die Bilder zeigt die Oberfläche trotzdem, zur Kontrolle).
 *
 * Alle Funktionen hier sind rein: gleiche Eingabe → gleiche Ausgabe, kein Netz.
 */

import { codeAus, klartextAus, findeLagerplaetze, type Segment } from './erkennung';

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Woher ein Kandidat kommt. Die Reihenfolge ist die Stärke des Signals. */
export type Signal =
  | 'eigener-bestand'   // Der Artikel ist tatsächlich hierhin verbucht.
  | 'eigener-text'      // Der Platz steht im Text des Artikels selbst.
  | 'historie'          // Laut Warenbewegungen lag er hier schon einmal.
  | 'namensdublette'    // Ein gleichnamiger Artikel liegt hier.
  | 'id-nachbar'        // Ein Artikel mit benachbarter ID liegt hier.
  | 'einlagerung'       // Wurde im selben Vorgang an diesen Platz gebucht.
  | 'anlagedatum'       // Am selben Tag angelegt wie der gesuchte Artikel.
  | 'regal-nachbar'     // Direkt neben einem anderen Kandidaten im Regal.
  | 'platztausch';      // Auf dem Soll-Platz liegt ein Fremdartikel.

/**
 * Grundgewicht je Signal (0–100). Mehrere Signale addieren sich gedämpft.
 *
 * Die Reihenfolge bildet den Suchweg ab, der sich im Lager bewährt hat: erst
 * schauen, was der Artikel selbst sagt (Bestand, Text), dann seine eigene
 * Vergangenheit (Bewegungen), dann ob es ihn nochmal gibt (Dublette), und erst
 * danach die Umgebung (Nachbarn, Einlagerung, Anlagetag, Regal).
 */
export const GEWICHT: Record<Signal, number> = {
  'eigener-bestand': 100,
  'eigener-text': 80,
  'historie': 70,
  'namensdublette': 65,
  'id-nachbar': 55,
  'einlagerung': 50,
  'anlagedatum': 45,
  'platztausch': 40,
  'regal-nachbar': 30,
};

/** Wie groß ein Artikel ist — entscheidet, welche Plätze überhaupt passen. */
export type Groessenklasse = 'kleinteil' | 'mittel' | 'grossteil' | 'unbekannt';

/** Maße und Gewicht, wie PlentyONE sie an der Variante führt. */
export interface Masse {
  /** Gewicht in Gramm. */
  gewichtG?: number | null;
  breiteMM?: number | null;
  laengeMM?: number | null;
  hoeheMM?: number | null;
}

/** Ein Beleg dafür, warum ein Platz in Frage kommt. */
export interface Beleg {
  signal: Signal;
  /** Klartext für die Oberfläche, z. B. „Variante 44231 (ID −2) liegt hier". */
  text: string;
  /** Die Variante, die den Beleg liefert — für Bild und Verlinkung. */
  variationId?: number | null;
  /** Abstand zum gesuchten Artikel (IDs bzw. Minuten) — kleiner ist besser. */
  abstand?: number | null;
  /**
   * Wann das passiert ist, als ISO-Zeitstempel — bei Buchungen die Buchungs-,
   * sonst die Anlagezeit. Beim Einlagern ist die Uhrzeit das eigentliche
   * Argument: Was in derselben Minute gebucht wurde, kam mit derselben
   * Palette. „5 min versetzt" allein sagt nicht, ob das um 9 Uhr früh oder
   * mitten in der Spätschicht war.
   */
  zeit?: string | null;
}

/** Ein möglicher Lagerplatz mit allem, was dafür und dagegen spricht. */
export interface Kandidat {
  /** Normierte Form, z. B. „H1/R6/EA F05-K12". */
  code: string;
  klartext: string;
  segment: Segment | null;
  /** 0–100. Nur zum Sortieren gedacht, keine Wahrscheinlichkeit. */
  punkte: number;
  belege: Beleg[];
  /** Gründe, die gegen den Platz sprechen — werden in der Oberfläche gezeigt. */
  einwaende: string[];
  /** Lagerort-ID in Plenty, falls der Platz dort wirklich existiert. */
  lagerortId: number | null;
  /** Ob der Platz in Plenty angelegt ist. Fehlt er, ist der Hinweis schwächer. */
  existiert: boolean;
}

// ---------------------------------------------------------------------------
// Nachbarschaft der IDs
// ---------------------------------------------------------------------------

/**
 * IDs rund um eine gesuchte ID — erst die nächsten, dann die entfernteren.
 * Die Reihenfolge zählt: Der erste Treffer soll der nächstliegende sein.
 */
export function idNachbarn(id: number, spanne: number): number[] {
  const mitte = Math.floor(id);
  const weite = Math.max(0, Math.floor(spanne));
  const out: number[] = [];
  for (let abstand = 1; abstand <= weite; abstand++) {
    for (const kandidat of [mitte - abstand, mitte + abstand]) {
      if (kandidat > 0) out.push(kandidat);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Nachbarschaft im Regal
// ---------------------------------------------------------------------------

/** Zerlegt einen Lagerplatz-Code wieder in seine Bestandteile. */
export function segmentAus(code: string): Segment | null {
  const treffer = findeLagerplaetze(code);
  return treffer.length ? treffer[0].segment : null;
}

/** Zählt einen Ebenen-Buchstaben hoch oder runter („A" + 1 = „B"). */
function ebeneVerschoben(ebene: string, um: number): string | null {
  if (!/^[A-J]$/.test(ebene)) return null; // mehrstellige Ebenen lassen wir in Ruhe
  const neu = ebene.charCodeAt(0) + um;
  if (neu < 65 || neu > 74) return null; // außerhalb A–J
  return String.fromCharCode(neu);
}

/** Verschiebt eine Zahl mit optionalem Buchstabenpräfix („M1" → „M2"). */
function zahlVerschoben(wert: string, um: number): string | null {
  const m = wert.match(/^([A-Z]*)(\d+)$/);
  if (!m) return null;
  const neu = Number(m[2]) + um;
  if (neu < 1) return null;
  return `${m[1]}${neu}`;
}

/**
 * Physisch benachbarte Plätze zu einem gegebenen Platz.
 *
 * Bewusst asymmetrisch gewichtet: Ein Fach daneben ist wahrscheinlicher als
 * eine Ebene darüber, und eine Ebene darüber wahrscheinlicher als ein anderes
 * Regal. Andere Regale und Hallen erzeugen wir gar nicht — wer dorthin greift,
 * sucht nicht mehr „daneben", sondern von vorn.
 */
export function regalNachbarn(
  code: string,
  opts: { fach?: number; kiste?: number; ebene?: number } = {},
): Array<{ code: string; abstand: number; grund: string }> {
  const seg = segmentAus(code);
  if (!seg) return [];
  const fachWeite = Math.max(0, Math.floor(opts.fach ?? 2));
  const kisteWeite = Math.max(0, Math.floor(opts.kiste ?? 2));
  const ebeneWeite = Math.max(0, Math.floor(opts.ebene ?? 1));

  const out = new Map<string, { code: string; abstand: number; grund: string }>();
  const merke = (s: Segment, abstand: number, grund: string) => {
    const neu = codeAus(s);
    if (neu === code) return;
    const alt = out.get(neu);
    if (!alt || alt.abstand > abstand) out.set(neu, { code: neu, abstand, grund });
  };

  for (let d = 1; d <= fachWeite; d++) {
    for (const um of [-d, d]) {
      const fach = zahlVerschoben(seg.fach, um);
      if (fach) merke({ ...seg, fach }, d, `Fach ${um > 0 ? '+' : ''}${um}`);
    }
  }

  // Kisten nur, wenn der Platz überhaupt Kisten führt.
  if (seg.kiste && seg.kiste.startsWith('K')) {
    for (let d = 1; d <= kisteWeite; d++) {
      for (const um of [-d, d]) {
        const nummer = zahlVerschoben(seg.kiste.slice(1), um);
        if (nummer) {
          merke({ ...seg, kiste: `K${nummer.padStart(2, '0')}` }, d, `Kiste ${um > 0 ? '+' : ''}${um}`);
        }
      }
    }
  }

  for (let d = 1; d <= ebeneWeite; d++) {
    for (const um of [-d, d]) {
      const ebene = ebeneVerschoben(seg.ebene, um);
      if (ebene) merke({ ...seg, ebene }, d + 1, `Ebene ${um > 0 ? '+' : ''}${um}`);
    }
  }

  return [...out.values()].sort((a, b) => a.abstand - b.abstand);
}

// ---------------------------------------------------------------------------
// Größenklasse
// ---------------------------------------------------------------------------

/**
 * Schätzt aus Gewicht und Maßen, in welche Art Platz ein Artikel gehört.
 *
 * Die Schwellen stammen aus dem, was im Lager physisch möglich ist: In eine
 * Kleinteilkiste passt ungefähr ein Schuhkarton; was über 25 kg wiegt oder
 * länger als 80 cm ist, hebt niemand in ein Regalfach.
 *
 * Fehlen die Angaben, ist das Ergebnis 'unbekannt' — dann wird auch nichts
 * abgewertet. Lieber keine Aussage als eine falsche.
 */
export function groessenklasse(masse: Masse): Groessenklasse {
  const g = Number(masse.gewichtG);
  const kanten = [masse.breiteMM, masse.laengeMM, masse.hoeheMM]
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0);
  const gewichtBekannt = Number.isFinite(g) && g > 0;
  if (!gewichtBekannt && kanten.length < 3) return 'unbekannt';

  const maxKante = kanten.length ? Math.max(...kanten) : 0;
  const volumenMM3 = kanten.length === 3 ? kanten[0] * kanten[1] * kanten[2] : 0;

  if ((gewichtBekannt && g >= 25_000) || maxKante >= 800 || volumenMM3 >= 125_000_000) {
    return 'grossteil';
  }
  if (
    (!gewichtBekannt || g <= 2_000) &&
    (!kanten.length || (maxKante <= 300 && (!volumenMM3 || volumenMM3 <= 12_000_000)))
  ) {
    return 'kleinteil';
  }
  return 'mittel';
}

/** Welche Art Platz ist das? Aus dem Code ablesbar. */
function platzart(seg: Segment): 'kiste' | 'palette' | 'regalfach' {
  if (seg.kiste?.startsWith('P')) return 'palette';
  if (seg.kiste?.startsWith('K') || seg.regal.includes('KTL')) return 'kiste';
  return 'regalfach';
}

/**
 * Prüft, ob ein Platz zur Größe des Artikels passt.
 * Gibt den Einwand als Klartext zurück — oder null, wenn nichts dagegen spricht.
 *
 * Das ist die Rechenfassung dessen, was heute per Artikelbild geprüft wird:
 * „das ist ein Kleinteil, wir suchen aber eine Maschine — hier liegt sie nicht."
 */
export function einwandGroesse(klasse: Groessenklasse, code: string): string | null {
  if (klasse === 'unbekannt') return null;
  const seg = segmentAus(code);
  if (!seg) return null;
  const art = platzart(seg);

  if (art === 'kiste' && klasse === 'grossteil') {
    return 'Großteil passt nicht in eine Kleinteilkiste';
  }
  if (art === 'palette' && klasse === 'kleinteil') {
    return 'Kleinteil liegt selten auf einem Palettenplatz';
  }
  // Schweres kommt nicht nach oben — ab Ebene D wird gehoben statt gestapelt.
  if (art === 'regalfach' && klasse === 'grossteil' && /^[D-J]$/.test(seg.ebene)) {
    return `Großteil in Ebene ${seg.ebene} — dort wird nichts Schweres eingelagert`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Bewertung
// ---------------------------------------------------------------------------

/** Ein Roh-Hinweis, bevor die Kandidaten zusammengefasst sind. */
export interface Hinweis {
  code: string;
  signal: Signal;
  text: string;
  variationId?: number | null;
  /** Abstand in IDs bzw. Minuten. Dämpft das Gewicht des Signals. */
  abstand?: number | null;
  /** ISO-Zeitstempel des Vorgangs, siehe `Beleg.zeit`. */
  zeit?: string | null;
}

/**
 * Dämpft ein Signal nach Abstand: direkt daneben zählt voll, weiter weg
 * weniger. Bei Abstand 0/null bleibt das volle Gewicht.
 */
function gedaempft(gewicht: number, abstand: number | null | undefined): number {
  const a = Number(abstand);
  if (!Number.isFinite(a) || a <= 0) return gewicht;
  return gewicht / (1 + a * 0.35);
}

/**
 * Fasst Hinweise zu Kandidaten zusammen und sortiert sie.
 *
 * Mehrere Signale auf denselben Platz verstärken sich, aber gedämpft: Das
 * stärkste Signal zählt voll, jedes weitere nur noch zur Hälfte seines Werts.
 * Sonst würden fünf schwache Hinweise einen starken überholen.
 */
export function bewerte(
  hinweise: Hinweis[],
  opts: {
    klasse?: Groessenklasse;
    /** Bekannte Lagerorte aus Plenty: Code → ID. */
    bekannteOrte?: Map<string, number>;
  } = {},
): Kandidat[] {
  const klasse = opts.klasse ?? 'unbekannt';
  const orte = opts.bekannteOrte;
  const gruppen = new Map<string, Beleg[]>();

  for (const h of hinweise) {
    if (!h?.code) continue;
    const liste = gruppen.get(h.code) ?? [];
    liste.push({
      signal: h.signal,
      text: h.text,
      variationId: h.variationId ?? null,
      abstand: h.abstand ?? null,
      zeit: h.zeit ?? null,
    });
    gruppen.set(h.code, liste);
  }

  const kandidaten: Kandidat[] = [];
  for (const [code, belege] of gruppen) {
    // Je Signal nur den stärksten Beleg werten, sonst gewinnt schiere Menge.
    const stärkstesJeSignal = new Map<Signal, number>();
    for (const b of belege) {
      const wert = gedaempft(GEWICHT[b.signal] ?? 0, b.abstand);
      if (wert > (stärkstesJeSignal.get(b.signal) ?? 0)) stärkstesJeSignal.set(b.signal, wert);
    }
    const werte = [...stärkstesJeSignal.values()].sort((a, b) => b - a);
    let punkte = werte.length ? werte[0] + werte.slice(1).reduce((a, w) => a + w * 0.5, 0) : 0;

    const einwaende: string[] = [];
    const seg = segmentAus(code);

    const einwand = einwandGroesse(klasse, code);
    if (einwand) {
      einwaende.push(einwand);
      punkte *= 0.35;
    }

    const lagerortId = orte?.get(code) ?? null;
    const existiert = !orte || lagerortId !== null;
    if (orte && lagerortId === null) {
      einwaende.push('Diesen Lagerort gibt es in Plenty nicht');
      punkte *= 0.6;
    }

    // Belege nach Stärke sortieren, damit die Oberfläche oben das Beste zeigt.
    belege.sort((a, b) => gedaempft(GEWICHT[b.signal], b.abstand) - gedaempft(GEWICHT[a.signal], a.abstand));

    kandidaten.push({
      code,
      klartext: seg ? klartextAus(seg) : code,
      segment: seg,
      punkte: Math.round(Math.min(100, punkte) * 10) / 10,
      belege,
      einwaende,
      lagerortId,
      existiert,
    });
  }

  return kandidaten.sort((a, b) => b.punkte - a.punkte || a.code.localeCompare(b.code));
}

// ---------------------------------------------------------------------------
// Laufzettel
// ---------------------------------------------------------------------------

/**
 * Sortiert Kandidaten nach Laufweg statt nach Punkten: Halle, Regal, Ebene,
 * Fach, Kiste. Wer suchen geht, läuft die Halle einmal ab, statt zwischen
 * bestbewerteten Plätzen hin- und herzuspringen.
 */
export function laufzettel(kandidaten: Kandidat[]): Kandidat[] {
  const schluessel = (k: Kandidat) => {
    const s = k.segment;
    if (!s) return [99, 'ZZ', 'Z', 999, 999] as const;
    const zahl = (w: string) => {
      const m = w.match(/(\d+)/);
      return m ? Number(m[1]) : 0;
    };
    return [s.halle, s.regal.padStart(4, '0'), s.ebene || 'Z', zahl(s.fach), zahl(s.kiste ?? '0')] as const;
  };
  return [...kandidaten].sort((a, b) => {
    const x = schluessel(a);
    const y = schluessel(b);
    for (let i = 0; i < x.length; i++) {
      if (x[i] < y[i]) return -1;
      if (x[i] > y[i]) return 1;
    }
    return 0;
  });
}
