/**
 * Upload-Warteschlange im Browser.
 *
 * Jedes Foto wird ZUERST lokal in IndexedDB abgelegt und erst danach
 * hochgeladen. Das ist der Unterschied zwischen "im Lager ist Funkloch, die
 * Fotos sind weg" und "im Lager ist Funkloch, die Fotos gehen raus, sobald
 * wieder Netz da ist". Ein Neuladen der Seite, ein Akku-Aus, ein Wegwischen der
 * App — die Aufnahmen stehen noch in der Reihe.
 *
 * Der Weg je Foto hat drei Schritte, die einzeln wiederholbar sind:
 *   1. Platz reservieren   POST   /api/erfassung/artikel/{id}/bild
 *   2. Datei hochladen     direkt zum Supabase-Storage (nicht über die App,
 *                          siehe lib/erfassung/speicher.ts)
 *   3. Ankunft bestätigen  PUT    /api/erfassung/artikel/{id}/bild
 *
 * Bricht es zwischendrin ab, wird beim nächsten Anlauf dort weitergemacht, wo
 * es aufgehört hat — Schritt 1 wird nicht zweimal gemacht, sonst lägen doppelte
 * Bilder am Artikel.
 */

'use client';

import { createClient } from '@/lib/supabase/client';
import { BILDER_BUCKET } from './speicher';
import type { Rolle } from './logic';

export type EintragStatus = 'wartet' | 'laedt' | 'oben' | 'fehler';

export interface Eintrag {
  id: string;
  artikelId: string;
  rolle: Rolle;
  dateiname: string;
  contentType: string;
  groesse: number;
  status: EintragStatus;
  versuche: number;
  meldung?: string;
  /** Ab Schritt 1 bekannt — verhindert, dass beim Wiederholen ein zweites Bild entsteht. */
  bildId?: string;
  pfad?: string;
  token?: string;
  angelegt: number;
}

interface Datensatz extends Eintrag {
  blob: Blob;
}

const DB_NAME = 'kk-erfassung';
const DB_VERSION = 1;
const STORE = 'warteschlange';

/** Wartezeiten zwischen den Anläufen. Danach bleibt der Eintrag als Fehler stehen. */
const PAUSEN_MS = [1000, 3000, 8000, 20000, 60000];

// ---------------------------------------------------------------------------
// IndexedDB — mit ehrlichem Rückfall
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Öffnet die Datenbank. Im privaten Modus mancher Browser wirft das oder liefert
 * nie — dann läuft die Warteschlange nur im Arbeitsspeicher weiter. Das ist
 * schlechter, aber immer noch besser als ein Abbruch, und die Oberfläche sagt es.
 */
function db(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((fertig) => {
    if (typeof indexedDB === 'undefined') return fertig(null);
    let erledigt = false;
    const abschluss = (wert: IDBDatabase | null) => {
      if (!erledigt) {
        erledigt = true;
        fertig(wert);
      }
    };
    try {
      const anfrage = indexedDB.open(DB_NAME, DB_VERSION);
      anfrage.onupgradeneeded = () => {
        const d = anfrage.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
      };
      anfrage.onsuccess = () => abschluss(anfrage.result);
      anfrage.onerror = () => abschluss(null);
      anfrage.onblocked = () => abschluss(null);
      // Safari im privaten Modus antwortet gelegentlich gar nicht.
      setTimeout(() => abschluss(null), 3000);
    } catch {
      abschluss(null);
    }
  });
  return dbPromise;
}

/** Rückfallebene, wenn IndexedDB nicht zur Verfügung steht. */
const speicher = new Map<string, Datensatz>();

/**
 * Fertig hochgeladene Fotos dieser Sitzung.
 *
 * Sie sind aus der Datenbank draußen (die Datei liegt im Storage, die Zeile in
 * Postgres), aber die Kachel am Handy soll das Bild weiter zeigen. Nach einem
 * Neuladen kommen sie stattdessen vom Server — deshalb reicht der
 * Arbeitsspeicher.
 */
const erledigt = new Map<string, Eintrag>();
let nurArbeitsspeicher = false;

export function laeuftNurImArbeitsspeicher(): boolean {
  return nurArbeitsspeicher;
}

async function schreibe(satz: Datensatz): Promise<void> {
  const d = await db();
  if (!d) {
    nurArbeitsspeicher = true;
    speicher.set(satz.id, satz);
    return;
  }
  await new Promise<void>((fertig) => {
    const t = d.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put(satz);
    t.oncomplete = () => fertig();
    t.onerror = () => fertig();
    t.onabort = () => fertig();
  });
}

async function loesche(id: string): Promise<void> {
  speicher.delete(id);
  const d = await db();
  if (!d) return;
  await new Promise<void>((fertig) => {
    const t = d.transaction(STORE, 'readwrite');
    t.objectStore(STORE).delete(id);
    t.oncomplete = () => fertig();
    t.onerror = () => fertig();
    t.onabort = () => fertig();
  });
}

