/**
 * Der Zugang zur Marktplaats API 2.0.
 *
 * Alles Netz liegt hier, damit der Rest des Moduls ohne API-Zugang testbar
 * bleibt. Vier Eigenheiten dieser API bestimmen den Aufbau:
 *
 *   1. **Anmeldung per OAuth2.** `client_credentials` liefert ein Token mit
 *      24 Stunden Laufzeit. Es wird modulweit gehalten — sonst liefe vor
 *      jeder einzelnen Anzeige eine Anmeldung, und bei zehntausend Artikeln
 *      sind das zehntausend überflüssige Aufrufe.
 *   2. **Der Accept-Header muss `application/json` enthalten.** Fehlt er,
 *      antwortet die API mit `406: Not accepted` — und zwar auch dann, wenn
 *      in Wahrheit das Token abgelaufen ist. Die Dokumentation warnt
 *      ausdrücklich davor, weil dieser 406 den eigentlichen Fehler verdeckt.
 *   3. **POST antwortet mit `201 Created` und einem `Location`-Header**, in
 *      dem die neue Anzeigen-ID steht. Nicht im Körper. Wer nur den Körper
 *      liest, legt Anzeigen an, deren ID er nicht kennt — und legt sie beim
 *      nächsten Lauf noch einmal an.
 *   4. **Die Titelgrenze ist nicht dokumentiert.** Die API nennt sie im
 *      Fehler `input-too-long`. Der Client liest sie aus und merkt sie sich
 *      (siehe `titelGrenze()`), statt eine Zahl zu raten.
 *
 * Quelle für alle Endpunkte und Felder: https://api.marktplaats.nl/docs/v2/
 */

import {
  ladeZugang,
  mitVorgaben,
  zugangVollstaendig,
  type MarktplaatsZugang,
} from '@/lib/einstellungen/marktplaats';
import type { Anzeige } from './anzeige';
import { TITEL_VORGABE } from './anzeige';
import { fehlerText, leseFehler, lohntWiederholung, titelGrenzeAus, type Fehlerbefund } from './fehler';

// ---------------------------------------------------------------------------
// Zugang
// ---------------------------------------------------------------------------

export async function aktuellerZugang(): Promise<MarktplaatsZugang> {
  return mitVorgaben(await ladeZugang());
}

export async function marktplaatsEingerichtet(): Promise<boolean> {
  return zugangVollstaendig(await aktuellerZugang());
}

/**
 * Ein Fehler, der weiß, was schiefging.
 *
 * Der Abgleich läuft über zehntausende Artikel und darf an einem einzelnen
 * nicht sterben. Er braucht dafür den Befund, nicht nur einen Satz: ob es sich
 * zu wiederholen lohnt, ob die Anzeige verschwunden ist, ob nur der Titel zu
 * lang war.
 */
export class MarktplaatsFehler extends Error {
  readonly befund: Fehlerbefund;

  constructor(befund: Fehlerbefund) {
    super(fehlerText(befund));
    this.name = 'MarktplaatsFehler';
    this.befund = befund;
  }

  get status(): number {
    return this.befund.status;
  }

  get wiederholbar(): boolean {
    return lohntWiederholung(this.befund.status);
  }
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

let token: string | null = null;
let tokenBis = 0;
/** Für welchen Zugang das Token gilt — sonst gilt nach einem Wechsel das alte. */
let tokenFuer = '';

/** Wirft das Token weg. Nach dem Ändern der Zugangsdaten und beim Test. */
export function vergissToken(): void {
  token = null;
  tokenBis = 0;
  tokenFuer = '';
}

function kennung(z: MarktplaatsZugang): string {
  return `${z.authUrl}|${z.clientId}`;
}

/**
 * Holt ein Zugriffstoken.
 *
 * `ohneCache` ist für den Verbindungstest: Der soll die eingetippten Daten
 * prüfen und nicht „erfolgreich" melden, weil vorhin schon jemand angemeldet
 * war. Denselben Weg geht der Plenty-Test nebenan.
 */
export async function holeToken(zugang?: MarktplaatsZugang, ohneCache = false): Promise<string> {
  const z = zugang ?? (await aktuellerZugang());
  if (!z.clientId || !z.clientSecret) {
    throw new Error('Kein Marktplaats-Zugang hinterlegt (Client-ID und Secret fehlen).');
  }
  if (!z.authUrl) {
    throw new Error('Keine Anmelde-Adresse für Marktplaats hinterlegt.');
  }

  const id = kennung(z);
  if (!ohneCache && token && id === tokenFuer && Date.now() < tokenBis) return token;

  // Die Zugangsdaten gehen als Basic-Auth mit, nicht im Körper — das ist die
  // Form, die OAuth2 für vertrauliche Clients vorsieht und die Marktplaats
  // erwartet.
  const basic = Buffer.from(`${z.clientId}:${z.clientSecret}`).toString('base64');
  const res = await fetch(z.authUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
  });

