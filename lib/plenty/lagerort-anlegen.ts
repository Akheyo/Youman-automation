/**
 * Lagerorte in PlentyONE anlegen — ohne die Maske „Neue Lagerorte anlegen".
 *
 * WIE PLENTY LAGERORTE FÜHRT
 * --------------------------
 * Drei Ebenen, alle in der REST-Doku beschrieben:
 *
 *   Dimension  Die Spalte an sich — Halle, Regal, Ebene, Feld. Je Lager fest
 *              eingerichtet, mit Kürzel ("H") und Trennzeichen ("/").
 *              GET /rest/warehouses/{id}/locations/dimensions
 *   Level      Ein Knoten in dieser Spalte, z. B. Halle "1" oder Feld "07".
 *              Hat parentId (der Knoten darüber), dimensionId und Position.
 *              GET  /rest/warehouses/{id}/locations/levels
 *              POST /rest/warehouses/locations/levels
 *   Lagerort   Das Blatt darunter, z. B. Kiste "K04". Das ist die ID, auf die
 *              später Bestand gebucht wird.
 *              POST /rest/warehouses/locations
 *
 * Aus "H1/R7/EC F16-K04" werden also vier Levels (1, 7, C, 16) und ein
 * Lagerort (K04). Existiert ein Level schon, wird es wiederverwendet.
 *
 * WARUM NICHT DER previews-ENDPUNKT
 * ---------------------------------
 * POST /rest/warehouses/locations/previews ist der Generator hinter der Maske
 * und würde einen ganzen Bereich in einem Aufruf anlegen. Seine drei Array-
 * Parameter sind in der Spec aber nur als "array of string" beschrieben, ohne
 * Feldnamen. Für einen schreibenden Aufruf ist das zu wenig; deshalb hier die
 * dokumentierten Einzelendpunkte. Mehr Aufrufe, dafür kein Raten.
 *
 * SCHUTZ
 * ------
 *   - `probelauf: true` ist Voreinstellung; dann wird nichts geschrieben.
 *   - Was es schon gibt, wird übersprungen — es entstehen keine Dubletten.
 *   - Zweck, Status und die Schreibweise der Namen werden NICHT erfunden,
 *     sondern aus den vorhandenen Lagerorten desselben Lagers abgelesen.
 *   - Ein Fehler in einer Zeile stoppt den Lauf nicht, sondern wird vermerkt.
 *   - Zeitbudget je Aufruf, damit die Funktion nicht in den Timeout läuft;
 *     der Rest wird als „offen" gemeldet und im nächsten Aufruf erledigt.
 */

import { plentyGet, plentyPost } from './client';
import { ladeLagerorte, verzeichnis } from './lagerorte';
import { codeAus, findeLagerplaetze, type Segment } from '@/lib/lagerplatz/erkennung';

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Eine Spalte der Lagerortstruktur (Halle, Regal, Ebene, Feld). */
export interface Dimension {
  id: number;
  /** Tiefe, 1 = oberste Spalte. */
  tiefe: number;
  name: string;
  /** Kürzel, das im Namen erscheint, z. B. "H". */
  kuerzel: string;
}

/** Ein Knoten der Struktur, z. B. Halle "1" oder Feld "07". */
export interface Knoten {
  id: number;
  parentId: number;
  dimensionId: number;
  name: string;
  position: number;
}

export type AnlageStatus = 'vorhanden' | 'geplant' | 'angelegt' | 'uebersprungen' | 'fehler';

/** Was mit einem gewünschten Lagerort passiert ist. */
export interface AnlageZeile {
  code: string;
  status: AnlageStatus;
  /** ID des Lagerorts — bei „vorhanden" die bestehende, bei „angelegt" die neue. */
  id: number | null;
  /** Wie viele Struktur-Knoten dafür neu angelegt wurden (0, wenn alles stand). */
  neueKnoten: number;
  hinweis: string | null;
}

export interface AnlageErgebnis {
  ok: boolean;
  probelauf: boolean;
  error: string | null;
  warehouseId: number;
  /** Wie viele Lagerorte das Lager vor dem Lauf hatte. */
  bestehende: number;
  vorhanden: number;
  geplant: number;
  angelegt: number;
  uebersprungen: number;
  fehler: number;
  /** Neu angelegte Struktur-Knoten (Hallen/Regale/Ebenen/Felder). */
  neueKnoten: number;
  /** Noch nicht abgearbeitet, weil das Zeitbudget aufgebraucht war. */
  offen: number;
  /** Index in der Eingabeliste, ab dem der nächste Aufruf weitermachen muss. */
  naechsterIndex: number;
  /** PlentyONE hat die Schreibbremse gezogen — vor dem Weitermachen warten. */
  schreiblimit: boolean;
  zeilen: AnlageZeile[];
  diagnose: string[];
  dauerMs: number;
}