async function alle(): Promise<Datensatz[]> {
  const d = await db();
  if (!d) {
    nurArbeitsspeicher = true;
    return [...speicher.values()];
  }
  return new Promise((fertig) => {
    const t = d.transaction(STORE, 'readonly');
    const anfrage = t.objectStore(STORE).getAll();
    anfrage.onsuccess = () => fertig((anfrage.result as Datensatz[]) ?? []);
    anfrage.onerror = () => fertig([]);
  });
}

// ---------------------------------------------------------------------------
// Vorschaubilder
// ---------------------------------------------------------------------------

const vorschauen = new Map<string, string>();

export function vorschau(id: string): string | undefined {
  return vorschauen.get(id);
}

function merkeVorschau(id: string, blob: Blob): void {
  if (vorschauen.has(id)) return;
  try {
    vorschauen.set(id, URL.createObjectURL(blob));
  } catch {
    /* ohne Vorschau weiterarbeiten */
  }
}

function vergissVorschau(id: string): void {
  const url = vorschauen.get(id);
  if (url) URL.revokeObjectURL(url);
  vorschauen.delete(id);
}

// ---------------------------------------------------------------------------
// Beobachter
// ---------------------------------------------------------------------------

type Beobachter = (eintraege: Eintrag[]) => void;
const beobachter = new Set<Beobachter>();
let stand: Eintrag[] = [];

function ohneBlob(satz: Datensatz): Eintrag {
  const { blob: _blob, ...rest } = satz;
  return rest;
}

async function melde(): Promise<void> {
  const saetze = (await alle()).map(ohneBlob);
  stand = [...saetze, ...erledigt.values()].sort((a, b) => a.angelegt - b.angelegt);
  for (const b of beobachter) b(stand);
}

export function beobachte(fn: Beobachter): () => void {
  beobachter.add(fn);
  fn(stand);
  void melde();
  return () => {
    beobachter.delete(fn);
  };
}

// ---------------------------------------------------------------------------
// Einreihen und Abarbeiten
// ---------------------------------------------------------------------------

function neueId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Nimmt ein frisch aufgenommenes Foto in die Reihe. Kehrt sofort zurück. */
export async function einreihen(artikelId: string, rolle: Rolle, datei: File): Promise<string> {
  const satz: Datensatz = {
    id: neueId(),
    artikelId,
    rolle,
    dateiname: datei.name || `${rolle}.jpg`,
    contentType: datei.type || 'image/jpeg',
    groesse: datei.size,
    status: 'wartet',
    versuche: 0,
    angelegt: Date.now(),
    blob: datei,
  };
  merkeVorschau(satz.id, datei);
  await schreibe(satz);
  await melde();
  void arbeite();
  return satz.id;
}

/** Wirft einen Eintrag weg (Foto neu machen). */
export async function verwerfen(id: string): Promise<void> {
  vergissVorschau(id);
  erledigt.delete(id);
  await loesche(id);
  await melde();
}

/** Alles zu einem Artikel wegwerfen (Artikel verworfen). */
export async function verwerfeArtikel(artikelId: string): Promise<void> {
  for (const satz of await alle()) {
    if (satz.artikelId === artikelId) {
      vergissVorschau(satz.id);
      await loesche(satz.id);
    }
  }
  await vergissArtikel(artikelId);
}

/**
 * Räumt die Vorschauen eines abgeschlossenen Artikels weg.
 *
 * Ohne das sammelt ein Erfassungstag hunderte Objekt-URLs auf mehreren
 * Megabyte an — auf einem Lager-Handy merkt man das.
 */
export async function vergissArtikel(artikelId: string): Promise<void> {
  for (const [id, eintrag] of erledigt) {
    if (eintrag.artikelId === artikelId) {
      vergissVorschau(id);
      erledigt.delete(id);
    }
  }
  await melde();
}