  const roh = await res.text();
  if (!res.ok) {
    throw new MarktplaatsFehler(leseFehler(res.status, roh));
  }

  let daten: { access_token?: string; expires_in?: number };
  try {
    daten = JSON.parse(roh);
  } catch {
    throw new Error(
      `Die Anmeldung bei ${z.authUrl} kam nicht als JSON zurück. Antwort: "${roh.slice(0, 200)}"`,
    );
  }
  if (!daten.access_token) {
    throw new Error('Die Anmeldung lieferte kein Token. Bitte Client-ID und Secret prüfen.');
  }

  token = daten.access_token;
  tokenFuer = id;
  // Eine Minute vor Ablauf erneuern — ein Lauf soll nicht mitten in einer
  // Anzeige über ein gerade abgelaufenes Token stolpern.
  const sekunden = Number(daten.expires_in) > 60 ? Number(daten.expires_in) : 3600;
  tokenBis = Date.now() + (sekunden - 60) * 1000;
  return token;
}

// ---------------------------------------------------------------------------
// Aufrufe
// ---------------------------------------------------------------------------

export interface Antwort<T> {
  status: number;
  daten: T | null;
  /** Der `Location`-Header — bei POST steht dort die neue Anzeige. */
  location: string | null;
}

interface AufrufOptionen {
  methode: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  pfad: string;
  koerper?: unknown;
  zugang?: MarktplaatsZugang;
  /** Wiederholungen bei Störungen der Gegenseite. */
  versuche?: number;
}

async function warte(ms: number): Promise<void> {
  await new Promise((fertig) => setTimeout(fertig, ms));
}

/**
 * Ein Aufruf gegen die API.
 *
 * Wiederholt nur, was sich zu wiederholen lohnt (429, 5xx) — mit wachsendem
 * Abstand. Ein `400` kommt beim zweiten Mal genauso zurück; es zu wiederholen
 * kostet nur Zeit und Kontingent.
 */
