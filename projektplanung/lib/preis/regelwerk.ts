/**
 * Das Preisregelwerk der Komplett Konzept Verwertungs GmbH.
 *
 * Alle Rechenregeln an einer Stelle, ohne Netz und ohne Datenbank — damit sie
 * testbar sind. Eine falsche Regel hier kostet bei jedem Artikel Geld, und zwar
 * lautlos; deshalb hat jede Regel einen Test und jede Zahl eine Herkunft.
 *
 * QUELLEN:
 *  (V)   mündlich von Amanuel, September 2026
 *  (SOP) „Plenty_SOP_3", internes Ablaufdokument
 *  (A)   ANNAHME von mir — noch nicht bestätigt, siehe ANNAHMEN unten
 */

// ---------------------------------------------------------------------------
// Offene Annahmen — hier korrigieren, nicht im Code verstreut
// ---------------------------------------------------------------------------

/**
 * ANNAHMEN, die noch bestätigt werden müssen:
 *
 * 1. ZUSTANDSFAKTOR: (SOP) sagt glatt 60 %, (V) sagte „60–65 %, je nach
 *    Zustand". Umgesetzt ist die feinere Lesart: 65 % bei normaler
 *    Gebrauchtware, 60 % bei gravierenden Schäden. Schmutz und normale
 *    Gebrauchsspuren ziehen NICHTS ab — das war (V) ausdrücklich wichtig.
 *
 * 2. RUNDUNG: (V) nennt 31 → 29, 340 → 339, 1240 → 1239. (SOP) rechnet
 *    58,10 → 58. Beides zusammen geht nur auf, wenn die 9 gesucht wird,
 *    solange der Abschlag klein bleibt — sonst wird schlicht abgerundet.
 *    MAX_RUNDUNGS_ABSCHLAG = 3 € erfüllt alle vier Beispiele.
 *
 * 3. UNTERBIETUNG: (SOP) unterbietet nur über den abgezogenen Versand.
 *    (V) nannte zusätzlich 1–5 €. Umgesetzt als Staffel ZUSÄTZLICH zum
 *    Versandabzug. Soll das weg, UNTERBIETUNG_STAFFEL auf 0 setzen.
 *
 * 4. AUSREISSER: (V) beschrieb zwei Fälle, beide passen auf „mehr als 20 %
 *    unter dem Feld". Die Zahl ist gerechnet, nicht genannt.
 */

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------

export type Zustand = 'neu_versiegelt' | 'neu' | 'gebraucht' | 'defekt';

export const ZUSTAND_TEXT: Record<Zustand, string> = {
  neu_versiegelt: 'Neu (versiegelt)',
  neu: 'Neu: Sonstige',
  gebraucht: 'Gebraucht',
  defekt: 'Defekt',
};

/**
 * Umrechnungsfaktoren zwischen Zuständen (SOP).
 *
 * Gelesen als: preis[nach] = preis[von] × FAKTOR[von][nach]
 *   neu → gebraucht  × 0,60
 *   gebraucht → neu  ÷ 0,60
 *   gebraucht → defekt × 0,40
 *   neu → defekt      × 0,30
 */
const NEU_ZU_GEBRAUCHT = 0.6;
const GEBRAUCHT_ZU_DEFEKT = 0.4;
const NEU_ZU_DEFEKT = 0.3;

/**
 * Aufschlag auf den Gebrauchtfaktor, wenn die Ware KEINE gravierenden Schäden
 * hat (A, siehe Annahme 1). Aus 60 % werden dann 65 %.
 */
const GEBRAUCHT_GUT_BONUS = 0.05;

/** Ist das ein Schaden, der den Gebrauchswert angreift? (V) */
export interface Zustandslage {
  /** Tiefe Kratzer, Risse, Verformung, fehlende Teile — nicht Schmutz. */
  gravierendeSchaeden: boolean;
}

/** Welcher Anteil vom Neupreis bleibt bei Gebrauchtware? */
export function gebrauchtAnteil(lage: Zustandslage): number {
  return lage.gravierendeSchaeden ? NEU_ZU_GEBRAUCHT : NEU_ZU_GEBRAUCHT + GEBRAUCHT_GUT_BONUS;
}

