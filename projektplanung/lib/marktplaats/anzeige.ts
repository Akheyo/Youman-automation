/**
 * Aus einem Artikel wird eine Marktplaats-Anzeige.
 *
 * Reine Formatierung, kein Netz — deshalb vollständig testbar. Was hier
 * entsteht, ist exakt der JSON-Körper für `POST /v2/advertisements` der
 * Marktplaats API 2.0.
 *
 * Die Feldnamen und Grenzen stammen aus der offiziellen Dokumentation
 * (https://api.marktplaats.nl/docs/v2/advertisement.html), nicht aus
 * Annahmen. Vier Punkte daraus bestimmen den ganzen Aufbau:
 *
 *   1. Beträge sind **Euro-Cent**, ganzzahlig. „All monetary amounts like
 *      prices and budgets are currently in Euros and stored as euro cents."
 *      Ein Preis als Euro-Kommazahl kommt hundertfach zu niedrig an, und
 *      niemand merkt es, bis jemand einen Kompressor für 3,49 € kauft.
 *   2. `categoryId` **muss eine L2-Kategorie sein**. L1 gruppiert nur; eine
 *      Anzeige darin wird abgelehnt.
 *   3. `location` verlangt Postleitzahl **oder** Ort. Beides zusammen nur,
 *      wenn es zusammenpasst — sonst verwirft Marktplaats die PLZ und
 *      markiert die Anzeige als „Buitenland". Wir schicken deshalb
 *      ausschließlich die PLZ.
 *   4. `translations` trägt Titel und Text. Marktplaats.nl kennt genau ein
 *      Locale: `nl-NL`.
 *
 * WAS HIER BEWUSST FEHLT: eine fest verdrahtete Titellänge. Die Dokumentation
 * nennt keine Zahl, dafür liefert die API bei Überlänge den Fehler
 * `max-length-exceeded` samt erlaubtem Maximum mit. Eine geratene Konstante
 * wäre entweder zu streng (wir verschenken Titel) oder zu lasch (jede Anzeige
 * schlägt fehl). Die Vorgabe unten ist als Startwert gedacht, den der Client
 * aus der Fehlerantwort nachjustiert — siehe `client.ts`.
 */

/** Locale von Marktplaats.nl. 2dehands.be hätte nl-BE/fr-BE. */
export const LOCALE = 'nl-NL';

/**
 * Startwert für die Titellänge, bis die API etwas anderes sagt.
 *
 * 60 Zeichen ist, was die Weboberfläche beim Aufgeben einer Anzeige zulässt.
 * Das ist eine Beobachtung, keine dokumentierte Zusage — deshalb steht die
 * Zahl hier an einer Stelle und nicht verstreut im Code.
 */
export const TITEL_VORGABE = 60;

/** Herstellernummer (`partNumber`), dokumentierte Grenze: 25 Zeichen. */
export const MAX_PARTNUMBER = 25;

/** Preismodelle, die wir verwenden. Die API kennt weitere (z. B. Gebote). */
export type Preismodell = 'fixed' | 'see description';

export interface PriceModel {
  modelType: Preismodell;
  /** Ganzzahlige Euro-Cent. Fehlt bei `see description`. */
  askingPrice?: number;
  /** Ganzzahlige Euro-Cent. */
  shippingCosts?: number;
}

export interface Uebersetzung {
  locale: string;
  title: string;
  description: string;
}

/** Der Anzeigenkörper, so wie er an die API geht. */
export interface Anzeige {
  translations: Uebersetzung[];
  categoryId: number;
  location: { postcode: string };
  priceModel: PriceModel;
  url?: string;
  partNumber?: string;
  reserved?: boolean;
}

export interface AnzeigeEingabe {
  /** Niederländischer Titel. */
  titel: string;
  /** Niederländischer Beschreibungstext. */
  beschreibung: string;
  /** L2-Kategorie bei Marktplaats. Ohne sie geht nichts. */
  kategorieId: number | null;
  /** Verkaufspreis in Euro, wie er in Plenty steht. */
  preisEuro: number | null;
  /** Versandkosten in Euro. Null heißt: keine Angabe in der Anzeige. */
  versandEuro?: number | null;
  /** Postleitzahl des Lagers, ohne Leerzeichen, max. 6 Zeichen. */
  postleitzahl: string;
  /** Herstellernummer, falls bekannt. */
  mpn?: string | null;
  /** Link auf den eigenen Shop. Zeigt Marktplaats nur mit gebuchter URL-Funktion. */
  shopUrl?: string | null;
  /** Aktuelle Titelgrenze; der Client reicht durch, was die API gemeldet hat. */
  maxTitel?: number;
}

