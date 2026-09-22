/**
 * Kategoriezuordnung: Wo im Plenty-Baum gehört dieser Artikel hin?
 *
 * Die Zuordnung ist zweigeteilt, und das mit Absicht:
 *
 *   - `waehleKategorie` ist reine Rechnerei über einem eingelesenen Baum und
 *     lässt sich deshalb prüfen, ohne Plenty anzufassen.
 *   - `ladeKategoriebaum` holt den Baum und hält ihn im Speicher, weil er sich
 *     selten ändert und Plenty das Lesen spürbar bremst.
 *
 * Die wichtigere Entscheidung steckt in `MINDEST_PUNKTE`: Reicht es nicht,
 * gibt es KEINE Kategorie, nicht die bestmögliche. Ein Staubsauger unter
 * „Hydraulik" ist schlimmer als ein Artikel in der Sammelkategorie — denn der
 * Artikel wird ohnehin inaktiv angelegt und im Büro durchgesehen, und dort
 * fällt eine leere Zuordnung auf, eine falsche nicht.
 */

import { plentyGet } from './client';

export interface KategorieKnoten {
  id: number;
  name: string;
  elternId: number | null;
  /** Namen von der Wurzel bis hierher, einschließlich des eigenen. */
  weg: string[];
}

// ---------------------------------------------------------------------------
// Wörter
// ---------------------------------------------------------------------------

/** Wörter, die in fast jedem Kategorienamen stehen und deshalb nichts unterscheiden. */
export const FUELLWOERTER = new Set([
  'und',
  'oder',
  'fuer',
  'für',
  'mit',
  'ohne',
  'von',
  'der',
  'die',
  'das',
  'den',
  'dem',
  'sonstige',
  'sonstiges',
  'diverse',
  'diverses',
  'zubehoer',
  'zubehör',
  'artikel',
  'teile',
  'neu',
  'gebraucht',
]);