export interface AnlageOptionen {
  warehouseId: number;
  /** Ohne ausdrückliches `probelauf: false` wird nichts geschrieben. */
  probelauf?: boolean;
  /** Obergrenze für tatsächlich angelegte Lagerorte je Aufruf. */
  maxAnlagen?: number;
  /** Zeitbudget in Millisekunden; danach bricht der Lauf sauber ab. */
  budgetMs?: number;
  /** Nur setzen, wenn die abgelesenen Werte nicht passen. */
  zweck?: string;
  status?: string;
}

interface PlentyListe<T> {
  entries?: T[];
  isLastPage?: boolean;
  lastPageNumber?: number;
}

// ---------------------------------------------------------------------------
// Code zerlegen
// ---------------------------------------------------------------------------

/**
 * Zerlegt einen Lagerplatz-Code der einheitlichen Form in seine vier
 * Strukturteile und die Bezeichnung des Lagerorts.
 *
 * "H1/R7/EC F16-K04" → halle 1, regal 7, ebene C, fach 16, bezeichnung "K04"
 * "H2/R7/EA F07-0"   → …, bezeichnung "0" (Stellplatz ohne Kiste)
 *
 * Gibt null zurück, wenn der Text nicht eindeutig ein Lagerplatz ist — dann
 * wird die Zeile übersprungen statt geraten.
 */
export function zerlegeCode(text: string): (Segment & { bezeichnung: string }) | null {
  const treffer = findeLagerplaetze(text);
  if (treffer.length !== 1) return null;
  const s = treffer[0].segment;
  // Ohne Ebene ist der Platz unvollständig; so etwas legen wir nicht an.
  if (!s.ebene) return null;
  return { ...s, bezeichnung: s.kiste ?? '0' };
}

/**
 * Liest an vorhandenen Namen ab, ob Zahlen aufgefüllt werden ("07" statt "7").
 * Erfinden wollen wir die Schreibweise nicht — sie muss zu dem passen, was im
 * Lager schon steht, sonst stehen später zwei Felder nebeneinander.
 */
export function stellenAus(namen: Iterable<string>): number {
  let breite = 0;
  for (const n of namen) {
    if (!/^\d+$/.test(n)) continue;
    // Nur führende Nullen verraten die Absicht; "16" allein sagt nichts.
    if (n.startsWith('0')) breite = Math.max(breite, n.length);
  }
  return breite;
}

/** Bringt einen Namen auf die abgelesene Schreibweise. */
export function nameMitStellen(name: string, breite: number): string {
  if (breite <= 0 || !/^\d+$/.test(name)) return name;
  return name.padStart(breite, '0');
}

/**
 * Alle Schreibweisen, unter denen derselbe Knoten in Plenty stehen kann.
 *
 * Zwei Dinge zugleich:
 *
 *  1. Das Kürzel der Spalte steht IM NAMEN des Knotens. Die Halle heißt "H1",
 *     nicht "1"; das Regal "R7", die Ebene "EC", das Feld "F16". Wer ohne
 *     Kürzel sucht, findet nichts — und legt einen kompletten zweiten Baum
 *     an, dessen Lagerorte dann "1/7/C 16-K01" heißen statt
 *     "H1/R7/EC F16-K01". Genau das ist einmal passiert.
 *  2. Zahlen stehen mal mit, mal ohne führende Null: Feld 2 ist "F2" oder
 *     "F02".
 *
 * Die erste Schreibweise der Liste ist die, in der ein fehlender Knoten
 * angelegt wird.
 */
export function schreibweisen(wert: string, kuerzel = ''): string[] {
  const formen = /^\d+$/.test(wert)
    ? [...new Set([wert, String(Number(wert)), String(Number(wert)).padStart(2, '0'), String(Number(wert)).padStart(3, '0')])]
    : [wert];
  const mitKuerzel = kuerzel ? formen.map((f) => `${kuerzel}${f}`) : [];
  // Mit Kürzel zuerst: so heißen die echten Knoten.
  return [...new Set([...mitKuerzel, ...formen])];
}

