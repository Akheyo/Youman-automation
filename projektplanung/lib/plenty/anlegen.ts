/**
 * Artikelanlage in Plenty.
 *
 * Der Ablauf ist bewusst in einzelne, benannte Schritte zerlegt, und kein
 * Schritt reißt die anderen mit: Ein Artikel, bei dem nur das Versandprofil
 * fehlgeschlagen ist, soll in Plenty stehen und das Versandprofil als offenen
 * Punkt führen — nicht verschwinden, weil ein Aufruf von sieben nicht
 * durchging. Ein halb angelegter Artikel, von dem niemand weiß, ist das
 * Schlimmste, was hier passieren kann; deshalb steht am Ende immer ein
 * Protokoll mit Artikel-ID.
 *
 * Der Artikel wird IMMER inaktiv angelegt. Freigegeben wird im Büro.
 *
 * Zusätzliche Umgebungsvariablen:
 *   PLENTY_SAMMEL_CATEGORY_ID     Auffangkategorie, wenn die Zuordnung nichts findet
 *   PLENTY_SALES_PRICE_EBAY_ID    Preisliste eBay
 *   PLENTY_SALES_PRICE_WEBSHOP_ID Preisliste Webshop
 *   PLENTY_WAREHOUSE_ID           Lager für die Bestandsbuchung
 *   PLENTY_MARKET_IDS             Märkte, z. B. "103.00,0.00" (eBay, Webshop)
 *   PLENTY_VERSANDPROFILE         "7.90=6,9.90=7,14.90=8,19.90=9,29.90=10,spedition=11"
 *   PLENTY_ANLAGE_CLIENT_ID       Mandant, DEM DER ARTIKEL GEHÖRT — siehe unten
 */

import { aktuelleConfig, plentyConfigured, plentyJson, type PlentyConfig } from './client';
import {
  baueItemPayload,
  baueNotiz,
  leseVersandprofile,
  pruefeBereitschaft,
  versandprofilId,
  type ArtikelEingabe,
  type Bereitschaft,
} from './anlegen-kern';

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

export interface AnlageConfig {
  /**
   * Der Mandant, dem der angelegte Artikel gehört.
   *
   * NICHT zwangsläufig derselbe wie `PLENTY_ID`. Die Zugangsdaten in den
   * Einstellungen gelten für das ganze System, und dort steht der Mandant,
   * unter dem die Projektplanung arbeitet. Die Erfassung listet aber
   * möglicherweise in einem anderen Shop — und `variationClients` entscheidet,
   * in welchem der Artikel überhaupt auftaucht. Steht hier der falsche
   * Mandant, wird der Artikel sauber angelegt und ist im Zielshop trotzdem
   * unsichtbar. Das fällt erst auf, wenn jemand ihn dort sucht.
   *
   * Leer = derselbe wie `PLENTY_ID`.
   */
  clientId: number | null;
  salesPriceEbayId: number | null;
  salesPriceWebshopId: number | null;
  warehouseId: number | null;
  marketIds: string[];
  versandprofile: Map<string, number>;
  sammelKategorieId: number | null;
}

function zahlOderNull(roh: string | undefined): number | null {
  const n = Number(roh);
  return roh && Number.isFinite(n) && n > 0 ? n : null;
}

