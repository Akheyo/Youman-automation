/**
 * Was in Plenty geschrieben wird — als reine Daten.
 *
 * Getrennt vom Schreiben selbst (`anlegen.ts`), weil hier die Entscheidungen
 * stecken, die falsch sein können: welcher Text in welches Feld gehört, welche
 * Preise gesetzt werden, welches Versandprofil greift, ob der Artikel
 * überhaupt fertig genug für Plenty ist. Das lässt sich prüfen. Ob ein POST
 * durchgeht, lässt sich nur ausprobieren.
 *
 * Grundsatz durchgehend: Was nicht feststeht, wird nicht gesetzt. Ein leeres
 * Feld in Plenty sieht im Büro nach Arbeit aus — ein falsch gefülltes nicht.
 */

import type { Erkennung } from '@/lib/erfassung/erkennung';
import { masseText } from '@/lib/erfassung/erkennung';
import type { Listing } from '@/lib/listing/texte';
import type { Zustand } from '@/lib/preis/regelwerk';
import type { Packklasse } from '@/lib/preis/versand';

// ---------------------------------------------------------------------------
// Versandprofile
// ---------------------------------------------------------------------------

/**
 * Die Zuordnung Versandkosten → Plenty-Versandprofil.
 *
 * Sie kommt aus der Umgebung, weil die Profil-IDs je Mandant verschieden sind
 * und niemand sie in den Code schreiben sollte. Format:
 *
 *   PLENTY_VERSANDPROFILE="7.90=6,9.90=7,14.90=8,19.90=9,29.90=10,spedition=11"
 *
 * Der Schlüssel ist der Betrag aus `VERSANDSTAFFEL`, der Wert die Profil-ID.
 */
export function leseVersandprofile(roh: string | null | undefined): Map<string, number> {
  const karte = new Map<string, number>();
  for (const teil of (roh ?? '').split(',')) {
    const [schluessel, wert] = teil.split('=').map((s) => s.trim());
    if (!schluessel || !wert) continue;
    const id = Number(wert);
    if (!Number.isFinite(id) || id <= 0) continue;
    karte.set(schluessel.toLowerCase().replace(',', '.'), id);
  }
  return karte;
}

/** Findet das Versandprofil zu einem Betrag (oder zur Spedition). */
export function versandprofilId(
  profile: Map<string, number>,
  kosten: number | null,
  spedition: boolean,
): number | null {
  if (spedition) return profile.get('spedition') ?? null;
  if (kosten == null) return null;
  return profile.get(kosten.toFixed(2)) ?? null;
}

// ---------------------------------------------------------------------------
// Texte
// ---------------------------------------------------------------------------

/**
 * Die technischen Daten als eigenes Feld.
 *
 * Plenty hat dafür `technicalData`, und dorthin gehören sie auch: Im
 * Beschreibungstext stehen sie nur als Fließtext, im eigenen Feld kann der
 * Webshop sie als Tabelle ausgeben und eBay sie in die Artikelmerkmale
 * übernehmen.
 */