/** Kurze Pause; PlentyONE begrenzt Schreibzugriffe pro Zeitfenster. */
function warte(ms: number): Promise<void> {
  return new Promise((fertig) => setTimeout(fertig, ms));
}

/** Erkennt die Schreibbremse von PlentyONE an der Antwort. */
export function istSchreiblimit(fehler: unknown): boolean {
  const text = (fehler as Error)?.message ?? '';
  return /HTTP 429/.test(text) || /write limit/i.test(text);
}

/**
 * Führt einen Schreibzugriff aus und wiederholt ihn, wenn PlentyONE mit
 * „short period write limit reached" bremst. Das Limit ist keine Störung,
 * sondern der Normalfall bei tausend Anlagen hintereinander.
 */
export async function schreibeMitGeduld<T>(fn: () => Promise<T>, versuche = 3): Promise<T> {
  for (let versuch = 1; ; versuch++) {
    try {
      return await fn();
    } catch (err) {
      if (versuch >= versuche || !istSchreiblimit(err)) throw err;
      await warte(2_000 * versuch);
    }
  }
}

// ---------------------------------------------------------------------------
// Struktur lesen
// ---------------------------------------------------------------------------

/**
 * Liest Dimensionen und Knoten eines Lagers.
 *
 * Die Knotenliste MUSS vollständig sein: Wird ein vorhandener Knoten
 * übersehen, legt der Lauf ihn ein zweites Mal an. Deshalb wird geblättert,
 * bis Plenty die letzte Seite meldet — und wenn das nicht gelingt, wird das
 * als `vollstaendig: false` zurückgegeben statt stillschweigend geschluckt.
 */
export async function ladeStruktur(
  warehouseId: number,
  opts: { maxSeiten?: number; proSeite?: number; gleichzeitig?: number } = {},
): Promise<{ dimensionen: Dimension[]; knoten: Knoten[]; vollstaendig: boolean }> {
  const proSeite = Math.min(250, Math.max(1, Math.floor(opts.proSeite ?? 250)));
  const maxSeiten = Math.max(1, Math.floor(opts.maxSeiten ?? 200));
  const gleichzeitig = Math.min(10, Math.max(1, Math.floor(opts.gleichzeitig ?? 6)));

  const rohDim = await plentyGet<PlentyListe<Record<string, unknown>> | Array<Record<string, unknown>>>(
    `/rest/warehouses/${warehouseId}/locations/dimensions`,
  );
  const dimEintraege = Array.isArray(rohDim) ? rohDim : (rohDim?.entries ?? []);
  const dimensionen: Dimension[] = dimEintraege
    .filter((d) => Number.isFinite(Number(d?.id)))
    .map((d) => ({
      id: Number(d.id),
      tiefe: Number(d.level ?? 0),
      name: String(d.name ?? ''),
      kuerzel: String(d.shortcut ?? ''),
    }))
    .sort((a, b) => a.tiefe - b.tiefe);

  const knoten: Knoten[] = [];
  const uebernimm = (roh: PlentyListe<Record<string, unknown>> | Array<Record<string, unknown>> | null) => {
    const eintraege = Array.isArray(roh) ? roh : (roh?.entries ?? []);
    for (const l of eintraege) {
      if (!Number.isFinite(Number(l?.id))) continue;
      knoten.push({
        id: Number(l.id),
        parentId: Number(l.parentId ?? 0),
        dimensionId: Number(l.dimensionId ?? 0),
        name: String(l.name ?? '').trim(),
        position: Number(l.position ?? 0),
      });
    }
    return eintraege.length;
  };

  const seiteLesen = (seite: number) =>
    plentyGet<PlentyListe<Record<string, unknown>> | Array<Record<string, unknown>>>(
      `/rest/warehouses/${warehouseId}/locations/levels?itemsPerPage=${proSeite}&page=${seite}`,
    );

  /**
   * Ist diese Seite die letzte? Eine reine Liste ist immer vollständig. Sagt
   * Plenty es ausdrücklich, gilt die Angabe — auch ein „nein" bei kurzer
   * Seite. Fehlt die Angabe, ist eine nicht volle Seite das Ende.
   */
  const fertig = (
    roh: PlentyListe<Record<string, unknown>> | Array<Record<string, unknown>> | null,
    anzahl: number,
  ) => {
    if (Array.isArray(roh)) return true;
    if (typeof roh?.isLastPage === 'boolean') return roh.isLastPage;
    return anzahl === 0 || anzahl < proSeite;
  };

  const erste = await seiteLesen(1);
  const ersteAnzahl = uebernimm(erste);
  if (fertig(erste, ersteAnzahl)) return { dimensionen, knoten, vollstaendig: true };

  const letzte = Array.isArray(erste) ? 0 : Number(erste?.lastPageNumber ?? 0);
  if (letzte > 1) {
    const seiten: number[] = [];
    for (let s = 2; s <= Math.min(letzte, maxSeiten); s++) seiten.push(s);
    for (let i = 0; i < seiten.length; i += gleichzeitig) {
      const gruppe = await Promise.all(seiten.slice(i, i + gleichzeitig).map(seiteLesen));
      for (const res of gruppe) uebernimm(res);
    }
    return { dimensionen, knoten, vollstaendig: letzte <= maxSeiten };
  }

  for (let seite = 2; seite <= maxSeiten; seite++) {
    const res = await seiteLesen(seite);
    if (fertig(res, uebernimm(res))) return { dimensionen, knoten, vollstaendig: true };
  }
  return { dimensionen, knoten, vollstaendig: false };
}