/**
 * Rechnet einen gefundenen Preis auf den Zustand unserer Ware um.
 *
 * Beispiel: Wir haben gebraucht, online steht nur Neuware für 150 € →
 * 150 × 0,65 = 97,50.
 */
export function aufZustandUmrechnen(
  preis: number,
  gefundenAls: Zustand,
  unserZustand: Zustand,
  lage: Zustandslage = { gravierendeSchaeden: false },
): number {
  if (preis <= 0) return 0;
  const neuwertig = (z: Zustand) => z === 'neu' || z === 'neu_versiegelt';

  if (neuwertig(gefundenAls) && neuwertig(unserZustand)) return preis;
  if (gefundenAls === unserZustand) return preis;

  // Alles läuft über den Neupreis als gemeinsame Bezugsgröße.
  let alsNeu: number;
  if (neuwertig(gefundenAls)) alsNeu = preis;
  else if (gefundenAls === 'gebraucht') alsNeu = preis / gebrauchtAnteil(lage);
  else alsNeu = preis / NEU_ZU_DEFEKT;

  if (neuwertig(unserZustand)) return alsNeu;
  if (unserZustand === 'gebraucht') return alsNeu * gebrauchtAnteil(lage);
  return alsNeu * NEU_ZU_DEFEKT;
}

export { NEU_ZU_GEBRAUCHT, GEBRAUCHT_ZU_DEFEKT, NEU_ZU_DEFEKT };

// ---------------------------------------------------------------------------
// Rundung
// ---------------------------------------------------------------------------

/**
 * Wie weit ein Preis für eine schöne Endziffer höchstens fallen darf (A).
 *
 * Ohne diese Grenze würde aus 58 € plötzlich 49 € — neun Euro verschenkt für
 * eine Ziffer. Mit 3 € gehen alle bekannten Beispiele auf: 31 → 29, 340 → 339,
 * 1240 → 1239, und 58,10 bleibt 58.
 */
export const MAX_RUNDUNGS_ABSCHLAG = 3;

/**
 * Rundet auf eine Zahl mit 9 am Ende — aber nur, wenn das nicht zu teuer wird.
 * Sonst wird schlicht auf volle Euro abgerundet.
 *
 * Nach unten wird IMMER gerundet, nie nach oben: Ein aufgerundeter Preis
 * könnte den Wettbewerber, den wir gerade unterbieten wollten, wieder
 * überholen.
 */
export function schoenerPreis(betrag: number): number {
  if (!Number.isFinite(betrag) || betrag <= 0) return 0;
  const ganz = Math.floor(betrag);
  if (ganz < 10) return ganz; // unter 10 € ist jede Ziffer recht
  const letzte = ganz % 10;
  const aufNeun = letzte === 9 ? ganz : ganz - letzte - 1;
  const abschlag = betrag - aufNeun;
  return abschlag <= MAX_RUNDUNGS_ABSCHLAG ? aufNeun : ganz;
}

// ---------------------------------------------------------------------------
// Vergleichsangebote und Ausreißer
// ---------------------------------------------------------------------------

export interface Angebot {
  /** Artikelpreis ohne Versand, brutto. */
  preis: number;
  /** Versandkosten des Anbieters. 0 = versandkostenfrei. */
  versand: number;
  /** Bestand des Anbieters, falls bekannt — wenig Bestand macht Ausreißer wahrscheinlicher. */
  bestand?: number | null;
  quelle?: string;
}

/** Was eBay sortiert: Preis plus Versand. */
export function gesamtpreis(angebot: Angebot): number {
  return angebot.preis + angebot.versand;
}

/**
 * Wie weit ein Angebot unter dem Feld liegen darf, bevor es als Ausreißer gilt (A).
 *
 * Beide von (V) genannten Fälle passen darauf: 20 € gegen ein Feld bei 50–70,
 * und 400 € gegen ein Feld bei 500.
 */
export const AUSREISSER_ANTEIL = 0.2;