export function getAnlageConfig(): AnlageConfig {
  return {
    clientId: zahlOderNull(process.env.PLENTY_ANLAGE_CLIENT_ID),
    salesPriceEbayId: zahlOderNull(process.env.PLENTY_SALES_PRICE_EBAY_ID),
    salesPriceWebshopId: zahlOderNull(process.env.PLENTY_SALES_PRICE_WEBSHOP_ID),
    warehouseId: zahlOderNull(process.env.PLENTY_WAREHOUSE_ID),
    marketIds: (process.env.PLENTY_MARKET_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    versandprofile: leseVersandprofile(process.env.PLENTY_VERSANDPROFILE),
    sammelKategorieId: zahlOderNull(process.env.PLENTY_SAMMEL_CATEGORY_ID),
  };
}

// ---------------------------------------------------------------------------
// Protokoll
// ---------------------------------------------------------------------------

export interface Schritt {
  name: string
  ok: boolean;
  /** Warum es nicht ging — im Klartext, nicht als Statuscode. */
  fehler?: string | null;
  uebersprungen?: string | null;
}

export interface AnlageErgebnis {
  ok: boolean;
  /** Wahr, wenn Plenty nicht eingerichtet ist — dann passiert nichts. */
  uebersprungen: boolean;
  itemId: number | null;
  variationId: number | null;
  bereitschaft: Bereitschaft;
  schritte: Schritt[];
  /** Was im Büro noch zu tun ist. */
  offen: string[];
  notiz: string;
  fehler: string | null;
}

function fehlertext(err: unknown): string {
  const text = (err as Error)?.message ?? String(err);
  return text.length > 400 ? `${text.slice(0, 400)}…` : text;
}

// ---------------------------------------------------------------------------
// Einzelne Schritte
// ---------------------------------------------------------------------------

interface PlentyItemAntwort {
  id?: number;
  variations?: Array<{ id?: number; isMain?: boolean }>;
}

/**
 * Führt einen Schritt aus und protokolliert ihn, statt ihn durchschlagen zu
 * lassen.
 *
 * Wirft nie. Der Aufrufer entscheidet anhand des Protokolls, ob das Ergebnis
 * brauchbar ist — und selbst ein Artikel mit drei fehlgeschlagenen Schritten
 * ist besser als eine Fehlermeldung ohne Artikel-ID.
 */
async function schritt(
  protokoll: Schritt[],
  name: string,
  arbeit: () => Promise<unknown>,
  ueberspringen?: string | null,
): Promise<boolean> {
  if (ueberspringen) {
    protokoll.push({ name, ok: true, uebersprungen: ueberspringen });
    return false;
  }
  try {
    await arbeit();
    protokoll.push({ name, ok: true });
    return true;
  } catch (err) {
    protokoll.push({ name, ok: false, fehler: fehlertext(err) });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Der Ablauf
// ---------------------------------------------------------------------------

/**
 * Legt einen Artikel in Plenty an — inaktiv.
 *
 * Bricht nur ab, wenn der Artikel selbst nicht entstanden ist. Alles danach
 * ist Ausstattung: Fehlt sie, steht sie als offener Punkt am Artikel.
 */
export async function legeArtikelAn(
  e: ArtikelEingabe,
  opts: { config?: PlentyConfig; anlage?: AnlageConfig } = {},
): Promise<AnlageErgebnis> {
  const bereitschaft = pruefeBereitschaft(e);
  const notiz = baueNotiz(e, bereitschaft);
  const schritte: Schritt[] = [];

  const leer: AnlageErgebnis = {
    ok: false,
    uebersprungen: false,
    itemId: null,
    variationId: null,
    bereitschaft,
    schritte,
    offen: [...bereitschaft.hinweise],
    notiz,
    fehler: null,
  };

  if (!bereitschaft.bereit) {
    return { ...leer, fehler: `Artikel noch nicht anlagefähig: ${bereitschaft.hindernisse.join(' ')}` };
  }

  const cfg = opts.config ?? (await aktuelleConfig());
  if (!plentyConfigured(cfg)) {
    return { ...leer, ok: true, uebersprungen: true, fehler: null };
  }
  const anlage = opts.anlage ?? getAnlageConfig();

  // --- 1. Artikel mit Hauptvariante -----------------------------------------
  const payload = baueItemPayload(e, {
    plentyId: anlage.clientId ?? cfg.plentyId,
    eanBarcodeId: cfg.eanBarcodeId,
    salesPriceEbayId: anlage.salesPriceEbayId,
    salesPriceWebshopId: anlage.salesPriceWebshopId,
  });

  let itemId: number | null = null;
  let variationId: number | null = null;
  try {
    const antwort = await plentyJson<PlentyItemAntwort>('POST', '/rest/items', payload, cfg);
    itemId = antwort?.id ?? null;
    const haupt = (antwort?.variations ?? []).find((v) => v.isMain) ?? antwort?.variations?.[0];
    variationId = haupt?.id ?? null;
    schritte.push({ name: 'Artikel anlegen', ok: Boolean(itemId && variationId) });
  } catch (err) {
    schritte.push({ name: 'Artikel anlegen', ok: false, fehler: fehlertext(err) });
    return { ...leer, fehler: `Artikel konnte nicht angelegt werden: ${fehlertext(err)}` };
  }

  if (!itemId || !variationId) {
    return { ...leer, itemId, variationId, fehler: 'Plenty lieferte keine Artikel- oder Varianten-ID zurück.' };
  }

  // --- 2. Texte -------------------------------------------------------------
  // Eigener Aufruf: Die Texte gehen zwar im Anlage-Rumpf mit, kommen aber je
  // nach Plenty-Version nicht vollständig an. Doppelt gesetzt schadet nichts.
  await schritt(schritte, 'Texte setzen', () =>
    plentyJson('POST', `/rest/items/${itemId}/variations/${variationId}/descriptions`, e.texte, cfg),
  );

  // --- 3. Versandprofil -----------------------------------------------------
  const profilId = versandprofilId(anlage.versandprofile, e.versandkosten ?? null, e.spedition === true);
  await schritt(
    schritte,
    'Versandprofil zuordnen',
    () => plentyJson('POST', `/rest/items/${itemId}/item_shipping_profiles`, { profileId: profilId }, cfg),
    profilId
      ? null
      : e.spedition
        ? 'Nur Spedition — kein Paketprofil.'
        : 'Kein Versandprofil zu diesen Kosten hinterlegt (PLENTY_VERSANDPROFILE).',
  );

  // --- 4. Verfügbarkeit auf den Märkten ------------------------------------
  for (const marktId of anlage.marketIds) {
    await schritt(schritte, `Markt ${marktId} freischalten`, () =>
      plentyJson('POST', `/rest/items/${itemId}/variations/${variationId}/variation_markets`, { marketId: marktId }, cfg),
    );
  }
  if (anlage.marketIds.length === 0) {
    schritte.push({
      name: 'Märkte freischalten',
      ok: true,
      uebersprungen: 'Keine Märkte konfiguriert (PLENTY_MARKET_IDS).',
    });
  }

  // --- 5. Bestand -----------------------------------------------------------
  // Der Bestand wird als Korrektur gebucht, nicht gesetzt: Plenty führt
  // Bestände über Bewegungen, und ein direkt gesetzter Wert wäre beim
  // nächsten Lagerabgleich wieder weg.
  await schritt(
    schritte,
    'Bestand buchen',
    () =>
      plentyJson(
        'PUT',
        `/rest/stockmanagement/warehouses/${anlage.warehouseId}/stock/correction`,
        { variationId, quantity: e.bestand, reasonId: 501 },
        cfg,
      ),
    anlage.warehouseId ? null : 'Kein Lager konfiguriert (PLENTY_WAREHOUSE_ID).',
  );

  // --- 6. Inaktiv sicherstellen --------------------------------------------
  // Der Rumpf setzt isActive bereits auf false. Dieser Schritt ist die
  // Rückversicherung: Käme eine Plenty-Version auf die Idee, eine neue
  // Variante aktiv anzulegen, stünde der Artikel sofort im Shop.
  await schritt(schritte, 'Artikel inaktiv setzen', () =>
    plentyJson('PUT', `/rest/items/${itemId}/variations/${variationId}`, { isActive: false }, cfg),
  );

  const gescheitert = schritte.filter((s) => !s.ok);
  const uebersprungen = schritte.filter((s) => s.uebersprungen);

  return {
    ok: true,
    uebersprungen: false,
    itemId,
    variationId,
    bereitschaft,
    schritte,
    offen: [
      ...bereitschaft.hinweise,
      ...gescheitert.map((s) => `${s.name}: ${s.fehler}`),
      ...uebersprungen.map((s) => `${s.name}: ${s.uebersprungen}`),
    ],
    notiz,
    fehler: gescheitert.length > 0 ? `${gescheitert.length} Schritt(e) fehlgeschlagen — siehe offene Punkte.` : null,
  };
}