async function alsJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Unerwartete Antwort (HTTP ${res.status}).`);
  }
}

let laeuft = false;

/**
 * Arbeitet die Reihe ab. Läuft immer nur einmal gleichzeitig — parallele
 * Uploads über ein Lager-WLAN machen die Sache langsamer, nicht schneller,
 * und die Reihenfolge der Aufnahmen soll erhalten bleiben.
 */
export async function arbeite(): Promise<void> {
  if (laeuft) return;
  laeuft = true;
  try {
    for (;;) {
      const offen = (await alle())
        .filter((s) => s.status !== 'oben')
        .sort((a, b) => a.angelegt - b.angelegt);
      const naechster = offen.find((s) => s.status !== 'fehler' || s.versuche < PAUSEN_MS.length);
      if (!naechster) return;

      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

      naechster.status = 'laedt';
      await schreibe(naechster);
      await melde();

      try {
        await einenHochladen(naechster);
        // Die Vorschau bleibt absichtlich stehen — das Foto ist oben, aber die
        // Kachel soll es weiter zeigen, bis der Artikel abgeschickt ist.
        erledigt.set(naechster.id, { ...ohneBlob(naechster), status: 'oben', meldung: undefined });
        await loesche(naechster.id);
        await melde();
      } catch (e) {
        naechster.status = 'fehler';
        naechster.versuche += 1;
        naechster.meldung = e instanceof Error ? e.message : String(e);
        await schreibe(naechster);
        await melde();
        // Aufgegeben wird nur DIESES Foto — die anderen laufen weiter. Sonst
        // haengt ein einziges kaputtes Bild den ganzen Erfassungstag auf.
        if (naechster.versuche >= PAUSEN_MS.length) continue;
        await new Promise((f) => setTimeout(f, PAUSEN_MS[naechster.versuche - 1]));
      }
    }
  } finally {
    laeuft = false;
  }
}

/**
 * Ist dieser Fehler durch Wiederholen behebbar?
 *
 * Ein Eintrag, dessen Artikel gelöscht oder schon abgeschickt wurde, wird durch
 * keinen weiteren Anlauf besser. Solche Einträge nur immer wieder anzubieten,
 * wäre eine Sackgasse mit Knopf — sie gehören weggeworfen.
 */
export function aussichtslos(meldung: string | undefined): boolean {
  return /nicht gefunden|bereits abgeschickt|HTTP 404|HTTP 409/i.test(meldung ?? '');
}

/** Einen stehengebliebenen Eintrag erneut versuchen. */
export async function nochmal(id: string): Promise<void> {
  const satz = (await alle()).find((s) => s.id === id);
  if (!satz) return;
  satz.status = 'wartet';
  satz.versuche = 0;
  satz.meldung = undefined;
  await schreibe(satz);
  await melde();
  void arbeite();
}

async function einenHochladen(satz: Datensatz): Promise<void> {
  // Schritt 1 — Platz reservieren. Nur beim ersten Mal.
  if (!satz.bildId || !satz.pfad || !satz.token) {
    const res = await fetch(`/api/erfassung/artikel/${satz.artikelId}/bild`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rolle: satz.rolle,
        dateiname: satz.dateiname,
        contentType: satz.contentType,
        groesse: satz.groesse,
      }),
    });
    const daten = await alsJson(res);
    if (!res.ok) throw new Error(`Schritt 1 (Platz reservieren): ${String(daten.error ?? `HTTP ${res.status}`)}`);
    const bild = daten.bild as { id: string } | undefined;
    const upload = daten.upload as { pfad: string; token: string } | undefined;
    if (!bild?.id || !upload?.token) throw new Error('Schritt 1 (Platz reservieren): unvollständige Antwort.');
    satz.bildId = bild.id;
    satz.pfad = upload.pfad;
    satz.token = upload.token;
    await schreibe(satz);
  }

  // Schritt 2 — Datei direkt zum Storage.
  const supabase = createClient();
  if (!supabase) throw new Error('Supabase im Browser nicht konfiguriert.');
  const { error } = await supabase.storage
    .from(BILDER_BUCKET)
    .uploadToSignedUrl(satz.pfad, satz.token, satz.blob, { contentType: satz.contentType });
  if (error) {
    // Sonderfall, der sonst ewig haengenbliebe: Der Upload war beim letzten
    // Anlauf schon durch, nur die Bestaetigung (Schritt 3) kam nicht mehr an.
    // Dann meldet der Storage "gibt es schon" — und genau dann ist alles gut,
    // es fehlt nur noch der letzte Schritt.
    const schonDa = /exist|duplicate|bereits/i.test(error.message);
    if (!schonDa) throw new Error(`Schritt 2 (Upload zum Speicher): ${error.message}`);
  }

  // Schritt 3 — Ankunft bestätigen. Erst jetzt zählt das Bild.
  const res = await fetch(`/api/erfassung/artikel/${satz.artikelId}/bild`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bildId: satz.bildId }),
  });
  if (!res.ok) {
    const daten = await alsJson(res).catch(() => ({}) as Record<string, unknown>);
    throw new Error(`Schritt 3 (Ankunft bestätigen): ${String(daten.error ?? `HTTP ${res.status}`)}`);
  }
}

/**
 * Stellt nach einem Neustart die Vorschauen wieder her und nimmt die Arbeit
 * wieder auf. Wird beim Öffnen der Seite aufgerufen.
 */
export async function wiederAufnehmen(): Promise<void> {
  for (const satz of await alle()) {
    merkeVorschau(satz.id, satz.blob);
    // Ein Eintrag, der beim Schließen mitten im Upload war, steht auf "laedt"
    // und würde sonst nie wieder angefasst.
    if (satz.status === 'laedt') {
      satz.status = 'wartet';
      await schreibe(satz);
    }
  }
  await melde();
  void arbeite();
}