/** Schlüssel für die Knotensuche: gleicher Elternknoten, gleiche Spalte, gleicher Name. */
function knotenSchluessel(parentId: number, dimensionId: number, name: string): string {
  return `${parentId}|${dimensionId}|${name.toUpperCase()}`;
}

/**
 * Holt einen Lagerort und die Kette seiner Strukturknoten nach oben — roh,
 * so wie PlentyONE sie liefert.
 *
 * Gebraucht zur Klärung, wenn ein angelegter Lagerort in der Plenty-Maske
 * nicht auftaucht: Daran lässt sich ablesen, wie er wirklich heißt und unter
 * welchem Pfad er hängt, statt es aus dem Verhalten zu erraten.
 */
export async function pruefeLagerort(
  lagerortId: number,
): Promise<{ lagerort: Record<string, unknown> | null; kette: Array<Record<string, unknown>>; fehler: string | null }> {
  const kette: Array<Record<string, unknown>> = [];
  try {
    const lagerort = await plentyGet<Record<string, unknown>>(
      `/rest/warehouses/locations/${lagerortId}`,
    );
    let levelId = Number(lagerort?.levelId ?? 0);
    // Höchstens zehn Stufen — die Struktur hat vier, alles darüber wäre ein Kreis.
    for (let stufe = 0; stufe < 10 && Number.isFinite(levelId) && levelId > 0; stufe++) {
      const knoten = await plentyGet<Record<string, unknown>>(
        `/rest/warehouses/locations/levels/${levelId}`,
      );
      if (!knoten) break;
      kette.push(knoten);
      levelId = Number(knoten?.parentId ?? 0);
    }
    return { lagerort, kette, fehler: null };
  } catch (err) {
    return { lagerort: null, kette, fehler: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Anlegen
// ---------------------------------------------------------------------------

/**
 * Legt die übergebenen Lagerorte an — oder zeigt im Probelauf nur, was
 * passieren würde.
 *
 * Die Reihenfolge der Rückgabe entspricht der Eingabe, damit sich das Ergebnis
 * Zeile für Zeile mit der Wunschliste vergleichen lässt.
 */
export async function legeLagerorteAn(
  codes: string[],
  opts: AnlageOptionen,
): Promise<AnlageErgebnis> {
  const start = Date.now();
  const probelauf = opts.probelauf !== false;
  const maxAnlagen = Math.max(0, Math.floor(opts.maxAnlagen ?? 200));
  const budgetMs = Math.max(5_000, Math.floor(opts.budgetMs ?? 45_000));
  const diagnose: string[] = [];
  const zeilen: AnlageZeile[] = [];

  const leer = (fehler: string): AnlageErgebnis => ({
    ok: false,
    probelauf,
    error: fehler,
    warehouseId: opts.warehouseId,
    bestehende: 0,
    vorhanden: 0,
    geplant: 0,
    angelegt: 0,
    uebersprungen: 0,
    fehler: 0,
    neueKnoten: 0,
    offen: codes.length,
    naechsterIndex: 0,
    schreiblimit: false,
    zeilen: [],
    diagnose,
    dauerMs: Date.now() - start,
  });

  // --- Bestand lesen ------------------------------------------------------
  let bestehende: Awaited<ReturnType<typeof ladeLagerorte>>;
  let struktur: Awaited<ReturnType<typeof ladeStruktur>>;
  try {
    [bestehende, struktur] = await Promise.all([
      ladeLagerorte(opts.warehouseId),
      ladeStruktur(opts.warehouseId),
    ]);
  } catch (err) {
    return leer(`Struktur des Lagers ${opts.warehouseId} nicht lesbar: ${(err as Error).message}`);
  }

  const leseDauer = Date.now() - start;
  const { nachCode, doppelt } = verzeichnis(bestehende.orte);
  diagnose.push(
    `${bestehende.orte.length} vorhandene Lagerorte und ${struktur.knoten.length} Strukturknoten gelesen ` +
      `(${(leseDauer / 1000).toFixed(1)} s), davon ${nachCode.size} eindeutig zuordenbar` +
      (doppelt ? `, ${doppelt} doppelte Namen` : ''),
  );
  if (bestehende.abgebrochen) {
    return leer(
      'Die Liste der vorhandenen Lagerorte war nicht vollständig lesbar. Ohne vollständige Liste wird nicht angelegt — sonst entstehen Dubletten.',
    );
  }
  if (!struktur.vollstaendig) {
    return leer(
      'Die Struktur des Lagers (Hallen/Regale/Ebenen/Felder) war nicht vollständig lesbar. Ohne vollständige Liste wird nicht angelegt — sonst entstehen doppelte Felder.',
    );
  }
  // Bleibt nach dem Lesen keine Zeit mehr, käme sonst ein Ergebnis mit lauter
  // Nullen heraus, das wie ein leerer Lauf aussieht. Lieber deutlich sagen,
  // woran es liegt.
  if (budgetMs - leseDauer < 4_000) {
    return leer(
      `Das Lesen der vorhandenen Lagerorte hat allein ${(leseDauer / 1000).toFixed(1)} s gedauert — ` +
        'für den Abgleich blieb keine Zeit. Bitte erneut versuchen; hält das an, muss das Lesen weiter beschleunigt werden.',
    );
  }

  // Spalten: die vier Ebenen von oben nach unten.
  const nachTiefe = [...struktur.dimensionen].sort((a, b) => a.tiefe - b.tiefe);
  if (nachTiefe.length < 4) {
    return leer(
      `Das Lager hat nur ${nachTiefe.length} Strukturspalten; erwartet werden vier (Halle, Regal, Ebene, Feld).`,
    );
  }
  const [dHalle, dRegal, dEbene, dFach] = nachTiefe;
  diagnose.push(
    `Struktur: ${nachTiefe.map((d) => `${d.name || '?'} (${d.kuerzel || '–'})`).join(' › ')}`,
  );

  // Wurzel: der Elternknoten, unter dem die obersten Knoten hängen.
  const oberste = struktur.knoten.filter((k) => k.dimensionId === dHalle.id);
  if (!oberste.length) {
    return leer(
      'Im Lager gibt es noch keinen einzigen Knoten der obersten Spalte. Der erste muss von Hand angelegt werden, damit die Wurzel-ID bekannt ist.',
    );
  }
  const wurzelId = oberste[0].parentId;

  // Schreibweise je Spalte von den vorhandenen Knoten ablesen.
  const stellen = new Map<number, number>();
  for (const d of nachTiefe) {
    stellen.set(
      d.id,
      stellenAus(struktur.knoten.filter((k) => k.dimensionId === d.id).map((k) => k.name)),
    );
  }

  // Zweck und Status von den vorhandenen Lagerorten übernehmen (häufigster Wert).
  const haeufigster = (werte: Array<string | null>): string | null => {
    const zaehler = new Map<string, number>();
    for (const w of werte) {
      if (!w) continue;
      zaehler.set(w, (zaehler.get(w) ?? 0) + 1);
    }
    let besterWert: string | null = null;
    let bestesMal = 0;
    for (const [w, n] of zaehler) if (n > bestesMal) [besterWert, bestesMal] = [w, n];
    return besterWert;
  };
  const zweck = opts.zweck ?? haeufigster(bestehende.orte.map((o) => o.zweck));
  const status = opts.status ?? haeufigster(bestehende.orte.map((o) => o.status));
  if (!zweck || !status) {
    return leer(
      'Zweck oder Status ließen sich aus den vorhandenen Lagerorten nicht ablesen. Bitte beides ausdrücklich angeben.',
    );
  }
  diagnose.push(`Neue Lagerorte bekommen Zweck "${zweck}" und Status "${status}" — abgelesen vom Bestand.`);

  // Knotenindex aufbauen; er wächst mit, sobald ein Knoten angelegt wurde.
  const index = new Map<string, Knoten>();
  const letztePosition = new Map<string, number>();
  const geschwister = new Map<string, string[]>();
  for (const k of struktur.knoten) {
    index.set(knotenSchluessel(k.parentId, k.dimensionId, k.name), k);
    const gruppe = `${k.parentId}|${k.dimensionId}`;
    letztePosition.set(gruppe, Math.max(letztePosition.get(gruppe) ?? 0, k.position));
    const namen = geschwister.get(gruppe) ?? [];
    namen.push(k.name);
    geschwister.set(gruppe, namen);
  }

  /**
   * Schreibweise der Geschwister unter genau diesem Elternknoten. Die ist
   * verlässlicher als der Durchschnitt des ganzen Lagers: In Burlo stehen
   * "F2" und "F02" nebeneinander, aber innerhalb eines Regals ist es meist
   * einheitlich.
   */
  const stellenDerGruppe = (gruppe: string, kuerzel = ''): number | null => {
    const namen = geschwister.get(gruppe);
    if (!namen?.length) return null;
    // Das Kürzel gehört zum Namen ("F02") — für die Frage nach führenden
    // Nullen zählt nur der Zahlenteil.
    return stellenAus(namen.map((n) => (kuerzel && n.startsWith(kuerzel) ? n.slice(kuerzel.length) : n)));
  };

  let neueKnoten = 0;
  let angelegt = 0;
  let vorhanden = 0;
  let uebersprungen = 0;
  let fehler = 0;

  /** Sucht einen Knoten oder legt ihn an. Im Probelauf wird nur gezählt. */
  async function sorgeFuerKnoten(
    parentId: number,
    dimensionId: number,
    kuerzel: string,
    rohName: string,
  ): Promise<{ id: number; neu: boolean }> {
    const gruppe = `${parentId}|${dimensionId}`;

    // Erst in ALLEN Schreibweisen suchen — mit Kürzel ("H1") und ohne ("1"),
    // mit und ohne führende Null. Wer nur eine Form sucht, legt den Knoten
    // ein zweites Mal an.
    for (const kandidat of schreibweisen(rohName, kuerzel)) {
      const da = index.get(knotenSchluessel(parentId, dimensionId, kandidat));
      if (da) return { id: da.id, neu: false };
    }

    // Nichts gefunden: neu anlegen — mit Kürzel, und in der Schreibweise der
    // Geschwister unter genau diesem Elternknoten.
    const zahl = nameMitStellen(rohName, stellenDerGruppe(gruppe, kuerzel) ?? stellen.get(dimensionId) ?? 0);
    const name = `${kuerzel}${zahl}`;
    const schluessel = knotenSchluessel(parentId, dimensionId, name);

    const position = (letztePosition.get(gruppe) ?? 0) + 1;
    letztePosition.set(gruppe, position);

    if (probelauf) {
      // Platzhalter mit negativer ID: eindeutig ungültig, aber im Index
      // wiederauffindbar, damit Geschwister im selben Probelauf nicht doppelt
      // gezählt werden.
      const platzhalter: Knoten = { id: -(index.size + 1), parentId, dimensionId, name, position };
      index.set(schluessel, platzhalter);
      return { id: platzhalter.id, neu: true };
    }

    const antwort = await schreibeMitGeduld(() =>
      plentyPost<Record<string, unknown>>('/rest/warehouses/locations/levels', {
        parentId,
        dimensionId,
        position,
        name,
      }),
    );
    const id = Number(antwort?.id);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error(`Knoten "${name}" angelegt, aber Plenty lieferte keine ID zurück.`);
    }
    index.set(schluessel, { id, parentId, dimensionId, name, position });
    geschwister.set(gruppe, [...(geschwister.get(gruppe) ?? []), name]);
    return { id, neu: true };
  }

  // --- Zeilen abarbeiten --------------------------------------------------
  let offen = 0;
  let abgebrochen = false;
  let schreiblimit = false;

  for (let i = 0; i < codes.length; i++) {
    const roh = codes[i];

    if (abgebrochen) {
      offen += 1;
      continue;
    }
    if (Date.now() - start > budgetMs) {
      abgebrochen = true;
      offen += 1;
      continue;
    }

    const teile = zerlegeCode(roh);
    if (!teile) {
      zeilen.push({
        code: roh,
        status: 'uebersprungen',
        id: null,
        neueKnoten: 0,
        hinweis: 'Kein eindeutiger, vollständiger Lagerplatz — nicht angelegt.',
      });
      uebersprungen += 1;
      continue;
    }

    const code = codeAus(teile);
    const schonDa = nachCode.get(code);
    if (schonDa) {
      zeilen.push({
        code,
        status: 'vorhanden',
        id: schonDa.id,
        neueKnoten: 0,
        hinweis: `Gibt es bereits als "${schonDa.name}".`,
      });
      vorhanden += 1;
      continue;
    }

    if (!probelauf && angelegt >= maxAnlagen) {
      abgebrochen = true;
      offen += 1;
      continue;
    }

    try {
      let neuHier = 0;
      const hEbene = await sorgeFuerKnoten(wurzelId, dHalle.id, dHalle.kuerzel, String(teile.halle));
      if (hEbene.neu) neuHier += 1;
      const rEbene = await sorgeFuerKnoten(hEbene.id, dRegal.id, dRegal.kuerzel, teile.regal);
      if (rEbene.neu) neuHier += 1;
      const eEbene = await sorgeFuerKnoten(rEbene.id, dEbene.id, dEbene.kuerzel, teile.ebene);
      if (eEbene.neu) neuHier += 1;
      const fEbene = await sorgeFuerKnoten(eEbene.id, dFach.id, dFach.kuerzel, teile.fach);
      if (fEbene.neu) neuHier += 1;
      neueKnoten += neuHier;

      if (probelauf) {
        zeilen.push({ code, status: 'geplant', id: null, neueKnoten: neuHier, hinweis: null });
        continue;
      }

      const antwort = await schreibeMitGeduld(() =>
        plentyPost<Record<string, unknown>>('/rest/warehouses/locations', {
          levelId: fEbene.id,
          label: teile.bezeichnung,
          purposeKey: zweck,
          statusKey: status,
          position: 1,
        }),
      );
      const id = Number(antwort?.id);
      zeilen.push({
        code,
        status: 'angelegt',
        id: Number.isFinite(id) && id > 0 ? id : null,
        neueKnoten: neuHier,
        hinweis: null,
      });
      // Sofort in den Bestand aufnehmen, damit derselbe Code in derselben
      // Liste kein zweites Mal angelegt wird.
      nachCode.set(code, {
        id: Number.isFinite(id) ? id : 0,
        name: code,
        code,
        status,
        zweck,
        levelId: fEbene.id,
      });
      angelegt += 1;
    } catch (err) {
      zeilen.push({
        code,
        status: 'fehler',
        id: null,
        neueKnoten: 0,
        hinweis: (err as Error).message.slice(0, 300),
      });
      fehler += 1;
      // Bremst PlentyONE trotz Wiederholungen weiter, hat es keinen Sinn, die
      // restliche Liste in Fehler laufen zu lassen. Der Lauf hält an und wird
      // nach einer Pause fortgesetzt.
      if (istSchreiblimit(err)) {
        schreiblimit = true;
        abgebrochen = true;
      }
    }
  }

  if (schreiblimit) {
    diagnose.push(
      `PlentyONE hat die Schreibbremse gezogen ("short period write limit"). ` +
        `${angelegt} Lagerorte sind angelegt, ${offen} Zeilen bleiben offen — nach einer Pause geht es weiter.`,
    );
  } else if (abgebrochen) {
    diagnose.push(
      probelauf
        ? `Zeitbudget aufgebraucht — ${offen} Zeilen offen. Der nächste Aufruf macht dort weiter.`
        : `Lauf beendet bei ${angelegt} angelegten Lagerorten — ${offen} Zeilen offen (Obergrenze oder Zeitbudget).`,
    );
  }

  const geplant = zeilen.filter((z) => z.status === 'geplant').length;

  return {
    ok: true,
    probelauf,
    error: null,
    warehouseId: opts.warehouseId,
    bestehende: bestehende.orte.length,
    vorhanden,
    geplant,
    angelegt,
    uebersprungen,
    fehler,
    neueKnoten,
    offen,
    naechsterIndex: codes.length - offen,
    schreiblimit,
    zeilen,
    diagnose,
    dauerMs: Date.now() - start,
  };
}
