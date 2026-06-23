/**
 * Thin client for the eBay Sell Inventory API (REST) — the modern path for
 * creating listings. Three steps per product:
 *   1. createOrReplaceInventoryItem  (PUT  /inventory_item/{sku})
 *   2. createOffer / updateOffer     (POST/PUT /offer)
 *   3. publishOffer                  (POST /offer/{offerId}/publish) → listingId
 *
 * All calls go over plain fetch and throw on a non-OK status with the eBay
 * error body, so the caller can record a precise reason per SKU.
 */

import { ebayHosts, type EbayEnv } from './oauth';
import { normalizeCondition, type SheetProduct } from './sheet';

export interface EbayContext {
  accessToken: string;
  env: EbayEnv;
  marketplaceId: string; // e.g. EBAY_DE
  currency: string; // e.g. EUR
  /** Content-Language header eBay requires for inventory writes (e.g. de-DE). */
  contentLanguage: string;
}

export interface OfferPolicies {
  categoryId?: string;
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  merchantLocationKey?: string;
}

function inventoryBase(ctx: EbayContext): string {
  return `${ebayHosts(ctx.env).api}/sell/inventory/v1`;
}

function headers(ctx: EbayContext): Record<string, string> {
  return {
    Authorization: `Bearer ${ctx.accessToken}`,
    'Content-Type': 'application/json',
    'Content-Language': ctx.contentLanguage,
    Accept: 'application/json',
  };
}

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as { errors?: { message?: string; longMessage?: string }[] };
    const first = json.errors?.[0];
    if (first) return first.longMessage || first.message || text;
  } catch {
    /* not JSON */
  }
  return text || res.statusText;
}

/** Map a parsed product onto the eBay inventory-item payload and upsert it. */
export async function createOrReplaceInventoryItem(ctx: EbayContext, p: SheetProduct, fallbackCondition: string): Promise<void> {
  const aspects = Object.keys(p.aspects).length > 0 ? p.aspects : undefined;
  const body = {
    availability: { shipToLocationAvailability: { quantity: p.quantity } },
    condition: normalizeCondition(p.condition, fallbackCondition),
    product: {
      title: p.title,
      description: p.description || p.title,
      ...(aspects ? { aspects } : {}),
      ...(p.brand ? { brand: p.brand } : {}),
      ...(p.mpn ? { mpn: p.mpn } : {}),
      ...(p.ean ? { ean: [p.ean] } : {}),
      ...(p.images.length > 0 ? { imageUrls: p.images } : {}),
    },
  };
  const res = await fetch(`${inventoryBase(ctx)}/inventory_item/${encodeURIComponent(p.sku)}`, {
    method: 'PUT',
    headers: headers(ctx),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`inventory_item: ${await readError(res)}`);
}

/** Look up an existing offer id for this SKU (offers are unique per sku+marketplace+format). */
export async function findOfferId(ctx: EbayContext, sku: string): Promise<string | null> {
  const res = await fetch(`${inventoryBase(ctx)}/offer?sku=${encodeURIComponent(sku)}`, { headers: headers(ctx) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`offer lookup: ${await readError(res)}`);
  const data = (await res.json()) as { offers?: { offerId: string; marketplaceId: string }[] };
  const match = data.offers?.find((o) => o.marketplaceId === ctx.marketplaceId) ?? data.offers?.[0];
  return match?.offerId ?? null;
}

function offerBody(ctx: EbayContext, p: SheetProduct, pol: OfferPolicies) {
  return {
    sku: p.sku,
    marketplaceId: ctx.marketplaceId,
    format: 'FIXED_PRICE',
    availableQuantity: p.quantity,
    ...(p.categoryId || pol.categoryId ? { categoryId: p.categoryId || pol.categoryId } : {}),
    listingDescription: p.description || p.title,
    pricingSummary: { price: { value: p.price.toFixed(2), currency: p.currency || ctx.currency } },
    listingPolicies: {
      ...(pol.fulfillmentPolicyId ? { fulfillmentPolicyId: pol.fulfillmentPolicyId } : {}),
      ...(pol.paymentPolicyId ? { paymentPolicyId: pol.paymentPolicyId } : {}),
      ...(pol.returnPolicyId ? { returnPolicyId: pol.returnPolicyId } : {}),
    },
    ...(pol.merchantLocationKey ? { merchantLocationKey: pol.merchantLocationKey } : {}),
  };
}

/** Create a new offer for the SKU, returning the offer id. */
export async function createOffer(ctx: EbayContext, p: SheetProduct, pol: OfferPolicies): Promise<string> {
  const res = await fetch(`${inventoryBase(ctx)}/offer`, {
    method: 'POST',
    headers: headers(ctx),
    body: JSON.stringify(offerBody(ctx, p, pol)),
  });
  if (!res.ok) throw new Error(`offer create: ${await readError(res)}`);
  const data = (await res.json()) as { offerId: string };
  return data.offerId;
}

/** Update an existing offer (price/quantity/description changes from the sheet). */
export async function updateOffer(ctx: EbayContext, offerId: string, p: SheetProduct, pol: OfferPolicies): Promise<void> {
  const res = await fetch(`${inventoryBase(ctx)}/offer/${encodeURIComponent(offerId)}`, {
    method: 'PUT',
    headers: headers(ctx),
    body: JSON.stringify(offerBody(ctx, p, pol)),
  });
  if (!res.ok) throw new Error(`offer update: ${await readError(res)}`);
}

/** Publish the offer live and return the resulting eBay listing id. */
export async function publishOffer(ctx: EbayContext, offerId: string): Promise<string> {
  const res = await fetch(`${inventoryBase(ctx)}/offer/${encodeURIComponent(offerId)}/publish`, {
    method: 'POST',
    headers: headers(ctx),
  });
  if (!res.ok) throw new Error(`offer publish: ${await readError(res)}`);
  const data = (await res.json()) as { listingId: string };
  return data.listingId;
}