export function technischeDaten(erk: Erkennung): string {
  const zeilen = erk.merkmale.filter((m) => m.name?.trim() && m.wert?.trim()).map((m) => `${m.name}: ${m.wert}`);
  const masse = masseText(erk.masseCm);
  if (masse) zeilen.push(`Maße: ${masse}`);
  if (erk.baujahr) zeilen.push(`Baujahr: ${erk.baujahr}`);
  if (erk.seriennummer) zeilen.push(`Seriennummer: ${erk.seriennummer}`);
  if (zeilen.length === 0) return '';
  return `<ul>${zeilen.map((z) => `<li>${z.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`).join('')}</ul>`;
}

export interface Texte {
  lang: 'de';
  /** eBay-Titel 1 — auch der Artikelname in Plenty. */
  name1: string;
  name2: string;
  name3: string;
  shortDescription: string;
  description: string;
  technicalData: string;
  metaDescription: string;
  keywords: string;
  urlPath: string;
}

export interface TexteEingabe {
  listing: Listing;
  erkennung: Erkennung;
  /** Die vollständige Produktkarte fürs Web; fehlt sie, nimmt Plenty die Beschreibung. */
  produktkarte?: string | null;
  /** Der Teaser aus dem Fließtext — Plentys `shortDescription`. */
  teaser?: string | null;
  metaDescription: string;
  keywords: string[];
  urlPfad: string;
}

/**
 * Setzt die Plenty-Textfelder.
 *
 * Die drei eBay-Titel landen in name1/name2/name3 — genau dafür sind die
 * Felder da, und so muss sie beim Listen niemand noch einmal eintippen.
 */
export function baueTexte(e: TexteEingabe): Texte {
  return {
    lang: 'de',
    name1: e.listing.titel1,
    name2: e.listing.titel2,
    name3: e.listing.titel3,
    shortDescription: (e.teaser ?? '').trim(),
    description: (e.produktkarte ?? e.listing.beschreibung).trim(),
    technicalData: technischeDaten(e.erkennung),
    metaDescription: e.metaDescription,
    keywords: e.keywords.join(', '),
    urlPath: e.urlPfad,
  };
}

// ---------------------------------------------------------------------------
// Preise
// ---------------------------------------------------------------------------

export interface Preiszeile {
  salesPriceId: number;
  price: number;
}

/**
 * Baut die Preiszeilen für eBay und Webshop.
 *
 * Fehlt eine Preisliste in der Konfiguration, wird sie übersprungen statt auf
 * eine andere umgelenkt: Ein eBay-Preis, der versehentlich im Webshop landet,
 * ist um fünf Prozent zu hoch und fällt niemandem auf.
 */
export function bauePreise(
  ebay: number | null,
  webshop: number | null,
  ids: { ebay: number | null; webshop: number | null },
): Preiszeile[] {
  const zeilen: Preiszeile[] = [];
  if (ids.ebay && typeof ebay === 'number' && ebay > 0) zeilen.push({ salesPriceId: ids.ebay, price: ebay });
  if (ids.webshop && typeof webshop === 'number' && webshop > 0) {
    zeilen.push({ salesPriceId: ids.webshop, price: webshop });
  }
  return zeilen;
}

// ---------------------------------------------------------------------------
// Bereitschaftsprüfung
// ---------------------------------------------------------------------------

export interface ArtikelEingabe {
  listing: Listing;
  erkennung: Erkennung;
  zustand: Zustand;
  bestand: number;
  /** Kategorie in Plenty. Ohne sie legt Plenty keine Variante an. */
  kategorieId: number | null;
  ean: string | null;
  preisEbay: number | null;
  preisWebshop: number | null;
  gewichtKg?: number | null;
  packklasse?: Packklasse;
  versandkosten?: number | null;
  spedition?: boolean;
  texte: Texte;
  /** Die Herleitung des Preises — kommt als interne Notiz mit (SOP 8). */
  herleitung?: string | null;
  zolltarifnummer?: string | null;
  herkunftsland?: string | null;
}

export interface Bereitschaft {
  bereit: boolean;
  /** Was fehlt und die Anlage verhindert. */
  hindernisse: string[];
  /** Was fehlt, aber nachgetragen werden kann. */
  hinweise: string[];
}

/**
 * Prüft, ob der Artikel nach Plenty darf.
 *
 * Hart ist nur, was Plenty selbst verlangt oder was ohne Kontrolle Geld
 * kostet: eine Kategorie (sonst schlägt die Anlage fehl), ein Titel und ein
 * Preis. Alles andere ist ein Hinweis — der Artikel wird ohnehin inaktiv
 * angelegt und im Büro durchgesehen, und dort ist ein angelegter Artikel mit
 * Lücken nützlicher als gar keiner.
 */
export function pruefeBereitschaft(e: ArtikelEingabe): Bereitschaft {
  const hindernisse: string[] = [];
  const hinweise: string[] = [];

  if (!e.kategorieId) hindernisse.push('Keine Kategorie — Plenty legt ohne Kategorie keine Variante an.');
  if (!e.texte.name1?.trim()) hindernisse.push('Kein Titel.');
  if (!(typeof e.preisEbay === 'number' && e.preisEbay > 0)) {
    hindernisse.push('Kein Verkaufspreis ermittelt — der Artikel wäre in Plenty mit 0,00 € eingestellt.');
  }
  if (!Number.isFinite(e.bestand) || e.bestand < 1) hindernisse.push('Kein Bestand angegeben.');

  if (!e.ean) hinweise.push('Keine EAN vergeben.');
  if (e.gewichtKg == null) hinweise.push('Kein Gewicht — Versandprofil und Versandkosten fehlen.');
  else if (e.spedition) hinweise.push('Über 30 kg: nur Spedition oder Abholung, kein Paketversand.');
  else if (e.versandkosten == null) hinweise.push('Versandkosten nicht bestimmbar.');
  if (!e.texte.description?.trim()) hinweise.push('Keine Beschreibung.');
  if (!e.texte.metaDescription?.trim()) hinweise.push('Keine Meta-Description.');
  if (!e.texte.technicalData?.trim()) hinweise.push('Keine technischen Daten.');
  if (!e.zolltarifnummer) hinweise.push('Keine Zolltarifnummer — wird für Auslandsversand gebraucht.');
  if (!e.erkennung.typenschildGefunden) {
    hinweise.push('Kein lesbares Typenschild auf den Fotos — Modellangaben sind unsicher.');
  }

  return { bereit: hindernisse.length === 0, hindernisse, hinweise };
}

// ---------------------------------------------------------------------------
// Der Anlage-Rumpf
// ---------------------------------------------------------------------------

export interface VariantenPayload {
  variationCategories: Array<{ categoryId: number }>;
  unit: { unitId: number; content: number };
  /**
   * Immer false. Der Artikel wird angelegt und im Büro freigegeben — so hat
   * Amanuel es festgelegt, und es ist die einzige Sicherung dagegen, dass ein
   * falsch erkannter Artikel sofort auf eBay steht.
   */
  isActive: false;
  variationBarcodes?: Array<{ barcodeId: number; code: string }>;
  variationSalesPrices?: Preiszeile[];
  variationClients?: Array<{ plentyId: number }>;
  weightG?: number;
  weightNetG?: number;
  customsTariffNumber?: string;
  /** Plentys Feld für das Herkunftsland heißt so; es erwartet eine ID. */
  countryOfOriginId?: number;
}

export interface ItemPayload {
  variations: VariantenPayload[];
  texts: Texte[];
  /** Bei Gebrauchtware ist das Mehrwertsteuerkonto dasselbe — 19 % regulär. */
  condition?: number;
}

/** Plentys Zustandsschlüssel am Artikel (0 = neu, 1 = gebraucht). */
export const PLENTY_ZUSTAND: Record<Zustand, number> = {
  neu_versiegelt: 0,
  neu: 0,
  gebraucht: 1,
  defekt: 1,
};

/**
 * Baut den Rumpf für `POST /rest/items`.
 *
 * Alles, was in einem Aufruf gehen kann, geht in einem Aufruf: Plenty bremst
 * schreibende Anfragen, und jeder zusätzliche Schritt ist ein zusätzlicher
 * Punkt, an dem der Artikel halb angelegt liegen bleibt.
 */
export function baueItemPayload(
  e: ArtikelEingabe,
  konf: {
    plentyId: number;
    eanBarcodeId: number | null;
    salesPriceEbayId: number | null;
    salesPriceWebshopId: number | null;
    unitId?: number;
  },
): ItemPayload {
  const variante: VariantenPayload = {
    variationCategories: e.kategorieId ? [{ categoryId: e.kategorieId }] : [],
    unit: { unitId: konf.unitId ?? 1, content: 1 },
    isActive: false,
    variationClients: [{ plentyId: konf.plentyId }],
  };

  if (e.ean && konf.eanBarcodeId) {
    variante.variationBarcodes = [{ barcodeId: konf.eanBarcodeId, code: e.ean }];
  }

  const preise = bauePreise(e.preisEbay, e.preisWebshop, {
    ebay: konf.salesPriceEbayId,
    webshop: konf.salesPriceWebshopId,
  });
  if (preise.length > 0) variante.variationSalesPrices = preise;

  if (typeof e.gewichtKg === 'number' && e.gewichtKg > 0) {
    const gramm = Math.round(e.gewichtKg * 1000);
    variante.weightG = gramm;
    variante.weightNetG = gramm;
  }

  if (e.zolltarifnummer?.trim()) variante.customsTariffNumber = e.zolltarifnummer.trim();

  return { variations: [variante], texts: [e.texte], condition: PLENTY_ZUSTAND[e.zustand] };
}

/**
 * Die interne Notiz am Artikel.
 *
 * Sie beantwortet die Frage, die im Büro als Erstes kommt: Wo kommt dieser
 * Preis her? Die Arbeitsanweisung verlangt sie ausdrücklich, und sie steht
 * am Artikel, nicht in einem Protokoll, das niemand aufmacht.
 */
export function baueNotiz(e: ArtikelEingabe, bereitschaft: Bereitschaft): string {
  const zeilen: string[] = [];
  zeilen.push(`Zustand: ${e.zustand}`);
  if (e.ean) zeilen.push(`EAN: ${e.ean}`);
  if (typeof e.preisEbay === 'number') zeilen.push(`eBay: ${e.preisEbay.toFixed(2)} EUR`);
  if (typeof e.preisWebshop === 'number') zeilen.push(`Webshop: ${e.preisWebshop.toFixed(2)} EUR`);
  if (typeof e.versandkosten === 'number') zeilen.push(`Versand: ${e.versandkosten.toFixed(2)} EUR`);
  if (e.spedition) zeilen.push('Versand: nur Spedition oder Abholung.');
  if (e.herleitung?.trim()) zeilen.push('', e.herleitung.trim());
  if (bereitschaft.hinweise.length > 0) {
    zeilen.push('', 'Offen:');
    for (const h of bereitschaft.hinweise) zeilen.push(`· ${h}`);
  }
  return zeilen.join('\n');
}
