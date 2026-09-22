/**
 * Die Preisrecherche als Plan — ohne Netz.
 *
 * Hier steht, WONACH gesucht wird und in welcher Reihenfolge. Das Suchen
 * selbst steht in `recherche.ts`; die Trennung gibt es, damit die Reihenfolge
 * prüfbar ist, ohne bei jedem Test das halbe Internet zu befragen.
 *
 * Die Reihenfolge folgt der Arbeitsanweisung:
 *   1. Exaktes Produkt: Hersteller + vollständige Typennummer.
 *   2. Kein Treffer → Typennummer schrittweise kürzen.
 *   7. Bleibt nur der Hersteller, geht es über technische Daten und Maße.
 */

import { masseText, type Erkennung } from '@/lib/erfassung/erkennung';

// ---------------------------------------------------------------------------
// Typennummer kürzen (SOP Schritt 2)
// ---------------------------------------------------------------------------

/**
 * Zerlegt eine Typennummer an ihren natürlichen Fugen.
 *
 * Fugen sind Trennzeichen und der Wechsel zwischen Buchstaben und Ziffern.
 * „1LA7130-4AA10" zerfällt so in 1 / LA / 7130 / 4 / AA / 10 — und genau an
 * diesen Stellen kürzt ein Mensch die Nummer auch, wenn er die Baureihe sucht.
 * Stumpf Zeichen abzuschneiden ergäbe „1LA7130-4AA1", und das ist keine
 * Baureihe, sondern ein Tippfehler.
 */
export function segmente(nummer: string): string[] {
  const roh = (nummer ?? '').trim();
  if (!roh) return [];
  return roh
    .replace(/([A-Za-z])(\d)/g, '$1\u0000$2')
    .replace(/(\d)([A-Za-z])/g, '$1\u0000$2')
    .split(/[\s\-_.,/\\]+|\u0000/)
    .filter((s) => s.length > 0);
}

/** Die Länge der Nummer, ohne Trennzeichen — als Maß für „noch aussagekräftig". */
function kern(nummer: string): string {
  return (nummer ?? '').replace(/[^A-Za-z0-9]/g, '');
}

/**
 * Ab hier ist eine gekürzte Nummer keine Nummer mehr, sondern ein Buchstabe
 * mit Zufallstreffern. Drei Zeichen ist die Grenze, unter der eine Suche
 * beliebige Ergebnisse liefert.
 */
export const MINDEST_NUMMER_LAENGE = 3;

/**
 * Die Kürzungsleiter: von der vollständigen Nummer bis zur Baureihe.
 *
 * Jede Sprosse ist ein eigener Suchlauf. Je weiter unten, desto unschärfer
 * der Treffer — deshalb wird sie von oben abgearbeitet und beim ersten
 * brauchbaren Ergebnis abgebrochen, nicht durchgerechnet.
 */
export function kuerzungsleiter(nummer: string | null | undefined): string[] {
  const roh = (nummer ?? '').trim();
  if (!roh) return [];

  const teile = segmente(roh);
  const leiter: string[] = [];
  const gesehen = new Set<string>();

  const merke = (kandidat: string) => {
    const sauber = kandidat.trim().replace(/[\s\-_./\\]+$/, '');
    if (kern(sauber).length < MINDEST_NUMMER_LAENGE) return;
    const schluessel = kern(sauber).toUpperCase();
    if (gesehen.has(schluessel)) return;
    gesehen.add(schluessel);
    leiter.push(sauber);
  };

  merke(roh);

  // Segmente von hinten abwerfen.
  for (let anzahl = teile.length - 1; anzahl >= 1; anzahl--) {
    merke(teile.slice(0, anzahl).join(''));
  }

  // Bleibt am Ende ein langer Ziffernblock, ist auch dessen Anfang noch eine
  // Baureihe: aus „06019" wird „0601". Ziffernweise, aber nur bis zur Grenze.
  const letzte = leiter[leiter.length - 1] ?? '';
  if (/^\d+$/.test(letzte)) {
    for (let laenge = letzte.length - 1; laenge >= MINDEST_NUMMER_LAENGE; laenge--) {
      merke(letzte.slice(0, laenge));
    }
  }

  return leiter;
}

// ---------------------------------------------------------------------------
// Suchaufträge
// ---------------------------------------------------------------------------

export type Absicht =
  /** SOP 1: das exakte Produkt. */
  | 'exakt'
  /** SOP 2: gekürzte Typennummer, also die Baureihe. */
  | 'baureihe'
  /** SOP 7: nur noch Hersteller und Warengattung. */
  | 'gattung'
  /** SOP 7: gar kein Hersteller mehr — über technische Daten und Maße. */
  | 'technisch';

export interface Suchauftrag {
  absicht: Absicht;
  /** Der Suchtext, so wie er in ein Suchfeld eingegeben würde. */
  begriff: string;
  /** Wie belastbar ein Treffer auf dieser Sprosse ist. */
  guete: 'hoch' | 'mittel' | 'niedrig';
  /** Was auf dieser Sprosse gesucht wird — kommt so in die Herleitung. */
  erklaerung: string;
}

