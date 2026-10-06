/**
 * Fotostudio — was in Plenty geschrieben wird, als reine Daten.
 *
 * Ersetzt die Make-Szenarien „Automation Fotostudio PC 1" und „PC 2". Dort
 * lief es so: Kamera-Software legt Fotos in einen Google-Drive-Ordner, Make
 * holt sie ab, schiebt sie über Cloudinary und legt in Plenty einen Artikel
 * an. Welche Fotos zu welchem Artikel gehören, wurde GERATEN: Kam ein Foto
 * innerhalb von 60 Sekunden nach dem ersten, landete es am selben Artikel.
 * Wer länger brauchte, bekam zwei halbe Artikel; wer schneller zum nächsten
 * griff, einen gemischten. Deshalb gab es zwei Szenarien mit zwei Ordnern —
 * damit sich PC 1 und PC 2 nicht gegenseitig die Artikel zerschießen.
 *
 * Hier gehört jedes Foto von der ersten Sekunde an zu einem Artikel, weil der
 * Artikel existiert, bevor das erste Foto gemacht ist. Damit braucht es weder
 * Ordner noch Zeitfenster noch zwei Kopien desselben Ablaufs — beliebig viele
 * Plätze (PC, Handy, Tablet) können gleichzeitig arbeiten.
 *
 * Die Stammwerte (Besitzer, Kategorie, eBay-Vorlage, Einheit) sind die aus
 * dem Make-Szenario; über die Umgebung lassen sie sich ändern, ohne Code
 * anzufassen.
 */

import type { Zustand } from '@/lib/preis/regelwerk';
import { PLENTY_ZUSTAND } from '@/lib/plenty/anlegen-kern';

// ---------------------------------------------------------------------------
// Stammwerte
// ---------------------------------------------------------------------------

export interface FotostudioKonfig {
  /** Plenty-Benutzer, dem der Artikel gehört. Make: 128 (Amanuel Kheyo). */
  ownerId: number;
  /** Kategorie der Variante. Make: 2246. Ohne Kategorie keine Variante. */
  kategorieId: number;
  /** eBay-Vorlage am Artikel. Make: 30. */
  ebayPresetId: number | null;
  /** Einheit der Variante. Make: 1 (Stück), Inhalt 1. */
  unitId: number;
  /** Markierungen am Artikel. Make ließ beide auf 0. */
  flagOne: number;
  flagTwo: number;
  /** Lager für die Bestandsbuchung. Ohne Lager wird kein Bestand gebucht. */
  warehouseId: number | null;
  /** Mandant, in dem der Artikel sichtbar ist (`variationClients`). */
  clientId: number | null;
}

/** Was Make fest verdrahtet hatte — die Rückfallwerte, wenn nichts gesetzt ist. */
export const MAKE_STANDARD = {
  ownerId: 128,
  kategorieId: 2246,
  ebayPresetId: 30,
  unitId: 1,
  flagOne: 0,
  flagTwo: 0,
} as const;

/**
 * Liest eine Ganzzahl aus der Umgebung.
 *
 * `erlaubeNull`: Bei den Flags ist 0 ein echter Wert, bei IDs heißt 0 „nicht
 * gesetzt". Ein leeres oder unsinniges Feld fällt auf den Standard zurück,
 * statt still als 0 nach Plenty zu gehen.
 */
function ganzzahl(roh: string | undefined, standard: number, erlaubeNull = false): number {
  if (roh == null || roh.trim() === '') return standard;
  const n = Number(roh.trim());
  if (!Number.isInteger(n)) return standard;
  if (n < 0 || (!erlaubeNull && n === 0)) return standard;
  return n;
}

function idOderNull(roh: string | undefined): number | null {
  const n = Number(roh);
  return roh && Number.isInteger(n) && n > 0 ? n : null;
}