export async function aufruf<T = unknown>(opts: AufrufOptionen): Promise<Antwort<T>> {
  const z = opts.zugang ?? (await aktuellerZugang());
  if (!z.apiUrl) {
    throw new Error(
      'Keine API-Adresse für Marktplaats hinterlegt. In den Einstellungen eintragen (Produktion: https://api.marktplaats.nl).',
    );
  }

  const versuche = Math.max(1, opts.versuche ?? 3);
  let letzter: unknown = null;

  for (let versuch = 1; versuch <= versuche; versuch++) {
    const jwt = await holeToken(z);
    const res = await fetch(`${z.apiUrl}${opts.pfad}`, {
      method: opts.methode,
      headers: {
        Authorization: `Bearer ${jwt}`,
        // Ohne "application/json" antwortet die API mit 406 und verdeckt
        // damit den echten Fehler — siehe Kopf dieser Datei.
        Accept: 'application/json',
        ...(opts.koerper === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: opts.koerper === undefined ? undefined : JSON.stringify(opts.koerper),
    });

    const roh = await res.text();

    if (res.ok) {
      let daten: T | null = null;
      if (roh.trim()) {
        try {
          daten = JSON.parse(roh) as T;
        } catch {
          // 204 und leere Antworten sind normal; nur echter Unsinn fällt auf.
          daten = null;
        }
      }
      return { status: res.status, daten, location: res.headers.get('location') };
    }

    const befund = leseFehler(res.status, roh);

    // Ein abgelaufenes Token einmal erneuern und denselben Aufruf wiederholen.
    if (res.status === 401 && versuch < versuche) {
      vergissToken();
      continue;
    }

    letzter = new MarktplaatsFehler(befund);
    if (!lohntWiederholung(res.status) || versuch === versuche) throw letzter;
    await warte(500 * 2 ** (versuch - 1));
  }

  throw letzter ?? new Error('Marktplaats: Aufruf ohne Ergebnis.');
}

// ---------------------------------------------------------------------------
// Titelgrenze — gelernt, nicht geraten
// ---------------------------------------------------------------------------

let gelernteTitelgrenze: number | null = null;

/** Die aktuell angenommene Titelgrenze. */
export function titelGrenze(): number {
  return gelernteTitelgrenze ?? TITEL_VORGABE;
}

/** Setzt die gelernte Grenze zurück (Test, Umgebungswechsel). */
export function vergissTitelgrenze(): void {
  gelernteTitelgrenze = null;
}

/** Merkt sich eine Grenze aus einer Fehlerantwort. */
export function lerneTitelgrenze(befund: Fehlerbefund): number | null {
  const grenze = titelGrenzeAus(befund);
  if (grenze && grenze > 0 && grenze !== gelernteTitelgrenze) gelernteTitelgrenze = grenze;
  return grenze;
}

// ---------------------------------------------------------------------------
// Anzeigen
// ---------------------------------------------------------------------------

/**
 * Zieht die Anzeigen-ID aus dem `Location`-Header.
 *
 * Marktplaats antwortet auf POST mit `201 Created` und
 * `Location: /v2/advertisements/m1372`. Die ID steht nur dort.
 */
export function itemIdAus(location: string | null): string | null {
  if (!location) return null;
  const treffer = location.match(/\/advertisements\/([^/?#]+)/i);
  return treffer ? decodeURIComponent(treffer[1]) : null;
}

export interface Angelegt {
  itemId: string;
}

/**
 * Legt eine Anzeige an.
 *
 * Läuft sie wegen eines zu langen Titels auf, wird die gemeldete Grenze
 * gelernt und **einmal** mit gekürztem Titel wiederholt. Beim zweiten Mal
 * wäre es ein anderer Fehler, und stures Wiederholen hilft dann nicht mehr.
 */
export async function legeAnzeigeAn(anzeige: Anzeige, zugang?: MarktplaatsZugang): Promise<Angelegt> {
  try {
    const res = await aufruf<{ itemId?: string }>({
      methode: 'POST',
      pfad: '/v2/advertisements',
      koerper: anzeige,
      zugang,
    });
    const itemId = itemIdAus(res.location) ?? res.daten?.itemId ?? null;
    if (!itemId) {
      throw new Error(
        'Marktplaats hat die Anzeige angenommen, aber keine Anzeigen-ID zurückgegeben (weder im Location-Header noch im Körper). Ohne ID lässt sie sich später nicht ändern oder löschen.',
      );
    }
    return { itemId };
  } catch (err) {
    if (err instanceof MarktplaatsFehler) {
      const grenze = lerneTitelgrenze(err.befund);
      if (grenze) {
        const titel = anzeige.translations[0]?.title ?? '';
        if (titel.length > grenze) {
          const gekuerzt: Anzeige = {
            ...anzeige,
            translations: anzeige.translations.map((t, i) =>
              i === 0 ? { ...t, title: t.title.slice(0, grenze).trim() } : t,
            ),
          };
          const res = await aufruf<{ itemId?: string }>({
            methode: 'POST',
            pfad: '/v2/advertisements',
            koerper: gekuerzt,
            zugang,
          });
          const itemId = itemIdAus(res.location) ?? res.daten?.itemId ?? null;
          if (itemId) return { itemId };
        }
      }
    }
    throw err;
  }
}

/**
 * Ändert eine bestehende Anzeige.
 *
 * PUT statt PATCH: Wir kennen den vollständigen Soll-Zustand, und PATCH
 * verlangt das JSON-Patch-Format mit einer Operationsliste. Für „so soll die
 * Anzeige aussehen" ist PUT der ehrlichere Aufruf und spart eine ganze
 * Klasse von Fehlern (`conflicting-state`, wenn ein Feld noch nicht existiert).
 */
export async function aendereAnzeige(itemId: string, anzeige: Anzeige, zugang?: MarktplaatsZugang): Promise<void> {
  await aufruf({
    methode: 'PUT',
    pfad: `/v2/advertisements/${encodeURIComponent(itemId)}`,
    koerper: anzeige,
    zugang,
  });
}

/** Nimmt eine Anzeige offline. Der Weg dafür ist DELETE. */
export async function loescheAnzeige(itemId: string, zugang?: MarktplaatsZugang): Promise<void> {
  await aufruf({
    methode: 'DELETE',
    pfad: `/v2/advertisements/${encodeURIComponent(itemId)}`,
    zugang,
  });
}

/**
 * Hängt Bilder an eine Anzeige.
 *
 * Marktplaats lädt sie selbst von den übergebenen Adressen — es wird nichts
 * hochgeladen. Das heißt aber auch: **die Adressen müssen öffentlich
 * erreichbar sein.** Ein signierter Link mit kurzer Laufzeit reicht nicht
 * zuverlässig, weil der Abruf asynchron passiert („status: downloading").
 *
 * Grenzen laut Dokumentation: JPG, PNG, BMP (kein GIF), unter 8 MB,
 * empfohlen innerhalb 1024×1024. Wie viele Bilder erlaubt sind, hängt vom
 * Händlerpaket ab (24 / 35 / 99) — deshalb ist die Obergrenze hier ein
 * Parameter und keine Konstante.
 */
export async function setzeBilder(
  itemId: string,
  urls: string[],
  opts: { maximal?: number; zugang?: MarktplaatsZugang } = {},
): Promise<number> {
  const erlaubt = urls.filter((u) => /^https?:\/\//i.test(u) && !/\.gif($|\?)/i.test(u));
  const auswahl = erlaubt.slice(0, opts.maximal ?? 24);
  if (!auswahl.length) return 0;
  await aufruf({
    methode: 'POST',
    pfad: `/v2/advertisements/${encodeURIComponent(itemId)}/images`,
    // `replaceAll` ist der Punkt: Ohne ihn sammeln sich bei jeder Änderung
    // die alten Bilder an, und eine Anzeige zeigt irgendwann drei Generationen
    // desselben Artikels.
    koerper: { urls: auswahl, replaceAll: true },
    zugang: opts.zugang,
  });
  return auswahl.length;
}

// ---------------------------------------------------------------------------
// Verbindungstest
// ---------------------------------------------------------------------------

export interface Testergebnis {
  ok: boolean;
  meldung: string;
  /** Der angemeldete Händler, sofern die API ihn nennt. */
  konto: string | null;
}

/**
 * Prüft die übergebenen Zugangsdaten — am Zwischenspeicher vorbei.
 *
 * Erst anmelden, dann einen harmlosen Lesezugriff: Eine erfolgreiche
 * Anmeldung allein sagt noch nicht, dass die API auch antwortet (falsche
 * Umgebung, fehlende Freischaltung).
 */
export async function testeVerbindung(zugang?: MarktplaatsZugang): Promise<Testergebnis> {
  const z = mitVorgaben(zugang ?? (await aktuellerZugang()));
  if (!z.clientId || !z.clientSecret) {
    return { ok: false, meldung: 'Client-ID und Client-Secret fehlen.', konto: null };
  }
  if (!z.apiUrl) {
    return {
      ok: false,
      meldung:
        'Keine API-Adresse hinterlegt. Für die Produktion ist es https://api.marktplaats.nl; die Sandbox-Adresse kommt mit den Zugangsdaten.',
      konto: null,
    };
  }

  try {
    await holeToken(z, true);
  } catch (err) {
    return {
      ok: false,
      meldung: `Anmeldung fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
      konto: null,
    };
  }

  try {
    const res = await aufruf<{ userId?: number; nickname?: string; emailAddress?: string }>({
      methode: 'GET',
      pfad: '/v2/me',
      zugang: z,
      versuche: 1,
    });
    const konto = res.daten?.nickname ?? res.daten?.emailAddress ?? (res.daten?.userId ? `Nutzer ${res.daten.userId}` : null);
    return { ok: true, meldung: 'Anmeldung und Abfrage erfolgreich.', konto };
  } catch (err) {
    // Die Anmeldung ging durch, die Abfrage nicht. Das ist eine andere
    // Aussage als „falsches Passwort" und wird auch so gemeldet.
    return {
      ok: false,
      meldung: `Anmeldung erfolgreich, aber die API antwortet nicht wie erwartet: ${
        err instanceof Error ? err.message : String(err)
      }`,
      konto: null,
    };
  }
}