function saeubere(teile: Array<string | null | undefined>): string {
  return teile
    .map((t) => (t ?? '').trim())
    .filter((t) => t.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Baut die Suchaufträge für einen Artikel, von scharf nach unscharf.
 *
 * Bei LAPP (generisch) fällt der Herstellername aus den Suchbegriffen heraus —
 * nicht aus Vorsicht vor der Suche, sondern weil ein Preis, den wir nur über
 * den verbotenen Markennamen finden, uns zu einem Listing verleitet, das wir
 * nicht veröffentlichen dürfen.
 */
export function baueSuchauftraege(erk: Erkennung, opts: { generisch?: boolean } = {}): Suchauftrag[] {
  const hersteller = opts.generisch ? null : erk.hersteller?.trim() || null;
  const modell = opts.generisch ? null : erk.modell?.trim() || null;
  const nummer = opts.generisch ? null : erk.modellnummer?.trim() || null;
  const auftraege: Suchauftrag[] = [];

  const leiter = kuerzungsleiter(nummer);

  if (leiter.length > 0) {
    auftraege.push({
      absicht: 'exakt',
      begriff: saeubere([hersteller, leiter[0]]),
      guete: 'hoch',
      erklaerung: `Exaktes Produkt: ${saeubere([hersteller, leiter[0]])}.`,
    });
    for (const gekuerzt of leiter.slice(1)) {
      auftraege.push({
        absicht: 'baureihe',
        begriff: saeubere([hersteller, gekuerzt]),
        guete: 'mittel',
        erklaerung: `Typennummer gekürzt auf „${gekuerzt}" — Baureihe statt Einzeltyp.`,
      });
    }
  }

  // Modellname ohne Nummer: „GSR 18V-55" findet oft mehr als die Sachnummer,
  // weil Händler danach benennen.
  if (modell && (!nummer || !kern(modell).includes(kern(nummer)))) {
    auftraege.push({
      absicht: leiter.length > 0 ? 'baureihe' : 'exakt',
      begriff: saeubere([hersteller, modell]),
      guete: leiter.length > 0 ? 'mittel' : 'hoch',
      erklaerung: `Modellbezeichnung: ${saeubere([hersteller, modell])}.`,
    });
  }

  if (hersteller) {
    auftraege.push({
      absicht: 'gattung',
      begriff: saeubere([hersteller, erk.artikelTyp]),
      guete: 'niedrig',
      erklaerung: `Nur noch Hersteller und Warengattung: ${saeubere([hersteller, erk.artikelTyp])}.`,
    });
  }

  // SOP 7: kein Typ, kein Hersteller — dann über das, was messbar ist.
  const kennwerte = erk.merkmale
    .filter((m) => m.name && m.wert)
    .slice(0, 2)
    .map((m) => m.wert);
  const technisch = saeubere([erk.artikelTyp, ...kennwerte, masseText(erk.masseCm)]);
  if (technisch && technisch !== erk.artikelTyp.trim()) {
    auftraege.push({
      absicht: 'technisch',
      begriff: technisch,
      guete: 'niedrig',
      erklaerung: `Ohne Typenschild über technische Daten und Maße: ${technisch}.`,
    });
  } else {
    auftraege.push({
      absicht: 'technisch',
      begriff: erk.artikelTyp.trim(),
      guete: 'niedrig',
      erklaerung: `Nur die Warengattung: ${erk.artikelTyp.trim()}.`,
    });
  }

  // Doppelte Suchbegriffe entstehen leicht, wenn Modell und Nummer dasselbe
  // sind — sie würden nur Zeit und Aufrufe kosten.
  const gesehen = new Set<string>();
  return auftraege.filter((a) => {
    const schluessel = a.begriff.toLowerCase();
    if (!schluessel || gesehen.has(schluessel)) return false;
    gesehen.add(schluessel);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Herleitung (SOP Schritt 8)
// ---------------------------------------------------------------------------

export interface Herleitung {
  /** Womit gesucht wurde, in der Reihenfolge der Versuche. */
  versuche: Array<{ begriff: string; treffer: number; erklaerung: string }>;
  /** Welche Quellenstufe am Ende zählte. */
  quelle: string | null;
  /** Wie verlässlich das Ergebnis ist. */
  guete: 'hoch' | 'mittel' | 'niedrig';
  zeilen: string[];
}

/**
 * Schreibt die Herleitung als Text.
 *
 * Die Arbeitsanweisung verlangt das ausdrücklich: „Am Ende immer
 * nachvollziehbar festhalten, wie der Preis zustande gekommen ist." Das ist
 * nicht Bürokratie — wenn in vier Wochen jemand fragt, warum der Artikel 39 €
 * kostet, muss die Antwort am Artikel stehen und nicht im Gedächtnis.
 */
export function herleitungText(h: Herleitung): string {
  const zeilen: string[] = ['Preisfindung:'];
  for (const v of h.versuche) {
    zeilen.push(`· ${v.erklaerung} → ${v.treffer === 0 ? 'kein Treffer' : `${v.treffer} Angebot(e)`}`);
  }
  if (h.quelle) zeilen.push(`Verwendete Quelle: ${h.quelle}.`);
  zeilen.push(`Verlässlichkeit: ${h.guete}.`);
  zeilen.push(...h.zeilen.map((z) => `· ${z}`));
  return zeilen.join('\n');
}