/** Warum eine Anzeige nicht rausgeht — oder was an ihr angepasst wurde. */
export interface Befund {
  art: 'fehlt' | 'gekuerzt' | 'hinweis';
  feld: string;
  text: string;
}

export interface Anzeigenbau {
  /** Null, wenn Pflichtangaben fehlen. */
  anzeige: Anzeige | null;
  befunde: Befund[];
  /** Darf so rausgehen. */
  bereit: boolean;
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

/**
 * Euro in ganzzahlige Cent.
 *
 * `Math.round(19.99 * 100)` ist 1999 — aber `12.  1 * 100` ist in
 * Gleitkomma 1209.9999999999998, und ein blosses `Math.trunc` macht daraus
 * 1209. Deshalb wird gerundet und nicht abgeschnitten. Negative Beträge und
 * alles, was keine Zahl ist, ergeben null statt einer stillen 0: eine
 * Anzeige für 0,00 € ist schlimmer als gar keine.
 */
export function inCent(euro: number | null | undefined): number | null {
  if (typeof euro !== 'number' || !Number.isFinite(euro) || euro < 0) return null;
  const cent = Math.round(euro * 100);
  return cent > 0 ? cent : null;
}

/**
 * Kürzt einen Titel auf die erlaubte Länge — an der Wortgrenze.
 *
 * Mitten im Wort abzuschneiden liest sich wie ein Fehler („Hydraulikpum"),
 * und bei Gebrauchtware ist der Titel oft das Einzige, was jemand liest.
 * Bleibt nach dem letzten ganzen Wort weniger als die Hälfte übrig, wird doch
 * hart geschnitten — sonst wäre aus einem langen ersten Wort ein Titel mit
 * drei Zeichen geworden.
 */
export function kuerzeTitel(titel: string, max: number): string {
  const sauber = titel.replace(/\s+/g, ' ').trim();
  if (sauber.length <= max) return sauber;
  const hart = sauber.slice(0, max);
  const letzteLuecke = hart.lastIndexOf(' ');
  if (letzteLuecke >= Math.floor(max / 2)) return hart.slice(0, letzteLuecke).trim();
  return hart.trim();
}

/**
 * Räumt eine Postleitzahl auf: „1097 DN" → „1097DN".
 *
 * Marktplaats erlaubt sechs Zeichen; mit Leerzeichen sind es sieben, und die
 * Anzeige landet ohne Ort im „Buitenland". Das ist genau der Fall, den man
 * erst bemerkt, wenn niemand aus der Region die Anzeige findet.
 */
export function normalisierePlz(roh: string | null | undefined): string | null {
  const plz = (roh ?? '').replace(/\s+/g, '').toUpperCase();
  return /^[0-9]{4}[A-Z]{2}$/.test(plz) ? plz : null;
}

/** Herstellernummer auf die erlaubten 25 Zeichen bringen. */
export function kuerzeMpn(mpn: string | null | undefined): string | null {
  const wert = (mpn ?? '').trim();
  if (!wert) return null;
  return wert.slice(0, MAX_PARTNUMBER);
}

// ---------------------------------------------------------------------------
// Zusammenbau
// ---------------------------------------------------------------------------

/**
 * Baut die Anzeige.
 *
 * Wirft nicht. Fehlt etwas Pflichtiges, kommt `bereit: false` mit einem
 * benannten Befund zurück — die Oberfläche zeigt dann „847 Artikel ohne
 * Kategorie" statt 847 stiller Fehlschläge in einem Protokoll.
 */
export function baueAnzeige(e: AnzeigeEingabe): Anzeigenbau {
  const befunde: Befund[] = [];
  const max = e.maxTitel && e.maxTitel > 0 ? e.maxTitel : TITEL_VORGABE;

  const titelRoh = (e.titel ?? '').replace(/\s+/g, ' ').trim();
  const titel = kuerzeTitel(titelRoh, max);
  if (!titel) befunde.push({ art: 'fehlt', feld: 'titel', text: 'Kein Titel vorhanden.' });
  else if (titel.length < titelRoh.length) {
    befunde.push({
      art: 'gekuerzt',
      feld: 'titel',
      text: `Titel von ${titelRoh.length} auf ${titel.length} Zeichen gekürzt (Grenze ${max}).`,
    });
  }

  const beschreibung = (e.beschreibung ?? '').trim();
  if (!beschreibung) befunde.push({ art: 'fehlt', feld: 'beschreibung', text: 'Kein Beschreibungstext vorhanden.' });

  const kategorieId = Number.isFinite(Number(e.kategorieId)) && Number(e.kategorieId) > 0 ? Number(e.kategorieId) : null;
  if (!kategorieId) {
    befunde.push({
      art: 'fehlt',
      feld: 'kategorieId',
      text: 'Keine Marktplaats-Kategorie zugeordnet. Anzeigen brauchen eine L2-Kategorie.',
    });
  }

  const plz = normalisierePlz(e.postleitzahl);
  if (!plz) {
    befunde.push({
      art: 'fehlt',
      feld: 'postleitzahl',
      text: `Postleitzahl „${e.postleitzahl ?? ''}" ist keine niederländische PLZ (Form 1234AB).`,
    });
  }

  const preisCent = inCent(e.preisEuro);
  if (!preisCent) {
    befunde.push({
      art: 'fehlt',
      feld: 'preis',
      text: 'Kein Verkaufspreis hinterlegt. Ohne Preis wird nicht veröffentlicht.',
    });
  }

  if (!titel || !beschreibung || !kategorieId || !plz || !preisCent) {
    return { anzeige: null, befunde, bereit: false };
  }

  const priceModel: PriceModel = { modelType: 'fixed', askingPrice: preisCent };
  const versandCent = inCent(e.versandEuro);
  if (versandCent) priceModel.shippingCosts = versandCent;

  const anzeige: Anzeige = {
    translations: [{ locale: LOCALE, title: titel, description: beschreibung }],
    categoryId: kategorieId,
    location: { postcode: plz },
    priceModel,
    reserved: false,
  };

  const mpn = kuerzeMpn(e.mpn);
  if (mpn) anzeige.partNumber = mpn;

  const url = (e.shopUrl ?? '').trim();
  if (url) {
    // Nur http/https/ftp sind erlaubt; alles andere weist die API ab und
    // nimmt die ganze Anzeige gleich mit.
    if (/^(https?|ftp):\/\//i.test(url)) anzeige.url = url;
    else befunde.push({ art: 'hinweis', feld: 'url', text: `Shop-Link „${url}" hat kein http/https/ftp — weggelassen.` });
  }

  return { anzeige, befunde, bereit: true };
}

/**
 * Ein Fingerabdruck der Anzeige.
 *
 * Der Abgleich läuft über zehntausende Artikel. Ohne ihn ginge bei jedem Lauf
 * jede Anzeige erneut als Änderung raus — das kostet Zeit, API-Kontingent und
 * bei Marktplaats unter Umständen die Platzierung, weil eine Änderung die
 * Anzeige neu bewertet. Verglichen wird der Inhalt, nicht der Zeitpunkt.
 *
 * Bewusst kein Hash: Die Zeichenkette ist kurz genug für eine Datenbankspalte
 * und im Zweifel lesbar. Wer wissen will, warum ein Artikel als geändert gilt,
 * sieht es der Spalte an.
 */
export function fingerabdruck(a: Anzeige): string {
  const t = a.translations[0];
  return [
    a.categoryId,
    a.location.postcode,
    a.priceModel.modelType,
    a.priceModel.askingPrice ?? '',
    a.priceModel.shippingCosts ?? '',
    a.partNumber ?? '',
    a.url ?? '',
    t?.title ?? '',
    // Der Text ist lang; seine Länge plus Anfang und Ende reicht, um jede
    // Änderung zu bemerken, die ein Mensch als Änderung bezeichnen würde.
    `${(t?.description ?? '').length}:${(t?.description ?? '').slice(0, 40)}:${(t?.description ?? '').slice(-40)}`,
  ].join('|');
}