function median(werte: number[]): number {
  const s = [...werte].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface Feldbefund {
  /** Die Angebote, an denen wir uns orientieren — aufsteigend nach Gesamtpreis. */
  feld: Angebot[];
  /** Aussortierte Einzelkämpfer weit unter dem Feld. */
  ausreisser: Angebot[];
  /** Das Angebot, das wir unterbieten. Null, wenn es keins gibt. */
  referenz: Angebot | null;
  begruendung: string[];
}

/**
 * Sortiert Billig-Ausreißer aus und bestimmt das maßgebliche Angebot.
 *
 * WARUM NICHT EINFACH DER GÜNSTIGSTE: Ein Einzelstück für 20 € neben sechs
 * Händlern bei 50–70 € ist kein Markt, sondern ein Sonderfall. Wer sich daran
 * orientiert, verschenkt bei jedem Artikel Geld — und der Billigheimer ist
 * nach einem Verkauf ohnehin weg. (V)
 */
export function feldBestimmen(angebote: Angebot[]): Feldbefund {
  const begruendung: string[] = [];
  const brauchbar = angebote.filter((a) => Number.isFinite(a.preis) && a.preis > 0);
  if (brauchbar.length === 0) {
    return { feld: [], ausreisser: [], referenz: null, begruendung: ['Keine verwertbaren Angebote.'] };
  }

  let feld = [...brauchbar].sort((a, b) => gesamtpreis(a) - gesamtpreis(b));
  const ausreisser: Angebot[] = [];

  // Solange der Günstigste deutlich unter dem Rest liegt, fliegt er raus.
  // Mit weniger als drei Angeboten gibt es kein "Feld", gegen das man messen
  // könnte — dann bleibt alles stehen.
  while (feld.length >= 3) {
    const [guenstigster, ...rest] = feld;
    const mitte = median(rest.map(gesamtpreis));
    const grenze = mitte * (1 - AUSREISSER_ANTEIL);
    if (gesamtpreis(guenstigster) >= grenze) break;
    ausreisser.push(guenstigster);
    begruendung.push(
      `${gesamtpreis(guenstigster).toFixed(2)} € liegt mehr als ${Math.round(AUSREISSER_ANTEIL * 100)} % ` +
        `unter dem Feld (Mitte ${mitte.toFixed(2)} €)` +
        (guenstigster.bestand != null && guenstigster.bestand <= 1 ? ' und ist ein Einzelstück' : '') +
        ' — nicht als Maßstab genommen.',
    );
    feld = rest;
  }

  return { feld, ausreisser, referenz: feld[0] ?? null, begruendung };
}

// ---------------------------------------------------------------------------
// Unterbietung
// ---------------------------------------------------------------------------

/**
 * Wie viel wir unter dem maßgeblichen Gesamtpreis landen wollen (V, A).
 * Gestaffelt, weil 1 € bei einem 800-€-Artikel niemanden beeindruckt.
 */
export const UNTERBIETUNG_STAFFEL: Array<{ bis: number; abschlag: number }> = [
  { bis: 50, abschlag: 1 },
  { bis: 150, abschlag: 2 },
  { bis: 500, abschlag: 3 },
  { bis: Infinity, abschlag: 5 },
];

export function unterbietung(gesamt: number): number {
  return UNTERBIETUNG_STAFFEL.find((s) => gesamt <= s.bis)?.abschlag ?? 5;
}

// ---------------------------------------------------------------------------
// Der Preis
// ---------------------------------------------------------------------------

/** Wie viel günstiger der Webshop gegenüber eBay ist (SOP). */
export const WEBSHOP_ABSCHLAG = 0.05;

export interface PreisEingabe {
  /** Vergleichsangebote, bereits auf unseren Zustand umgerechnet. */
  angebote: Angebot[];
  /** Unsere eigenen Versandkosten laut Versandprofil in Plenty. */
  unserVersand: number;
}

export interface PreisErgebnis {
  /** Verkaufspreis auf eBay, brutto. Null, wenn kein Preis ableitbar ist. */
  ebay: number | null;
  /** Verkaufspreis im Webshop, brutto (5 % unter eBay). */
  webshop: number | null;
  referenz: Angebot | null;
  ausreisser: Angebot[];
  /**
   * Wahr, wenn unser Versand so hoch ist, dass wir über die Sortierung
   * Preis+Versand nicht zu gewinnen sind. Dann gibt es keinen Preis, sondern
   * eine Aussage.
   */
  versandFrisstPreis: boolean;
  begruendung: string[];
}

/**
 * Rechnet den Verkaufspreis aus den Vergleichsangeboten.
 *
 * eBay sortiert nach Preis PLUS Versand — deshalb muss die Summe unterbieten,
 * nicht der Artikelpreis. Unser eigener Versand geht daher vom Ziel ab:
 *
 *   unser Preis = (Referenz-Gesamtpreis − Unterbietung) − unser Versand
 *
 * Beispiel aus dem SOP: 60 € + 6 € Versand = 66, minus unser Versand 7,90
 * → 58,10 → 58 €.
 */
export function preisBestimmen({ angebote, unserVersand }: PreisEingabe): PreisErgebnis {
  const befund = feldBestimmen(angebote);
  const begruendung = [...befund.begruendung];

  if (!befund.referenz) {
    return {
      ebay: null,
      webshop: null,
      referenz: null,
      ausreisser: befund.ausreisser,
      versandFrisstPreis: false,
      begruendung: [...begruendung, 'Kein Vergleichsangebot — kein Preis ableitbar.'],
    };
  }

  const ziel = gesamtpreis(befund.referenz);
  const abschlag = unterbietung(ziel);
  const roh = ziel - abschlag - unserVersand;

  begruendung.push(
    `Maßgeblich: ${befund.referenz.preis.toFixed(2)} € + ${befund.referenz.versand.toFixed(2)} € Versand ` +
      `= ${ziel.toFixed(2)} € gesamt${befund.referenz.quelle ? ` (${befund.referenz.quelle})` : ''}.`,
    `Abzüglich ${abschlag.toFixed(2)} € Unterbietung und ${unserVersand.toFixed(2)} € eigener Versand → ${roh.toFixed(2)} €.`,
  );

  if (roh <= 0) {
    // Kein Rechenfehler, sondern ein Befund: Bei diesem Artikel sind wir über
    // die Sortierung nicht zu gewinnen. Lieber sagen als einen Preis erfinden.
    begruendung.push(
      'Unser Versand ist höher als der Spielraum — über die Sortierung Preis+Versand ist dieser Artikel nicht zu gewinnen.',
    );
    return {
      ebay: null,
      webshop: null,
      referenz: befund.referenz,
      ausreisser: befund.ausreisser,
      versandFrisstPreis: true,
      begruendung,
    };
  }

  const ebay = schoenerPreis(roh);
  const webshop = schoenerPreis(ebay * (1 - WEBSHOP_ABSCHLAG));
  begruendung.push(`Gerundet: ${ebay} € auf eBay, ${webshop} € im Webshop (5 % darunter).`);

  return { ebay, webshop, referenz: befund.referenz, ausreisser: befund.ausreisser, versandFrisstPreis: false, begruendung };
}

// ---------------------------------------------------------------------------
// Lohnt sich das Listing überhaupt?
// ---------------------------------------------------------------------------

/**
 * Untergrenze für den Gesamtwert einer Position (V: „ab 13 €").
 *
 * Gemessen wird Stückpreis × Bestand, nicht der Stückpreis: Ein Listing kostet
 * dieselbe Arbeit, ob eins oder zehn Stück darin liegen. Zehn Teile à 10 €
 * lohnen sich, eines für 10 € nicht.
 */
export const MINDEST_GESAMTWERT = 13;

export interface Lohnbefund {
  lohntSich: boolean;
  gesamtwert: number;
  begruendung: string;
}

export function lohntListing(stueckpreis: number | null, bestand: number): Lohnbefund {
  if (stueckpreis == null || stueckpreis <= 0) {
    return { lohntSich: false, gesamtwert: 0, begruendung: 'Ohne Preis lässt sich das nicht entscheiden.' };
  }
  const gesamtwert = stueckpreis * Math.max(bestand, 1);
  return gesamtwert >= MINDEST_GESAMTWERT
    ? { lohntSich: true, gesamtwert, begruendung: `${gesamtwert.toFixed(2)} € Gesamtwert.` }
    : {
        lohntSich: false,
        gesamtwert,
        begruendung: `Nur ${gesamtwert.toFixed(2)} € Gesamtwert — unter ${MINDEST_GESAMTWERT} € lohnt das Einstellen nicht.`,
      };
}