/** Vereinheitlicht ein Wort, damit „Größen", „groessen" und „GROSSEN" dasselbe sind. */
export function normalisiere(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Zerlegt einen Text in unterscheidende Wörter.
 *
 * Wörter unter vier Zeichen fliegen raus: „M10" oder „8.8" sind zwar echte
 * Angaben, aber als Kategoriesignal wertlos und erzeugen nur Zufallstreffer.
 */
export function woerter(text: string): string[] {
  return normalisiere(text)
    .split(' ')
    .filter((w) => w.length >= 4 && !FUELLWOERTER.has(w));
}

/**
 * Grobe Grundform: hängt die häufigsten deutschen Pluralendungen ab.
 *
 * Bewusst stumpf. Es geht nicht um Grammatik, sondern darum, dass die
 * Kategorie „Schrauben" und der Artikeltyp „Schraube" zueinander finden.
 */
export function stamm(wort: string): string {
  for (const endung of ['ungen', 'innen', 'nen', 'en', 'er', 'se', 'n', 'e', 's']) {
    if (wort.length - endung.length >= 4 && wort.endsWith(endung)) return wort.slice(0, -endung.length);
  }
  return wort;
}

/** Zwei Wörter gelten als gleich, wenn ihre Grundform übereinstimmt. */
export function gleichesWort(a: string, b: string): boolean {
  return a === b || stamm(a) === stamm(b);
}

/**
 * Steckt das eine Wort im anderen?
 *
 * Deutsche Komposita sind der Normalfall: „Akkuschrauber" gehört unter
 * „Schrauber", „Hydraulikpumpe" unter „Pumpen". Ohne diese Regel fände die
 * Zuordnung fast nie etwas.
 *
 * Zwei Längengrenzen, und beide braucht es: Das kürzere Wort muss fünf Zeichen
 * haben und seine Grundform noch vier. Ohne die erste würde „teil" in
 * „Ersatzteil" treffen, ohne die zweite bliebe von „Pumpen" die Grundform
 * „pump" übrig — und die wäre mit einer Grenze von sechs Zeichen aussortiert
 * worden, obwohl „Pumpen" zu „Hydraulikpumpe" genau die Zuordnung ist, um die
 * es hier geht.
 */
export function stecktDrin(a: string, b: string): boolean {
  const [kurzRoh, langRoh] = a.length <= b.length ? [a, b] : [b, a];
  if (kurzRoh.length < 5) return false;
  const kurz = stamm(kurzRoh);
  return kurz.length >= 4 && stamm(langRoh).includes(kurz);
}

// ---------------------------------------------------------------------------
// Bewertung
// ---------------------------------------------------------------------------

export interface Suchbegriffe {
  /** Die Warengattung — das stärkste Signal. */
  artikelTyp: string;
  hersteller?: string | null;
  /** Titel oder weitere Begriffe; zählen schwächer. */
  weitere?: string[];
}

/** Ein Volltreffer auf die Warengattung wiegt so viel wie vier Nebentreffer. */
export const PUNKTE_TYP_GENAU = 40;
export const PUNKTE_TYP_ENTHALTEN = 20;
export const PUNKTE_WEITERES = 6;
/** Treffer weiter oben im Weg zählen weniger — sie sind unschärfer. */
export const PUNKTE_WEG = 3;
/** Je tiefer die Kategorie, desto genauer — ein kleiner Bonus je Ebene. */
export const PUNKTE_JE_EBENE = 2;

/**
 * Darunter gilt ein Treffer als Zufall.
 *
 * Der Wert ist so gewählt, dass ein einzelner Nebentreffer nicht reicht: Ein
 * Artikel landet nur dann in einer Kategorie, wenn die Warengattung selbst
 * gepasst hat.
 */
export const MINDEST_PUNKTE = PUNKTE_TYP_ENTHALTEN;

export interface Bewertung {
  knoten: KategorieKnoten;
  punkte: number;
  gruende: string[];
}

/** Bewertet eine einzelne Kategorie gegen die Suchbegriffe. */
export function bewerte(knoten: KategorieKnoten, suche: Suchbegriffe): Bewertung {
  const gruende: string[] = [];
  let punkte = 0;

  const eigene = woerter(knoten.name);
  const typWorte = woerter(suche.artikelTyp);

  for (const typ of typWorte) {
    if (eigene.some((k) => gleichesWort(k, typ))) {
      punkte += PUNKTE_TYP_GENAU;
      gruende.push(`„${knoten.name}" trifft die Warengattung „${typ}"`);
    } else if (eigene.some((k) => stecktDrin(k, typ))) {
      punkte += PUNKTE_TYP_ENTHALTEN;
      gruende.push(`„${knoten.name}" steckt in „${typ}"`);
    }
  }

  const weitere = [...(suche.weitere ?? []).flatMap((t) => woerter(t))];
  for (const wort of new Set(weitere)) {
    if (typWorte.includes(wort)) continue; // schon gezählt
    if (eigene.some((k) => gleichesWort(k, wort) || stecktDrin(k, wort))) {
      punkte += PUNKTE_WEITERES;
      gruende.push(`Begriff „${wort}" passt zu „${knoten.name}"`);
    }
  }

  // Elternebenen: schwächeres Signal, aber es unterscheidet zwischen zwei
  // gleichnamigen Kategorien in verschiedenen Zweigen.
  const oben = knoten.weg.slice(0, -1).flatMap((n) => woerter(n));
  for (const typ of typWorte) {
    if (oben.some((k) => gleichesWort(k, typ) || stecktDrin(k, typ))) punkte += PUNKTE_WEG;
  }

  if (punkte > 0) punkte += Math.max(0, knoten.weg.length - 1) * PUNKTE_JE_EBENE;

  return { knoten, punkte, gruende };
}

export interface Kategoriewahl {
  /** Die gewählte Kategorie. Null heißt: nichts Überzeugendes gefunden. */
  treffer: KategorieKnoten | null;
  punkte: number;
  /** Die nächstbesten, damit im Büro nachvollziehbar ist, was sonst in Frage kam. */
  alternativen: Bewertung[];
  begruendung: string[];
}

/**
 * Wählt die Kategorie für einen Artikel.
 *
 * Bei Gleichstand gewinnt die tiefere Kategorie und danach die mit dem
 * kürzeren Namen — die ist in aller Regel die allgemeinere und damit die
 * sicherere Wahl.
 */
export function waehleKategorie(baum: KategorieKnoten[], suche: Suchbegriffe): Kategoriewahl {
  const bewertet = baum
    .map((k) => bewerte(k, suche))
    .filter((b) => b.punkte > 0)
    .sort((a, b) => {
      if (b.punkte !== a.punkte) return b.punkte - a.punkte;
      if (b.knoten.weg.length !== a.knoten.weg.length) return b.knoten.weg.length - a.knoten.weg.length;
      return a.knoten.name.length - b.knoten.name.length;
    });

  const bester = bewertet[0];
  const alternativen = bewertet.slice(1, 4);

  if (!bester || bester.punkte < MINDEST_PUNKTE) {
    return {
      treffer: null,
      punkte: bester?.punkte ?? 0,
      alternativen: bewertet.slice(0, 3),
      begruendung: [
        `Keine Kategorie überzeugt (bester Wert ${bester?.punkte ?? 0} von mindestens ${MINDEST_PUNKTE}).`,
        'Der Artikel geht in die Sammelkategorie und wird im Büro zugeordnet.',
      ],
    };
  }

  return {
    treffer: bester.knoten,
    punkte: bester.punkte,
    alternativen,
    begruendung: [
      `Kategorie „${bester.knoten.weg.join(' › ')}" (Wert ${bester.punkte}).`,
      ...bester.gruende,
      ...(alternativen.length > 0
        ? [`Ebenfalls möglich: ${alternativen.map((a) => `${a.knoten.name} (${a.punkte})`).join(', ')}.`]
        : []),
    ],
  };
}

// ---------------------------------------------------------------------------
// Baum aus der Plenty-Antwort
// ---------------------------------------------------------------------------

export interface PlentyKategorieZeile {
  id: number;
  parentCategoryId?: number | null;
  level?: number;
  details?: Array<{ lang?: string; name?: string }>;
}

/** Der deutsche Name einer Kategorie; ersatzweise der erste vorhandene. */
export function nameAusZeile(zeile: PlentyKategorieZeile): string {
  const details = zeile.details ?? [];
  const deutsch = details.find((d) => (d.lang ?? '').toLowerCase() === 'de');
  return (deutsch?.name ?? details[0]?.name ?? '').trim();
}

/**
 * Baut aus den Plenty-Zeilen den Baum mit vollständigen Wegen.
 *
 * Kategorien ohne Namen fallen weg — sie sind nicht zuordenbar und würden nur
 * Zufallstreffer erzeugen. Ein Weg, dessen Elternkategorie fehlt, beginnt beim
 * ersten bekannten Knoten; das passiert, wenn Plenty gefiltert antwortet, und
 * ist kein Grund, den ganzen Baum zu verwerfen.
 */
export function baumAusZeilen(zeilen: PlentyKategorieZeile[]): KategorieKnoten[] {
  const namen = new Map<number, { name: string; elternId: number | null }>();
  for (const z of zeilen) {
    const name = nameAusZeile(z);
    if (!name) continue;
    const eltern = z.parentCategoryId == null ? null : Number(z.parentCategoryId);
    namen.set(Number(z.id), { name, elternId: Number.isFinite(eltern as number) ? eltern : null });
  }

  const knoten: KategorieKnoten[] = [];
  for (const [id, eintrag] of namen) {
    const weg: string[] = [];
    let laufId: number | null = id;
    const gesehen = new Set<number>();
    // Gegen Zyklen: Ein Kategoriebaum, der sich selbst enthält, würde hier
    // sonst ewig laufen.
    while (laufId != null && namen.has(laufId) && !gesehen.has(laufId)) {
      gesehen.add(laufId);
      const k: { name: string; elternId: number | null } = namen.get(laufId)!;
      weg.unshift(k.name);
      laufId = k.elternId;
    }
    knoten.push({ id, name: eintrag.name, elternId: eintrag.elternId, weg });
  }
  return knoten;
}

// ---------------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------------

/** Wie lange der eingelesene Baum gilt. Kategorien ändern sich selten. */
export const BAUM_GUELTIG_MS = 10 * 60 * 1000;

let gecacht: { baum: KategorieKnoten[]; bis: number } | null = null;

export function vergissKategoriebaum(): void {
  gecacht = null;
}

/**
 * Holt den Kategoriebaum aus Plenty (seitenweise) und merkt ihn sich.
 *
 * Ohne Zwischenspeicher würde jeder Artikel den kompletten Baum neu laden —
 * bei ein paar hundert Kategorien sind das mehrere Sekunden und genug
 * Anfragen, um in Plentys Lesebremse zu laufen.
 */
export async function ladeKategoriebaum(opts: { frisch?: boolean } = {}): Promise<KategorieKnoten[]> {
  if (!opts.frisch && gecacht && gecacht.bis > Date.now()) return gecacht.baum;

  const zeilen: PlentyKategorieZeile[] = [];
  const proSeite = 100;
  for (let seite = 1; seite <= 50; seite++) {
    const antwort = await plentyGet<{ entries?: PlentyKategorieZeile[]; isLastPage?: boolean }>(
      // Kein „with=details": Plenty liefert die Namen ohnehin mit, und ein
      // with-Wert, den Plenty nicht kennt, wird STILL verworfen — Antwort 200,
      // Feld fehlt, kein Fehler. Was man nicht anfragt, kann auch nicht
      // stillschweigend wegfallen.
      `/rest/categories?type=item&itemsPerPage=${proSeite}&page=${seite}`,
    );
    const teil = antwort?.entries ?? [];
    zeilen.push(...teil);
    if (teil.length === 0 || antwort?.isLastPage) break;
  }

  const baum = baumAusZeilen(zeilen);
  gecacht = { baum, bis: Date.now() + BAUM_GUELTIG_MS };
  return baum;
}

/**
 * Kam der Baum zwar an, aber ohne Namen?
 *
 * Dann hat Plenty die Kategorien geliefert und die Bezeichnungen nicht — und
 * genau das ist der Fall, den man sonst nie bemerkt: Ohne Namen trifft keine
 * Zuordnung, jeder Artikel landet in der Sammelkategorie, und es sieht aus,
 * als sei die Bewertung einfach schlecht. Ein Aufruf, der 200 antwortet und
 * nichts bewirkt, muss sich melden.
 */
export function namenFehlen(zeilen: PlentyKategorieZeile[], baum: KategorieKnoten[]): boolean {
  return zeilen.length > 0 && baum.length === 0;
}

/**
 * Sucht die Kategorie für einen Artikel im echten Plenty-Baum.
 *
 * Findet sich nichts, greift die Sammelkategorie aus
 * `PLENTY_SAMMEL_CATEGORY_ID`. Fehlt auch die, bleibt es bei null — der
 * Aufrufer muss dann entscheiden, und das ist richtig so: Ohne Kategorie legt
 * Plenty keine Variante an, also darf das nicht stillschweigend passieren.
 */
export async function findeKategorie(suche: Suchbegriffe): Promise<Kategoriewahl & { sammelId: number | null }> {
  const sammelId = process.env.PLENTY_SAMMEL_CATEGORY_ID ? Number(process.env.PLENTY_SAMMEL_CATEGORY_ID) : null;
  const baum = await ladeKategoriebaum();
  if (baum.length === 0) {
    return {
      treffer: null,
      punkte: 0,
      alternativen: [],
      begruendung: [
        'Der Kategoriebaum kam leer oder ohne Namen zurück — es wurde gar nicht erst zugeordnet.',
        'Das ist kein schlechter Treffer, sondern eine fehlende Grundlage: bitte nachsehen.',
      ],
      sammelId: Number.isFinite(sammelId as number) ? sammelId : null,
    };
  }
  const wahl = waehleKategorie(baum, suche);
  return { ...wahl, sammelId: Number.isFinite(sammelId as number) ? sammelId : null };
}