export function leseKonfig(env: Record<string, string | undefined> = process.env): FotostudioKonfig {
  // Die eBay-Vorlage lässt sich ausdrücklich abschalten ("0" oder "aus") —
  // etwa für einen Shop ohne eBay-Anbindung.
  const ebayRoh = env.FOTOSTUDIO_EBAY_PRESET_ID?.trim().toLowerCase();
  const ebayPresetId =
    ebayRoh === '0' || ebayRoh === 'aus' ? null : ganzzahl(env.FOTOSTUDIO_EBAY_PRESET_ID, MAKE_STANDARD.ebayPresetId);

  return {
    ownerId: ganzzahl(env.FOTOSTUDIO_OWNER_ID, MAKE_STANDARD.ownerId),
    kategorieId: ganzzahl(env.FOTOSTUDIO_CATEGORY_ID, MAKE_STANDARD.kategorieId),
    ebayPresetId,
    unitId: ganzzahl(env.FOTOSTUDIO_UNIT_ID, MAKE_STANDARD.unitId),
    flagOne: ganzzahl(env.FOTOSTUDIO_FLAG_ONE, MAKE_STANDARD.flagOne, true),
    flagTwo: ganzzahl(env.FOTOSTUDIO_FLAG_TWO, MAKE_STANDARD.flagTwo, true),
    warehouseId: idOderNull(env.FOTOSTUDIO_WAREHOUSE_ID) ?? idOderNull(env.PLENTY_WAREHOUSE_ID),
    clientId: idOderNull(env.PLENTY_ANLAGE_CLIENT_ID),
  };
}

// ---------------------------------------------------------------------------
// Prüfung vor der Anlage
// ---------------------------------------------------------------------------

export interface FotostudioEingabe {
  zustand: Zustand;
  bestand: number;
  gewichtKg: number | null;
  /** Bestätigte Fotos (hochgeladen). Unterwegs befindliche zählen nicht. */
  fotos: number;
  /** Fotos, die noch in der Warteschlange hängen. */
  unterwegs: number;
}

export interface Pruefung {
  ok: boolean;
  /** Was die Anlage verhindert. */
  hindernisse: string[];
  /** Was fehlt, aber nachgetragen werden kann. */
  hinweise: string[];
}

/**
 * Darf der Artikel nach Plenty?
 *
 * Hart ist nur: mindestens ein Foto, kein Foto mehr unterwegs, ein Bestand.
 * Ein noch hochladendes Foto ist ein Hindernis und kein Hinweis — sonst geht
 * der Artikel mit vier von fünf Bildern raus, und das fünfte hängt an einem
 * Artikel, der schon fertig ist. Genau das Muster, das in Make zu den halben
 * Artikeln geführt hat.
 */
export function pruefe(e: FotostudioEingabe): Pruefung {
  const hindernisse: string[] = [];
  const hinweise: string[] = [];

  if (e.fotos < 1) hindernisse.push('Noch kein Foto — mindestens eines braucht der Artikel.');
  if (e.unterwegs > 0) {
    hindernisse.push(
      e.unterwegs === 1 ? 'Ein Foto lädt noch hoch.' : `${e.unterwegs} Fotos laden noch hoch.`,
    );
  }
  if (!Number.isInteger(e.bestand) || e.bestand < 1) hindernisse.push('Bestand fehlt.');
  if (e.gewichtKg == null) hinweise.push('Kein Gewicht — in Plenty nachtragen, sonst fehlt der Versand.');

  return { ok: hindernisse.length === 0, hindernisse, hinweise };
}

// ---------------------------------------------------------------------------
// Der Anlage-Rumpf
// ---------------------------------------------------------------------------

export interface FotostudioVariante {
  variationCategories: Array<{ categoryId: number }>;
  unit: { unitId: number; content: number };
  /** Immer false — freigegeben wird im Büro, wie bei der Erfassung. */
  isActive: false;
  variationClients?: Array<{ plentyId: number }>;
  weightG?: number;
  weightNetG?: number;
  variationBarcodes?: Array<{ barcodeId: number; code: string }>;
}

