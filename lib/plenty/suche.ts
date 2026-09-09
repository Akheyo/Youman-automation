/**
 * Artikelsuche: „Wo könnte er sonst liegen?"
 *
 * Wird ein Artikel am eingetragenen Platz nicht gefunden, sammelt dieses Modul
 * aus PlentyONE alles, was auf einen anderen Platz hindeutet, und macht daraus
 * eine bewertete Liste. NUR LESEND — es wird nichts umgebucht.
 *
 * Die Signale bilden den Suchweg nach, der sich im Lager bewährt hat — in
 * dieser Reihenfolge, weil so auch ein Mensch vorgeht:
 *
 *   1. Eigener Bestand   Wohin ist der Artikel überhaupt verbucht? Ist er auf
 *                        dem Standard-Lagerplatz, wurde er nie eingeräumt —
 *                        dann liegt er im Wareneingang und nicht im Regal.
 *   2. Eigener Text      Variantennummer, Modell, Beschreibung nennen oft einen
 *                        Platz — meist den alten. Kostet keinen Extra-Aufruf.
 *   3. Warenbewegungen   Wo lag er früher? Rückläufer wandern erfahrungsgemäß
 *                        an ihren alten Platz zurück.
 *   4. Namensdublette    Haben wir denselben Artikel nochmal? Bei Gebrauchtware
 *                        landet das zweite Exemplar fast immer beim ersten.
 *   5. ID-Nachbarn       Was zusammen angelegt wurde, wurde zusammen eingeräumt.
 *   6. Einlagerung       Was im selben Zeitfenster gebucht wurde, kam mit
 *                        derselben Palette und liegt nebenan.
 *   7. Anlagedatum       Grober Ersatz für 6., wenn es keine Bewegungsdaten gibt.
 *   8. Platztausch       Wer liegt auf dem Soll-Platz? Oft wurde vertauscht.
 *   9. Regal-Nachbarn    Ein Fach daneben, eine Kiste weiter, eine Ebene höher.
 *
 * Zu jedem Nachbarn werden Bild, Gewicht und Maße geladen. Das Bild ist für den
 * Menschen (»das ist eine Kiste Schrauben, wir suchen eine Fräse«), Gewicht und
 * Maße für die Rechnung: Plätze, die nicht zur Größe passen, werden abgewertet
 * und der Grund dazugeschrieben.
 *
 * Genutzte Endpunkte (alle GET):
 *   /rest/items/variations
 *   /rest/items/{itemId}/variations/{variationId}/descriptions
 *   /rest/items/{itemId}/images
 *   /rest/stockmanagement/warehouses/{id}/stock/storageLocations
 *   /rest/stockmanagement/warehouses/{id}/stock/movements   (falls vorhanden)
 *   /rest/warehouses/locations/stock/{lagerortId}
 */

import { plentyEingerichtet, plentyGet } from './client';
import { ladeLager, ladeLagerorte, verzeichnis, type Lagerort } from './lagerorte';
import { findeLagerplaetze } from '@/lib/lagerplatz/erkennung';
import {
  bewerte,
  groessenklasse,
  idNachbarn,
  laufzettel,
  regalNachbarn,
  type Groessenklasse,
  type Hinweis,
  type Kandidat,
  type Masse,
} from '@/lib/lagerplatz/nachbarn';

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export interface SucheOptionen {
  /** Variantennummer, Varianten-ID, Artikel-ID oder EAN — was der Zettel hergibt. */
  eingabe: string;
  /** Lager, in dem gesucht wird. Fehlt es, wird das erste genommen. */
  warehouseId?: number | null;
  /** Wie viele IDs nach oben und unten geprüft werden (Standard 5). */
  idSpanne?: number;
  /** Zeitfenster um die Einlagerung des Artikels, in Minuten (Standard 45). */
  zeitfensterMin?: number;
  /** Auch die Plätze direkt daneben im Regal vorschlagen (Standard: ja). */
  mitRegalNachbarn?: boolean;
  /** Nach gleichnamigen Artikeln suchen (Standard: ja). */
  mitNamenssuche?: boolean;
  /** Zeitbudget, damit der Aufruf im Serverless-Timeout bleibt. */
  maxDauerMs?: number;
}

/** Ein Lagerplatz, auf den ein Artikel verbucht ist. */
export interface Belegung {
  lagerortId: number;
  name: string;
  /** Normierte Form — null, wenn der Name nicht ins Schema passt. */
  code: string | null;
  menge: number;
}

/** Alles, was die Oberfläche über einen Artikel zeigen soll. */
export interface Artikelkarte {
  variationId: number;
  itemId: number | null;
  nummer: string | null;
  name: string | null;
  /** Abstand zur gesuchten ID — 0 beim gesuchten Artikel selbst. */
  idAbstand: number;
  bildUrl: string | null;
  masse: Masse;
  klasse: Groessenklasse;
  belegungen: Belegung[];
  /** Lagerplätze, die im Text des Artikels stehen. */
  textPlaetze: string[];
  angelegtAm: string | null;
}

/**
 * Ein Eintrag der Zeitleiste: eine Buchung mit Uhrzeit.
 *
 * Beim Einlagern ist die Uhrzeit das eigentliche Argument. Wer sehen will, ob
 * ein Artikel mit derselben Palette hereinkam, braucht die Reihenfolge und die
 * Abstände in Minuten — nicht nur „war ungefähr gleichzeitig".
 */