export interface FotostudioItem {
  ownerId: number;
  ebayPresetId?: number;
  flagOne: number;
  flagTwo: number;
  condition: number;
  variations: FotostudioVariante[];
}

/**
 * Baut den Rumpf für `POST /rest/items`.
 *
 * Gegenüber Make kommen Zustand und Gewicht dazu, die dort niemand eintragen
 * konnte, und die Variante wird ausdrücklich inaktiv angelegt.
 */
export function baueItem(
  e: { zustand: Zustand; gewichtKg: number | null; ean?: string | null },
  k: FotostudioKonfig,
  opts: { plentyId: number; eanBarcodeId?: number | null },
): FotostudioItem {
  const variante: FotostudioVariante = {
    variationCategories: [{ categoryId: k.kategorieId }],
    unit: { unitId: k.unitId, content: 1 },
    isActive: false,
    variationClients: [{ plentyId: k.clientId ?? opts.plentyId }],
  };

  if (typeof e.gewichtKg === 'number' && e.gewichtKg > 0) {
    const gramm = Math.round(e.gewichtKg * 1000);
    variante.weightG = gramm;
    variante.weightNetG = gramm;
  }

  if (e.ean && opts.eanBarcodeId) {
    variante.variationBarcodes = [{ barcodeId: opts.eanBarcodeId, code: e.ean }];
  }

  const item: FotostudioItem = {
    ownerId: k.ownerId,
    flagOne: k.flagOne,
    flagTwo: k.flagTwo,
    condition: PLENTY_ZUSTAND[e.zustand],
    variations: [variante],
  };
  if (k.ebayPresetId) item.ebayPresetId = k.ebayPresetId;
  return item;
}

/** Dateiname in Plenty: Artikelnummer und Position, damit man ihn wiederfindet. */
export function bildDateiname(nummer: number, position: number, pfad: string): string {
  const endung = /\.([a-z0-9]+)$/i.exec(pfad)?.[1]?.toLowerCase() ?? 'jpg';
  return `fotostudio-${nummer}-${position + 1}.${endung}`;
}

// ---------------------------------------------------------------------------
// Fortschritt
// ---------------------------------------------------------------------------

export interface PlentyStand {
  itemId: number | null;
  variationId: number | null;
  bestandGebucht: boolean;
  /** Bild-ID in Plenty je erfasstem Bild (unsere Bild-ID → Plenty-ID). */
  bilder: Record<string, number>;
  offen: string[];
}

export const LEERER_STAND: PlentyStand = {
  itemId: null,
  variationId: null,
  bestandGebucht: false,
  bilder: {},
  offen: [],
};

/** Liest den gespeicherten Stand; alles Unbekannte fällt auf leer zurück. */
export function leseStand(roh: unknown): PlentyStand {
  if (!roh || typeof roh !== 'object') return { ...LEERER_STAND, bilder: {}, offen: [] };
  const r = roh as Record<string, unknown>;
  const zahl = (w: unknown) => (typeof w === 'number' && Number.isFinite(w) ? w : null);
  const bilder: Record<string, number> = {};
  if (r.bilder && typeof r.bilder === 'object') {
    for (const [k, v] of Object.entries(r.bilder as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) bilder[k] = v;
    }
  }
  return {
    itemId: zahl(r.itemId),
    variationId: zahl(r.variationId),
    bestandGebucht: r.bestandGebucht === true,
    bilder,
    offen: Array.isArray(r.offen) ? r.offen.filter((x): x is string => typeof x === 'string') : [],
  };
}

/** Welche Bilder noch nach Plenty müssen — in Anzeige-Reihenfolge. */
export function offeneBilder<T extends { id: string; position: number; hochgeladen: boolean }>(
  bilder: T[],
  stand: PlentyStand,
): T[] {
  return bilder
    .filter((b) => b.hochgeladen && !(b.id in stand.bilder))
    .sort((a, b) => a.position - b.position);
}