export interface Zeitpunkt {
  /** ISO-Zeitstempel, in der Oberfläche als Datum und Uhrzeit dargestellt. */
  zeit: string;
  variationId: number | null;
  nummer: string | null;
  name: string | null;
  bildUrl: string | null;
  /** Ziel-Lagerort der Buchung. */
  ortName: string | null;
  ortCode: string | null;
  /** Minuten vor (negativ) bzw. nach (positiv) der Buchung des gesuchten Artikels. */
  versatzMin: number | null;
  /** Der gesuchte Artikel selbst — in der Oberfläche hervorgehoben. */
  istGesucht: boolean;
}

/** Wie der gesuchte Artikel im Bestand steht — bestimmt, wo man suchen geht. */
export type Bestandslage =
  | 'verbucht'          // Liegt laut Plenty auf einem echten Lagerplatz.
  | 'nur-standardplatz' // Bestand da, aber nie eingeräumt → Wareneingang prüfen.
  | 'ohne-bestand'      // Kein Bestand — verkauft, storniert oder nie gebucht.
  | 'unbekannt';        // Bestand nicht lesbar.

export interface SucheErgebnis {
  ok: boolean;
  konfiguriert: boolean;
  error: string | null;
  warehouseId: number | null;
  /** Der gesuchte Artikel selbst. */
  gesucht: Artikelkarte | null;
  lage: Bestandslage;
  /** Klartext-Einschätzung zur Lage — der wichtigste Satz der Oberfläche. */
  lageText: string;
  /** Nach Punkten sortiert: wo zuerst nachsehen. */
  kandidaten: Kandidat[];
  /** Dieselben Plätze nach Laufweg sortiert: einmal durch die Halle. */
  laufzettel: Kandidat[];
  /** Die geprüften Nachbarartikel — mit Bild, zur Plausibilitätskontrolle. */
  nachbarn: Artikelkarte[];
  /** Artikel aus demselben Einlagerungsvorgang. */
  einlagerung: Artikelkarte[];
  /**
   * Alle Buchungen rund um die Einlagerung, chronologisch — mit Uhrzeit,
   * Ziel-Lagerort und Minutenabstand zum gesuchten Artikel.
   */
  zeitleiste: Zeitpunkt[];
  /** Gleichnamige Artikel — bei Gebrauchtware der stärkste Hinweis nach dem Text. */
  dubletten: Artikelkarte[];
  /** Wer sonst noch auf den Plätzen liegt, auf die der Artikel verbucht ist. */
  aufDemSollplatz: Artikelkarte[];
  diagnose: string[];
  dauerMs: number;
}

// ---------------------------------------------------------------------------
// Rohdaten aus Plenty
// ---------------------------------------------------------------------------

interface PlentyListe<T> {
  entries?: T[];
  totalsCount?: number;
  isLastPage?: boolean;
}

interface PlentyVariante {
  id?: number;
  itemId?: number;
  number?: string | null;
  model?: string | null;
  externalId?: string | null;
  name?: string | null;
  createdAt?: string | null;
  weightG?: number | null;
  weightNetG?: number | null;
  widthMM?: number | null;
  lengthMM?: number | null;
  heightMM?: number | null;
}

interface PlentyBestandsort {
  variationId?: number;
  storageLocationId?: number;
  quantity?: number;
}

interface PlentyBewegung {
  variationId?: number;
  storageLocationId?: number;
  warehouseId?: number;
  quantity?: number;
  reasonId?: number;
  createdAt?: string | null;
  bookingTime?: string | null;
  userId?: number | null;
}

interface PlentyBild {
  url?: string | null;
  urlMiddle?: string | null;
  urlPreview?: string | null;
  urlSecondPreview?: string | null;
  position?: number | null;
}

/**
 * Die Lagerortliste eines Lagers, zwischengespeichert.
 *
 * Sie zu lesen kostet je nach Lagergröße zwanzig und mehr Seitenabrufe — und
 * das bei JEDER Suche, obwohl sich Lagerorte höchstens beim Anlegen ändern.
 * Das war mit Abstand der größte Zeitfresser. Fünf Minuten sind kurz genug,
 * dass frisch angelegte Orte zeitnah auftauchen.
 */
const ORTE_CACHE_MS = 5 * 60_000;
const orteCache = new Map<number, { orte: Lagerort[]; ohneCode: number; bis: number }>();

async function ladeLagerorteGepuffert(
  warehouseId: number,
): Promise<{ orte: Lagerort[]; ohneCode: number; ausCache: boolean }> {
  const treffer = orteCache.get(warehouseId);
  if (treffer && Date.now() < treffer.bis) {
    return { orte: treffer.orte, ohneCode: treffer.ohneCode, ausCache: true };
  }
  const { orte, ohneCode } = await ladeLagerorte(warehouseId, { maxSeiten: 200, gleichzeitig: 10 });
  orteCache.set(warehouseId, { orte, ohneCode, bis: Date.now() + ORTE_CACHE_MS });
  return { orte, ohneCode, ausCache: false };
}

/**
 * Wie viele Artikel gleichzeitig geladen werden.
 *
 * Acht statt der urspruenglichen vier: PlentyONE bremst zwar (HTTP 429), aber
 * `plentyGet` wartet in dem Fall kurz und fragt erneut — lieber gelegentlich
 * gebremst als durchgaengig nur halb so schnell.
 */
const GLEICHZEITIG = 8;

/** Führt Aufrufe in kleinen Gruppen aus, damit Plenty nicht ins Limit läuft. */
async function inGruppen<T, R>(werte: T[], groesse: number, fn: (wert: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < werte.length; i += groesse) {
    out.push(...(await Promise.all(werte.slice(i, i + groesse).map(fn))));
  }
  return out;
}

function zahl(wert: unknown): number | null {
  const n = Number(wert);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Artikel finden
// ---------------------------------------------------------------------------

/**
 * Löst die Eingabe zu einer Variante auf. Probiert der Reihe nach:
 * Varianten-ID, Variantennummer, EAN/Barcode, Artikel-ID.
 *
 * Die Reihenfolge ist Absicht: Eine reine Zahl ist am häufigsten die ID vom
 * Etikett; erst wenn dort nichts liegt, wird sie als Nummer gelesen.
 */
async function findeVariante(
  eingabe: string,
  diagnose: string[],
): Promise<PlentyVariante | null> {
  const roh = (eingabe ?? '').trim();
  if (!roh) return null;

  const versuche: Array<{ pfad: string; was: string }> = [];
  if (/^\d+$/.test(roh)) {
    versuche.push({ pfad: `/rest/items/variations?id=${roh}&itemsPerPage=1`, was: 'Varianten-ID' });
  }
  versuche.push({
    pfad: `/rest/items/variations?numberExact=${encodeURIComponent(roh)}&itemsPerPage=1`,
    was: 'Variantennummer',
  });
  if (/^\d{8,14}$/.test(roh)) {
    versuche.push({ pfad: `/rest/items/variations?barcode=${roh}&itemsPerPage=1`, was: 'Barcode/EAN' });
  }
  if (/^\d+$/.test(roh)) {
    versuche.push({ pfad: `/rest/items/variations?itemId=${roh}&itemsPerPage=1`, was: 'Artikel-ID' });
  }

  for (const v of versuche) {
    try {
      const res = await plentyGet<PlentyListe<PlentyVariante>>(v.pfad);
      const treffer = res?.entries?.[0];
      if (treffer && zahl(treffer.id)) {
        diagnose.push(`Gefunden über ${v.was}.`);
        return treffer;
      }
    } catch (err) {
      diagnose.push(`Suche über ${v.was} fehlgeschlagen: ${(err as Error).message.slice(0, 100)}`);
    }
  }
  return null;
}

/** Lädt mehrere Varianten auf einmal. */
async function ladeVarianten(ids: number[], diagnose: string[]): Promise<Map<number, PlentyVariante>> {
  const map = new Map<number, PlentyVariante>();
  if (!ids.length) return map;
  for (let i = 0; i < ids.length; i += 50) {
    const gruppe = ids.slice(i, i + 50);
    try {
      const res = await plentyGet<PlentyListe<PlentyVariante>>(
        `/rest/items/variations?id=${gruppe.join(',')}&itemsPerPage=${gruppe.length}`,
      );
      for (const v of res?.entries ?? []) {
        const id = zahl(v?.id);
        if (id) map.set(id, v);
      }
    } catch (err) {
      diagnose.push(`Nachbar-Varianten nicht ladbar: ${(err as Error).message.slice(0, 100)}`);
    }
  }
  return map;
}

/** Auf welchen Lagerplätzen liegt eine Variante? */
async function ladeBelegungen(
  warehouseId: number,
  variationId: number,
  namen: Map<number, { name: string; code: string | null }>,
): Promise<Belegung[] | null> {
  try {
    const res = await plentyGet<PlentyListe<PlentyBestandsort>>(
      `/rest/stockmanagement/warehouses/${warehouseId}/stock/storageLocations?variationId=${variationId}&itemsPerPage=50`,
    );
    return (res?.entries ?? [])
      .filter((z) => (zahl(z?.quantity) ?? 0) !== 0)
      .map((z) => {
        const id = zahl(z?.storageLocationId) ?? 0;
        const treffer = namen.get(id);
        return {
          lagerortId: id,
          name: treffer?.name ?? (id === 0 ? 'Standard-Lagerplatz' : `Lagerort ${id}`),
          code: treffer?.code ?? null,
          menge: zahl(z?.quantity) ?? 0,
        };
      });
  } catch {
    return null;
  }
}

/**
 * Bilder sind teuer: ein eigener Aufruf je Artikel. Beim Suchen tauchen aber
 * immer wieder dieselben Nachbarn auf, und Artikelbilder ändern sich so gut
 * wie nie — deshalb ein Zwischenspeicher über die Laufzeit des Servers.
 * Auch ein „kein Bild vorhanden" wird gemerkt, sonst fragt jede Suche erneut
 * genau die Artikel ab, die keins haben.
 */
const bildCache = new Map<number, string | null>();
/**
 * Obergrenze, damit der Zwischenspeicher auf einem lange laufenden Server
 * nicht unbegrenzt wächst. Bei Überschreitung wird er geleert statt einzelne
 * Einträge zu verdrängen — für einen reinen Beschleuniger ist das genug.
 */
const BILD_CACHE_MAX = 5_000;

/** Das erste Artikelbild — für die Plausibilitätskontrolle in der Oberfläche. */
async function ladeBild(itemId: number, variationId?: number): Promise<string | null> {
  if (bildCache.has(itemId)) return bildCache.get(itemId)!;

  const besteUrl = (bilder: PlentyBild[]): string | null => {
    if (!bilder.length) return null;
    const sortiert = [...bilder].sort((a, b) => (zahl(a?.position) ?? 99) - (zahl(b?.position) ?? 99));
    const b = sortiert[0];
    return b.urlPreview || b.urlMiddle || b.urlSecondPreview || b.url || null;
  };

  const holen = async (pfad: string): Promise<string | null> => {
    try {
      const res = await plentyGet<PlentyBild[] | PlentyListe<PlentyBild>>(pfad);
      return besteUrl(Array.isArray(res) ? res : (res?.entries ?? []));
    } catch {
      return null;
    }
  };

  let url = await holen(`/rest/items/${itemId}/images`);
  // Manche Artikel führen die Bilder nicht am Artikel, sondern an der Variante
  // — ohne diesen zweiten Versuch bliebe die Kachel grundlos leer.
  if (!url && variationId) {
    url = await holen(`/rest/items/${itemId}/variations/${variationId}/images`);
  }
  if (bildCache.size >= BILD_CACHE_MAX) bildCache.clear();
  bildCache.set(itemId, url);
  return url;
}

/** Die Texte einer Variante — dort steht oft der alte Lagerplatz. */
async function ladeTexte(itemId: number, variationId: number): Promise<string> {
  try {
    const res = await plentyGet<Array<Record<string, unknown>> | PlentyListe<Record<string, unknown>>>(
      `/rest/items/${itemId}/variations/${variationId}/descriptions`,
    );
    const eintraege = Array.isArray(res) ? res : (res?.entries ?? []);
    return eintraege
      .flatMap((t) => [t?.name, t?.name1, t?.name2, t?.name3, t?.description, t?.shortDescription, t?.technicalData])
      .filter((x): x is string => typeof x === 'string')
      .join(' \n ');
  } catch {
    return '';
  }
}

/**
 * Bewegungen im Zeitfenster um eine Einlagerung.
 *
 * PlentyONE führt Bestandsbewegungen je nach Ausbaustufe unter verschiedenen
 * Pfaden. Wir probieren die bekannten durch und melden über die Diagnose, wenn
 * keiner greift — dann fällt die Suche auf das Anlagedatum der Varianten
 * zurück, was gröber, aber immer verfügbar ist.
 */
async function ladeBewegungen(
  warehouseId: number,
  params: string,
  diagnose: string[],
): Promise<PlentyBewegung[] | null> {
  const pfade = [
    `/rest/stockmanagement/warehouses/${warehouseId}/stock/movements?${params}`,
    `/rest/stockmanagement/stock/movements?warehouseId=${warehouseId}&${params}`,
  ];
  for (const pfad of pfade) {
    try {
      const res = await plentyGet<PlentyListe<PlentyBewegung> | PlentyBewegung[]>(pfad);
      const eintraege = Array.isArray(res) ? res : (res?.entries ?? []);
      if (eintraege) return eintraege;
    } catch {
      // Nächsten Pfad probieren.
    }
  }
  diagnose.push('Bestandsbewegungen sind über die API nicht abrufbar — Zeitfenster über das Anlagedatum.');
  return null;
}

/**
 * Sucht gleichnamige Artikel.
 *
 * Bei Gebrauchtware ist das der stärkste Hinweis nach dem eigenen Text: Kommt
 * dasselbe Modell ein zweites Mal herein, stellt es fast jeder zum ersten
 * Exemplar. Voraussetzung ist ein Name, der etwas taugt — zu kurze oder rein
 * generische Namen ("Kabel") würden das halbe Lager treffen und werden deshalb
 * gar nicht erst gesucht.
 *
 * PlentyONE kennt je nach Ausbaustufe verschiedene Namensfilter; wir probieren
 * die bekannten durch und geben auf, statt zu raten.
 */
async function findeGleichnamige(
  name: string,
  eigeneId: number,
  diagnose: string[],
): Promise<number[]> {
  const sauber = (name ?? '').replace(/\s+/g, ' ').trim();
  // Unter 8 Zeichen bzw. zwei Wörtern ist ein Name kein Unterscheidungsmerkmal.
  if (sauber.length < 8 || sauber.split(' ').length < 2) {
    diagnose.push('Artikelname zu unspezifisch für eine Namenssuche.');
    return [];
  }
  const q = encodeURIComponent(sauber);
  const pfade = [
    `/rest/items/variations?name=${q}&itemsPerPage=20`,
    `/rest/items/variations?itemName=${q}&itemsPerPage=20`,
    `/rest/items?name=${q}&itemsPerPage=20`,
  ];
  for (const pfad of pfade) {
    try {
      const res = await plentyGet<PlentyListe<PlentyVariante>>(pfad);
      const ids = (res?.entries ?? [])
        .map((v) => zahl(v?.id))
        .filter((id): id is number => !!id && id !== eigeneId);
      // Ein Filter, der alles zurückgibt, hat nicht gefiltert — dann lieber nichts.
      if (ids.length && ids.length < 20) return ids;
    } catch {
      // Nächsten Pfad probieren.
    }
  }
  diagnose.push('Namenssuche über die API nicht möglich — dieses Signal entfällt.');
  return [];
}

/**
 * Welche anderen Artikel liegen auf einem Lagerplatz?
 *
 * Damit findet man Vertauschungen: Steht auf dem Soll-Platz etwas Fremdes, ist
 * die Wahrscheinlichkeit hoch, dass die beiden beim Einräumen getauscht wurden
 * — dann liegt der gesuchte Artikel dort, wo der Fremde hingehört.
 */
async function ladePlatzbelegung(lagerortId: number): Promise<number[]> {
  try {
    const res = await plentyGet<PlentyListe<PlentyBestandsort> | PlentyBestandsort[]>(
      `/rest/warehouses/locations/stock/${lagerortId}`,
    );
    const eintraege = Array.isArray(res) ? res : (res?.entries ?? []);
    return eintraege.map((z) => zahl(z?.variationId)).filter((id): id is number => !!id);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Zusammenbau
// ---------------------------------------------------------------------------

function karteAus(
  v: PlentyVariante,
  idAbstand: number,
  belegungen: Belegung[],
  bildUrl: string | null,
  text: string,
): Artikelkarte {
  const masse: Masse = {
    gewichtG: zahl(v.weightG) || zahl(v.weightNetG),
    breiteMM: zahl(v.widthMM),
    laengeMM: zahl(v.lengthMM),
    hoeheMM: zahl(v.heightMM),
  };
  const suchtext = [v.number, v.model, v.externalId, v.name, text].filter(Boolean).join(' \n ');
  return {
    variationId: zahl(v.id) ?? 0,
    itemId: zahl(v.itemId),
    nummer: v.number ?? null,
    name: v.name ?? null,
    idAbstand,
    bildUrl,
    masse,
    klasse: groessenklasse(masse),
    belegungen,
    textPlaetze: findeLagerplaetze(suchtext)
      .filter((t) => t.sicherheit !== 'ignoriert')
      .map((t) => t.code),
    angelegtAm: v.createdAt ?? null,
  };
}

function beschreibeLage(lage: Bestandslage, karte: Artikelkarte | null): string {
  switch (lage) {
    case 'verbucht':
      return `Laut Plenty liegt der Artikel auf ${karte?.belegungen
        .filter((b) => b.lagerortId !== 0)
        .map((b) => b.name)
        .join(', ')}. Ist er dort nicht, wurde er umgeräumt — die Liste unten zeigt, wohin am ehesten.`;
    case 'nur-standardplatz':
      return 'Bestand ist da, aber auf dem Standard-Lagerplatz: Der Artikel wurde nie einem Regal zugewiesen. Er liegt mit hoher Wahrscheinlichkeit noch im Wareneingang oder dort, wo die Lieferung abgestellt wurde — nicht im Regal.';
    case 'ohne-bestand':
      return 'Kein Bestand in diesem Lager. Der Artikel ist entweder verkauft, in einen anderen Bestand gebucht oder wurde nie eingebucht. Vor dem Suchen die Buchungen prüfen.';
    default:
      return 'Der Bestand ließ sich nicht lesen — die Vorschläge stützen sich nur auf Nachbarn und Texte.';
  }
}

/**
 * Die eigentliche Suche. Wirft nie: Fehler landen in `error` bzw. `diagnose`,
 * damit die Oberfläche immer etwas anzeigen kann.
 */
export async function sucheAlternativePlaetze(opts: SucheOptionen): Promise<SucheErgebnis> {
  const start = Date.now();
  const diagnose: string[] = [];
  const leer = (error: string | null, konfiguriert = true): SucheErgebnis => ({
    ok: false,
    konfiguriert,
    error,
    warehouseId: null,
    gesucht: null,
    lage: 'unbekannt',
    lageText: '',
    kandidaten: [],
    laufzettel: [],
    nachbarn: [],
    einlagerung: [],
    zeitleiste: [],
    dubletten: [],
    aufDemSollplatz: [],
    diagnose,
    dauerMs: Date.now() - start,
  });

  if (!(await plentyEingerichtet())) return leer('PlentyONE ist nicht eingerichtet.', false);

  const idSpanne = Math.min(15, Math.max(0, Math.floor(opts.idSpanne ?? 5)));
  const zeitfensterMin = Math.min(720, Math.max(0, Math.floor(opts.zeitfensterMin ?? 45)));
  const mitRegalNachbarn = opts.mitRegalNachbarn !== false;
  const frist = start + Math.max(5_000, Math.floor(opts.maxDauerMs ?? 45_000));
  const zeitUebrig = () => Date.now() < frist;

  // 1) Den gesuchten Artikel auflösen.
  const gesuchtRoh = await findeVariante(opts.eingabe, diagnose);
  if (!gesuchtRoh) return leer(`Zu „${opts.eingabe}" wurde in Plenty kein Artikel gefunden.`);
  const variationId = zahl(gesuchtRoh.id)!;
  const itemId = zahl(gesuchtRoh.itemId);

  // 2) Lager bestimmen.
  let warehouseId = zahl(opts.warehouseId);
  if (!warehouseId) {
    try {
      const lager = await ladeLager();
      warehouseId = lager[0]?.id ?? null;
      if (warehouseId) diagnose.push(`Lager ${warehouseId} (${lager[0]?.name}) verwendet.`);
    } catch (err) {
      diagnose.push(`Lagerliste nicht lesbar: ${(err as Error).message.slice(0, 100)}`);
    }
  }
  if (!warehouseId) return leer('Es ließ sich kein Lager ermitteln.');

  // 3) Lagerorte lesen — sie liefern die Namen zu den IDs und sagen, welche
  //    vorgeschlagenen Plätze es überhaupt gibt.
  const nachId = new Map<number, { name: string; code: string | null }>();
  const bekannteOrte = new Map<string, number>();
  try {
    const { orte, ohneCode, ausCache } = await ladeLagerorteGepuffert(warehouseId);
    for (const o of orte) {
      nachId.set(o.id, { name: o.name, code: o.code });
      if (o.code && !bekannteOrte.has(o.code)) bekannteOrte.set(o.code, o.id);
    }
    diagnose.push(
      `${orte.length} Lagerorte ${ausCache ? 'aus dem Zwischenspeicher' : 'gelesen'} (${ohneCode} ohne erkennbaren Code).`,
    );
    void verzeichnis; // Verzeichnis-Helfer bleibt für spätere Dublettenprüfung.
  } catch (err) {
    diagnose.push(`Lagerorte nicht lesbar: ${(err as Error).message.slice(0, 100)}`);
  }

  // 4) Den gesuchten Artikel vollständig laden.
  const [eigeneBelegungen, eigenesBild, eigenerText] = await Promise.all([
    ladeBelegungen(warehouseId, variationId, nachId),
    itemId ? ladeBild(itemId) : Promise.resolve(null),
    itemId ? ladeTexte(itemId, variationId) : Promise.resolve(''),
  ]);
  const gesucht = karteAus(gesuchtRoh, 0, eigeneBelegungen ?? [], eigenesBild, eigenerText);

  const echteBelegungen = (eigeneBelegungen ?? []).filter((b) => b.lagerortId !== 0);
  const lage: Bestandslage =
    eigeneBelegungen === null
      ? 'unbekannt'
      : echteBelegungen.length
        ? 'verbucht'
        : eigeneBelegungen.length
          ? 'nur-standardplatz'
          : 'ohne-bestand';

  const hinweise: Hinweis[] = [];

  // Signal 1: Wohin ist er selbst verbucht?
  for (const b of echteBelegungen) {
    if (!b.code) continue;
    hinweise.push({
      code: b.code,
      signal: 'eigener-bestand',
      text: `Laut Plenty liegen hier ${b.menge} Stück des gesuchten Artikels`,
      variationId,
    });
  }

  // Signal 2: Plätze aus dem eigenen Text — oft der alte Platz.
  for (const code of gesucht.textPlaetze) {
    if (echteBelegungen.some((b) => b.code === code)) continue;
    hinweise.push({
      code,
      signal: 'eigener-text',
      text: 'Dieser Platz steht im Text des Artikels selbst (meist der frühere Platz)',
      variationId,
    });
  }

  // Hilfsfunktion: eine Variante mit allem laden, was die Oberfläche braucht.
  // `mitText` kostet einen eigenen Aufruf je Artikel und lohnt nur dort, wo der
  // Beschreibungstext auch ausgewertet wird — Nummer, Modell und Name kommen
  // ohnehin aus der Sammelabfrage mit.
  const ladeKarte = async (v: PlentyVariante, mitText: boolean): Promise<Artikelkarte> => {
    const id = zahl(v.id)!;
    const iid = zahl(v.itemId);
    const [belegungen, bild, text] = await Promise.all([
      ladeBelegungen(warehouseId!, id, nachId),
      iid ? ladeBild(iid, id) : Promise.resolve(null),
      mitText && iid ? ladeTexte(iid, id) : Promise.resolve(''),
    ]);
    return karteAus(v, id - variationId, belegungen ?? [], bild, text);
  };

  /** Lädt mehrere Varianten als Karten — gleichzeitig, aber gedeckelt. */
  const ladeKarten = async (ids: number[], mitText: boolean): Promise<Artikelkarte[]> => {
    if (!ids.length) return [];
    const varianten = await ladeVarianten(ids, diagnose);
    return inGruppen(
      ids.filter((id) => varianten.has(id)),
      GLEICHZEITIG,
      (id) => ladeKarte(varianten.get(id)!, mitText),
    );
  };

  // -------------------------------------------------------------------------
  // Die Signale. Vier davon hängen nicht voneinander ab und laufen deshalb
  // gleichzeitig — nacheinander wartete jede Phase auf die vorige, obwohl sie
  // nichts von ihr braucht. Das war der zweitgrößte Zeitfresser nach der
  // Lagerortliste.
  // -------------------------------------------------------------------------

  /** Signal: Warenbewegungen des Artikels selbst — wo lag er früher? */
  const phaseHistorie = async () => {
    const bewegungen = await ladeBewegungen(warehouseId!, `variationId=${variationId}&itemsPerPage=50`, diagnose);
    const gefunden: Hinweis[] = [];
    const gesehen = new Set(echteBelegungen.map((b) => b.code));
    for (const b of bewegungen ?? []) {
      const ortId = zahl(b.storageLocationId) ?? 0;
      if (!ortId) continue;
      const ort = nachId.get(ortId);
      if (!ort?.code || gesehen.has(ort.code)) continue;
      gesehen.add(ort.code);
      const wann = b.bookingTime || b.createdAt;
      gefunden.push({
        code: ort.code,
        signal: 'historie',
        text: 'Laut Warenbewegungen lag der Artikel hier schon einmal',
        variationId,
        // Die Uhrzeit gehört als Datum weitergereicht, nicht in den Text
        // gebacken — die Oberfläche stellt sie in der Zeitzone des Nutzers dar.
        zeit: wann ?? null,
      });
    }
    if (bewegungen?.length) diagnose.push(`${bewegungen.length} Warenbewegungen zum Artikel gelesen.`);
    return { hinweise: gefunden, bewegungen };
  };

  /** Signal: Gleichnamige Artikel — haben wir das Teil nochmal? */
  const phaseDubletten = async () => {
    if (opts.mitNamenssuche === false || !gesucht.name) return { hinweise: [] as Hinweis[], karten: [] };
    const ids = (await findeGleichnamige(gesucht.name, variationId, diagnose)).slice(0, 8);
    const karten = await ladeKarten(ids, false);
    const gefunden: Hinweis[] = [];
    for (const karte of karten) {
      for (const b of karte.belegungen) {
        if (!b.code || b.lagerortId === 0) continue;
        gefunden.push({
          code: b.code,
          signal: 'namensdublette',
          text: `Gleichnamiger Artikel ${karte.nummer ?? karte.variationId} liegt hier`,
          variationId: karte.variationId,
        });
      }
    }
    if (karten.length) diagnose.push(`${karten.length} gleichnamige Artikel gefunden.`);
    return { hinweise: gefunden, karten };
  };

  /** Signal: ID-Nachbarn — und wer davon am selben Tag angelegt wurde. */
  const phaseNachbarn = async () => {
    const ids = idNachbarn(variationId, idSpanne);
    if (!ids.length) return { hinweise: [] as Hinweis[], karten: [] };
    // Ohne Beschreibungstexte: Deren Lagerplatz-Hinweise werden hier nicht
    // ausgewertet, der Aufruf wäre je Nachbar reine Wartezeit.
    const karten = await ladeKarten(ids, false);
    const eigenerTag = (gesucht.angelegtAm ?? '').slice(0, 10);
    const gefunden: Hinweis[] = [];
    for (const karte of karten) {
      const abstand = Math.abs(karte.idAbstand);
      const gleicherTag = !!eigenerTag && (karte.angelegtAm ?? '').slice(0, 10) === eigenerTag;
      for (const b of karte.belegungen) {
        if (!b.code || b.lagerortId === 0) continue;
        gefunden.push({
          code: b.code,
          signal: 'id-nachbar',
          text: `${karte.nummer ?? karte.variationId} (ID ${karte.idAbstand > 0 ? '+' : ''}${karte.idAbstand}) liegt hier`,
          variationId: karte.variationId,
          abstand,
        });
        // Gleicher Anlagetag ist ein eigenständiger Hinweis: Der Artikel kam
        // mit derselben Lieferung herein, auch wenn die IDs weiter auseinander
        // liegen als gedacht.
        if (gleicherTag) {
          gefunden.push({
            code: b.code,
            signal: 'anlagedatum',
            text: `${karte.nummer ?? karte.variationId} wurde am selben Tag angelegt (${eigenerTag}) und liegt hier`,
            variationId: karte.variationId,
            abstand,
          });
        }
      }
    }
    diagnose.push(`${karten.length} von ${ids.length} Nachbar-IDs existieren.`);
    return { hinweise: gefunden, karten };
  };

  /** Signal: Wer liegt auf dem Soll-Platz? Vertauschungen aufdecken. */
  const phaseTausch = async () => {
    if (!echteBelegungen.length) return { hinweise: [] as Hinweis[], karten: [] };
    const fremdIds: number[] = [];
    for (const b of echteBelegungen.slice(0, 3)) {
      for (const id of await ladePlatzbelegung(b.lagerortId)) {
        if (id !== variationId) fremdIds.push(id);
      }
    }
    const ids = [...new Set(fremdIds)].slice(0, 6);
    // Hier lohnt der Textabruf: Der Platz, an den der Fremdartikel gehört, ist
    // genau der Hinweis, den dieses Signal liefert.
    const karten = await ladeKarten(ids, true);
    const gefunden: Hinweis[] = [];
    const gesehen = new Set(echteBelegungen.map((b) => b.code));
    for (const karte of karten) {
      for (const code of karte.textPlaetze) {
        if (gesehen.has(code)) continue;
        gefunden.push({
          code,
          signal: 'platztausch',
          text: `Auf dem Soll-Platz liegt ${karte.nummer ?? karte.variationId} — laut dessen Text gehört der hierher, womöglich vertauscht`,
          variationId: karte.variationId,
        });
      }
    }
    if (karten.length) diagnose.push(`${karten.length} Fremdartikel auf dem Soll-Platz.`);
    return { hinweise: gefunden, karten };
  };

  const [historie, dubletten, nachbarn, tausch] = await Promise.all([
    phaseHistorie(),
    phaseDubletten(),
    phaseNachbarn(),
    phaseTausch(),
  ]);

  // Reihenfolge beim Einsammeln ist festgelegt, damit dasselbe Ergebnis
  // herauskommt, egal welche Phase zuerst fertig war.
  hinweise.push(...historie.hinweise, ...dubletten.hinweise, ...nachbarn.hinweise, ...tausch.hinweise);

  // Signal: Einlagerung im selben Zeitfenster. Braucht den Zeitanker aus den
  // Warenbewegungen und läuft deshalb erst jetzt.
  const einlagerungKarten: Artikelkarte[] = [];
  const zeitleiste: Zeitpunkt[] = [];
  if (zeitfensterMin > 0 && zeitUebrig()) {
    const ankerZeit =
      (historie.bewegungen ?? [])
        .map((b) => b.bookingTime || b.createdAt)
        .filter((x): x is string => !!x)
        .sort()
        .pop() ?? gesucht.angelegtAm;

    if (ankerZeit) {
      const anker = new Date(ankerZeit).getTime();
      const von = new Date(anker - zeitfensterMin * 60_000).toISOString();
      const bis = new Date(anker + zeitfensterMin * 60_000).toISOString();
      const fenster = await ladeBewegungen(
        warehouseId,
        `createdAtFrom=${encodeURIComponent(von)}&createdAtTo=${encodeURIComponent(bis)}&itemsPerPage=100`,
        diagnose,
      );
      const fremde = (fenster ?? []).filter(
        (b) => zahl(b.variationId) && zahl(b.variationId) !== variationId && (zahl(b.storageLocationId) ?? 0) !== 0,
      );

      for (const b of fremde) {
        const ort = nachId.get(zahl(b.storageLocationId)!);
        if (!ort?.code) continue;
        const minuten = b.createdAt
          ? Math.round(Math.abs(new Date(b.createdAt).getTime() - anker) / 60_000)
          : null;
        hinweise.push({
          code: ort.code,
          signal: 'einlagerung',
          text: `Artikel ${zahl(b.variationId)} wurde ${minuten !== null ? `${minuten} min versetzt` : 'etwa zeitgleich'} hierher gebucht`,
          variationId: zahl(b.variationId),
          // In Zehn-Minuten-Schritten dämpfen: was Stunden später gebucht wurde,
          // gehörte zu einer anderen Palette.
          abstand: minuten !== null ? Math.round(minuten / 10) : 2,
          zeit: b.bookingTime || b.createdAt || null,
        });
      }

      // Bilder und Namen nur für eine Handvoll — sonst sprengt es das Zeitbudget.
      const ids = [...new Set(fremde.map((b) => zahl(b.variationId)!))].slice(0, 12);
      einlagerungKarten.push(...(await ladeKarten(ids, false)));
      diagnose.push(`${fremde.length} Buchungen im Fenster ±${zeitfensterMin} min.`);

      // Die Zeitleiste: alle Buchungen des Fensters plus die des gesuchten
      // Artikels, chronologisch. Damit ist auf einen Blick zu sehen, was in
      // derselben Minute gebucht wurde — und was erst eine Stunde später.
      const kartenNachId = new Map(einlagerungKarten.map((k) => [k.variationId, k]));
      const alleBuchungen = [
        ...(historie.bewegungen ?? []).map((b) => ({ b, istGesucht: true })),
        ...fremde.map((b) => ({ b, istGesucht: false })),
      ];
      for (const { b, istGesucht } of alleBuchungen) {
        const wann = b.bookingTime || b.createdAt;
        if (!wann) continue;
        const vid = zahl(b.variationId);
        const karte = istGesucht ? gesucht : vid !== null ? kartenNachId.get(vid) : undefined;
        const ort = nachId.get(zahl(b.storageLocationId) ?? 0);
        zeitleiste.push({
          zeit: wann,
          variationId: vid,
          nummer: karte?.nummer ?? (istGesucht ? gesucht.nummer : null),
          name: karte?.name ?? null,
          bildUrl: karte?.bildUrl ?? null,
          ortName: ort?.name ?? null,
          ortCode: ort?.code ?? null,
          // Vorzeichen behalten: „12 min vorher" ist etwas anderes als
          // „12 min nachher", wenn man rekonstruiert, wer was abgestellt hat.
          versatzMin: Math.round((new Date(wann).getTime() - anker) / 60_000),
          istGesucht,
        });
      }
      zeitleiste.sort((a, b) => a.zeit.localeCompare(b.zeit));
    }
  }

  // Signal: Plätze direkt neben den bisher gefundenen. Erst jetzt, damit sie
  // sich an den echten Treffern orientieren.
  if (mitRegalNachbarn) {
    const bisher = [...new Set(hinweise.map((h) => h.code))].slice(0, 12);
    for (const code of bisher) {
      for (const n of regalNachbarn(code)) {
        // Nur Plätze vorschlagen, die es tatsächlich gibt — sonst schickt man
        // Leute an Regalfächer, die nie gebaut wurden.
        if (bekannteOrte.size && !bekannteOrte.has(n.code)) continue;
        hinweise.push({
          code: n.code,
          signal: 'regal-nachbar',
          text: `${n.grund} von ${code} — der häufigste Einräumfehler`,
          abstand: n.abstand,
        });
      }
    }
  }

  const kandidaten = bewerte(hinweise, {
    klasse: gesucht.klasse,
    bekannteOrte: bekannteOrte.size ? bekannteOrte : undefined,
  });

  return {
    ok: true,
    konfiguriert: true,
    error: null,
    warehouseId,
    gesucht,
    lage,
    lageText: beschreibeLage(lage, gesucht),
    kandidaten,
    laufzettel: laufzettel(kandidaten),
    nachbarn: nachbarn.karten.sort((a, b) => Math.abs(a.idAbstand) - Math.abs(b.idAbstand)),
    einlagerung: einlagerungKarten,
    zeitleiste,
    dubletten: dubletten.karten,
    aufDemSollplatz: tausch.karten,
    diagnose,
    dauerMs: Date.now() - start,
  };
}
